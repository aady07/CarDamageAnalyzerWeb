/**
 * Real-time Bounding Box Overlay Component
 * Draws bounding boxes around detected car parts with color coding
 */

import React, { useEffect, useRef } from 'react';
import { Detection } from '../services/tfliteDetection';

interface BoundingBoxOverlayProps {
  detections: Detection[];
  currentPart: string;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

// Map current part to required part labels
const getRequiredPartsForCurrentPart = (currentPart: string): string[] => {
  if (currentPart === "Front" || currentPart === "front") {
    return ["hood", "front_glass", "left_mirror", "right_mirror"];
  }
  // For other parts, we just need at least one part detected
  return [];
};

export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
  detections,
  currentPart,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Calculate scale factors
    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) {
      // No detections - draw warning indicator
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // Red
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.setLineDash([]);
      
      // Draw warning text
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No parts detected', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Get required parts for current section
    const requiredParts = getRequiredPartsForCurrentPart(currentPart);

    // Draw each detection
    detections.forEach((detection, index) => {
      const { label, confidence, box } = detection;
      const [x, y, width, height] = box;

      // Scale coordinates to canvas size
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Determine color based on whether it's a required part
      let color: string;
      if (requiredParts.length > 0 && requiredParts.includes(label)) {
        color = 'rgba(34, 197, 94, 0.8)'; // Green for required parts
      } else {
        color = 'rgba(234, 179, 8, 0.8)'; // Yellow for other detected parts
      }

      // Draw bounding box with animation effect
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw label background
      const labelText = `${label} ${Math.round(confidence * 100)}%`;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 20;

      // Label background
      ctx.fillStyle = color;
      ctx.fillRect(scaledX, scaledY - textHeight - 2, textWidth + 8, textHeight);

      // Label text
      ctx.fillStyle = 'white';
      ctx.fillText(labelText, scaledX + 4, scaledY - 6);

      // Draw corner indicators for "AI working" effect
      const cornerSize = 15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(scaledX, scaledY);
      ctx.lineTo(scaledX + cornerSize, scaledY);
      ctx.moveTo(scaledX, scaledY);
      ctx.lineTo(scaledX, scaledY + cornerSize);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(scaledX + scaledWidth, scaledY);
      ctx.lineTo(scaledX + scaledWidth - cornerSize, scaledY);
      ctx.moveTo(scaledX + scaledWidth, scaledY);
      ctx.lineTo(scaledX + scaledWidth, scaledY + cornerSize);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(scaledX, scaledY + scaledHeight);
      ctx.lineTo(scaledX + cornerSize, scaledY + scaledHeight);
      ctx.moveTo(scaledX, scaledY + scaledHeight);
      ctx.lineTo(scaledX, scaledY + scaledHeight - cornerSize);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(scaledX + scaledWidth, scaledY + scaledHeight);
      ctx.lineTo(scaledX + scaledWidth - cornerSize, scaledY + scaledHeight);
      ctx.moveTo(scaledX + scaledWidth, scaledY + scaledHeight);
      ctx.lineTo(scaledX + scaledWidth, scaledY + scaledHeight - cornerSize);
      ctx.stroke();
    });

    // Draw detection count indicator (top-right)
    if (detections.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(canvas.width - 120, 10, 110, 30);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${detections.length} parts detected`, canvas.width - 15, 30);
    }
  }, [detections, currentPart, videoWidth, videoHeight, containerWidth, containerHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 20
      }}
    />
  );
};
