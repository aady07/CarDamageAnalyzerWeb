/**
 * Car Part Detection Overlay Component
 * Displays real-time bounding boxes around detected car parts
 */

import React, { useEffect, useRef } from 'react';
import { Detection, ValidationResult } from '../services/carPartDetection';

interface CarPartOverlayProps {
  detections: Detection[];
  validation: ValidationResult;
  currentPart: string;
  videoWidth: number;
  videoHeight: number;
  isActive: boolean;
}

const CarPartOverlay: React.FC<CarPartOverlayProps> = ({
  detections,
  validation,
  currentPart,
  videoWidth,
  videoHeight,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get required parts for current section
  const getRequiredParts = (part: string): string[] => {
    if (part === 'front' || part === 'Front') {
      return ['hood', 'front_glass', 'left_mirror', 'right_mirror'];
    }
    return []; // For other parts, any detection is valid
  };

  // Determine box color based on detection type
  const getBoxColor = (label: string, requiredParts: string[]): string => {
    if (detections.length === 0) {
      return 'rgba(239, 68, 68, 0.8)'; // Red - no parts
    }
    
    if (requiredParts.length > 0 && requiredParts.includes(label)) {
      return 'rgba(34, 197, 94, 0.8)'; // Green - required part
    }
    
    return 'rgba(234, 179, 8, 0.8)'; // Yellow - other detected part
  };

  // Draw bounding boxes with animation
  const drawOverlay = () => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) {
      // Draw red warning overlay when no parts detected
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      ctx.setLineDash([]);
      return;
    }

    const requiredParts = getRequiredParts(currentPart);
    const time = Date.now() * 0.001; // For animation

    // Draw each detection with animated effect
    detections.forEach((detection, index) => {
      const [x, y, width, height] = detection.box;
      const color = getBoxColor(detection.label, requiredParts);
      
      // Animated pulse effect
      const pulse = Math.sin(time * 2 + index * 0.5) * 0.1 + 1;
      const lineWidth = 3 * pulse;

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x, y, width, height);

      // Draw semi-transparent fill
      ctx.fillStyle = color.replace('0.8', '0.2');
      ctx.fillRect(x, y, width, height);

      // Draw label with confidence
      const labelText = `${detection.label} ${Math.round(detection.confidence * 100)}%`;
      const fontSize = Math.max(12, Math.min(16, width / 10));
      
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(x, y - fontSize - 4, ctx.measureText(labelText).width + 8, fontSize + 4);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 4, y - 2);
    });

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(drawOverlay);
  };

  useEffect(() => {
    if (isActive) {
      drawOverlay();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawOverlay, isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-30"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }}
    />
  );
};

export default CarPartOverlay;
