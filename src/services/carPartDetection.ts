/**
 * Car Part Detection Service
 * Uses TFLite model to detect 23 car parts in real-time
 */

import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

// 23 Car Part Classes (Model Labels)
export const CAR_PART_LABELS = [
  "back_bumper", "back_door", "back_glass", "back_left_door", "back_left_light",
  "back_light", "back_right_door", "back_right_light", "front_bumper", "front_door",
  "front_glass", "front_left_door", "front_left_light", "front_light", "front_right_door",
  "front_right_light", "hood", "left_mirror", "object", "right_mirror",
  "tailgate", "trunk", "wheel"
];

export const CONFIDENCE_THRESHOLD = 0.30; // 30%
export const IOU_THRESHOLD = 0.45;
export const MODEL_INPUT_SIZE = 640;

export interface Detection {
  label: string;
  labelIndex: number;
  confidence: number;
  box: [number, number, number, number]; // [x, y, width, height] in original image coordinates
  boxNormalized: [number, number, number, number]; // Normalized 0-1
}

export interface ValidationResult {
  isValid: boolean;
  detectedParts: string[];
  requiredParts?: {
    hood?: boolean;
    front_glass?: boolean;
    mirror?: boolean;
    left_mirror?: boolean;
    right_mirror?: boolean;
  };
  message: string;
}

export interface DetectionResult {
  success: boolean;
  detections: Detection[];
  validation: ValidationResult;
  timestamp: number;
  error?: string;
}

class CarPartDetectionService {
  private model: tflite.TFLiteModel | null = null;
  private isModelLoaded: boolean = false;
  private isLoading: boolean = false;

  /**
   * Load the TFLite model
   */
  async loadModel(modelPath: string = './best_float16.tflite'): Promise<void> {
    if (this.isModelLoaded && this.model) {
      console.log('[ML Detection] Model already loaded');
      return;
    }

    if (this.isLoading) {
      console.log('[ML Detection] Model is already loading...');
      return;
    }

    try {
      this.isLoading = true;
      console.log('[ML Detection] Loading model from:', modelPath);

      // Set WASM path
      tflite.setWasmPath('/wasm/');

      // Load model
      this.model = await tflite.loadTFLiteModel(modelPath);
      this.isModelLoaded = true;
      this.isLoading = false;

      console.log('[ML Detection] ✅ Model loaded successfully');
    } catch (error) {
      this.isLoading = false;
      console.error('[ML Detection] ❌ Model loading failed:', error);
      throw error;
    }
  }

