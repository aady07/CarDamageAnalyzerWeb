import React, { createContext, useContext, ReactNode } from 'react';
import { useUploadLimits, UploadLimitsState } from '../hooks/useUploadLimits';

interface UploadLimitsContextType extends UploadLimitsState {
  refetch: () => Promise<void>;
}

const UploadLimitsContext = createContext<UploadLimitsContextType | undefined>(undefined);

interface UploadLimitsProviderProps {
  children: ReactNode;
}

export const UploadLimitsProvider: React.FC<UploadLimitsProviderProps> = ({ children }) => {
  const uploadLimits = useUploadLimits();

  return (
    <UploadLimitsContext.Provider value={uploadLimits}>
      {children}
    </UploadLimitsContext.Provider>
  );
};

export const useUploadLimitsContext = (): UploadLimitsContextType => {
  const context = useContext(UploadLimitsContext);
  if (context === undefined) {
    throw new Error('useUploadLimitsContext must be used within an UploadLimitsProvider');
  }
  return context;
};
