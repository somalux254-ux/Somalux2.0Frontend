/**
 * useWPSPrecisionSelectionEnhanced.js - IMPROVED FOR PDF TEXT LAYERS
 * Handles gaps in PDF rendering with intelligent rect merging
 * 
 * Improvements:
 * - Better handling of PDF character rects
 * - Intelligent gap detection and filling
 * - Smoother selection across text boundaries
 * - No gaps in multi-line selections
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useWPSPrecisionSelectionEnhanced = (containerSelector = '.simple-scroll-reader') => {
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [lensData, setLensData] = useState(null);

  const selectionInProgressRef = useRef(false);
  const lastCompletedSelectionRef = useRef(null);
  const selectionStableRef = useRef(false);
  const isProcessingRef = useRef(false);
  const containerRef = useRef(null);

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

  useEffect(() => {
    containerRef.current = document.querySelector(containerSelector);
  }, [containerSelector]);

  /**
   * ENHANCED: Merge adjacent rects to eliminate gaps
   * Critical for PDF text layers where characters are individual rects
   */
  const mergeAdjacentRects = useCallback((rects) => {
    if (!rects || rects.length < 2) return rects;

    const merged = [];
    const sortedRects = Array.from(rects).sort((a, b) => {
      // Sort by top, then by left
      if (Math.abs(a.top - b.top) < 2) return a.left - b.left;
      return a.top - b.top;
    });

    let currentGroup = [sortedRects[0]];

    for (let i = 1; i < sortedRects.length; i++) {
      const current = sortedRects[i];
      const last = currentGroup[currentGroup.length - 1];

      // Check if on same line (within 2px vertical tolerance)
      const sameLineVertically = Math.abs(current.top - last.top) < 2 && 
                                  Math.abs(current.bottom - last.bottom) < 2;

      // Check if horizontally adjacent or very close (within 8px gap - allows for kerning)
      const horizontallyAdjacent = current.left <= last.right + 8;

      if (sameLineVertically && horizontallyAdjacent) {
        // Same line and close horizontally - add to group
        currentGroup.push(current);
      } else {
        // Different line or far apart - finalize current group and start new one
        merged.push(mergeRectGroup(currentGroup));
        currentGroup = [current];
      }
    }

    // Finalize last group
    if (currentGroup.length > 0) {
      merged.push(mergeRectGroup(currentGroup));
    }

    return merged;
  }, []);

  /**
   * Merge a group of rects into a single encompassing rect
   */
  const mergeRectGroup = useCallback((rects) => {
    if (rects.length === 0) return null;
    if (rects.length === 1) return rects[0];

    let minTop = Infinity;
    let maxBottom = -Infinity;
    let minLeft = Infinity;
    let maxRight = -Infinity;

    rects.forEach(rect => {
      minTop = Math.min(minTop, rect.top);
      maxBottom = Math.max(maxBottom, rect.bottom);
      minLeft = Math.min(minLeft, rect.left);
      maxRight = Math.max(maxRight, rect.right);
    });

    return {
      top: minTop,
      bottom: maxBottom,
      left: minLeft,
      right: maxRight,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
      toJSON: () => ({ top: minTop, bottom: maxBottom, left: minLeft, right: maxRight })
    };
  }, []);

  /**
   * ENHANCED: Flexible rect validation for PDF text layers
   */
  const validateRectBoundariesEnhanced = useCallback((rects) => {
    if (!rects || rects.length === 0) return null;

    // For PDF: Accept smaller rects (characters can be 1px wide in some fonts)
    // But still filter obvious artifacts
    const validRects = Array.from(rects).filter(rect => {
      // Accept width > 0.5px (loosened from 2px for PDF characters)
      if (rect.width < 0.5 || rect.height < 0.5) return false;
      
      // Must be visible (not off-screen top)
      if (rect.top < -100 && rect.bottom < -100) return false;
      
      // Must have reasonable values
      if (!isFinite(rect.top) || !isFinite(rect.left)) return false;
      
      return true;
    });

    if (validRects.length === 0) return null;

    // Merge adjacent rects to fill gaps
    const mergedRects = mergeAdjacentRects(validRects);
    
    if (mergedRects.length === 0) return null;

    // Calculate final bounds from merged rects
    let minTop = Infinity;
    let maxBottom = -Infinity;
    let minLeft = Infinity;
    let maxRight = -Infinity;

    mergedRects.forEach(rect => {
      minTop = Math.min(minTop, rect.top);
      maxBottom = Math.max(maxBottom, rect.bottom);
      minLeft = Math.min(minLeft, rect.left);
      maxRight = Math.max(maxRight, rect.right);
    });

    if (!isFinite(minTop)) return null;

    return {
      top: minTop,
      bottom: maxBottom,
      left: minLeft,
      right: maxRight,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
      centerX: (minLeft + maxRight) / 2,
      centerY: (minTop + maxBottom) / 2,
      rectCount: mergedRects.length,
      rects: mergedRects,
      originalRectCount: validRects.length
    };
  }, [mergeAdjacentRects]);

  /**
   * LAYER 1: Text Node Validation
   */
  const validateTextNodes = useCallback((range) => {
    try {
      const container = containerRef.current;
      if (!container) return false;

      const commonAncestor = range.commonAncestorContainer;
      const ancestorElement = commonAncestor.nodeType === Node.TEXT_NODE 
        ? commonAncestor.parentElement 
        : commonAncestor;
      
      if (!container.contains(ancestorElement)) return false;

      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        if (!container.contains(startContainer.parentElement)) return false;
      } else if (!container.contains(startContainer)) {
        return false;
      }

      const endContainer = range.endContainer;
      if (endContainer.nodeType === Node.TEXT_NODE) {
        if (!container.contains(endContainer.parentElement)) return false;
      } else if (!container.contains(endContainer)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Text node validation error:', error);
      return false;
    }
  }, []);

  /**
   * LAYER 3: Spillage Detection (simplified for PDF)
   */
  const validateNoTextSpillage = useCallback((range, selectedText) => {
    try {
      // For PDF text layers, spillage is harder to detect
      // Just ensure we have actual content
      if (!selectedText || selectedText.trim().length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Spillage validation error:', error);
      return false;
    }
  }, []);

  /**
   * LAYER 4: Container Boundaries
   */
  const validateContainerBoundaries = useCallback((bounds) => {
    try {
      const container = containerRef.current;
      if (!container) return false;

      const containerRect = container.getBoundingClientRect();
      const tolerance = 5; // Increased tolerance for rendering

      if (bounds.left < (containerRect.left - tolerance)) return false;
      if (bounds.right > (containerRect.right + tolerance)) return false;
      if (bounds.top < (containerRect.top - tolerance)) return false;
      if (bounds.bottom > (containerRect.bottom + tolerance)) return false;

      return true;
    } catch (error) {
      console.error('❌ Container boundary validation error:', error);
      return false;
    }
  }, []);

  /**
   * LAYER 5: Text Integrity
   */
  const validateTextIntegrity = useCallback((range, selectedText) => {
    try {
      const rangeText = range.toString().trim();
      const cleanSelectedText = selectedText.trim();

      // For PDF: text matching might be loose due to encoding
      // Just check length is reasonable
      if (cleanSelectedText.length < 1) return false;
      if (cleanSelectedText.length > 10000) return false;

      // No obvious control characters
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(cleanSelectedText)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Text integrity validation error:', error);
      return false;
    }
  }, []);

  /**
   * Calculate panel position
   */
  const calculatePosition = useCallback((bounds) => {
    try {
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        return null;
      }

      const panelHeight = isMobileRef.current ? 140 : 120;
      const panelWidth = isMobileRef.current ? 180 : 200;
      const viewportPadding = isMobileRef.current ? 10 : 15;

      let x = bounds.left + bounds.width / 2 - panelWidth / 2;
      let y = bounds.top - panelHeight - 10;

      if (y < viewportPadding) {
        y = bounds.bottom + 10;
      }

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
   * Update lens data
   */
  const updateLensData = useCallback((range, text, bounds) => {
    try {
      const words = text.trim().split(/\s+/).filter(w => w.length > 0);
      const charCount = text.length;
      const wordCount = words.length;

      setLensData({
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        fullText: text,
        words: wordCount,
        chars: charCount,
        bounds: bounds,
        confidence: Math.min(100, Math.round((bounds.rectCount / 3) * 100))
      });
    } catch (error) {
      console.error('❌ Lens update error:', error);
    }
  }, []);

  /**
   * ENHANCED DETECTION: Multi-layer validation
   */
  const detectPreciseSelection = useCallback(() => {
    if (isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;
      const sel = window.getSelection();

      if (!sel || sel.rangeCount === 0 || sel.type === 'None') {
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        setLensData(null);
        selectionStableRef.current = false;
        return;
      }

      const text = sel.toString().trim();

      if (text.length < 1) { // Loosened from 2 to 1 for better sensitivity
        setIsSelecting(false);
        setLensData(null);
        return;
      }

      const range = sel.getRangeAt(0);

      // LAYER 1: Text nodes
      if (!validateTextNodes(range)) {
        console.log('❌ PRECISION: Failed text node validation');
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        return;
      }

      // LAYER 2: Rect boundaries (ENHANCED for PDF)
      const rects = range.getClientRects();
      const bounds = validateRectBoundariesEnhanced(rects);
      if (!bounds) {
        console.log('❌ PRECISION: Failed rect boundary validation');
        setIsSelecting(false);
        setLensData(null);
        return;
      }

      // LAYER 3: Spillage (simplified)
      if (!validateNoTextSpillage(range, text)) {
        console.log('❌ PRECISION: Failed spillage validation');
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        return;
      }

      // LAYER 4: Container bounds
      if (!validateContainerBoundaries(bounds)) {
        console.log('❌ PRECISION: Failed container boundary validation');
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        return;
      }

      // LAYER 5: Text integrity
      if (!validateTextIntegrity(range, text)) {
        console.log('❌ PRECISION: Failed text integrity validation');
        setSelection(null);
        setPosition(null);
        setIsSelecting(false);
        return;
      }

      // Calculate position
      const pos = calculatePosition(bounds);
      if (!pos) {
        setIsSelecting(false);
        return;
      }

      // Update lens
      updateLensData(range, text, bounds);

      // Completion detection
      const selectionChanged = !lastCompletedSelectionRef.current || 
        lastCompletedSelectionRef.current.text !== text;

      if (selectionChanged) {
        setIsSelecting(true);
        lastCompletedSelectionRef.current = { text, range, bounds };
        selectionStableRef.current = false;
      } else if (selectionStableRef.current) {
        setIsSelecting(false);
        setSelection({
          text,
          range,
          bounds,
          timestamp: Date.now()
        });
        setPosition(pos);
      } else {
        selectionStableRef.current = true;
        setIsSelecting(true);
      }
    } catch (error) {
      console.error('❌ Selection detection error:', error);
      setSelection(null);
      setPosition(null);
      setIsSelecting(false);
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    validateTextNodes,
    validateRectBoundariesEnhanced,
    validateNoTextSpillage,
    validateContainerBoundaries,
    validateTextIntegrity,
    calculatePosition,
    updateLensData
  ]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelection(null);
    setPosition(null);
    setIsSelecting(false);
    setLensData(null);
    lastCompletedSelectionRef.current = null;
    selectionStableRef.current = false;
    window.getSelection().removeAllRanges();
  }, []);

  // Event listeners
  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    let completionTimeout = null;

    const handleMouseDown = () => {
      selectionInProgressRef.current = true;
      setIsSelecting(true);
    };

    const handleMouseUp = () => {
      selectionInProgressRef.current = false;
      if (completionTimeout) clearTimeout(completionTimeout);
      completionTimeout = setTimeout(() => {
        detectPreciseSelection();
      }, isMobileRef.current ? 80 : 20);
    };

    const handleTouchStart = () => {
      selectionInProgressRef.current = true;
      setIsSelecting(true);
    };

    const handleTouchEnd = () => {
      selectionInProgressRef.current = false;
      if (completionTimeout) clearTimeout(completionTimeout);
      completionTimeout = setTimeout(() => {
        detectPreciseSelection();
      }, 100);
    };

    const handleKeyUp = (e) => {
      if (e.shiftKey) {
        if (completionTimeout) clearTimeout(completionTimeout);
        completionTimeout = setTimeout(() => {
          detectPreciseSelection();
        }, 25);
      }
    };

    const handleContextMenu = () => {
      if (completionTimeout) clearTimeout(completionTimeout);
      completionTimeout = setTimeout(() => {
        detectPreciseSelection();
      }, 120);
    };

    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('mouseup', handleMouseUp, true);
    container.addEventListener('touchstart', handleTouchStart, true);
    container.addEventListener('touchend', handleTouchEnd, true);
    container.addEventListener('keyup', handleKeyUp, true);
    container.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      if (completionTimeout) clearTimeout(completionTimeout);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
      container.removeEventListener('keyup', handleKeyUp, true);
      container.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [containerSelector, detectPreciseSelection]);

  return {
    selection,
    position,
    isSelecting,
    lensData,
    clearSelection,
    bounds: selection?.bounds
  };
};

export default useWPSPrecisionSelectionEnhanced;
