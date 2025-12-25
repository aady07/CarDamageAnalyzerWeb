import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Car,
  Maximize2,
  X,
  ArrowUp
} from 'lucide-react';
import {
  getDashboardData,
  checkInspectionReadiness,
  fetchImageBlob,
  DashboardData
} from '../services/api/inspectionDashboardService';

interface InspectionDashboardProps {
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
// Format: "Damage Detection: No damage Logo: No"
const parseAIComment = (comment: string | undefined): { damageDetection: string; logo: string } => {
  const result = {
    damageDetection: 'NA',
    logo: 'No'
  };

  if (!comment) return result;

  // Extract "Damage Detection: {value}" - everything after "Damage Detection:" until "Logo:"
  const damageMatch = comment.match(/Damage Detection:\s*([^L]+?)(?:\s+Logo:|$)/i);
  if (damageMatch && damageMatch[1]) {
    result.damageDetection = damageMatch[1].trim();
  }

  // Extract "Logo: {yes/no}"
  const logoMatch = comment.match(/Logo:\s*(yes|no)/i);
  if (logoMatch && logoMatch[1]) {
    result.logo = logoMatch[1].trim();
  }

  return result;
};

const InspectionDashboard: React.FC<InspectionDashboardProps> = ({ inspectionId, onBack }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);
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

  useEffect(() => {
    // Clean up old URLs if inspection ID changed
    if (previousInspectionIdRef.current !== null && previousInspectionIdRef.current !== inspectionId) {
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current.clear();
      setImageUrls(new Map());
    }
    previousInspectionIdRef.current = inspectionId;
    
    loadDashboardData();
  }, [inspectionId]);

  // Cleanup: Revoke object URLs on unmount
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

      // First check if ready
      const readiness = await checkInspectionReadiness(inspectionId);
      if (!readiness.ready) {
        setError(readiness.message || 'Inspection is not ready for dashboard display.');
        setLoading(false);
        return;
      }

      // Load dashboard data
      const data = await getDashboardData(inspectionId);
      setDashboardData(data);

      // Load all images as blobs and create object URLs
      const urlMap = new Map<string, string>();
      const imagePromises: Promise<void>[] = [];

      data.images.forEach((image) => {
        // Original image
        if (image.images.originalImageStreamUrl) {
          imagePromises.push(
            fetchImageBlob(image.images.originalImageStreamUrl)
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
            fetchImageBlob(image.images.previousImageStreamUrl)
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
            fetchImageBlob(image.images.aiProcessedImageStreamUrl)
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
            fetchImageBlob(image.images.incrementImageStreamUrl)
              .then(blob => {
                if (blob) {
                  urlMap.set(`increment-${image.id}`, URL.createObjectURL(blob));
                }
              })
              .catch(() => {})
          );
        }
      });

      await Promise.all(imagePromises);
      
      // Update ref and state with new URLs
      imageUrlsRef.current = urlMap;
      setImageUrls(new Map(urlMap));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
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
          <p className="text-white text-lg">Loading inspection dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
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
    
    // Extract floor dirt, tissue, and bottle from last 4 parts processed comments
    const hasFloorDirt = isLast4Parts && processedComment.toLowerCase().includes('floor dirt');
    const hasTissue = isLast4Parts && processedComment.toLowerCase().includes('tissue');
    const hasBottle = isLast4Parts && processedComment.toLowerCase().includes('bottle');
    
    // Parse damage type from damageDetection
    const damageLower = parsed.damageDetection.toLowerCase();
    const hasDamage = damageLower !== 'no damage' && parsed.damageDetection !== 'NA' && parsed.damageDetection.trim() !== '';
    const hasDent = hasDamage && damageLower.includes('dent');
    const hasScratch = hasDamage && damageLower.includes('scratch');
    const hasGeneralDamage = hasDamage && !hasDent && !hasScratch;
    
    // Logo check only for first 10 images
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
      hasTissue,
      hasBottle,
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
  const tissueCount = parsedImages.filter(item => item.hasTissue).length;
  const bottleCount = parsedImages.filter(item => item.hasBottle).length;
  
  // Get parts without logo for navigation
  const partsWithoutLogo = parsedImages.filter(item => item.hasNoLogo);
  // Get parts with damage (dent, scratch, or general damage) for navigation
  const partsWithDent = parsedImages.filter(item => item.hasDent);
  const partsWithScratch = parsedImages.filter(item => item.hasScratch);
  const partsWithGeneralDamage = parsedImages.filter(item => item.hasGeneralDamage);


