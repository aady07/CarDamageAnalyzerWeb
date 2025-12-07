/**
 * Android Bridge Interface for WebView communication
 * This interface allows the React app to communicate with the Android app
 * This is Android-only - no web fallback
 */

export interface AndroidBridge {
  /**
   * Save a pending inspection to Android app's local storage
   * The Android app will handle uploading when network is available
   * Returns a local inspection ID (UUID string)
   * 
   * Note: Android bridge expects JSON string, not object
   */
  savePendingInspection: (inspectionDataJson: string) => Promise<string>;
  
  /**
   * Get the status of an inspection by local ID
   */
  getInspectionStatus: (localInspectionId: string) => Promise<InspectionStatus>;
  
  /**
   * Manually trigger sync of pending inspections
   */
  triggerSync: () => Promise<void>;
  
  /**
   * Close the WebView and return to the Android app screen
   */
  closeWebView?: () => void;
}

export interface PendingInspectionData {
  registrationNumber: string;
  sessionType: 'MORNING' | 'EVENING';
  clientName: string;
  images: Array<{
    segmentId: string;
    localPath: string; // Local file path/URI from Android storage
  }>;
  vehicleDetails?: {
    make: string;
    model: string;
  };
}

export interface InspectionStatus {
  synced: boolean;
  inspectionId?: number; // From API after sync
  error?: string;
}

/**
 * Get the Android bridge
 * Throws error if not available (since this is Android-only)
 */
export function getAndroidBridge(): AndroidBridge {
  const bridge = (window as any)?.AndroidBridge;
  
  if (bridge && bridge.savePendingInspection) {
    return bridge as AndroidBridge;
  }
  
  throw new Error('Android bridge is not available. This app requires Android WebView.');
}

