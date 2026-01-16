import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Car,
  Maximize2,
  X
} from 'lucide-react';

interface SnapETestDashboardProps {
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

// Format date to show only date (no time)
const formatDateOnly = (date: Date): string => {
  return date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
};

// Hardcoded parts data - only first 10 parts
const PARTS = [
  { imageType: 'front', imageFile: 'f.jpg' },
  { imageType: 'right_front_fender', imageFile: 'rff.jpg' },
  { imageType: 'right_front_door', imageFile: 'rfd.jpg' },
  { imageType: 'right_rear_door', imageFile: 'rrd.jpg' },
  { imageType: 'right_rear_fender', imageFile: 'rrf.jpg' },
  { imageType: 'rear', imageFile: 'r.jpg' },
  { imageType: 'left_rear_fender', imageFile: 'lrf.jpg' },
  { imageType: 'left_rear_door', imageFile: 'lrd.jpg' },
  { imageType: 'left_front_door', imageFile: 'lfd.jpg' },
  { imageType: 'left_front_fender', imageFile: 'lff.jpg' },
];

const SnapETestDashboard: React.FC<SnapETestDashboardProps> = ({ onBack }) => {
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);
  const inspectionId = 39;
  const clientName = 'Snap-E cabs';
  const todayDate = new Date();

  const getImagePath = (fileName: string): string => {
    return `/${fileName}`;
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
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <p className="text-gray-400 text-xs sm:text-sm md:text-base truncate">DL52GD7618</p>
                <span className="text-gray-500 text-xs sm:text-sm">•</span>
                <p className="text-gray-400 text-xs sm:text-sm md:text-base">Inspection #{inspectionId}</p>
              </div>
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
              <p className="text-white font-bold text-base sm:text-lg truncate">DL52GD7618</p>
            </div>
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                <p className="text-gray-400 text-xs sm:text-sm">Client</p>
              </div>
              <p className="text-white font-bold text-base sm:text-lg">{clientName}</p>
            </div>
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                <p className="text-gray-400 text-xs sm:text-sm">Date</p>
              </div>
              <p className="text-white font-bold text-base sm:text-lg">{formatDateOnly(todayDate)}</p>
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
            {/* Left Side: Damages */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Damages</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Pre-existing Damages */}
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">Pre-existing Damages</p>
                  <p className="text-red-400 font-bold text-2xl sm:text-3xl">0</p>
                </div>
                
                {/* New Damages */}
                <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <p className="text-gray-400 text-xs sm:text-sm mb-2">New Damages</p>
                  <p className="text-yellow-400 font-bold text-2xl sm:text-3xl">0</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Parts Sections */}
        <div className="space-y-6">
          {PARTS.map((part, index) => {
            const partName = part.imageType.replace(/_/g, ' ').toUpperCase();
            const imageUrl = getImagePath(part.imageFile);

            return (
              <motion.div
                key={part.imageType}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/20"
              >
                {/* Part Header */}
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4 break-words">{partName}</h2>
                  
                  {/* Damage Badge - hardcoded as no damage */}
                  <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="bg-blue-500/20 border-blue-500/50 text-blue-400 border px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm break-words">
                      Major Dent/Damage: No damage
                    </div>
                  </div>
                </div>

                {/* Three Images Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* 1. Today's Original Image */}
                  <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Today's original Image</h3>
                    <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '200px' }}>
                      <img
                        src={imageUrl}
                        alt="Original"
                        className="w-full h-full object-contain touch-manipulation"
                        style={{ minHeight: '200px' }}
                        onClick={() => setSelectedImage({ url: imageUrl, alt: `Original - ${partName}` })}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <button
                        onClick={() => setSelectedImage({ url: imageUrl, alt: `Original - ${partName}` })}
                        className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                      >
                        <Maximize2 className="w-4 h-4 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 2. Processed Image */}
                  <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Processed Image</h3>
                    <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '200px' }}>
                      <img
                        src={imageUrl}
                        alt="Processed"
                        className="w-full h-full object-contain touch-manipulation"
                        style={{ minHeight: '200px' }}
                        onClick={() => setSelectedImage({ url: imageUrl, alt: `Processed - ${partName}` })}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <button
                        onClick={() => setSelectedImage({ url: imageUrl, alt: `Processed - ${partName}` })}
                        className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                      >
                        <Maximize2 className="w-4 h-4 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 3. Previous Image */}
                  <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <h3 className="text-white font-semibold text-xs sm:text-sm">Original Previous Image</h3>
                      <span className="text-gray-400 text-xs sm:text-sm">
                        {formatDateOnly(todayDate)}
                      </span>
                    </div>
                    <div className="relative rounded-lg overflow-hidden bg-black/20 cursor-pointer group active:opacity-90" style={{ minHeight: '200px' }}>
                      <img
                        src={imageUrl}
                        alt="Previous"
                        className="w-full h-full object-contain touch-manipulation"
                        style={{ minHeight: '200px' }}
                        onClick={() => setSelectedImage({ url: imageUrl, alt: `Previous - ${partName}` })}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <button
                        onClick={() => setSelectedImage({ url: imageUrl, alt: `Previous - ${partName}` })}
                        className="absolute top-2 right-2 w-9 h-9 sm:w-8 sm:h-8 bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                      >
                        <Maximize2 className="w-4 h-4 sm:w-4 sm:h-4" />
                      </button>
                    </div>
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
    </div>
  );
};

export default SnapETestDashboard;
