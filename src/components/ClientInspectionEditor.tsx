import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Car,
  Maximize2,
  X,
  ArrowUp,
  Edit2,
  Upload,
  Loader
} from 'lucide-react';
import {
  getDashboardData,
  checkInspectionReadiness,
  DashboardData
} from '../services/api/inspectionDashboardService';
import {
  replaceAIImage,
  uploadIncrementImage,
  updateImageComments
} from '../services/api/manualInspectionService';
import {
  getPresignedUploadUrl,
  uploadFileToS3
} from '../services/api/uploadService';

interface ClientInspectionEditorProps {
  inspectionId: number;
  onBack: () => void;
}

interface ImageModalProps {
  imageUrl: string | null;
  alt: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, alt, onClose }) => {
  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative max-w-7xl max-h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Parse AI1 comment to extract damage detection and logo
const parseAIComment = (comment: string | undefined): { damageDetection: string; logo: string } => {
  const result = {
    damageDetection: 'NA',
    logo: 'No'
  };

  if (!comment) return result;

  const damageMatch = comment.match(/Damage Detection:\s*([^L]+?)(?:\s+Logo:|$)/i);
  if (damageMatch && damageMatch[1]) {
    result.damageDetection = damageMatch[1].trim();
  }

  const logoMatch = comment.match(/Logo:\s*(yes|no)/i);
  if (logoMatch && logoMatch[1]) {
    result.logo = logoMatch[1].trim();
  }

  return result;
};

// Format date to show only date (no time)
const formatDateOnly = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  } catch (e) {
    return dateString;
  }
};

