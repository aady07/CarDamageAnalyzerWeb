import { apiClient } from './authenticatedApiService';

export interface LimitInfoResponse {
  canUpload: boolean;
  stats: {
    userTier: string;
    totalUploads: number;
    uploadLimit: number;
    remainingUploads: number;
    isUnlimited: boolean;
    hasReachedLimit: boolean;
  };
  tierInfo: {
    name: string;
    uploadLimit: number;
    description: string;
    upgradeMessage: string;
  };
}

export async function getLimitInfo(): Promise<LimitInfoResponse> {
  const { data } = await apiClient.get<LimitInfoResponse>('/api/user/limit-info');
  return data;
}

// Mock function for testing - returns different scenarios
export async function getMockLimitInfo(scenario: 'normal' | 'limited' | 'unlimited' = 'normal'): Promise<LimitInfoResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  switch (scenario) {
    case 'limited':
      return {
        canUpload: false,
        stats: {
          userTier: "FREE",
          totalUploads: 20,
          uploadLimit: 24,
          remainingUploads: 2,
          isUnlimited: false,
          hasReachedLimit: false
        },
        tierInfo: {
          name: "Free",
          uploadLimit: 24,
          description: "Free tier with 24 upload limit",
          upgradeMessage: "Upgrade to Premium for unlimited uploads"
        }
      };
    case 'unlimited':
      return {
        canUpload: true,
        stats: {
          userTier: "PREMIUM",
          totalUploads: 100,
          uploadLimit: -1,
          remainingUploads: -1,
          isUnlimited: true,
          hasReachedLimit: false
        },
        tierInfo: {
          name: "Premium",
          uploadLimit: -1,
          description: "Premium tier with unlimited uploads",
          upgradeMessage: "You have unlimited uploads!"
        }
      };
    default: // normal
      return {
        canUpload: true,
        stats: {
          userTier: "FREE",
          totalUploads: 5,
          uploadLimit: 24,
          remainingUploads: 19,
          isUnlimited: false,
          hasReachedLimit: false
        },
        tierInfo: {
          name: "Free",
          uploadLimit: 24,
          description: "Free tier with 24 upload limit",
          upgradeMessage: "Upgrade to Premium for unlimited uploads"
        }
      };
  }
}

// Helper function to calculate remaining assessments (1 assessment = 4 uploads)
export function getRemainingAssessments(remainingUploads: number): number {
  // Treat negative remaining uploads (e.g., -1 for unlimited) as unlimited
  if (remainingUploads < 0) return Number.POSITIVE_INFINITY;
  return Math.floor(remainingUploads / 4);
}

// Helper function to check if user can perform assessment
export function canPerformAssessment(remainingUploads: number): boolean {
  // Allow if unlimited (negative remaining uploads) or if at least 4 uploads are available
  return remainingUploads < 0 || remainingUploads >= 4;
}
