import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, SkipForward, Camera, Target, CheckCircle, HelpCircle } from 'lucide-react';

interface CameraTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const CameraTutorial: React.FC<CameraTutorialProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps = [
    {
      title: 'Camera View',
      description: 'Position your car clearly in this frame for accurate damage detection',
      highlight: 'camera-view',
      position: 'bottom-right',
      icon: Camera
    },
    {
      title: 'Stencil Guide',
      description: 'The colored overlay shows which part of the car to focus on',
      highlight: 'stencil',
      position: 'bottom-left',
      icon: Target
    },
    {
      title: 'Progress Tracker',
      description: 'These dots show your progress through all car positions',
      highlight: 'progress',
      position: 'top-right',
      icon: CheckCircle
    },
    {
      title: 'Guidance Messages',
      description: 'Follow these instructions for each specific position',
      highlight: 'guidance',
      position: 'top-left',
      icon: CheckCircle
    },
    {
      title: 'Help Button',
      description: 'Tap here anytime to replay this tutorial',
      highlight: 'help-button',
      position: 'bottom-right',
      icon: HelpCircle
    },
    {
      title: 'Ready to Start!',
      description: 'You\'re all set! Begin capturing damage photos',
      highlight: 'full-screen',
      position: 'center',
      icon: Camera
    }
  ];

  const currentTutorial = tutorialSteps[currentStep];

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getTooltipPosition = (position: string) => {
    switch (position) {
      case 'top-left':
        return 'absolute top-8 left-8 max-w-xs';
      case 'top-right':
        return 'absolute top-8 right-8 max-w-xs';
      case 'bottom-left':
        return 'absolute bottom-8 left-8 max-w-xs';
      case 'bottom-right':
        return 'absolute bottom-8 right-8 max-w-xs';
      case 'center':
        return 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md';
      default:
        return 'absolute bottom-8 right-8 max-w-xs';
    }
  };

  const getHighlightPosition = (highlight: string) => {
    switch (highlight) {
      case 'camera-view':
        return 'absolute inset-0 border-4 border-blue-500/60 rounded-3xl m-6';
      case 'stencil':
        return 'absolute inset-0 border-4 border-green-500/60 rounded-3xl m-12';
      case 'progress':
        return 'absolute top-4 left-1/2 transform -translate-x-1/2 border-2 border-yellow-500/60 rounded-full px-6 py-2';
      case 'guidance':
        return 'absolute top-20 left-1/2 transform -translate-x-1/2 border-2 border-purple-500/60 rounded-2xl px-8 py-3';
      case 'help-button':
        return 'absolute top-6 right-6 border-2 border-orange-500/60 rounded-full w-14 h-14';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
      >
        {/* Close/Skip Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSkip}
          className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Skip Tutorial Button - Always Visible */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSkip}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm z-10"
        >
          <SkipForward className="w-4 h-4" />
          Skip Tutorial
        </motion.button>

        {/* Tutorial Tooltip */}
        {currentTutorial.highlight !== 'full-screen' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`${getTooltipPosition(currentTutorial.position)} z-20`}
          >
            <div className="glass-effect rounded-xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <currentTutorial.icon className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1">{currentTutorial.title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{currentTutorial.description}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Final Step Card */}
        {currentTutorial.highlight === 'full-screen' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-20 p-4"
          >
            <div className="glass-effect rounded-2xl p-6 text-center shadow-2xl max-w-md w-full">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <currentTutorial.icon className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{currentTutorial.title}</h3>
              <p className="text-gray-300 text-base leading-relaxed mb-6">{currentTutorial.description}</p>
              <div className="flex justify-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onSkip}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Start
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Highlight Overlays */}
        <AnimatePresence>
          {currentTutorial.highlight !== 'full-screen' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className={getHighlightPosition(currentTutorial.highlight)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Controls */}
        {currentTutorial.highlight !== 'full-screen' && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-20">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                currentStep === 0
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </motion.button>

            <div className="flex gap-2">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep ? 'bg-blue-500' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default CameraTutorial;
