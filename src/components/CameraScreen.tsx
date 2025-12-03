import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { ArrowLeft, AlertTriangle, HelpCircle, Brain, Play, TestTube } from 'lucide-react';
import { getVideoPresignedUploadUrl, uploadVideoToS3 } from '../services/api/videoUploadService';
import { submitCarInspection } from '../services/api/carInspectionService';
import SuccessScreen from './SuccessScreen';
import { CaptureSegment, CaptureSegmentId, SegmentStatus } from '../types/capture';
import { ImageStorageStrategy, S3ImageStorageStrategy, StoredImageReference } from '../services/storage/imageStorageStrategy';

// Pushover notification function
const sendPushoverNotification = async (message: string) => {
  try {
    const formData = new FormData();
    formData.append('token', 'am7q7d134rotjhinmb6edcoqfz4co8');
    formData.append('user', 'udhd2hsu4ayu6t5i8qvp4u83devxbr');
    formData.append('message', message);
    formData.append('title', 'Car Inspection Alert');
    formData.append('priority', '0');

    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body: formData
    });
  } catch (error) {
    // Silent fail - don't interrupt user flow
  }
};


interface CameraScreenProps {
  vehicleDetails: { make: string; model: string; regNumber: string } | null;
  onComplete: () => void;
  onBack: () => void;
  imageStorageStrategy?: ImageStorageStrategy;
}

type ScanStatus = 'idle' | 'recording' | 'processing' | 'completed' | 'error';
const CAPTURE_SEGMENTS: CaptureSegment[] = [
  {
    id: 'front',
    label: 'Front View',
    instruction: 'Align the front bumper and headlights inside the stencil',
    timing: 5,
    iconRotation: 0
  },
  {
    id: 'rear',
    label: 'Rear View',
    instruction: 'Move behind the car and align the rear bumper',
    timing: 15,
    iconRotation: 180
  },
  {
    id: 'right_front_fender',
    label: 'Right Front Fender',
    instruction: 'Step to the right front corner and cover the fender',
    timing: 25,
    iconRotation: 90
  },
  {
    id: 'right_front_door',
    label: 'Right Front Door',
    instruction: 'Slide along the passenger door and keep it centered',
    timing: 35,
    iconRotation: 90
  },
  {
    id: 'right_rear_door',
    label: 'Right Rear Door',
    instruction: 'Align the rear passenger door in the stencil',
    timing: 45,
    iconRotation: 90
  },
  {
    id: 'right_rear_fender',
    label: 'Right Rear Fender',
    instruction: 'Capture the rear quarter panel on the right side',
    timing: 55,
    iconRotation: 90
  },
  {
    id: 'left_rear_fender',
    label: 'Left Rear Fender',
    instruction: 'Move to the left rear corner and align the fender',
    timing: 65,
    iconRotation: -90
  },
  {
    id: 'left_rear_door',
    label: 'Left Rear Door',
    instruction: 'Slide along the left rear door and keep it centered',
    timing: 75,
    iconRotation: -90
  },
  {
    id: 'left_front_door',
    label: 'Left Front Door',
    instruction: 'Capture the driver door from the side',
    timing: 85,
    iconRotation: -90
  },
  {
    id: 'left_front_fender',
    label: 'Left Front Fender',
    instruction: 'Finish at the left front corner and align the fender',
    timing: 95,
    iconRotation: -90
  }
];

const TOTAL_CAPTURE_DURATION = CAPTURE_SEGMENTS[CAPTURE_SEGMENTS.length - 1].timing + 5;

// Stencil images mapping - Flow: Front → Right side → Rear → Left side
const STENCIL_IMAGES = [
  { id: 'front', path: '/Front.png', label: 'Front View' },
  { id: 'right_front_fender', path: '/Right_front_fender.png', label: 'Right Front Fender' },
  { id: 'right_front_door', path: '/Right_front_door.png', label: 'Right Front Door' },
  { id: 'right_rear_door', path: '/Right_rear_door.png', label: 'Right Rear Door' },
  { id: 'right_rear_fender', path: '/Right_rear_fender.png', label: 'Right Rear Fender' },
  { id: 'rear', path: '/Rear.png', label: 'Rear View' },
  { id: 'left_rear_fender', path: '/Left_rear_fender.png', label: 'Left Rear Fender' },
  { id: 'left_rear_door', path: '/Left_rear_door.png', label: 'Left Rear Door' },
  { id: 'left_front_door', path: '/Left_front_door.png', label: 'Left Front Door' },
  { id: 'left_front_fender', path: '/Left_front_fender.png', label: 'Left Front Fender' }
];

const getInitialSegmentStatuses = (): Record<CaptureSegmentId, SegmentStatus> => {
  const statuses = {} as Record<CaptureSegmentId, SegmentStatus>;
  CAPTURE_SEGMENTS.forEach((segment, index) => {
    statuses[segment.id] = index === 0 ? 'capturing' : 'pending';
  });
  return statuses;
};

const TESTING_MODE_KEY = 'camera_testing_bypass_enabled';

