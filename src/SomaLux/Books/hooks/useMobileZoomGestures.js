/**
 * Mobile Zoom Gestures Hook
 * Handles pinch-zoom, double-tap, and touch controls for mobile devices
 * Ensures zoom works perfectly on phones like desktop
 * 
 * Features:
 * - Pinch-to-zoom gesture detection
 * - Double-tap to zoom in/out toggle
 * - Smooth zoom animations
 * - Touch-friendly feedback
 * - Prevents default browser zoom
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const useMobileZoomGestures = (containerRef, onZoomIn, onZoomOut, onResetZoom, onSetZoom, currentScale) => {
  const touchStartScaleRef = useRef(null);
  const lastTapTimeRef = useRef(0);
  const lastTapXRef = useRef(0);
  const lastTapYRef = useRef(0);
  const doubleTapTimerRef = useRef(null);
  const isZoomingRef = useRef(false);
  const lastProcessedScaleRef = useRef(currentScale);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Detect if device is mobile based on window size (responsive design)
  const checkMobileDevice = useCallback(() => {
    return window.innerWidth <= 768;
  }, []);

  // Handle pinch-zoom gesture
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Two fingers detected - start pinch zoom
      isZoomingRef.current = true;
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      // Calculate distance between two fingers
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      
      console.log('👆 Pinch start: distance=', distance.toFixed(2), 'currentScale=', currentScale.toFixed(2));
      
      touchStartScaleRef.current = {
        distance,
        startScale: currentScale,
        timestamp: Date.now()
      };
    } else if (e.touches.length === 1) {
      // Single touch - check for double tap
      const now = Date.now();
      const touch = e.touches[0];
      const timeDiff = now - lastTapTimeRef.current;
      const distanceDiff = Math.hypot(
        touch.clientX - lastTapXRef.current,
        touch.clientY - lastTapYRef.current
      );

      lastTapXRef.current = touch.clientX;
      lastTapYRef.current = touch.clientY;

      // Double tap detection (within 300ms and 30px)
      if (timeDiff < 300 && distanceDiff < 30) {
        // Clear any pending timer
        clearTimeout(doubleTapTimerRef.current);
        
        // Double tap detected - toggle zoom
        if (currentScale > 1.2) {
          onResetZoom(); // Reset if zoomed in
        } else {
          onZoomIn(); // Zoom in if at normal scale
        }
      }

      lastTapTimeRef.current = now;
    }
  }, [currentScale, onZoomIn, onZoomOut, onResetZoom]);

  // Handle pinch-zoom movement - Smooth continuous scaling
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchStartScaleRef.current && isZoomingRef.current) {
      e.preventDefault();
      e.stopPropagation();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      // Calculate current distance between fingers
      const currentDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      const { distance: startDistance, startScale } = touchStartScaleRef.current;

      // Prevent division by zero
      if (startDistance === 0) return;

      // Calculate zoom factor (pinch ratio) for smooth continuous scaling
      const zoomFactor = currentDistance / startDistance;
      const targetScale = Math.max(0.25, Math.min(5.0, startScale * zoomFactor));

      console.log('🔍 Pinch zoom: factor=', zoomFactor.toFixed(2), 'target=', targetScale.toFixed(2), 'current=', currentScale.toFixed(2));

      // Apply smooth zoom directly without incremental steps
      if (onSetZoom) {
        onSetZoom(targetScale);
      }
      lastProcessedScaleRef.current = targetScale;
    }
  }, [onSetZoom]);

  // Handle pinch-zoom end
  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      touchStartScaleRef.current = null;
      isZoomingRef.current = false;
      lastProcessedScaleRef.current = currentScale;
    }
  }, [currentScale]);

  // Setup touch event listeners
  useEffect(() => {
    // Check mobile device on mount
    setIsMobileDevice(checkMobileDevice());

    // Handle window resize
    const handleResize = () => {
      setIsMobileDevice(checkMobileDevice());
    };

    window.addEventListener('resize', handleResize);

    if (!checkMobileDevice() || !containerRef?.current) {
      return () => window.removeEventListener('resize', handleResize);
    }

    const container = containerRef.current;

    // Prevent default browser zoom on iOS
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Prevent pinch-zoom at the document level
    const preventPinchZoom = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventPinchZoom, { passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchmove', preventPinchZoom);
      clearTimeout(doubleTapTimerRef.current);
    };
  }, [checkMobileDevice, containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isMobileDevice,
    isZooming: isZoomingRef.current
  };
};

export default useMobileZoomGestures;
