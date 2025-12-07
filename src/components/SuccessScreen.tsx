import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { getAndroidBridge } from '../services/androidBridge';

interface SuccessScreenProps {
  inspectionId: number;
  registrationNumber: string;
  estimatedTime: string;
  onBack: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ 
  inspectionId, 
  registrationNumber, 
  estimatedTime, 
  onBack 
}) => {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 max-w-lg mx-4 text-center"
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8"
          >
            <CheckCircle className="w-12 h-12 text-green-400" />
          </motion.div>

          {/* Success Message */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-bold text-white mb-4"
          >
            Inspection Saved
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-gray-300 text-lg mb-8"
          >
            Your car inspection has been saved.
          </motion.p>

          {/* Inspection Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-6 mb-8"
          >
            <div className="text-left text-gray-300 space-y-3">
              <div className="flex justify-between">
                <span className="text-blue-400 font-semibold">Local ID:</span>
                <span className="text-white font-mono">{inspectionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400 font-semibold">Registration:</span>
                <span className="text-white font-semibold">{registrationNumber}</span>
              </div>
            </div>
          </motion.div>

          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // Try to close WebView and return to Android app
              try {
                const androidBridge = getAndroidBridge();
                if (androidBridge.closeWebView) {
                  androidBridge.closeWebView();
                } else {
                  // Fallback: try common Android WebView close methods
                  if ((window as any).AndroidBridge?.closeWebView) {
                    (window as any).AndroidBridge.closeWebView();
                  } else if ((window as any).Android?.closeWebView) {
                    (window as any).Android.closeWebView();
                  } else {
                    // If no close method available, just call onBack
                    onBack();
                  }
                }
              } catch (error) {
                // If bridge not available, just call onBack
                onBack();
              }
            }}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default SuccessScreen;
