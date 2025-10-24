import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { generateAndDownloadReport } from '../utils/reportGenerator';
import { fetchModelImageBlob, fetchClaimResults, ClaimResults } from '../services/api/claimService';

// Helpers to parse price ranges and map confidence
function parsePriceRangeToMean(price: string | number): number {
  if (typeof price === 'number') return price || 0;
  if (!price) return 0;
  const cleaned = String(price).replace(/[^0-9\-]/g, '');
  const parts = cleaned
    .split('-')
    .map((v) => parseInt(v, 10))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return 0;
  if (parts.length === 1) return parts[0];
  const [min, max] = [Math.min(parts[0], parts[1]), Math.max(parts[0], parts[1])];
  return Math.round((min + max) / 2);
}

function confidenceToPercent(conf?: string): number {
  const c = (conf || '').toLowerCase();
  if (c.startsWith('low')) return 40;
  if (c.startsWith('medium')) return 65;
  if (c.startsWith('high')) return 90;
  return 75;
}

interface DamageReportProps {
  onBack: () => void;
}

// Live data will be loaded from claim APIs

const DamageReport: React.FC<DamageReportProps> = ({ onBack }) => {
  const [progress, setProgress] = useState(0);
  const [verified, setVerified] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [displayEstimate, setDisplayEstimate] = useState(0);
  const [targetEstimate, setTargetEstimate] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [costings, setCostings] = useState<Array<{ part: string; price: number; confidence?: string }>>([]);
  const [meanCost, setMeanCost] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const claimIds = useMemo<number[]>(() => {
    try {
      const ids = localStorage.getItem('recentClaimIds');
      if (!ids) return [];
      const parsed = JSON.parse(ids) as number[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);



  const log = useCallback((line: string) => {
    console.log(`[DAMAGE-REPORT] ${line}`);
  }, []);

  // Fetch processed images and results for recent claims
  const fetchResults = useCallback(async () => {
    if (!claimIds.length) return;
    setIsRefreshing(true);
    log(`Fetching results for ${claimIds.length} claims...`);
    
    try {
      // Fetch images for each claim ID (2 images per claim)
      const imagePromises: Promise<{ claimId: number; model: 1 | 2; blob: Blob | null }>[] = [];
      
      claimIds.forEach((claimId) => {
        // Model 1 image for this claim
        imagePromises.push(
          fetchModelImageBlob(claimId, 1)
            .then(blob => ({ claimId, model: 1 as const, blob }))
            .catch(() => ({ claimId, model: 1 as const, blob: null }))
        );
        
        // Model 2 image for this claim
        imagePromises.push(
          fetchModelImageBlob(claimId, 2)
            .then(blob => ({ claimId, model: 2 as const, blob }))
            .catch(() => ({ claimId, model: 2 as const, blob: null }))
        );
      });
      
      const imageResults = await Promise.all(imagePromises);
      
      // Create URLs only for successful image fetches
      const validImages = imageResults
        .filter(result => result.blob !== null)
        .map(result => ({
          url: URL.createObjectURL(result.blob!),
          claimId: result.claimId,
          model: result.model,
          label: `Claim ${result.claimId} - Model ${result.model}`
        }));
      
      setImageUrls(validImages.map(img => img.url));
      log(`Successfully loaded ${validImages.length} processed images from ${claimIds.length} claims`);
      
      // Log any failed image fetches for debugging
      const failedImages = imageResults.filter(result => result.blob === null);
      if (failedImages.length > 0) {
        log(`Failed to load ${failedImages.length} images: ${failedImages.map(f => `Claim ${f.claimId} Model ${f.model}`).join(', ')}`);
      }
      
      // (logs only in console)

      // Fetch claim results for costings
      const results = await Promise.all(
        claimIds.map((id) => fetchClaimResults(id).catch(() => null))
      );
      const allCostings = results
        .filter((r): r is NonNullable<typeof r> => !!r)
        .flatMap((r) => r.costings || [])
        .map((c) => ({
          part: c.part,
          price: parsePriceRangeToMean(c.price as any),
          confidence: c.confidence as string | undefined,
        }));
      setCostings(allCostings);
      log(`Processed ${allCostings.length} costings from ${results.filter(r => r).length} claims`);

      const total = allCostings.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
      setTargetEstimate(total);

      const perClaimTotals: number[] = (results as (ClaimResults | null)[])
        .filter((r): r is ClaimResults => !!r)
        .map((r) => (r.costings || [])
          .reduce((sum, c) => sum + parsePriceRangeToMean(c.price as any), 0)
        );
      if (perClaimTotals.length) {
        const mean = perClaimTotals.reduce((a, b) => a + b, 0) / perClaimTotals.length;
        setMeanCost(mean);
        log(`Calculated mean cost per claim: ₹${Math.round(mean).toLocaleString()}`);
      }
      
      log(`Total estimated cost: ₹${total.toLocaleString()}`);
    } catch (error) {
      log(`Error fetching results: ${String(error)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [claimIds, log]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

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

    return () => {
      clearTimeout(progressTimer);
    };
  }, []);

  // Animate display estimate when target changes
  useEffect(() => {
    const target = Math.max(targetEstimate, 0);
    if (target <= 0) {
      setDisplayEstimate(0);
      return;
    }
    const step = Math.max(Math.round(target / 80), 20);
    const interval = setInterval(() => {
      setDisplayEstimate(prev => {
        if (prev >= target) {
          clearInterval(interval);
          return target;
        }
        return Math.min(prev + step, target);
      });
    }, 15);
    return () => clearInterval(interval);
  }, [targetEstimate]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Car Damage Report',
          text: 'Car Damage Report: Front Bumper Dent, Rs 3,000-4,000. Download your report now!',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText('Car Damage Report: Front Bumper Dent, Rs 3,000-4,000. Download your report now!');
      alert('Report link copied to clipboard!');
    }
  };

  const handleDownload = async () => {
    try {
      const items = costings.map(c => ({ part: c.part, price: Number(c.price || 0), confidence: c.confidence }));
      
      // Get vehicle details from localStorage if available
      let vehicleMake = 'User Entered';
      let vehicleModel = 'User Entered';
      try {
        const vehicleDetails = localStorage.getItem('vehicleDetails');
        if (vehicleDetails) {
          const parsed = JSON.parse(vehicleDetails);
          vehicleMake = parsed.make || vehicleMake;
          vehicleModel = parsed.model || vehicleModel;
        }
      } catch (e) {
        console.warn('Could not parse vehicle details:', e);
      }
      
      await generateAndDownloadReport({
        claimId: claimIds[0] || 0,
        assessmentId: 'web',
        vehicleMake,
        vehicleModel,
        total: displayEstimate,
        items,
        photoUrls: imageUrls,
      });
    } catch (e) {
      console.error('Failed to generate PDF', e);
      alert('Failed to generate PDF');
    }
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
          transition={{ delay: 0.25 }}
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

        {/* Damage Alert (summary) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6"
        >
          <div className="flex">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center mr-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-bold mb-2">Damage Identified</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Estimated repair cost: ₹{displayEstimate.toLocaleString()} (aggregated from processed claims)
              </p>
            </div>
          </div>
        </motion.div>

        {/* Photo Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <h3 className="text-white font-bold mb-4">Damage Documentation</h3>
          {imageUrls.length === 0 ? (
            <div className="glass-effect rounded-2xl p-6">
              <div className="text-center text-gray-400">
                <p>No processed images available yet.</p>
                <p className="text-sm mt-2">Images will appear here once processing is complete.</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {imageUrls.map((photo, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPhoto(index)}
                  className="relative w-80 h-60 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer"
                >
                  <img
                    src={photo}
                    alt={`Processed damage analysis ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <span className="text-white font-semibold">Analysis {index + 1}</span>
                    <Maximize2 className="w-4 h-4 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Estimate Breakdown (from API) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">Repair Estimate</h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isRefreshing}
              onClick={fetchResults}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
                isRefreshing
                  ? 'bg-blue-500/40 text-white/60 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </motion.button>
          </div>
          <div className="glass-effect rounded-2xl p-6">
            {meanCost > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <span className="text-gray-300">Mean confidence score ({claimIds.length} claims)</span>
                <span className="text-blue-400 font-bold">{Math.round(meanCost)}%</span>
              </div>
            )}
            {(!costings.length) && (
              <div className="text-gray-400 text-sm">No analysis yet. Processing may still be underway.</div>
            )}
            {costings.map((item, index) => (
              <div key={index} className="flex items-center justify-between mb-4 last:mb-0">
                <div className="flex items-center">
                  <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-400 text-[10px] font-bold uppercase">{item.confidence || 'n/a'}</span>
                  </div>
                  <span className="text-white font-semibold">{item.part || 'Part'}</span>
                </div>
                <span className="text-gray-300 font-bold">{item.confidence || 'N/A'}%</span>
              </div>
            ))}
            
            <div className="border-t border-white/10 my-4" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center mr-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-lg">Overall Confidence</span>
              </div>
              <span className="text-green-400 font-bold text-2xl">
                {displayEstimate}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Logs removed for production UI */}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
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
        {selectedPhoto !== null && imageUrls[selectedPhoto] && (
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
                src={imageUrls[selectedPhoto]}
                alt={`Claim ${claimIds[Math.floor(selectedPhoto / 2)]} - Model ${(selectedPhoto % 2) + 1} processed image`}
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
