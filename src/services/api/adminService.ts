import { apiClient } from './authenticatedApiService';

// Admin Check
export interface AdminCheckResponse {
  isAdmin: boolean;
  userRole: string;
  userId: string;
}

// Inspection Types
export interface AdminInspection {
  id: number;
  registrationNumber: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  pdfReady: boolean;
  createdAt: string;
  totalDamagePercentage: number | null;
  estimatedCost: number | null;
  isEdited: boolean;
  editCount: number;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  userId: string;
}

export interface AdminInspectionDetails extends AdminInspection {
  status: string;
  completedAt: string | null;
  originalPdfPath: string | null;
  editedPdfPath: string | null;
}

export interface AdminInspectionsResponse {
  inspections: AdminInspection[];
  count: number;
}

// Report Management Types
export interface ReportFormatsResponse {
  availableFormats: string[];
  currentFormat: string;
  canUpload: boolean;
}

export interface ReportUploadResponse {
  message: string;
  inspection: {
    id: number;
    isModified: boolean;
    modifiedBy: string;
    modifiedAt: string;
    modificationReason: string;
    reportFormat: string;
    isEdited: boolean;
    editCount: number;
  };
  newReportPath: string;
}

// Approval Types
export interface ApprovalRequest {
  adminNotes: string;
}

export interface ApprovalResponse {
  message: string;
  inspection: {
    id: number;
    approvalStatus: 'APPROVED' | 'REJECTED';
    approvedBy: string;
    approvedAt: string;
    adminNotes: string;
  };
}

// PDF View Response
export interface PDFViewResponse {
  pdfPath: string;
  pdfReady: boolean;
}

// Admin Service Functions
export async function checkAdminStatus(): Promise<AdminCheckResponse> {
  const { data } = await apiClient.get<AdminCheckResponse>('/api/admin/check-admin');
  return data;
}

export async function getPendingInspections(): Promise<AdminInspectionsResponse> {
  const { data } = await apiClient.get<AdminInspectionsResponse>('/api/admin/inspections/pending');
  return data;
}

export async function getAllInspections(): Promise<AdminInspectionsResponse> {
  const { data } = await apiClient.get<AdminInspectionsResponse>('/api/admin/inspections/all');
  return data;
}

export async function getInspectionDetails(inspectionId: number): Promise<AdminInspectionDetails> {
  const { data } = await apiClient.get<AdminInspectionDetails>(`/api/admin/inspections/${inspectionId}`);
  return data;
}

export async function viewInspectionPDF(inspectionId: number): Promise<PDFViewResponse> {
  const { data } = await apiClient.get<PDFViewResponse>(`/api/admin/inspections/${inspectionId}/pdf`);
  return data;
}

export async function approveInspection(inspectionId: number, request: ApprovalRequest): Promise<ApprovalResponse> {
  const { data } = await apiClient.post<ApprovalResponse>(`/api/admin/inspections/${inspectionId}/approve`, request);
  return data;
}

export async function rejectInspection(inspectionId: number, request: ApprovalRequest): Promise<ApprovalResponse> {
  const { data } = await apiClient.post<ApprovalResponse>(`/api/admin/inspections/${inspectionId}/reject`, request);
  return data;
}

// Report Management Functions
export async function getReportFormats(inspectionId: number): Promise<ReportFormatsResponse> {
  const { data } = await apiClient.get<ReportFormatsResponse>(`/api/admin/inspections/${inspectionId}/report/formats`);
  return data;
}

export async function downloadReport(inspectionId: number, format: string): Promise<Blob> {
  const response = await apiClient.get(`/api/admin/inspections/${inspectionId}/report/download/${format}`, {
    responseType: 'blob'
  });
  return response.data;
}

export async function uploadModifiedReport(inspectionId: number, file: File, editReason: string): Promise<ReportUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('editReason', editReason);
  
  const { data } = await apiClient.post<ReportUploadResponse>(`/api/admin/inspections/${inspectionId}/report/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return data;
}
