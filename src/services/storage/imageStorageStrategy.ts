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
 * Converts data URL to blob
 */
async function dataUrlToJpegBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Android Local Storage Strategy
 * Saves images to Android device's local storage via WebView bridge
 */
export class LocalAndroidImageStorageStrategy implements ImageStorageStrategy {
  async persist(params: PersistImageParams): Promise<StoredImageReference> {
    const bridge = (window as any)?.AndroidImageStore;

    if (!bridge?.saveImage) {
      throw new Error('Android image storage bridge is not available');
    }

    const contentType = params.contentType ?? 'image/jpeg';
    const blob = await dataUrlToJpegBlob(params.dataUrl);
    const base64Payload = await blobToBase64(blob);
    const fileName = `car_${params.segmentId}-${Date.now()}.jpg`;

    // Android bridge saves image and returns local file path/URI
    const uri: string = await bridge.saveImage(fileName, base64Payload, contentType);

    return {
      location: 'android_local',
      uri,
      segmentId: params.segmentId,
    };
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result;
      if (!result || typeof result !== 'string') {
        reject(new Error('Unable to convert blob to base64'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(blob);
  });
}