// Fetch image using fetch API to avoid axios cache issues
const fetchImageBlobDirect = async (streamUrl: string | null): Promise<Blob | null> => {
  if (!streamUrl) return null;
  
  try {
    // Import apiClient to get baseURL and cognitoService for auth
    const { apiClient } = await import('../services/api/authenticatedApiService');
    const { cognitoService } = await import('../services/cognitoService');
    const baseURL = apiClient.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || '';
    
    const url = streamUrl.startsWith('http') 
      ? streamUrl 
      : `${baseURL}${streamUrl}`;
    
    // Get auth token from Cognito (same as apiClient)
    const token = await cognitoService.getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, { 
      headers,
      cache: 'no-store' // Prevent caching
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    return await response.blob();
  } catch (error) {
    console.error('Failed to fetch image blob:', streamUrl, error);
    return null;
  }
};

const ClientInspectionEditor: React.FC<ClientInspectionEditorProps> = ({ inspectionId, onBack }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);
  const [editingImageId, setEditingImageId] = useState<number | null>(null);
  const [editingImageType, setEditingImageType] = useState<'aiProcessed' | 'increment' | null>(null);
  const [editingComment, setEditingComment] = useState<{ imageId: number; type: 'ai1' | 'increment' } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNavigation, setShowNavigation] = useState<{
    damage: boolean;
    logo: boolean;
    tissue: boolean;
    bottle: boolean;
    increment: boolean;
  }>({
    damage: false,
    logo: false,
    tissue: false,
    bottle: false,
    increment: false
  });
  const imageUrlsRef = useRef<Map<string, string>>(new Map());
  const previousInspectionIdRef = useRef<number | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const imageRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  const [drawingRectangles, setDrawingRectangles] = useState<Map<number, Array<{ x: number; y: number; width: number; height: number }>>>(new Map());
  const [isDrawing, setIsDrawing] = useState<Map<number, boolean>>(new Map());
  const [startPos, setStartPos] = useState<Map<number, { x: number; y: number }>>(new Map());
  const [drawingEnabled, setDrawingEnabled] = useState<Map<number, boolean>>(new Map());

  useEffect(() => {
    if (previousInspectionIdRef.current !== null && previousInspectionIdRef.current !== inspectionId) {
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current.clear();
      setImageUrls(new Map());
    }
    previousInspectionIdRef.current = inspectionId;
    
    loadDashboardData();
  }, [inspectionId]);

  useEffect(() => {
    return () => {
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current.clear();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const readiness = await checkInspectionReadiness(inspectionId);
      if (!readiness.ready) {
        setError(readiness.message || 'Inspection is not ready for editing.');
        setLoading(false);
        return;
      }

      const data = await getDashboardData(inspectionId);
      setDashboardData(data);

      // Load all images as blobs using fetch (not axios) to avoid cache
      const urlMap = new Map<string, string>();
      const imagePromises: Promise<void>[] = [];

      data.images.forEach((image) => {
        // Original image
        if (image.images.originalImageStreamUrl) {
          imagePromises.push(
            fetchImageBlobDirect(image.images.originalImageStreamUrl)
              .then(blob => {
                if (blob) {
                  urlMap.set(`original-${image.id}`, URL.createObjectURL(blob));
                }
              })
              .catch(() => {})
          );
        }

        // Previous image
        if (image.images.previousImageStreamUrl) {
          imagePromises.push(
            fetchImageBlobDirect(image.images.previousImageStreamUrl)
              .then(blob => {
                if (blob) {
                  urlMap.set(`previous-${image.id}`, URL.createObjectURL(blob));
                }
              })
              .catch(() => {})
          );
        }

        // AI Processed image
        if (image.images.aiProcessedImageStreamUrl) {
          imagePromises.push(
            fetchImageBlobDirect(image.images.aiProcessedImageStreamUrl)
              .then(blob => {
                if (blob) {
                  urlMap.set(`processed-${image.id}`, URL.createObjectURL(blob));
                }
              })
              .catch(() => {})
          );
        }

        // Increment image
        if (image.images.incrementImageStreamUrl) {
          imagePromises.push(
            fetchImageBlobDirect(image.images.incrementImageStreamUrl)
              .then(blob => {
                if (blob) {
                  urlMap.set(`increment-${image.id}`, URL.createObjectURL(blob));
                }
              })
              .catch(() => {})
          );
        }

        // Previous day AI processed image (if previousImageId exists, fetch its AI processed image)
        if (image.images.previousImageId) {
          // Find the previous image in the data to get its AI processed image URL
          const previousImage = data.images.find(img => img.id === image.images.previousImageId);
          if (previousImage?.images.aiProcessedImageStreamUrl) {
            imagePromises.push(
              fetchImageBlobDirect(previousImage.images.aiProcessedImageStreamUrl)
                .then(blob => {
                  if (blob) {
                    urlMap.set(`previous-ai-processed-${image.id}`, URL.createObjectURL(blob));
                  }
                })
                .catch(() => {})
            );
          }
        }
      });

      await Promise.all(imagePromises);
      
      imageUrlsRef.current = urlMap;
      setImageUrls(new Map(urlMap));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load inspection data.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageReplace = (imageId: number, imageType: 'aiProcessed' | 'increment') => {
    setEditingImageId(imageId);
    setEditingImageType(imageType);
  };

  // Replace image with canvas (original with rectangles) - matches manual inspection pattern
  const handleReplaceWithCanvas = async (imageId: number, imageType: 'aiProcessed' | 'increment') => {
    try {
      console.log('[ClientInspectionEditor] Replace clicked:', { imageId, imageType });
      setUploading(true);
      setEditingImageId(imageId);
      setEditingImageType(imageType);
      setError('');

      // Get canvas and image references
      const canvas = canvasRefs.current.get(imageId);
      const img = imageRefs.current.get(imageId);
      
      if (!canvas || !img) {
        console.error('[ClientInspectionEditor] Canvas or image not found:', { canvas: !!canvas, img: !!img });
        setError('Canvas or image not found. Please try again.');
        setUploading(false);
        return;
      }

      // Ensure image is loaded
      if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error('[ClientInspectionEditor] Image not loaded yet');
        setError('Image is still loading. Please wait.');
        setUploading(false);
        return;
      }

      // Get rectangles for this image
      const rectangles = drawingRectangles.get(imageId) || [];
      console.log('[ClientInspectionEditor] Rectangles to draw:', rectangles.length, rectangles);

      // Get display rect for scaling
      const displayRect = canvas.getBoundingClientRect();
      const naturalWidth = img.naturalWidth || img.width || displayRect.width;
      const naturalHeight = img.naturalHeight || img.height || displayRect.height;
      
      console.log('[ClientInspectionEditor] Canvas dimensions:', {
        displayWidth: displayRect.width,
        displayHeight: displayRect.height,
        naturalWidth,
        naturalHeight,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      });

      // Create a temporary canvas with full image size for high quality capture
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = naturalWidth;
      tempCanvas.height = naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        console.error('[ClientInspectionEditor] Failed to create temp canvas context');
        setError('Failed to create canvas context.');
        setUploading(false);
        return;
      }

      // Draw white background (for JPEG)
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original image
      tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      console.log('[ClientInspectionEditor] Image drawn to temp canvas');

      // Draw rectangles scaled to natural image size
      if (rectangles.length > 0 && displayRect.width > 0 && displayRect.height > 0) {
        const scaleX = tempCanvas.width / displayRect.width;
        const scaleY = tempCanvas.height / displayRect.height;
        
        console.log('[ClientInspectionEditor] Drawing rectangles with scale:', { scaleX, scaleY });
        
        rectangles.forEach((rect, index) => {
          const x = rect.x * scaleX;
          const y = rect.y * scaleY;
          const width = rect.width * scaleX;
          const height = rect.height * scaleY;
          
          console.log(`[ClientInspectionEditor] Drawing rectangle ${index}:`, { x, y, width, height });
          
          // Use base line width of 2.5 directly for export (no scaling needed since export is at natural size)
          // This matches manual inspection dashboard export behavior
          tempCtx.strokeStyle = '#00ff00';
          tempCtx.lineWidth = 2.5;
          tempCtx.strokeRect(x, y, width, height);
        });
        console.log('[ClientInspectionEditor] All rectangles drawn');
      } else {
        console.log('[ClientInspectionEditor] No rectangles to draw');
      }

      // Convert temp canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        tempCanvas.toBlob((blob) => {
          console.log('[ClientInspectionEditor] Canvas converted to blob:', blob ? `${blob.size} bytes` : 'null');
          resolve(blob);
        }, 'image/jpeg', 0.98);
      });

      if (!blob) {
        console.error('[ClientInspectionEditor] Failed to create blob from canvas');
        setError('Failed to capture image. Please try again.');
        setUploading(false);
        return;
      }

      console.log('[ClientInspectionEditor] Uploading to S3...');
      // Upload to S3 first (matching manual inspection pattern)
      const fileName = `replaced-${imageId}-${imageType}-${Date.now()}.jpg`;
      const contentType = 'image/jpeg';
      
      const { presignedUrl, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      console.log('[ClientInspectionEditor] Got presigned URL:', s3Url);
      await uploadFileToS3({ presignedUrl, file: blob, contentType });
      console.log('[ClientInspectionEditor] Uploaded to S3');

      // Then call replace endpoint with S3 URL
      if (imageType === 'aiProcessed') {
        // For AI processed, we need to determine which model (default to model1)
        console.log('[ClientInspectionEditor] Replacing AI image with S3 URL:', s3Url);
        const response = await replaceAIImage(imageId, {
          modelType: 'model1',
          imageUrl: s3Url
        });
        
        console.log('[ClientInspectionEditor] Replace AI image response:', response);
        
        if (response.success) {
          console.log('[ClientInspectionEditor] Successfully replaced AI image');
          // Clear old URLs and reload
          imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
          imageUrlsRef.current.clear();
          setImageUrls(new Map());
          await loadDashboardData();
          setEditingImageId(null);
          setEditingImageType(null);
        } else {
          console.error('[ClientInspectionEditor] Failed to replace AI image:', response.message);
          setError(response.message || 'Failed to update image.');
        }
      } else {
        // For increment image
        console.log('[ClientInspectionEditor] Uploading increment image with S3 URL:', s3Url);
        const response = await uploadIncrementImage(imageId, {
          imageUrl: s3Url
        });
        
        console.log('[ClientInspectionEditor] Upload increment image response:', response);
        
        if (response.success) {
          console.log('[ClientInspectionEditor] Successfully uploaded increment image');
          // Clear old URLs and reload
          imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
          imageUrlsRef.current.clear();
          setImageUrls(new Map());
          await loadDashboardData();
          setEditingImageId(null);
          setEditingImageType(null);
        } else {
          console.error('[ClientInspectionEditor] Failed to upload increment image:', response.message);
          setError(response.message || 'Failed to update image.');
        }
      }
    } catch (err: any) {
      console.error('[ClientInspectionEditor] Error in handleReplaceWithCanvas:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update image.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingImageId || !editingImageType) return;

    try {
      setUploading(true);
      setError('');

      // Upload to S3 first (matching manual inspection pattern)
      const fileName = `custom-${editingImageId}-${editingImageType}-${Date.now()}.${file.name.split('.').pop()}`;
      const contentType = file.type || 'image/jpeg';
      
      const { presignedUrl, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      await uploadFileToS3({ presignedUrl, file, contentType });

      // Then call replace endpoint with S3 URL
      if (editingImageType === 'aiProcessed') {
        const response = await replaceAIImage(editingImageId, {
          modelType: 'model1',
          imageUrl: s3Url
        });
        
        if (response.success) {
          // Clear old URLs and reload
          imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
          imageUrlsRef.current.clear();
          setImageUrls(new Map());
          await loadDashboardData();
          setEditingImageId(null);
          setEditingImageType(null);
        } else {
          setError(response.message || 'Failed to update image.');
        }
      } else {
        const response = await uploadIncrementImage(editingImageId, {
          imageUrl: s3Url
        });
        
        if (response.success) {
          // Clear old URLs and reload
          imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
          imageUrlsRef.current.clear();
          setImageUrls(new Map());
          await loadDashboardData();
          setEditingImageId(null);
          setEditingImageType(null);
        } else {
          setError(response.message || 'Failed to update image.');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update image.');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleCommentEdit = (imageId: number, commentType: 'ai1' | 'increment') => {
    setEditingComment({ imageId, type: commentType });
  };

  const handleCommentSave = async (newComment: string) => {
    if (!editingComment || !dashboardData) return;

    try {
      setSaving(true);
      setError('');

      // Save scroll position before reloading
      const scrollPosition = window.scrollY;
      const elementId = `part-${editingComment.imageId}`;
      const element = document.getElementById(elementId);
      const elementOffset = element ? element.getBoundingClientRect().top + window.scrollY : scrollPosition;

      // Find the image to get current comments
      const image = dashboardData.images.find(img => img.id === editingComment.imageId);
      if (!image) {
        setError('Image not found.');
        setSaving(false);
        return;
      }

      // Update comments object (matching manual inspection pattern)
      const updatedComments = {
        original: image.comments.original || undefined,
        ai1: editingComment.type === 'ai1' ? newComment : image.comments.ai1 || undefined,
        ai2: image.comments.ai2 || undefined,
        increment: editingComment.type === 'increment' ? newComment : image.comments.increment || undefined
      };

      const response = await updateImageComments(editingComment.imageId, {
        comments: updatedComments
      });
      
      if (response.success) {
        // Reload dashboard data
        await loadDashboardData();
        setEditingComment(null);
        
        // Restore scroll position after a short delay to allow DOM to update
        setTimeout(() => {
          window.scrollTo({
            top: elementOffset,
            behavior: 'auto'
          });
        }, 100);
      } else {
        setError(response.message || 'Failed to update comment.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update comment.');
    } finally {
      setSaving(false);
    }
  };

  // Drawing functionality for green rectangles
  const toggleDrawing = (imageId: number) => {
    setDrawingEnabled(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(imageId) || false;
      newMap.set(imageId, !current);
      return newMap;
    });
  };

  const clearRectangles = (imageId: number) => {
    setDrawingRectangles(prev => {
      const newMap = new Map(prev);
      newMap.set(imageId, []);
      return newMap;
    });
    // Redraw canvas without rectangles
    const img = imageRefs.current.get(imageId);
    if (img) {
      setupCanvas(imageId, img);
    }
  };

  const startDrawing = (imageId: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled.get(imageId)) return;
    
    const canvas = canvasRefs.current.get(imageId);
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(prev => {
      const newMap = new Map(prev);
      newMap.set(imageId, true);
      return newMap;
    });

    setStartPos(prev => {
      const newMap = new Map(prev);
      newMap.set(imageId, { x, y });
      return newMap;
    });
  };

  const draw = (imageId: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRefs.current.get(imageId);
    const img = imageRefs.current.get(imageId);
    if (!canvas || !img || !isDrawing.get(imageId)) return;

    const start = startPos.get(imageId);
    if (!start) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw existing rectangles (scaled) - using base line width of 2.5 like manual inspection
    const existingRects = drawingRectangles.get(imageId) || [];
    const baseLineWidth = 2.5;
    existingRects.forEach(rect => {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = baseLineWidth * Math.max(scaleX, scaleY);
      ctx.strokeRect(rect.x * scaleX, rect.y * scaleY, rect.width * scaleX, rect.height * scaleY);
    });

    // Draw current rectangle (scaled) - using base line width of 2.5 like manual inspection
    const width = (currentX - start.x) * scaleX;
    const height = (currentY - start.y) * scaleY;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = baseLineWidth * Math.max(scaleX, scaleY);
    ctx.strokeRect(start.x * scaleX, start.y * scaleY, width, height);
  };

  const stopDrawing = (imageId: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.get(imageId)) return;

    const canvas = canvasRefs.current.get(imageId);
    const start = startPos.get(imageId);
    if (!canvas || !start) return;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const width = endX - start.x;
    const height = endY - start.y;

    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      const newRect = {
        x: Math.min(start.x, endX),
        y: Math.min(start.y, endY),
        width: Math.abs(width),
        height: Math.abs(height)
      };
      
      console.log('[ClientInspectionEditor] Rectangle drawn:', { imageId, rect: newRect });
      
      setDrawingRectangles(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(imageId) || [];
        const updated = [...existing, newRect];
        newMap.set(imageId, updated);
        console.log('[ClientInspectionEditor] Updated rectangles for image:', imageId, updated);
        return newMap;
      });

      // Redraw canvas with the new rectangle
      const img = imageRefs.current.get(imageId);
      if (img) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          setupCanvas(imageId, img);
        }, 10);
      }
    }

    setIsDrawing(prev => {
      const newMap = new Map(prev);
      newMap.set(imageId, false);
      return newMap;
    });
  };

  const setupCanvas = (imageId: number, img: HTMLImageElement) => {
    const canvas = canvasRefs.current.get(imageId);
    if (!canvas || !img) {
      console.warn('[ClientInspectionEditor] setupCanvas: canvas or img not found', { canvas: !!canvas, img: !!img });
      return;
    }

    // Set canvas size to match image natural size for better quality
    const displayRect = canvas.getBoundingClientRect();
    const naturalWidth = img.naturalWidth || img.width || displayRect.width;
    const naturalHeight = img.naturalHeight || img.height || displayRect.height;
    
    // Only update canvas size if it changed to avoid flickering
    if (canvas.width !== naturalWidth || canvas.height !== naturalHeight) {
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[ClientInspectionEditor] setupCanvas: failed to get context');
      return;
    }

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw existing rectangles (scale them to match canvas size)
    const existingRects = drawingRectangles.get(imageId) || [];
    console.log('[ClientInspectionEditor] setupCanvas: drawing rectangles', { imageId, count: existingRects.length, rects: existingRects });
    
    if (existingRects.length > 0 && displayRect.width > 0 && displayRect.height > 0) {
      const scaleX = canvas.width / displayRect.width;
      const scaleY = canvas.height / displayRect.height;
      
      console.log('[ClientInspectionEditor] setupCanvas: scale factors', { scaleX, scaleY, canvasWidth: canvas.width, canvasHeight: canvas.height, displayWidth: displayRect.width, displayHeight: displayRect.height });
      
      existingRects.forEach((rect, index) => {
        const x = rect.x * scaleX;
        const y = rect.y * scaleY;
        const width = rect.width * scaleX;
        const height = rect.height * scaleY;
        
        console.log(`[ClientInspectionEditor] setupCanvas: drawing rect ${index}`, { x, y, width, height });
        
        // Use base line width of 2.5 like manual inspection dashboard
        const baseLineWidth = 2.5;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = baseLineWidth * Math.max(scaleX, scaleY);
        ctx.strokeRect(x, y, width, height);
      });
      console.log('[ClientInspectionEditor] setupCanvas: all rectangles drawn');
    }
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
          <p className="text-white text-lg">Loading inspection editor...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !dashboardData) {
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
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Editor</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadDashboardData}
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

  if (!dashboardData) return null;

  const { inspection, images } = dashboardData;

  // Parse all AI comments and calculate summary stats
  const parsedImages = images.map((image, index) => {
    const parsed = parseAIComment(image.comments.ai1);
    const incrementComment = image.comments.increment || 'NA';
    const isLast4Parts = index >= images.length - 4;
    const processedComment = image.comments.ai1 || '';
    
    const hasFloorDirt = isLast4Parts && processedComment.toLowerCase().includes('floor dirt');
    const processedCommentLower = processedComment.toLowerCase();
    const hasTissueMissing = isLast4Parts && 
      (processedCommentLower.includes('tissue: no') || 
       processedCommentLower.match(/\btissue\s+no\b/i));
    const hasBottleMissing = isLast4Parts && 
      (processedCommentLower.includes('bottle: no') || 
       processedCommentLower.match(/\bbottle\s+no\b/i));
    
    const damageLower = parsed.damageDetection.toLowerCase();
    const hasDamage = damageLower !== 'no damage' && parsed.damageDetection !== 'NA' && parsed.damageDetection.trim() !== '';
    const hasDent = hasDamage && damageLower.includes('dent');
    const hasScratch = hasDamage && damageLower.includes('scratch');
    const hasGeneralDamage = hasDamage && !hasDent && !hasScratch;
    
    const isFirst10 = index < 10;
    const hasLogo = isFirst10 && parsed.logo.toLowerCase() === 'yes';
    const hasNoLogo = isFirst10 && parsed.logo.toLowerCase() === 'no';
    
    return {
      image,
      parsed,
      incrementComment,
      hasDamage,
      hasDent,
      hasScratch,
      hasGeneralDamage,
      hasLogo,
      hasNoLogo,
      hasIncrement: !!image.comments.increment,
      hasFloorDirt,
      hasTissueMissing,
      hasBottleMissing,
      isLast4Parts
    };
  });

  // Summary statistics
  const dentCount = parsedImages.filter(item => item.hasDent).length;
  const scratchCount = parsedImages.filter(item => item.hasScratch).length;
  const generalDamageCount = parsedImages.filter(item => item.hasGeneralDamage).length;
  const partsWithoutLogoCount = parsedImages.filter(item => item.hasNoLogo).length;
  const incrementCount = parsedImages.filter(item => item.hasIncrement).length;
  const floorDirtCount = parsedImages.filter(item => item.hasFloorDirt).length;
  const tissueMissingCount = parsedImages.filter(item => item.hasTissueMissing).length;
  const bottleMissingCount = parsedImages.filter(item => item.hasBottleMissing).length;
  
  const partsWithoutLogo = parsedImages.filter(item => item.hasNoLogo);
  const partsWithDent = parsedImages.filter(item => item.hasDent);
  const partsWithScratch = parsedImages.filter(item => item.hasScratch);
  const partsWithGeneralDamage = parsedImages.filter(item => item.hasGeneralDamage);
  const partsWithTissueMissing = parsedImages.filter(item => item.hasTissueMissing);
  const partsWithBottleMissing = parsedImages.filter(item => item.hasBottleMissing);

  const scrollToPart = (imageId: number) => {
    const element = document.getElementById(`part-${imageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToSummary = () => {
    const element = document.getElementById('summary-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleNavigation = (type: 'damage' | 'logo' | 'tissue' | 'bottle' | 'increment') => {
    setShowNavigation(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Comment options for last 4 images
  const lastImageCommentOptions = [
    'No damage',
    'Dent',
    'Scratch',
    'Kind of',
    'Bottle',
    'Clean',
    'Logo'
  ];

  // Comment options for AI1 (first 10 images)
  const ai1CommentOptions = [
    'Damage Detection: No damage Logo: No',
    'Damage Detection: No damage Logo: Yes',
    'Damage Detection: Dent Logo: No',
    'Damage Detection: Dent Logo: Yes',
    'Damage Detection: Scratch Logo: No',
    'Damage Detection: Scratch Logo: Yes',
    'Damage Detection: Damage Logo: No',
    'Damage Detection: Damage Logo: Yes'
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8 pb-3 sm:pb-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onBack}
              className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 active:bg-white/30 transition-all duration-200 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </motion.button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-white truncate flex items-center gap-2">
                <Edit2 className="w-5 h-5 sm:w-6 sm:h-6" />
                Inspection Editor
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm md:text-base truncate">{inspection.registrationNumber}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-3 sm:mx-4 md:mx-8 mb-4 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="px-3 sm:px-4 md:px-8 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
        {/* Inspection Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Inspection Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <Car className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
                <p className="text-gray-400 text-xs sm:text-sm">Registration</p>
              </div>
              <p className="text-white font-bold text-base sm:text-lg truncate">{inspection.registrationNumber}</p>
            </div>
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                <p className="text-gray-400 text-xs sm:text-sm">Client</p>
              </div>
              <p className="text-white font-bold text-base sm:text-lg">{inspection.clientDisplayName || inspection.clientName || 'N/A'}</p>
            </div>
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                <p className="text-gray-400 text-xs sm:text-sm">Date</p>
              </div>
              <p className="text-white font-bold text-base sm:text-lg">{formatDateOnly(inspection.createdAt)}</p>
            </div>
          </div>
        </motion.div>

        {/* Summary Statistics - Same as InspectionDashboard */}
        <motion.div
          id="summary-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Summary</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 border-t border-b border-white/10 py-4 sm:py-6">
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Damages</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Pre-existing Damages</p>
                  <p className="text-red-400 font-bold text-2xl sm:text-3xl">
                    {dentCount + scratchCount + generalDamageCount}
                  </p>
                  {(dentCount > 0 || scratchCount > 0 || generalDamageCount > 0) && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleNavigation('damage')}
                      className="mt-2 text-red-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
                
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">New Damages</p>
                  <p className="text-yellow-400 font-bold text-2xl sm:text-3xl">{incrementCount}</p>
                  {incrementCount > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleNavigation('increment')}
                      className="mt-2 text-yellow-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Other Items</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Parts without Logo</p>
                  <p className="text-blue-400 font-bold text-2xl sm:text-3xl">{partsWithoutLogoCount}</p>
                  {partsWithoutLogoCount > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleNavigation('logo')}
                      className="mt-2 text-blue-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
                
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Tissue Missing</p>
                  <p className="text-cyan-400 font-bold text-2xl sm:text-3xl">{tissueMissingCount}</p>
                  {tissueMissingCount > 0 && partsWithTissueMissing.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => scrollToPart(partsWithTissueMissing[0].image.id)}
                      className="mt-2 text-cyan-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
                
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Bottle Missing</p>
                  <p className="text-purple-400 font-bold text-2xl sm:text-3xl">{bottleMissingCount}</p>
                  {bottleMissingCount > 0 && partsWithBottleMissing.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => scrollToPart(partsWithBottleMissing[0].image.id)}
                      className="mt-2 text-purple-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
                
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Floor Dirt</p>
                  <p className="text-orange-400 font-bold text-2xl sm:text-3xl">{floorDirtCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation sections - same as InspectionDashboard */}
          {showNavigation.damage && (partsWithDent.length > 0 || partsWithScratch.length > 0 || partsWithGeneralDamage.length > 0) && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">Click to view damage parts:</h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {partsWithDent.map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-blue-500/20 active:bg-blue-500/30 border border-blue-500/50 text-blue-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-blue-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">DENT</span>
                      </motion.button>
                    );
                  })}
                  {partsWithScratch.map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-blue-500/20 active:bg-blue-500/30 border border-blue-500/50 text-blue-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-blue-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">SCRATCH</span>
                      </motion.button>
                    );
                  })}
                  {partsWithGeneralDamage.map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-red-500/20 active:bg-red-500/30 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-red-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">DAMAGE</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
          
          {showNavigation.logo && partsWithoutLogo.length > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">Click to view parts without logo:</h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {partsWithoutLogo.map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-blue-500/20 active:bg-blue-500/30 border border-blue-500/50 text-blue-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-blue-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">NO LOGO</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {showNavigation.increment && incrementCount > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">Click to view parts with new damages:</h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {parsedImages.filter(item => item.hasIncrement).map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-yellow-500/20 active:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-yellow-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">NEW DAMAGE</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>

        {/* Parts Sections with Editing Capabilities */}
        <div className="space-y-6">
          {parsedImages.map((item, index) => {
            const { image, parsed: parsedComment, incrementComment, isLast4Parts } = item;
            const partName = image.imageType.replace(/_/g, ' ').toUpperCase();
            const originalImageUrl = imageUrls.get(`original-${image.id}`) || null;
            const processedImageUrl = imageUrls.get(`processed-${image.id}`) || null;
            const incrementImageUrl = imageUrls.get(`increment-${image.id}`) || null;
            const previousAiProcessedImageUrl = imageUrls.get(`previous-ai-processed-${image.id}`) || null;

            const isFirst10Parts = index < 10;

            return (
              <motion.div
                key={image.id}
                id={`part-${image.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20"
              >
                {/* Part Header */}
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4 break-words">{partName}</h2>
                  
                  {/* Badges for first 10 parts */}
                  {isFirst10Parts && (
                    <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className={`${
                        (() => {
                          const damageLower = parsedComment.damageDetection.toLowerCase();
                          const isNoDamage = damageLower === 'no damage' || damageLower === 'na' || damageLower.trim() === '';
                          const isDentOrScratch = item.hasDent || item.hasScratch;
                          return isNoDamage || isDentOrScratch
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : 'bg-red-500/20 border-red-500/50 text-red-400';
                        })()
                      } border px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm break-words flex items-center gap-2`}>
                        <span>Major Dent/Damage: {parsedComment.damageDetection}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleCommentEdit(image.id, 'ai1')}
                          className="text-white hover:text-blue-300 transition-colors"
                        >
                          <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </motion.button>
                      </div>
                      <div className={`${parsedComment.logo === 'yes' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-gray-500/20 border-gray-500/50 text-gray-400'} border px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm`}>
                        Logo: {parsedComment.logo.toUpperCase()}
                      </div>
                      <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm break-words flex items-center gap-2">
                        <span>New dent/damage: {incrementComment}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleCommentEdit(image.id, 'increment')}
                          className="text-white hover:text-yellow-300 transition-colors"
                          title={image.comments.increment ? "Edit Increment Comment" : "Add Increment Comment"}
                        >
                          <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* For last 4 parts, show processed comment and increment comment */}
                  {isLast4Parts && (
                    <>
                      {image.comments.ai1 && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-2 flex items-center justify-between">
                          <p className="text-white text-xs sm:text-sm font-semibold break-words">{image.comments.ai1}</p>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleCommentEdit(image.id, 'ai1')}
                            className="text-white hover:text-blue-300 transition-colors ml-2 flex-shrink-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      )}
                      <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm break-words flex items-center justify-between mb-3 sm:mb-4">
                        <span>New dent/damage: {incrementComment}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleCommentEdit(image.id, 'increment')}
                          className="text-white hover:text-yellow-300 transition-colors ml-2 flex-shrink-0"
                          title={image.comments.increment ? "Edit Increment Comment" : "Add Increment Comment"}
                        >
                          <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </motion.button>
                      </div>
                    </>
                  )}
                </div>

                {/* Four Images Grid - All Equal Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* 1. Original Image with Drawing Canvas */}
                  {originalImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <h3 className="text-white font-semibold text-xs sm:text-sm">Today's original Image</h3>
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleDrawing(image.id)}
                            className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-lg font-semibold transition-colors ${
                              drawingEnabled.get(image.id)
                                ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}
                            title={drawingEnabled.get(image.id) ? 'Disable Drawing' : 'Enable Drawing'}
                          >
                            {drawingEnabled.get(image.id) ? 'Drawing ON' : 'Draw'}
                          </motion.button>
                          {(drawingRectangles.get(image.id)?.length || 0) > 0 && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => clearRectangles(image.id)}
                              className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-lg font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                              title="Clear Rectangles"
                            >
                              Clear
                            </motion.button>
                          )}
                        </div>
                      </div>
                      <div className="relative rounded-lg overflow-hidden bg-black/20" style={{ minHeight: '400px' }}>
                        <img
                          ref={(el) => {
                            if (el) {
                              imageRefs.current.set(image.id, el);
                              el.onload = () => setupCanvas(image.id, el);
                            }
                          }}
                          src={originalImageUrl}
                          alt="Original"
                          className="w-full h-full object-contain"
                          style={{ minHeight: '400px', display: 'none' }}
                        />
                        <canvas
                          ref={(el) => {
                            if (el) canvasRefs.current.set(image.id, el);
                          }}
                          onMouseDown={(e) => startDrawing(image.id, e)}
                          onMouseMove={(e) => draw(image.id, e)}
                          onMouseUp={(e) => stopDrawing(image.id, e)}
                          onMouseLeave={() => {
                            setIsDrawing(prev => {
                              const newMap = new Map(prev);
                              newMap.set(image.id, false);
                              return newMap;
                            });
                          }}
                          className={`w-full h-full object-contain ${drawingEnabled.get(image.id) ? 'cursor-crosshair' : 'cursor-default'}`}
                          style={{ minHeight: '400px' }}
                        />
                        <button
                          onClick={() => setSelectedImage({ url: originalImageUrl, alt: `Original - ${partName}` })}
                          className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                        >
                          <Maximize2 className="w-4 h-4 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Previous Day AI Processed Image */}
                  {previousAiProcessedImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Previous Day AI Processed</h3>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '400px' }}>
                        <img
                          src={previousAiProcessedImageUrl}
                          alt="Previous Day AI Processed"
                          className="w-full h-full object-contain touch-manipulation"
                          style={{ minHeight: '400px' }}
                          onClick={() => setSelectedImage({ url: previousAiProcessedImageUrl, alt: `Previous Day AI Processed - ${partName}` })}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <button
                          onClick={() => setSelectedImage({ url: previousAiProcessedImageUrl, alt: `Previous Day AI Processed - ${partName}` })}
                          className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                        >
                          <Maximize2 className="w-4 h-4 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  {!previousAiProcessedImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Previous Day AI Processed</h3>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 border-2 border-dashed border-white/20 flex items-center justify-center" style={{ minHeight: '400px' }}>
                        <div className="text-center p-4">
                          <p className="text-gray-400 text-sm">No previous day AI processed image</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Processed Image with Replace Button */}
                  {processedImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <h3 className="text-white font-semibold text-xs sm:text-sm">Processed Image</h3>
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleReplaceWithCanvas(image.id, 'aiProcessed')}
                            disabled={uploading}
                            className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                            title="Replace with Original Image (with rectangles if drawn)"
                          >
                            {uploading && editingImageId === image.id && editingImageType === 'aiProcessed' ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <span className="text-xs sm:text-sm font-semibold">Replace</span>
                            )}
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleImageReplace(image.id, 'aiProcessed')}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Upload Custom Image"
                          >
                            <Upload className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '400px' }}>
                        <img
                          src={processedImageUrl}
                          alt="Processed"
                          className="w-full h-full object-contain touch-manipulation"
                          style={{ minHeight: '400px' }}
                          onClick={() => setSelectedImage({ url: processedImageUrl, alt: `Processed - ${partName}` })}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <button
                          onClick={() => setSelectedImage({ url: processedImageUrl, alt: `Processed - ${partName}` })}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                      {editingImageId === image.id && editingImageType === 'aiProcessed' && (
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileSelect}
                            className="hidden"
                            id={`ai-processed-${image.id}`}
                          />
                          <label
                            htmlFor={`ai-processed-${image.id}`}
                            className="block w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 text-xs sm:text-sm font-semibold py-2 px-3 rounded-lg text-center cursor-pointer transition-colors"
                          >
                            {uploading ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader className="w-4 h-4 animate-spin" />
                                Uploading...
                              </span>
                            ) : (
                              'Select Image to Replace'
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Incremental Image with Replace Button - Always show container */}
                  <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <h3 className="text-white font-semibold text-xs sm:text-sm">Incremental Image</h3>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleReplaceWithCanvas(image.id, 'increment')}
                          disabled={uploading || !originalImageUrl}
                          className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                          title="Replace with Original Image (with rectangles if drawn)"
                        >
                          {uploading && editingImageId === image.id && editingImageType === 'increment' ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <span className="text-xs sm:text-sm font-semibold">Replace</span>
                          )}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleImageReplace(image.id, 'increment')}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors"
                          title={incrementImageUrl ? "Upload Custom Image" : "Add Incremental Image"}
                        >
                          <Upload className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                    {incrementImageUrl ? (
                      <>
                        <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group" style={{ minHeight: '400px' }}>
                          <img
                            src={incrementImageUrl}
                            alt="Incremental"
                            className="w-full h-full object-contain"
                            style={{ minHeight: '400px' }}
                            onClick={() => setSelectedImage({ url: incrementImageUrl, alt: `Incremental - ${partName}` })}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <button
                            onClick={() => setSelectedImage({ url: incrementImageUrl, alt: `Incremental - ${partName}` })}
                            className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                        {editingImageId === image.id && editingImageType === 'increment' && (
                          <div className="mt-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileSelect}
                              className="hidden"
                              id={`increment-${image.id}`}
                            />
                            <label
                              htmlFor={`increment-${image.id}`}
                              className="block w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 text-xs sm:text-sm font-semibold py-2 px-3 rounded-lg text-center cursor-pointer transition-colors"
                            >
                              {uploading ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Loader className="w-4 h-4 animate-spin" />
                                  Uploading...
                                </span>
                              ) : (
                                'Select Image to Replace'
                              )}
                            </label>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="relative rounded-lg overflow-hidden bg-black/20 border-2 border-dashed border-white/20 flex items-center justify-center" style={{ minHeight: '400px' }}>
                        <div className="text-center p-4">
                          <p className="text-gray-400 text-sm mb-2">No incremental image</p>
                          <p className="text-gray-500 text-xs">Click upload to add one</p>
                        </div>
                        {editingImageId === image.id && editingImageType === 'increment' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileSelect}
                              className="hidden"
                              id={`increment-${image.id}`}
                            />
                            <label
                              htmlFor={`increment-${image.id}`}
                              className="block w-full h-full"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage.url}
          alt={selectedImage.alt}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Comment Edit Modal */}
      <AnimatePresence>
        {editingComment && (() => {
          const imageIndex = parsedImages.findIndex(p => p.image.id === editingComment.imageId);
          const isFirst10Parts = imageIndex < 10;
          const currentImage = parsedImages.find(p => p.image.id === editingComment.imageId);
          
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setEditingComment(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 max-w-md w-full p-6"
              >
                <h3 className="text-xl font-bold text-white mb-4">
                  Edit {editingComment.type === 'ai1' ? 'AI1' : 'Increment'} Comment
                </h3>
                
                {editingComment.type === 'ai1' && isFirst10Parts ? (
                  <select
                    value={currentImage?.image.comments.ai1 || ''}
                    onChange={(e) => {
                      // Auto-save on change for dropdown
                      handleCommentSave(e.target.value);
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-lg text-white p-3 mb-4 focus:outline-none focus:border-blue-400"
                  >
                    {ai1CommentOptions.map((option) => (
                      <option key={option} value={option} className="bg-gray-800">
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={
                      editingComment.type === 'ai1'
                        ? currentImage?.image.comments.ai1 || ''
                        : currentImage?.image.comments.increment || ''
                    }
                    onChange={(e) => {
                      // Auto-save on change for dropdown
                      handleCommentSave(e.target.value);
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-lg text-white p-3 mb-4 focus:outline-none focus:border-blue-400"
                  >
                    {lastImageCommentOptions.map((option) => (
                      <option key={option} value={option} className="bg-gray-800">
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditingComment(null)}
                    disabled={saving}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      'Close'
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditingComment(null)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Floating Back to Summary Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={scrollToSummary}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-gradient-to-r from-blue-500 to-purple-600 active:from-blue-600 active:to-purple-700 text-white font-bold py-3 sm:py-3 px-4 sm:px-6 rounded-full shadow-2xl flex items-center gap-2 cursor-pointer touch-manipulation min-h-[48px] text-sm sm:text-base"
      >
        <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">Back to Summary</span>
        <span className="sm:hidden">Summary</span>
      </motion.button>
    </div>
  );
};

export default ClientInspectionEditor;

