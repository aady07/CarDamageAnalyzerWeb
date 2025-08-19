import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingScreen from './components/LandingScreen';
import RulesScreen from './components/RulesScreen';
import CameraScreen from './components/CameraScreen';
import BufferingScreen from './components/BufferingScreen';
import DamageReport from './components/DamageReport';
import Login from './components/Login';
import { useCognitoAuth } from './hooks/useCognitoAuth';
import logo from './assets/images/logo.png';

export type ScreenType = 'landing' | 'rules' | 'camera' | 'buffering' | 'report';

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');
  const [vehicleDetails, setVehicleDetails] = useState<{ make: string; model: string; regNumber: string } | null>(null);
  const { isAuthenticated, user, signOut, loading } = useCognitoAuth();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const navigateTo = async (screen: ScreenType) => {
    // Protect all screens except landing and rules with auth
    const protectedScreens: ScreenType[] = ['camera', 'buffering', 'report'];
    if (protectedScreens.includes(screen)) {
      const ok = await isAuthenticated();
      if (!ok) {
        setNeedsAuth(true);
        setCurrentScreen('landing');
        return;
      }
    }
    setCurrentScreen(screen);
  };

  const handleScreenChange = (screen: ScreenType) => {
    setCurrentScreen(screen);
  };

  const checkAuth = useCallback(async () => {
    try {
      const ok = await isAuthenticated();
      setIsAuthed(!!ok);
    } catch {
      setIsAuthed(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      await signOut();
      setCurrentScreen('landing');
      setIsAuthed(false);
    } catch (_) {}
  };

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      {/* App Top Bar: logo always visible; logout only when authenticated */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Logo" className="h-8 w-auto" />
        </div>
        {isAuthed && (
          <button
            onClick={handleLogout}
            className="text-white/90 hover:text-white text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5"
          >
            Logout
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        {/* Not authenticated: show login */}
        {isAuthed === false && (
          <motion.div
            key="login-unauth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Login onSuccess={async () => {
              await checkAuth();
              setCurrentScreen('landing');
            }} />
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
              onComplete={() => navigateTo('buffering')}
              onBack={() => navigateTo('landing')}
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
            <Login onSuccess={async () => {
              setNeedsAuth(false);
              const ok = await isAuthenticated();
              if (ok) setCurrentScreen('rules');
            }} />
          </motion.div>
        )}
        </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
