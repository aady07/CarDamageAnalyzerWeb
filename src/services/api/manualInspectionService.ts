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

export interface LockInfo {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  isCurrentUser: boolean;
}

/** Client metadata for UI (badges, filters, etc.) */
export interface ClientInfo {
  clientId: string; // "SNAPCABS" | "REFUX" | "REGULAR" | etc.
  clientDisplayName: string; // e.g. "Snap-E CABS", "Refex Mobility"
  isSnapcabs: boolean;
  isRefux: boolean;
  maxImages: number;
  maxImagesPerSession: number | null;
  hasSessions: boolean;
  clientType: 'session-based' | 'daily' | 'regular';
}

/** First vs second submission today for that car */
export interface InspectionTodayInfo {
  totalInspectionsToday: number;
  submissionIndexToday: number; // 1-based
  isFirstSubmissionToday: boolean;
  isSecondSubmissionToday: boolean;
  label: string; // e.g. "First submission today", "Second submission today"
}

/** Session info (SNAPCABS only, else null) */
export interface SessionInfo {
  sessionType: 'MORNING' | 'EVENING';
  morningImageCount: number;
  eveningImageCount: number;
  isEveningMissing: boolean;
}

export interface InspectionImage {
  id: number;
  imageUrl: string; // S3 URL (direct access may cause 403)
  streamUrl: string; // Backend proxy URL - use this for displaying images
  imageType: string;
  inspectionStatus: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  processingOrder: number;
  createdAt: string;
  approvedAt: string | null;
  inspectorId: string | null;
  annotations: string | null;
  inspectionId: number;
  carNumber: string;
  clientName: string;
  clientInfo?: ClientInfo;
  inspectionTodayInfo?: InspectionTodayInfo;
  sessionInfo?: SessionInfo | null;
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
  // Lock information
  lockInfo?: LockInfo;
  // Previous day image fields
  previousAiImageComment?: string; // AI comment for the previous day's image
  previousImageInspectionId?: number; // The inspection ID that the previous image belongs to
  previousImageDate?: string; // The date (date only, no time) of the previous image's inspection
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PendingImagesResponse {
  success: boolean;
  images: InspectionImage[];
  count: number;
  pagination?: PaginationInfo;
  filters?: {
    availableStatuses: string[];
  };
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
 * Get pending images for manual inspection with sorting, filtering, search, and pagination
 */
export async function getPendingImages(params?: {
  clientName?: string;
  inspectionId?: number;
  sortBy?: 'createdAt' | 'carNumber' | 'status';
  sortOrder?: 'asc' | 'desc';
  status?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PendingImagesResponse> {
  console.log('[ManualInspectionService] getPendingImages called with params:', params);
  const queryParams = new URLSearchParams();
  if (params?.clientName) {
    queryParams.append('clientName', params.clientName);
  }
  if (params?.inspectionId) {
    queryParams.append('inspectionId', params.inspectionId.toString());
  }
  if (params?.sortBy) {
    queryParams.append('sortBy', params.sortBy);
  }
  if (params?.sortOrder) {
    queryParams.append('sortOrder', params.sortOrder);
  }
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
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

/**
 * Access Control
 */
export interface CheckAccessResponse {
  success: boolean;
  hasAccess: boolean;
  userId?: string;
  message?: string;
}

export async function checkDashboardAccess(): Promise<CheckAccessResponse> {
  const { data } = await apiClient.get<CheckAccessResponse>(
    '/api/manual-inspection/dashboard/check-access'
  );
  return data;
}

/**
 * Image Locking
 */
export interface LockImageResponse {
  success: boolean;
  message: string;
  imageId: number;
  lockedBy: string;
}

export interface UnlockImageResponse {
  success: boolean;
  message: string;
  imageId: number;
}

export interface LockStatusResponse {
  success: boolean;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  isCurrentUser: boolean;
}

export async function lockImage(imageId: number): Promise<LockImageResponse> {
  const { data } = await apiClient.post<LockImageResponse>(
    `/api/manual-inspection/images/${imageId}/lock`
  );
  return data;
}

export async function unlockImage(imageId: number): Promise<UnlockImageResponse> {
  const { data } = await apiClient.post<UnlockImageResponse>(
    `/api/manual-inspection/images/${imageId}/unlock`
  );
  return data;
}

export async function getLockStatus(imageId: number): Promise<LockStatusResponse> {
  const { data } = await apiClient.get<LockStatusResponse>(
    `/api/manual-inspection/images/${imageId}/lock-status`
  );
  return data;
}

export async function sendLockHeartbeat(imageId: number): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<{ success: boolean }>(
    `/api/manual-inspection/images/${imageId}/lock/heartbeat`
  );
  return data;
}

/**
 * Bulk Operations
 */
export interface BulkApproveRequest {
  imageIds: number[];
}

export interface BulkApproveResponse {
  success: boolean;
  message: string;
  successCount: number;
  failedCount: number;
  totalCount: number;
  successList: Array<{ imageId: number; inspectionId: number }>;
  failedList: Array<{ imageId: number; error: string }>;
}

export interface BulkRemoveRequest {
  imageIds: number[];
}

export interface BulkRemoveResponse {
  success: boolean;
  message: string;
  successCount: number;
  failedCount: number;
  totalCount: number;
  failedList: Array<{ imageId: number; error: string }>;
}

export interface BulkFilterRequest {
  filters: {
    clientName?: string;
    inspectionId?: number;
    olderThanDays?: number;
  };
}

export interface BulkFilterApproveResponse {
  success: boolean;
  message: string;
  filters: {
    clientName?: string;
    inspectionId?: number;
    olderThanDays?: number;
  };
  successCount: number;
  failedCount: number;
  totalCount: number;
  successList: Array<{ imageId: number; inspectionId: number }>;
  failedList: Array<{ imageId: number; error: string }>;
}

export interface BulkFilterRemoveResponse {
  success: boolean;
  message: string;
  filters: {
    clientName?: string;
    inspectionId?: number;
    olderThanDays?: number;
  };
  successCount: number;
  failedCount: number;
  totalCount: number;
  failedList: Array<{ imageId: number; error: string }>;
}

/**
 * Bulk approve images by IDs
 */
export async function bulkApproveImages(request: BulkApproveRequest): Promise<BulkApproveResponse> {
  const { data } = await apiClient.post<BulkApproveResponse>(
    '/api/manual-inspection/images/bulk-approve',
    request
  );
  return data;
}

/**
 * Bulk remove images from queue by IDs
 */
export async function bulkRemoveImages(request: BulkRemoveRequest): Promise<BulkRemoveResponse> {
  const { data } = await apiClient.post<BulkRemoveResponse>(
    '/api/manual-inspection/images/bulk-remove',
    request
  );
  return data;
}

/**
 * Bulk approve images by filters
 */
export async function bulkApproveFiltered(request: BulkFilterRequest): Promise<BulkFilterApproveResponse> {
  const { data } = await apiClient.post<BulkFilterApproveResponse>(
    '/api/manual-inspection/images/bulk-approve-filtered',
    request
  );
  return data;
}

/**
 * Bulk remove images from queue by filters
 */
export async function bulkRemoveFiltered(request: BulkFilterRequest): Promise<BulkFilterRemoveResponse> {
  const { data } = await apiClient.post<BulkFilterRemoveResponse>(
    '/api/manual-inspection/images/bulk-remove-filtered',
    request
  );
  return data;
}

