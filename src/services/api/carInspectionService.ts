import { apiClient } from './authenticatedApiService';
import { CaptureSegmentId } from '../../types/capture';

export interface CarInspectionImage {
  type: CaptureSegmentId;
  imageUrl: string;
}

export interface CarInspectionRequest {
  registrationNumber: string;
  images: CarInspectionImage[];
  videoUrl: string;
  clientName: string;
  sessionType: string;
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

export interface DashboardSummary {
  morningDone: number;
  eveningDone: number;
  bothDone: number;
  pending: number;
}

export interface DashboardCar {
  carNumber: string;
  inspectionId: number;
  morningStatus: 'done' | 'pending';
  eveningStatus: 'done' | 'pending';
  morningImages: number;
  eveningImages: number;
  totalImages: number;
  expectedImages: number;
  overallStatus: string;
  totalDamagePercentage: number | null;
  estimatedCost: number | null;
  createdAt: string;
}

export interface DashboardResponse {
  success: boolean;
  date: string;
  totalCars: number;
  summary: DashboardSummary;
  cars: DashboardCar[];
  error?: string;
  message?: string;
}

export async function getTodayDashboard(clientName: string = 'SNAPCABS'): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>(
    `/api/car-inspection/dashboard/today?clientName=${clientName}`
  );
  return data;
}
