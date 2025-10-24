import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, Crown } from 'lucide-react';
import { useUploadLimitsContext } from '../contexts/UploadLimitsContext';

interface AdminUploadLimitsDisplayProps {
  className?: string;
}

const AdminUploadLimitsDisplay: React.FC<AdminUploadLimitsDisplayProps> = ({ className = '' }) => {
  const { limitInfo, loading, error, remainingAssessments, canPerformAssessment } = useUploadLimitsContext();

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`glass-effect rounded-xl p-4 card-shadow ${className}`}
      >
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-300">Loading limits...</span>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`glass-effect rounded-xl p-4 card-shadow border border-red-500/30 ${className}`}
      >
        <div className="flex items-center text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span className="text-sm">Failed to load upload limits</span>
        </div>
      </motion.div>
    );
  }

  if (!limitInfo) {
    return null;
  }

  const { stats, tierInfo } = limitInfo;
  const isUnlimited = stats.isUnlimited;
  const hasReachedLimit = stats.hasReachedLimit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-effect rounded-xl p-4 card-shadow ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {isUnlimited ? (
            <Crown className="w-5 h-5 text-yellow-400 mr-2" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 mr-2" />
          )}
          <span className="text-white font-semibold text-sm">
            {tierInfo.name} Plan
          </span>
        </div>
        {canPerformAssessment ? (
          <CheckCircle className="w-5 h-5 text-green-400" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-400" />
        )}
      </div>

      <div className="space-y-2">
        {isUnlimited ? (
          <div className="text-green-400 text-sm font-medium">
            Unlimited inspections available
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Remaining inspections:</span>
              <span className={`font-bold text-sm ${canPerformAssessment ? 'text-green-400' : 'text-red-400'}`}>
                {Math.floor(stats.remainingUploads / 4)} / {Math.floor(stats.uploadLimit / 4)}
              </span>
            </div>
          </div>
        )}

        {!canPerformAssessment && !isUnlimited && (
          <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
            <div className="flex items-center text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>Insufficient uploads for inspection (need 4)</span>
            </div>
          </div>
        )}

        {!isUnlimited && (
          <div className="mt-2 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <div className="text-blue-400 text-xs">
              Upgrade to Premium for unlimited inspections
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminUploadLimitsDisplay;
