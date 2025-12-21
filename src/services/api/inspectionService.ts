import { apiClient } from './authenticatedApiService';

export interface InspectionSession {
  submitted: boolean;
  imageCount: number;
  submittedAt?: string;
}

export interface InspectionSessions {
  morning: InspectionSession;
  evening: InspectionSession;
}

export interface CarInspection {
  id: number;
  registrationNumber: string;
  status: 'completed' | 'processing' | 'failed';
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  pdfReady?: boolean;
  createdAt: string;
  completedAt: string | null;
  pdfReportUrl?: string | null; // Deprecated - use pdfPath instead
  pdfPath?: string | null; // New field from backend
  totalDamagePercentage?: number | null;
  estimatedCost?: number | null;
  videoUrl?: string | null;
  videoUploadedAt?: string | null;
  message?: string;
  adminNotes?: string;
  sessions?: InspectionSessions;
  lastUpdatedAt?: string;
}

export interface UserInspectionsResponse {
  success: boolean;
  userId: string;
  count: number;
  inspections: CarInspection[];
}

export interface InspectionStatusResponse {
  success: boolean;
  inspectionId: number;
  registrationNumber: string;
  status: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  pdfReady: boolean;
  createdAt: string;
  completedAt: string | null;
  pdfPath?: string;
  totalDamagePercentage?: number;
  estimatedCost?: number;
  message?: string;
  adminNotes?: string;
}

export interface InspectionReportResponse {
  success: boolean;
  inspectionId: number;
  registrationNumber: string;
  status: string;
  pdfPath: string;
  approvalStatus: 'APPROVED';
  totalDamagePercentage: number;
  estimatedCost: number;
  createdAt: string;
  completedAt: string | null;
}

export interface PDFAvailabilityResponse {
  success: boolean;
  pdfPath?: string;
  filename?: string;
  approvalStatus: 'APPROVED';
  approvedAt?: string;
  error?: string;
  message?: string;
  adminNotes?: string;
}

export async function getUserInspections(): Promise<UserInspectionsResponse> {
  const { data } = await apiClient.get<UserInspectionsResponse>('/api/car-inspection/user/inspections');
  return data;
}

export async function downloadInspectionPDF(filename: string): Promise<Blob> {
  const response = await apiClient.get(`/api/car-inspection/pdf/${filename}`, {
    responseType: 'blob'
  });
  return response.data;
}

export async function getInspectionStatus(registrationNumber: string): Promise<InspectionStatusResponse> {
  const { data } = await apiClient.get<InspectionStatusResponse>(`/api/car-inspection/${registrationNumber}/status`);
  return data;
}

export async function getInspectionReport(registrationNumber: string): Promise<InspectionReportResponse> {
  const { data } = await apiClient.get<InspectionReportResponse>(`/api/car-inspection/${registrationNumber}/report`);
  return data;
}

export async function checkPDFAvailability(registrationNumber: string): Promise<PDFAvailabilityResponse> {
  const { data } = await apiClient.get<PDFAvailabilityResponse>(`/api/car-inspection/${registrationNumber}/pdf`);
  return data;
}