  // Scroll to part function
  const scrollToPart = (imageId: number) => {
    const element = document.getElementById(`part-${imageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Scroll to summary
  const scrollToSummary = () => {
    const element = document.getElementById('summary-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Toggle navigation section
  const toggleNavigation = (type: 'damage' | 'logo' | 'tissue' | 'bottle' | 'increment') => {
    setShowNavigation(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

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
              <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-white truncate">Inspection Dashboard</h1>
              <p className="text-gray-400 text-xs sm:text-sm md:text-base truncate">{inspection.registrationNumber}</p>
            </div>
          </div>
        </div>
      </div>

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
              <p className="text-white font-bold text-base sm:text-lg">Refex Mobility</p>
            </div>
          </div>
        </motion.div>

        {/* Summary Statistics */}
        <motion.div
          id="summary-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Summary</h2>
          
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 border-t border-b border-white/10 py-4 sm:py-6">
            {/* Left Side: New Damages and Pre-existing Damages */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Damages</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Pre-existing Damages */}
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
                
                {/* New Damages */}
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

            {/* Right Side: Other Items */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Other Items</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Parts without Logo */}
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
                
                {/* Tissue */}
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Tissue</p>
                  <p className="text-cyan-400 font-bold text-2xl sm:text-3xl">{tissueCount}</p>
                  {tissueCount > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleNavigation('tissue')}
                      className="mt-2 text-cyan-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
                
                {/* Bottle */}
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Bottle</p>
                  <p className="text-purple-400 font-bold text-2xl sm:text-3xl">{bottleCount}</p>
                  {bottleCount > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleNavigation('bottle')}
                      className="mt-2 text-purple-400 text-xs sm:text-sm font-semibold hover:underline cursor-pointer active:opacity-70 py-1"
                    >
                      Click to view →
                    </motion.button>
                  )}
                </div>
                
                {/* Floor Dirt */}
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Floor Dirt</p>
                  <p className="text-orange-400 font-bold text-2xl sm:text-3xl">{floorDirtCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Damage Parts Navigation - Hidden by default, shown when clicked */}
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
                        className="bg-red-500/20 active:bg-red-500/30 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-red-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">DENT</span>
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
                        className="bg-red-500/20 active:bg-red-500/30 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-red-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">SCRATCH</span>
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
          
          {/* Parts without Logo Navigation - Hidden by default, shown when clicked */}
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

          {/* Tissue Navigation - Hidden by default, shown when clicked */}
          {showNavigation.tissue && tissueCount > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">Click to view parts with tissue:</h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {parsedImages.filter(item => item.hasTissue).map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-cyan-500/20 active:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-cyan-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">TISSUE</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Bottle Navigation - Hidden by default, shown when clicked */}
          {showNavigation.bottle && bottleCount > 0 && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <h3 className="text-base sm:text-lg font-bold text-white mb-3">Click to view parts with bottle:</h3>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {parsedImages.filter(item => item.hasBottle).map((item) => {
                    const partName = item.image.imageType.replace(/_/g, ' ').toUpperCase();
                    return (
                      <motion.button
                        key={item.image.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => scrollToPart(item.image.id)}
                        className="bg-purple-500/20 active:bg-purple-500/30 border border-purple-500/50 text-purple-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <span className="truncate max-w-[120px] sm:max-w-none">{partName}</span>
                        <span className="bg-purple-500/30 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs flex-shrink-0">BOTTLE</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* New Damages Navigation - Hidden by default, shown when clicked */}
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

        {/* Parts Sections */}
        <div className="space-y-6">
          {parsedImages.map((item, index) => {
            const { image, parsed: parsedComment, incrementComment, isLast4Parts } = item;
            const partName = image.imageType.replace(/_/g, ' ').toUpperCase();
            const originalImageUrl = imageUrls.get(`original-${image.id}`) || null;
            const previousImageUrl = imageUrls.get(`previous-${image.id}`) || null;
            const processedImageUrl = imageUrls.get(`processed-${image.id}`) || null;
            const incrementImageUrl = imageUrls.get(`increment-${image.id}`) || null;

            // First 10 parts show full badges, last 4 show only processed comment
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
                      {/* Major Dent/Damage */}
                      <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm break-words">
                        Major Dent/Damage: {parsedComment.damageDetection}
                      </div>
                      {/* Logo */}
                      <div className={`${parsedComment.logo === 'yes' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-gray-500/20 border-gray-500/50 text-gray-400'} border px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm`}>
                        Logo: {parsedComment.logo.toUpperCase()}
                      </div>
                      {/* New dent/damage (increment comment) */}
                      <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm break-words">
                        New dent/damage: {incrementComment}
                      </div>
                    </div>
                  )}

                  {/* For last 4 parts, show only processed comment */}
                  {isLast4Parts && image.comments.ai1 && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3 sm:mb-4">
                      <p className="text-white text-xs sm:text-sm font-semibold break-words">{image.comments.ai1}</p>
                    </div>
                  )}
                </div>

                {/* Four Images Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* 1. Original Image */}
                  {originalImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Original Image</h3>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '200px' }}>
                        <img
                          src={originalImageUrl}
                          alt="Original"
                          className="w-full h-full object-contain touch-manipulation"
                          style={{ minHeight: '200px' }}
                          onClick={() => setSelectedImage({ url: originalImageUrl, alt: `Original - ${partName}` })}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
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

                  {/* 2. Previous Day Image */}
                  {previousImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Previous Day Image</h3>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '200px' }}>
                        <img
                          src={previousImageUrl}
                          alt="Previous"
                          className="w-full h-full object-contain touch-manipulation"
                          style={{ minHeight: '200px' }}
                          onClick={() => setSelectedImage({ url: previousImageUrl, alt: `Previous Day - ${partName}` })}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <button
                          onClick={() => setSelectedImage({ url: previousImageUrl, alt: `Previous Day - ${partName}` })}
                          className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                        >
                          <Maximize2 className="w-4 h-4 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. Processed Image */}
                  {processedImageUrl && (
                    <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Processed Image</h3>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '200px' }}>
                        <img
                          src={processedImageUrl}
                          alt="Processed"
                          className="w-full h-full object-contain touch-manipulation"
                          style={{ minHeight: '200px' }}
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
                    </div>
                  )}

                  {/* 4. Incremental Image */}
                  {incrementImageUrl && (
                    <div className="bg-white/5 rounded-xl p-4">
                      <h3 className="text-white font-semibold mb-3 text-sm">Incremental Image</h3>
                      <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group" style={{ minHeight: '300px' }}>
                        <img
                          src={incrementImageUrl}
                          alt="Incremental"
                          className="w-full h-full object-contain"
                          style={{ minHeight: '300px' }}
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
                    </div>
                  )}
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

export default InspectionDashboard;

