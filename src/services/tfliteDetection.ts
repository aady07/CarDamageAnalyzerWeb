/**
 * TFLite Car Part Detection Service
 * Handles model loading, inference, and part detection validation
 * Uses locally loaded TensorFlow.js and TFLite libraries
 */

// Use global window objects from script tags
declare global {
  interface Window {
    tf: any; // TensorFlow.js from CDN
    tflite: {
      setWasmPath: (path: string) => void;
      loadTFLiteModel: (path: string) => Promise<any>;
    };
  }
}

// 23 Car Part Classes (Model Labels)
export const CAR_PART_LABELS = [
  "back_bumper", "back_door", "back_glass", "back_left_door", "back_left_light",
  "back_light", "back_right_door", "back_right_light", "front_bumper", "front_door",
  "front_glass", "front_left_door", "front_left_light", "front_light", "front_right_door",
  "front_right_light", "hood", "left_mirror", "object", "right_mirror",
  "tailgate", "trunk", "wheel"
];

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
  message: string;
  detections: Detection[];
  requiredParts?: {
    hood?: boolean;
    front_glass?: boolean;
    mirror?: boolean;
    left_mirror?: boolean;
    right_mirror?: boolean;
  };
}

const CONFIDENCE_THRESHOLD = 0.30; // 30%
const IOU_THRESHOLD = 0.45;
const MODEL_INPUT_SIZE = 640;

class TFLiteDetectionService {
  private model: any | null = null; // TFLiteModel type from CDN
  private isModelLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<any> | null = null;

