import { apiClient } from './authenticatedApiService';

// Client Access Check
export interface ClientAccessResponse {
  hasAccess: boolean;
  isClientHead: boolean;
  clientName: string;
  clientDisplayName?: string;
  userId: string;
}

// Dashboard Session Types
export interface DashboardSession {
  status: 'done' | 'pending';
  imageCount: number;
  submittedAt?: string;
}

export interface DashboardSessions {
  morning: DashboardSession;
  evening: DashboardSession;
}

// Dashboard Car
export interface DashboardCar {
  carNumber: string;
  inspectionId: number;
  createdBy: string;
  sessions: DashboardSessions;
  status: string;
  pdfUrl?: string | null;
  pdfReady: boolean;
  totalDamagePercentage: number | null;
  estimatedCost: number | null;
  createdAt: string;
  lastUpdatedAt: string;
}

// Dashboard Summary
export interface DashboardSummary {
  totalCars: number;
  morningDone: number;
  eveningDone: number;
  bothDone: number;
  pending: number;
}

// Dashboard Response
export interface DashboardResponse {
  success: boolean;
  clientName: string;
  clientDisplayName?: string;
  date: string;
  summary: DashboardSummary;
  cars: DashboardCar[];
  error?: string;
  message?: string;
}

// Client Service Functions
export async function checkClientAccess(clientName: string = 'SNAPCABS'): Promise<ClientAccessResponse> {
  const { data } = await apiClient.get<ClientAccessResponse>(`/api/client/check-access?clientName=${clientName}`);
  return data;
}

export async function getClientDashboard(clientName: string = 'SNAPCABS', date: string): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>(`/api/client/dashboard?clientName=${clientName}&date=${date}`);
  return data;
}
