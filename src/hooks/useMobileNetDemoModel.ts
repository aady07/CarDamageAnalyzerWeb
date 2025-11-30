import { useEffect, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import '@tensorflow/tfjs';

export interface MobileNetDemoState {
  loading: boolean;
  error: string | null;
  lastLabel: string | null;
  lastProbability: number | null;
  detectedCount: number;
}

/**
 * Lightweight hook that:
 * - Loads a pre-trained MobileNet model in the browser (on-device)
 * - Periodically runs inference on a <video> element (e.g. react-webcam)
 * - Increments a "detectedCount" to drive stencil red→green transitions
 *
 * NOTE: This is for demo only. It does NOT detect car parts.
 * It proves that a CNN model can run locally and drive UI state.
 */
export function useMobileNetDemoModel(videoElement: HTMLVideoElement | null, totalParts: number) {
  const [state, setState] = useState<MobileNetDemoState>({
    loading: true,
    error: null,
    lastLabel: null,
    lastProbability: null,
    detectedCount: 0
  });

  const modelRef = useRef<mobilenet.MobileNet | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadModel = async () => {
      try {
        const model = await mobilenet.load({
          version: 2,
          alpha: 0.5 // lighter, faster variant
        });
        if (cancelled) return;
        modelRef.current = model;
        setState((prev) => ({ ...prev, loading: false, error: null }));
      } catch (err: any) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Failed to load MobileNet model'
        }));
      }
    };

    loadModel();

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!videoElement || !modelRef.current || state.loading || state.error) {
      return;
    }

    // Run inference every 1.5s to simulate "detection" cycles.
    intervalRef.current = window.setInterval(async () => {
      const model = modelRef.current;
      if (!model || videoElement.readyState < 2) {
        return;
      }

      try {
        const predictions = await model.classify(videoElement);
        if (!predictions || predictions.length === 0) return;

        const top = predictions[0];
        setState((prev) => {
          // Increment detectedCount until we reach totalParts.
          const nextCount =
            prev.detectedCount < totalParts ? prev.detectedCount + 1 : prev.detectedCount;
          return {
            ...prev,
            lastLabel: top.className,
            lastProbability: top.probability,
            detectedCount: nextCount
          };
        });
      } catch {
        // Keep silent for demo; we don't want to spam errors.
      }
    }, 1500);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoElement, state.loading, state.error, totalParts]);

  return state;
}










