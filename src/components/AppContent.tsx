import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingScreen from './LandingScreen';
import RulesScreen from './RulesScreen';
import CameraScreen from './CameraScreen';
import ManualUploadScreen from './ManualUploadScreen';
import BufferingScreen from './BufferingScreen';
import DamageReport from './DamageReport';
import Login from './Login';
import { useCognitoAuth } from '../hooks/useCognitoAuth.js';
import { useUploadLimitsContext } from '../contexts/UploadLimitsContext';
import logo from '../assets/images/logo.png';

export type ScreenType = 'landing' | 'rules' | 'camera' | 'manual-upload' | 'buffering' | 'report';

interface AppContentProps {
  isAuthed: boolean | null;
  needsAuth: boolean;
  onLogout: () => void;
  onAuthSuccess: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ isAuthed, needsAuth, onLogout, onAuthSuccess }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');
  const [vehicleDetails, setVehicleDetails] = useState<{ make: string; model: string; regNumber: string } | null>(null);
  const { isAuthenticated } = useCognitoAuth();
  const { refetch: refetchUploadLimits } = useUploadLimitsContext();

  // Keep upload limits in sync with auth state (switching accounts without hard refresh)
  useEffect(() => {
    // When auth state changes, refresh limits. This also clears limits on logout
    // because the hook avoids calling the API when not authenticated.
    refetchUploadLimits();
  }, [isAuthed, refetchUploadLimits]);

  const navigateTo = async (screen: ScreenType) => {
    // Protect all screens except landing and rules with auth
    const protectedScreens: ScreenType[] = ['camera', 'manual-upload', 'buffering', 'report'];
    if (protectedScreens.includes(screen)) {
      const ok = await isAuthenticated();
      if (!ok) {
        // Handle auth requirement - this should be handled by the parent App component
        return;
      }
    }
    setCurrentScreen(screen);
  };

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      {/* Top Row (hidden on camera screen to maximize space) */}
      {currentScreen !== 'camera' && (
        <div className="px-8 pt-0 flex items-center justify-between">
          <img src={logo} alt="Logo" className="h-32 md:h-32 w-auto ml-0 md:ml-6" />
          {isAuthed && (
            <button
              onClick={onLogout}
              className="text-white/90 hover:text-white text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2"
            >
              Logout
            </button>
          )}
        </div>
      )}
      <AnimatePresence mode="wait">
        {/* Not authenticated: show login */}
        {isAuthed === false && (
          <motion.div
            key="login-unauth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Login 
              showLogout={false}
              onSuccess={onAuthSuccess} 
            />
          </motion.div>
        )}

        {/* Authenticated: show app screens */}
        {isAuthed === true && (
        <>
        {currentScreen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LandingScreen onStartAnalysis={() => navigateTo('rules')} />
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
              onManualUpload={() => navigateTo('manual-upload')}
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
              onComplete={async () => {
                await refetchUploadLimits();
                navigateTo('buffering');
              }}
              onBack={() => navigateTo('landing')}
            />
          </motion.div>
        )}

        {currentScreen === 'manual-upload' && (
          <motion.div
            key="manual-upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ManualUploadScreen 
              onComplete={async () => {
                await refetchUploadLimits();
                navigateTo('buffering');
              }}
              onBack={() => navigateTo('rules')}
            />
          </motion.div>
        )}

        {currentScreen === 'buffering' && (
          <motion.div
            key="buffering"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <BufferingScreen onComplete={() => navigateTo('report')} />
          </motion.div>
        )}

        {currentScreen === 'report' && (
          <motion.div
            key="report"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <DamageReport onBack={() => navigateTo('landing')} />
          </motion.div>
        )}

        {/* Test screen removed in production build */}

        {needsAuth && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Login 
              showLogout={isAuthed === true}
              onLogout={onLogout}
              onSuccess={onAuthSuccess} 
            />
          </motion.div>
        )}
        </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppContent;
