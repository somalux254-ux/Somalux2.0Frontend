/**
 * usePreciseTextSelection.js - PROFESSIONAL PRECISION SELECTION
 * WPS/Office-grade text selection with lens features
 * 
 * Features:
 * - Selection completion detection (only shows after selection done)
 * - Precise word/character boundaries
 * - Prevents text bleed from adjacent content
 * - Lens feature for visual feedback
 * - No automatic selection of nearby text
 * - Desktop + Mobile optimized
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const usePreciseTextSelection = (containerSelector = '.fast-reader-content') => {
  // Mobile detection
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  // Selection state
  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false); // Track if user is actively selecting
  const [lensData, setLensData] = useState(null); // Visual lens feedback

  // Refs for tracking
  const selectionInProgressRef = useRef(false);
  const lastCompletedSelectionRef = useRef(null);
  const selectionStartTimeRef = useRef(0);
  const selectionStableRef = useRef(false);
  const isProcessingRef = useRef(false);
  const timeoutRef = useRef(null);
  const completionTimeoutRef = useRef(null);

  // Mobile detection
  useEffect(() => {
    const detectMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (navigator.maxTouchPoints > 2);
      isMobileRef.current = mobile;
      setIsMobile(mobile);
    };

    detectMobile();
    window.addEventListener('orientationchange', detectMobile);
    return () => window.removeEventListener('orientationchange', detectMobile);
  }, []);

  /**
   * Calculate precise panel position
   */
  const calculatePosition = useCallback((rect) => {
    try {
      if (!rect || rect.width === 0 || rect.height === 0) {
        return null;
      }

      const panelHeight = isMobileRef.current ? 140 : 120;
      const panelWidth = isMobileRef.current ? 180 : 200;
      const viewportPadding = isMobileRef.current ? 10 : 15;

      // Center horizontally on selection
      let x = rect.left + rect.width / 2 - panelWidth / 2;

      // Position above selection with gap
      let y = rect.top - panelHeight - 10;

      // Fallback: position below if not enough space above
      if (y < viewportPadding) {
        y = rect.bottom + 10;
      }

      // Constrain to viewport
      const maxX = window.innerWidth - panelWidth - viewportPadding;
      const maxY = window.innerHeight - panelHeight - viewportPadding;

      x = Math.max(viewportPadding, Math.min(maxX, x));
      y = Math.max(viewportPadding, Math.min(maxY, y));

      return { x, y };
    } catch (error) {
      console.error('❌ Position calculation error:', error);
      return null;
    }
  }, []);

  /**
   * PRECISION: Validate that selection is ONLY from the target container
   * Prevents text from adjacent elements being included
   */
  const validateSelectionBoundary = useCallback((range, containerSelector) => {
    try {
      const container = document.querySelector(containerSelector);
      if (!container) {
        console.warn('⚠️ Container not found:', containerSelector);
        return false;
      }

      // Get all nodes in the range
      const commonAncestor = range.commonAncestorContainer;
      
      // Check if commonAncestor is within container
      if (commonAncestor.nodeType === Node.TEXT_NODE) {
        if (!container.contains(commonAncestor)) {
          return false;
        }
      } else if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
        if (!container.contains(commonAncestor)) {
          return false;
        }
      }

      // Validate start container
      const startContainer = range.startContainer;
      if (!container.contains(startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentElement : startContainer)) {
        return false;
      }

      // Validate end container
      const endContainer = range.endContainer;
      if (!container.contains(endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentElement : endContainer)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Boundary validation error:', error);
      return false;
    }
  }, []);

  /**
   * PRECISION: Extract exact selection boundaries (like WPS)
   */
  const getPreciseSelectionBounds = useCallback((range) => {
    try {
      const rects = range.getClientRects();
      if (!rects || rects.length === 0) return null;

      // Filter and validate rects with strict precision
      const validRects = Array.from(rects).filter(rect => 
        rect.width > 1 && rect.height > 1 && rect.top > 0
      );

      if (validRects.length === 0) return null;

      // Calculate precise bounds
      let minTop = Infinity;
      let maxBottom = -Infinity;
      let minLeft = Infinity;
      let maxRight = -Infinity;

      validRects.forEach(rect => {
        minTop = Math.min(minTop, rect.top);
        maxBottom = Math.max(maxBottom, rect.bottom);
        minLeft = Math.min(minLeft, rect.left);
        maxRight = Math.max(maxRight, rect.right);
      });

      if (minTop === Infinity) return null;

      return {
        top: minTop,
        bottom: maxBottom,
        left: minLeft,
        right: maxRight,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
        centerX: (minLeft + maxRight) / 2,
        centerY: (minTop + maxBottom) / 2,
        rectCount: validRects.length,
        rects: validRects
      };
    } catch (error) {
      console.error('❌ Bounds calculation error:', error);
      return null;
    }
  }, []);

  /**
   * LENS FEATURE: Create visual feedback of what's being selected (like WPS)
   */
  const updateLensData = useCallback((range, text) => {
    try {
      const bounds = getPreciseSelectionBounds(range);
      if (!bounds) return;

      // Extract word-level precision data
      const words = text.trim().split(/\s+/);
      const charCount = text.length;
      const wordCount = words.length;

      setLensData({
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        fullText: text,
        words: wordCount,
        chars: charCount,
        bounds: bounds,
        confidence: Math.min(100, (bounds.rectCount * 20)) // Visual confidence indicator
      });
    } catch (error) {
      console.error('❌ Lens update error:', error);
    }
  }, [getPreciseSelectionBounds]);

  /**
   * MAIN: Detect selection with COMPLETION logic
   * Only triggers AFTER selection is complete, not during
   */
  const detectSelectionCompletion = useCallback(() => {
    if (isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;
      const sel = window.getSelection();

      // No selection
      if (!sel || sel.rangeCount === 0 || sel.type === 'None') {
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        setLensData(null);
        selectionStableRef.current = false;
        return;
      }

      const text = sel.toString().trim();

      // Minimum 2 characters for valid selection
      if (text.length < 2) {
        setIsSelecting(false);
        setLensData(null);
        return;
      }

      // Get range
      const range = sel.getRangeAt(0);

      // PRECISION: Validate selection is only within container
      if (!validateSelectionBoundary(range, containerSelector)) {
        console.log('⚠️ Selection outside container - ignored');
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        return;
      }

      // Get precise bounds
      const bounds = getPreciseSelectionBounds(range);
      if (!bounds) {
        setIsSelecting(false);
        setLensData(null);
        return;
      }

      // Calculate position
      const pos = calculatePosition(bounds);
      if (!pos) {
        setIsSelecting(false);
        return;
      }

      // Update lens while selecting
      updateLensData(range, text);

      // COMPLETION: Check if selection has stabilized (not changing)
      const selectionChanged = !lastCompletedSelectionRef.current || 
        lastCompletedSelectionRef.current.text !== text;

      if (selectionChanged) {
        // Selection is new or changed - mark as in progress
        setIsSelecting(true);
        lastCompletedSelectionRef.current = { text, range, bounds };
      } else if (selectionStableRef.current) {
        // Same selection - it's complete, show panel
        setIsSelecting(false);
        setSelection({
          text,
          range,
          bounds,
          timestamp: Date.now(),
        });
        setPosition(pos);
        console.log('✅ Selection COMPLETE:', text.substring(0, 40));
      }

      selectionStableRef.current = true;
    } catch (error) {
      console.error('❌ Detection error:', error);
      setSelection(null);
      setPosition(null);
      setIsSelecting(false);
    } finally {
      isProcessingRef.current = false;
    }
  }, [validateSelectionBoundary, getPreciseSelectionBounds, calculatePosition, updateLensData, containerSelector]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelection(null);
    setPosition(null);
    setIsSelecting(false);
    setLensData(null);
    selectionStableRef.current = false;
    lastCompletedSelectionRef.current = null;
    
    try {
      window.getSelection().removeAllRanges();
    } catch (e) {
      // Ignore
    }
  }, []);

  /**
   * EVENT LISTENERS: Only trigger on COMPLETION
   */
  useEffect(() => {
    console.log('🎬 usePreciseTextSelection hook mounted');

    let completionDelay = null;

    // DESKTOP: Mouse-based selection
    const handleMouseDown = () => {
      selectionInProgressRef.current = true;
      setIsSelecting(true);
      setSelection(null); // Clear old selection immediately
    };

    const handleMouseUp = () => {
      // Selection is complete - wait a bit for stabilization then detect
      selectionInProgressRef.current = false;
      
      if (completionDelay) clearTimeout(completionDelay);
      completionDelay = setTimeout(() => {
        detectSelectionCompletion();
      }, isMobileRef.current ? 80 : 20); // Small delay for stability
    };

    // MOBILE: Touch-based selection
    const handleTouchStart = () => {
      selectionInProgressRef.current = true;
      setIsSelecting(true);
      setSelection(null);
    };

    const handleTouchEnd = () => {
      selectionInProgressRef.current = false;
      
      if (completionDelay) clearTimeout(completionDelay);
      completionDelay = setTimeout(() => {
        detectSelectionCompletion();
      }, 100); // Slightly longer delay for mobile stability
    };

    // KEYBOARD: Shift+Arrow selection
    const handleKeyUp = (e) => {
      if (e.shiftKey) {
        // Selection still happening
        setIsSelecting(true);
        
        if (completionDelay) clearTimeout(completionDelay);
        completionDelay = setTimeout(() => {
          selectionInProgressRef.current = false;
          detectSelectionCompletion();
        }, 25);
      }
    };

    // Context menu (iOS long-press)
    const handleContextMenu = (e) => {
      selectionInProgressRef.current = false;
      
      if (completionDelay) clearTimeout(completionDelay);
      completionDelay = setTimeout(() => {
        detectSelectionCompletion();
      }, 120);
    };

    // Attach listeners to document
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('touchstart', handleTouchStart, true);
    document.addEventListener('touchend', handleTouchEnd, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      console.log('🎬 usePreciseTextSelection hook unmounting');
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      
      if (completionDelay) clearTimeout(completionDelay);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    };
  }, [detectSelectionCompletion]);

  return {
    selection,
    position,
    clearSelection,
    selectedText: selection?.text || '',
    isSelecting, // Indicates if user is actively selecting
    lensData, // Visual feedback data (word count, char count, etc)
    bounds: selection?.bounds || null, // Precise selection boundaries
  };
};

export default usePreciseTextSelection;
