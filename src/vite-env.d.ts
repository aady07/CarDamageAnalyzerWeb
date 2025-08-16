/// <reference types="vite/client" />

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.json' {
  const value: any;
  export default value;
}

// Screen Orientation API types
interface ScreenOrientation {
  lock(orientation: 'portrait' | 'landscape' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary' | 'natural' | 'any'): Promise<void>;
  unlock(): void;
  type: string;
  angle: number;
}

interface Screen {
  orientation: ScreenOrientation;
}

// Window orientation for mobile devices
interface Window {
  orientation?: number;
}
