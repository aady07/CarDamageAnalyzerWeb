import { useState, useEffect, useCallback } from 'react';
import { cognitoService } from '../services/cognitoService';

export function useCognitoAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await cognitoService.getSession();
        if (mounted && session) setUser(cognitoService.getCurrentUser());
      } catch (err) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signUp = useCallback(async (email, password) => {
    setError(null);
    return cognitoService.signUp(email, password);
  }, []);

  const confirmSignUp = useCallback(async (email, code) => {
    setError(null);
    return cognitoService.confirmSignUp(email, code);
  }, []);

  const resendConfirmationCode = useCallback(async (email) => {
    setError(null);
    return cognitoService.resendConfirmationCode(email);
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    const res = await cognitoService.signIn(email, password);
    const session = await cognitoService.getSession();
    if (session) setUser(cognitoService.getCurrentUser());
    return res;
  }, []);

  const signOut = useCallback(() => {
    cognitoService.signOut();
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setError(null);
    return cognitoService.forgotPassword(email);
  }, []);

  const confirmForgotPassword = useCallback(async (email, code, newPassword) => {
    setError(null);
    return cognitoService.confirmForgotPassword(email, code, newPassword);
  }, []);

  const getUserId = useCallback(() => cognitoService.getUserId(), []);
  const getUserEmail = useCallback(() => cognitoService.getUserEmail(), []);
  const isAuthenticated = useCallback(() => cognitoService.isAuthenticated(), []);

  return {
    user,
    loading,
    error,
    signUp,
    confirmSignUp,
    resendConfirmationCode,
    signIn,
    signOut,
    forgotPassword,
    confirmForgotPassword,
    getUserId,
    getUserEmail,
    isAuthenticated,
  };
}


