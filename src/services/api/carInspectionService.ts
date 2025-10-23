import { apiClient } from './authenticatedApiService';

export interface CarInspectionImage {
  type: 'front' | 'back' | 'left' | 'right';
  imageUrl: string;
}

export interface CarInspectionRequest {
  registrationNumber: string;
  images: CarInspectionImage[];
  videoUrl: string;
}

export interface CarInspectionResponse {
  success: boolean;
  inspectionId: number;
  registrationNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  videoUrl: string;
  videoUploadedAt: string;
}

export async function submitCarInspection(request: CarInspectionRequest): Promise<CarInspectionResponse> {
  const { data } = await apiClient.post<CarInspectionResponse>(
    '/api/car-inspection/submit',
    request
  );
  return data;
}
