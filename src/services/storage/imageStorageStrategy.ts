import { CaptureSegmentId } from '../../types/capture';

/**
 * Android-only image storage strategy
 * Images are saved locally on Android device via WebView bridge
 */
export type StorageLocation = 'android_local';

export interface StoredImageReference {
  location: StorageLocation;
  uri: string; // Local file path/URI returned by Android
  segmentId: CaptureSegmentId;
}

export interface PersistImageParams {
  segmentId: CaptureSegmentId;
  dataUrl: string;
  contentType?: string;
}

export interface ImageStorageStrategy {
  persist(params: PersistImageParams): Promise<StoredImageReference>;
}

/**
 * Android Local Storage Strategy
 * Returns placeholder references for internal tracking.
 * Actual Android communication (queueImage) is handled in CameraScreen.tsx sendImageToAndroid()
 */
export class LocalAndroidImageStorageStrategy implements ImageStorageStrategy {
  async persist(params: PersistImageParams): Promise<StoredImageReference> {
    // Note: We do NOT call queueImage here anymore to avoid duplicate calls
    // The actual queueImage call happens in sendImageToAndroid() in CameraScreen.tsx
    // This method just returns a placeholder reference for internal tracking
    
    // Return a placeholder URI since actual Android communication is handled separately
    return {
      location: 'android_local',
      uri: `android_queue://${params.segmentId}-${Date.now()}`,
      segmentId: params.segmentId,
    };
  }
}


