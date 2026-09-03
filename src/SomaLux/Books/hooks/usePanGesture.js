/**
 * Pan Gesture Hook
 * Handles dragging/swiping to pan zoomed content
 * Allows horizontal panning when content is zoomed beyond viewport
 */

import { useEffect, useRef, useCallback } from 'react';

const usePanGesture = (containerRef, isZoomed) => {
  const touchStartXRef = useRef(null);
  const initialScrollLeftRef = useRef(null);
  const isPanningRef = useRef(false);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const momentumFrameRef = useRef(null);
  const panFrameRef = useRef(null);

  const applyMomentum = useCallback((container, initialVelocity) => {
    let velocity = initialVelocity;
    const friction = 0.90;
    const maxScroll = container.scrollWidth - container.clientWidth;

    const animate = () => {
      if (Math.abs(velocity) < 0.3) {
        return;
      }

      const newScrollLeft = Math.max(
        0,
        Math.min(container.scrollLeft + velocity, maxScroll)
      );

      container.scrollLeft = newScrollLeft;
      velocity *= friction;
      momentumFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (!isZoomed || e.touches.length !== 1) return;

    if (momentumFrameRef.current) {
      cancelAnimationFrame(momentumFrameRef.current);
    }

    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    lastXRef.current = touch.clientX;
    lastTimeRef.current = Date.now();
    initialScrollLeftRef.current = containerRef.current?.scrollLeft || 0;
    velocityRef.current = 0;
    isPanningRef.current = true;
  }, [isZoomed, containerRef]);

  const handleTouchMove = useCallback((e) => {
    if (!isPanningRef.current || !containerRef.current || !isZoomed) return;

    const touch = e.touches[0];
    const currentX = touch.clientX;
    const currentTime = Date.now();
    const timeDelta = Math.max(currentTime - lastTimeRef.current, 1);

    // Calculate velocity
    const pixelsDelta = lastXRef.current - currentX;
    velocityRef.current = pixelsDelta > 0 ? (pixelsDelta / timeDelta) * 0.3 : (pixelsDelta / timeDelta) * 0.3;

    const deltaX = touchStartXRef.current - currentX;
    
    // Update scroll directly without batching
    if (containerRef.current) {
      const container = containerRef.current;
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      const newScrollLeft = Math.max(
        0,
        Math.min(
          initialScrollLeftRef.current + deltaX,
          maxScroll
        )
      );

      container.scrollLeft = newScrollLeft;
    }

    lastXRef.current = currentX;
    lastTimeRef.current = currentTime;
  }, [isZoomed, containerRef]);

  const handleTouchEnd = useCallback(() => {
    if (!isPanningRef.current) return;

    isPanningRef.current = false;
    touchStartXRef.current = null;
    initialScrollLeftRef.current = null;

    // Apply momentum with scaled velocity
    if (Math.abs(velocityRef.current) > 0.3 && containerRef.current) {
      applyMomentum(containerRef.current, velocityRef.current * 4);
    }

    velocityRef.current = 0;
  }, [applyMomentum, containerRef]);

  useEffect(() => {
    if (!containerRef?.current) return;

    const container = containerRef.current;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      if (momentumFrameRef.current) {
        cancelAnimationFrame(momentumFrameRef.current);
      }
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
};

export default usePanGesture;
