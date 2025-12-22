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
  Download,
  Lock,
  Search,
  SortAsc,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye
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
  updateImageComments,
  checkDashboardAccess,
  lockImage,
  unlockImage,
  getLockStatus,
  sendLockHeartbeat,
  PaginationInfo,
  bulkApproveImages,
  bulkRemoveImages,
  bulkApproveFiltered,
  bulkRemoveFiltered
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
type DrawingTool = 'brush' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'none';

interface Drawing {
  id: string;
  type: 'brush' | 'rectangle' | 'circle' | 'arrow' | 'text';
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
  points?: Array<{ x: number; y: number }>; // For brush/freehand drawing
}

const ManualInspectionDashboard: React.FC<ManualInspectionDashboardProps> = ({ onBack }) => {
  // Access control
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  
  // Image list state
  const [pendingImages, setPendingImages] = useState<InspectionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  
  // Bulk operations state
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; message?: string } | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showInspectionDropdown, setShowInspectionDropdown] = useState(false);
  const [bulkFilters, setBulkFilters] = useState<{
    clientName: string;
    inspectionIds: number[];
    olderThanDays: string;
  }>({
    clientName: '',
    inspectionIds: [],
    olderThanDays: ''
  });
  
  // Get unique inspection IDs from pending images
  const uniqueInspectionIds = React.useMemo(() => {
    const ids = new Set(pendingImages.map(img => img.inspectionId));
    return Array.from(ids).sort((a, b) => a - b);
  }, [pendingImages]);
  
  // Sorting and filtering
  const [sortBy, setSortBy] = useState<'createdAt' | 'carNumber' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Image locking
  const [lockedImageId, setLockedImageId] = useState<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lockStatusPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImage, setSelectedImage] = useState<InspectionImage | null>(null);
  const [previousDayImage, setPreviousDayImage] = useState<InspectionImage | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('none');
  const [drawingColor, setDrawingColor] = useState('#FF0000');
  const [lineWidth] = useState(2.5); // Fixed line width
  const [fontSize, setFontSize] = useState(16);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBrushPath, setCurrentBrushPath] = useState<Array<{ x: number; y: number }>>([]);
  const [textInput, setTextInput] = useState<string>('');
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const textInputRef = useRef<HTMLSelectElement | null>(null);
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
  // Dropdown values for original image comments (based on image position 1-14)
  const [originalImageDropdowns, setOriginalImageDropdowns] = useState<{
    logo?: 'Yes' | 'No';
    damageDetection?: 'No damage' | 'Damage' | 'Dent' | 'Scratch';
    frontFloor?: 'Clean' | 'Dirty';
    tissue?: 'Yes' | 'No';
    rearFloor?: 'Clean' | 'Dirty';
    bottle?: 'Yes' | 'No';
  }>({});
  // Track if AI images have been replaced
  const [aiImagesReplaced, setAiImagesReplaced] = useState<{ model1: boolean; model2: boolean }>({ model1: false, model2: false });
  const [activeImageType, setActiveImageType] = useState<'original' | 'previous' | 'ai1' | 'ai2' | 'increment'>('original');
  const [activeImageBlobUrl, setActiveImageBlobUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const colors = ['#FF0000', '#00FF00']; // Only red and green

  // Helper function to determine which dropdowns to show based on image position (processingOrder 1-14)
  const getDropdownOptionsForImage = (processingOrder: number) => {
    if (processingOrder >= 1 && processingOrder <= 10) {
      // Images 1-10: Logo and Damage Detection
      return {
        showLogo: true,
        showDamageDetection: true,
        showFrontFloor: false,
        showTissue: false,
        showRearFloor: false,
        showBottle: false
      };
    } else if (processingOrder === 11) {
      // Image 11: Front Floor
      return {
        showLogo: false,
        showDamageDetection: false,
        showFrontFloor: true,
        showTissue: false,
        showRearFloor: false,
        showBottle: false
      };
    } else if (processingOrder === 12) {
      // Image 12: Tissue
      return {
        showLogo: false,
        showDamageDetection: false,
        showFrontFloor: false,
        showTissue: true,
        showRearFloor: false,
        showBottle: false
      };
    } else if (processingOrder === 13) {
      // Image 13: Rear Floor
      return {
        showLogo: false,
        showDamageDetection: false,
        showFrontFloor: false,
        showTissue: false,
        showRearFloor: true,
        showBottle: false
      };
    } else if (processingOrder === 14) {
      // Image 14: Bottle
      return {
        showLogo: false,
        showDamageDetection: false,
        showFrontFloor: false,
        showTissue: false,
        showRearFloor: false,
        showBottle: true
      };
    }
    // Default: no dropdowns
    return {
      showLogo: false,
      showDamageDetection: false,
      showFrontFloor: false,
      showTissue: false,
      showRearFloor: false,
      showBottle: false
    };
  };

  // Format AI image comment from dropdown values
  const formatAIComment = (dropdowns: typeof originalImageDropdowns): string => {
    const parts: string[] = [];
    
    // Always include Damage Detection if available
    if (dropdowns.damageDetection) {
      parts.push(`Damage Detection: ${dropdowns.damageDetection}`);
    }
    // Always include Logo if available (including "No")
    if (dropdowns.logo) {
      parts.push(`Logo: ${dropdowns.logo}`);
    }
    // For other fields (Front Floor, Tissue, Rear Floor, Bottle), include if set
    if (dropdowns.frontFloor) {
      parts.push(`Front Floor: ${dropdowns.frontFloor}`);
    }
    if (dropdowns.tissue) {
      parts.push(`Tissue: ${dropdowns.tissue}`);
    }
    if (dropdowns.rearFloor) {
      parts.push(`Rear Floor: ${dropdowns.rearFloor}`);
    }
    if (dropdowns.bottle) {
      parts.push(`Bottle: ${dropdowns.bottle}`);
    }
    
    return parts.join('\n');
  };

  // Auto-clear success messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Close inspection dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.inspection-dropdown-container')) {
        setShowInspectionDropdown(false);
      }
    };

    if (showInspectionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInspectionDropdown]);

  // Check access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        setAccessLoading(true);
        const response = await checkDashboardAccess();
        if (response.hasAccess) {
          setHasAccess(true);
    fetchPendingImages();
    
    // Poll every 30 seconds for new images
    pollingIntervalRef.current = setInterval(() => {
      fetchPendingImages(true);
    }, 30000);
          
          // Lock status polling will be set up after first fetch
        } else {
          setHasAccess(false);
        }
      } catch (err: any) {
        console.error('[ManualInspection] Access check failed:', err);
        if (err.response?.status === 403) {
          setHasAccess(false);
        } else {
          setError('Failed to check access. Please try again.');
        }
      } finally {
        setAccessLoading(false);
      }
    };
    
    checkAccess();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (lockStatusPollingRef.current) {
        clearInterval(lockStatusPollingRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // Unlock image if still locked
      if (lockedImageId) {
        unlockImage(lockedImageId).catch(console.error);
      }
    };
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch images when filters/sort/page change
  useEffect(() => {
    if (hasAccess) {
      fetchPendingImages();
    }
  }, [sortBy, sortOrder, statusFilter, debouncedSearch, currentPage, pageSize]);

  const fetchPendingImages = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');
      const params: any = {
        sortBy,
        sortOrder,
        page: currentPage,
        limit: pageSize
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      
      const response = await getPendingImages(params);
      console.log('[ManualInspection] API Response:', {
        success: response.success,
        count: response.count,
        imagesLength: response.images?.length || 0,
        pagination: response.pagination,
        fullResponse: response
      });
      if (response.success) {
        setPendingImages(response.images);
        if (response.pagination) {
          setPagination(response.pagination);
        }
        // Set up lock status polling if not already set
        if (!lockStatusPollingRef.current && response.images.length > 0) {
          lockStatusPollingRef.current = setInterval(() => {
            fetchPendingImages(true);
          }, 10000);
        }
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
    // Check if image is locked by another user
    if (image.lockInfo?.isLocked && !image.lockInfo?.isCurrentUser) {
      setError(`This image is being inspected by another user. Please try again later.`);
      return;
    }
    
    try {
      // Lock the image
      const lockResponse = await lockImage(image.id);
      if (lockResponse.success) {
        const currentImageId = image.id;
        setLockedImageId(currentImageId);
        // Start heartbeat interval (every 25 seconds)
        heartbeatIntervalRef.current = setInterval(() => {
          sendLockHeartbeat(currentImageId).catch(err => {
            console.error('[ManualInspection] Heartbeat failed:', err);
          });
        }, 25000);
      } else {
        setError('Failed to lock image. It may be locked by another user.');
        return;
      }
    } catch (err: any) {
      console.error('[ManualInspection] Failed to lock image:', err);
      if (err.response?.status === 409) {
        setError('This image is being inspected by another user. Please try again later.');
      } else {
        setError('Failed to lock image. Please try again.');
      }
      return;
    }
    
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
    
    // Initialize dropdown values with defaults based on image position
    const dropdownOptions = getDropdownOptionsForImage(image.processingOrder);
    const initialDropdowns: typeof originalImageDropdowns = {};
    if (dropdownOptions.showLogo) {
      initialDropdowns.logo = 'No'; // Default
    }
    if (dropdownOptions.showDamageDetection) {
      initialDropdowns.damageDetection = 'No damage'; // Default
    }
    if (dropdownOptions.showFrontFloor) {
      initialDropdowns.frontFloor = 'Dirty'; // Default
    }
    if (dropdownOptions.showTissue) {
      initialDropdowns.tissue = 'No'; // Default
    }
    if (dropdownOptions.showRearFloor) {
      initialDropdowns.rearFloor = 'Dirty'; // Default
    }
    if (dropdownOptions.showBottle) {
      initialDropdowns.bottle = 'No'; // Default
    }
    setOriginalImageDropdowns(initialDropdowns);
    
    // Track if AI images have been replaced (check if they exist and are different from original)
    // For now, assume they haven't been replaced if they exist (we'll track this when user replaces them)
    setAiImagesReplaced({ model1: false, model2: false });

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

    // Always use original image for editing canvas
    setActiveImageType('original');
    // Set active image blob URL immediately if we have it
    if (mainBlobUrl) {
      setActiveImageBlobUrl(mainBlobUrl);
      setImageBlobUrl(mainBlobUrl);
    }
  };

  // Always keep canvas showing original image
  useEffect(() => {
    if (!selectedImage) return;

    // Canvas always shows original image
    setActiveImageType('original');
    setActiveImageBlobUrl(imageBlobUrl);
    if (imageBlobUrl) {
      setImageLoaded(false);
      setImageLoadError(false);
    }
  }, [imageBlobUrl, selectedImage]);

  const handleBackToGrid = async () => {
    // Unlock image if locked
    if (lockedImageId) {
      try {
        await unlockImage(lockedImageId);
      } catch (err) {
        console.error('[ManualInspection] Failed to unlock image:', err);
      }
      setLockedImageId(null);
    }
    
    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
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

  // Bulk operation handlers
  const toggleImageSelection = (imageId: number) => {
    setSelectedImageIds(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImageIds(pendingImages.map(img => img.id));
  };

  const deselectAllImages = () => {
    setSelectedImageIds([]);
  };

  const handleBulkApprove = async () => {
    if (selectedImageIds.length === 0) return;
    
    setBulkLoading(true);
    setBulkResult(null);
    setError('');
    
    try {
      const response = await bulkApproveImages({ imageIds: selectedImageIds });
      setBulkResult({
        success: response.successCount,
        failed: response.failedCount,
        message: response.message
      });
      
      if (response.successCount > 0) {
        setSuccessMessage(`Successfully approved ${response.successCount} image(s)`);
        setSelectedImageIds([]);
        // Refresh the image list
        await fetchPendingImages();
      }
      
      if (response.failedCount > 0) {
        setError(`Failed to approve ${response.failedCount} image(s). Check console for details.`);
        console.error('Failed images:', response.failedList);
      }
    } catch (err: any) {
      console.error('[ManualInspection] Bulk approve failed:', err);
      setError(err.response?.data?.message || 'Failed to approve images. Please try again.');
      setBulkResult({ success: 0, failed: selectedImageIds.length });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedImageIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to remove ${selectedImageIds.length} image(s) from the queue?`)) {
      return;
    }
    
    setBulkLoading(true);
    setBulkResult(null);
    setError('');
    
    try {
      const response = await bulkRemoveImages({ imageIds: selectedImageIds });
      setBulkResult({
        success: response.successCount,
        failed: response.failedCount,
        message: response.message
      });
      
      if (response.successCount > 0) {
        setSuccessMessage(`Successfully removed ${response.successCount} image(s) from queue`);
        setSelectedImageIds([]);
        // Refresh the image list
        await fetchPendingImages();
      }
      
      if (response.failedCount > 0) {
        setError(`Failed to remove ${response.failedCount} image(s). Check console for details.`);
        console.error('Failed images:', response.failedList);
      }
    } catch (err: any) {
      console.error('[ManualInspection] Bulk remove failed:', err);
      setError(err.response?.data?.message || 'Failed to remove images. Please try again.');
      setBulkResult({ success: 0, failed: selectedImageIds.length });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFilterApprove = async () => {
    const hasClientName = bulkFilters.clientName;
    const hasInspectionIds = bulkFilters.inspectionIds.length > 0;
    const hasOlderThanDays = bulkFilters.olderThanDays;
    
    if (!hasClientName && !hasInspectionIds && !hasOlderThanDays) {
      setError('Please select at least one filter');
      return;
    }
    
    const inspectionCount = bulkFilters.inspectionIds.length;
    const confirmMessage = inspectionCount > 0
      ? `Approve all images matching these filters? (${inspectionCount} inspection${inspectionCount > 1 ? 's' : ''} selected)`
      : `Approve all images matching these filters?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setBulkLoading(true);
    setBulkResult(null);
    setError('');
    
    try {
      let totalSuccess = 0;
      let totalFailed = 0;
      const allFailedList: Array<{ imageId: number; error: string }> = [];
      
      // If multiple inspection IDs are selected, make separate calls for each
      if (hasInspectionIds && bulkFilters.inspectionIds.length > 0) {
        const promises = bulkFilters.inspectionIds.map(async (inspectionId) => {
          const activeFilters: any = {};
          if (hasClientName) activeFilters.clientName = bulkFilters.clientName;
          activeFilters.inspectionId = inspectionId;
          if (hasOlderThanDays) activeFilters.olderThanDays = parseInt(bulkFilters.olderThanDays);
          
          try {
            const response = await bulkApproveFiltered({ filters: activeFilters });
            totalSuccess += response.successCount;
            totalFailed += response.failedCount;
            if (response.failedList) {
              allFailedList.push(...response.failedList);
            }
            return response;
          } catch (err: any) {
            console.error(`[ManualInspection] Filter approve failed for inspection ${inspectionId}:`, err);
            totalFailed += 1;
            return null;
          }
        });
        
        await Promise.all(promises);
      } else {
        // Single call without inspection ID filter
        const activeFilters: any = {};
        if (hasClientName) activeFilters.clientName = bulkFilters.clientName;
        if (hasOlderThanDays) activeFilters.olderThanDays = parseInt(bulkFilters.olderThanDays);
        
        const response = await bulkApproveFiltered({ filters: activeFilters });
        totalSuccess = response.successCount;
        totalFailed = response.failedCount;
        if (response.failedList) {
          allFailedList.push(...response.failedList);
        }
      }
      
      setBulkResult({
        success: totalSuccess,
        failed: totalFailed,
        message: `Processed ${totalSuccess + totalFailed} images`
      });
      
      if (totalSuccess > 0) {
        setSuccessMessage(`Successfully approved ${totalSuccess} image(s) matching filters`);
        // Refresh the image list
        await fetchPendingImages();
      }
      
      if (totalFailed > 0) {
        setError(`Failed to approve ${totalFailed} image(s). Check console for details.`);
        console.error('Failed images:', allFailedList);
      }
    } catch (err: any) {
      console.error('[ManualInspection] Filter approve failed:', err);
      setError(err.response?.data?.message || 'Failed to approve images. Please try again.');
      setBulkResult({ success: 0, failed: 0 });
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleInspectionIdSelection = (inspectionId: number) => {
    setBulkFilters(prev => ({
      ...prev,
      inspectionIds: prev.inspectionIds.includes(inspectionId)
        ? prev.inspectionIds.filter(id => id !== inspectionId)
        : [...prev.inspectionIds, inspectionId]
    }));
  };

  const selectAllInspectionIds = () => {
    setBulkFilters(prev => ({
      ...prev,
      inspectionIds: uniqueInspectionIds
    }));
  };

  const deselectAllInspectionIds = () => {
    setBulkFilters(prev => ({
      ...prev,
      inspectionIds: []
    }));
  };

  const handleFilterRemove = async () => {
    const hasClientName = bulkFilters.clientName;
    const hasInspectionIds = bulkFilters.inspectionIds.length > 0;
    const hasOlderThanDays = bulkFilters.olderThanDays;
    
    if (!hasClientName && !hasInspectionIds && !hasOlderThanDays) {
      setError('Please select at least one filter');
      return;
    }
    
    const inspectionCount = bulkFilters.inspectionIds.length;
    const confirmMessage = inspectionCount > 0
      ? `Remove all images matching these filters from the queue? (${inspectionCount} inspection${inspectionCount > 1 ? 's' : ''} selected)`
      : `Remove all images matching these filters from the queue?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setBulkLoading(true);
    setBulkResult(null);
    setError('');
    
    try {
      let totalSuccess = 0;
      let totalFailed = 0;
      const allFailedList: Array<{ imageId: number; error: string }> = [];
      
      // If multiple inspection IDs are selected, make separate calls for each
      if (hasInspectionIds && bulkFilters.inspectionIds.length > 0) {
        const promises = bulkFilters.inspectionIds.map(async (inspectionId) => {
          const activeFilters: any = {};
          if (hasClientName) activeFilters.clientName = bulkFilters.clientName;
          activeFilters.inspectionId = inspectionId;
          if (hasOlderThanDays) activeFilters.olderThanDays = parseInt(bulkFilters.olderThanDays);
          
          try {
            const response = await bulkRemoveFiltered({ filters: activeFilters });
            totalSuccess += response.successCount;
            totalFailed += response.failedCount;
            if (response.failedList) {
              allFailedList.push(...response.failedList);
            }
            return response;
          } catch (err: any) {
            console.error(`[ManualInspection] Filter remove failed for inspection ${inspectionId}:`, err);
            totalFailed += 1;
            return null;
          }
        });
        
        await Promise.all(promises);
      } else {
        // Single call without inspection ID filter
        const activeFilters: any = {};
        if (hasClientName) activeFilters.clientName = bulkFilters.clientName;
        if (hasOlderThanDays) activeFilters.olderThanDays = parseInt(bulkFilters.olderThanDays);
        
        const response = await bulkRemoveFiltered({ filters: activeFilters });
        totalSuccess = response.successCount;
        totalFailed = response.failedCount;
        if (response.failedList) {
          allFailedList.push(...response.failedList);
        }
      }
      
      setBulkResult({
        success: totalSuccess,
        failed: totalFailed,
        message: `Processed ${totalSuccess + totalFailed} images`
      });
      
      if (totalSuccess > 0) {
        setSuccessMessage(`Successfully removed ${totalSuccess} image(s) from queue`);
        // Refresh the image list
        await fetchPendingImages();
      }
      
      if (totalFailed > 0) {
        setError(`Failed to remove ${totalFailed} image(s). Check console for details.`);
        console.error('Failed images:', allFailedList);
      }
    } catch (err: any) {
      console.error('[ManualInspection] Filter remove failed:', err);
      setError(err.response?.data?.message || 'Failed to remove images. Please try again.');
      setBulkResult({ success: 0, failed: 0 });
    } finally {
      setBulkLoading(false);
    }
  };

  // Precise coordinate conversion helper - FIXED VERSION
  const screenToImageCoords = (
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement,
    img: HTMLImageElement
  ): { x: number; y: number } | null => {
    if (!canvas || !img || img.naturalWidth === 0 || img.naturalHeight === 0) {
      return null;
    }

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

    // Convert screen coordinates to canvas coordinates
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // Account for zoom and offset, then convert to image coordinates
    // Fix: Properly scale coordinates
    const scaleX = img.naturalWidth / drawWidth;
    const scaleY = img.naturalHeight / drawHeight;
    const x = ((canvasX - drawX - imageOffset.x) / zoom) * scaleX;
    const y = ((canvasY - drawY - imageOffset.y) / zoom) * scaleY;

    // Clamp to image bounds
    return {
      x: Math.max(0, Math.min(img.naturalWidth, x)),
      y: Math.max(0, Math.min(img.naturalHeight, y))
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'none' || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const coords = screenToImageCoords(e.clientX, e.clientY, canvas, img);
    
    if (!coords) return;
    const { x, y } = coords;

    if (currentTool === 'text') {
      // For text, show input dialog at exact click position
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      setTextInputPosition({ x, y, canvasX, canvasY });
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

    if (currentTool === 'brush') {
      // Start freehand drawing
      setIsDrawing(true);
      setCurrentBrushPath([{ x, y }]);
      const tempDrawing: Drawing = {
        id: `brush-${Date.now()}-${Math.random()}`,
        type: 'brush',
        x: x,
        y: y,
        color: drawingColor,
        lineWidth,
        points: [{ x, y }]
      };
      setDrawings(prev => [...prev, tempDrawing]);
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
    const coords = screenToImageCoords(e.clientX, e.clientY, canvas, img);
    if (!coords) return;
    const { x, y } = coords;

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
          } else if (d.type === 'brush' && d.points && d.points.length > 0) {
            // Move all points in brush path by the offset
            const dx = newX - d.points[0].x;
            const dy = newY - d.points[0].y;
            return {
              ...d,
              points: d.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          }
        }
        return d;
      }));
      return;
    }

    if (currentTool === 'brush') {
      // Add point to current brush path
      setDrawings(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].type === 'brush' && updated[lastIndex].points) {
          const newPoints = [...updated[lastIndex].points!, { x, y }];
          updated[lastIndex] = {
            ...updated[lastIndex],
            points: newPoints
          };
        }
        return updated;
      });
    } else if (currentTool === 'rectangle') {
      // Calculate rectangle with proper bounds
      const minX = Math.min(drawStart.x, x);
      const minY = Math.min(drawStart.y, y);
      const maxX = Math.max(drawStart.x, x);
      const maxY = Math.max(drawStart.y, y);
      const width = maxX - minX;
      const height = maxY - minY;
      
      const newDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'rectangle',
        x: minX,
        y: minY,
        width: Math.max(width, 1), // Minimum 1px width
        height: Math.max(height, 1), // Minimum 1px height
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
      // Calculate radius from center to current mouse position
      const radius = Math.sqrt(
        Math.pow(x - drawStart.x, 2) + Math.pow(y - drawStart.y, 2)
      );
      const newDrawing: Drawing = {
        id: '', // Temporary, will get id on mouse up
        type: 'circle',
        x: drawStart.x, // Center X
        y: drawStart.y, // Center Y
        radius: Math.max(radius, 1), // Minimum 1px radius
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
      } else if (drawing.type === 'brush' && drawing.points && drawing.points.length > 0) {
        // Check if point is near any point in the brush path (within 5 pixels)
        for (const point of drawing.points) {
          const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
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
        lineWidth: lineWidth // Use default line width (not used for text rendering but needed for type)
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
          // Don't auto-switch tool - let user keep drawing if they want
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
      } else if (clickedDrawing.type === 'brush' && clickedDrawing.points && clickedDrawing.points.length > 0) {
        // For brush, use first point as reference
        setDragOffset({
          x: x - clickedDrawing.points[0].x,
          y: y - clickedDrawing.points[0].y
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

    // Calculate scale factors for converting image natural coordinates to display coordinates
    const scaleX = (drawWidth / zoom) / img.naturalWidth;
    const scaleY = (drawHeight / zoom) / img.naturalHeight;

    // Apply zoom and offset
    ctx.save();
    ctx.translate(drawX + imageOffset.x, drawY + imageOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw image using natural dimensions (scaled to fit display)
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, drawWidth / zoom, drawHeight / zoom);

    // Draw annotations - convert from natural image coordinates to display coordinates
    drawings.forEach(drawing => {
      const isSelected = drawing.id === selectedDrawingId;
      const baseLineWidth = (drawing.lineWidth || 2) / zoom;
      
      // Convert drawing coordinates from natural image space to display space
      const displayX = drawing.x * scaleX;
      const displayY = drawing.y * scaleY;
      const displayWidth = drawing.width ? drawing.width * scaleX : undefined;
      const displayHeight = drawing.height ? drawing.height * scaleY : undefined;
      const displayRadius = drawing.radius ? drawing.radius * Math.min(scaleX, scaleY) : undefined;
      
      // Draw selection border first (behind the drawing)
      if (isSelected) {
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = baseLineWidth + 3;
        ctx.setLineDash([8, 4]);
        
        if (drawing.type === 'rectangle' && displayWidth && displayHeight) {
          ctx.strokeRect(displayX - 3, displayY - 3, displayWidth + 6, displayHeight + 6);
        } else if (drawing.type === 'circle' && displayRadius) {
          ctx.beginPath();
          ctx.arc(displayX, displayY, displayRadius + 3, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
          const displayX1 = drawing.x1 * scaleX;
          const displayY1 = drawing.y1 * scaleY;
          const displayX2 = drawing.x2 * scaleX;
          const displayY2 = drawing.y2 * scaleY;
          ctx.beginPath();
          ctx.moveTo(displayX1, displayY1);
          ctx.lineTo(displayX2, displayY2);
          ctx.stroke();
        } else if (drawing.type === 'brush' && drawing.points && drawing.points.length > 0) {
          // Draw selection border around brush path
          ctx.beginPath();
          const firstPoint = drawing.points[0];
          ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
          for (let i = 1; i < drawing.points.length; i++) {
            ctx.lineTo(drawing.points[i].x * scaleX, drawing.points[i].y * scaleY);
          }
          ctx.stroke();
        } else if (drawing.type === 'text' && drawing.text) {
          // Measure text to draw accurate selection border
          // Use the same font size as when drawing (accounting for zoom)
          ctx.font = `${drawing.fontSize || 16}px Arial`;
          const metrics = ctx.measureText(drawing.text);
          const textWidth = metrics.width;
          const textHeight = (drawing.fontSize || 16) * scaleY;
          // Text y is baseline, so selection box goes from y - textHeight to y
          ctx.strokeRect(
            displayX - 3, 
            displayY - textHeight - 3, 
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

      if (drawing.type === 'rectangle' && displayWidth && displayHeight) {
        ctx.strokeRect(displayX, displayY, displayWidth, displayHeight);
      } else if (drawing.type === 'circle' && displayRadius) {
        ctx.beginPath();
        ctx.arc(displayX, displayY, displayRadius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
        const displayX1 = drawing.x1 * scaleX;
        const displayY1 = drawing.y1 * scaleY;
        const displayX2 = drawing.x2 * scaleX;
        const displayY2 = drawing.y2 * scaleY;
        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(displayX1, displayY1);
        ctx.lineTo(displayX2, displayY2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(displayY2 - displayY1, displayX2 - displayX1);
        const arrowLength = 15 / zoom;
        ctx.beginPath();
        ctx.moveTo(displayX2, displayY2);
        ctx.lineTo(
          displayX2 - arrowLength * Math.cos(angle - Math.PI / 6),
          displayY2 - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(displayX2, displayY2);
        ctx.lineTo(
          displayX2 - arrowLength * Math.cos(angle + Math.PI / 6),
          displayY2 - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (drawing.type === 'brush' && drawing.points && drawing.points.length > 0) {
        // Draw freehand brush path
        ctx.beginPath();
        const firstPoint = drawing.points[0];
        ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
        for (let i = 1; i < drawing.points.length; i++) {
          ctx.lineTo(drawing.points[i].x * scaleX, drawing.points[i].y * scaleY);
        }
        ctx.stroke();
      } else if (drawing.type === 'text' && drawing.text && drawing.x !== undefined && drawing.y !== undefined) {
        // Set text properties for proper rendering
        ctx.font = `${drawing.fontSize || 16}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = drawing.color;
        // Draw text at exact position (scaled)
        ctx.fillText(drawing.text, displayX, displayY);
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

    // Check lock status before saving
    if (selectedImage.lockInfo?.isLocked && !selectedImage.lockInfo?.isCurrentUser) {
      setError('This image is being inspected by another user. You cannot save annotations.');
      return;
    }

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
            // Track that this AI image has been replaced
            setAiImagesReplaced(prev => ({
              ...prev,
              [modelType === 'model1' ? 'model1' : 'model2']: true
            }));
            
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

  // Export canvas (original image + drawings) as image blob - FIXED VERSION
  const exportCanvasAsImage = async (): Promise<Blob | null> => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) {
      setError('Image not loaded yet. Please wait for the image to load.');
      return null;
    }

    const img = imageRef.current;
    
    // Wait for image to be fully loaded
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      setError('Image is still loading. Please wait.');
      return null;
    }
    
    // Create a temporary canvas with the full image size (high quality)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const ctx = tempCanvas.getContext('2d', { alpha: false });
    
    if (!ctx) {
      setError('Failed to create canvas context.');
      return null;
    }

    // Set high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw the original image first (white background for JPEG)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    // Draw all annotations on top (drawings are already in image coordinates)
    if (drawings.length > 0) {
    drawings.forEach(drawing => {
      ctx.strokeStyle = drawing.color;
      ctx.fillStyle = drawing.color;
        ctx.lineWidth = drawing.lineWidth || 2.5;
      ctx.setLineDash([]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (drawing.type === 'rectangle' && drawing.width !== undefined && drawing.height !== undefined && drawing.x !== undefined && drawing.y !== undefined) {
          // Ensure minimum size
          const width = Math.max(drawing.width, 1);
          const height = Math.max(drawing.height, 1);
          ctx.strokeRect(drawing.x, drawing.y, width, height);
        } else if (drawing.type === 'circle' && drawing.radius !== undefined && drawing.x !== undefined && drawing.y !== undefined) {
          // Ensure minimum radius
          const radius = Math.max(drawing.radius, 1);
        ctx.beginPath();
          ctx.arc(drawing.x, drawing.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (drawing.type === 'arrow' && drawing.x1 !== undefined && drawing.y1 !== undefined && drawing.x2 !== undefined && drawing.y2 !== undefined) {
        // Draw arrow line
        ctx.beginPath();
        ctx.moveTo(drawing.x1, drawing.y1);
        ctx.lineTo(drawing.x2, drawing.y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(drawing.y2 - drawing.y1, drawing.x2 - drawing.x1);
          const arrowLength = Math.max(15, drawing.lineWidth || 2.5) * 3;
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
        } else if (drawing.type === 'text' && drawing.text && drawing.x !== undefined && drawing.y !== undefined) {
          // Set text properties
        ctx.font = `${drawing.fontSize || 16}px Arial`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          // Draw text with slight offset for better positioning
        ctx.fillText(drawing.text, drawing.x, drawing.y);
      } else if (drawing.type === 'brush' && drawing.points && drawing.points.length > 0) {
        // Draw freehand brush path
        ctx.beginPath();
        ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
        for (let i = 1; i < drawing.points.length; i++) {
          ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
        }
        ctx.stroke();
      }
    });
    }

    // Convert canvas to blob with high quality
    return new Promise((resolve, reject) => {
      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
        resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/jpeg',
        0.98 // High quality JPEG
      );
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

  // Replace AI image or set as increment using drawn image - FIXED VERSION
  const handleUseDrawnImageAs = async (target: 'model1' | 'model2' | 'increment') => {
    if (!selectedImage) {
      setError('No image selected');
      return;
    }

    setUploadingImage(target === 'increment' ? 'increment' : `ai-${target}`);
    setError('');
    setSuccessMessage('');
    
    try {
      // Export canvas as blob
    const drawnImageBlob = await exportCanvasAsImage();
    if (!drawnImageBlob) {
        setError('Failed to export drawn image. Please try again.');
        setUploadingImage(null);
      return;
    }

      // Verify blob size
      if (drawnImageBlob.size === 0) {
        setError('Exported image is empty. Please check your drawings.');
        setUploadingImage(null);
        return;
      }

      console.log('[ManualInspection] Exporting image:', {
        blobSize: drawnImageBlob.size,
        blobType: drawnImageBlob.type,
        drawingsCount: drawings.length
      });

      const fileName = `edited-${selectedImage.id}-${target}-${Date.now()}.jpg`;
      const contentType = 'image/jpeg';
      
      // Get presigned URL and upload
      const { presignedUrl, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      console.log('[ManualInspection] Got presigned URL:', { s3Url });
      
      const uploadResult = await uploadFileToS3({ presignedUrl, file: drawnImageBlob, contentType });
      console.log('[ManualInspection] Upload result:', uploadResult);
      
      if (target === 'increment') {
        // Upload as increment image
        const response = await uploadIncrementImage(selectedImage.id, {
          imageUrl: s3Url
        });

        if (response.success) {
          console.log('[ManualInspection] Increment image updated:', response);
          
          // Update selected image
          setSelectedImage(response.image);
          setPendingImages(prev => prev.map(img => 
            img.id === response.image.id ? response.image : img
          ));
          
          // Reload increment image - Force refresh with cache busting
          if (response.image.incrementImageStreamUrl) {
            try {
              // Clean up old blob URL
              if (incrementImageBlobUrl) {
                URL.revokeObjectURL(incrementImageBlobUrl);
              }
              
              // Clear current image first to force UI update
              setIncrementImageBlobUrl(null);
              
              // Wait a tiny bit to ensure state update
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Fetch with cache busting
              const baseURL = import.meta.env.VITE_API_BASE_URL || '';
              let incrementUrl = response.image.incrementImageStreamUrl;
              if (!incrementUrl.startsWith('http://') && !incrementUrl.startsWith('https://')) {
                incrementUrl = `${baseURL}${incrementUrl.startsWith('/') ? '' : '/'}${incrementUrl}`;
              }
              
              // Add cache busting parameter
              const cacheBuster = incrementUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
              const fullUrl = `${incrementUrl}${cacheBuster}`;
              
              console.log('[ManualInspection] Fetching increment image with cache busting:', fullUrl);
              
              const token = await cognitoService.getAccessToken();
              if (!token) throw new Error('No authentication token available');
              
              const fetchResponse = await fetch(fullUrl, {
                cache: 'no-store',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Cache-Control': 'no-cache'
                }
              });
              
              if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch increment image: ${fetchResponse.status}`);
              }
              
              const blob = await fetchResponse.blob();
              const newBlobUrl = URL.createObjectURL(blob);
              
              setIncrementImageBlobUrl(newBlobUrl);
              console.log('[ManualInspection] Increment image loaded successfully with new blob URL:', newBlobUrl);
            } catch (err) {
              console.error('[ManualInspection] Failed to load increment image:', err);
              setError('Image replaced but failed to reload. Please refresh.');
            }
          } else {
            // If no increment image in response, clear it
            if (incrementImageBlobUrl) {
              URL.revokeObjectURL(incrementImageBlobUrl);
            }
            setIncrementImageBlobUrl(null);
          }
          
          setSuccessMessage('Increment image updated successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError('Failed to update increment image. Please try again.');
        }
      } else {
        // Replace AI image
        const response = await replaceAIImage(selectedImage.id, {
          modelType: target,
          imageUrl: s3Url
        });

        if (response.success) {
          console.log('[ManualInspection] AI image replaced:', response);
          
          // Track that this AI image has been replaced
          setAiImagesReplaced(prev => ({
            ...prev,
            [target === 'model1' ? 'model1' : 'model2']: true
          }));
          
          // Update selected image
          setSelectedImage(response.image);
          setPendingImages(prev => prev.map(img => 
            img.id === response.image.id ? response.image : img
          ));
          
          // Reload AI processed images - Force refresh with cache busting
          if (response.image.aiProcessedImageUrls && response.image.aiProcessedImageUrls.length > 0) {
            // Clean up old blob URLs
            aiProcessedImageBlobUrls.forEach(url => {
              if (url) URL.revokeObjectURL(url);
            });
            
            // Clear current images first to force refresh
            setAiProcessedImageBlobUrls([]);
            
            const aiBlobPromises = response.image.aiProcessedImageUrls.map(async (url, index) => {
              try {
                // Handle S3 URLs directly
                if (url.includes('s3.amazonaws.com') || url.includes('s3.') || (url.startsWith('https://') && !url.includes('/api/'))) {
                  // For S3 URLs, fetch directly with cache busting
                  const cacheBuster = `?t=${Date.now()}`;
                  const fullUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}${cacheBuster}`;
                  
                  console.log('[ManualInspection] Fetching S3 AI image:', fullUrl);
                  const fetchResponse = await fetch(fullUrl, {
                    cache: 'no-store',
                    headers: {
                      'Cache-Control': 'no-cache'
                    }
                  });
                  
                  if (!fetchResponse.ok) {
                    console.error('[ManualInspection] Failed to fetch S3 AI image:', fetchResponse.status);
                  return null;
                }
                
                  const blob = await fetchResponse.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  console.log('[ManualInspection] S3 AI image loaded:', { index, blobSize: blob.size });
                  return blobUrl;
                }
                
                // Construct full URL for API endpoints
                let fullUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                  const baseURL = import.meta.env.VITE_API_BASE_URL || '';
                  fullUrl = `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
                }
                
                // Add cache busting parameter
                const cacheBuster = fullUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
                fullUrl = `${fullUrl}${cacheBuster}`;
                
                const token = await cognitoService.getAccessToken();
                if (!token) throw new Error('No authentication token available');
                
                console.log('[ManualInspection] Fetching AI image:', fullUrl);
                const fetchResponse = await fetch(fullUrl, {
                  cache: 'no-store',
                  headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                  }
                });
                
                if (!fetchResponse.ok) {
                  console.error('[ManualInspection] Failed to fetch AI image:', fetchResponse.status);
                  return null;
                }
                
                const blob = await fetchResponse.blob();
                const blobUrl = URL.createObjectURL(blob);
                console.log('[ManualInspection] AI image loaded:', { index, blobSize: blob.size });
                return blobUrl;
              } catch (err) {
                console.error('[ManualInspection] Error loading AI image:', err);
                return null;
              }
            });
            
            const aiBlobUrls = await Promise.all(aiBlobPromises);
            const validUrls = aiBlobUrls.filter(url => url !== null) as string[];
            setAiProcessedImageBlobUrls(validUrls);
            console.log('[ManualInspection] AI images reloaded:', validUrls.length);
          } else {
            // If no AI images in response, clear the current ones
            setAiProcessedImageBlobUrls([]);
          }
          
          setSuccessMessage(`AI Model ${target === 'model1' ? '1' : '2'} replaced successfully!`);
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError('Failed to replace AI image. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('[ManualInspection] Error in handleUseDrawnImageAs:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save drawn image';
      setError(errorMsg);
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedImage) return;

    // Check lock status before approving
    if (selectedImage.lockInfo?.isLocked && !selectedImage.lockInfo?.isCurrentUser) {
      setError('This image is being inspected by another user. You cannot approve it.');
      return;
    }

    setApproving(true);
    try {
      // Auto-replace AI images if they haven't been replaced
      const hasEdits = drawings.length > 0;
      const imageToUse = hasEdits ? await exportCanvasAsImage() : null;
      
      // Replace AI image 1 if not replaced
      if (!aiImagesReplaced.model1) {
        try {
          let s3Url: string;
          if (imageToUse) {
            // Use edited image
            const fileName = `auto-replace-${selectedImage.id}-model1-${Date.now()}.jpg`;
            const contentType = 'image/jpeg';
            const { presignedUrl, s3Url: uploadedUrl } = await getPresignedUploadUrl({ fileName, contentType });
            await uploadFileToS3({ presignedUrl, file: imageToUse, contentType });
            s3Url = uploadedUrl;
          } else {
            // Use unedited original image
            s3Url = selectedImage.imageUrl;
          }
          
          await replaceAIImage(selectedImage.id, {
            modelType: 'model1',
            imageUrl: s3Url
          });
          setAiImagesReplaced(prev => ({ ...prev, model1: true }));
        } catch (err) {
          console.error('Failed to auto-replace AI image 1:', err);
        }
      }
      
      // Replace AI image 2 if not replaced
      if (!aiImagesReplaced.model2) {
        try {
          let s3Url: string;
          if (imageToUse) {
            // Use edited image
            const fileName = `auto-replace-${selectedImage.id}-model2-${Date.now()}.jpg`;
            const contentType = 'image/jpeg';
            const { presignedUrl, s3Url: uploadedUrl } = await getPresignedUploadUrl({ fileName, contentType });
            await uploadFileToS3({ presignedUrl, file: imageToUse, contentType });
            s3Url = uploadedUrl;
          } else {
            // Use unedited original image
            s3Url = selectedImage.imageUrl;
          }
          
          await replaceAIImage(selectedImage.id, {
            modelType: 'model2',
            imageUrl: s3Url
          });
          setAiImagesReplaced(prev => ({ ...prev, model2: true }));
        } catch (err) {
          console.error('Failed to auto-replace AI image 2:', err);
        }
      }
      
      // Format comments for AI images from dropdown values
      const aiComment = formatAIComment(originalImageDropdowns);
      const formattedComments: typeof comments = {
        original: '', // Original image has no comment (only dropdowns)
        ai1: aiComment, // Same comment for both AI images
        ai2: aiComment,
        increment: comments.increment || undefined
      };
      
      // Save comments
      if (aiComment || comments.increment) {
        try {
          await updateImageComments(selectedImage.id, { comments: formattedComments });
        } catch (err) {
          console.error('Failed to save comments:', err);
        }
      }
      
      // Approve image
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

  const formatLockTime = (lockedAt: string) => {
    const date = new Date(lockedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    return `${diffMins} minutes ago`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      case 'IN_REVIEW':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
      case 'APPROVED':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'REJECTED':
        return 'bg-red-500/20 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
    }
  };

  // Access control check
  if (accessLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Checking access...</p>
        </motion.div>
      </div>
    );
  }

  if (hasAccess === false) {
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
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">
            You don't have permission to access the inspection dashboard. Please contact an administrator to request access.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl"
          >
            Go Back
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (loading && !hasAccess) {
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

        {/* Main Content - New 2-Column Layout */}
        <div className="px-4 md:px-8 pb-8">
          {/* Success Message */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column: Editable Canvas (60%) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Drawing Tools */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Drawing Tools</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentTool(currentTool === 'brush' ? 'none' : 'brush')}
                      className={`p-2 rounded-lg flex items-center justify-center gap-2 ${
                        currentTool === 'brush' ? 'bg-blue-500/30 border-2 border-blue-500' : 'bg-white/10 border border-white/20'
                      } text-white`}
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="text-xs">Brush</span>
                    </motion.button>
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
                      className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-xs">Clear</span>
                    </motion.button>
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

                  {/* Action Buttons - Replace AI Images or Set Increment - Always Visible */}
                  <div className="pt-2 border-t border-white/20 space-y-2">
                      <p className="text-gray-400 text-xs mb-2 font-semibold">Apply Edits To:</p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUseDrawnImageAs('model1')}
                        disabled={!imageLoaded || uploadingImage === 'ai-model1'}
                        className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm hover:bg-blue-500/30"
                      >
                        {uploadingImage === 'ai-model1' ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Replacing...
                          </>
                        ) : (
                          <>
                            <Edit2 className="w-4 h-4" />
                            Replace AI Image 1
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUseDrawnImageAs('model2')}
                        disabled={!imageLoaded || uploadingImage === 'ai-model2'}
                        className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm hover:bg-blue-500/30"
                      >
                        {uploadingImage === 'ai-model2' ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Replacing...
                          </>
                        ) : (
                          <>
                            <Edit2 className="w-4 h-4" />
                            Replace AI Image 2
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUseDrawnImageAs('increment')}
                        disabled={!imageLoaded || uploadingImage === 'increment'}
                        className="w-full bg-green-500/20 border border-green-500/30 text-green-300 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm hover:bg-green-500/30"
                      >
                        {uploadingImage === 'increment' ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Setting...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Set as Increment Image
                          </>
                        )}
                      </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDownloadDrawnImage}
                      disabled={!imageLoaded}
                        className="w-full bg-gray-500/20 border border-gray-500/30 text-gray-300 font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                      <Download className="w-4 h-4" />
                        Download Edited Image
                    </motion.button>
                    </div>

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

              {/* Canvas Section - Always shows Original Image */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
                  Edit Original Image
                  {drawings.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs rounded">
                      {drawings.length} edit{drawings.length !== 1 ? 's' : ''}
                    </span>
                  )}
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
              {/* Text Input Dialog - Positioned at exact click location */}
              {textInputPosition && canvasRef.current && (
                <div 
                  className="text-input-dialog absolute bg-white/95 backdrop-blur-lg rounded-lg p-3 shadow-xl z-[100] border-2 border-blue-500"
                  style={{
                    left: `${Math.min(Math.max(textInputPosition.canvasX, 10), canvasRef.current.getBoundingClientRect().width - 220)}px`,
                    top: `${Math.min(Math.max(textInputPosition.canvasY - 40, 10), canvasRef.current.getBoundingClientRect().height - 80)}px`,
                    pointerEvents: 'auto'
                  }}
                  onClick={(e) => {
                    // Don't prevent default if clicking on select element
                    if ((e.target as HTMLElement).tagName === 'SELECT') {
                      e.stopPropagation();
                      return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseDown={(e) => {
                    // Don't prevent default if clicking on select element
                    if ((e.target as HTMLElement).tagName === 'SELECT') {
                      e.stopPropagation();
                      return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseUp={(e) => {
                    // Don't prevent default if clicking on select element
                    if ((e.target as HTMLElement).tagName === 'SELECT') {
                      e.stopPropagation();
                      return;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Type className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700">Add Text</span>
                  </div>
                  <select
                    value={textInput}
                    onChange={(e) => {
                      e.stopPropagation();
                      const selectedValue = e.target.value;
                      setTextInput(selectedValue);
                      // Auto-confirm when a selection is made, preserving the click position
                      if (selectedValue && textInputPosition) {
                        // Capture the position before any state updates
                        const position = textInputPosition;
                        setTimeout(() => {
                          // Use the captured position to ensure text is placed at click location
                          if (position && selectedValue.trim()) {
                            const newDrawing: Drawing = {
                              id: `drawing-${Date.now()}-${Math.random()}`,
                              type: 'text',
                              x: position.x,
                              y: position.y,
                              text: selectedValue.trim(),
                              fontSize: fontSize,
                              color: drawingColor,
                              lineWidth: lineWidth
                            };
                            setDrawings(prev => [...prev, newDrawing]);
                          }
                          setTextInputPosition(null);
                          setTextInput('');
                          isTextInputActiveRef.current = false;
                          setCurrentTool('none');
                        }, 50);
                      }
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') {
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
                      // Don't handle blur if a value was just selected (onChange handles it)
                      // Only handle blur if no value is selected (user clicked away without selecting)
                      if (!textInput.trim()) {
                        setTimeout(() => {
                          // Double check that we're still supposed to blur (user might have clicked back)
                          if (document.activeElement === textInputRef.current) {
                            return; // User clicked back into select, don't close
                          }
                          setTextInputPosition(null);
                          setTextInput('');
                          setCurrentTool('none');
                          isTextInputActiveRef.current = false;
                        }, 200);
                      }
                    }}
                    onClick={(e) => {
                      // Only stop propagation, don't prevent default - allows dropdown to open
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      // Only stop propagation, don't prevent default - allows dropdown to open
                      e.stopPropagation();
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                      isTextInputActiveRef.current = true;
                    }}
                    autoFocus
                    ref={textInputRef}
                    className="px-3 py-2.5 border-2 border-blue-300 rounded-lg text-black text-sm w-52 bg-white cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    style={{ zIndex: 1000 }}
                  >
                    <option value="">Select damage type...</option>
                    <option value="Damage">Damage</option>
                    <option value="Dent">Dent</option>
                    <option value="Scratch">Scratch</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">Select a damage type to add                  </p>
                </div>
              )}
            </div>
            
            {/* Original Image Comment Dropdowns - Below Canvas */}
            {selectedImage && (() => {
              const dropdownOptions = getDropdownOptionsForImage(selectedImage.processingOrder);
              return (
                <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    Original Image Comments
                  </h3>
                  <div className="space-y-3">
                    {/* Images 1-10: Logo and Damage Detection */}
                    {dropdownOptions.showLogo && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Logo</label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="logo"
                              value="Yes"
                              checked={originalImageDropdowns.logo === 'Yes'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, logo: 'Yes' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="logo"
                              value="No"
                              checked={originalImageDropdowns.logo === 'No'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, logo: 'No' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">No</span>
                          </label>
                        </div>
                      </div>
                    )}
                    {dropdownOptions.showDamageDetection && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Damage Detection</label>
                        <div className="flex flex-wrap gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="damageDetection"
                              value="No damage"
                              checked={originalImageDropdowns.damageDetection === 'No damage'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, damageDetection: 'No damage' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">No damage</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="damageDetection"
                              value="Damage"
                              checked={originalImageDropdowns.damageDetection === 'Damage'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, damageDetection: 'Damage' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Damage</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="damageDetection"
                              value="Dent"
                              checked={originalImageDropdowns.damageDetection === 'Dent'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, damageDetection: 'Dent' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Dent</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="damageDetection"
                              value="Scratch"
                              checked={originalImageDropdowns.damageDetection === 'Scratch'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, damageDetection: 'Scratch' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Scratch</span>
                          </label>
                        </div>
                      </div>
                    )}
                    {/* Image 11: Front Floor */}
                    {dropdownOptions.showFrontFloor && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Front Floor</label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="frontFloor"
                              value="Clean"
                              checked={originalImageDropdowns.frontFloor === 'Clean'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, frontFloor: 'Clean' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Clean</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="frontFloor"
                              value="Dirty"
                              checked={originalImageDropdowns.frontFloor === 'Dirty'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, frontFloor: 'Dirty' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Dirty</span>
                          </label>
                        </div>
                      </div>
                    )}
                    {/* Image 12: Tissue */}
                    {dropdownOptions.showTissue && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Tissue</label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tissue"
                              value="Yes"
                              checked={originalImageDropdowns.tissue === 'Yes'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, tissue: 'Yes' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tissue"
                              value="No"
                              checked={originalImageDropdowns.tissue === 'No'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, tissue: 'No' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">No</span>
                          </label>
                        </div>
                      </div>
                    )}
                    {/* Image 13: Rear Floor */}
                    {dropdownOptions.showRearFloor && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Rear Floor</label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="rearFloor"
                              value="Clean"
                              checked={originalImageDropdowns.rearFloor === 'Clean'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, rearFloor: 'Clean' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Clean</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="rearFloor"
                              value="Dirty"
                              checked={originalImageDropdowns.rearFloor === 'Dirty'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, rearFloor: 'Dirty' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Dirty</span>
                          </label>
                        </div>
                      </div>
                    )}
                    {/* Image 14: Bottle */}
                    {dropdownOptions.showBottle && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Bottle</label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="bottle"
                              value="Yes"
                              checked={originalImageDropdowns.bottle === 'Yes'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, bottle: 'Yes' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="bottle"
                              value="No"
                              checked={originalImageDropdowns.bottle === 'No'}
                              onChange={(e) => setOriginalImageDropdowns(prev => ({ ...prev, bottle: 'No' as const }))}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="text-white text-sm">No</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
            </div>

            {/* Right Column: Comparison Panel (40%) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Reference Images
                </h3>
                <div className="space-y-4">
                  {/* AI Model 1 */}
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium text-sm">AI Model 1</h4>
                      {selectedImage.aiProcessingStatus === 'processing' && (
                        <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs rounded">
                          Processing...
                        </span>
                      )}
                    </div>
                    <div className="relative aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                      {aiProcessedImageBlobUrls[0] ? (
                        <img src={aiProcessedImageBlobUrls[0]} alt="AI Model 1" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Model 2 */}
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium text-sm">AI Model 2</h4>
                      {selectedImage.aiProcessingStatus === 'processing' && (
                        <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs rounded">
                          Processing...
                        </span>
                      )}
                    </div>
                    <div className="relative aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                      {aiProcessedImageBlobUrls[1] ? (
                        <img src={aiProcessedImageBlobUrls[1]} alt="AI Model 2" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Previous Day */}
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <h4 className="text-white font-medium text-sm mb-2">Previous Day</h4>
                    <div className="relative aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                      {previousImageBlobUrl ? (
                        <img src={previousImageBlobUrl} alt="Previous Day" className="w-full h-full object-contain" />
                      ) : loadingPrevious ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader className="w-6 h-6 animate-spin text-blue-400" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <span className="text-xs">No previous day image</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Increment Image */}
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <h4 className="text-white font-medium text-sm mb-2">Increment Image</h4>
                    <div className="relative aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                      {incrementImageBlobUrl ? (
                        <img 
                          key={incrementImageBlobUrl} 
                          src={incrementImageBlobUrl} 
                          alt="Increment" 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.error('[ManualInspection] Failed to load increment image in img tag');
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          <span className="text-xs">No increment image yet</span>
                        </div>
                      )}
                    </div>
                    <textarea
                      value={comments.increment || ''}
                      onChange={(e) => setComments(prev => ({ ...prev, increment: e.target.value }))}
                      placeholder="Add comment for increment image..."
                      className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveAnnotations}
                  disabled={savingAnnotations}
                  className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
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

      {/* Success/Error Messages */}
      <div className="px-4 md:px-8 pb-4">
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
              <button
                onClick={() => setSuccessMessage('')}
                className="ml-auto text-green-300 hover:text-green-200"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-300 hover:text-red-200"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filters and Search */}
      <div className="px-4 md:px-8 pb-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by car number..."
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Sort By */}
            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="createdAt">Date Created</option>
                <option value="carNumber">Car Number</option>
                <option value="status">Status</option>
              </select>
            </div>

            {/* Sort Order */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 flex items-center gap-2"
            >
              {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
              <span className="text-sm">{sortOrder === 'desc' ? 'Desc' : 'Asc'}</span>
            </button>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Page Size */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-gray-400 text-sm">Per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Operations Filter Panel */}
      <div className="px-4 md:px-8 pb-4" style={{ position: 'relative', zIndex: showFilterPanel ? 100 : 'auto' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="w-full bg-blue-500/20 border border-blue-500/30 backdrop-blur-lg rounded-xl p-3 text-white hover:bg-blue-500/30 flex items-center justify-between transition-all duration-200"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span className="font-semibold">Bulk Operations</span>
          </div>
          <motion.div
            animate={{ rotate: showFilterPanel ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-5 h-5" />
          </motion.div>
        </motion.button>
        
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mt-2 space-y-4"
              style={{ overflow: 'visible', position: 'relative' }}
            >
              <h3 className="text-white font-semibold mb-3">Filter-Based Bulk Operations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Client Name</label>
                  <select
                    value={bulkFilters.clientName}
                    onChange={(e) => setBulkFilters(prev => ({ ...prev, clientName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Clients</option>
                    <option value="SNAPCABS">SNAPCABS</option>
                    <option value="REFUX">REFUX</option>
                    <option value="ECO MOBILITY">ECO MOBILITY</option>
                  </select>
                </div>
                <div className="relative inspection-dropdown-container md:col-span-1" style={{ zIndex: showInspectionDropdown ? 1000 : 'auto' }}>
                  <label className="text-gray-400 text-sm mb-1 block">
                    Inspection ID
                    {bulkFilters.inspectionIds.length > 0 && (
                      <span className="ml-2 text-blue-400 text-xs">
                        ({bulkFilters.inspectionIds.length} selected)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowInspectionDropdown(!showInspectionDropdown)}
                      className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 flex items-center justify-between hover:bg-white/15 transition-colors ${
                        bulkFilters.inspectionIds.length > 0 
                          ? 'border-blue-500/50 bg-blue-500/10' 
                          : 'border-white/20'
                      }`}
                    >
                      <span className={bulkFilters.inspectionIds.length > 0 ? 'text-white font-medium' : 'text-gray-500'}>
                        {bulkFilters.inspectionIds.length === 0
                          ? `Select inspection IDs... (${uniqueInspectionIds.length} available)`
                          : `${bulkFilters.inspectionIds.length} of ${uniqueInspectionIds.length} selected`}
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${showInspectionDropdown ? 'rotate-90' : ''}`}
                      />
                    </button>
                    
                    {showInspectionDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute z-[9999] w-full mt-1 bg-white/10 backdrop-blur-xl border-2 border-blue-500/30 rounded-lg shadow-2xl overflow-hidden"
                        style={{ 
                          maxHeight: '450px',
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px'
                        }}
                      >
                        <div className="p-3 border-b border-white/20 flex items-center justify-between bg-white/5 sticky top-0">
                          <span className="text-white text-sm font-semibold">
                            {uniqueInspectionIds.length} available inspection{uniqueInspectionIds.length !== 1 ? 's' : ''}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllInspectionIds();
                              }}
                              className="px-3 py-1.5 text-xs bg-blue-500/30 border border-blue-500/50 text-blue-200 rounded-lg hover:bg-blue-500/40 transition-colors font-medium"
                            >
                              Select All
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deselectAllInspectionIds();
                              }}
                              className="px-3 py-1.5 text-xs bg-gray-500/30 border border-gray-500/50 text-gray-200 rounded-lg hover:bg-gray-500/40 transition-colors font-medium"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '350px' }}>
                          {uniqueInspectionIds.length === 0 ? (
                            <div className="p-4 text-gray-400 text-sm text-center">
                              No inspection IDs available in queue
                            </div>
                          ) : (
                            <div className="divide-y divide-white/10">
                              {uniqueInspectionIds.map((inspectionId) => {
                                const isSelected = bulkFilters.inspectionIds.includes(inspectionId);
                                const imageCount = pendingImages.filter(img => img.inspectionId === inspectionId).length;
                                return (
                                  <label
                                    key={inspectionId}
                                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                      isSelected ? 'bg-blue-500/20' : 'hover:bg-white/10'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleInspectionIdSelection(inspectionId)}
                                      className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-white text-sm font-medium">
                                        Inspection #{inspectionId}
                                      </div>
                                      <div className="text-gray-400 text-xs mt-0.5">
                                        {imageCount} image{imageCount !== 1 ? 's' : ''} in queue
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Older Than (Days)</label>
                  <input
                    type="number"
                    value={bulkFilters.olderThanDays}
                    onChange={(e) => setBulkFilters(prev => ({ ...prev, olderThanDays: e.target.value }))}
                    placeholder="Enter days"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFilterApprove}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-300 rounded-lg hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve All Matching
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFilterRemove}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Remove All Matching
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setBulkFilters({ clientName: '', inspectionIds: [], olderThanDays: '' });
                    setShowInspectionDropdown(false);
                  }}
                  className="px-4 py-2 bg-gray-500/20 border border-gray-500/30 text-gray-300 rounded-lg hover:bg-gray-500/30 flex items-center gap-2"
                >
                  Clear Filters
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions Bar */}
      {selectedImageIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 md:px-8 pb-4"
        >
          <div className="bg-blue-500/20 border border-blue-500/30 backdrop-blur-lg rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-white font-semibold">
                  {selectedImageIds.length} image{selectedImageIds.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={selectAllImages}
                    className="px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 text-sm"
                  >
                    Select All
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={deselectAllImages}
                    className="px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 text-sm"
                  >
                    Deselect All
                  </motion.button>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkApprove}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-300 rounded-lg hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve Selected
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkRemove}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Remove Selected
                </motion.button>
              </div>
            </div>
            {bulkResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-3 p-3 rounded-lg ${
                  bulkResult.failed > 0
                    ? 'bg-yellow-500/20 border border-yellow-500/30'
                    : 'bg-green-500/20 border border-green-500/30'
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  {bulkResult.success > 0 && (
                    <span className="text-green-300">✓ {bulkResult.success} succeeded</span>
                  )}
                  {bulkResult.failed > 0 && (
                    <span className="text-yellow-300">⚠ {bulkResult.failed} failed</span>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

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
                  className={`relative bg-white/10 backdrop-blur-lg rounded-xl p-4 border transition-all duration-200 ${
                    image.lockInfo?.isLocked && !image.lockInfo?.isCurrentUser
                      ? 'border-red-500/50 opacity-60 cursor-not-allowed'
                      : selectedImageIds.includes(image.id)
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/20 hover:border-white/30 cursor-pointer'
                  }`}
                  onClick={() => {
                    if (!image.lockInfo?.isLocked || image.lockInfo?.isCurrentUser) {
                      handleImageClick(image);
                    }
                  }}
                >
                  {/* Checkbox for selection */}
                  <div 
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleImageSelection(image.id);
                    }}
                  >
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                      selectedImageIds.includes(image.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-white/20 border-white/40 hover:border-white/60'
                    }`}>
                      {selectedImageIds.includes(image.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                  
                  <div className="relative aspect-video bg-black rounded-lg mb-3 overflow-hidden">
                    <ImageThumbnail image={image} />
                    <div className="absolute top-2 right-2 bg-yellow-500/90 text-black text-xs font-bold px-2 py-1 rounded">
                      #{image.processingOrder}
                    </div>
                    {/* Lock Indicator */}
                    {image.lockInfo?.isLocked && (
                      <div className={`absolute top-2 left-10 flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                        image.lockInfo.isCurrentUser 
                          ? 'bg-green-500/90 text-white' 
                          : 'bg-red-500/90 text-white'
                      }`}>
                        <Lock className="w-3 h-3" />
                        {image.lockInfo.isCurrentUser ? 'You' : 'Locked'}
                      </div>
                    )}
                    {/* Disabled overlay for locked images */}
                    {image.lockInfo?.isLocked && !image.lockInfo?.isCurrentUser && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-center">
                          <Lock className="w-8 h-8 text-red-400 mx-auto mb-2" />
                          <p className="text-red-400 text-xs font-semibold">Locked</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold text-sm">{image.carNumber}</p>
                      <span className={`px-2 py-1 border text-xs rounded ${getStatusBadgeColor(image.inspectionStatus)}`}>
                        {image.inspectionStatus}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">{getImageTypeLabel(image.imageType)}</p>
                    <p className="text-gray-500 text-xs">Inspection #{image.inspectionId}</p>
                    {image.lockInfo?.isLocked && !image.lockInfo?.isCurrentUser && image.lockInfo?.lockedAt && (
                      <p className="text-red-400 text-xs">
                        Inspected by another user {formatLockTime(image.lockInfo.lockedAt)}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/10 backdrop-blur-lg rounded-xl p-4">
            <div className="text-white text-sm">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} images
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!pagination.hasPrevious}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={!pagination.hasNext}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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


