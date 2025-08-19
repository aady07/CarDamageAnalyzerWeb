import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { ArrowLeft, AlertTriangle, HelpCircle, Hand } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import CameraTutorial from './CameraTutorial';
import { getPresignedUploadUrl, uploadFileToS3, startS3Processing, dataUrlToJpegBlob } from '../services/api/uploadService';
import { useUploadLimitsContext } from '../contexts/UploadLimitsContext';

// Import car stencil images
import frontStencil from '../assets/images/1.png';
import rightStencil from '../assets/images/2.png';
import backStencil from '../assets/images/3.png';
import leftStencil from '../assets/images/4.png';

interface CameraScreenProps {
  vehicleDetails: { make: string; model: string; regNumber: string } | null;
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

const CameraScreen: React.FC<CameraScreenProps> = ({ vehicleDetails, onComplete, onBack }) => {
  const [currentPosition, setCurrentPosition] = useState(0);
  const [status, setStatus] = useState<Status>('detecting');
  const { canPerformAssessment, limitInfo } = useUploadLimitsContext();
  
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidanceMessage, setGuidanceMessage] = useState('');
  const [completedPositions, setCompletedPositions] = useState<number[]>([]);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  
  // Mobile app variables
  const [recordingPhase, setRecordingPhase] = useState<'idle' | 'front' | 'right' | 'back' | 'left' | 'complete'>('front');
  
  // Car detection variables
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [carDetected, setCarDetected] = useState(false);
  // Confidence is not shown in UI; omit state to reduce noise
  const [completionTriggered, setCompletionTriggered] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  // Track orientation implicitly via window size check; no state needed
  const [showOrientationPrompt, setShowOrientationPrompt] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  // Capture & upload state
  // Countdown removed in favor of a calm, steady capture flow
  const [isUploading, setIsUploading] = useState(false); // kept for behavior control; UI hidden
  const [isStencilGreen, setIsStencilGreen] = useState(false);
  
  
  const webcamRef = useRef<Webcam>(null);
  
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const detectCarRef = useRef<(() => Promise<boolean>) | null>(null);
  const greenDelayRef = useRef<NodeJS.Timeout | null>(null);

  const currentPosData = POSITIONS[currentPosition] || POSITIONS[0]; // Fallback to first position if out of bounds



  // Load TensorFlow.js model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setModelLoading(true);
        console.log('Loading car detection model...');
        
