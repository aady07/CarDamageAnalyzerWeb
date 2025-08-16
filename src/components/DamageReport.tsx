import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Car, 
  Download, 
  Share2, 
  CheckCircle, 
  AlertCircle,
  Maximize2,
  X,
  Wrench,
  Paintbrush,
  Hammer
} from 'lucide-react';

// Import images properly for production
import damagePhoto1 from '../assets/images/1.jpeg';
import damagePhoto2 from '../assets/images/2.jpeg';

interface DamageReportProps {
  onBack: () => void;
}

const DAMAGE_PHOTOS = [
  damagePhoto1,
  damagePhoto2,
];

const ESTIMATE_BREAKDOWN = [
  { label: 'Outer Door', price: 8000, icon: Wrench },
  { label: 'Paint', price: 3000, icon: Paintbrush },
  { label: 'Labor', price: 1000, icon: Hammer },
];

const DamageReport: React.FC<DamageReportProps> = ({ onBack }) => {
  const [progress, setProgress] = useState(0);
  const [verified, setVerified] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [estimate, setEstimate] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Animate progress and verification
  useEffect(() => {
    const progressTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setVerified(true);
            setTimeout(() => setShowCheck(true), 300);
            clearInterval(interval);
            return 100;
          }
          return prev + 2;
        });
      }, 40);
    }, 500);

    // Animate estimate count-up
    const estimateTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setEstimate(prev => {
          if (prev >= 12000) {
            clearInterval(interval);
            return 12000;
          }
          return prev + 120;
        });
      }, 15);
    }, 1000);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(estimateTimer);
    };
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Car Damage Report',
          text: 'Car Damage Report: Outer Door, Rs 12,000. Download your report now!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText('Car Damage Report: Outer Door, Rs 12,000. Download your report now!');
      alert('Report link copied to clipboard!');
    }
  };

  const handleDownload = () => {
    // In a real app, this would generate and download a PDF report
    const link = document.createElement('a');
    link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent('Car Damage Report\n\nOuter Door Damage\nEstimated Cost: Rs 12,000\n\nThis is a sample report.');
    link.download = 'car-damage-report.txt';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-6 pt-12"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="text-xl font-bold text-white">Damage Assessment</h1>
        <div className="w-10 h-10" />
      </motion.div>

      <div className="px-6 pb-20">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-effect rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center">
            <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mr-4">
              <Car className="w-7 h-7 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">Vehicle Inspection</h2>
              <p className="text-gray-400 text-sm">Analysis Complete</p>
            </div>
            {showCheck && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30"
              >
                <CheckCircle className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-green-400 text-xs font-semibold">Verified</span>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Progress Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <h3 className="text-white font-bold mb-4">Assessment Progress</h3>
          <div className="glass-effect rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-400 text-sm mb-2">Verification Status</p>
                <p className="text-3xl font-bold text-blue-500">{Math.round(progress)}%</p>
              </div>
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="3"
                    strokeDasharray={`${progress}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                {showCheck && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Damage Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6"
        >
          <div className="flex">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center mr-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-bold mb-2">Damage Identified</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Front right door panel shows visible impact damage with paint scratches and minor denting.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Photo Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <h3 className="text-white font-bold mb-4">Damage Documentation</h3>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DAMAGE_PHOTOS.map((photo, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPhoto(index)}
                className="relative w-80 h-60 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer"
              >
                <img
                  src={photo}
                  alt={`Damage photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <span className="text-white font-semibold">Image {index + 1}</span>
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Estimate Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <h3 className="text-white font-bold mb-4">Repair Estimate</h3>
          <div className="glass-effect rounded-2xl p-6">
            {ESTIMATE_BREAKDOWN.map((item, index) => (
              <div key={index} className="flex items-center justify-between mb-4 last:mb-0">
                <div className="flex items-center">
                  <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                    <item.icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-white font-semibold">{item.label}</span>
                </div>
                <span className="text-gray-300 font-bold">₹{item.price.toLocaleString()}</span>
              </div>
            ))}
            
            <div className="border-t border-white/10 my-4" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center mr-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-lg">Total Amount</span>
              </div>
              <span className="text-green-400 font-bold text-2xl">
                ₹{estimate.toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownload}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3"
          >
            <Download className="w-5 h-5" />
            Download Report
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShare}
            className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3"
          >
            <Share2 className="w-5 h-5" />
            Share Report
          </motion.button>
        </motion.div>
      </div>

      {/* Photo Modal */}
      <AnimatePresence>
        {selectedPhoto !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-4xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={DAMAGE_PHOTOS[selectedPhoto]}
                alt={`Damage photo ${selectedPhoto + 1}`}
                className="w-full h-auto rounded-2xl"
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DamageReport;
