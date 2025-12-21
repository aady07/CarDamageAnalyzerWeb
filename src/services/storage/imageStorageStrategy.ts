import { CaptureSegmentId } from '../../types/capture';
import { dataUrlToJpegBlob, getPresignedUploadUrl, uploadFileToS3 } from '../api/uploadService';

export type StorageLocation = 's3' | 'android_local';

export interface StoredImageReference {
  location: StorageLocation;
  uri: string;
  segmentId: CaptureSegmentId;
  fileKey?: string;
}

export interface PersistImageParams {
  segmentId: CaptureSegmentId;
  dataUrl: string;
  contentType?: string;
}

export interface ImageStorageStrategy {
  persist(params: PersistImageParams): Promise<StoredImageReference>;
}

export class S3ImageStorageStrategy implements ImageStorageStrategy {
  async persist(params: PersistImageParams): Promise<StoredImageReference> {
    const contentType = params.contentType ?? 'image/jpeg';
    const blob = await dataUrlToJpegBlob(params.dataUrl);
    const fileName = `car_${params.segmentId}-${Date.now()}.jpg`;
    const { presignedUrl, s3Url, fileKey } = await getPresignedUploadUrl({ fileName, contentType });
    await uploadFileToS3({ presignedUrl, file: blob, contentType });

    return {
      location: 's3',
      uri: s3Url,
      segmentId: params.segmentId,
      fileKey,
    };
  }
}

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