  /**
   * Load the TFLite model
   */
  async loadModel(modelPath: string = './best_float16.tflite'): Promise<any> {
    // Wait for libraries to load
    if (!window.tf || !window.tflite) {
      console.log('[TFLite] Waiting for libraries to load...');
      await new Promise<void>((resolve) => {
        const checkLibraries = setInterval(() => {
          if (window.tf && window.tflite) {
            clearInterval(checkLibraries);
            resolve();
          }
        }, 100);
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkLibraries);
          if (!window.tf || !window.tflite) {
            throw new Error('TensorFlow.js or TFLite libraries failed to load from CDN');
          }
          resolve();
        }, 10000);
      });
    }

    if (this.isModelLoaded && this.model) {
      return this.model;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        // Preload WASM files and create Blob URLs (fetch doesn't work with file://)
        console.log('[TFLite] Preloading WASM files...');
        const wasmFiles = [
          'tflite_web_api_cc.wasm',
          'tflite_web_api_cc_simd.wasm',
          'tflite_web_api_cc_threaded.wasm',
          'tflite_web_api_cc_simd_threaded.wasm'
        ];
        
        const wasmBlobUrls: Record<string, string> = {};
        
        // Load each WASM file and create Blob URL
        for (const wasmFile of wasmFiles) {
          try {
            const wasmPath = `./tflite/${wasmFile}`;
            console.log(`[TFLite] Loading WASM file: ${wasmPath}`);
            
            const wasmArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', wasmPath, true);
              xhr.responseType = 'arraybuffer';
              
              xhr.onload = () => {
                if (xhr.status === 0 || xhr.status === 200) {
                  resolve(xhr.response);
                } else {
                  reject(new Error(`Failed to load WASM file: HTTP ${xhr.status}`));
                }
              };
              
              xhr.onerror = () => reject(new Error('Failed to load WASM file: Network error'));
              xhr.ontimeout = () => reject(new Error('Failed to load WASM file: Timeout'));
              xhr.timeout = 30000;
              xhr.send();
            });
            
            const blob = new Blob([wasmArrayBuffer], { type: 'application/wasm' });
            const blobUrl = URL.createObjectURL(blob);
            wasmBlobUrls[wasmFile] = blobUrl;
            console.log(`[TFLite] Created Blob URL for ${wasmFile}: ${blobUrl}`);
          } catch (error) {
            console.warn(`[TFLite] Failed to preload ${wasmFile}, will use fallback:`, error);
          }
        }
        
        // Override fetch temporarily to use Blob URLs for WASM files
        const originalFetch = window.fetch;
        const fetchOverride = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          
          // Check if this is a WASM file request
          for (const [wasmFile, blobUrl] of Object.entries(wasmBlobUrls)) {
            if (url.includes(wasmFile)) {
              console.log(`[TFLite] Intercepting WASM fetch for ${wasmFile}, using Blob URL`);
              return originalFetch(blobUrl, init);
            }
          }
          
          // For other requests, use original fetch
          return originalFetch(input, init);
        };
        
        // Replace fetch temporarily
        (window as any).fetch = fetchOverride;
        console.log('[TFLite] Fetch override installed for WASM files');
        
        try {
          // Set WASM path - use relative local path
          const wasmPath = './tflite/';
          console.log('[TFLite] Setting WASM path to:', wasmPath);
          window.tflite.setWasmPath(wasmPath);
          console.log('[TFLite] WASM path set successfully');

          console.log('[TFLite] Loading model from:', modelPath);
          console.log('[TFLite] Model path type:', typeof modelPath);
          console.log('[TFLite] Window.tf available:', !!window.tf);
          console.log('[TFLite] Window.tflite available:', !!window.tflite);
          console.log('[TFLite] Window.tflite.loadTFLiteModel available:', typeof window.tflite.loadTFLiteModel);
          
          // Load model file as ArrayBuffer using XMLHttpRequest (works with file:// protocol)
          console.log('[TFLite] Attempting to load model file as ArrayBuffer...');
          const modelArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', modelPath, true);
            xhr.responseType = 'arraybuffer';
            
            xhr.onload = () => {
              if (xhr.status === 0 || xhr.status === 200) {
                console.log('[TFLite] Model file loaded as ArrayBuffer, size:', xhr.response?.byteLength || 0);
                resolve(xhr.response);
              } else {
                reject(new Error(`Failed to load model file: HTTP ${xhr.status}`));
              }
            };
            
            xhr.onerror = () => {
              reject(new Error('Failed to load model file: Network error'));
            };
            
            xhr.ontimeout = () => {
              reject(new Error('Failed to load model file: Timeout'));
            };
            
            xhr.timeout = 30000; // 30 seconds timeout
            xhr.send();
          });
          
          console.log('[TFLite] Model ArrayBuffer loaded, size:', modelArrayBuffer.byteLength);
          
          // Create a Blob URL from ArrayBuffer (loadTFLiteModel only accepts string URL)
          console.log('[TFLite] Creating Blob URL from ArrayBuffer...');
          const blob = new Blob([modelArrayBuffer], { type: 'application/octet-stream' });
          const blobUrl = URL.createObjectURL(blob);
          console.log('[TFLite] Created Blob URL:', blobUrl);
          
          let model: any;
          try {
            // Load model from Blob URL
            console.log('[TFLite] Loading model from Blob URL...');
            model = await window.tflite.loadTFLiteModel(blobUrl);
            console.log('[TFLite] Model loaded from Blob URL successfully');
          } finally {
            // Always clean up Blob URL
            URL.revokeObjectURL(blobUrl);
            console.log('[TFLite] Model Blob URL cleaned up');
          }
          
          console.log('[TFLite] Model object received:', !!model);
          this.model = model;
          this.isModelLoaded = true;
          this.isLoading = false;
          
          // Store WASM Blob URLs for cleanup later
          (this as any).wasmBlobUrls = wasmBlobUrls;
          
          console.log('[TFLite] ✅ Model loaded successfully');
          return model;
        } finally {
          // Restore original fetch
          (window as any).fetch = originalFetch;
          console.log('[TFLite] Fetch override removed');
        }
      } catch (error) {
        this.isLoading = false;
        this.loadPromise = null;
        console.error('[TFLite] ❌ Model loading failed');
        console.error('[TFLite] Error type:', typeof error);
        console.error('[TFLite] Error message:', error instanceof Error ? error.message : 'No message');
        console.error('[TFLite] Error stack:', error instanceof Error ? error.stack : 'No stack');
        console.error('[TFLite] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error('[TFLite] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Preprocess image for model input
   */
  private preprocessImage(imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): any {
    return window.tf.tidy(() => {
      // Convert to tensor
      let tensor = window.tf.browser.fromPixels(imageSource);
      
      // Resize to 640x640 (model input size)
      tensor = window.tf.image.resizeBilinear(tensor, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
      
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
  private async runInference(imageTensor: any): Promise<number[][][]> {
    if (!this.model) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    try {
      const startTime = performance.now();
      
      // Run prediction - TFLite model.predict returns the output directly or in 'Identity' key
      const result = this.model.predict(imageTensor);
      
      // Debug: Log result structure
      console.log('[TFLite] Prediction result type:', typeof result);
      console.log('[TFLite] Prediction result:', result);
      if (result && typeof result === 'object') {
        console.log('[TFLite] Result keys:', Object.keys(result));
        console.log('[TFLite] Result has array?', typeof result.array === 'function');
        console.log('[TFLite] Result has dataSync?', typeof result.dataSync === 'function');
      }
      
      // Handle different output structures
      let outputTensor: any;
      if (result && typeof result === 'object') {
        // Check if result has 'Identity' key (common in TFLite models)
        if (result['Identity']) {
          outputTensor = result['Identity'];
          console.log('[TFLite] Using Identity key');
        } else if (result['output'] || result['outputs']) {
          // Some models use 'output' or 'outputs'
          outputTensor = result['output'] || result['outputs'];
          console.log('[TFLite] Using output/outputs key');
        } else if (Array.isArray(result)) {
          // Result might be an array of tensors
          outputTensor = result[0];
          console.log('[TFLite] Using first array element');
        } else if (result.array && typeof result.array === 'function') {
          // Result is already a tensor with array method
          outputTensor = result;
          console.log('[TFLite] Using result directly (has array method)');
        } else if (result.dataSync && typeof result.dataSync === 'function') {
          // Result is a tensor with dataSync method
          outputTensor = result;
          console.log('[TFLite] Using result directly (has dataSync method)');
        } else {
          // Try to find any tensor-like property
          const keys = Object.keys(result);
          if (keys.length > 0) {
            outputTensor = result[keys[0]];
            console.log('[TFLite] Using first key:', keys[0]);
          } else {
            outputTensor = result;
            console.log('[TFLite] Using result as-is');
          }
        }
      } else {
        outputTensor = result;
        console.log('[TFLite] Result is not object, using directly');
      }
      
      console.log('[TFLite] Output tensor type:', typeof outputTensor);
      console.log('[TFLite] Output tensor has array?', outputTensor && typeof outputTensor.array === 'function');
      console.log('[TFLite] Output tensor has dataSync?', outputTensor && typeof outputTensor.dataSync === 'function');
      
      // Convert to JavaScript array
      let data: number[][][];
      if (outputTensor && typeof outputTensor.array === 'function') {
        data = await outputTensor.array() as number[][][];
      } else if (outputTensor && typeof outputTensor.dataSync === 'function') {
        // Fallback: use dataSync and reshape
        const flatData = outputTensor.dataSync();
        // Reshape to [1, 59, 8400]
        data = [[[]]];
        let idx = 0;
        for (let b = 0; b < 1; b++) {
          data[b] = [];
          for (let r = 0; r < 59; r++) {
            data[b][r] = [];
            for (let a = 0; a < 8400; a++) {
              data[b][r][a] = flatData[idx++];
            }
          }
        }
      } else if (Array.isArray(outputTensor)) {
        // Already an array
        data = outputTensor as number[][][];
      } else {
        throw new Error(`Unexpected output format: ${typeof outputTensor}. Result keys: ${result ? Object.keys(result).join(', ') : 'null'}`);
      }
      
      // Verify shape
      if (!data || data.length !== 1 || !data[0] || data[0].length !== 59 || !data[0][0] || data[0][0].length !== 8400) {
        console.warn(`[TFLite] Unexpected output shape: [${data?.length}, ${data?.[0]?.length}, ${data?.[0]?.[0]?.length}]. Expected: [1, 59, 8400]`);
        // Try to handle if it's just [59, 8400]
        if (data && data.length === 59 && data[0] && data[0].length === 8400) {
          // data is actually [59, 8400] at this point, wrap it in batch dimension
          const twoDData = data as unknown as number[][];
          data = [twoDData]; // Wrap in batch dimension to create [1, 59, 8400]
        } else {
          throw new Error(`Invalid output shape: [${data?.length}, ${data?.[0]?.length}, ${data?.[0]?.[0]?.length}]`);
        }
      }
      
      const inferenceTime = performance.now() - startTime;
      console.log(`[TFLite] Inference time: ${inferenceTime.toFixed(2)}ms, Output shape: [${data.length}, ${data[0].length}, ${data[0][0].length}]`);
      
      // Cleanup
      imageTensor.dispose();
      if (outputTensor && outputTensor.dispose) {
        outputTensor.dispose();
      }
      if (result && result !== outputTensor && result.dispose) {
        result.dispose();
      }
      
      return data; // Shape: [1, 59, 8400]
    } catch (error) {
      imageTensor.dispose();
      console.error("[TFLite] ❌ Inference failed:", error);
      throw error;
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
          box: [x, y, width, height], // [x, y, width, height] in original image coordinates
          boxNormalized: [xNorm, yNorm, wNorm, hNorm] // Normalized 0-1
        });
      }
    }
    
    // Apply Non-Max Suppression to remove duplicates
    const filteredDetections = await this.applyNMS(detections);
    
    return filteredDetections;
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
      const tensorBoxes = window.tf.tensor2d(nmsBoxes);
      const tensorScores = window.tf.tensor1d(scores);
      
      // Run NMS (keep max 20 boxes)
      const selectedIndices = await window.tf.image.nonMaxSuppressionAsync(
        tensorBoxes,
        tensorScores,
        20, // maxBoxes
        IOU_THRESHOLD,
        0.30 // scoreThreshold (additional safety)
      );
      
      const indices = await selectedIndices.array();
      
      // Cleanup
      tensorBoxes.dispose();
      tensorScores.dispose();
      selectedIndices.dispose();
      
      // Return filtered detections
      return (indices as number[]).map(idx => detections[idx]);
    } catch (error) {
      console.error("[TFLite] NMS failed:", error);
      return detections; // Return all if NMS fails
    }
  }

  /**
   * Get expected parts for each car part
   */
  private getExpectedParts(currentPart: string): string[] {
    const partMap: Record<string, string[]> = {
      'Front': ['hood', 'front_glass', 'left_mirror', 'right_mirror', 'front_bumper', 'front_left_light', 'front_right_light', 'back_glass', 'wheel'],
      'Front View': ['hood', 'front_glass', 'left_mirror', 'right_mirror', 'front_bumper', 'front_left_light', 'front_right_light', 'back_glass', 'wheel'],
      'front': ['hood', 'front_glass', 'left_mirror', 'right_mirror', 'front_bumper', 'front_left_light', 'front_right_light', 'back_glass', 'wheel'],
      
      'Right Front Fender': ['front_right_light', 'right_mirror', 'front_right_door', 'wheel'],
      'right_front_fender': ['front_right_light', 'right_mirror', 'front_right_door', 'wheel'],
      
      'Right Front Door': ['front_right_door', 'wheel', 'right_mirror'],
      'right_front_door': ['front_right_door', 'wheel', 'right_mirror'],
      
      'Right Rear Door': ['back_right_door', 'front_right_door', 'back_right_light'],
      'right_rear_door': ['back_right_door', 'front_right_door', 'back_right_light'],
      
      'Right Rear Fender': ['back_right_light', 'back_right_door', 'back_light', 'wheel'],
      'right_rear_fender': ['back_right_light', 'back_right_door', 'back_light', 'wheel'],
      
      'Rear': ['back_bumper', 'back_glass', 'back_light', 'tailgate', 'trunk', 'back_door'],
      'Rear View': ['back_bumper', 'back_glass', 'back_light', 'tailgate', 'trunk', 'back_door'],
      'rear': ['back_bumper', 'back_glass', 'back_light', 'tailgate', 'trunk', 'back_door'],
      
      'Left Rear Fender': ['back_left_light', 'back_left_door', 'back_light', 'wheel'],
      'left_rear_fender': ['back_left_light', 'back_left_door', 'back_light', 'wheel'],
      
      'Left Rear Door': ['back_left_door', 'front_left_door', 'back_left_light'],
      'left_rear_door': ['back_left_door', 'front_left_door', 'back_left_light'],
      
      'Left Front Door': ['front_left_door', 'wheel', 'left_mirror'],
      'left_front_door': ['front_left_door', 'wheel', 'left_mirror'],
      
      'Left Front Fender': ['front_left_light', 'left_mirror', 'front_left_door', 'wheel'],
      'left_front_fender': ['front_left_light', 'left_mirror', 'front_left_door', 'wheel']
    };
    
    return partMap[currentPart] || [];
  }

  /**
   * Check if detected parts match expected parts
   * For Front: requires 2 out of 4 parts
   * For others: requires 1 out of expected parts
   */
  private hasExpectedParts(detectedLabels: string[], expectedParts: string[], isFront: boolean = false): boolean {
    if (isFront) {
      // Front: need 2 out of 4 parts
      const matchedCount = expectedParts.filter(expected => detectedLabels.includes(expected)).length;
      return matchedCount >= 2;
    } else {
      // Other parts: need at least 1 expected part
      return expectedParts.some(expected => detectedLabels.includes(expected));
    }
  }

  /**
   * Check if wrong parts are detected (parts that don't match expected)
   */
  private hasWrongParts(detectedLabels: string[], expectedParts: string[], isFront: boolean = false): boolean {
    // If parts are detected but don't meet expected requirements
    return detectedLabels.length > 0 && !this.hasExpectedParts(detectedLabels, expectedParts, isFront);
  }

  /**
   * Validate if required parts are detected for current capture part
   */
  validatePart(detections: Detection[], currentPart: string): ValidationResult {
    const detectedLabels = detections.map(d => d.label);
    const expectedParts = this.getExpectedParts(currentPart);
    
    // Special case for Front - requires 2 out of expected parts
    if (currentPart === "Front" || currentPart === "front" || currentPart === "Front View") {
      // Check how many expected parts are detected
      const matchedParts = expectedParts.filter(expected => detectedLabels.includes(expected));
      const matchedCount = matchedParts.length;
      const isValid = matchedCount >= 2; // Need 2 out of expected parts
      const hasWrong = detectedLabels.length > 0 && !isValid;
      
      return {
        isValid,
        detectedParts: detectedLabels,
        message: isValid 
          ? `Front detected ✓ (${matchedParts.join(', ')})` 
          : hasWrong
          ? `Wrong parts detected: ${detectedLabels.join(', ')} (need 2 of: ${expectedParts.join(', ')})`
          : `Missing parts (need 2 of: ${expectedParts.join(', ')})`,
        detections
      };
    } else {
      // For other parts: check if expected parts are detected
      const hasExpected = this.hasExpectedParts(detectedLabels, expectedParts);
      const hasWrong = this.hasWrongParts(detectedLabels, expectedParts);
      
      let message: string;
      if (hasExpected) {
        message = `Expected parts detected ✓ (${detectedLabels.filter(l => expectedParts.includes(l)).join(', ')})`;
      } else if (hasWrong) {
        message = `Wrong parts detected: ${detectedLabels.join(', ')} (expected: ${expectedParts.join(', ')})`;
      } else {
        message = "No car parts detected";
      }
      
      return {
        isValid: hasExpected,
        detectedParts: detectedLabels,
        message,
        detections
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
  ): Promise<{ success: boolean; detections: Detection[]; validation: ValidationResult; error?: string }> {
    try {
      if (!this.isModelLoaded || !this.model) {
        // Try to load model if not loaded
        await this.loadModel();
      }

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
        validation: validationResult
      };
    } catch (error) {
      console.error("[TFLite] Detection failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        detections: [],
        validation: {
          isValid: false,
          message: "Detection error occurred",
          detectedParts: [],
          detections: []
        }
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
      // TFLite models don't have explicit dispose, but we can clear references
      this.model = null;
      this.isModelLoaded = false;
      this.isLoading = false;
      this.loadPromise = null;
    }
  }
}

// Export singleton instance
export const tfliteDetectionService = new TFLiteDetectionService();
