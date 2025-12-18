import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw,
  ZoomIn,
  ZoomOut,
  X,
  Save,
  Square,
  Circle,
  ArrowRight as ArrowIcon,
  Type,
  Upload,
  Edit2,
  Loader,
  Download
} from 'lucide-react';
import {
  InspectionImage,
  getPendingImages,
  getPreviousDayImage,
  updateAnnotations,
  approveImage,
  getInspectionDetails,
  updateAIDamageData,
  replaceAIImage,
  uploadIncrementImage,
  updateImageComments
} from '../services/api/manualInspectionService';
import { cognitoService } from '../services/cognitoService';
import { getPresignedUploadUrl, uploadFileToS3 } from '../services/api/uploadService';

// Image with Comment Component
interface ImageWithCommentProps {
  label: string;
  imageBlobUrl: string | null;
  comment: string | null;
  editable: boolean;
  replaceable?: boolean;
  showAddButton?: boolean;
  loading?: boolean;
  error?: boolean;
  showProcessing?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onCommentChange: (text: string) => void;
  onReplace?: () => void;
  onAdd?: () => void;
}

const ImageWithComment: React.FC<ImageWithCommentProps> = ({
  label,
  imageBlobUrl,
  comment,
  editable,
  replaceable = false,
  showAddButton = false,
  loading = false,
  error = false,
  showProcessing = false,
  isActive = false,
  onClick,
  onCommentChange,
  onReplace,
  onAdd
}) => {
  return (
    <motion.div 
      className={`bg-white/10 backdrop-blur-lg rounded-xl p-3 transition-all duration-300 ${
        isActive ? 'ring-2 ring-blue-500 bg-blue-500/20' : onClick ? 'hover:bg-white/15 cursor-pointer' : ''
      }`}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-semibold text-sm ${isActive ? 'text-blue-300' : 'text-white'}`}>{label}</h3>
        {replaceable && onReplace && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
            disabled={loading}
            className="text-xs px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Replace
          </motion.button>
        )}
        {showAddButton && onAdd && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            disabled={loading}
            className="text-xs px-2 py-1 bg-green-500/20 border border-green-500/30 text-green-300 rounded disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Add
          </motion.button>
        )}
      </div>

      <div className={`relative bg-black rounded-lg overflow-hidden mb-3 transition-all duration-300 ${
        isActive ? 'aspect-square min-h-[250px]' : 'aspect-video'
      }`}>
        {loading || showProcessing ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-xs">
                {showProcessing ? 'AI Processing...' : 'Loading...'}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-red-800/50">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-300 text-xs">Failed to load</p>
            </div>
          </div>
        ) : imageBlobUrl ? (
          <img
            src={imageBlobUrl}
            alt={label}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">No image</p>
            </div>
          </div>
        )}
      </div>

      {editable && (
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Comment</label>
          <textarea
            value={comment || ''}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            rows={2}
          />
        </div>
      )}
    </motion.div>
  );
};

// Helper function to get image stream URL (backend proxy to avoid S3 auth issues)
const getImageStreamUrl = (image: InspectionImage): string => {
  // If streamUrl is provided and is absolute, use it directly
  if (image.streamUrl && (image.streamUrl.startsWith('http://') || image.streamUrl.startsWith('https://'))) {
    return image.streamUrl;
  }
  
  // If streamUrl is provided as relative path, prepend base URL
  if (image.streamUrl) {
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    return `${baseURL}${image.streamUrl.startsWith('/') ? '' : '/'}${image.streamUrl}`;
  }
  
  // Fallback: construct stream URL from image ID
  const baseURL = import.meta.env.VITE_API_BASE_URL || '';
  return `${baseURL}/api/manual-inspection/images/${image.id}/stream`;
};

// Helper function to fetch image as blob with authentication
const fetchImageAsBlob = async (image: InspectionImage): Promise<string> => {
  try {
    const streamUrl = getImageStreamUrl(image);
    console.log('[ManualInspection] Fetching image as blob from:', streamUrl);
    
    // Get auth token
    const token = await cognitoService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Fetch image with auth header
    const response = await fetch(streamUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Convert to blob and create object URL
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    console.log('[ManualInspection] Image blob URL created:', blobUrl);
    return blobUrl;
  } catch (error) {
    console.error('[ManualInspection] Error fetching image as blob:', error);
    throw error;
  }
};

interface ManualInspectionDashboardProps {
  onBack: () => void;
}

type ViewMode = 'grid' | 'review';
type DrawingTool = 'rectangle' | 'circle' | 'arrow' | 'text' | 'none';

interface Drawing {
  id: string;
  type: 'rectangle' | 'circle' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  fontSize?: number;
  color: string;
  lineWidth: number;
}

const ManualInspectionDashboard: React.FC<ManualInspectionDashboardProps> = ({ onBack }) => {
  const [pendingImages, setPendingImages] = useState<InspectionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImage, setSelectedImage] = useState<InspectionImage | null>(null);
  const [previousDayImage, setPreviousDayImage] = useState<InspectionImage | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('none');
  const [drawingColor, setDrawingColor] = useState('#FF0000');
  const [lineWidth, setLineWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number } | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const isTextInputActiveRef = useRef<boolean>(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isDraggingDrawing, setIsDraggingDrawing] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [savingAnnotations, setSavingAnnotations] = useState(false);
  const [approving, setApproving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [previousImageBlobUrl, setPreviousImageBlobUrl] = useState<string | null>(null);
  const [aiProcessedImageBlobUrls, setAiProcessedImageBlobUrls] = useState<string[]>([]);
  const [incrementImageBlobUrl, setIncrementImageBlobUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<{ original?: string; ai1?: string; ai2?: string; increment?: string }>({});
  const [savingComments, setSavingComments] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [activeImageType, setActiveImageType] = useState<'original' | 'previous' | 'ai1' | 'ai2' | 'increment'>('original');
  const [activeImageBlobUrl, setActiveImageBlobUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

  useEffect(() => {
    console.log('[ManualInspection] Component mounted, initializing...');
    fetchPendingImages();
    
    // Poll every 30 seconds for new images
    console.log('[ManualInspection] Setting up polling interval (30s)');
    pollingIntervalRef.current = setInterval(() => {
      console.log('[ManualInspection] Polling interval triggered, fetching images...');
      fetchPendingImages(true);
    }, 30000);

    return () => {
      console.log('[ManualInspection] Component unmounting, clearing interval');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchPendingImages = async (silent: boolean = false) => {
    try {
      console.log('[ManualInspection] Fetching pending images...', { silent, clientName: 'REFUX' });
      if (!silent) {
        setLoading(true);
      }
      setError('');
      const response = await getPendingImages({ clientName: 'REFUX' });
      console.log('[ManualInspection] API Response:', {
        success: response.success,
        count: response.count,
        imagesLength: response.images?.length || 0,
        images: response.images,
        fullResponse: response
      });
      if (response.success) {
        console.log('[ManualInspection] Setting pending images:', response.images.length, 'images');
        // Sort by latest first (descending by id or createdAt)
        const sortedImages = [...response.images].sort((a, b) => {
          // Sort by id descending (higher id = newer) or by createdAt if available
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return (b.id || 0) - (a.id || 0);
        });
        setPendingImages(sortedImages);
      } else {
        console.warn('[ManualInspection] API returned success=false:', response);
      }
    } catch (err: any) {
      console.error('[ManualInspection] Error fetching pending images:', {
        error: err,
        message: err?.message,
        response: err?.response,
        responseData: err?.response?.data,
        responseStatus: err?.response?.status,
        stack: err?.stack
      });
      if (!silent) {
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to load pending images';
        console.error('[ManualInspection] Setting error:', errorMessage);
        setError(errorMessage);
      }
    } finally {
      if (!silent) {
        console.log('[ManualInspection] Fetch complete, setting loading to false');
        setLoading(false);
      }
    }
  };

  const handleImageClick = async (image: InspectionImage) => {
    setSelectedImage(image);
    setViewMode('review');
    setDrawings([]);
    setZoom(1);
    setImageOffset({ x: 0, y: 0 });
    setCurrentTool('none');
    setImageLoaded(false);
    setActiveImageType('original');
    setImageLoadError(false);
    
    // Clean up previous blob URLs
    if (imageBlobUrl) {
      URL.revokeObjectURL(imageBlobUrl);
      setImageBlobUrl(null);
    }
    if (previousImageBlobUrl) {
      URL.revokeObjectURL(previousImageBlobUrl);
      setPreviousImageBlobUrl(null);
    }
    // Clean up AI processed image blob URLs
    aiProcessedImageBlobUrls.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setAiProcessedImageBlobUrls([]);
    if (incrementImageBlobUrl) {
      URL.revokeObjectURL(incrementImageBlobUrl);
      setIncrementImageBlobUrl(null);
    }
    
    // Initialize comments from image
    setComments(image.imageComments || {});

    // Load existing annotations if any
    if (image.annotations) {
      try {
        const parsed = JSON.parse(image.annotations);
        if (parsed.drawings) {
          setDrawings(parsed.drawings);
        }
      } catch (e) {
        console.error('Failed to parse annotations:', e);
      }
    }

    // Fetch current image as blob
    let mainBlobUrl: string | null = null;
    try {
      mainBlobUrl = await fetchImageAsBlob(image);
      setImageBlobUrl(mainBlobUrl);
    } catch (err) {
      console.error('Failed to load image:', err);
      setImageLoadError(true);
    }

    // Fetch AI processed images if available (now using stream URLs from backend)
    if (image.aiProcessed && image.aiProcessedImageUrls && image.aiProcessedImageUrls.length > 0) {
      const aiBlobPromises = image.aiProcessedImageUrls.map(async (url) => {
        try {
          // Skip S3 URLs - only process backend stream URLs
          if (url.includes('s3.amazonaws.com') || url.includes('s3.') || (url.startsWith('https://') && !url.includes('/api/'))) {
            console.warn(`Skipping S3 URL (should use stream URL): ${url}`);
            return null;
          }
          
          // streamUrl is a backend stream URL (e.g., /api/manual-inspection/ai-images/456/stream?type=model1)
          // Make it absolute if needed
          let fullUrl = url;
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            const baseURL = import.meta.env.VITE_API_BASE_URL || '';
            fullUrl = `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
          }
          
          const token = await cognitoService.getAccessToken();
          if (!token) {
            throw new Error('No authentication token available');
          }
          
          const response = await fetch(fullUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            console.warn(`Failed to fetch AI processed image from ${fullUrl}: ${response.status}`);
            return null;
          }
          
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        } catch (err) {
          console.error('Failed to load AI processed image:', err);
          return null;
        }
      });
      
      const aiBlobUrls = await Promise.all(aiBlobPromises);
      setAiProcessedImageBlobUrls(aiBlobUrls.filter(url => url !== null) as string[]);
    } else {
      setAiProcessedImageBlobUrls([]);
    }

    // Fetch previous day image
    setLoadingPrevious(true);
    try {
      const previousResponse = await getPreviousDayImage(image.carNumber, image.imageType);
      if (previousResponse.found && previousResponse.image) {
        setPreviousDayImage(previousResponse.image);
        // Fetch previous day image as blob
        try {
          const prevBlobUrl = await fetchImageAsBlob(previousResponse.image);
          setPreviousImageBlobUrl(prevBlobUrl);
        } catch (err) {
          console.error('Failed to load previous day image blob:', err);
        }
      } else {
        setPreviousDayImage(null);
      }
    } catch (err) {
      console.error('Failed to load previous day image:', err);
      setPreviousDayImage(null);
    } finally {
      setLoadingPrevious(false);
    }

    // Fetch increment image if available
    if (image.incrementImageStreamUrl) {
      try {
        const incrementBlobUrl = await fetchImageAsBlob({
          ...image,
          streamUrl: image.incrementImageStreamUrl
        });
        setIncrementImageBlobUrl(incrementBlobUrl);
      } catch (err) {
        console.error('Failed to load increment image:', err);
      }
    } else {
      setIncrementImageBlobUrl(null);
    }

    // Set initial active image to original immediately
    setActiveImageType('original');
    // Set active image blob URL immediately if we have it
    if (mainBlobUrl) {
      setActiveImageBlobUrl(mainBlobUrl);
    }
  };

  // Update active image when activeImageType or source URLs change
  useEffect(() => {
    if (!selectedImage) return;

    let newBlobUrl: string | null = null;
    
    if (activeImageType === 'original') {
      newBlobUrl = imageBlobUrl;
    } else if (activeImageType === 'previous') {
      newBlobUrl = previousImageBlobUrl;
    } else if (activeImageType === 'ai1') {
      newBlobUrl = aiProcessedImageBlobUrls[0] || null;
    } else if (activeImageType === 'ai2') {
      newBlobUrl = aiProcessedImageBlobUrls[1] || null;
    } else if (activeImageType === 'increment') {
      newBlobUrl = incrementImageBlobUrl;
    }

    // Always update to sync with source URLs (especially important for original image)
    setActiveImageBlobUrl(newBlobUrl);
    if (newBlobUrl) {
      setImageLoaded(false);
      setImageLoadError(false);
    }
  }, [activeImageType, imageBlobUrl, previousImageBlobUrl, aiProcessedImageBlobUrls, incrementImageBlobUrl, selectedImage]);

  const handleBackToGrid = () => {
    // Clean up blob URLs
    if (imageBlobUrl) {
      URL.revokeObjectURL(imageBlobUrl);
      setImageBlobUrl(null);
    }
    if (previousImageBlobUrl) {
      URL.revokeObjectURL(previousImageBlobUrl);
      setPreviousImageBlobUrl(null);
    }
    
    setViewMode('grid');
    setSelectedImage(null);
    setPreviousDayImage(null);
    setDrawings([]);
    setCurrentTool('none');
    setImageLoaded(false);
    setImageLoadError(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'none' || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate image display area using natural dimensions
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = rect.width / rect.height;
    let drawWidth = rect.width;
    let drawHeight = rect.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = rect.width / imgAspect;
      drawY = (rect.height - drawHeight) / 2;
    } else {
      drawWidth = rect.height * imgAspect;
      drawX = (rect.width - drawWidth) / 2;
    }

    // Convert mouse coordinates to image coordinates
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Use naturalWidth/naturalHeight for accurate image coordinates
    const x = ((mouseX - drawX - imageOffset.x) / zoom) * (img.naturalWidth / drawWidth);
    const y = ((mouseY - drawY - imageOffset.y) / zoom) * (img.naturalHeight / drawHeight);

    if (currentTool === 'text') {
      // For text, show input dialog at click position
      setTextInputPosition({ x, y });
      setTextInput('');
      isTextInputActiveRef.current = true;
      // Focus the input after a tiny delay to ensure it's rendered
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
      }, 50);
      return;
    }

    setIsDrawing(true);
    setDrawStart({ x, y });

    if (currentTool === 'arrow') {
      // For arrow, start drawing immediately (temporary, no id yet)
      const tempDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'arrow',
        x: x, // Add x for type compatibility
        y: y, // Add y for type compatibility
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color: drawingColor,
        lineWidth
      };
      setDrawings(prev => [...prev, tempDrawing]);
    } else if (currentTool === 'rectangle') {
      // Start temporary rectangle
      const tempDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'rectangle',
        x: x,
        y: y,
        width: 0,
        height: 0,
        color: drawingColor,
        lineWidth
      };
      setDrawings(prev => [...prev, tempDrawing]);
    } else if (currentTool === 'circle') {
      // Start temporary circle
      const tempDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'circle',
        x: x,
        y: y,
        radius: 0,
        color: drawingColor,
        lineWidth
      };
      setDrawings(prev => [...prev, tempDrawing]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'none') return;

    if (isDragging && !isDrawing) {
      // Pan the image
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setImageOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDrawing || !drawStart || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
    const rect = canvas.getBoundingClientRect();

    // Calculate image display area using natural dimensions
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = rect.width / rect.height;
    let drawWidth = rect.width;
    let drawHeight = rect.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = rect.width / imgAspect;
      drawY = (rect.height - drawHeight) / 2;
    } else {
      drawWidth = rect.height * imgAspect;
      drawX = (rect.width - drawWidth) / 2;
    }

    // Convert mouse coordinates to image coordinates using natural dimensions
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = ((mouseX - drawX - imageOffset.x) / zoom) * (img.naturalWidth / drawWidth);
    const y = ((mouseY - drawY - imageOffset.y) / zoom) * (img.naturalHeight / drawHeight);

    // Handle dragging existing drawing
    if (isDraggingDrawing && selectedDrawingId && dragOffset) {
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;
      
      setDrawings(prev => prev.map(d => {
        if (d.id === selectedDrawingId) {
          if (d.type === 'rectangle' && d.width && d.height) {
            return { ...d, x: newX - d.width / 2, y: newY - d.height / 2 };
          } else if (d.type === 'circle' && d.radius) {
            return { ...d, x: newX, y: newY };
          } else if (d.type === 'arrow' && d.x1 !== undefined && d.y1 !== undefined && d.x2 !== undefined && d.y2 !== undefined) {
            const dx = d.x2 - d.x1;
            const dy = d.y2 - d.y1;
            return { ...d, x1: newX, y1: newY, x2: newX + dx, y2: newY + dy };
          } else if (d.type === 'text') {
            return { ...d, x: newX, y: newY };
          }
        }
        return d;
      }));
      return;
    }

    if (currentTool === 'rectangle') {
      const newDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'rectangle',
        x: Math.min(drawStart.x, x),
        y: Math.min(drawStart.y, y),
        width: Math.abs(x - drawStart.x),
        height: Math.abs(y - drawStart.y),
        color: drawingColor,
        lineWidth
      };
      setDrawings(prev => {
        // Find and update the temporary rectangle being drawn
        const tempIndex = prev.findIndex(d => d.type === 'rectangle' && !d.id);
        if (tempIndex >= 0) {
          const updated = [...prev];
          updated[tempIndex] = newDrawing;
          return updated;
        } else {
          return [...prev, newDrawing];
        }
      });
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(x - drawStart.x, 2) + Math.pow(y - drawStart.y, 2)
      );
      const newDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'circle',
        x: drawStart.x,
        y: drawStart.y,
        radius,
        color: drawingColor,
        lineWidth
      };
      setDrawings(prev => {
        // Find and update the temporary circle being drawn
        const tempIndex = prev.findIndex(d => d.type === 'circle' && !d.id);
        if (tempIndex >= 0) {
          const updated = [...prev];
          updated[tempIndex] = newDrawing;
          return updated;
        } else {
          return [...prev, newDrawing];
        }
      });
    } else if (currentTool === 'arrow') {
      const newDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'arrow',
        x: drawStart.x, // Add x for type compatibility
        y: drawStart.y, // Add y for type compatibility
        x1: drawStart.x,
        y1: drawStart.y,
        x2: x,
        y2: y,
        color: drawingColor,
        lineWidth
      };
      setDrawings(prev => {
        // Find and update the temporary arrow being drawn
        const tempIndex = prev.findIndex(d => d.type === 'arrow' && !d.id);
        if (tempIndex >= 0) {
          const updated = [...prev];
          updated[tempIndex] = newDrawing;
          return updated;
        } else {
          return [...prev, newDrawing];
        }
      });
    }
  };

  // Helper function to check if a point is inside a drawing
  const getDrawingAtPoint = (x: number, y: number): Drawing | null => {
    // Check in reverse order (top to bottom) to get the topmost drawing
    // Only check drawings with ids (finalized drawings)
    for (let i = drawings.length - 1; i >= 0; i--) {
      const drawing = drawings[i];
      if (!drawing.id) continue; // Skip temporary drawings
      
      if (drawing.type === 'rectangle' && drawing.width && drawing.height) {
        // Check if point is inside rectangle bounds (with small tolerance for easier clicking)
        const tolerance = 2; // 2 pixel tolerance
        if (x >= drawing.x - tolerance && x <= drawing.x + drawing.width + tolerance &&
            y >= drawing.y - tolerance && y <= drawing.y + drawing.height + tolerance) {
          return drawing;
        }
      } else if (drawing.type === 'circle' && drawing.radius) {
        const distance = Math.sqrt(Math.pow(x - drawing.x, 2) + Math.pow(y - drawing.y, 2));
        if (distance <= drawing.radius) {
          return drawing;
        }
      } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
        // Check if point is near the arrow line (within 5 pixels)
        const dx = drawing.x2 - drawing.x1;
        const dy = drawing.y2 - drawing.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          const t = Math.max(0, Math.min(1, ((x - drawing.x1) * dx + (y - drawing.y1) * dy) / (length * length)));
          const projX = drawing.x1 + t * dx;
          const projY = drawing.y1 + t * dy;
          const distance = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
          if (distance <= 5) {
            return drawing;
          }
        }
      } else if (drawing.type === 'text' && drawing.text) {
        // For text, use a much simpler distance-based hit detection
        // This is more forgiving and easier to click
        const textX = drawing.x;
        const textY = drawing.y; // y is baseline position
        
        // Use a generous hit radius - make it easy to click text
        const hitRadius = Math.max(30, (drawing.fontSize || 16) * 1.5); // At least 30px, or 1.5x font size
        
        // Calculate distance from click point to text position
        const distance = Math.sqrt(Math.pow(x - textX, 2) + Math.pow(y - textY, 2));
        
        if (distance <= hitRadius) {
          return drawing;
        }
      }
    }
    return null;
  };

  // Handle text input confirmation
  const handleTextInputConfirm = () => {
    if (textInputPosition && textInput.trim()) {
      const newDrawing: Drawing = {
        id: `drawing-${Date.now()}-${Math.random()}`,
        type: 'text',
        x: textInputPosition.x,
        y: textInputPosition.y,
        text: textInput.trim(),
        fontSize: fontSize,
        color: drawingColor,
        lineWidth: 1
      };
      setDrawings(prev => [...prev, newDrawing]);
    }
    setTextInputPosition(null);
    setTextInput('');
    isTextInputActiveRef.current = false;
  };

  const handleMouseUp = () => {
    // Finalize any temporary drawings (those without id)
    if (isDrawing && drawStart) {
      setDrawings(prev => prev.map(d => {
        if (!d.id) {
          // Assign id to temporary drawing
          const finalized = { ...d, id: `drawing-${Date.now()}-${Math.random()}` };
          // Auto-switch to none tool after creating drawing so user can immediately drag it
          setCurrentTool('none');
          return finalized;
        }
        return d;
      }));
    }
    
    setIsDrawing(false);
    setDrawStart(null);
    setIsDraggingDrawing(false);
    setDragOffset(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent text input clicks from triggering canvas drawing
    if (textInputPosition) {
      return;
    }
    // Don't handle if clicking on text input dialog
    const target = e.target as HTMLElement;
    if (target.closest('.text-input-dialog')) {
      return;
    }
    
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate image display area
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = rect.width / rect.height;
    let drawWidth = rect.width;
    let drawHeight = rect.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = rect.width / imgAspect;
      drawY = (rect.height - drawHeight) / 2;
    } else {
      drawWidth = rect.height * imgAspect;
      drawX = (rect.width - drawWidth) / 2;
    }

    // Convert mouse coordinates to image coordinates
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = ((mouseX - drawX - imageOffset.x) / zoom) * (img.naturalWidth / drawWidth);
    const y = ((mouseY - drawY - imageOffset.y) / zoom) * (img.naturalHeight / drawHeight);

    // Always check if clicking on an existing drawing first (even when a tool is selected)
    // This allows dragging existing drawings regardless of current tool
    const clickedDrawing = getDrawingAtPoint(x, y);
    if (clickedDrawing && clickedDrawing.id) {
      // If clicking on an existing drawing, drag it instead of creating a new one
      setSelectedDrawingId(clickedDrawing.id);
      setIsDraggingDrawing(true);
      setCurrentTool('none'); // Switch to none tool to enable dragging
      // Calculate offset from drawing center/start
      if (clickedDrawing.type === 'rectangle' && clickedDrawing.width && clickedDrawing.height) {
        setDragOffset({
          x: x - (clickedDrawing.x + clickedDrawing.width / 2),
          y: y - (clickedDrawing.y + clickedDrawing.height / 2)
        });
      } else if (clickedDrawing.type === 'circle' && clickedDrawing.radius) {
        setDragOffset({
          x: x - clickedDrawing.x,
          y: y - clickedDrawing.y
        });
      } else if (clickedDrawing.type === 'arrow' && clickedDrawing.x1 !== undefined && clickedDrawing.y1 !== undefined) {
        setDragOffset({
          x: x - clickedDrawing.x1,
          y: y - clickedDrawing.y1
        });
      } else if (clickedDrawing.type === 'text' && clickedDrawing.text) {
        // For text, use the text position directly
        setDragOffset({
          x: x - clickedDrawing.x,
          y: y - clickedDrawing.y
        });
      }
      return; // Don't proceed with tool-specific logic
    }

    // If not clicking on a drawing, proceed with normal tool behavior
    if (currentTool === 'none') {
      setSelectedDrawingId(null);
      // Enable panning if not clicking on a drawing
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      handleMouseDown(e);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingDrawing && selectedDrawingId && dragOffset && canvasRef.current && imageRef.current) {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      const rect = canvas.getBoundingClientRect();
      
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = rect.width / rect.height;
      let drawWidth = rect.width;
      let drawHeight = rect.height;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > canvasAspect) {
        drawHeight = rect.width / imgAspect;
        drawY = (rect.height - drawHeight) / 2;
      } else {
        drawWidth = rect.height * imgAspect;
        drawX = (rect.width - drawWidth) / 2;
      }

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const x = ((mouseX - drawX - imageOffset.x) / zoom) * (img.naturalWidth / drawWidth);
      const y = ((mouseY - drawY - imageOffset.y) / zoom) * (img.naturalHeight / drawHeight);

      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;
      
      setDrawings(prev => prev.map(d => {
        if (d.id === selectedDrawingId) {
          if (d.type === 'rectangle' && d.width && d.height) {
            return { ...d, x: newX - d.width / 2, y: newY - d.height / 2 };
          } else if (d.type === 'circle' && d.radius) {
            return { ...d, x: newX, y: newY };
          } else if (d.type === 'arrow' && d.x1 !== undefined && d.y1 !== undefined && d.x2 !== undefined && d.y2 !== undefined) {
            const dx = d.x2 - d.x1;
            const dy = d.y2 - d.y1;
            return { ...d, x1: newX, y1: newY, x2: newX + dx, y2: newY + dy };
          } else if (d.type === 'text') {
            return { ...d, x: newX, y: newY };
          }
        }
        return d;
      }));
      return;
    }
    
    if (isDragging && currentTool === 'none') {
      handleMouseMove(e);
    } else if (isDrawing) {
      handleMouseMove(e);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    handleMouseUp();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Wait for active image blob URL to be set first
    if (!activeImageBlobUrl) {
      return;
    }
    
    const img = imageRef.current;
    if (!img) {
      console.log('[ManualInspection] Canvas draw skipped - image element not in DOM yet');
      return;
    }
    
    // Check if image is actually loaded - use complete and dimensions check
    // The imageLoaded state might lag behind, so check the actual image state
    const isImageReady = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    
    if (!isImageReady) {
      console.log('[ManualInspection] Canvas draw skipped - image not ready yet:', {
        complete: img.complete,
        imageLoaded,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
      return;
    }
    
    // If image is ready but imageLoaded state is false, update it
    if (!imageLoaded && isImageReady) {
      setImageLoaded(true);
      setImageLoadError(false);
    }

    // Set canvas size to match display size (not image size for better control)
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scaled image dimensions using natural size
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = canvas.width / canvas.height;
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > canvasAspect) {
      drawHeight = canvas.width / imgAspect;
      drawY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
    }

    // Apply zoom and offset
    ctx.save();
    ctx.translate(drawX + imageOffset.x, drawY + imageOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw image using natural dimensions
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, drawWidth / zoom, drawHeight / zoom);

    // Draw annotations
    drawings.forEach(drawing => {
      const isSelected = drawing.id === selectedDrawingId;
      const baseLineWidth = (drawing.lineWidth || 2) / zoom;
      
      // Draw selection border first (behind the drawing)
      if (isSelected) {
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = baseLineWidth + 3;
        ctx.setLineDash([8, 4]);
        
        if (drawing.type === 'rectangle' && drawing.width && drawing.height) {
          ctx.strokeRect(drawing.x - 3, drawing.y - 3, drawing.width + 6, drawing.height + 6);
        } else if (drawing.type === 'circle' && drawing.radius) {
          ctx.beginPath();
          ctx.arc(drawing.x, drawing.y, drawing.radius + 3, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
          ctx.beginPath();
          ctx.moveTo(drawing.x1, drawing.y1);
          ctx.lineTo(drawing.x2, drawing.y2);
          ctx.stroke();
        } else if (drawing.type === 'text' && drawing.text) {
          // Measure text to draw accurate selection border
          // Use the same font size as when drawing (accounting for zoom)
          ctx.font = `${drawing.fontSize || 16}px Arial`;
          const metrics = ctx.measureText(drawing.text);
          const textWidth = metrics.width;
          const textHeight = drawing.fontSize || 16;
          // Text y is baseline, so selection box goes from y - textHeight to y
          ctx.strokeRect(
            drawing.x - 3, 
            drawing.y - textHeight - 3, 
            textWidth + 6, 
            textHeight + 6
          );
        }
      }
      
      // Draw the actual drawing
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = baseLineWidth;
      ctx.setLineDash([]);
      ctx.fillStyle = drawing.color;

      if (drawing.type === 'rectangle' && drawing.width && drawing.height) {
        ctx.strokeRect(drawing.x, drawing.y, drawing.width, drawing.height);
      } else if (drawing.type === 'circle' && drawing.radius) {
        ctx.beginPath();
        ctx.arc(drawing.x, drawing.y, drawing.radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(drawing.x1, drawing.y1);
        ctx.lineTo(drawing.x2, drawing.y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(drawing.y2 - drawing.y1, drawing.x2 - drawing.x1);
        const arrowLength = 15 / zoom;
        ctx.beginPath();
        ctx.moveTo(drawing.x2, drawing.y2);
        ctx.lineTo(
          drawing.x2 - arrowLength * Math.cos(angle - Math.PI / 6),
          drawing.y2 - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(drawing.x2, drawing.y2);
        ctx.lineTo(
          drawing.x2 - arrowLength * Math.cos(angle + Math.PI / 6),
          drawing.y2 - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (drawing.type === 'text' && drawing.text) {
        // Font size should be in image coordinates, not divided by zoom
        // The zoom is already applied via ctx.scale, so we use the original font size
        ctx.font = `${drawing.fontSize || 16}px Arial`;
        ctx.fillText(drawing.text, drawing.x, drawing.y);
      }
    });

    ctx.restore();
  }, [drawings, zoom, imageOffset, selectedImage, imageLoaded, activeImageBlobUrl]);

  const handleImageLoad = () => {
    console.log('[ManualInspection] Image loaded successfully');
    setImageLoaded(true);
    setImageLoadError(false);
    // Trigger redraw when image loads
    const canvas = canvasRef.current;
    if (canvas) {
      // Force re-render
      canvas.width = canvas.width;
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('[ManualInspection] Image failed to load:', {
      src: e.currentTarget.src,
      error: e
    });
    setImageLoadError(true);
    setImageLoaded(false);
  };

  const handleSaveAnnotations = async () => {
    if (!selectedImage) return;

    setSavingAnnotations(true);
    try {
      const annotationsJson = JSON.stringify({ drawings });
      await updateAnnotations(selectedImage.id, annotationsJson);
      // Update local image with new annotations
      setSelectedImage({
        ...selectedImage,
        annotations: annotationsJson
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save annotations');
    } finally {
      setSavingAnnotations(false);
    }
  };

  // Handle file upload for replacing/adding images
  const handleFileUpload = async (file: File, onSuccess: (s3Url: string) => Promise<void>) => {
    try {
      const fileName = `inspection-${selectedImage?.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const contentType = file.type || 'image/jpeg';
      
      const { presignedUrl, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      
      await uploadFileToS3({ presignedUrl, file, contentType });
      
      await onSuccess(s3Url);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to upload image');
      throw err;
    }
  };

  // Replace AI processed image
  const handleReplaceAIImage = async (modelType: 'model1' | 'model2') => {
    if (!selectedImage) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingImage(`ai-${modelType}`);
      try {
        await handleFileUpload(file, async (s3Url) => {
          const response = await replaceAIImage(selectedImage.id, {
            modelType,
            imageUrl: s3Url
          });

          if (response.success) {
            // Update selected image
            setSelectedImage(response.image);
            // Update in pending images list
            setPendingImages(prev => prev.map(img => 
              img.id === response.image.id ? response.image : img
            ));
            
            // Reload AI processed images
            if (response.image.aiProcessedImageUrls && response.image.aiProcessedImageUrls.length > 0) {
              const aiBlobPromises = response.image.aiProcessedImageUrls.map(async (url) => {
                try {
                  if (url.includes('s3.amazonaws.com') || url.includes('s3.') || (url.startsWith('https://') && !url.includes('/api/'))) {
                    return null;
                  }
                  
                  let fullUrl = url;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
                    fullUrl = `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
                  }
                  
                  const token = await cognitoService.getAccessToken();
                  if (!token) throw new Error('No authentication token available');
                  
                  const response = await fetch(fullUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  
                  if (!response.ok) return null;
                  
                  const blob = await response.blob();
                  return URL.createObjectURL(blob);
                } catch (err) {
                  return null;
                }
              });
              
              const aiBlobUrls = await Promise.all(aiBlobPromises);
              setAiProcessedImageBlobUrls(aiBlobUrls.filter(url => url !== null) as string[]);
            }
          }
        });
      } catch (err) {
        console.error('Failed to replace AI image:', err);
      } finally {
        setUploadingImage(null);
      }
    };
    input.click();
  };

  // Upload increment image
  const handleUploadIncrementImage = async () => {
    if (!selectedImage) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingImage('increment');
      try {
        await handleFileUpload(file, async (s3Url) => {
          const response = await uploadIncrementImage(selectedImage.id, {
            imageUrl: s3Url
          });

          if (response.success) {
            // Update selected image
            setSelectedImage(response.image);
            // Update in pending images list
            setPendingImages(prev => prev.map(img => 
              img.id === response.image.id ? response.image : img
            ));
            
            // Load increment image
            if (response.image.incrementImageStreamUrl) {
              try {
                const incrementBlobUrl = await fetchImageAsBlob({
                  ...response.image,
                  streamUrl: response.image.incrementImageStreamUrl
                });
                setIncrementImageBlobUrl(incrementBlobUrl);
              } catch (err) {
                console.error('Failed to load increment image:', err);
              }
            }
          }
        });
      } catch (err) {
        console.error('Failed to upload increment image:', err);
      } finally {
        setUploadingImage(null);
      }
    };
    input.click();
  };

  // Update comments
  const handleSaveComments = async () => {
    if (!selectedImage) return;

    setSavingComments(true);
    try {
      const response = await updateImageComments(selectedImage.id, { comments });
      
      if (response.success) {
        // Update selected image
        setSelectedImage(response.image);
        // Update in pending images list
        setPendingImages(prev => prev.map(img => 
          img.id === response.image.id ? response.image : img
        ));
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save comments');
    } finally {
      setSavingComments(false);
    }
  };

  // Export canvas (original image + drawings) as image blob
  const exportCanvasAsImage = async (): Promise<Blob | null> => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) {
      alert('Image not loaded yet. Please wait for the image to load.');
      return null;
    }

    const img = imageRef.current;
    
    // Create a temporary canvas with the full image size
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const ctx = tempCanvas.getContext('2d');
    
    if (!ctx) return null;

    // Draw the original image
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    // Draw all annotations on top (drawings are already in image coordinates)
    drawings.forEach(drawing => {
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = drawing.lineWidth || 2;
      ctx.fillStyle = drawing.color;
      ctx.setLineDash([]);

      if (drawing.type === 'rectangle' && drawing.width && drawing.height && drawing.x !== undefined && drawing.y !== undefined) {
        ctx.strokeRect(drawing.x, drawing.y, drawing.width, drawing.height);
      } else if (drawing.type === 'circle' && drawing.radius && drawing.x !== undefined && drawing.y !== undefined) {
        ctx.beginPath();
        ctx.arc(drawing.x, drawing.y, drawing.radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(drawing.x1, drawing.y1);
        ctx.lineTo(drawing.x2, drawing.y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(drawing.y2 - drawing.y1, drawing.x2 - drawing.x1);
        const arrowLength = 15;
        ctx.beginPath();
        ctx.moveTo(drawing.x2, drawing.y2);
        ctx.lineTo(
          drawing.x2 - arrowLength * Math.cos(angle - Math.PI / 6),
          drawing.y2 - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(drawing.x2, drawing.y2);
        ctx.lineTo(
          drawing.x2 - arrowLength * Math.cos(angle + Math.PI / 6),
          drawing.y2 - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (drawing.type === 'text' && drawing.text) {
        ctx.font = `${drawing.fontSize || 16}px Arial`;
        ctx.fillText(drawing.text, drawing.x, drawing.y);
      }
    });

    // Convert canvas to blob
    return new Promise((resolve) => {
      tempCanvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  // Download drawn image
  const handleDownloadDrawnImage = async () => {
    const blob = await exportCanvasAsImage();
    if (!blob) {
      alert('Failed to export image. Please try again.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawn-image-${selectedImage?.id || 'export'}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Replace AI image or set as increment using drawn image
  const handleUseDrawnImageAs = async (target: 'model1' | 'model2' | 'increment') => {
    if (!selectedImage) return;

    const drawnImageBlob = await exportCanvasAsImage();
    if (!drawnImageBlob) {
      alert('Failed to export drawn image. Please try again.');
      return;
    }

    setUploadingImage(target === 'increment' ? 'increment' : `ai-${target}`);
    try {
      const fileName = `drawn-${selectedImage.id}-${Date.now()}.jpg`;
      const contentType = 'image/jpeg';
      
      const { presignedUrl, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      
      await uploadFileToS3({ presignedUrl, file: drawnImageBlob, contentType });
      
      if (target === 'increment') {
        // Upload as increment image
        const response = await uploadIncrementImage(selectedImage.id, {
          imageUrl: s3Url
        });

        if (response.success) {
          setSelectedImage(response.image);
          setPendingImages(prev => prev.map(img => 
            img.id === response.image.id ? response.image : img
          ));
          
          // Load increment image
          if (response.image.incrementImageStreamUrl) {
            try {
              const incrementBlobUrl = await fetchImageAsBlob({
                ...response.image,
                streamUrl: response.image.incrementImageStreamUrl
              });
              setIncrementImageBlobUrl(incrementBlobUrl);
            } catch (err) {
              console.error('Failed to load increment image:', err);
            }
          }
          alert('Drawn image saved as increment image!');
        }
      } else {
        // Replace AI image
        const response = await replaceAIImage(selectedImage.id, {
          modelType: target,
          imageUrl: s3Url
        });

        if (response.success) {
          setSelectedImage(response.image);
          setPendingImages(prev => prev.map(img => 
            img.id === response.image.id ? response.image : img
          ));
          
          // Reload AI processed images
          if (response.image.aiProcessedImageUrls && response.image.aiProcessedImageUrls.length > 0) {
            const aiBlobPromises = response.image.aiProcessedImageUrls.map(async (url) => {
              try {
                if (url.includes('s3.amazonaws.com') || url.includes('s3.') || (url.startsWith('https://') && !url.includes('/api/'))) {
                  return null;
                }
                
                let fullUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                  const baseURL = import.meta.env.VITE_API_BASE_URL || '';
                  fullUrl = `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
                }
                
                const token = await cognitoService.getAccessToken();
                if (!token) throw new Error('No authentication token available');
                
                const response = await fetch(fullUrl, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!response.ok) return null;
                
                const blob = await response.blob();
                return URL.createObjectURL(blob);
              } catch (err) {
                return null;
              }
            });
            
            const aiBlobUrls = await Promise.all(aiBlobPromises);
            setAiProcessedImageBlobUrls(aiBlobUrls.filter(url => url !== null) as string[]);
          }
          alert(`Drawn image saved as AI Model ${target === 'model1' ? '1' : '2'}!`);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save drawn image');
      console.error('Failed to use drawn image:', err);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedImage) return;

    setApproving(true);
    try {
      const annotationsJson = drawings.length > 0 ? JSON.stringify({ drawings }) : undefined;
      const response = await approveImage(selectedImage.id, annotationsJson);
      
      // Remove approved image from pending list
      setPendingImages(prev => prev.filter(img => img.id !== selectedImage.id));
      
      // Show success message
      if (response.inspectionProgress.isComplete) {
        alert('All images approved! Report generation started.');
      } else {
        alert(`Approved! Progress: ${response.inspectionProgress.approvedCount}/10`);
      }
      
      // Go back to grid
      handleBackToGrid();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve image');
    } finally {
      setApproving(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setImageOffset({ x: 0, y: 0 });
  };

  const getImageTypeLabel = (imageType: string) => {
    return imageType.charAt(0).toUpperCase() + imageType.slice(1).replace(/([A-Z])/g, ' $1');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading pending images...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !pendingImages.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md mx-4 text-center"
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Dashboard</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchPendingImages()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl"
            >
              Try Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBack}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl"
            >
              Go Back
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (viewMode === 'review' && selectedImage) {
    return (
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="px-4 md:px-8 pt-4 md:pt-8 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToGrid}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5 md:w-7 md:h-7" />
              </motion.button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">Review Image</h1>
                <p className="text-gray-400 text-sm">
                  Car: {selectedImage.carNumber} | Type: {getImageTypeLabel(selectedImage.imageType)} | Inspection #{selectedImage.inspectionId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleZoomOut}
                className="w-10 h-10 bg-white/10 backdrop-blur-lg rounded-lg flex items-center justify-center text-white hover:bg-white/20"
              >
                <ZoomOut className="w-5 h-5" />
              </motion.button>
              <span className="text-white text-sm font-semibold px-2">{(zoom * 100).toFixed(0)}%</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleZoomIn}
                className="w-10 h-10 bg-white/10 backdrop-blur-lg rounded-lg flex items-center justify-center text-white hover:bg-white/20"
              >
                <ZoomIn className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleResetZoom}
                className="px-3 py-2 bg-white/10 backdrop-blur-lg rounded-lg text-white text-sm hover:bg-white/20"
              >
                Reset
              </motion.button>
            </div>
          </div>
        </div>

        {/* Main Content - Image Layout with Right Sidebar */}
        <div className="px-4 md:px-8 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* Left: Images Grid (3 columns) */}
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Previous Day Photo */}
                <ImageWithComment
                  label="Previous Day"
                  imageBlobUrl={previousImageBlobUrl}
                  comment={null}
                  editable={false}
                  loading={loadingPrevious}
                  isActive={activeImageType === 'previous'}
                  onClick={() => setActiveImageType('previous')}
                  onCommentChange={() => {}}
                />

                {/* AI Model 1 */}
                <ImageWithComment
                  label="AI Model 1"
                  imageBlobUrl={aiProcessedImageBlobUrls[0] || null}
                  comment={comments.ai1 || ''}
                  editable={true}
                  replaceable={true}
                  loading={selectedImage.aiProcessingStatus === 'processing' || (uploadingImage === 'ai-model1')}
                  isActive={activeImageType === 'ai1'}
                  onClick={() => setActiveImageType('ai1')}
                  onCommentChange={(text: string) => setComments(prev => ({ ...prev, ai1: text }))}
                  onReplace={() => handleReplaceAIImage('model1')}
                  showProcessing={selectedImage.aiProcessingStatus === 'processing'}
                />

                {/* AI Model 2 */}
                <ImageWithComment
                  label="AI Model 2"
                  imageBlobUrl={aiProcessedImageBlobUrls[1] || null}
                  comment={comments.ai2 || ''}
                  editable={true}
                  replaceable={true}
                  loading={selectedImage.aiProcessingStatus === 'processing' || (uploadingImage === 'ai-model2')}
                  isActive={activeImageType === 'ai2'}
                  onClick={() => setActiveImageType('ai2')}
                  onCommentChange={(text: string) => setComments(prev => ({ ...prev, ai2: text }))}
                  onReplace={() => handleReplaceAIImage('model2')}
                  showProcessing={selectedImage.aiProcessingStatus === 'processing'}
                />

                {/* Increment Image */}
                <ImageWithComment
                  label="Increment"
                  imageBlobUrl={incrementImageBlobUrl}
                  comment={comments.increment || ''}
                  editable={true}
                  replaceable={!!incrementImageBlobUrl}
                  showAddButton={!incrementImageBlobUrl}
                  loading={uploadingImage === 'increment'}
                  isActive={activeImageType === 'increment'}
                  onClick={() => setActiveImageType('increment')}
                  onCommentChange={(text: string) => setComments(prev => ({ ...prev, increment: text }))}
                  onReplace={() => handleUploadIncrementImage()}
                  onAdd={() => handleUploadIncrementImage()}
                />
              </div>
            </div>

            {/* Right: Drawing Tools Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Drawing Tools */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Drawing Tools</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentTool(currentTool === 'rectangle' ? 'none' : 'rectangle')}
                      className={`p-2 rounded-lg flex items-center justify-center gap-2 ${
                        currentTool === 'rectangle' ? 'bg-blue-500/30 border-2 border-blue-500' : 'bg-white/10 border border-white/20'
                      } text-white`}
                    >
                      <Square className="w-4 h-4" />
                      <span className="text-xs">Rect</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentTool(currentTool === 'circle' ? 'none' : 'circle')}
                      className={`p-2 rounded-lg flex items-center justify-center gap-2 ${
                        currentTool === 'circle' ? 'bg-blue-500/30 border-2 border-blue-500' : 'bg-white/10 border border-white/20'
                      } text-white`}
                    >
                      <Circle className="w-4 h-4" />
                      <span className="text-xs">Circle</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentTool(currentTool === 'arrow' ? 'none' : 'arrow')}
                      className={`p-2 rounded-lg flex items-center justify-center gap-2 ${
                        currentTool === 'arrow' ? 'bg-blue-500/30 border-2 border-blue-500' : 'bg-white/10 border border-white/20'
                      } text-white`}
                    >
                      <ArrowIcon className="w-4 h-4" />
                      <span className="text-xs">Arrow</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentTool(currentTool === 'text' ? 'none' : 'text')}
                      className={`p-2 rounded-lg flex items-center justify-center gap-2 ${
                        currentTool === 'text' ? 'bg-blue-500/30 border-2 border-blue-500' : 'bg-white/10 border border-white/20'
                      } text-white`}
                    >
                      <Type className="w-4 h-4" />
                      <span className="text-xs">Text</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setDrawings([]);
                        setCurrentTool('none');
                        setSelectedDrawingId(null);
                      }}
                      className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center gap-2 col-span-2"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-xs">Clear All</span>
                    </motion.button>
                  </div>

                  {/* Line Width Control */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Line Width: {lineWidth}px</p>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={lineWidth}
                      onChange={(e) => setLineWidth(Number(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(lineWidth - 1) * 11.11}%, rgba(255,255,255,0.1) ${(lineWidth - 1) * 11.11}%, rgba(255,255,255,0.1) 100%)`
                      }}
                    />
                    <div className="flex justify-between text-gray-500 text-xs mt-1">
                      <span>1</span>
                      <span>10</span>
                    </div>
                  </div>

                  {/* Font Size Control (for text) */}
                  {currentTool === 'text' && (
                    <div>
                      <p className="text-gray-400 text-xs mb-2">Font Size: {fontSize}px</p>
                      <input
                        type="range"
                        min="12"
                        max="48"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((fontSize - 12) / 36) * 100}%, rgba(255,255,255,0.1) ${((fontSize - 12) / 36) * 100}%, rgba(255,255,255,0.1) 100%)`
                        }}
                      />
                      <div className="flex justify-between text-gray-500 text-xs mt-1">
                        <span>12</span>
                        <span>48</span>
                      </div>
                    </div>
                  )}

                  {/* Color Picker */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Color</p>
                    <div className="grid grid-cols-6 gap-2">
                      {colors.map(color => (
                        <motion.button
                          key={color}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setDrawingColor(color);
                            if (selectedDrawingId) {
                              setDrawings(prev => prev.map(d => 
                                d.id === selectedDrawingId ? { ...d, color } : d
                              ));
                            }
                          }}
                          className={`w-8 h-8 rounded border-2 ${
                            drawingColor === color ? 'border-white' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Export Button */}
                  {drawings.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDownloadDrawnImage}
                      disabled={!imageLoaded}
                      className="w-full bg-green-500/20 border border-green-500/30 text-green-300 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Export Image
                    </motion.button>
                  )}

                  {/* Selected Drawing Controls */}
                  {selectedDrawingId && (
                    <div className="pt-2 border-t border-white/20">
                      <p className="text-gray-400 text-xs mb-2">Selected Drawing</p>
                      <div className="space-y-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
                            setSelectedDrawingId(null);
                          }}
                          className="w-full bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-2 px-3 rounded-lg text-xs"
                        >
                          Delete Selected
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Comments Button */}
          <div className="flex justify-end mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveComments}
              disabled={savingComments}
              className="px-6 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {savingComments ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Comments
                </>
              )}
            </motion.button>
          </div>

          {/* Active Image with Canvas for Drawing (Full Width) */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {activeImageType === 'original' ? 'Today Original Image' : 
               activeImageType === 'previous' ? 'Previous Day Image' :
               activeImageType === 'ai1' ? 'AI Model 1 Image' :
               activeImageType === 'ai2' ? 'AI Model 2 Image' :
               'Increment Image'} (Drawing Canvas)
            </h3>
            <div className="relative overflow-hidden rounded-lg bg-black flex items-center justify-center" ref={containerRef} style={{ minHeight: '500px', maxHeight: '70vh' }}>
              {activeImageBlobUrl && (
                <img
                  ref={imageRef}
                  src={activeImageBlobUrl}
                  alt={activeImageType === 'original' ? 'Original' : activeImageType}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className="hidden"
                />
              )}
              {!activeImageBlobUrl && !imageLoadError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-300 text-lg font-semibold mb-1">Loading Image</p>
                    <p className="text-gray-500 text-sm">Please wait...</p>
                  </div>
                </div>
              )}
              {imageLoadError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-900/20 to-black text-white p-4">
                  <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <p className="text-red-400 font-bold text-xl mb-2">Failed to Load Image</p>
                    <p className="text-gray-400 text-sm">Image ID: {selectedImage.id}</p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (selectedImage) {
                          handleImageClick(selectedImage);
                        }
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      Retry
                    </motion.button>
                  </div>
                </div>
              )}
              {!imageLoaded && !imageLoadError && activeImageBlobUrl && imageRef.current && !(imageRef.current.complete && imageRef.current.naturalWidth > 0 && imageRef.current.naturalHeight > 0) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-300 text-base">Preparing canvas...</p>
                  </div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={(e) => {
                  handleCanvasMouseMove(e);
                  // Update cursor based on hover
                  if (currentTool === 'none' && canvasRef.current && imageRef.current) {
                    const canvas = canvasRef.current;
                    const img = imageRef.current;
                    const rect = canvas.getBoundingClientRect();
                    
                    const imgAspect = img.naturalWidth / img.naturalHeight;
                    const canvasAspect = rect.width / rect.height;
                    let drawWidth = rect.width;
                    let drawHeight = rect.height;
                    let drawX = 0;
                    let drawY = 0;

                    if (imgAspect > canvasAspect) {
                      drawHeight = rect.width / imgAspect;
                      drawY = (rect.height - drawHeight) / 2;
                    } else {
                      drawWidth = rect.height * imgAspect;
                      drawX = (rect.width - drawWidth) / 2;
                    }

                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const x = ((mouseX - drawX - imageOffset.x) / zoom) * (img.naturalWidth / drawWidth);
                    const y = ((mouseY - drawY - imageOffset.y) / zoom) * (img.naturalHeight / drawHeight);
                    
                    const hoveredDrawing = getDrawingAtPoint(x, y);
                    canvas.style.cursor = hoveredDrawing ? 'move' : 'grab';
                  } else {
                    if (canvasRef.current) {
                      canvasRef.current.style.cursor = currentTool === 'none' ? 'grab' : currentTool === 'text' ? 'text' : 'crosshair';
                    }
                  }
                }}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="w-full h-full"
                style={{ maxHeight: '70vh', objectFit: 'contain', cursor: currentTool === 'none' ? 'grab' : currentTool === 'text' ? 'text' : 'crosshair' }}
              />
              {/* Text Input Dialog */}
              {textInputPosition && canvasRef.current && imageRef.current && (
                <div 
                  className="text-input-dialog absolute bg-white/95 backdrop-blur-lg rounded-lg p-3 shadow-xl z-[100] border-2 border-blue-500"
                  style={{
                    left: `${(() => {
                      const canvas = canvasRef.current!;
                      const img = imageRef.current!;
                      const rect = canvas.getBoundingClientRect();
                      const imgAspect = img.naturalWidth / img.naturalHeight;
                      const canvasAspect = rect.width / rect.height;
                      let drawWidth = rect.width;
                      let drawHeight = rect.height;
                      let drawX = 0;
                      if (imgAspect > canvasAspect) {
                        drawHeight = rect.width / imgAspect;
                      } else {
                        drawWidth = rect.height * imgAspect;
                        drawX = (rect.width - drawWidth) / 2;
                      }
                      // Convert image coordinates to canvas coordinates
                      const canvasX = drawX + (textInputPosition.x / img.naturalWidth) * (drawWidth / zoom) + imageOffset.x;
                      return Math.min(Math.max(canvasX, 10), rect.width - 220); // Keep within bounds
                    })()}px`,
                    top: `${(() => {
                      const canvas = canvasRef.current!;
                      const img = imageRef.current!;
                      const rect = canvas.getBoundingClientRect();
                      const imgAspect = img.naturalWidth / img.naturalHeight;
                      const canvasAspect = rect.width / rect.height;
                      let drawWidth = rect.width;
                      let drawHeight = rect.height;
                      let drawY = 0;
                      if (imgAspect > canvasAspect) {
                        drawHeight = rect.width / imgAspect;
                        drawY = (rect.height - drawHeight) / 2;
                      } else {
                        drawWidth = rect.height * imgAspect;
                      }
                      // Convert image coordinates to canvas coordinates
                      const canvasY = drawY + (textInputPosition.y / img.naturalHeight) * (drawHeight / zoom) + imageOffset.y - 40;
                      return Math.min(Math.max(canvasY, 10), rect.height - 80); // Keep within bounds
                    })()}px`,
                    pointerEvents: 'auto'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Type className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700">Add Text</span>
                  </div>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => {
                      e.stopPropagation();
                      setTextInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleTextInputConfirm();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setTextInputPosition(null);
                        setTextInput('');
                        setCurrentTool('none');
                      }
                    }}
                    onBlur={(e) => {
                      // Only blur if the new focus target is not within our dialog
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (relatedTarget && relatedTarget.closest('.text-input-dialog')) {
                        // Focus is moving within the dialog, don't blur
                        return;
                      }
                      // Small delay to allow Enter key to process first
                      setTimeout(() => {
                        // Double check that we're still supposed to blur (user might have clicked back)
                        if (document.activeElement === textInputRef.current) {
                          return; // User clicked back into input, don't close
                        }
                        if (textInput.trim()) {
                          handleTextInputConfirm();
                        } else {
                          setTextInputPosition(null);
                          setTextInput('');
                        }
                        setCurrentTool('none');
                        isTextInputActiveRef.current = false;
                      }, 200);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                      isTextInputActiveRef.current = true;
                    }}
                    autoFocus
                    ref={textInputRef}
                    className="px-3 py-2 border-2 border-blue-300 rounded-lg text-black text-sm w-52 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Type your text here..."
                  />
                  <p className="text-xs text-gray-500 mt-2">Press Enter to confirm, Esc to cancel</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Processing Status */}
          {selectedImage.aiProcessingStatus === 'processing' && (
            <div className="bg-blue-500/20 border border-blue-500/30 backdrop-blur-lg rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <Loader className="w-5 h-5 text-blue-400 animate-spin" />
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">AI Processing in Progress</h4>
                  <p className="text-blue-200 text-sm">
                    AI models are processing this image. Results will appear when complete.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedImage.aiProcessed === false && selectedImage.aiProcessingStatus !== 'processing' && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 backdrop-blur-lg rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="text-yellow-400 font-semibold mb-1">AI Processing Incomplete</h4>
                  <p className="text-yellow-200 text-sm">
                    AI processing failed or is incomplete. Please review the original image manually.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedImage.claimStatus === 'error' && (
            <div className="bg-red-500/20 border border-red-500/30 backdrop-blur-lg rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <h4 className="text-red-400 font-semibold mb-1">AI Processing Error</h4>
                  <p className="text-red-200 text-sm">
                    An error occurred during AI processing. Please review the original image manually.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Actions */}
          <div className="space-y-2 mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveAnnotations}
              disabled={savingAnnotations}
              className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingAnnotations ? 'Saving...' : 'Save Annotations'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApprove}
              disabled={approving}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              {approving ? 'Approving...' : 'Approve Image'}
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="px-4 md:px-8 pt-4 md:pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5 md:w-7 md:h-7" />
            </motion.button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-white">Inspector Dashboard</h1>
              <p className="text-gray-400 text-sm md:text-base">Manual image approval workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchPendingImages()}
              className="px-4 py-2 bg-white/10 backdrop-blur-lg rounded-lg text-white hover:bg-white/20 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </motion.button>
            <div className="text-left md:text-right">
              <p className="text-white font-semibold text-base md:text-lg">{pendingImages.length} Pending</p>
              <p className="text-gray-400 text-xs md:text-sm">Images queued</p>
            </div>
          </div>
        </div>
      </div>

      {/* Images Grid */}
      <div className="px-4 md:px-8 pb-8">
        {pendingImages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl md:rounded-3xl p-8 md:p-12 text-center"
          >
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-gray-400" />
            </div>
            <h3 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-4">No Pending Images</h3>
            <p className="text-gray-400 text-sm md:text-lg mb-4">All images have been reviewed.</p>
            {error && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-semibold mb-2">Error:</p>
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}
            <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg text-left">
              <p className="text-blue-400 text-xs font-semibold mb-2">Debug Info:</p>
              <pre className="text-blue-300 text-xs overflow-auto">
                {JSON.stringify({
                  loading,
                  error,
                  pendingImagesCount: pendingImages.length,
                  currentState: {
                    loading,
                    hasError: !!error,
                    imagesCount: pendingImages.length
                  }
                }, null, 2)}
              </pre>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            <AnimatePresence>
              {pendingImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 hover:border-white/30 cursor-pointer transition-all duration-200"
                  onClick={() => handleImageClick(image)}
                >
                  <div className="relative aspect-video bg-black rounded-lg mb-3 overflow-hidden">
                    <ImageThumbnail image={image} />
                    <div className="absolute top-2 right-2 bg-yellow-500/90 text-black text-xs font-bold px-2 py-1 rounded">
                      #{image.processingOrder}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold text-sm">{image.carNumber}</p>
                      <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs rounded">
                        <Clock className="w-3 h-3 inline mr-1" />
                        PENDING
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">{getImageTypeLabel(image.imageType)}</p>
                    <p className="text-gray-500 text-xs">Inspection #{image.inspectionId}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

// Separate component for image thumbnails to handle blob fetching with authentication
const ImageThumbnail: React.FC<{ image: InspectionImage }> = ({ image }) => {
  const [thumbnailBlobUrl, setThumbnailBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch thumbnail as blob
    const loadThumbnail = async () => {
      try {
        const blobUrl = await fetchImageAsBlob(image);
        setThumbnailBlobUrl(blobUrl);
      } catch (err) {
        console.error('[ManualInspection] Failed to load thumbnail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadThumbnail();

    // Cleanup
    return () => {
      if (thumbnailBlobUrl) {
        URL.revokeObjectURL(thumbnailBlobUrl);
      }
    };
  }, [image.id]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (thumbnailBlobUrl) {
    return (
      <img
        src={thumbnailBlobUrl}
        alt={image.imageType}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-gray-400">
      <ImageIcon className="w-8 h-8" />
    </div>
  );
};

// AI Damage Data Editor Component
interface AIDamageDataEditorProps {
  image: InspectionImage;
  onUpdate: (updatedImage: InspectionImage) => void;
}

const AIDamageDataEditor: React.FC<AIDamageDataEditorProps> = ({ image, onUpdate }) => {
  const [editingModelId, setEditingModelId] = useState<number | null>(null);
  const [editingConfidence, setEditingConfidence] = useState<string>('');
  const [editingLabel, setEditingLabel] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleEdit = (damage: any) => {
    setEditingModelId(damage.id);
    setEditingConfidence(damage.confidence.toString());
    setEditingLabel(damage.label);
  };

  const handleSave = async (damageId: number) => {
    setSaving(true);
    try {
      const confidence = parseFloat(editingConfidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 100) {
        alert('Confidence must be between 0 and 100');
        return;
      }

      const response = await updateAIDamageData(damageId, {
        confidence,
        label: editingLabel.trim()
      });

      if (response.success) {
        // Update the image with new data
        const updatedImage = {
          ...image,
          aiDamageData: image.aiDamageData?.map(d => 
            d.id === damageId 
              ? { ...d, confidence: response.data.confidence, label: response.data.label, confidencePercentage: `${response.data.confidence.toFixed(2)}%` }
              : d
          ),
          // Update main damage data if this is the best model
          damageConfidence: image.aiDamageData?.find(d => d.id === damageId)?.modelNumber === 1 
            ? response.data.confidence 
            : image.damageConfidence,
          damageConfidencePercentage: image.aiDamageData?.find(d => d.id === damageId)?.modelNumber === 1
            ? `${response.data.confidence.toFixed(2)}%`
            : image.damageConfidencePercentage,
          damageLabel: image.aiDamageData?.find(d => d.id === damageId)?.modelNumber === 1
            ? response.data.label
            : image.damageLabel
        };
        onUpdate(updatedImage);
        setEditingModelId(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update AI damage data');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingModelId(null);
    setEditingConfidence('');
    setEditingLabel('');
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
      <h3 className="text-white font-semibold mb-3">AI Damage Analysis</h3>
      <div className="space-y-3">
        {/* Main Damage Info */}
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Confidence</p>
          <p className="text-blue-400 text-2xl font-bold">
            {image.damageConfidencePercentage || `${image.damageConfidence?.toFixed(2)}%`}
          </p>
          <p className="text-gray-400 text-xs mt-2 mb-1">Label</p>
          <p className="text-white text-lg font-semibold">
            {image.damageLabel || 'Unknown'}
          </p>
        </div>

        {/* Detailed Damage Data by Model */}
        {image.aiDamageData && image.aiDamageData.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 text-xs">Model Details:</p>
            {image.aiDamageData.map((damage, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-2">
                {editingModelId === damage.id ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Confidence (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={editingConfidence}
                        onChange={(e) => setEditingConfidence(e.target.value)}
                        className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Label</label>
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSave(damage.id)}
                        disabled={saving}
                        className="flex-1 bg-blue-500/30 border border-blue-500/50 text-blue-300 text-xs py-1 px-2 rounded disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCancel}
                        disabled={saving}
                        className="flex-1 bg-gray-500/30 border border-gray-500/50 text-gray-300 text-xs py-1 px-2 rounded disabled:opacity-50"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-semibold">
                        Model {damage.modelNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 text-sm font-semibold">
                          {damage.confidencePercentage}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleEdit(damage)}
                          className="text-gray-400 hover:text-white text-xs"
                        >
                          <Save className="w-3 h-3" />
                        </motion.button>
                      </div>
                    </div>
                    <p className="text-gray-300 text-xs">{damage.label}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualInspectionDashboard;


