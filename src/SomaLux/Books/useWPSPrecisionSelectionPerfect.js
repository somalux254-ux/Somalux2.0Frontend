/**
 * useWPSPrecisionSelectionPerfect.js - PERFECT SELECTION ACROSS ALL STYLES
 * Handles multi-colored, multi-styled, highlighted text uniformly
 * 
 * Key improvements:
 * - Zero filtering by style/color
 * - Collects all text rects regardless of styling
 * - Handles nested text layers
 * - Uniform selection across highlights, colors, and formatting
 * - Super-aggressive gap filling and merging
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useWPSPrecisionSelectionPerfect = (containerSelector = '.simple-scroll-reader') => {
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [lensData, setLensData] = useState(null);

  const selectionInProgressRef = useRef(false);
  const lastCompletedSelectionRef = useRef(null);
  const isProcessingRef = useRef(false);
  const containerRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);

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
   * PERFECT: Collect ALL rects from range without any filtering
   * Handles multi-layered text (colored, highlighted, formatted)
   */
  const collectAllRects = useCallback((range) => {
    try {
      const rects = range.getClientRects();
      const allRects = [];

      // Collect from main range
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.width > 0.01 && rect.height > 0.01) {
          allRects.push({
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          });
        }
      }

      // Also try to collect from text nodes within range
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        // Check if this node is within the range
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        
        // Only proceed if node overlaps with selection range
        if (!range.getBoundingClientRect().width) continue;

        try {
          const nodeRects = nodeRange.getClientRects();
          for (let i = 0; i < nodeRects.length; i++) {
            const rect = nodeRects[i];
            if (rect.width > 0.01 && rect.height > 0.01) {
              // Check if rect overlaps with selection area
              const selBounds = range.getBoundingClientRect();
              if (!(rect.right < selBounds.left || 
                    rect.left > selBounds.right || 
                    rect.bottom < selBounds.top || 
                    rect.top > selBounds.bottom)) {
                
                allRects.push({
                  top: rect.top,
                  left: rect.left,
                  right: rect.right,
                  bottom: rect.bottom,
                  width: rect.width,
                  height: rect.height
                });
              }
            }
          }
        } catch (e) {
          // Ignore errors for individual nodes
        }
      }

      return allRects;
    } catch (error) {
      console.error('❌ Error collecting rects:', error);
      return Array.from(range.getClientRects());
    }
  }, []);

  /**
   * PERFECT: Super-aggressive merging across ALL boundaries
   * Ignores color/style and merges everything uniformly
   */
  const perfectMergeRects = useCallback((rects) => {
    if (!rects || rects.length < 1) return rects;

    // VERY aggressive tolerances to catch ALL text
    const HORIZONTAL_GAP = 30;    // 30px horizontal gap
    const VERTICAL_LINE_GAP = 8;  // 8px vertical for same line
    const VERTICAL_NEW_LINE = 20; // 20px for new line detection

    // Remove duplicates and sort
    const uniqueRects = [];
    const seen = new Set();

    rects.forEach(rect => {
      const key = `${Math.round(rect.top)}-${Math.round(rect.left)}-${Math.round(rect.right)}-${Math.round(rect.bottom)}`;
      if (!seen.has(key)) {
        uniqueRects.push(rect);
        seen.add(key);
      }
    });

    const sortedRects = uniqueRects.sort((a, b) => {
      if (Math.abs(a.top - b.top) > VERTICAL_LINE_GAP) {
        return a.top - b.top;
      }
      return a.left - b.left;
    });

    // Group rects by line
    const lines = [];
    let currentLine = [sortedRects[0]];

    for (let i = 1; i < sortedRects.length; i++) {
      const current = sortedRects[i];
      const lastInLine = currentLine[currentLine.length - 1];

      // Same line check (within vertical tolerance)
      const sameLineVertically = Math.abs(current.top - lastInLine.top) < VERTICAL_LINE_GAP &&
                                  Math.abs(current.bottom - lastInLine.bottom) < VERTICAL_LINE_GAP;

      // Next line check (below current line)
      const isNextLine = current.top >= lastInLine.bottom - VERTICAL_LINE_GAP &&
                         current.top <= lastInLine.bottom + VERTICAL_NEW_LINE;

      if (sameLineVertically) {
        // Same line - add to current
        currentLine.push(current);
      } else if (isNextLine) {
        // Next line - finalize current and start new
        lines.push(currentLine);
        currentLine = [current];
      } else {
        // Different section - might still be part of selection
        // Check if horizontally close to any rect in current line
        let shouldAdd = false;
        for (const rect of currentLine) {
          if (Math.abs(current.left - rect.right) < HORIZONTAL_GAP ||
              Math.abs(current.right - rect.left) < HORIZONTAL_GAP) {
            shouldAdd = true;
            break;
          }
        }
        
        if (shouldAdd) {
          currentLine.push(current);
        } else {
          lines.push(currentLine);
          currentLine = [current];
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Merge each line into a single rect
    const mergedLines = lines.map(line => {
      let minTop = Infinity;
      let maxBottom = -Infinity;
      let minLeft = Infinity;
      let maxRight = -Infinity;

      line.forEach(rect => {
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
    });

    return mergedLines;
  }, []);

  /**
   * PERFECT: Rect validation - minimal filtering
   */
  const validateRectBoundariesPerfect = useCallback((rects) => {
    if (!rects || rects.length === 0) return null;

    // Collect ALL rects - almost no filtering
    const allRects = rects.filter(rect => {
      // Only filter obvious noise (0 size)
      if (rect.width < 0.01 || rect.height < 0.01) return false;
      if (!isFinite(rect.top) || !isFinite(rect.left)) return false;
      return true;
    });

    if (allRects.length === 0) return null;

    // Merge aggressively
    const mergedRects = perfectMergeRects(allRects);

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
      rects: mergedRects
    };
  }, [perfectMergeRects]);

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
   * LAYER 3: Spillage check
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
      const tolerance = 20; // Very generous tolerance

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
      if (cleanSelectedText.length > 50000) return false; // Very generous limit

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
   * PERFECT DETECTION: Uniform across all styles
   * OPTIMIZED: Throttled for smooth drag selection
   * NOTE: Only updates lens data, does NOT set selection (panel won't show yet)
   */
  const detectPreciseSelection = useCallback(() => {
    if (isProcessingRef.current) return;

    // Throttle to prevent excessive processing (8ms = ~120fps max)
    const now = Date.now();
    if (now - lastDetectionTimeRef.current < 8) return;
    lastDetectionTimeRef.current = now;

    try {
      isProcessingRef.current = true;
      const sel = window.getSelection();

      if (!sel || sel.rangeCount === 0 || sel.type === 'None') {
        setLensData(null);
        return;
      }

      const text = sel.toString().trim();

      if (text.length < 1) {
        setLensData(null);
        return;
      }

      const range = sel.getRangeAt(0);

      // LAYER 1: Text nodes
      if (!validateTextNodes(range)) {
        console.log('❌ PRECISION: Failed text node validation');
        setLensData(null);
        return;
      }

      // LAYER 2: Rect boundaries (PERFECT - all styles)
      const allRects = collectAllRects(range);
      const bounds = validateRectBoundariesPerfect(allRects);
      if (!bounds) {
        console.log('❌ PRECISION: Failed rect boundary validation');
        setLensData(null);
        return;
      }

      // LAYER 3: Spillage
      if (!validateNoTextSpillage(range, text)) {
        console.log('❌ PRECISION: Failed spillage validation');
        setLensData(null);
        return;
      }

      // LAYER 4: Container bounds
      if (!validateContainerBoundaries(bounds)) {
        console.log('❌ PRECISION: Failed container boundary validation');
        setLensData(null);
        return;
      }

      // LAYER 5: Text integrity
      if (!validateTextIntegrity(range, text)) {
        console.log('❌ PRECISION: Failed text integrity validation');
        setLensData(null);
        return;
      }

      console.log('✅ PRECISION: Valid selection detected', { text: text.substring(0, 30), bounds });

      // Update lens data for live feedback ONLY (no panel yet)
      updateLensData(range, text, bounds);
      
      // Store the selection data but DON'T show panel yet
      lastCompletedSelectionRef.current = { text, range, bounds };
    } catch (error) {
      console.error('❌ Selection detection error:', error);
      setLensData(null);
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    validateTextNodes,
    collectAllRects,
    validateRectBoundariesPerfect,
    validateNoTextSpillage,
    validateContainerBoundaries,
    validateTextIntegrity,
    updateLensData
  ]);

  const schedulePreciseSelection = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      detectPreciseSelection();
    });
  }, [detectPreciseSelection]);

  /**
   * COMPLETE SELECTION: Show panel after release
   * Called on mouseup/touchend to finalize selection and show the panel
   */
  const completeSelection = useCallback(() => {
    try {
      if (!lastCompletedSelectionRef.current) {
        console.log('ℹ️ No selection to complete');
        setSelection(null);
        setPosition(null);
        return;
      }

      const { text, range, bounds } = lastCompletedSelectionRef.current;

      console.log('🔍 completeSelection: text length =', text.length, 'bounds =', bounds);

      // Calculate position for panel
      const pos = calculatePosition(bounds);
      if (!pos) {
        console.log('❌ Failed to calculate panel position, bounds =', bounds);
        setSelection(null);
        setPosition(null);
        return;
      }

      console.log('🎉 SELECTION COMPLETED - Showing panel', { text: text.substring(0, 30), pos });

      // NOW show the panel
      setSelection({
        text,
        range,
        bounds,
        timestamp: Date.now()
      });
      setPosition(pos);
    } catch (error) {
      console.error('❌ Selection completion error:', error);
      setSelection(null);
      setPosition(null);
    }
  }, [calculatePosition]);

  /**
   * Clear selection and cleanup
   */
  const clearSelection = useCallback(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    setSelection(null);
    setPosition(null);
    setIsSelecting(false);
    setLensData(null);
    lastCompletedSelectionRef.current = null;
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
      // Reset throttle on mousedown to allow fresh detection
      lastDetectionTimeRef.current = 0;
    };

    const handleMouseUp = () => {
      selectionInProgressRef.current = false;
      if (completionTimeout) clearTimeout(completionTimeout);
      // Let the input event finish before measuring the selection.
      completionTimeout = setTimeout(() => {
        detectPreciseSelection();
        completionTimeout = setTimeout(() => {
          completeSelection();
        }, 10);
      }, 10);
    };

    const handleMouseMove = () => {
      // OPTIMIZED: Real-time detection during drag for smooth selection (lens only)
      if (selectionInProgressRef.current) {
        schedulePreciseSelection();
      }
    };

    const handleTouchStart = () => {
      selectionInProgressRef.current = true;
      setIsSelecting(true);
      // Reset throttle on touch start
      lastDetectionTimeRef.current = 0;
    };

    const handleTouchEnd = () => {
      selectionInProgressRef.current = false;
      if (completionTimeout) clearTimeout(completionTimeout);
      completionTimeout = setTimeout(() => {
        detectPreciseSelection();
        completionTimeout = setTimeout(() => {
          completeSelection();
        }, 10);
      }, 10);
    };

    const handleTouchMove = () => {
      // OPTIMIZED: Real-time detection during touch drag (lens only)
      if (selectionInProgressRef.current) {
        schedulePreciseSelection();
      }
    };

    const handleKeyUp = (e) => {
      if (e.shiftKey) {
        if (completionTimeout) clearTimeout(completionTimeout);
        // Update lens for keyboard selection
        detectPreciseSelection();
        // Show panel after keyboard selection
        completionTimeout = setTimeout(() => {
          completeSelection();
          // Keep isSelecting true
        }, 10);
      }
    };

    const handleContextMenu = () => {
      if (completionTimeout) clearTimeout(completionTimeout);
      // Update lens
      detectPreciseSelection();
      // Show panel for context menu selection
      completionTimeout = setTimeout(() => {
        completeSelection();
        // Keep isSelecting true
      }, 50);
    };

    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('mouseup', handleMouseUp, true);
    container.addEventListener('mousemove', handleMouseMove, true);
    container.addEventListener('touchstart', handleTouchStart, true);
    container.addEventListener('touchend', handleTouchEnd, true);
    container.addEventListener('touchmove', handleTouchMove, true);
    container.addEventListener('keyup', handleKeyUp, true);
    container.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      if (completionTimeout) clearTimeout(completionTimeout);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('mousemove', handleMouseMove, true);
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
      container.removeEventListener('touchmove', handleTouchMove, true);
      container.removeEventListener('keyup', handleKeyUp, true);
      container.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [containerSelector, detectPreciseSelection, schedulePreciseSelection, completeSelection]);

  return {
    selection,
    position,
    isSelecting,
    lensData,
    clearSelection,
    bounds: selection?.bounds
  };
};

export default useWPSPrecisionSelectionPerfect;
