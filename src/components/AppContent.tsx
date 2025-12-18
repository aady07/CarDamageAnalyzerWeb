import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingScreen from './LandingScreen';
import RulesScreen from './RulesScreen';
import CameraScreen from './CameraScreen';

// SDK Mode: No authentication required
// Authentication is handled by the Android app, not the SDK
export type ScreenType = 'landing' | 'rules' | 'camera';

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');
  const [vehicleDetails, setVehicleDetails] = useState<{ make: string; model: string; regNumber: string } | null>(null);

  // SDK Mode: No auth checks needed
  const navigateTo = (screen: ScreenType) => {
    setCurrentScreen(screen);
  };

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      {/* Navbar removed in SDK mode - no logo needed */}
      <AnimatePresence mode="wait">
        {/* SDK Mode: Always show app screens (no auth required) */}
        {currentScreen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LandingScreen 
              onStartAnalysis={() => navigateTo('rules')}
            />
          </motion.div>
        )}

        {currentScreen === 'rules' && (
          <motion.div
            key="rules"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <RulesScreen 
              onStart={(details) => {
                setVehicleDetails(details);
                navigateTo('camera');
              }}
              onBack={() => navigateTo('landing')}
            />
          </motion.div>
        )}

        {currentScreen === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <CameraScreen 
              vehicleDetails={vehicleDetails}
              onComplete={() => navigateTo('landing')}
              onBack={() => navigateTo('landing')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppContent;
