/**
 * Mobile Zoom Controls Component
 * Touch-friendly zoom controls for mobile devices
 * Displays zoom buttons, zoom level indicator, and reset button
 * Only visible on mobile devices (screen width ≤ 768px)
 * 
 * Features:
 * - Large touch-friendly buttons
 * - Zoom level percentage display
 * - Auto-hide after 3 seconds of inactivity
 * - Smooth animations
 * - Haptic feedback on iOS/Android
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiZoomIn, FiZoomOut, FiX } from 'react-icons/fi';
import './MobileZoomLayout.css';

const MobileZoomControls = ({ 
  scale = 1.0, 
  onZoomIn, 
  onZoomOut, 
  onResetZoom,
  minZoom = 0.5,
  maxZoom = 3.0,
  isMobile = false
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const hideTimerRef = useRef(null);
  const activityTimerRef = useRef(null);

  // Check if device is mobile
  const checkMobile = useCallback(() => {
    return window.innerWidth <= 768;
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, []);

  // Reset hide timer - DEFINE FIRST before handlers use it
  const resetHideTimer = useCallback(() => {
    // Clear existing timers
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);

    // Show controls
    setIsVisible(true);
    setIsExpanded(true);

    // Auto-hide after 15 seconds of inactivity (much longer for better UX)
    hideTimerRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 15000);
  }, []);

  // Handle zoom in
  const handleZoomIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic();
    onZoomIn?.();
    resetHideTimer();
  }, [onZoomIn, triggerHaptic, resetHideTimer]);

  // Handle zoom out
  const handleZoomOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic();
    onZoomOut?.();
    resetHideTimer();
  }, [onZoomOut, triggerHaptic, resetHideTimer]);

  // Handle reset zoom
  const handleResetZoom = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic();
    onResetZoom?.();
    resetHideTimer();
  }, [onResetZoom, triggerHaptic, resetHideTimer]);

  // Handle close button
  const handleClose = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic();
    setIsVisible(false);
  }, [triggerHaptic]);

  // Handle toggle expand
  const handleToggleExpand = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic();
    setIsExpanded(prev => !prev);
    resetHideTimer();
  }, [triggerHaptic, resetHideTimer]);

  // Handle screen resize
  const handleResize = useCallback(() => {
    if (!checkMobile()) {
      setIsVisible(false);
    }
  }, [checkMobile]);

  // Initialize and cleanup
  useEffect(() => {
    // Check if mobile on mount
    if (!checkMobile()) {
      setIsVisible(false);
      return;
    }

    window.addEventListener('resize', handleResize);
    
    // Reset hide timer on mount
    resetHideTimer();

    // Keep controls visible on any user interaction
    const handleUserActivity = () => {
      resetHideTimer();
    };

    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('touchmove', handleUserActivity);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('touchmove', handleUserActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, [checkMobile, handleResize, resetHideTimer]);

  // Calculate zoom percentage
  const zoomPercentage = Math.round(scale * 100);
  const isZoomedIn = scale > 1.05;
  const isZoomedOut = scale < 0.95;
  const canZoomIn = scale < maxZoom;
  const canZoomOut = scale > minZoom;

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`mobile-zoom-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {isExpanded && (
        <>
          {/* Zoom Out Button */}
          <button
            className={`mobile-zoom-btn zoom-out-btn ${!canZoomOut ? 'disabled' : ''}`}
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            title="Zoom Out (Ctrl + -)"
            aria-label="Zoom out"
          >
            <FiZoomOut size={20} />
          </button>

          {/* Zoom Level Display */}
          <div className="mobile-zoom-level">
            <span className="zoom-percentage">{zoomPercentage}%</span>
            {zoomPercentage !== 100 && (
              <button
                className="mobile-zoom-reset"
                onClick={handleResetZoom}
                title="Reset Zoom (Ctrl + 0)"
                aria-label="Reset zoom to 100%"
              >
                Reset
              </button>
            )}
          </div>

          {/* Zoom In Button */}
          <button
            className={`mobile-zoom-btn zoom-in-btn ${!canZoomIn ? 'disabled' : ''}`}
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            title="Zoom In (Ctrl + +)"
            aria-label="Zoom in"
          >
            <FiZoomIn size={20} />
          </button>

          {/* Close Button */}
          <button
            className="mobile-zoom-close"
            onClick={handleClose}
            title="Close zoom controls"
            aria-label="Close controls"
          >
            <FiX size={16} />
          </button>
        </>
      )}

      {/* Collapsed indicator */}
      {!isExpanded && (
        <button
          className="mobile-zoom-indicator"
          onClick={handleToggleExpand}
          title="Show zoom controls"
          aria-label="Show zoom controls"
        >
          <span className="zoom-badge">{zoomPercentage}%</span>
        </button>
      )}
    </div>
  );
};

export default MobileZoomControls;
