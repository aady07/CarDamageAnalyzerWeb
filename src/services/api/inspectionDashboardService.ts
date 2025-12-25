import { apiClient } from './authenticatedApiService';

// TypeScript interfaces matching the API documentation

export interface Inspection {
  id: number;
  registrationNumber: string;
  clientName: string | null;
  clientDisplayName: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  pdfReportUrl: string | null;
  pdfReady: boolean;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  videoUrl: string | null;
}

// Parsed AI comment structure
export interface ParsedAIComment {
  damageType: 'dent' | 'damage' | 'scratch' | null;
  logo: 'yes' | 'no' | null;
  rawComment: string;
}

export interface Comments {
  original?: string;
  ai1?: string;
  ai2?: string;
  increment?: string;
}

export interface ModelOutput {
  id: number;
  modelNumber: number;
  confidence: number;
  confidencePercentage: string;
  label: string;
  model1ImageUrl: string | null;
  model2ImageUrl: string | null;
  model1ImageStreamUrl: string;
  model2ImageStreamUrl: string;
}

export interface DamageAnalysis {
  hasDamage: boolean;
  confidence: number;
  confidencePercentage: string;
  label: string;
  claimStatus: string;
  modelOutputs: ModelOutput[];
}

export interface ImageImages {
  originalImageUrl: string | null;
  originalImageStreamUrl: string | null;
  previousImageUrl: string | null;
  previousImageStreamUrl: string | null;
  previousImageId: number | null;
  incrementImageUrl: string | null;
  incrementImageStreamUrl: string | null;
  aiProcessedImageUrl: string | null;
  aiProcessedImageStreamUrl: string | null;
}

export interface Image {
  id: number;
  imageType: string;
  processingOrder: number;
  sessionType: string | null;
  inspectionStatus: string;
  approvedAt: string | null;
  inspectorId: string | null;
  claimId: number | null;
  comments: Comments;
  images: ImageImages;
  damageAnalysis: DamageAnalysis;
}

export interface Summary {
  totalImages: number;
  imagesWithDamage: number;
  imagesWithoutDamage: number;
  averageConfidence: number;
  averageConfidencePercentage: string;
  damageBreakdown: {
    [damageType: string]: number;
  };
}

export interface DashboardData {
  inspection: Inspection;
  images: Image[];
  summary: Summary;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  error?: string;
}

export interface InspectionReadinessResponse {
  success: boolean;
  ready: boolean;
  inspectionId: number;
  message: string;
}

export interface SingleImageResponse {
  success: boolean;
  data: Image;
  error?: string;
}

export interface SummaryResponse {
  success: boolean;
  data: Summary;
  error?: string;
}

/**
 * Check if an inspection is ready for dashboard display
 */
export async function checkInspectionReadiness(inspectionId: number): Promise<InspectionReadinessResponse> {
  const { data } = await apiClient.get<InspectionReadinessResponse>(
    `/api/inspections/dashboard/${inspectionId}/ready`
  );
  return data;
}

/**
 * Get complete dashboard data for an inspection
 */
export async function getDashboardData(inspectionId: number): Promise<DashboardData> {
  const { data } = await apiClient.get<DashboardResponse>(
    `/api/inspections/dashboard/${inspectionId}`
  );
  if (!data.success) {
    throw new Error(data.error || 'Failed to load dashboard data');
  }
  return data.data;
}

/**
 * Get single image details
 */
export async function getImageDetails(inspectionId: number, imageId: number): Promise<Image> {
  const { data } = await apiClient.get<SingleImageResponse>(
    `/api/inspections/dashboard/${inspectionId}/images/${imageId}`
  );
  if (!data.success) {
    throw new Error(data.error || 'Failed to load image details');
  }
  return data.data;
}

/**
 * Get inspection summary statistics
 */
export async function getInspectionSummary(inspectionId: number): Promise<Summary> {
  const { data } = await apiClient.get<SummaryResponse>(
    `/api/inspections/dashboard/${inspectionId}/summary`
  );
  if (!data.success) {
    throw new Error(data.error || 'Failed to load summary');
  }
  return data.data;
}

/**
 * Fetch image blob from stream URL with authentication
 */
export async function fetchImageBlob(streamUrl: string | null): Promise<Blob | null> {
  if (!streamUrl) return null;
  
  try {
    // If it's already a full URL, use it directly, otherwise prepend baseURL
    const url = streamUrl.startsWith('http') 
      ? streamUrl 
      : `${apiClient.defaults.baseURL || ''}${streamUrl}`;
    
    const response = await apiClient.get(url, { responseType: 'blob' });
    return response.data as Blob;
  } catch (error) {
    console.error('Failed to fetch image blob:', streamUrl, error);
    return null;
  }
}

