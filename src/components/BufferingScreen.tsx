import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Car, CheckCircle } from 'lucide-react';
import bufferImage from '../assets/images/buffer.png';

interface BufferingScreenProps {
  onComplete: () => void;
}

const BufferingScreen: React.FC<BufferingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Simulate processing progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setIsComplete(true);
          clearInterval(interval);
          setTimeout(onComplete, 1000);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-dark-900 to-dark-800">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        {/* Car Animation */}
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-48 h-48 mx-auto mb-8"
        >
          <img 
            src={bufferImage} 
            alt="Car animation" 
            className="w-full h-full object-contain"
          />
        </motion.div>

        {/* Progress Bar */}
        <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Status Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {isComplete ? (
            <div className="flex items-center justify-center gap-2 text-green-400">
              <CheckCircle className="w-6 h-6" />
              <span className="text-lg font-semibold">Analysis Complete!</span>
            </div>
          ) : (
            <div className="text-gray-300">
              <div className="text-lg font-semibold mb-2">Processing</div>
              <div className="text-sm">{Math.round(progress)}%</div>
            </div>
          )}
        </motion.div>

        {/* Processing Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-8 space-y-2"
        >
          <div className={`flex items-center gap-3 text-sm transition-colors ${
            progress > 20 ? 'text-green-400' : 'text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              progress > 20 ? 'bg-green-400' : 'bg-gray-500'
            }`} />
            <span>Analyzing vehicle structure</span>
          </div>
          <div className={`flex items-center gap-3 text-sm transition-colors ${
            progress > 40 ? 'text-green-400' : 'text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              progress > 40 ? 'bg-green-400' : 'bg-gray-500'
            }`} />
            <span>Detecting damage areas</span>
          </div>
          <div className={`flex items-center gap-3 text-sm transition-colors ${
            progress > 60 ? 'text-green-400' : 'text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              progress > 60 ? 'bg-green-400' : 'bg-gray-500'
            }`} />
            <span>Calculating repair estimates</span>
          </div>
          <div className={`flex items-center gap-3 text-sm transition-colors ${
            progress > 80 ? 'text-green-400' : 'text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              progress > 80 ? 'bg-green-400' : 'bg-gray-500'
            }`} />
            <span>Generating detailed report</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BufferingScreen;
