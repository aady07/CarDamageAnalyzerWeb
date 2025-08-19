import { apiClient } from './authenticatedApiService';

export interface PresignedUrlResponse {
  presignedUrl: string;
  fileKey: string;
  s3Url: string;
  expiration: number;
}

export interface S3UploadResult {
  ok: boolean;
}

export interface StartProcessingResponse {
  claimId: number;
  status: string;
  success: boolean;
}

export async function getPresignedUploadUrl(params: {
  fileName: string;
  contentType: string;
}): Promise<PresignedUrlResponse> {
  const form = new URLSearchParams();
  form.set('fileName', params.fileName);
  form.set('contentType', params.contentType);

  const { data } = await apiClient.post<PresignedUrlResponse>(
    '/api/get-upload-url',
    form,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return data;
}

export async function uploadFileToS3(args: {
  presignedUrl: string;
  file: Blob | ArrayBuffer | Uint8Array;
  contentType: string;
}): Promise<S3UploadResult> {
  const res = await fetch(args.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': args.contentType },
    body: args.file as Blob,
  });
  return { ok: res.ok };
}

export async function startS3Processing(params: {
  carMake: string;
  carModel: string;
  imageUrl: string;
  fileKey: string;
}): Promise<StartProcessingResponse> {
  const { data } = await apiClient.post<StartProcessingResponse>(
    '/api/s3upload',
    {
      carMake: params.carMake,
      carModel: params.carModel,
      imageUrl: params.imageUrl,
      fileKey: params.fileKey,
    }
  );
  return data;
}

export async function dataUrlToJpegBlob(dataUrl: string): Promise<Blob> {
  // react-webcam provides a data URL. Convert it to Blob for upload
  const res = await fetch(dataUrl);
  return await res.blob();
}


