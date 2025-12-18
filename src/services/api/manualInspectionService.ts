import { apiClient } from './authenticatedApiService';

// Types for Manual Inspection
export interface AIDamageData {
  id: number; // ID for updating AI damage data
  modelNumber: number; // 1 or 2
  confidence: number; // 0-100 (percentage)
  confidencePercentage: string; // "92.30%"
  label: string; // Damage type label
  model1ImageStreamUrl?: string; // Backend stream URL for model 1 image
  model2ImageStreamUrl?: string; // Backend stream URL for model 2 image
  model1ImageUrl?: string | null; // Original S3 URL (for reference only)
  model2ImageUrl?: string | null; // Original S3 URL (for reference only)
}

export interface ImageComments {
  original?: string;
  ai1?: string;
  ai2?: string;
  increment?: string;
}

export interface InspectionImage {
  id: number;
  imageUrl: string; // S3 URL (direct access may cause 403)
  streamUrl: string; // Backend proxy URL - use this for displaying images
  imageType: string;
  inspectionStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  processingOrder: number;
  createdAt: string;
  approvedAt: string | null;
  inspectorId: string | null;
  annotations: string | null;
  inspectionId: number;
  carNumber: string;
  clientName: string;
  // AI Processing Data
  aiProcessed?: boolean; // true if AI processing completed
  aiProcessingStatus?: 'processing' | 'completed' | 'error'; // AI processing status
  aiProcessedImageUrls?: string[]; // URLs of AI processed images (model outputs)
  aiDamageData?: AIDamageData[]; // Detailed damage data for each model
  damageConfidence?: number; // Best confidence score (0-100)
  damageConfidencePercentage?: string; // Formatted percentage (e.g., "92.30%")
  damageLabel?: string; // Best damage label (e.g., "Dent", "Scratch")
  claimStatus?: string; // Claim processing status ("processed", "error")
  // New fields for image editing
  incrementImageUrl?: string; // S3 URL for increment image
  incrementImageStreamUrl?: string; // Backend stream URL for increment image
  imageComments?: ImageComments; // Comments for each image type
}

export interface PendingImagesResponse {
  success: boolean;
  images: InspectionImage[];
  count: number;
}

export interface PreviousDayImageResponse {
  success: boolean;
  found: boolean;
  image?: InspectionImage;
  message?: string;
}

export interface AnnotationsUpdateRequest {
  annotations: string;
}

export interface AnnotationsUpdateResponse {
  success: boolean;
  image: InspectionImage;
  message: string;
}

export interface InspectionProgress {
  approvedCount: number;
  totalImages: number;
  isComplete: boolean;
}

export interface ApproveImageResponse {
  success: boolean;
  image: InspectionImage;
  message: string;
  inspectionProgress: InspectionProgress;
  reportGeneration?: string;
}

export interface InspectionDetails {
  id: number;
  registrationNumber: string;
  clientName: string;
  status: string;
  createdAt: string;
}

export interface InspectionDetailsResponse {
  success: boolean;
  inspection: InspectionDetails;
  images: InspectionImage[];
  progress: InspectionProgress;
}

// API Service Functions

/**
 * Get pending images for manual inspection
 */
