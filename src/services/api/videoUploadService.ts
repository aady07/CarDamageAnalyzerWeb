import { apiClient } from './authenticatedApiService';


export interface VideoPresignedUrlResponse {
  presignedUrl: string;
  fileKey: string;
  s3Url: string;
  expiration: number;
}

export interface VideoS3UploadResult {
  ok: boolean;
}

export async function getVideoPresignedUploadUrl(params: {
  fileName: string;
  contentType: string;
}): Promise<VideoPresignedUrlResponse> {
  
  const form = new URLSearchParams();
  form.set('fileName', params.fileName);
  form.set('contentType', params.contentType);

  const { data } = await apiClient.post<VideoPresignedUrlResponse>(
    '/api/get-video-upload-url',
    form,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return data;
}

export async function uploadVideoToS3(args: {
  presignedUrl: string;
  file: Blob | ArrayBuffer | Uint8Array;
  contentType: string;
}): Promise<VideoS3UploadResult> {
  const res = await fetch(args.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': args.contentType },
    body: args.file as Blob,
  });
  return { ok: res.ok };
}
