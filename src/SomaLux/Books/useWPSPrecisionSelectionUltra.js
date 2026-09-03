/**
 * useWPSPrecisionSelectionUltra.js - ULTRA PRECISION FOR PDF GAP FILLING
 * Aggressive gap detection and filling for seamless PDF text selection
 * 
 * Key improvements:
 * - Aggressive gap tolerance (20px horizontal, 5px vertical)
 * - Smart rect clustering and merging
 * - Better handling of multi-line selections
 * - Flood-fill algorithm for connecting nearby rects
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useWPSPrecisionSelectionUltra = (containerSelector = '.simple-scroll-reader') => {
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
   * ULTRA: Aggressive gap-filling with flood-fill algorithm
   * Connects nearby rects even with large gaps (PDF text issue)
   */
  const intelligentRectMerging = useCallback((rects) => {
    if (!rects || rects.length < 2) return rects;

    const HORIZONTAL_GAP_TOLERANCE = 20; // 20px horizontal gap
    const VERTICAL_GAP_TOLERANCE = 5;    // 5px vertical gap (line tolerance)

    // Sort rects by position
    const sortedRects = Array.from(rects).sort((a, b) => {
      if (Math.abs(a.top - b.top) > VERTICAL_GAP_TOLERANCE) {
        return a.top - b.top;
      }
      return a.left - b.left;
    });

    const merged = [];
    const used = new Set();

    for (let i = 0; i < sortedRects.length; i++) {
      if (used.has(i)) continue;

      const currentGroup = [sortedRects[i]];
      used.add(i);

      // Greedily find all rects that should be merged with this one
      let foundMore = true;
      while (foundMore) {
        foundMore = false;

        for (let j = 0; j < sortedRects.length; j++) {
          if (used.has(j)) continue;

          const candidate = sortedRects[j];
          let shouldMerge = false;

          // Check against all rects in current group
          for (const groupRect of currentGroup) {
            // Same line (vertical tolerance)?
            const sameLineVertically = Math.abs(candidate.top - groupRect.top) < VERTICAL_GAP_TOLERANCE &&
                                        Math.abs(candidate.bottom - groupRect.bottom) < VERTICAL_GAP_TOLERANCE;

            // Horizontally close (including gap tolerance)?
            const horizontallyClose = candidate.left <= groupRect.right + HORIZONTAL_GAP_TOLERANCE &&
                                      candidate.right >= groupRect.left - HORIZONTAL_GAP_TOLERANCE;

            // Consecutive lines (new line after current)?
            const consecutiveLine = candidate.top >= groupRect.bottom - VERTICAL_GAP_TOLERANCE &&
                                    candidate.top <= groupRect.bottom + VERTICAL_GAP_TOLERANCE;

            if ((sameLineVertically && horizontallyClose) || consecutiveLine) {
              shouldMerge = true;
              break;
            }
          }

          if (shouldMerge) {
            currentGroup.push(candidate);
            used.add(j);
            foundMore = true;
          }
        }
      }

      // Merge group
      merged.push(mergeRectGroup(currentGroup));
    }

    return merged;
  }, []);

  /**
   * Merge a group of rects into single encompassing rect
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
      height: maxBottom - minTop
    };
  }, []);

  /**
   * ULTRA: Aggressive rect validation with gap filling
   */
  const validateRectBoundariesUltra = useCallback((rects) => {
    if (!rects || rects.length === 0) return null;

    // Accept very small rects (PDF characters can be tiny)
    const validRects = Array.from(rects).filter(rect => {
      if (rect.width < 0.1 || rect.height < 0.1) return false;
      if (!isFinite(rect.top) || !isFinite(rect.left)) return false;
      return true;
    });

    if (validRects.length === 0) return null;

    // Aggressive merging to fill gaps
    const mergedRects = intelligentRectMerging(validRects);

    if (mergedRects.length === 0) return null;

    // Calculate final bounds
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
  }, [intelligentRectMerging]);

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
   * LAYER 3: Simplified for PDF
   */
  const validateNoTextSpillage = useCallback((range, selectedText) => {
    try {
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
      const tolerance = 10; // Increased tolerance

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
      const cleanSelectedText = selectedText.trim();

      if (cleanSelectedText.length < 1) return false;
      if (cleanSelectedText.length > 10000) return false;

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
   * ULTRA DETECTION: Multi-layer with aggressive gap filling
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

      if (text.length < 1) {
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

      // LAYER 2: Rect boundaries (ULTRA aggressive gap filling)
      const rects = range.getClientRects();
      const bounds = validateRectBoundariesUltra(rects);
      if (!bounds) {
        console.log('❌ PRECISION: Failed rect boundary validation');
        setIsSelecting(false);
        setLensData(null);
        return;
      }

      // LAYER 3: Spillage
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
    validateRectBoundariesUltra,
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
    if (!container) {
      console.warn('⚠️ Selection container not found:', containerSelector);
      return;
    }

    console.log('✅ Ultra selection listeners attached to:', containerSelector);

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
      console.log('👆 Touch start - isMobile:', isMobileRef.current);
      selectionInProgressRef.current = true;
      setIsSelecting(true);
    };

    const handleTouchMove = () => {
      // Update selection during touch drag
      if (selectionInProgressRef.current) {
        detectPreciseSelection();
      }
    };

    const handleTouchEnd = () => {
      console.log('👆 Touch end');
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
    container.addEventListener('touchmove', handleTouchMove, true);
    container.addEventListener('touchend', handleTouchEnd, true);
    container.addEventListener('keyup', handleKeyUp, true);
    container.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      if (completionTimeout) clearTimeout(completionTimeout);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchmove', handleTouchMove, true);
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

export default useWPSPrecisionSelectionUltra;
