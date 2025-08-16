import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingScreen from './components/LandingScreen';
import RulesScreen from './components/RulesScreen';
import CameraScreen from './components/CameraScreen';
import BufferingScreen from './components/BufferingScreen';
import DamageReport from './components/DamageReport';

export type ScreenType = 'landing' | 'rules' | 'camera' | 'buffering' | 'report';

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');

  const handleScreenChange = (screen: ScreenType) => {
    setCurrentScreen(screen);
  };

  return (
    <div className="min-h-screen gradient-bg overflow-hidden">
      <AnimatePresence mode="wait">
        {currentScreen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LandingScreen onStartAnalysis={() => handleScreenChange('rules')} />
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
              onStart={() => handleScreenChange('camera')}
              onBack={() => handleScreenChange('landing')}
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
              onComplete={() => handleScreenChange('buffering')}
              onBack={() => handleScreenChange('landing')}
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
            <BufferingScreen onComplete={() => handleScreenChange('report')} />
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
            <DamageReport onBack={() => handleScreenChange('landing')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