        // Initialize TensorFlow.js backend
        await tf.ready();
        console.log('TensorFlow.js backend ready:', tf.getBackend());
        
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        console.log('Car detection model loaded successfully');
      } catch (error) {
        console.error('Failed to load car detection model:', error);
      } finally {
        setModelLoading(false);
      }
    };

    loadModel();
  }, []);

  // Detect mobile device and check orientation
  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    
    // Check orientation
    const checkOrientation = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight;
      // Show orientation prompt for mobile devices in portrait mode
      if (isMobile && !isLandscapeMode) {
        setShowOrientationPrompt(true);
      } else {
        setShowOrientationPrompt(false);
      }
    };

    // Lock screen orientation to landscape (like mobile app)
    const lockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
          console.log('Screen orientation locked to landscape');
        }
      } catch (error) {
        console.log('Could not lock orientation:', error);
      }
    };

    // Unlock screen orientation
    const unlockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          await screen.orientation.unlock();
          console.log('Screen orientation unlocked');
        }
      } catch (error) {
        console.log('Could not unlock orientation:', error);
      }
    };


    
    checkMobile();
    checkOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      setTimeout(checkOrientation, 100); // Small delay to ensure orientation is updated
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    const requestCameraPermission = async () => {
      try {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera not supported in this browser');
          setCameraPermission('denied');
          return;
        }

        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', // Use back camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        
        // Stop the stream immediately after getting permission
        stream.getTracks().forEach(track => track.stop());
        
        setCameraPermission('granted');
        setShowPermissionRequest(false);
      } catch (error: any) {
        console.error('Camera permission error:', error);
        setCameraError(error.message || 'Failed to access camera');
        setCameraPermission('denied');
        setShowPermissionRequest(true);
      }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      requestCameraPermission();
      // Lock orientation to landscape when camera screen is shown (like mobile app)
      lockOrientation();
    }, 500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      // Unlock orientation when component unmounts
      unlockOrientation();
    };
  }, [isMobile]);

    // Detection phase - Real-world car inspection flow
  useEffect(() => {
    console.log('🔍 Detection useEffect triggered - status:', status, 'currentPosition:', currentPosition);
    if (status === 'detecting' && currentPosition < POSITIONS.length && !completionTriggered && !showTutorial) {
      console.log('🚀 Starting detection phase for position:', currentPosition, 'recordingPhase:', recordingPhase);
      
      // Reset detection state for new position (only if not already completed)
      if (!carDetected) {
        // reset any previous pacing timers (no-op now)
        setCarDetected(false);
        setShowGuidance(true);
      }
      
      // Show position-specific guidance
      const positionMessages = {
        0: 'Position your camera at the FRONT of the car',
        1: 'Move to the RIGHT side of the car',
        2: 'Move to the BACK of the car', 
        3: 'Move to the LEFT side of the car'
      };
      
      setGuidanceMessage(positionMessages[currentPosition as keyof typeof positionMessages] || 'Positioning camera...');
      
      // Run car detection every 1 second (less frequent for better UX)
      const detectionInterval = setInterval(async () => {
        console.log('🔄 Detection interval: Running detection check');
        if (model && !modelLoading && detectCarRef.current && !completionTriggered) {
          console.log('🔄 Detection interval: Model ready, running detection');
          const detected = await detectCarRef.current();
          console.log('🔄 Detection interval: Detection result:', detected);
          if (detected && !completionTriggered) {
            console.log('🔄 Detection interval: Car detected, updating UI');
            
            // Set flag to prevent multiple completions
            setCompletionTriggered(true);
            // Stop further detection
            clearInterval(detectionInterval);
            // Clear fallback timer if running
            if (detectionTimerRef.current) {
              clearTimeout(detectionTimerRef.current);
              detectionTimerRef.current = null;
            }
            // UX: wait 2 seconds before turning stencil green, then capture & upload
            if (greenDelayRef.current) {
              clearTimeout(greenDelayRef.current);
            }
            greenDelayRef.current = setTimeout(() => {
              setIsStencilGreen(true);
              // Show calm guidance during upload
              setGuidanceMessage('Keep steady');
              setShowGuidance(true);
              triggerCaptureAndUpload();
            }, 2000);
          }
        } else {
          console.log('🔄 Detection interval: Model not ready or completion triggered - model:', !!model, 'loading:', modelLoading, 'ref:', !!detectCarRef.current, 'completionTriggered:', completionTriggered);
        }
      }, 1000); // Reduced frequency for better UX
      
      // Fallback timer - if no car detected after 15 seconds, show message and proceed
      detectionTimerRef.current = setTimeout(() => {
        console.log('⏰ 15 seconds elapsed - no car detected, proceeding anyway');
        if (!completionTriggered) {
          setShowGuidance(true);
          const positionNames = ['FRONT', 'RIGHT', 'BACK', 'LEFT'];
          setGuidanceMessage(`${positionNames[currentPosition]} view not captured. Moving to next position in 3 seconds...`);
          
          // Wait 3 seconds to show the message, then move to next position
          setTimeout(() => {
            setStatus('ready');
            setShowGuidance(false);
            completePosition();
          }, 3000);
        }
        
        clearInterval(detectionInterval);
      }, 15000); // Increased to 15 seconds for real-world movement
      
      return () => {
        clearInterval(detectionInterval);
        if (detectionTimerRef.current) {
          clearTimeout(detectionTimerRef.current);
        }
        if (greenDelayRef.current) {
          clearTimeout(greenDelayRef.current);
          greenDelayRef.current = null;
        }
      };
    }

    return () => {
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
      }
      if (greenDelayRef.current) {
        clearTimeout(greenDelayRef.current);
        greenDelayRef.current = null;
      }
    };
  }, [status, currentPosition, model, modelLoading, showTutorial]);

  // Car detection function
  const detectCar = useCallback(async () => {
    if (!model || !webcamRef.current) {
      console.log('🔍 Car detection: Model or webcam not available');
      return false;
    }
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        console.log('🔍 Car detection: No screenshot available');
        return false;
      }
      
      console.log('🔍 Car detection: Starting detection for position', currentPosition);
      
      // Create image element
      const img = new Image();
      img.src = imageSrc;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Run detection
      const predictions = await model.detect(img);
      console.log('🔍 Car detection: Raw predictions:', predictions);
      
      // Look for car, truck, or bus with high confidence
      const carPrediction = predictions.find(pred => 
        (pred.class === 'car' || pred.class === 'truck' || pred.class === 'bus') && 
        pred.score > 0.7
      );
      
      if (carPrediction) {
        console.log('🚗 Car detected! Class:', carPrediction.class, 'Confidence:', carPrediction.score);
        setCarDetected(true);
        return true;
      } else {
        console.log('❌ No car detected. Available objects:', predictions.map(p => `${p.class}(${p.score.toFixed(2)})`));
        setCarDetected(false);
        return false;
      }
    } catch (error) {
      console.error('🔍 Car detection error:', error);
      return false;
    }
  }, [model, currentPosition]);

  // Store detectCar function in ref to avoid circular dependency
  useEffect(() => {
    detectCarRef.current = detectCar;
  }, [detectCar]);

  // Auto-advancement is now handled in the detection phase
  // This useEffect is no longer needed since we auto-advance from detection

  // Legacy recording timer removed; detection + countdown handles flow

  const completePosition = useCallback(() => {
    console.log('✅ Completing position:', currentPosition);
    
    // Prevent multiple completions
    if (currentPosition >= POSITIONS.length || completedPositions.includes(currentPosition)) {
      console.log('⚠️ Position already completed, skipping');
      return;
    }
    
    setCompletedPositions(prev => [...prev, currentPosition]);
    
    if (currentPosition < POSITIONS.length - 1) {
      // Move to next position
      const nextPosition = currentPosition + 1;
      console.log('🔄 Moving to next position:', nextPosition);
      setCurrentPosition(prev => prev + 1);
      // Pause detection to give the user time to move to the next side
      setStatus('ready');
      // reset any previous pacing timers (no-op now)
      
      // Reset completion state for next position
      setCompletionTriggered(false);
      setCarDetected(false);
      
      // Update recordingPhase to match mobile app
      if (nextPosition === 1) {
        console.log('🔄 Setting recordingPhase to: right');
        setRecordingPhase('right');
      } else if (nextPosition === 2) {
        console.log('🔄 Setting recordingPhase to: back');
        setRecordingPhase('back');
      } else if (nextPosition === 3) {
        console.log('🔄 Setting recordingPhase to: left');
        setRecordingPhase('left');
      }
      
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
      
      // Give the user 4 seconds to move before detection resumes
      setTimeout(() => {
        // After guidance period, return to detection and switch stencil back to red
        setShowGuidance(false);
        setIsStencilGreen(false);
        setStatus('detecting');
      }, 4000);
    } else {
      // All positions completed
      console.log('🎉 All positions completed!');
      setRecordingPhase('complete');
      // Persist recent claim IDs for dashboard use
      try {
        const mapJson = localStorage.getItem('claimsByPosition');
        if (mapJson) {
          const map = JSON.parse(mapJson) as Record<Position, number | null>;
          const ids = Object.values(map).filter((v): v is number => typeof v === 'number');
          localStorage.setItem('recentClaimIds', JSON.stringify(ids));
        }
      } catch {}
      onComplete();
    }
  }, [currentPosition, onComplete]);

  const triggerCaptureAndUpload = useCallback(async () => {
    try {
      if (!webcamRef.current) {
        completePosition();
        return;
      }
      // Take snapshot immediately after turning green (no countdown)
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        completePosition();
        return;
      }

      // Upload flow
      setIsUploading(true);
      setGuidanceMessage('Keep steady');
      setShowGuidance(true);
      const fileName = `${POSITIONS[currentPosition].id}-${Date.now()}.jpg`;
      const contentType = 'image/jpeg';
      const { presignedUrl, fileKey, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      const blob = await dataUrlToJpegBlob(imageSrc);
      await uploadFileToS3({ presignedUrl, file: blob, contentType });
      const result = await startS3Processing({
        carMake: vehicleDetails?.make || 'Unknown',
        carModel: vehicleDetails?.model || 'Unknown',
        imageUrl: s3Url,
        fileKey,
      });

      // Save claimId mapped to position in localStorage
      const pos = POSITIONS[currentPosition].id;
      try {
        const mapJson = localStorage.getItem('claimsByPosition');
        const currentMap: Record<Position, number | null> = mapJson ? JSON.parse(mapJson) : { front: null, right: null, back: null, left: null };
        currentMap[pos] = result.claimId;
        localStorage.setItem('claimsByPosition', JSON.stringify(currentMap));
      } catch {}

      setGuidanceMessage(`${POSITIONS[currentPosition].label} snapshot captured!`);
      setShowGuidance(true);
    } catch (err) {
      console.error('Capture/upload error:', err);
      setGuidanceMessage('Failed to upload snapshot. Moving to next.');
      setShowGuidance(true);
    } finally {
      setIsUploading(false);
      // Proceed to next position and give the user a few seconds via guidance in completePosition
      completePosition();
    }
  }, [currentPosition, vehicleDetails, completePosition]);



  const getStatusColor = () => {
    // Green only after the 2s UX delay has elapsed
    return isStencilGreen ? '#4CAF50' : '#e53935';
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
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            } 
          });
          stream.getTracks().forEach(track => track.stop());
          setCameraPermission('granted');
        } catch (error: any) {
          setCameraError(error.message || 'Failed to access camera');
          setCameraPermission('denied');
          setShowPermissionRequest(true);
        }
      };
      requestCameraPermission();
    }, 100);
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

  // Show orientation prompt for mobile devices in portrait mode
  if (showOrientationPrompt) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md mx-4 text-center"
          >
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="text-4xl">📱</div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Rotate Your Device</h2>
            <p className="text-gray-300 mb-6">
              For the best car damage analysis experience, please rotate your device to landscape mode.
            </p>
            
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 mb-6">
              <h3 className="text-orange-400 font-semibold mb-2">Why Landscape Mode?</h3>
              <div className="text-left text-sm text-gray-300 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                  <span>Better camera view for car recording</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                  <span>More accurate stencil alignment</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                  <span>Professional recording experience</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowOrientationPrompt(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl"
              >
                Continue in Portrait (Not Recommended)
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

    // Check if user can perform assessment
    if (!canPerformAssessment) {
      return (
        <div className="relative w-full h-screen bg-black overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md mx-4 text-center"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Upload Limit Reached</h2>
              <p className="text-gray-300 mb-6">
                You don't have enough uploads remaining to perform a complete car damage assessment. 
                Each assessment requires 4 uploads.
              </p>
              
              {limitInfo && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
                  <div className="text-left text-sm text-gray-300 space-y-2">
                    <div className="flex justify-between">
                      <span>Remaining uploads:</span>
                      <span className="text-red-400 font-semibold">{limitInfo.stats.remainingUploads}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Required for assessment:</span>
                      <span className="text-white font-semibold">4</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onBack}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl"
                >
                  Go Back
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      );
    }

    return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Simple Camera - No Transforms, No Scaling */}
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
            setCameraError(typeof error === 'string' ? error : error.message || 'Camera access failed');
            setCameraPermission('denied');
            setShowPermissionRequest(true);
          }}
        />
      </div>
      {status === 'detecting' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 25 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              right: 0,
              width: '100%',
              height: '100%',
              borderRadius: 0,
              borderWidth: 0,
              borderColor: 'transparent',
              backgroundColor: 'rgba(0,0,0,0.04)',
              alignItems: 'stretch',
              justifyContent: 'center',
              zIndex: 20
            }}
          >
            <img
              src={currentPosData.image}
              alt={`${currentPosData.label} stencil`}
              style={{
                width: '100%',
                height: '100%',
                alignSelf: 'stretch',

                ...(currentPosition === 2 && {
                  height: '100%',
                  width: '70%',
                  marginLeft: '15%'
                }),
                filter: `drop-shadow(0 0 20px ${getStatusColor()}) brightness(0) saturate(100%) ${getStatusColor() === '#4CAF50' ? 'invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg) brightness(118%) contrast(119%)' : 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)'}`,
                opacity: 1,
                objectFit: currentPosition === 0 || currentPosition === 2 ? 'fill' : 'cover'
              }}
            />
          </motion.div>
        </div>
      )}

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-5 left-5 w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-50"
      >
        <ArrowLeft className="w-7 h-7" style={{ color: '#43cea2' }} />
      </motion.button>

      {/* Help Button */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setShowTutorial(true)}
        className="absolute top-5 right-5 w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors z-50"
      >
        <HelpCircle className="w-7 h-7" style={{ color: '#43cea2' }} />
      </motion.button>



      {/* Progress Indicator */}
      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full z-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Step {currentPosition + 1} of 4</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((pos) => (
              <div
                key={pos}
                className={`w-2 h-2 rounded-full ${
                  pos < currentPosition 
                    ? 'bg-green-500' 
                    : pos === currentPosition 
                    ? isStencilGreen ? 'bg-green-500' : 'bg-red-500'
                    : 'bg-gray-500'
                }`}
              />
            ))}
          </div>
        </div>
      </div>


      {/* Uploading indicator intentionally omitted; we show 'Keep steady' guidance instead */}

      {/* Clean Guidance Message */}
      <AnimatePresence>
        {showGuidance && guidanceMessage && (
          guidanceMessage === 'Keep steady' ? (
            <motion.div
              key="keep-steady"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-green-500/10 blur-md animate-pulse" />
                <div className="relative flex items-center gap-3 bg-black/70 text-white px-5 py-3 rounded-full shadow-lg border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Hand className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-sm font-semibold tracking-wide">Keep steady</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="guidance-generic"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-4 rounded-2xl shadow-lg z-50"
              style={{
                maxWidth: '80%',
                textAlign: 'center'
              }}
            >
              <p className="text-white text-base font-semibold tracking-wide">
                {guidanceMessage}
              </p>
            </motion.div>
          )
        )}
      </AnimatePresence>


 
            {/* Tutorial Overlay */}
      <AnimatePresence>
        {showTutorial && (
          <CameraTutorial
            onComplete={() => setShowTutorial(false)}
            onSkip={() => setShowTutorial(false)}
          />
        )}
      </AnimatePresence>

      {/* Tutorial Active Indicator */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full z-40"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold">Tutorial Active - Detection Paused</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CameraScreen;
