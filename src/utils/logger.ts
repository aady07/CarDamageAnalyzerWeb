/**
 * Logger utility for Android WebView compatibility
 * Android WebView only intercepts logger.log, not console.log
 */

interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
}

// Check if we're in Android WebView (has window.logger)
const isAndroidWebView = typeof window !== 'undefined' && (window as any).logger;

// Use Android logger if available, otherwise fallback to console
const androidLogger = isAndroidWebView ? (window as any).logger : null;

export const logger: Logger = {
  log: (...args: any[]) => {
    if (androidLogger?.log) {
      androidLogger.log(...args);
    }
    console.log(...args);
  },
  error: (...args: any[]) => {
    if (androidLogger?.error) {
      androidLogger.error(...args);
    }
    console.error(...args);
  },
  warn: (...args: any[]) => {
    if (androidLogger?.warn) {
      androidLogger.warn(...args);
    }
    console.warn(...args);
  },
  info: (...args: any[]) => {
    if (androidLogger?.info) {
      androidLogger.info(...args);
    }
    console.info(...args);
  },
};
