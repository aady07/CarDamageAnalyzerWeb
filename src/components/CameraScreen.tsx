import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { ArrowLeft, Camera, Square, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

// Import car stencil images
import frontStencil from '../assets/images/1.png';
import rightStencil from '../assets/images/2.png';
import backStencil from '../assets/images/3.png';
import leftStencil from '../assets/images/4.png';

interface CameraScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

type Position = 'front' | 'right' | 'back' | 'left';
type Status = 'detecting' | 'ready' | 'recording' | 'completed';

interface PositionData {
  id: Position;
  label: string;
  image: string;
  angle: number;
  color: string;
}

const POSITIONS: PositionData[] = [
  { id: 'front', label: 'Front', image: frontStencil, angle: 0, color: '#4CAF50' },
  { id: 'right', label: 'Right', image: rightStencil, angle: 270, color: '#2196F3' },
  { id: 'back', label: 'Back', image: backStencil, angle: 180, color: '#FF9800' },
  { id: 'left', label: 'Left', image: leftStencil, angle: 90, color: '#9C27B0' }
];

const CameraScreen: React.FC<CameraScreenProps> = ({ onComplete, onBack }) => {
  const [currentPosition, setCurrentPosition] = useState(0);
  const [status, setStatus] = useState<Status>('detecting');
  const [timer, setTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidanceMessage, setGuidanceMessage] = useState('');
  const [completedPositions, setCompletedPositions] = useState<number[]>([]);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPosData = POSITIONS[currentPosition];

  // Detect mobile device and request camera permission on component mount
  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();

    const requestCameraPermission = async () => {
      try {
        // Check if we're in a secure context (HTTPS or localhost)
        if (!window.isSecureContext) {
          setCameraError('Camera requires a secure connection (HTTPS)');
          setCameraPermission('denied');
          setShowPermissionRequest(true);
          return;
        }

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices) {
          setCameraError('Camera API not supported in this browser');
          setCameraPermission('denied');
          setShowPermissionRequest(true);
          return;
        }

        if (!navigator.mediaDevices.getUserMedia) {
          setCameraError('getUserMedia not supported in this browser');
          setCameraPermission('denied');
          setShowPermissionRequest(true);
          return;
        }

        // Test if getUserMedia is actually callable
        try {
          const testPromise = navigator.mediaDevices.getUserMedia({ video: false });
          console.log('getUserMedia is callable');
        } catch (testError) {
          console.error('getUserMedia test failed:', testError);
          setCameraError('Camera API is not properly implemented in this browser');
          setCameraPermission('denied');
          setShowPermissionRequest(true);
          return;
        }

        console.log('Requesting camera permission...');
        
        // Request camera permission with simpler constraints first
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            facingMode: 'environment',
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          } 
        });
        
        console.log('Camera permission granted, stream:', stream);
        
        // Stop the stream immediately after getting permission
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track);
        });
        
        setCameraPermission('granted');
        setShowPermissionRequest(false);
      } catch (error: any) {
        console.error('Camera permission error:', error);
        
        let errorMessage = 'Failed to access camera';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera not supported in this browser.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setCameraError(errorMessage);
        setCameraPermission('denied');
        setShowPermissionRequest(true);
      }
    };

    // Longer delay to ensure component is fully mounted and browser is ready
    const timer = setTimeout(() => {
      requestCameraPermission();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Detection phase - 6 seconds (matching mobile app)
  useEffect(() => {
    if (status === 'detecting') {
      setTimer(0);
      setShowGuidance(true);
      setGuidanceMessage('Keep camera stable and steady');
      
      detectionTimerRef.current = setTimeout(() => {
        setStatus('ready');
        setShowGuidance(false);
      }, 6000); // 6 seconds like mobile app
    }

    return () => {
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
      }
    };
  }, [status, currentPosition]);

  // Auto-start recording for non-front positions after 1 second of ready state
  useEffect(() => {
    if (status === 'ready' && currentPosition > 0) {
      const autoRecordTimer = setTimeout(() => {
        setStatus('recording');
      }, 1000);
      
      return () => clearTimeout(autoRecordTimer);
    }
  }, [status, currentPosition]);

  // Recording phase - auto-advance for non-front positions
  useEffect(() => {
    if (status === 'recording') {
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          const newTimer = prev + 1;
          if (newTimer >= 6) {
            // Complete recording after 6 seconds
            completePosition();
            return 0;
          }
          return newTimer;
        });
      }, 1000);
    } else {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  const completePosition = useCallback(() => {
    setCompletedPositions(prev => [...prev, currentPosition]);
    
    if (currentPosition < POSITIONS.length - 1) {
      // Move to next position
      setCurrentPosition(prev => prev + 1);
      setStatus('detecting');
      setTimer(0);
      
      // Show guidance for next position (matching mobile app messages)
      const nextPos = POSITIONS[currentPosition + 1];
      let message = '';
      if (nextPos.id === 'right') {
        message = 'Turn to the right of the car';
      } else if (nextPos.id === 'back') {
        message = 'Turn to the back of the car';
      } else if (nextPos.id === 'left') {
        message = 'Turn to the left of the car';
      }
      setGuidanceMessage(message);
      setShowGuidance(true);
      
      // Hide after 2 seconds (before stencil turns green)
      setTimeout(() => {
        setShowGuidance(false);
      }, 2000);
    } else {
      // All positions completed
      onComplete();
    }
  }, [currentPosition, onComplete]);

  const handleRecordPress = () => {
    // Only allow recording for front position when ready
    if (currentPosition === 0 && status === 'ready' && !isRecording) {
      setStatus('recording');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'detecting':
        return '#e53935'; // Red
      case 'ready':
        return '#4CAF50'; // Green
      case 'recording':
        return '#FFD700'; // Yellow
      case 'completed':
        return '#4CAF50'; // Green
      default:
        return '#e53935';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'detecting':
        return <AlertCircle className="w-6 h-6" />;
      case 'ready':
        return <CheckCircle className="w-6 h-6" />;
      case 'recording':
        return <Square className="w-6 h-6" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6" />;
      default:
        return <AlertCircle className="w-6 h-6" />;
    }
  };

  // Handle camera permission retry
  const handleRetryCamera = () => {
    setCameraPermission('pending');
    setCameraError('');
    setShowPermissionRequest(false);
    
    // Retry after a short delay
    setTimeout(() => {
      const requestCameraPermission = async () => {
        try {
          // Check if we're in a secure context (HTTPS or localhost)
          if (!window.isSecureContext) {
            setCameraError('Camera requires a secure connection (HTTPS)');
            setCameraPermission('denied');
            setShowPermissionRequest(true);
            return;
          }

          // Check if getUserMedia is supported
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Camera not supported in this browser');
            setCameraPermission('denied');
            setShowPermissionRequest(true);
            return;
          }

          console.log('Retrying camera permission...');
          
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              facingMode: 'environment',
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 }
            } 
          });
          
          console.log('Camera permission granted on retry, stream:', stream);
          
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track on retry:', track);
          });
          
          setCameraPermission('granted');
        } catch (error: any) {
          console.error('Camera permission retry error:', error);
          
          let errorMessage = 'Failed to access camera';
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied. Please allow camera access.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device.';
          } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Camera not supported in this browser.';
          } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is already in use by another application.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          setCameraError(errorMessage);
          setCameraPermission('denied');
          setShowPermissionRequest(true);
        }
      };
      requestCameraPermission();
    }, 500);
  };

  // Show permission request screen
  if (showPermissionRequest) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md mx-4 text-center"
          >
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Camera Permission Required</h2>
            <p className="text-gray-300 mb-6">
              This app needs camera access to analyze car damage. Please allow camera permission in your browser settings.
            </p>
            
            {/* Mobile-specific instructions */}
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-6">
              <h3 className="text-blue-400 font-semibold mb-2">How to enable camera:</h3>
              <div className="text-left text-sm text-gray-300 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Look for the camera icon in your browser's address bar</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Tap it and select "Allow" or "Always allow"</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Refresh the page or tap "Try Again" below</span>
                </div>
              </div>
            </div>
            
            {/* Development mode notice */}
            {window.location.hostname === 'localhost' && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 mb-6">
                <h3 className="text-yellow-400 font-semibold mb-2">Development Mode:</h3>
                <p className="text-sm text-gray-300">
                  You're running on localhost. For better camera support, try accessing this app from a mobile device on the same network using the IP address shown in the terminal.
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetryCamera}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl"
              >
                Try Again
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  // Skip camera and go directly to buffering
                  onComplete();
                }}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl"
              >
                Continue Without Camera (Demo)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onBack}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl"
              >
                Go Back
              </motion.button>
            </div>
            {cameraError && (
              <p className="text-red-400 text-sm mt-4">{cameraError}</p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Show loading while requesting permission
  if (cameraPermission === 'pending') {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Requesting camera permission...</p>
            {isMobile && (
              <p className="text-gray-400 text-sm mt-2">Please allow camera access when prompted</p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Camera View */}
      <div className="absolute inset-0">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className="w-full h-full object-cover"
          videoConstraints={{
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }}
          onUserMedia={() => {
            console.log('Camera access granted');
          }}
          onUserMediaError={(error) => {
            console.error('Camera error:', error);
            setCameraError(error.message || 'Camera access failed');
            setCameraPermission('denied');
            setShowPermissionRequest(true);
          }}
        />
      </div>

      {/* Stencil Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full h-full"
        >
          <img
            src={currentPosData.image}
            alt={`${currentPosData.label} stencil`}
            className="w-full h-full object-contain"
            style={{
              filter: `drop-shadow(0 0 20px ${getStatusColor()})`,
              opacity: 0.8
            }}
          />
          {/* Status overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-32 h-32 border-4 rounded-full flex items-center justify-center"
              style={{ 
                borderColor: getStatusColor(),
                backgroundColor: `${getStatusColor()}20`,
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="text-center">
                <div className="text-white font-bold text-lg">
                  {currentPosData.label}
                </div>
                <div className="text-white text-sm mt-1">
                  {status === 'detecting' && 'Detecting...'}
                  {status === 'ready' && 'Ready'}
                  {status === 'recording' && 'Recording...'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-8 left-6 w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
      >
        <ArrowLeft className="w-6 h-6" />
      </motion.button>

      {/* Progress Indicators */}
      <div className="absolute top-8 right-6 flex flex-col gap-2">
        {POSITIONS.map((pos, index) => (
          <div
            key={pos.id}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              index < currentPosition
                ? 'bg-green-500 border-green-500 text-white'
                : index === currentPosition
                ? `border-${status === 'detecting' ? 'red' : status === 'ready' ? 'green' : 'yellow'}-500 text-white`
                : 'bg-gray-600 border-gray-600 text-gray-400'
            }`}
          >
            {index + 1}
          </div>
        ))}
      </div>

      {/* Recording Controls */}
      <div className="absolute bottom-8 right-6 flex flex-col items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleRecordPress}
          disabled={!(currentPosition === 0 && status === 'ready' && !isRecording)}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white transition-all ${
            currentPosition === 0 && status === 'ready' && !isRecording
              ? 'bg-green-500 hover:bg-green-600'
              : status === 'recording'
              ? 'bg-red-500'
              : 'bg-gray-500 cursor-not-allowed'
          }`}
        >
          {getStatusIcon()}
        </motion.button>
        
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold"
          >
            Recording... {timer}s
          </motion.div>
        )}
      </div>

      {/* Guidance Message */}
      <AnimatePresence>
        {showGuidance && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-1/4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full"
          >
            {guidanceMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Camera Instructions */}
      {isMobile && cameraPermission === 'granted' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-32 left-4 right-4 bg-black/80 text-white p-4 rounded-xl"
        >
          <div className="text-center">
            <p className="text-sm font-semibold mb-1">📱 Mobile Camera Active</p>
            <p className="text-xs text-gray-300">
              Point your camera at the car and follow the stencil guide. The back camera is being used.
            </p>
          </div>
        </motion.div>
      )}

      {/* Progress Bar */}
      <div className="absolute bottom-20 left-6 right-6">
        <div className="bg-gray-700 rounded-full h-2">
          <motion.div
            className="bg-blue-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((completedPositions.length + (status === 'recording' ? timer / 6 : 0)) / POSITIONS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="text-center text-white text-sm mt-2">
          {completedPositions.length + 1} of {POSITIONS.length} positions
        </div>
      </div>
    </div>
  );
};

export default CameraScreen;
