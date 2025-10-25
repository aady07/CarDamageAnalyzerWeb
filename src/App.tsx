import { useState, useEffect, useCallback } from 'react';
import { useCognitoAuth } from './hooks/useCognitoAuth.js';
import { UploadLimitsProvider } from './contexts/UploadLimitsContext';
import AppContent from './components/AppContent';

function App() {
  const { isAuthenticated, signOut } = useCognitoAuth();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const ok = await isAuthenticated();
      setIsAuthed(!!ok);
    } catch {
      setIsAuthed(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      await signOut();
      setIsAuthed(false);
    } catch (_) {}
  };

  const handleAuthSuccess = async () => {
    await checkAuth();
  };

  return (
    <UploadLimitsProvider key={isAuthed ? 'authenticated' : 'unauthenticated'}>
      <AppContent 
        isAuthed={isAuthed}
        needsAuth={needsAuth}
        onLogout={handleLogout}
        onAuthSuccess={handleAuthSuccess}
      />
    </UploadLimitsProvider>
  );
}

export default App;