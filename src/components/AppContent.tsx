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
        <div className="px-4 md:px-8 pt-2 md:pt-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
            {/* Logo */}
            <div className="flex justify-center md:justify-start">
              <img src={logo} alt="Logo" className="h-20 md:h-32 w-auto" />
            </div>
            
            {/* Navigation Buttons */}
            {isAuthed && (
              <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                <div className="flex gap-2 md:gap-4">
                  {currentScreen !== 'dashboard' && (
                    <button
                      onClick={() => navigateTo('dashboard')}
                      className="text-white/90 hover:text-white text-xs md:text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 md:px-4 py-2 md:py-2 flex-1 md:flex-none min-w-0"
                    >
                      <span className="hidden md:inline">Dashboard</span>
                      <span className="md:hidden">Dashboard</span>
                    </button>
                  )}
                  {isAdmin === true && currentScreen !== 'admin' && (
                    <button
                      onClick={() => navigateTo('admin')}
                      className="text-white/90 hover:text-white text-xs md:text-sm font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg px-3 md:px-4 py-2 md:py-2 flex-1 md:flex-none min-w-0"
                    >
                      <span className="hidden md:inline">Admin</span>
                      <span className="md:hidden">Admin</span>
                    </button>
                  )}
                </div>
                
                {/* Logout Button - Always Visible */}
                <button
                  onClick={onLogout}
                  className="w-full md:w-auto text-white/90 hover:text-white text-xs md:text-sm font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg px-3 md:px-4 py-2 md:py-2 transition-all duration-200"
                >
                  <span className="hidden md:inline">Logout</span>
                  <span className="md:hidden">Logout</span>
                </button>
              </div>
            )}
          </div>
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