export async function getPendingImages(params?: {
  clientName?: string;
  inspectionId?: number;
}): Promise<PendingImagesResponse> {
  console.log('[ManualInspectionService] getPendingImages called with params:', params);
  const queryParams = new URLSearchParams();
  if (params?.clientName) {
    queryParams.append('clientName', params.clientName);
  }
  if (params?.inspectionId) {
    queryParams.append('inspectionId', params.inspectionId.toString());
  }
  
  const queryString = queryParams.toString();
  const url = `/api/manual-inspection/pending-images${queryString ? `?${queryString}` : ''}`;
  console.log('[ManualInspectionService] Making GET request to:', url);
  console.log('[ManualInspectionService] Full URL will be:', window.location.origin + url);
  
  try {
    const response = await apiClient.get<PendingImagesResponse>(url);
    console.log('[ManualInspectionService] API response received:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    return response.data;
  } catch (error: any) {
    console.error('[ManualInspectionService] API request failed:', {
      error,
      message: error?.message,
      response: error?.response,
      responseData: error?.response?.data,
      responseStatus: error?.response?.status,
      responseHeaders: error?.response?.headers,
      requestUrl: url
    });
    throw error;
  }
}

/**
 * Get previous day's image for comparison
 */
export async function getPreviousDayImage(
  carNumber: string,
  imageType: string
): Promise<PreviousDayImageResponse> {
  const { data } = await apiClient.get<PreviousDayImageResponse>(
    `/api/manual-inspection/images/previous-day?carNumber=${encodeURIComponent(carNumber)}&imageType=${encodeURIComponent(imageType)}`
  );
  return data;
}

/**
 * Update annotations for an image (does not approve)
 */
export async function updateAnnotations(
  imageId: number,
  annotations: string
): Promise<AnnotationsUpdateResponse> {
  const { data } = await apiClient.post<AnnotationsUpdateResponse>(
    `/api/manual-inspection/images/${imageId}/annotate`,
    { annotations }
  );
  return data;
}

/**
 * Approve an image (optionally with annotations)
 */
export async function approveImage(
  imageId: number,
  annotations?: string
): Promise<ApproveImageResponse> {
  const body = annotations ? { annotations } : {};
  const { data } = await apiClient.post<ApproveImageResponse>(
    `/api/manual-inspection/images/${imageId}/approve`,
    body
  );
  return data;
}

/**
 * Get inspection details by inspection ID
 */
export async function getInspectionDetails(
  inspectionId: number
): Promise<InspectionDetailsResponse> {
  const { data } = await apiClient.get<InspectionDetailsResponse>(
    `/api/manual-inspection/inspections/${inspectionId}`
  );
  return data;
}

/**
 * Update AI damage data (confidence and label)
 */
export interface UpdateAIDamageRequest {
  confidence: number; // Percentage (0-100) or decimal (0-1). If > 1, treated as percentage
  label: string;
}

export interface UpdateAIDamageResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    confidence: number;
    label: string;
  };
}

export async function updateAIDamageData(
  claimModelOutputId: number,
  updates: UpdateAIDamageRequest
): Promise<UpdateAIDamageResponse> {
  const { data } = await apiClient.post<UpdateAIDamageResponse>(
    `/api/manual-inspection/ai-damage/${claimModelOutputId}/update`,
    updates
  );
  return data;
}

/**
 * Replace AI processed image (model1 or model2)
 */
export interface ReplaceAIImageRequest {
  modelType: 'model1' | 'model2';
  imageUrl: string; // S3 URL of the new image
}

export interface ReplaceAIImageResponse {
  success: boolean;
  message: string;
  image: InspectionImage;
}

export async function replaceAIImage(
  imageId: number,
  request: ReplaceAIImageRequest
): Promise<ReplaceAIImageResponse> {
  const { data } = await apiClient.post<ReplaceAIImageResponse>(
    `/api/manual-inspection/images/${imageId}/replace-ai-image`,
    request
  );
  return data;
}

/**
 * Upload increment image
 */
export interface UploadIncrementImageRequest {
  imageUrl: string; // S3 URL of the increment image
}

export interface UploadIncrementImageResponse {
  success: boolean;
  message: string;
  image: InspectionImage;
}

export async function uploadIncrementImage(
  imageId: number,
  request: UploadIncrementImageRequest
): Promise<UploadIncrementImageResponse> {
  const { data } = await apiClient.post<UploadIncrementImageResponse>(
    `/api/manual-inspection/images/${imageId}/increment-image`,
    request
  );
  return data;
}

/**
 * Update image comments
 */
export interface UpdateImageCommentsRequest {
  comments: ImageComments;
}

export interface UpdateImageCommentsResponse {
  success: boolean;
  message: string;
  image: InspectionImage;
}

export async function updateImageComments(
  imageId: number,
  request: UpdateImageCommentsRequest
): Promise<UpdateImageCommentsResponse> {
  const { data } = await apiClient.post<UpdateImageCommentsResponse>(
    `/api/manual-inspection/images/${imageId}/comments`,
    request
  );
  return data;
}

