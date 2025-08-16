import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import lottie from 'lottie-web';
import testAnimation from '../assets/images/test.json';

interface BufferingScreenProps {
  onComplete: () => void;
}

const BufferingScreen: React.FC<BufferingScreenProps> = ({ onComplete }) => {
  const lottieRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Initialize Lottie animation
    if (lottieRef.current) {
      const anim = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: testAnimation
      });

      return () => anim.destroy();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5000);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Elegant dark-to-light gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#232946] to-[#e0e7ef]"></div>
      
      {/* Centered content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* Lottie car animation */}
        <div 
          ref={lottieRef}
          className="w-[180px] h-[180px] self-center mt-10"
        />

        {/* Progress bar below car */}
        <div className="w-[180px] h-[10px] bg-gray-300 rounded-[5px] mt-8 overflow-hidden border border-[#232946] self-center">
          <motion.div
            className="h-full bg-[#232946] rounded-[5px]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Processing text */}
        <p className="text-[#232946] text-lg font-bold mt-[18px] text-center tracking-wide">
          Processing
        </p>
      </div>
    </div>
  );
};

export default BufferingScreen;
