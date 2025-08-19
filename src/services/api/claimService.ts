import { apiClient } from './authenticatedApiService';

export interface Claim {
  id: number;
  userId: string;
  make: string;
  model: string;
  status: 'processed' | 'processing' | 'error' | 'pending';
  originalImageUrl?: string;
  processedImageUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelOutput {
  id: number;
  claimId: number;
  modelNumber: 1 | 2;
  label: string;
  confidence: number; // 0..1
  fileFormat: string;
  outputS3Model1Url: string | null;
  outputS3Model2Url: string | null;
}

export interface ClaimResults {
  claimId: number;
  modelOutputs: ModelOutput[];
  costings: Array<{ id: number; claimId: number; part: string; price: string | number; confidence?: string }>; 
}

export async function fetchClaim(claimId: number): Promise<Claim> {
  const { data } = await apiClient.get<Claim>(`/api/claims/${claimId}`);
  return data;
}

export async function fetchClaimResults(claimId: number): Promise<ClaimResults> {
  try {
    // Structured logging for diagnostics
    // Using groupCollapsed to keep console tidy while still detailed when expanded
    console.groupCollapsed(`[API] GET /api/claims/${claimId}/results`);
    console.log('Request params:', { claimId });
    const { data } = await apiClient.get<ClaimResults>(`/api/claims/${claimId}/results`);
    console.log('Response data:', data);
    console.groupEnd();
    return data;
  } catch (error) {
    console.groupCollapsed(`[API ERROR] GET /api/claims/${claimId}/results`);
    console.error('Request params:', { claimId });
    console.error('Error:', error);
    console.groupEnd();
    throw error;
  }
}

export async function fetchOriginalImageBlob(claimId: number): Promise<Blob> {
  const res = await apiClient.get(`/api/claims/${claimId}/original-image`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function fetchModelImageBlob(claimId: number, which: 1 | 2): Promise<Blob> {
  const endpoint = which === 1 ? `/api/claims/${claimId}/model1-image` : `/api/claims/${claimId}/model2-image`;
  const res = await apiClient.get(endpoint, { responseType: 'blob' });
  return res.data as Blob;
}


