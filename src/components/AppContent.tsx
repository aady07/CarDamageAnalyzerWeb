import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingScreen from './LandingScreen';
import RulesScreen from './RulesScreen';
import CameraScreen from './CameraScreen';

// SDK Mode: No authentication required
// Authentication is handled by the Android app, not the SDK
export type ScreenType = 'landing' | 'rules' | 'camera';

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');
  const [vehicleDetails, setVehicleDetails] = useState<{ regNumber: string } | null>(null);

  // Read car registration number from URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const regNumber = urlParams.get('regNumber');

    if (regNumber) {
      // Registration number provided via URL - set it immediately
      setVehicleDetails({
        regNumber: regNumber
      });
      console.log('[AppContent] Registration number loaded from URL:', regNumber);
    }
  }, []);

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
              vehicleDetails={vehicleDetails}
              onStart={() => {
                // If vehicleDetails already set from URL, go directly to camera
                if (vehicleDetails) {
                  navigateTo('camera');
                } else {
                  // Fallback: if no URL params, still allow manual entry (backward compatibility)
                  // But we removed the modal, so this shouldn't happen
                  console.warn('[AppContent] No vehicle details found - cannot proceed to camera');
                }
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
