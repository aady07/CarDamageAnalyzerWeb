import React from 'react';
import { motion } from 'framer-motion';
import { Car, Camera, ArrowRight, ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react';
import UploadLimitsDisplay from './UploadLimitsDisplay';

interface LandingScreenProps {
  onStartAnalysis: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onStartAnalysis }) => {
  const steps = [
    {
      icon: Car,
      title: 'Front View',
      description: 'Start from the front of your vehicle',
      color: '#4CAF50'
    },
    {
      icon: ArrowRight,
      title: 'Right Side',
      description: 'Move clockwise to the right side',
      color: '#2196F3'
    },
    {
      icon: ArrowDown,
      title: 'Back View',
      description: 'Continue to the rear of vehicle',
      color: '#FF9800'
    },
    {
      icon: ArrowLeft,
      title: 'Left Side',
      description: 'Complete with the left side',
      color: '#9C27B0'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-start px-4 md:px-6 pt-4 md:pt-8 pb-8 md:pb-12">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm md:max-w-md mb-6 md:mb-8"
        >
          <div className="glass-effect rounded-2xl md:rounded-3xl p-6 md:p-8 card-shadow">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4"
              >
                <Car className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </motion.div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                360° Car Damage Analysis
              </h1>
              <p className="text-lg md:text-xl font-bold text-blue-400 mb-2 md:mb-3">
                Complete Vehicle Assessment
              </p>
              <p className="text-gray-300 text-sm md:text-sm leading-relaxed">
                Record all four sides of your vehicle for comprehensive damage analysis. 
                Follow the guided 360° recording process.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Process Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-sm md:max-w-4xl mb-6 md:mb-8"
        >
          <div className="glass-effect rounded-xl md:rounded-2xl p-4 md:p-6 card-shadow">
            <h2 className="text-lg md:text-xl font-bold text-blue-400 mb-4 md:mb-6 text-center">
              Recording Process
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="bg-dark-800 rounded-xl md:rounded-2xl p-3 md:p-4 border border-blue-500/20"
                >
                  <div className="text-center">
                    <div 
                      className="w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3"
                      style={{ backgroundColor: `${step.color}20` }}
                    >
                      <step.icon 
                        className="w-4 h-4 md:w-6 md:h-6" 
                        style={{ color: step.color }}
                      />
                    </div>
                    <h3 className="font-bold text-white text-xs md:text-sm mb-1">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-xs">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Upload Limits Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="w-full max-w-sm md:max-w-md mb-4 md:mb-6"
        >
          <UploadLimitsDisplay />
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="w-full max-w-sm md:max-w-md"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartAnalysis}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3 text-sm md:text-base"
          >
            <Camera className="w-5 h-5 md:w-6 md:h-6" />
            <span className="hidden md:inline">Start 360° Analysis</span>
            <span className="md:hidden">Start Analysis</span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingScreen;
