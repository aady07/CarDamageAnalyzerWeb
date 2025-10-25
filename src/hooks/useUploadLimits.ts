import { useState, useEffect, useCallback } from 'react';
import { getLimitInfo, LimitInfoResponse, getRemainingAssessments, canPerformAssessment } from '../services/api/limitService';
import { cognitoService } from '../services/cognitoService';
import { useCognitoAuth } from './useCognitoAuth';

export interface UploadLimitsState {
  limitInfo: LimitInfoResponse | null;
  loading: boolean;
  error: string | null;
  remainingAssessments: number;
  canPerformAssessment: boolean;
}

export function useUploadLimits() {
  const { user } = useCognitoAuth();
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
    // Clear state when user logs out
    if (!user) {
      setState({
        limitInfo: null,
        loading: false,
        error: null,
        remainingAssessments: 0,
        canPerformAssessment: false,
      });
      return;
    }
    
    // Fetch limits when user logs in or changes
    fetchLimitInfo();
  }, [fetchLimitInfo, user]);

  // Additional effect to handle authentication state changes more explicitly
  useEffect(() => {
    if (user) {
      // Force refresh when user changes (different user logs in)
      fetchLimitInfo();
    }
  }, [user?.getUsername?.(), fetchLimitInfo]);

  return {
    ...state,
    refetch: fetchLimitInfo,
  };
}
