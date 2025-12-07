/**
 * Determines the session type based on current time
 * - Before 12:00 PM (noon) = MORNING
 * - After 4:00 PM (4pm) = EVENING
 * - Between 12:00 PM and 4:00 PM = defaults to MORNING
 */
export function getSessionType(): 'MORNING' | 'EVENING' {
  const now = new Date();
  const hours = now.getHours();
  
  // Before 12 PM (noon) = MORNING
  if (hours < 12) {
    return 'MORNING';
  }
  
  // After 4 PM = EVENING
  if (hours >= 16) {
    return 'EVENING';
  }
  
  // Between 12 PM and 4 PM = default to MORNING
  return 'MORNING';
}

