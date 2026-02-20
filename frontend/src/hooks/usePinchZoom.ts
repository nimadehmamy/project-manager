import { useRef, useCallback, useEffect } from 'react';

interface PinchZoomOptions {
  min?: number;
  max?: number;
  onZoom: (scale: number) => void;
  getScale: () => number;
}

/**
 * Adds pinch-to-zoom (trackpad/touch) and Ctrl+scroll wheel zoom
 * to the element referenced by the returned ref callback.
 */
export function usePinchZoom<T extends HTMLElement>({ min = 0.3, max = 5, onZoom, getScale }: PinchZoomOptions) {
  const elRef = useRef<T | null>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    // Pinch gesture on trackpad or Ctrl+scroll wheel
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    const current = getScale();
    const next = Math.min(max, Math.max(min, current + delta));
    if (next !== current) onZoom(next);
  }, [min, max, onZoom, getScale]);

  const setRef = useCallback((el: T | null) => {
    // Cleanup old
    if (elRef.current) {
      elRef.current.removeEventListener('wheel', handleWheel as EventListener);
    }
    elRef.current = el;
    if (el) {
      // passive: false is required so we can preventDefault on wheel
      el.addEventListener('wheel', handleWheel as EventListener, { passive: false });
    }
  }, [handleWheel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elRef.current) {
        elRef.current.removeEventListener('wheel', handleWheel as EventListener);
      }
    };
  }, [handleWheel]);

  return setRef;
}
