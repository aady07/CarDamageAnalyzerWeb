import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { ArrowLeft, AlertTriangle, HelpCircle, Brain, ArrowRight, Play } from 'lucide-react';
import { getPresignedUploadUrl, uploadFileToS3, dataUrlToJpegBlob } from '../services/api/uploadService';
import { getVideoPresignedUploadUrl, uploadVideoToS3 } from '../services/api/videoUploadService';
import { submitCarInspection } from '../services/api/carInspectionService';
import SuccessScreen from './SuccessScreen';

console.log('🎥 CAMERA SCREEN: Video upload service imported:', { getVideoPresignedUploadUrl, uploadVideoToS3 });

interface CameraScreenProps {
  vehicleDetails: { make: string; model: string; regNumber: string } | null;
  onComplete: () => void;
  onBack: () => void;
}

type ScanStatus = 'idle' | 'recording' | 'processing' | 'completed' | 'error';
type CapturePhase = 'front' | 'left' | 'back' | 'right';

interface CaptureData {
  phase: CapturePhase;
  label: string;
  instruction: string;
  timing: number; // seconds
  color: string;
  icon: React.ReactNode;
}

const CAPTURE_PHASES: CaptureData[] = [
  { 
    phase: 'front', 
    label: 'FRONT VIEW', 
    instruction: 'Hold steady for 2 seconds',
    timing: 5, // 5 second delay before first capture
    color: '#00D4FF',
    icon: <ArrowRight className="w-6 h-6" />
  },
  { 
    phase: 'left', 
    label: 'LEFT SIDE', 
    instruction: 'Move to the left of the car',
    timing: 20, // 15 seconds after first capture (5s + 10s movement + 5s hold)
    color: '#8B5CF6',
    icon: <ArrowRight className="w-6 h-6 -rotate-90" />
  },
  { 
    phase: 'back', 
    label: 'REAR VIEW', 
    instruction: 'Move to the rear',
    timing: 40, // 20 seconds after second capture (20s + 15s movement + 5s hold)
    color: '#FF6B35',
    icon: <ArrowRight className="w-6 h-6 rotate-180" />
  },
  { 
    phase: 'right', 
    label: 'RIGHT SIDE', 
    instruction: 'Move to the right of the car',
    timing: 60, // 20 seconds after third capture (40s + 15s movement + 5s hold)
    color: '#00FF88',
    icon: <ArrowRight className="w-6 h-6 rotate-90" />
  }
];

