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
import logo from '../assets/images/logo.svg';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { isAuthenticated } = useCognitoAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Check admin status when user is authenticated
  useEffect(() => {
    if (isAuthed === true) {
      checkAdminStatus()
        .then(response => {
          setIsAdmin(response.isAdmin);
        })
        .catch(error => {
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
      return;
    }
    
    setCurrentScreen(screen);
  };

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      {/* Navbar (hidden on camera screen to maximize space) */}
      {currentScreen !== 'camera' && (
        <nav className="px-4 md:px-8 py-1 md:py-3">
          <div className="flex items-center justify-between">
            {/* Logo - Left Side */}
            <img 
              src={logo} 
              alt="Logo" 
              className="h-28 md:h-32" 
            />
            
            {/* Navigation Menu - Right Side */}
            {isAuthed && (
              <div className="relative dropdown-container">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full p-3 border border-white/20 hover:border-white/30 transition-all duration-300"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </motion.button>
                
                {/* Dropdown Menu */}
                <div className={`absolute right-0 top-full mt-2 w-48 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl transition-all duration-300 z-50 ${isDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                  <div className="py-2">
                    {currentScreen !== 'dashboard' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          navigateTo('dashboard');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors duration-200 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                        </svg>
                        Dashboard
                      </motion.button>
                    )}
                    {isAdmin === true && currentScreen !== 'admin' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          navigateTo('admin');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors duration-200 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Admin
                      </motion.button>
                    )}
                    <div className="border-t border-white/20 my-1"></div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onLogout();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-red-300 hover:bg-red-500/20 transition-colors duration-200 flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </motion.button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
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
