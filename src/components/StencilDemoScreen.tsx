import React, { useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain } from 'lucide-react';
import { useMobileNetDemoModel } from '../hooks/useMobileNetDemoModel';

interface StencilDemoScreenProps {
  onBack: () => void;
}

type PartId =
  | 'front_view'
  | 'rear_view'
  | 'left_side'
  | 'right_side'
  | 'left_front_fender'
  | 'right_front_fender'
  | 'left_rear_fender'
  | 'right_rear_fender'
  | 'left_orvm'
  | 'right_orvm';

interface PartConfig {
  id: PartId;
  label: string;
  description: string;
  // position as percentage of video container
  x: number;
  y: number;
}

const StencilDemoScreen: React.FC<StencilDemoScreenProps> = ({ onBack }) => {
  const parts = useMemo<PartConfig[]>(
    () => [
      {
        id: 'front_view',
        label: 'Front View',
        description: 'Front bumper + hood',
        x: 50,
        y: 70
      },
      {
        id: 'rear_view',
        label: 'Rear View',
        description: 'Rear bumper + tailgate',
        x: 50,
        y: 30
      },
      {
        id: 'left_side',
        label: 'Left Side',
        description: 'Left doors',
        x: 25,
        y: 50
      },
      {
        id: 'right_side',
        label: 'Right Side',
        description: 'Right doors',
        x: 75,
        y: 50
      },
      {
        id: 'left_front_fender',
        label: 'Left Front Fender',
        description: 'Front‑left fender',
        x: 30,
        y: 65
      },
      {
        id: 'right_front_fender',
        label: 'Right Front Fender',
        description: 'Front‑right fender',
        x: 70,
        y: 65
      },
      {
        id: 'left_rear_fender',
        label: 'Left Rear Fender',
        description: 'Rear‑left fender',
        x: 30,
        y: 35
      },
      {
        id: 'right_rear_fender',
        label: 'Right Rear Fender',
        description: 'Rear‑right fender',
        x: 70,
        y: 35
      },
      {
        id: 'left_orvm',
        label: 'Left ORVM',
        description: 'Left mirror',
        x: 35,
        y: 55
      },
      {
        id: 'right_orvm',
        label: 'Right ORVM',
        description: 'Right mirror',
        x: 65,
        y: 55
      }
    ],
    [],
  );

  const webcamRef = useRef<Webcam | null>(null);
  const videoElement = webcamRef.current?.video ?? null;
  const mobileNetState = useMobileNetDemoModel(videoElement, parts.length);

  const isDetected = (id: PartId) => {
    const index = parts.findIndex((p) => p.id === id);
    if (index === -1) return false;
    return index < mobileNetState.detectedCount;
  };

  // Only one active stencil on the camera at a time:
  //  - index < detectedCount  → already completed (front done, move on)
  //  - index === detectedCount → current target stencil (red → green)
  const activeIndex = Math.min(mobileNetState.detectedCount, parts.length - 1);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-5 left-5 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all duration-200 z-50"
      >
        <ArrowLeft className="w-7 h-7" />
      </motion.button>

      {/* Title / description */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/20"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Brain className="w-6 h-6 text-blue-300" />
            <h2 className="text-xl font-bold text-white">On‑Device Stencil Demo</h2>
          </div>
          <p className="text-xs md:text-sm text-white/80 max-w-xl">
            This screen runs a real MobileNet model locally in your browser and uses its inference cycles
            to turn 10 car‑part stencils from red to green — no internet, no backend.
          </p>
          {!mobileNetState.loading && mobileNetState.lastLabel && (
            <p className="mt-1 text-[11px] md:text-xs text-blue-200">
              Model prediction: <span className="font-semibold">{mobileNetState.lastLabel}</span>{' '}
              ({Math.round((mobileNetState.lastProbability ?? 0) * 100)}% confidence)
            </p>
          )}
          {mobileNetState.loading && (
            <p className="mt-1 text-[11px] md:text-xs text-blue-200">Loading MobileNet model…</p>
          )}
          {mobileNetState.error && (
            <p className="mt-1 text-[11px] md:text-xs text-red-300">
              Model error: {mobileNetState.error}
            </p>
          )}
        </motion.div>
      </div>

      {/* Camera feed */}
      <div className="absolute inset-0">
        <Webcam
          ref={webcamRef}
          audio={false}
          className="w-full h-full object-cover"
          videoConstraints={{
            facingMode: 'environment'
          }}
        />

        {/* Stencil overlay – only the current target part on camera */}
        <div className="absolute inset-0">
          {parts.map((part, index) => {
            if (index !== activeIndex) return null;
            const detected = isDetected(part.id);
            return (
              <motion.div
                key={part.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute"
                style={{
                  left: `${part.x}%`,
                  top: `${part.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-4 shadow-2xl flex items-center justify-center text-xs md:text-sm font-bold ${
                      detected
                        ? 'bg-green-500/25 border-green-400 text-green-100 shadow-green-500/50'
                        : 'bg-red-500/20 border-red-400 text-red-100 shadow-red-500/50'
                    }`}
                  >
                    {detected ? 'DETECTED' : 'ALIGN HERE'}
                  </div>
                  <span className="mt-1 text-[11px] md:text-sm text-white drop-shadow-sm text-center font-semibold">
                    {part.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend / progress list (bottom sheet) */}
      <div className="absolute bottom-0 left-0 right-0 z-40">
        <div className="bg-black/70 backdrop-blur-xl border-t border-white/10 px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm md:text-base font-semibold text-white">
              Local stencil status ({mobileNetState.detectedCount}/{parts.length} detected)
            </span>
            <span className="text-[10px] md:text-xs text-white/60">
              No API calls • Runs entirely on this device
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 max-h-32 md:max-h-40 overflow-y-auto">
            {parts.map((part) => {
              const detected = isDetected(part.id);
              return (
                <div
                  key={part.id}
                  className={`rounded-lg border px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm ${
                    detected
                      ? 'border-green-400/60 bg-green-500/10 text-green-100'
                      : 'border-red-400/60 bg-red-500/5 text-red-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-semibold truncate">{part.label}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        detected ? 'bg-green-400' : 'bg-red-400'
                      }`}
                    />
                  </div>
                  <p className="text-[10px] md:text-[11px] text-white/70 line-clamp-2">
                    {part.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StencilDemoScreen;


