import { useState, useEffect, useCallback } from 'react';
import { getLimitInfo, LimitInfoResponse, getRemainingAssessments, canPerformAssessment } from '../services/api/limitService';

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
      console.error('Failed to fetch limit info:', error);
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
