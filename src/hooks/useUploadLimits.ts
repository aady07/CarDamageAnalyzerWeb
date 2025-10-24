import { useState, useEffect, useCallback } from 'react';
import { getLimitInfo, LimitInfoResponse, getRemainingAssessments, canPerformAssessment } from '../services/api/limitService';
import { cognitoService } from '../services/cognitoService';

export interface UploadLimitsState {
  limitInfo: LimitInfoResponse | null;
  loading: boolean;
  error: string | null;
  remainingAssessments: number;
  canPerformAssessment: boolean;
}

export function useUploadLimits() {
  const [state, setState] = useState<UploadLimitsState>({
    limitInfo: null,
    loading: true,
    error: null,
    remainingAssessments: 0,
    canPerformAssessment: false,
  });

  const fetchLimitInfo = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      // Avoid 401 redirect loop before auth is established
      const authed = await cognitoService.isAuthenticated();
      if (!authed) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          limitInfo: null,
          remainingAssessments: 0,
          canPerformAssessment: false,
        }));
        return;
      }
      const limitInfo = await getLimitInfo();
      const remainingAssessments = getRemainingAssessments(limitInfo.stats.remainingUploads);
      const canPerform = canPerformAssessment(limitInfo.stats.remainingUploads);
      
      setState({
        limitInfo,
        loading: false,
        error: null,
        remainingAssessments,
        canPerformAssessment: canPerform,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load upload limits',
      }));
    }
  }, []);

  useEffect(() => {
    fetchLimitInfo();
  }, [fetchLimitInfo]);

  return {
    ...state,
    refetch: fetchLimitInfo,
  };
}
