import { useEffect, useRef } from 'react';

interface UseSwipeBackOptions {
  onBack: () => void;
  enabled?: boolean;
  edgeThreshold?: number; // Distance in px from edge to initiate swipe (default 35px)
  minSwipeDistance?: number; // Minimum horizontal swipe distance to trigger (default 75px)
  maxVerticalDistance?: number; // Maximum vertical travel allowed to still count as horizontal swipe (default 60px)
}

/**
 * Hook to handle edge swipe gestures on mobile devices (touchscreens).
 * Supports both RTL (swipe from right edge to left/right) and LTR.
 */
export function useSwipeBack({
  onBack,
  enabled = true,
  edgeThreshold = 35,
  minSwipeDistance = 75,
  maxVerticalDistance = 60
}: UseSwipeBackOptions) {
  const touchStartRef = useRef<{ x: number; y: number; fromEdge: boolean; edgeSide: 'left' | 'right' | null } | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.touches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }
      const screenWidth = window.innerWidth;
      const x = touch.clientX;
      const y = touch.clientY;

      const isFromLeftEdge = x <= edgeThreshold;
      const isFromRightEdge = x >= screenWidth - edgeThreshold;

      if (isFromLeftEdge || isFromRightEdge) {
        touchStartRef.current = {
          x,
          y,
          fromEdge: true,
          edgeSide: isFromLeftEdge ? 'left' : 'right'
        };
      } else {
        touchStartRef.current = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || !touchStartRef.current.fromEdge) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // Verify that movement was predominantly horizontal and not a vertical scroll
      if (deltaY <= maxVerticalDistance) {
        // In Arabic (RTL), edge swipe often starts from right edge towards left (deltaX < -minSwipeDistance)
        // or from left edge towards right in LTR (deltaX > minSwipeDistance)
        if (
          (touchStartRef.current.edgeSide === 'right' && deltaX <= -minSwipeDistance) ||
          (touchStartRef.current.edgeSide === 'left' && deltaX >= minSwipeDistance)
        ) {
          onBack();
        }
      }

      touchStartRef.current = null;
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, onBack, edgeThreshold, minSwipeDistance, maxVerticalDistance]);
}
