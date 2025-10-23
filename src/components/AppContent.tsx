import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingScreen from './LandingScreen';
import RulesScreen from './RulesScreen';
import CameraScreen from './CameraScreen';
import Dashboard from './Dashboard';
import AdminDashboard from './AdminDashboard';
import Login from './Login';
import { useCognitoAuth } from '../hooks/useCognitoAuth.js';
import { checkAdminStatus } from '../services/api/adminService';
import logo from '../assets/images/logo.png';

export type ScreenType = 'landing' | 'rules' | 'camera' | 'dashboard' | 'admin';

interface AppContentProps {
  isAuthed: boolean | null;
  needsAuth: boolean;
  onLogout: () => void;
  onAuthSuccess: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ isAuthed, needsAuth, onLogout, onAuthSuccess }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');
  const [vehicleDetails, setVehicleDetails] = useState<{ make: string; model: string; regNumber: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { isAuthenticated } = useCognitoAuth();

  // Check admin status when user is authenticated
  useEffect(() => {
    if (isAuthed === true) {
      checkAdminStatus()
        .then(response => {
          setIsAdmin(response.isAdmin);
        })
        .catch(error => {
          console.error('Failed to check admin status:', error);
          setIsAdmin(false);
        });
    } else {
      setIsAdmin(null);
    }
  }, [isAuthed]);

  const navigateTo = async (screen: ScreenType) => {
    // Protect camera, dashboard, and admin screens with auth
    if (screen === 'camera' || screen === 'dashboard' || screen === 'admin') {
      const ok = await isAuthenticated();
      if (!ok) {
        // Handle auth requirement - this should be handled by the parent App component
        return;
      }
    }
    
    // Protect admin screen with admin check
    if (screen === 'admin' && isAdmin !== true) {
      console.warn('Admin access required');
      return;
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
            <div className="flex items-center gap-4">
              {currentScreen !== 'dashboard' && (
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="text-white/90 hover:text-white text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2"
                >
                  Dashboard
                </button>
              )}
              {isAdmin === true && currentScreen !== 'admin' && (
                <button
                  onClick={() => navigateTo('admin')}
                  className="text-white/90 hover:text-white text-sm font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg px-4 py-2"
                >
                  Admin
                </button>
              )}
              <button
                onClick={onLogout}
                className="text-white/90 hover:text-white text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2"
              >
                Logout
              </button>
            </div>
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

        {currentScreen === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Dashboard onBack={() => navigateTo('landing')} />
          </motion.div>
        )}

        {currentScreen === 'admin' && (
          <motion.div
            key="admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AdminDashboard onBack={() => navigateTo('landing')} />
          </motion.div>
        )}

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