  /**
   * Preprocess image for model input
   */
  private preprocessImage(imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): tf.Tensor {
    return tf.tidy(() => {
      // Convert to tensor
      let tensor = tf.browser.fromPixels(imageSource);

      // Resize to 640x640 (model input size)
      tensor = tf.image.resizeBilinear(tensor, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

      // Add batch dimension: [640, 640, 3] -> [1, 640, 640, 3]
      tensor = tensor.expandDims(0);

      // Normalize to 0-1 range: [0-255] -> [0.0-1.0]
      tensor = tensor.toFloat().div(255.0);

      return tensor;
    });
  }

  /**
   * Run inference on preprocessed image
   */
  private async runInference(imageTensor: tf.Tensor): Promise<number[][][]> {
    if (!this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      const startTime = performance.now();

      // Run prediction
      const result = this.model.predict(imageTensor) as tf.Tensor;

      // Convert to JavaScript array
      const data = await result.array() as number[][][];

      const inferenceTime = performance.now() - startTime;
      console.log(`[ML Detection] Inference time: ${inferenceTime.toFixed(2)}ms`);

      // Cleanup
      imageTensor.dispose();
      result.dispose();

      return data; // Shape: [1, 59, 8400]
    } catch (error) {
      imageTensor.dispose();
      console.error('[ML Detection] ❌ Inference failed:', error);
      throw error;
    }
  }

  /**
   * Apply Non-Max Suppression to filter overlapping boxes
   */
  private async applyNMS(detections: Detection[]): Promise<Detection[]> {
    if (detections.length === 0) {
      return [];
    }

    try {
      // Prepare boxes for NMS: [y1, x1, y2, x2] format
      const nmsBoxes = detections.map(d => {
        const [x, y, w, h] = d.box;
        return [y, x, y + h, x + w]; // [y1, x1, y2, x2]
      });

      const scores = detections.map(d => d.confidence);

      // Create tensors
      const tensorBoxes = tf.tensor2d(nmsBoxes);
      const tensorScores = tf.tensor1d(scores);

      // Run NMS (keep max 20 boxes)
      const selectedIndices = await tf.image.nonMaxSuppressionAsync(
        tensorBoxes,
        tensorScores,
        20, // maxBoxes
        IOU_THRESHOLD,
        0.30 // scoreThreshold
      );

      const indices = await selectedIndices.array();

      // Cleanup
      tensorBoxes.dispose();
      tensorScores.dispose();
      selectedIndices.dispose();

      // Return filtered detections
      return indices.map((idx: number) => detections[idx]);
    } catch (error) {
      console.error('[ML Detection] NMS failed:', error);
      return detections; // Return all if NMS fails
    }
  }

  /**
   * Process raw model output into detections
   */
  private async processDetections(
    rawOutput: number[][][],
    originalWidth: number,
    originalHeight: number
  ): Promise<Detection[]> {
    const rows = rawOutput[0]; // Shape: [59, 8400]
    const numAnchors = 8400;
    const numClasses = 23;

    const detections: Detection[] = [];

    // Process each anchor point
    for (let i = 0; i < numAnchors; i++) {
      // Find best class score (rows 4-26 are class scores)
      let maxScore = 0;
      let maxClass = -1;

      for (let c = 0; c < numClasses; c++) {
        const score = rows[4 + c][i];
        if (score > maxScore) {
          maxScore = score;
          maxClass = c;
        }
      }

      // Filter by confidence threshold
      if (maxScore > CONFIDENCE_THRESHOLD) {
        // Extract bounding box (rows 0-3: center_x, center_y, width, height)
        const cx = rows[0][i]; // Center X (relative to 640x640)
        const cy = rows[1][i]; // Center Y
        const w = rows[2][i];  // Width
        const h = rows[3][i];  // Height

        // Convert from center format to top-left format
        // Normalized coordinates (0-1)
        const xNorm = (cx - w / 2) / MODEL_INPUT_SIZE;
        const yNorm = (cy - h / 2) / MODEL_INPUT_SIZE;
        const wNorm = w / MODEL_INPUT_SIZE;
        const hNorm = h / MODEL_INPUT_SIZE;

        // Scale to original image dimensions
        const x = xNorm * originalWidth;
        const y = yNorm * originalHeight;
        const width = wNorm * originalWidth;
        const height = hNorm * originalHeight;

        detections.push({
          label: CAR_PART_LABELS[maxClass],
          labelIndex: maxClass,
          confidence: maxScore,
          box: [x, y, width, height],
          boxNormalized: [xNorm, yNorm, wNorm, hNorm]
        });
      }
    }

    // Apply Non-Max Suppression to remove duplicates
    const filteredDetections = await this.applyNMS(detections);

    return filteredDetections;
  }

  /**
   * Validate if required parts are detected for current capture part
   */
  validatePart(detections: Detection[], currentPart: string): ValidationResult {
    const detectedLabels = detections.map(d => d.label);

    if (currentPart === 'front' || currentPart === 'Front') {
      // Front requires: hood + front_glass + mirror (left OR right)
      const hasHood = detectedLabels.includes('hood');
      const hasFrontGlass = detectedLabels.includes('front_glass');
      const hasLeftMirror = detectedLabels.includes('left_mirror');
      const hasRightMirror = detectedLabels.includes('right_mirror');
      const hasMirror = hasLeftMirror || hasRightMirror;

      const isValid = hasHood && hasFrontGlass && hasMirror;

      return {
        isValid,
        detectedParts: detectedLabels,
        requiredParts: {
          hood: hasHood,
          front_glass: hasFrontGlass,
          mirror: hasMirror,
          left_mirror: hasLeftMirror,
          right_mirror: hasRightMirror
        },
        message: isValid
          ? 'Front detected ✓'
          : `Missing: ${!hasHood ? 'hood ' : ''}${!hasFrontGlass ? 'front_glass ' : ''}${!hasMirror ? 'mirror' : ''}`
      };
    } else {
      // Other parts: at least one part must be detected
      const isValid = detectedLabels.length > 0;

      return {
        isValid,
        detectedParts: detectedLabels,
        message: isValid
          ? `Part detected ✓ (${detectedLabels.length} parts)`
          : 'No car parts detected'
      };
    }
  }

  /**
   * Complete detection pipeline
   */
  async detectCarParts(
    imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    currentPart: string,
    originalWidth: number,
    originalHeight: number
  ): Promise<DetectionResult> {
    if (!this.isModelLoaded || !this.model) {
      return {
        success: false,
        error: 'Model not loaded',
        detections: [],
        validation: {
          isValid: false,
          detectedParts: [],
          message: 'Model not loaded'
        },
        timestamp: Date.now()
      };
    }

    try {
      // 1. Preprocess
      const imageTensor = this.preprocessImage(imageSource);

      // 2. Run inference
      const rawOutput = await this.runInference(imageTensor);

      // 3. Post-process
      const detections = await this.processDetections(rawOutput, originalWidth, originalHeight);

      // 4. Validate
      const validationResult = this.validatePart(detections, currentPart);

      return {
        success: true,
        detections,
        validation: validationResult,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[ML Detection] Detection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        detections: [],
        validation: {
          isValid: false,
          detectedParts: [],
          message: 'Detection error occurred'
        },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.isModelLoaded && this.model !== null;
  }

  /**
   * Dispose model and cleanup
   */
  dispose(): void {
    if (this.model) {
      // TFLite models don't have explicit dispose, but we can clear the reference
      this.model = null;
      this.isModelLoaded = false;
      console.log('[ML Detection] Model disposed');
    }
  }
}

// Export singleton instance
export const carPartDetectionService = new CarPartDetectionService();