const CameraScreen: React.FC<CameraScreenProps> = ({ vehicleDetails, onComplete, onBack, imageStorageStrategy }) => {
  // Check for testing mode bypass
  const [testingMode, setTestingMode] = useState<boolean>(false);
  
  useEffect(() => {
    const saved = localStorage.getItem(TESTING_MODE_KEY);
    setTestingMode(saved === 'true');
  }, []);

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ inspectionId: number; registrationNumber: string; estimatedTime: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [cameraError, setCameraError] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [showOrientationPrompt, setShowOrientationPrompt] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [segmentStatuses, setSegmentStatuses] = useState<Record<CaptureSegmentId, SegmentStatus>>(getInitialSegmentStatuses);
  
  // New state for enhanced UI
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [cameraBlurred, setCameraBlurred] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showOrientationTip, setShowOrientationTip] = useState(false);
  const [currentStencilIndex, setCurrentStencilIndex] = useState(0);
  const [stencilVerified, setStencilVerified] = useState(false);
  const [edgeDensity, setEdgeDensity] = useState(0);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const isAnalyzingRef = useRef<boolean>(false); // Use ref instead of state to avoid recreating function
  const completeScanRef = useRef<(() => Promise<void>) | null>(null); // Store completeScan function to avoid dependency issues
  const stencilImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map()); // Cache loaded stencil images
  const startDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Store timeout for cleanup
  const analyzeEdgeDensityRef = useRef<(() => Promise<{ score: number; brightness: number; motion: number }>) | null>(null); // Store analyzeEdgeDensity to avoid dependency issues
  const captureImageRef = useRef<((segmentId: CaptureSegmentId, segmentIndex: number) => Promise<boolean>) | null>(null); // Store captureImage to avoid dependency issues
  const scoreHistoryRef = useRef<number[]>([]); // Track recent scores for consistency check
  const previousFrameRef = useRef<ImageData | null>(null); // Store previous frame for motion detection
  const captureProgress = Math.min(recordingTime / TOTAL_CAPTURE_DURATION, 1);
  const activeSegment = CAPTURE_SEGMENTS[currentSegmentIndex] ?? CAPTURE_SEGMENTS[0];
  const activeSegmentStatus = segmentStatuses[activeSegment.id];

  // Use the constant stencil images array
  const stencilImages = STENCIL_IMAGES;

  // Get instruction based on current stencil and verification status
  const getCurrentInstruction = useCallback((): string => {
    if (currentStencilIndex >= stencilImages.length) {
      return 'Scan complete!';
    }

    const currentStencil = stencilImages[currentStencilIndex];
    
    // If stencil is verified, show next movement instruction
    if (stencilVerified) {
      const nextIndex = currentStencilIndex + 1;
      if (nextIndex >= stencilImages.length) {
        return 'All parts captured! Processing...';
      }
      
      const nextStencil = stencilImages[nextIndex];
      const instructions: Record<string, string> = {
        'front': 'Move to the right side of the car to show the front fender',
        'right_front_fender': 'Continue along the right side to show the front door',
        'right_front_door': 'Continue to the right rear door',
        'right_rear_door': 'Continue to the right rear fender',
        'right_rear_fender': 'Move to the back of the car',
        'rear': 'Move to the left side of the car to show the rear fender',
        'left_rear_fender': 'Continue along the left side to show the rear door',
        'left_rear_door': 'Continue to the left front door',
        'left_front_door': 'Finish at the left front fender'
      };
      
      return instructions[currentStencil.id] || `Move to ${nextStencil.label}`;
    }
    
    // If not verified, show alignment instruction
    const alignmentInstructions: Record<string, string> = {
      'front': 'Position the front of the car in the frame',
      'right_front_fender': 'Align the right front fender in the frame',
      'right_front_door': 'Align the right front door in the frame',
      'right_rear_door': 'Align the right rear door in the frame',
      'right_rear_fender': 'Align the right rear fender in the frame',
      'rear': 'Position the back of the car in the frame',
      'left_rear_fender': 'Align the left rear fender in the frame',
      'left_rear_door': 'Align the left rear door in the frame',
      'left_front_door': 'Align the left front door in the frame',
      'left_front_fender': 'Align the left front fender in the frame'
    };
    
    return alignmentInstructions[currentStencil.id] || `Align ${currentStencil.label}`;
  }, [currentStencilIndex, stencilVerified, stencilImages]);

  // Edge Detection & Density Analysis Function - Only analyzes INSIDE stencil region
  // Returns: { score: number, brightness: number, motion: number }
  const analyzeEdgeDensity = useCallback(async (): Promise<{ score: number; brightness: number; motion: number }> => {
    if (!webcamRef.current || currentStencilIndex >= stencilImages.length || isAnalyzingRef.current) {
      return { score: 0, brightness: 0, motion: 1 };
    }

    try {
      isAnalyzingRef.current = true;
      
      // Get camera frame
      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) return { score: 0, brightness: 0, motion: 1 };

      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { score: 0, brightness: 0, motion: 1 };

      // Standardize size for processing (smaller = faster)
      const processWidth = 640;
      const processHeight = 480;
      canvas.width = processWidth;
      canvas.height = processHeight;

      // Load camera frame
      const cameraImg = new Image();
      await new Promise<void>((resolve, reject) => {
        cameraImg.onload = () => resolve();
        cameraImg.onerror = () => reject(new Error('Failed to load camera image'));
        cameraImg.src = screenshot;
      });

      // Draw camera frame to canvas
      ctx.drawImage(cameraImg, 0, 0, processWidth, processHeight);
      const cameraData = ctx.getImageData(0, 0, processWidth, processHeight);
      const cameraPixels = cameraData.data;
      
      // Calculate brightness (average luminance of the image)
      let totalBrightness = 0;
      let pixelCount = 0;
      for (let i = 0; i < cameraPixels.length; i += 4) {
        const r = cameraPixels[i];
        const g = cameraPixels[i + 1];
        const b = cameraPixels[i + 2];
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // Normalized 0-1
        totalBrightness += luminance;
        pixelCount++;
      }
      const avgBrightness = totalBrightness / pixelCount;
      
      // Calculate motion by comparing with previous frame
      let motion = 0;
      if (previousFrameRef.current) {
        const prevData = previousFrameRef.current.data;
        let diffSum = 0;
        let diffCount = 0;
        
        // Sample every 10th pixel for performance
        for (let i = 0; i < cameraPixels.length && i < prevData.length; i += 40) {
          const currR = cameraPixels[i];
          const currG = cameraPixels[i + 1];
          const currB = cameraPixels[i + 2];
          const prevR = prevData[i];
          const prevG = prevData[i + 1];
          const prevB = prevData[i + 2];
          
          const currLum = 0.299 * currR + 0.587 * currG + 0.114 * currB;
          const prevLum = 0.299 * prevR + 0.587 * prevG + 0.114 * prevB;
          
          diffSum += Math.abs(currLum - prevLum) / 255; // Normalized difference
          diffCount++;
        }
        motion = diffCount > 0 ? diffSum / diffCount : 1;
      } else {
        motion = 0; // No previous frame, assume no motion
      }
      
      // Store current frame for next comparison
      previousFrameRef.current = new ImageData(
        new Uint8ClampedArray(cameraPixels),
        processWidth,
        processHeight
      );

      // Load stencil image to use as mask - use cache if available
      const stencilPath = stencilImages[currentStencilIndex].path;
      let stencilImg = stencilImageCacheRef.current.get(stencilPath);
      
      if (!stencilImg) {
        // Cache miss - load and cache the image
        stencilImg = new Image();
        await new Promise<void>((resolve, reject) => {
          stencilImg!.onload = () => {
            stencilImageCacheRef.current.set(stencilPath, stencilImg!);
            resolve();
          };
          stencilImg!.onerror = () => reject(new Error('Failed to load stencil image'));
          stencilImg!.src = stencilPath;
        });
      }

      // Draw stencil to canvas to get its mask
      ctx.clearRect(0, 0, processWidth, processHeight);
      ctx.drawImage(stencilImg, 0, 0, processWidth, processHeight);
      const stencilData = ctx.getImageData(0, 0, processWidth, processHeight);
      const stencilPixels = stencilData.data;

      // Redraw camera frame
      ctx.drawImage(cameraImg, 0, 0, processWidth, processHeight);
      const imageData = ctx.getImageData(0, 0, processWidth, processHeight);
      const data = imageData.data;

      // Convert to grayscale
      const grayscale = new Uint8ClampedArray(processWidth * processHeight);
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayscale[i / 4] = gray;
      }

      // Sobel edge detection kernels
      const sobelX = [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
      ];
      const sobelY = [
        -1, -2, -1,
        0, 0, 0,
        1, 2, 1
      ];

      // Apply Sobel operator - ONLY on pixels INSIDE stencil region
      let edgeSum = 0;
      let edgeCount = 0;
      let stencilPixelCount = 0; // Total pixels inside stencil

      for (let y = 1; y < processHeight - 1; y++) {
        for (let x = 1; x < processWidth - 1; x++) {
          const pixelIdx = (y * processWidth + x) * 4;
          const stencilAlpha = stencilPixels[pixelIdx + 3]; // Alpha channel
          
          // Only analyze pixels INSIDE the stencil (where alpha > threshold)
          // Stencil has black outline, so we check for non-transparent areas
          // Lower threshold to catch more of the stencil region
          const isInsideStencil = stencilAlpha > 10; // Threshold for stencil area (lowered for better detection)
          
          if (isInsideStencil) {
            stencilPixelCount++;
            
            let gx = 0;
            let gy = 0;

            // Convolve with Sobel kernels
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * processWidth + (x + kx));
                const grayVal = grayscale[idx];
                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                
                gx += grayVal * sobelX[kernelIdx];
                gy += grayVal * sobelY[kernelIdx];
              }
            }

            // Calculate edge magnitude
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            
            // Threshold for edge detection (lowered for better sensitivity)
            if (magnitude > 25) {
              edgeSum += magnitude;
              edgeCount++;
            }
          }
        }
      }

      // Calculate edge density ONLY within stencil region
      const edgeDensityRatio = stencilPixelCount > 0 ? edgeCount / stencilPixelCount : 0;
      
      // Normalize edge strength (average magnitude of detected edges)
      const avgEdgeStrength = edgeCount > 0 ? edgeSum / edgeCount : 0;
      const normalizedStrength = Math.min(avgEdgeStrength / 255, 1);

      // Combined score: density (60%) + strength (40%)
      const alignmentScore = (edgeDensityRatio * 0.6) + (normalizedStrength * 0.4);
      
      console.log(`[Edge Detection] ${stencilImages[currentStencilIndex].label}:`);
      console.log(`  - Total frame pixels: ${processWidth * processHeight}`);
      console.log(`  - Stencil pixels (inside mask): ${stencilPixelCount} (${((stencilPixelCount / (processWidth * processHeight)) * 100).toFixed(2)}% of frame)`);
      console.log(`  - Edge pixels found: ${edgeCount}`);
      console.log(`  - Edge density (inside stencil only): ${(edgeDensityRatio * 100).toFixed(2)}%`);
      console.log(`  - Edge strength (avg magnitude): ${(normalizedStrength * 100).toFixed(2)}%`);
      console.log(`  - Final alignment score: ${(alignmentScore * 100).toFixed(2)}%`);
      console.log(`  - Status: ${alignmentScore >= 0.15 ? '✓ GOOD' : '✗ NEEDS ALIGNMENT'}`);

      setEdgeDensity(edgeDensityRatio);
      setAlignmentScore(alignmentScore);

      return {
        score: alignmentScore,
        brightness: avgBrightness,
        motion: motion
      };
    } catch (error) {
      console.error('[Edge Detection] Error:', error);
      return { score: 0, brightness: 0, motion: 1 };
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [currentStencilIndex, stencilImages]);

  // Update ref whenever analyzeEdgeDensity changes
  useEffect(() => {
    analyzeEdgeDensityRef.current = analyzeEdgeDensity;
  }, [analyzeEdgeDensity]);
  
  // Reset score history and previous frame when stencil changes
  useEffect(() => {
    scoreHistoryRef.current = [];
    previousFrameRef.current = null;
  }, [currentStencilIndex]);

  // Image capture function - must be defined before useEffect that uses it
  const captureImage = useCallback(
    async (segmentId: CaptureSegmentId, segmentIndex: number): Promise<boolean> => {
      try {
        if (!webcamRef.current) {
          console.error(`[Capture] Webcam not available for ${segmentId}`);
          return false;
        }

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          console.error(`[Capture] Failed to get screenshot for ${segmentId}`);
          return false;
        }

        console.log(`[Capture] Capturing segment: ${segmentId} (${segmentIndex + 1}/${CAPTURE_SEGMENTS.length})`);

        // Set status to verifying
        setSegmentStatuses((prev) => ({ ...prev, [segmentId]: 'verifying' }));

        // Upload image to storage
        const storedReference = await storageStrategyRef.current.persist({
          segmentId,
          dataUrl: imageSrc,
          contentType: 'image/jpeg',
        });

        storedImagesRef.current[segmentId] = storedReference;
        console.log(`[Capture] ✓ Image uploaded for ${segmentId}:`, storedReference.uri);
        console.log(`[Capture] Total images uploaded so far: ${Object.keys(storedImagesRef.current).length}/${CAPTURE_SEGMENTS.length}`);

        // Mark as verified
        setSegmentStatuses((prev) => ({ ...prev, [segmentId]: 'verified' }));
        setCurrentSegmentIndex(segmentIndex);

        return true;
      } catch (error) {
        console.error(`[Capture] Error capturing ${segmentId}:`, error);
        setSegmentStatuses((prev) => ({ ...prev, [segmentId]: 'failed' }));
        return false;
      }
    },
    []
  );

  // Update ref whenever captureImage changes
  useEffect(() => {
    captureImageRef.current = captureImage;
  }, [captureImage]);

  // Continuous edge analysis when recording
  useEffect(() => {
    console.log(`[Edge Detection] useEffect triggered - status: ${status}, stencilIndex: ${currentStencilIndex}/${stencilImages.length}, verified: ${stencilVerified}`);
    
    if (status !== 'recording' || currentStencilIndex >= stencilImages.length) {
      console.log(`[Edge Detection] Stopping analysis - status: ${status}, stencilIndex: ${currentStencilIndex}, total: ${stencilImages.length}`);
      // Clear interval if conditions not met
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      return;
    }

    // Only reset success count when stencil index actually changes
    if (previousStencilIndexRef.current !== currentStencilIndex) {
      console.log(`[Edge Detection] New stencil detected: ${currentStencilIndex} (${stencilImages[currentStencilIndex]?.label}), resetting counter`);
      successCountRef.current = 0;
      previousStencilIndexRef.current = currentStencilIndex;
    }

    // Don't start if already verified
    if (stencilVerified) {
      console.log(`[Edge Detection] Stencil ${currentStencilIndex} already verified, waiting for next stencil...`);
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before creating new one
    if (analysisIntervalRef.current) {
      console.log('[Edge Detection] Clearing existing interval before creating new one');
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    const requiredSuccessCount = 12; // Need 12 consecutive good scores for verification (increased from 5)
    const threshold = 0.40; // 40% alignment score threshold - stricter to avoid false positives
    const minScoreConsistency = 0.15; // Scores must be within 15% of each other (low variance)
    const maxMotionThreshold = 0.20; // Maximum allowed motion between frames (20%)

    console.log(`[Edge Detection] Starting analysis interval for stencil ${currentStencilIndex}, current counter: ${successCountRef.current}`);

    // Reset score history when starting new stencil
    scoreHistoryRef.current = [];
    previousFrameRef.current = null;

    // Add a small delay before starting analysis to prevent immediate hanging
    startDelayTimeoutRef.current = setTimeout(() => {
      analysisIntervalRef.current = setInterval(async () => {
        if (!analyzeEdgeDensityRef.current) return;
        const result = await analyzeEdgeDensityRef.current();
        const score = result.score;
        const brightness = result.brightness;
        const motion = result.motion;
      
      // Check multiple conditions before counting as success
      const isBrightnessValid = brightness >= 0.15 && brightness <= 0.85; // Not too dark or too bright
      const isMotionLow = motion <= maxMotionThreshold; // Camera must be relatively still
      const isScoreHighEnough = score >= threshold;
      
      // Add score to history (keep last 5 scores)
      scoreHistoryRef.current.push(score);
      if (scoreHistoryRef.current.length > 5) {
        scoreHistoryRef.current.shift();
      }
      
      // Check score consistency (low variance in recent scores)
      let isConsistent = true;
      if (scoreHistoryRef.current.length >= 3) {
        const scores = scoreHistoryRef.current;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        isConsistent = stdDev <= minScoreConsistency; // Low standard deviation = consistent
      }
      
      const allConditionsMet = isScoreHighEnough && isBrightnessValid && isMotionLow && isConsistent;
      
      if (allConditionsMet) {
        const previousCount = successCountRef.current;
        successCountRef.current++;
        const currentCount = successCountRef.current;
        console.log(`[Edge Detection] Good alignment detected: ${previousCount} → ${currentCount} (${currentCount}/${requiredSuccessCount})`);
        console.log(`  - Score: ${(score * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`);
        console.log(`  - Brightness: ${(brightness * 100).toFixed(2)}% (valid: ${isBrightnessValid})`);
        console.log(`  - Motion: ${(motion * 100).toFixed(2)}% (low: ${isMotionLow})`);
        console.log(`  - Consistency: ${isConsistent ? '✓' : '✗'}`);
        
        if (currentCount >= requiredSuccessCount) {
          console.log(`[Edge Detection] Threshold reached! Attempting to verify...`);
          // Use functional update to ensure we have latest state
          setStencilVerified(prev => {
            if (prev) return prev; // Already verified, don't do anything
            
            console.log(`[Edge Detection] ✓✓✓ ${stencilImages[currentStencilIndex].label} VERIFIED! ✓✓✓`);
            
            // Clear interval
            if (analysisIntervalRef.current) {
              clearInterval(analysisIntervalRef.current);
              analysisIntervalRef.current = null;
            }
            
            // Update instruction immediately when verified
            const currentStencil = stencilImages[currentStencilIndex];
            const nextIndex = currentStencilIndex + 1;
            if (nextIndex < stencilImages.length) {
              const nextStencil = stencilImages[nextIndex];
              const instructions: Record<string, string> = {
                'front': 'Move to the right side of the car to show the front fender',
                'right_front_fender': 'Continue along the right side to show the front door',
                'right_front_door': 'Continue to the right rear door',
                'right_rear_door': 'Continue to the right rear fender',
                'right_rear_fender': 'Move to the back of the car',
                'rear': 'Move to the left side of the car to show the rear fender',
                'left_rear_fender': 'Continue along the left side to show the rear door',
                'left_rear_door': 'Continue to the left front door',
                'left_front_door': 'Finish at the left front fender'
              };
              const nextInstruction = instructions[currentStencil.id] || `Move to ${nextStencil.label}`;
              setCurrentInstruction(nextInstruction);
            }
            
            // Capture and upload image when stencil turns green
            const segmentIndex = CAPTURE_SEGMENTS.findIndex(seg => seg.id === currentStencil.id);
            
            if (segmentIndex !== -1 && captureImageRef.current) {
              console.log(`[Capture] Stencil verified, capturing image for ${currentStencil.label} (segment: ${CAPTURE_SEGMENTS[segmentIndex].id})`);
              captureImageRef.current(CAPTURE_SEGMENTS[segmentIndex].id as CaptureSegmentId, segmentIndex)
                .then(success => {
                  if (success) {
                    console.log(`[Capture] ✓ Image captured and uploaded for ${currentStencil.label}`);
                  } else {
                    console.error(`[Capture] ✗ Failed to capture image for ${currentStencil.label}`);
                  }
                })
                .catch(error => {
                  console.error(`[Capture] Error capturing ${currentStencil.label}:`, error);
                });
            } else {
              console.warn(`[Capture] Could not find segment for stencil: ${currentStencil.id}`);
            }
            
            // Move to next stencil after 2 seconds
            if (currentStencilIndex < stencilImages.length - 1) {
              const nextIndex = currentStencilIndex + 1;
              console.log(`[Stencil Progression] Moving from stencil ${currentStencilIndex} (${stencilImages[currentStencilIndex].label}) to stencil ${nextIndex} (${stencilImages[nextIndex].label}) in 2 seconds...`);
              // Update instruction immediately to guide user
              setTimeout(() => {
                console.log(`[Stencil Progression] ✓ Now showing stencil ${nextIndex}: ${stencilImages[nextIndex].label}`);
                setCurrentStencilIndex(nextIndex);
                setStencilVerified(false);
                setEdgeDensity(0);
                setAlignmentScore(0);
                successCountRef.current = 0; // Reset for next stencil
                previousStencilIndexRef.current = nextIndex; // Update previous to next index
                // Update instruction for new stencil
                setCurrentInstruction(getCurrentInstruction());
              }, 2000);
            } else {
              console.log(`[Stencil Progression] All ${stencilImages.length} stencils completed!`);
              // All stencils verified, check if all images are uploaded and submit claim
              // Use a ref to access completeScan to avoid dependency issues
              setTimeout(() => {
                const uploadedCount = Object.keys(storedImagesRef.current).length;
                console.log(`[Stencil Progression] All stencils done. Uploaded images: ${uploadedCount}/${CAPTURE_SEGMENTS.length}`);
                if (uploadedCount === CAPTURE_SEGMENTS.length) {
                  console.log(`[Stencil Progression] All images uploaded, submitting claim...`);
                  if (completeScanRef.current) {
                    completeScanRef.current();
                  } else {
                    console.warn(`[Stencil Progression] completeScan not available yet, will retry...`);
                    setTimeout(() => {
                      if (completeScanRef.current) {
                        completeScanRef.current();
                      } else {
                        setStatus('processing');
                      }
                    }, 1000);
                  }
                } else {
                  console.warn(`[Stencil Progression] Not all images uploaded (${uploadedCount}/${CAPTURE_SEGMENTS.length}), waiting...`);
                  // Wait a bit more and try again
                  setTimeout(() => {
                    const finalCount = Object.keys(storedImagesRef.current).length;
                    if (finalCount === CAPTURE_SEGMENTS.length) {
                      console.log(`[Stencil Progression] All images now uploaded, submitting claim...`);
                      if (completeScanRef.current) {
                        completeScanRef.current();
                      } else {
                        setStatus('processing');
                      }
                    } else {
                      console.error(`[Stencil Progression] Still missing images (${finalCount}/${CAPTURE_SEGMENTS.length}), submitting anyway...`);
                      if (completeScanRef.current) {
                        completeScanRef.current();
                      } else {
                        setStatus('processing');
                      }
                    }
                  }, 3000);
                }
              }, 2000);
            }
            
            return true; // Mark as verified
          });
        }
      } else {
        // Reset counter if any condition fails
        if (successCountRef.current > 0) {
          const reasons = [];
          if (!isScoreHighEnough) reasons.push(`score too low (${(score * 100).toFixed(2)}% < ${(threshold * 100).toFixed(2)}%)`);
          if (!isBrightnessValid) reasons.push(`brightness invalid (${(brightness * 100).toFixed(2)}%)`);
          if (!isMotionLow) reasons.push(`motion too high (${(motion * 100).toFixed(2)}%)`);
          if (!isConsistent) reasons.push('scores inconsistent');
          
          console.log(`[Edge Detection] Alignment lost - ${reasons.join(', ')}. Resetting counter from ${successCountRef.current} to 0`);
          successCountRef.current = 0;
          scoreHistoryRef.current = []; // Reset history on failure
        }
      }
      }, 800); // Check every 800ms (increased from 500ms for better performance)
    }, 300); // Wait 300ms before starting analysis to prevent immediate hanging

    return () => {
      if (startDelayTimeoutRef.current) {
        clearTimeout(startDelayTimeoutRef.current);
        startDelayTimeoutRef.current = null;
      }
      if (analysisIntervalRef.current) {
        console.log('[Edge Detection] Cleaning up interval');
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      // Don't reset counter on cleanup - let it persist
    };
  }, [status, currentStencilIndex, stencilVerified]); // Removed stencilImages, analyzeEdgeDensity and captureImage to prevent infinite loops

  // Update instruction when stencil changes or verification status changes
  useEffect(() => {
    if (status === 'recording') {
      setCurrentInstruction(getCurrentInstruction());
    }
  }, [status, currentStencilIndex, stencilVerified, getCurrentInstruction]);
  
  const webcamRef = useRef<Webcam>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const captureTimersRef = useRef<NodeJS.Timeout[]>([]);
  const startTimeRef = useRef<number>(0);
  const storedImagesRef = useRef<Partial<Record<CaptureSegmentId, StoredImageReference>>>({});
  const storageStrategyRef = useRef<ImageStorageStrategy>(imageStorageStrategy ?? new S3ImageStorageStrategy());

  useEffect(() => {
    storageStrategyRef.current = imageStorageStrategy ?? new S3ImageStorageStrategy();
  }, [imageStorageStrategy]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const successCountRef = useRef<number>(0); // Persist success count across renders
  const previousStencilIndexRef = useRef<number>(-1); // Track stencil changes
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null); // Track interval to prevent duplicates


  // Detect mobile device and check orientation
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    
    const checkOrientation = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight;
      if (isMobile && isLandscapeMode) {
        setShowOrientationPrompt(true);
      } else {
        setShowOrientationPrompt(false);
      }
    };

    const lockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('portrait-primary');
        }
      } catch (error) {
      }
    };

    const unlockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          await screen.orientation.unlock();
        }
      } catch (error) {
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
      
      // Show tip if in landscape (not supported) and user hasn't dismissed it
      if (landscape && !localStorage.getItem('orientation-tip-dismissed')) {
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
    } catch (error) {
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
        resolve(videoBlob);
      };

      mediaRecorderRef.current.stop();
    });
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

    // Check if testing mode is enabled
    const isTestingMode = localStorage.getItem(TESTING_MODE_KEY) === 'true';

    try {
      // In testing mode, skip actual uploads but still process the flow
      if (isTestingMode) {
        console.log('========================================');
        console.log('[TESTING MODE] Skipping actual uploads, simulating success');
        console.log('========================================');
        
        // Simulate success after a short delay
        setTimeout(() => {
          setSuccessData({
            inspectionId: 99999,
            registrationNumber: vehicleDetails?.regNumber || 'TEST123',
            estimatedTime: '1-2 hours'
          });
          setShowSuccess(true);
        }, 2000);
        return;
      }
      
      // Stop video recording and get the blob
      const videoBlob = await stopVideoRecording();
      console.log('[Video] Video recording stopped, blob size:', videoBlob ? `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB` : 'null');
      
      // Upload video to S3 using video upload service
      let videoUrl = '';
      if (videoBlob) {
        const isMp4Supported = MediaRecorder.isTypeSupported('video/mp4;codecs=h264');
        const videoFileName = `inspection_video-${Date.now()}.${isMp4Supported ? 'mp4' : 'webm'}`;
        const videoContentType = isMp4Supported ? 'video/mp4' : 'video/webm';
        
        console.log('[Video] Uploading video to S3...');
        console.log(`[Video] File name: ${videoFileName}`);
        console.log(`[Video] Content type: ${videoContentType}`);
        
        const { presignedUrl: videoPresignedUrl, s3Url: videoS3Url } = await getVideoPresignedUploadUrl({ 
          fileName: videoFileName, 
          contentType: videoContentType 
        });
        
        await uploadVideoToS3({ 
          presignedUrl: videoPresignedUrl, 
          file: videoBlob, 
          contentType: videoContentType 
        });
        
        videoUrl = videoS3Url;
        console.log('[Video] Video uploaded successfully:', videoUrl);
      } else {
        console.warn('[Video] No video blob available');
      }
      
      // Gather persisted image references in capture order
      const imageUrls: { type: CaptureSegmentId; imageUrl: string }[] = CAPTURE_SEGMENTS.map((segment) => {
        const storedReference = storedImagesRef.current[segment.id];
        if (!storedReference) return undefined;
        return {
          type: segment.id,
          imageUrl: storedReference.uri
        };
      }).filter((entry): entry is { type: CaptureSegmentId; imageUrl: string } => Boolean(entry));

      // Logging: Count of uploaded images
      const totalUploadedImages = Object.keys(storedImagesRef.current).length;
      console.log('========================================');
      console.log('[API] Image Upload Summary:');
      console.log(`[API] Total images uploaded to storage: ${totalUploadedImages}`);
      console.log(`[API] Images ready for API call: ${imageUrls.length}`);
      console.log('[API] Uploaded image details:', Object.entries(storedImagesRef.current).map(([id, ref]) => ({
        segment: id,
        uri: ref.uri
      })));

      // Submit car inspection with video URL
      if (imageUrls.length === CAPTURE_SEGMENTS.length && vehicleDetails?.regNumber && videoUrl) {
        const requestPayload = {
          registrationNumber: vehicleDetails.regNumber,
          images: imageUrls,
          videoUrl: videoUrl,
          clientName: "SNAPCABS",
          sessionType: "MORNING"
        };

        console.log('========================================');
        console.log('[API] Submitting car inspection request:');
        console.log(`[API] Registration Number: ${requestPayload.registrationNumber}`);
        console.log(`[API] Number of images in request: ${requestPayload.images.length}`);
        console.log(`[API] Video URL: ${requestPayload.videoUrl}`);
        console.log('[API] Full request payload:', JSON.stringify(requestPayload, null, 2));
        console.log('[API] Image details in request:', requestPayload.images.map(img => ({
          type: img.type,
          imageUrl: img.imageUrl
        })));

        const response = await submitCarInspection(requestPayload);

        console.log('========================================');
        console.log('[API] Response received:');
        console.log('[API] Full response:', JSON.stringify(response, null, 2));
        console.log(`[API] Success: ${response.success}`);
        console.log(`[API] Inspection ID: ${response.inspectionId}`);
        console.log(`[API] Status: ${response.status}`);
        console.log('========================================');

        // Send notification to admin
        await sendPushoverNotification(`New inspection submitted: ${vehicleDetails.regNumber} - Vehicle: ${vehicleDetails.make} ${vehicleDetails.model}`);

        setSuccessData({
          inspectionId: response.inspectionId,
          registrationNumber: response.registrationNumber,
          estimatedTime: '1-2 hours' // Default since new API doesn't have this field
        });
        setShowSuccess(true);
    } else {
        console.error('[API] Validation failed:');
        console.error(`[API] Images: ${imageUrls.length}/${CAPTURE_SEGMENTS.length}`);
        console.error(`[API] Video: ${videoUrl ? 'yes' : 'no'}`);
        console.error(`[API] Registration: ${vehicleDetails?.regNumber || 'missing'}`);
        throw new Error(`Missing images (${imageUrls.length}/${CAPTURE_SEGMENTS.length}), video (${videoUrl ? 'yes' : 'no'}), or registration number (${vehicleDetails?.regNumber})`);
      }
    } catch (error) {
      setStatus('error');
    }
  }, [vehicleDetails, stopVideoRecording]);
  
  // Store completeScan in ref for access from other callbacks
  useEffect(() => {
    completeScanRef.current = completeScan;
  }, [completeScan]);

  const scheduleSegmentRun = useCallback(
    (index: number) => {
      console.log(`[Schedule] Starting segment ${index + 1}/${CAPTURE_SEGMENTS.length}`);
      
      captureTimersRef.current.forEach((timer) => clearTimeout(timer));
      captureTimersRef.current = [];

      if (index >= CAPTURE_SEGMENTS.length) {
        console.log('[Schedule] All segments completed, finishing scan...');
        setTimeout(() => {
          completeScan();
        }, 500);
        return;
      }

      const segment = CAPTURE_SEGMENTS[index];
      console.log(`[Schedule] Scheduling capture for: ${segment.label} (${segment.id})`);
      setCurrentSegmentIndex(index);
      setSegmentStatuses((prev) => ({ ...prev, [segment.id]: 'capturing' }));
      setCurrentInstruction(segment.instruction);

      const movementDuration = index === 0 ? 2000 : 3000; // Reduced from 6000 to 3000 for faster flow
      const holdTimer = setTimeout(() => {
        // Old hold steady logic removed - stencil verification handles this now
      }, movementDuration);

      const captureTimer = setTimeout(async () => {
        try {
          console.log(`[Schedule] Triggering capture for segment ${index + 1}: ${segment.id}`);
          const success = await captureImage(segment.id, index);

          if (success) {
            console.log(`[Schedule] Segment ${index + 1} captured successfully`);
            setCurrentInstruction(`${segment.label} captured!`);
            setTimeout(() => setCurrentInstruction(''), 1500);

            if (index === CAPTURE_SEGMENTS.length - 1) {
              console.log('[Schedule] Last segment captured, completing scan...');
              setTimeout(() => {
                completeScan();
              }, 1500);
            } else {
              console.log(`[Schedule] Moving to next segment: ${index + 2}`);
              scheduleSegmentRun(index + 1);
            }
          } else {
            console.error(`[Schedule] Segment ${index + 1} capture failed, but continuing anyway`);
            setCurrentInstruction('Realign this part and tap Retry');
            // Continue to next segment even on failure for now
            if (index < CAPTURE_SEGMENTS.length - 1) {
              setTimeout(() => {
                scheduleSegmentRun(index + 1);
              }, 2000);
            } else {
              setTimeout(() => {
                completeScan();
              }, 2000);
            }
          }
        } catch (error) {
          console.error(`[Schedule] Error in capture timer for segment ${index + 1}:`, error);
          // Continue to next segment even on error
          if (index < CAPTURE_SEGMENTS.length - 1) {
            setTimeout(() => {
              scheduleSegmentRun(index + 1);
            }, 2000);
          } else {
            setTimeout(() => {
              completeScan();
            }, 2000);
          }
        }
      }, movementDuration + 2000);

      captureTimersRef.current.push(holdTimer, captureTimer);
    },
    [captureImage, completeScan]
  );

  const startScan = useCallback(async () => {
    console.log('========================================');
    console.log('[StartScan] Starting capture sequence');
    console.log(`[StartScan] Total segments to capture: ${CAPTURE_SEGMENTS.length}`);
    console.log('[StartScan] Segment list:', CAPTURE_SEGMENTS.map(s => s.id));
    console.log('========================================');
    
    setStatus('recording');
    setRecordingTime(0);
    setCurrentSegmentIndex(0);
    storedImagesRef.current = {};
    setSegmentStatuses(getInitialSegmentStatuses());
    startTimeRef.current = Date.now();
    setCameraBlurred(false);
    setShowOrientationTip(false);
    
    // Reset stencil state
    console.log(`[StartScan] Resetting stencil state - starting with stencil 0: ${stencilImages[0].label}`);
    setCurrentStencilIndex(0);
    setStencilVerified(false);
    setEdgeDensity(0);
    setAlignmentScore(0);
    successCountRef.current = 0;
    previousStencilIndexRef.current = -1; // Reset to trigger new stencil detection
    setCurrentInstruction('Position the front of the car in the frame'); // Initial instruction

    await startVideoRecording();
    console.log('[StartScan] Video recording started');
    console.log('[StartScan] Edge detection analysis will start automatically');

    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        return Math.floor(elapsed);
      });
    }, 1000);
    
    // Note: Image capture is now triggered when each stencil turns green
    // No need to schedule segment runs - stencil verification handles it
    console.log('[StartScan] Video recording started, waiting for stencil verifications...');
  }, [startVideoRecording, scheduleSegmentRun]);

  const resetScan = useCallback(() => {
    setStatus('idle');
    setCurrentSegmentIndex(0);
    setRecordingTime(0);
    storedImagesRef.current = {};
    recordedChunksRef.current = [];
    setShowSuccess(false);
    setSuccessData(null);
    setSegmentStatuses(getInitialSegmentStatuses());
    
    // Reset new UI state
    setCurrentInstruction('');
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

  const retryActiveSegment = useCallback(() => {
    scheduleSegmentRun(currentSegmentIndex);
  }, [currentSegmentIndex, scheduleSegmentRun]);

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

  // Testing Mode - Show banner but keep camera screen visible
  // Testing mode only bypasses backend submission, not the camera/stencil features

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
              For the most accurate scan, please rotate your device to portrait mode.
            </p>
            
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 mb-6">
              <h3 className="text-orange-400 font-semibold mb-2">Why Portrait Mode?</h3>
              <div className="text-left text-sm text-gray-300 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                  <span>Matches AI stencil alignment</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                  <span>Prevents cropped segments</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">•</span>
                  <span>Required for guided stencil workflow</span>
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
                Continue in Landscape (Not Recommended)
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
      {/* Testing Mode Banner - Show at top if testing mode is ON */}
      {testingMode && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-600 via-yellow-500 to-orange-600 p-3 text-center border-b-2 border-yellow-400">
          <div className="flex items-center justify-center gap-2">
            <TestTube className="w-5 h-5 text-white animate-pulse" />
            <h3 className="text-sm md:text-base font-bold text-white">
              ⚠️ TESTING MODE - Camera & Stencil features active, backend submission bypassed
            </h3>
            <TestTube className="w-5 h-5 text-white animate-pulse" />
          </div>
        </div>
      )}

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
          }}
          onUserMediaError={(error) => {
            setCameraError(typeof error === 'string' ? error : error.message || 'Camera access failed');
            setCameraPermission('denied');
            setShowPermissionRequest(true);
          }}
        />
        
        {/* Stencil Overlay - Only show when recording */}
        {status === 'recording' && currentStencilIndex < stencilImages.length && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-4 md:px-6">
            <motion.div
              key={currentStencilIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative w-full max-w-md h-[70vh] md:h-[75vh] flex items-center justify-center"
            >
              {/* Premium Stencil Container with Animated Glow */}
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Animated Glow Background */}
                <motion.div
                  animate={stencilVerified ? {
                    opacity: [0.3, 0.5, 0.3],
                    scale: [1, 1.05, 1]
                  } : {
                    opacity: [0.2, 0.4, 0.2],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className={`absolute inset-0 rounded-3xl blur-3xl ${
                    stencilVerified 
                      ? 'bg-gradient-to-br from-green-400/40 via-emerald-500/30 to-green-600/40' 
                      : 'bg-gradient-to-br from-red-400/30 via-orange-500/20 to-red-600/30'
                  }`}
                  style={{
                    filter: 'blur(40px)',
                    transform: 'scale(1.2)'
                  }}
                />
                
                {/* Stencil Image with Premium Styling */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  <img
                    key={currentStencilIndex}
                    src={stencilImages[currentStencilIndex].path}
                    alt={stencilImages[currentStencilIndex].label}
                    className="w-full h-full object-contain relative z-10"
                    style={{
                      // Darken the stencil to make it more visible
                      // Use fewer drop-shadows with lighter colors for better performance
                      filter: stencilVerified
                        ? 'brightness(0.15) contrast(3) drop-shadow(2px 0 0 rgba(34, 197, 94, 0.6)) drop-shadow(-2px 0 0 rgba(34, 197, 94, 0.6)) drop-shadow(0 2px 0 rgba(34, 197, 94, 0.6)) drop-shadow(0 -2px 0 rgba(34, 197, 94, 0.6))'
                        : 'brightness(0.15) contrast(3) drop-shadow(2px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(-2px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(0 2px 0 rgba(239, 68, 68, 0.6)) drop-shadow(0 -2px 0 rgba(239, 68, 68, 0.6))',
                      transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                      imageRendering: 'crisp-edges',
                      WebkitFilter: stencilVerified
                        ? 'brightness(0.15) contrast(3) drop-shadow(2px 0 0 rgba(34, 197, 94, 0.6)) drop-shadow(-2px 0 0 rgba(34, 197, 94, 0.6)) drop-shadow(0 2px 0 rgba(34, 197, 94, 0.6)) drop-shadow(0 -2px 0 rgba(34, 197, 94, 0.6))'
                        : 'brightness(0.15) contrast(3) drop-shadow(2px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(-2px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(0 2px 0 rgba(239, 68, 68, 0.6)) drop-shadow(0 -2px 0 rgba(239, 68, 68, 0.6))'
                    }}
                  />
                  
                  {/* Animated Outline Ring - Keep for visual feedback but make it subtle */}
                  <motion.div
                    animate={stencilVerified ? {
                      scale: [1, 1.02, 1],
                      opacity: [0.2, 0.3, 0.2]
                    } : {
                      scale: [1, 1.01, 1],
                      opacity: [0.15, 0.25, 0.15]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className={`absolute inset-0 rounded-3xl border-2 ${
                      stencilVerified
                        ? 'border-green-400/30'
                        : 'border-red-400/30'
                    }`}
                    style={{
                      boxShadow: stencilVerified
                        ? '0 0 15px rgba(34, 197, 94, 0.2)'
                        : '0 0 15px rgba(239, 68, 68, 0.2)'
                    }}
                  />
                </div>
                
                {/* Premium Verification Badge */}
                {stencilVerified && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, rotate: -180 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 200, 
                      damping: 15,
                      delay: 0.1
                    }}
                    className="absolute top-2 right-2 md:top-4 md:right-4 z-20"
                  >
                    <div className="relative">
                      {/* Glow effect */}
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.8, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 bg-green-400 rounded-full blur-xl"
                      />
                      {/* Badge */}
                      <div className="relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center border-4 border-white/40 shadow-2xl backdrop-blur-sm">
                        <motion.svg
                          initial={{ pathLength: 0, scale: 0 }}
                          animate={{ pathLength: 1, scale: 1 }}
                          transition={{ duration: 0.6, delay: 0.3 }}
                          className="w-7 h-7 md:w-8 md:h-8 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </motion.svg>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {/* Premium Label Badge - Positioned above stencil */}
              <div className="absolute -top-20 md:-top-24 left-1/2 -translate-x-1/2 z-20 w-full max-w-xs">
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className={`relative px-5 py-3 md:px-6 md:py-4 rounded-2xl backdrop-blur-2xl border-2 shadow-2xl ${
                    stencilVerified
                      ? 'bg-gradient-to-r from-green-500/25 via-emerald-500/20 to-green-500/25 border-green-400/70 text-green-50'
                      : 'bg-gradient-to-r from-red-500/25 via-orange-500/20 to-red-500/25 border-red-400/70 text-red-50'
                  }`}
                  style={{
                    boxShadow: stencilVerified
                      ? '0 8px 32px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      : '0 8px 32px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] mb-1 opacity-90">
                    {stencilVerified ? '✓ Captured' : 'Align This Part'}
                  </p>
                  <p className="text-base md:text-lg font-bold leading-tight">
                    {stencilImages[currentStencilIndex].label}
                  </p>
                </motion.div>
              </div>
              
              {/* Premium Edge Detection Feedback - Positioned below stencil */}
              {!stencilVerified && (
                <div className="absolute -bottom-20 md:-bottom-24 left-1/2 -translate-x-1/2 z-20 w-full max-w-xs">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/70 backdrop-blur-2xl px-5 py-4 rounded-2xl border border-white/10 shadow-2xl"
                    style={{
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Alignment</span>
                      <span className="text-sm font-bold text-white">{Math.round(alignmentScore * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-800/60 rounded-full overflow-hidden mb-3 backdrop-blur-sm">
                      <motion.div
                        animate={{ width: `${alignmentScore * 100}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          alignmentScore > 0.35
                            ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 shadow-lg shadow-green-500/50'
                            : alignmentScore > 0.2
                            ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 shadow-lg shadow-yellow-500/50'
                            : 'bg-gradient-to-r from-red-400 via-orange-500 to-red-500 shadow-lg shadow-red-500/50'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <span className={`text-xs font-semibold ${
                        alignmentScore > 0.35
                          ? 'text-green-400'
                          : alignmentScore > 0.2
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}>
                        {alignmentScore > 0.35
                          ? 'Almost there! Keep steady...'
                          : alignmentScore > 0.2
                          ? 'Getting closer...'
                          : 'Move closer to align the car'}
                      </span>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </div>
        )}
        
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
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - captureProgress)}`}
                className="text-blue-400 transition-all duration-100"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Percentage text removed - just the circular bar */}
            </div>
        </div>
      </div>
      )}

      {/* Premium Instructions - Top Positioned, No Overlap */}
      {status === 'recording' && currentInstruction && (
        <div className="absolute top-4 md:top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <motion.div
            key={`${currentStencilIndex}-${stencilVerified}`}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`backdrop-blur-2xl rounded-3xl px-5 py-4 md:px-6 md:py-5 border-2 shadow-2xl ${
              stencilVerified
                ? 'bg-gradient-to-br from-green-500/25 via-emerald-500/20 to-green-500/25 border-green-400/70 text-green-50 shadow-green-500/30' 
                : 'bg-gradient-to-br from-blue-500/25 via-cyan-500/20 to-blue-500/25 border-blue-400/70 text-blue-50 shadow-blue-500/30'
            }`}
            style={{
              boxShadow: stencilVerified
                ? '0 10px 40px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                : '0 10px 40px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            }}
          >
            <div className="text-center">
              {/* Premium Animated Icon */}
              <motion.div
                animate={stencilVerified ? {
                  scale: [1, 1.15, 1],
                  rotate: [0, 5, -5, 0]
                } : {
                  x: currentInstruction.includes('Move') ? [-12, 12, -12] : [0, 0, 0],
                  scale: [1, 1.08, 1]
                }}
                transition={{ 
                  duration: stencilVerified ? 0.8 : currentInstruction.includes('Move') ? 1.2 : 1.8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="mb-3 md:mb-4"
              >
                {stencilVerified ? (
                  <div className="relative w-14 h-14 md:w-16 md:h-16 mx-auto">
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.6, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 bg-green-400 rounded-full blur-xl"
                    />
                    <div className="relative w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center border-3 border-white/40 shadow-xl">
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        className="text-2xl md:text-3xl text-white font-bold"
                      >
                        ✓
                      </motion.div>
                    </div>
                  </div>
                ) : currentInstruction.includes('Move') ? (
                  <div className="relative w-14 h-14 md:w-16 md:h-16 mx-auto">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 bg-blue-400 rounded-full blur-xl"
                    />
                    <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center border-3 border-white/40 shadow-xl">
                      <motion.div
                        animate={{ x: [-10, 10, -10] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                        className="text-2xl md:text-3xl text-white font-bold"
                      >
                        →
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-14 h-14 md:w-16 md:h-16 mx-auto">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 bg-blue-400 rounded-full blur-xl"
                    />
                    <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center border-3 border-white/40 shadow-xl">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-7 h-7 md:w-8 md:h-8 border-3 border-white rounded-full"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
              
              {/* Premium Instruction Text */}
              <motion.h3 
                className={`font-bold text-base md:text-lg lg:text-xl mb-2 leading-tight ${
                  stencilVerified 
                    ? 'text-green-100' 
                    : 'text-blue-100'
                }`}
                style={{
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}
              >
                {currentInstruction}
              </motion.h3>
              
              {/* Premium Progress indicator for alignment */}
              {!stencilVerified && (
                <div className="mt-3 md:mt-4">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                    <motion.div
                      animate={{ width: `${alignmentScore * 100}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 rounded-full shadow-lg"
                      style={{
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.6)'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {status === 'recording' && activeSegmentStatus === 'failed' && (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-sm px-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={retryActiveSegment}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-2xl shadow-xl border border-red-400/40"
          >
            Retry {activeSegment.label}
          </motion.button>
        </div>
      )}

      {/* Capture Progress - Subtle Bottom Indicator */}
      {status === 'recording' && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex gap-2 bg-black/30 backdrop-blur-lg rounded-full px-4 py-2 border border-white/10">
            {CAPTURE_SEGMENTS.map((segment) => {
              const statusValue = segmentStatuses[segment.id];
              const getDotStyles = () => {
                switch (statusValue) {
                  case 'verified':
                    return 'bg-green-400 shadow-green-400/50';
                  case 'verifying':
                    return 'bg-yellow-300 shadow-yellow-300/40';
                  case 'capturing':
                    return 'bg-blue-400 shadow-blue-400/40';
                  case 'failed':
                    return 'bg-red-400 shadow-red-400/50 animate-pulse';
                  default:
                    return 'bg-white/20';
                }
              };

              return (
              <motion.div
                  key={segment.id}
                initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: statusValue === 'capturing' ? 1.2 : 0.9, opacity: statusValue === 'pending' ? 0.4 : 1 }}
                transition={{ duration: 0.3 }}
                  className={`w-3 h-3 rounded-full shadow-lg transition-all duration-300 ${getDotStyles()}`}
                />
              );
            })}
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
                    <p className="text-blue-200 text-xs">Rotate back to portrait for the guided scan</p>
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
              {isLandscape && (
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📱</span>
                    <h3 className="text-orange-300 font-bold text-lg">Pro Tip</h3>
                  </div>
                  <p className="text-orange-200 text-sm">
                    Portrait mode is required to align the 10-part stencil. Rotate your device vertically before starting.
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