const CameraScreen: React.FC<CameraScreenProps> = ({ vehicleDetails, onComplete, onBack }) => {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ inspectionId: number; registrationNumber: string; estimatedTime: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [cameraError, setCameraError] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [showOrientationPrompt, setShowOrientationPrompt] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  
  // New state for enhanced UI
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [isHoldSteady, setIsHoldSteady] = useState(false);
  const [showMovementAnimation, setShowMovementAnimation] = useState(false);
  const [cameraBlurred, setCameraBlurred] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showOrientationTip, setShowOrientationTip] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const captureTimersRef = useRef<NodeJS.Timeout[]>([]);
  const startTimeRef = useRef<number>(0);
  const capturedImagesRef = useRef<{ [key in CapturePhase]?: string }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);


  // Detect mobile device and check orientation
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    
    const checkOrientation = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight;
      if (isMobile && !isLandscapeMode) {
        setShowOrientationPrompt(true);
      } else {
        setShowOrientationPrompt(false);
      }
    };

    const lockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (error) {
        console.log('Could not lock orientation:', error);
      }
    };

    const unlockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          await screen.orientation.unlock();
        }
      } catch (error) {
        console.log('Could not unlock orientation:', error);
      }
    };

    checkMobile();
    checkOrientation();

    const handleOrientationChange = () => {
      setTimeout(checkOrientation, 100);
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    const requestCameraPermission = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera not supported in this browser');
          setCameraPermission('denied');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        
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

    const timer = setTimeout(() => {
      requestCameraPermission();
      lockOrientation();
    }, 500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      unlockOrientation();
    };
  }, [isMobile]);

  // Cleanup timers on unmount
  // Check orientation on mount and when it changes
  useEffect(() => {
    const checkOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      
      // Show tip if in portrait and user hasn't dismissed it
      if (!landscape && !localStorage.getItem('orientation-tip-dismissed')) {
        setShowOrientationTip(true);
      }
    };

    // Check on mount
    checkOrientation();

    // Listen for orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
      
      return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      captureTimersRef.current.forEach(timer => clearTimeout(timer));
      
      // Stop video recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startVideoRecording = useCallback(async () => {
    try {
      if (!webcamRef.current?.video) return;

      const stream = webcamRef.current.video.srcObject as MediaStream;
      if (!stream) return;

      videoStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/mp4;codecs=h264') 
          ? 'video/mp4;codecs=h264' 
          : 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      console.log('Video recording started');
    } catch (error) {
      console.error('Failed to start video recording:', error);
    }
  }, []);

  const stopVideoRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=h264') 
          ? 'video/mp4' 
          : 'video/webm';
        const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        console.log('Video recording stopped, blob size:', videoBlob.size);
        resolve(videoBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const startScan = useCallback(async () => {
    setStatus('recording');
    setRecordingTime(0);
    setCurrentPhase(0);
    capturedImagesRef.current = {};
    startTimeRef.current = Date.now();
    setCameraBlurred(false); // Remove blur when scan starts
    setShowOrientationTip(false); // Hide orientation tip when scanning starts

    // Start video recording
    await startVideoRecording();

    // Start recording timer
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        return Math.floor(elapsed);
      });
    }, 100);

        // Enhanced capture flow with better instruction timing
        CAPTURE_PHASES.forEach((phase, index) => {
          if (index === 0) {
            // First phase: Just hold steady
            const holdTimer = setTimeout(() => {
              setCurrentInstruction('Hold steady');
              setIsHoldSteady(true);
              setShowMovementAnimation(false);
            }, Math.max(0, phase.timing - 2) * 1000);

            const captureTimer = setTimeout(() => {
              captureImage(phase.phase, phase.timing);
              setCurrentPhase(index);
              setCurrentInstruction('Front captured!');
              setIsHoldSteady(false);
              
              // Clear instruction after 2 seconds
      setTimeout(() => {
                setCurrentInstruction('');
      }, 2000);
            }, phase.timing * 1000);
            
            captureTimersRef.current.push(holdTimer, captureTimer);
          } else {
            // Subsequent phases: Move → Hold → Capture
            const moveTimer = setTimeout(() => {
              setCurrentInstruction(`${phase.instruction} `);
              setShowMovementAnimation(true);
              setIsHoldSteady(false);
            }, Math.max(0, phase.timing - 12) * 1000);

            const holdTimer = setTimeout(() => {
              setCurrentInstruction('Hold steady');
              setIsHoldSteady(true);
              setShowMovementAnimation(false);
            }, Math.max(0, phase.timing - 2) * 1000);

            const captureTimer = setTimeout(() => {
              captureImage(phase.phase, phase.timing);
              setCurrentPhase(index);
              
              // Set proper capture message based on phase
              let captureMessage = '';
              switch (phase.phase) {
                case 'front':
                  captureMessage = 'Front captured!';
                  break;
                case 'left':
                  captureMessage = 'Left captured!';
                  break;
                case 'back':
                  captureMessage = 'Back captured!';
                  break;
                case 'right':
                  captureMessage = 'Right captured!';
                  break;
                default:
                  captureMessage = `${phase.label} captured!`;
              }
              
              setCurrentInstruction(captureMessage);
              setIsHoldSteady(false);
              
              // Clear instruction after 2 seconds
      setTimeout(() => {
                setCurrentInstruction('');
      }, 2000);
              
              // Stop video recording after last image is captured
              if (index === CAPTURE_PHASES.length - 1) {
                setTimeout(() => {
                  completeScan();
                }, 2000); // Wait 2 seconds after last capture
              }
            }, phase.timing * 1000);
            
            captureTimersRef.current.push(moveTimer, holdTimer, captureTimer);
          }
        });
  }, [startVideoRecording]);

  const captureImage = useCallback(async (phase: CapturePhase, captureTime: number) => {
    try {
      if (!webcamRef.current) return;

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      // Store in ref
      capturedImagesRef.current[phase] = imageSrc;

      console.log(`Captured ${phase} image at ${captureTime}s`);
    } catch (error) {
      console.error(`Failed to capture ${phase} image:`, error);
    }
  }, []);

  const completeScan = useCallback(async () => {
      setStatus('processing');
      setShowOrientationTip(false); // Hide orientation tip during processing
    
    // Clear all timers
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    captureTimersRef.current.forEach(timer => clearTimeout(timer));
    captureTimersRef.current = [];

    try {
      console.log('Captured images from ref:', capturedImagesRef.current);
      console.log('Vehicle details:', vehicleDetails);
      
      // Stop video recording and get the blob
      const videoBlob = await stopVideoRecording();
      
      // Upload video to S3 using video upload service
      let videoUrl = '';
      if (videoBlob) {
        const isMp4Supported = MediaRecorder.isTypeSupported('video/mp4;codecs=h264');
        const videoFileName = `inspection_video-${Date.now()}.${isMp4Supported ? 'mp4' : 'webm'}`;
        const videoContentType = isMp4Supported ? 'video/mp4' : 'video/webm';
        
        console.log('🎥 Calling VIDEO upload endpoint with:', { videoFileName, videoContentType });
        
        const { presignedUrl: videoPresignedUrl, s3Url: videoS3Url } = await getVideoPresignedUploadUrl({ 
          fileName: videoFileName, 
          contentType: videoContentType 
        });
        
        console.log('🎥 Video presigned URL received:', videoPresignedUrl);
        console.log('🎥 Video S3 URL:', videoS3Url);
        
        await uploadVideoToS3({ 
          presignedUrl: videoPresignedUrl, 
          file: videoBlob, 
          contentType: videoContentType 
        });
        
        videoUrl = videoS3Url;
        console.log('🎥 Video uploaded to S3:', videoUrl);
      }
      
      // Upload all captured images to S3
      const imageUrls: { type: CapturePhase; imageUrl: string }[] = [];
      
      for (const [phase, imageSrc] of Object.entries(capturedImagesRef.current)) {
        if (imageSrc) {
          const fileName = `car_${phase}-${Date.now()}.jpg`;
      const contentType = 'image/jpeg';
          
          const { presignedUrl, s3Url } = await getPresignedUploadUrl({ fileName, contentType });
      const blob = await dataUrlToJpegBlob(imageSrc);
      await uploadFileToS3({ presignedUrl, file: blob, contentType });
          
          imageUrls.push({
            type: phase as CapturePhase,
            imageUrl: s3Url
          });
        }
      }

      console.log('Uploaded images:', imageUrls);

      // Submit car inspection with video URL
      if (imageUrls.length === 4 && vehicleDetails?.regNumber && videoUrl) {
        const response = await submitCarInspection({
          registrationNumber: vehicleDetails.regNumber,
          images: imageUrls,
          videoUrl: videoUrl
        });

        setSuccessData({
          inspectionId: response.inspectionId,
          registrationNumber: response.registrationNumber,
          estimatedTime: '1-2 hours' // Default since new API doesn't have this field
        });
        setShowSuccess(true);
    } else {
        throw new Error(`Missing images (${imageUrls.length}/4), video (${videoUrl ? 'yes' : 'no'}), or registration number (${vehicleDetails?.regNumber})`);
      }
    } catch (error) {
      console.error('Scan completion error:', error);
      setStatus('error');
    }
  }, [vehicleDetails, stopVideoRecording]);

  const resetScan = useCallback(() => {
    setStatus('idle');
    setCurrentPhase(0);
    setRecordingTime(0);
    capturedImagesRef.current = {};
    recordedChunksRef.current = [];
    setShowSuccess(false);
    setSuccessData(null);
    
    // Reset new UI state
    setCurrentInstruction('');
    setIsHoldSteady(false);
    setShowMovementAnimation(false);
    setCameraBlurred(true);
    
    // Clear all timers
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    captureTimersRef.current.forEach(timer => clearTimeout(timer));
    captureTimersRef.current = [];
    
    // Stop video recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Handle camera permission retry
  const handleRetryCamera = () => {
    setCameraPermission('pending');
    setCameraError('');
    setShowPermissionRequest(false);
    
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

  // Show success screen
  if (showSuccess && successData) {
    return (
      <SuccessScreen
        inspectionId={successData.inspectionId}
        registrationNumber={successData.registrationNumber}
        estimatedTime={successData.estimatedTime}
        onBack={onComplete}
      />
    );
  }

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
              This app needs camera access to scan your car. Please allow camera permission in your browser settings.
            </p>
            
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
              For the best car scanning experience, please rotate your device to landscape mode.
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
                  <span>More accurate analysis</span>
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


  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Camera Feed */}
      <div className="absolute inset-0">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className={`w-full h-full object-cover transition-all duration-500 ${cameraBlurred ? 'blur-md' : ''}`}
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
        
        {/* Camera Blur Overlay */}
        {cameraBlurred && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm">
            {/* Top Section - Instructions */}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center px-4">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl px-6 py-4 border border-white/20"
              >
                <h3 className="text-xl font-bold text-white mb-2">Ready to Scan</h3>
                <p className="text-white/80 text-sm">Follow the guided movement instructions</p>
              </motion.div>
      </div>

            {/* Center Section - Visual Cue */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-full flex items-center justify-center border border-white/20"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                >
                  <Play className="w-8 h-8 text-white ml-1" />
                </motion.div>
              </motion.div>
            </div>

            {/* Bottom Section - Primary Action */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-sm px-4">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startScan}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl shadow-2xl flex items-center justify-center gap-3 transition-all duration-200"
              >
                <Play className="w-6 h-6" />
                <span className="text-lg">Start Scan</span>
              </motion.button>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center text-white/60 text-sm mt-3"
              >
                Tap "Start Scan" to begin recording
              </motion.p>
            </div>
          </div>
        )}
      </div>

      {/* Processing Overlay */}
      {status === 'processing' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-32 h-32 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <Brain className="w-16 h-16 text-blue-400 animate-pulse" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-6">PROCESSING</h3>
            <p className="text-white/80 text-lg">Uploading video and submitting inspection...</p>
          </motion.div>
        </div>
      )}

      {/* Error Overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <AlertTriangle className="w-16 h-16 text-red-400" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-6">SCAN FAILED</h3>
            <p className="text-white/80 text-lg mb-8">Something went wrong during the scan process.</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={resetScan}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl"
            >
              Try Again
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-5 left-5 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200 z-50"
      >
        <ArrowLeft className="w-7 h-7" />
      </motion.button>

      {/* Help Button */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setShowTutorial(true)}
        className="absolute top-5 right-5 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200 z-50"
      >
        <HelpCircle className="w-7 h-7" />
      </motion.button>

      {/* Recording Timer */}
      {status === 'recording' && (
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-red-500/20 backdrop-blur-lg text-white px-6 py-3 rounded-full z-50 border border-red-500/30">
        <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="font-bold">RECORDING</span>
            <span className="font-mono">{recordingTime}s</span>
          </div>
        </div>
      )}

      {/* Progress Ring */}
      {status === 'recording' && (
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - recordingTime / 30)}`}
                className="text-blue-400 transition-all duration-100"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Percentage text removed - just the circular bar */}
            </div>
        </div>
      </div>
      )}

      {/* Enhanced Instructions - Strategic Positioning */}
      {status === 'recording' && currentInstruction && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
        <motion.div
            key={currentInstruction}
            initial={{ opacity: 0, y: -30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`backdrop-blur-xl rounded-3xl px-6 py-5 border-2 shadow-2xl ${
              isHoldSteady 
                ? 'bg-red-500/30 border-red-400/60 text-red-50 shadow-red-500/20' 
                : currentInstruction.includes('captured')
                ? 'bg-green-500/30 border-green-400/60 text-green-50 shadow-green-500/20'
                : 'bg-blue-500/30 border-blue-400/60 text-blue-50 shadow-blue-500/20'
            }`}
          >
            <div className="text-center">
              {/* Animated Icon */}
              <motion.div
                animate={isHoldSteady ? { 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                } : currentInstruction.includes('captured') ? {
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                } : showMovementAnimation ? {
                  x: [-15, 15, -15],
                  scale: [1, 1.1, 1]
                } : {
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  duration: isHoldSteady ? 0.8 : currentInstruction.includes('captured') ? 0.6 : showMovementAnimation ? 1.5 : 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="mb-3"
              >
                {isHoldSteady ? (
                  <div className="w-12 h-12 bg-red-500/40 rounded-full flex items-center justify-center mx-auto border-2 border-red-400/50">
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="w-6 h-6 bg-red-300 rounded-full"
                    />
              </div>
                ) : currentInstruction.includes('captured') ? (
                  <div className="w-12 h-12 bg-green-500/40 rounded-full flex items-center justify-center mx-auto border-2 border-green-400/50">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="text-2xl text-green-200"
                    >
                      ✓
                    </motion.div>
            </div>
                ) : showMovementAnimation ? (
                  <div className="w-12 h-12 bg-blue-500/40 rounded-full flex items-center justify-center mx-auto border-2 border-blue-400/50">
                    <motion.div
                      animate={{ x: [-8, 8, -8] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-2xl text-blue-200"
                    >
                      →
                    </motion.div>
            </div>
                ) : (
                  <div className="w-12 h-12 bg-blue-500/40 rounded-full flex items-center justify-center mx-auto border-2 border-blue-400/50">
                    <Play className="w-6 h-6 text-blue-200" />
          </div>
                )}
        </motion.div>
              
              {/* Instruction Text */}
              <motion.h3 
                animate={isHoldSteady ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.5, repeat: isHoldSteady ? Infinity : 0 }}
                className={`font-bold text-xl mb-2 ${
                  isHoldSteady 
                    ? 'text-red-100' 
                    : currentInstruction.includes('captured')
                    ? 'text-green-100'
                    : 'text-blue-100'
                }`}
              >
                {currentInstruction}
              </motion.h3>
              
              {/* Progress Bar for Hold Steady */}
              {isHoldSteady && (
                <div className="mt-3">
          <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="h-2 bg-red-400/60 rounded-full overflow-hidden"
                  >
                    <motion.div
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="h-full w-1/3 bg-red-300 rounded-full"
                    />
                  </motion.div>
                </div>
                  )}
                </div>
          </motion.div>
        </div>
      )}

      {/* Capture Progress - Subtle Bottom Indicator */}
      {status === 'recording' && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex gap-2 bg-black/30 backdrop-blur-lg rounded-full px-4 py-2 border border-white/10">
            {CAPTURE_PHASES.map((phase, index) => (
              <motion.div
                key={phase.phase}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ 
                  scale: index <= currentPhase ? 1.1 : 0.8,
                  opacity: index <= currentPhase ? 1 : 0.4
                }}
                transition={{ duration: 0.3 }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index < currentPhase 
                    ? 'bg-green-400 shadow-lg shadow-green-400/50' 
                    : index === currentPhase
                    ? 'bg-blue-400 shadow-lg shadow-blue-400/50'
                    : 'bg-white/30'
                }`}
              />
            ))}
              </div>
            </div>
        )}


      {/* Orientation Tip */}
      <AnimatePresence>
        {showOrientationTip && (
          <div className="absolute top-4 left-4 right-4 z-[90]">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-4 border border-blue-400/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📱</div>
                  <div>
                    <p className="text-blue-100 font-semibold text-sm">Better Experience</p>
                    <p className="text-blue-200 text-xs">Rotate to landscape for easier scanning</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowOrientationTip(false);
                    localStorage.setItem('orientation-tip-dismissed', 'true');
                  }}
                  className="text-blue-300 hover:text-blue-100 text-xl"
                >
                  ×
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tutorial Overlay */}
      <AnimatePresence>
        {showTutorial && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-lg z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 md:p-10 max-w-lg mx-4 text-center border border-white/20 my-8"
            >
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                <Brain className="w-12 h-12 text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-6">AI-Powered Car Scan</h2>
              <p className="text-gray-300 text-base md:text-lg mb-6">
                Our intelligent system will guide you through a complete 360° scan of your vehicle. 
                Follow the movement instructions for 10 seconds, then hold steady for 2 seconds while we capture each view.
              </p>
              
              {/* Orientation Recommendation */}
              {!isLandscape && (
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📱</span>
                    <h3 className="text-orange-300 font-bold text-lg">Pro Tip</h3>
                  </div>
                  <p className="text-orange-200 text-sm">
                    Landscape mode provides a better scanning experience, but portrait works too!
                  </p>
                </div>
              )}
              
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 md:p-6 mb-6">
                <h3 className="text-blue-400 font-bold mb-4 text-lg md:text-xl">How it works:</h3>
                <div className="text-left text-gray-300 space-y-3 text-sm md:text-base">
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-500 text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 mt-0.5">1</span>
                    <span>Tap "Start Scan" to begin recording</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-500 text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 mt-0.5">2</span>
                    <span>Follow the guided movement instructions</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-500 text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 mt-0.5">3</span>
                    <span>Hold steady when prompted for clear captures</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-500 text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 mt-0.5">4</span>
                    <span>Complete all 4 views for full analysis</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowTutorial(false)}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl"
                >
                  Start Analysis
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onBack}
                  className="w-full bg-white/10 border border-white/20 text-white font-semibold py-4 px-8 rounded-2xl"
                >
                  Go Back
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CameraScreen;