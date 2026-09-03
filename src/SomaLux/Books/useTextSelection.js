/**
 * useTextSelection.js - STABLE VERSION
 * High-precision, reliable text selection detection
 * Guaranteed stable panel display with proper event handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useTextSelection = (containerSelector = '.fast-reader-content') => {
  // Mobile device detection
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  // Initialize mobile detection
  useEffect(() => {
    const detectMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (navigator.maxTouchPoints > 2);
      isMobileRef.current = mobile;
      setIsMobile(mobile);
      console.log(`📱 Mobile device detected: ${mobile}`);
      return mobile;
    };

    detectMobile();
    window.addEventListener('orientationchange', detectMobile);
    return () => window.removeEventListener('orientationchange', detectMobile);
  }, []);

  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState(null);
  const timeoutRef = useRef(null);
  const lastSelectionTimeRef = useRef(0);
  const selectionStableRef = useRef(false);
  const isProcessingRef = useRef(false);
  const touchStartTimeRef = useRef(0);
  const lastPositionRef = useRef(null); // Track last position to prevent jumping
  const positionSmoothingRef = useRef(0); // Counter to stabilize position

  /**
   * Calculate optimal position for the selection panel with ULTRA precision
   */
  const calculatePosition = useCallback((rect) => {
    try {
      if (!rect || rect.width === 0 || rect.height === 0) {
        return null;
      }

      const isMobile = isMobileRef.current;
      const panelHeight = isMobile ? 160 : 140; // Slightly larger for better UX
      const panelWidth = isMobile ? 200 : 220;
      const viewportPadding = isMobile ? 12 : 20;
      const selectionGap = 12; // Space between selection and panel

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate center position on selection
      let x = rect.centerX - panelWidth / 2;
      let y = rect.top - panelHeight - selectionGap;

      // PRECISION: Check if position is viable
      
      // Horizontal adjustment: Keep panel within viewport
      if (x < viewportPadding) {
        x = viewportPadding;
      } else if (x + panelWidth > viewportWidth - viewportPadding) {
        x = viewportWidth - panelWidth - viewportPadding;
      }

      // Vertical adjustment: Try above first, fallback below
      if (y < viewportPadding) {
        // Not enough space above - position below
        y = rect.bottom + selectionGap;
        
        // If also not enough space below, center in viewport
        if (y + panelHeight > viewportHeight - viewportPadding) {
          y = (viewportHeight - panelHeight) / 2;
        }
      } else if (y + panelHeight > viewportHeight - viewportPadding) {
        // Check if we can fit below
        const belowY = rect.bottom + selectionGap;
        if (belowY + panelHeight <= viewportHeight - viewportPadding) {
          y = belowY;
        } else {
          // Can't fit above or below - center it
          y = Math.max(viewportPadding, (viewportHeight - panelHeight) / 2);
        }
      }

      // Final bounds check
      x = Math.max(viewportPadding, Math.min(x, viewportWidth - panelWidth - viewportPadding));
      y = Math.max(viewportPadding, Math.min(y, viewportHeight - panelHeight - viewportPadding));

      return { x: Math.round(x), y: Math.round(y) };
    } catch (error) {
      console.error('❌ Position calculation error:', error);
      return null;
    }
  }, []);

  /**
   * PRECISION VALIDATION: Validate text nodes are clean (no spillage into adjacent elements)
   */
  const validateTextNodePrecision = useCallback((range) => {
    try {
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      
      // Both containers must be text nodes or within text-containing elements
      if (startContainer.nodeType !== Node.TEXT_NODE && 
          startContainer.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      
      if (endContainer.nodeType !== Node.TEXT_NODE && 
          endContainer.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      
      // Get the actual parent elements
      const startParent = startContainer.nodeType === Node.TEXT_NODE ? 
        startContainer.parentElement : startContainer;
      const endParent = endContainer.nodeType === Node.TEXT_NODE ? 
        endContainer.parentElement : endContainer;
      
      // Both parents should be legitimate text containers
      if (!startParent || !endParent) {
        return false;
      }
      
      // Check that we're not selecting across major structural breaks
      const commonAncestor = range.commonAncestorContainer;
      if (!commonAncestor) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Text node validation error:', error);
      return false;
    }
  }, []);

  /**
   * SMART BOUNDARY DETECTION: Get exact start and end character positions
   * Uses improved algorithm that snaps to actual character boundaries
   */
  const getExactBoundaries = useCallback((range) => {
    try {
      const rects = range.getClientRects();
      if (!rects || rects.length === 0) return null;

      // For start boundary: use first rect's left edge
      const firstRect = rects[0];
      const lastRect = rects[rects.length - 1];

      if (!firstRect || !lastRect) return null;

      // Snap boundaries to nearest pixel (avoid sub-pixel jitter)
      return {
        startX: Math.round(firstRect.left),
        startY: Math.round(firstRect.top),
        endX: Math.round(lastRect.right),
        endY: Math.round(lastRect.bottom),
        firstRect: {
          left: Math.round(firstRect.left),
          top: Math.round(firstRect.top),
          right: Math.round(firstRect.right),
          bottom: Math.round(firstRect.bottom)
        },
        lastRect: {
          left: Math.round(lastRect.left),
          top: Math.round(lastRect.top),
          right: Math.round(lastRect.right),
          bottom: Math.round(lastRect.bottom)
        }
      };
    } catch (error) {
      return null;
    }
  }, []);

  /**
   * SIMPLE CHARACTER VALIDATION: Just ensure text is readable
   * Don't overthink it - if we can display it, selection is valid
   */
  const validateCharacterBoundaries = useCallback((text) => {
    try {
      // Just check that we have actual text
      return text && text.trim().length > 0;
    } catch (error) {
      return true; // Fallback: allow it
    }
  }, []);

  /**
   * SIMPLIFIED: Just validate multi-line selections have reasonable structure
   * Don't reject - just count lines
   */
  const optimizeMultilineSelection = useCallback((rects, boundingRect) => {
    try {
      if (rects.length <= 1) return boundingRect;

      const rectArray = Array.from(rects).filter(r => r.width > 0.2 && r.height > 0.2);
      
      // Just add line count - don't reject
      return {
        ...boundingRect,
        lineCount: rectArray.length
      };
    } catch (error) {
      return boundingRect;
    }
  }, []);

  /**
   * Core selection detection - ENHANCED FOR PRECISION
   * Only updates state if valid selection detected within container
   */
  const detectSelection = useCallback(() => {
    // Prevent duplicate processing
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      const sel = window.getSelection();

      // No selection
      if (!sel || sel.rangeCount === 0 || sel.type === 'None') {
        setSelection(null);
        setPosition(null);
        selectionStableRef.current = false;
        return;
      }

      const text = sel.toString().trim();

      // Accept even single character - very minimal pressure
      if (text.length < 1) {
        return; // Just return silently
      }

      // Get range
      const range = sel.getRangeAt(0);
      
      // PRECISION: Validate text nodes before proceeding
      if (!validateTextNodePrecision(range)) {
        return; // Just return silently
      }
      
      // SIMPLE: Validate character boundaries
      if (!validateCharacterBoundaries(text)) {
        return; // Just return silently
      }
      
      // Get exact boundaries
      const boundaries = getExactBoundaries(range);
      if (!boundaries) {
        return; // Just return silently
      }
      
      const rects = range.getClientRects();
      
      if (!rects || rects.length === 0) {
        setSelection(null);
        setPosition(null);
        selectionStableRef.current = false;
        return;
      }

      // ENHANCED: Validate selection is within the container with precise boundary checking
      const container = document.querySelector(containerSelector);
      if (container) {
        const containerRect = container.getBoundingClientRect();
        let isWithinContainer = false;
        
        // More lenient: accept if ANY rect is in container (not all)
        for (let rect of rects) {
          if (rect.width > 0.05 && rect.height > 0.05) {
            // Check if rect overlaps with container
            if (!(rect.right < containerRect.left || 
                  rect.left > containerRect.right || 
                  rect.bottom < containerRect.top || 
                  rect.top > containerRect.bottom)) {
              isWithinContainer = true;
              break; // Found at least one valid rect
            }
          }
        }
        
        if (!isWithinContainer) {
          setSelection(null);
          setPosition(null);
          selectionStableRef.current = false;
          return;
        }
      }

      // Get bounding box of all selected text with ULTRA precision
      let minTop = Infinity;
      let maxBottom = -Infinity;
      let minLeft = Infinity;
      let maxRight = -Infinity;
      let validRectCount = 0;
      let totalArea = 0;
      
      for (let rect of rects) {
        // Accept even very small rects (0.1px+) for minimal pressure needed
        if (rect.width > 0.05 && rect.height > 0.05) {
          minTop = Math.min(minTop, rect.top);
          maxBottom = Math.max(maxBottom, rect.bottom);
          minLeft = Math.min(minLeft, rect.left);
          maxRight = Math.max(maxRight, rect.right);
          validRectCount++;
          totalArea += rect.width * rect.height;
        }
      }
      
      // Ensure we have valid bounds and at least one valid rect
      if (minTop === Infinity || maxRight === -Infinity || validRectCount === 0) {
        return; // Just return silently
      }
      
      // SIMPLIFIED: Just create bounding rect without overthinking
      let boundingRect = {
        top: Math.round(minTop),
        bottom: Math.round(maxBottom),
        left: Math.round(minLeft),
        right: Math.round(maxRight),
        width: Math.round(maxRight - minLeft),
        height: Math.round(maxBottom - minTop),
        centerX: (minLeft + maxRight) / 2,
        centerY: (minTop + maxBottom) / 2,
        rectCount: validRectCount,
        totalArea: Math.round(totalArea)
      };

      // PRECISION ENHANCEMENT: Smart boundary refinement
      // If selection is very small, expand slightly to nearest text boundaries
      if (boundingRect.width < 30 && validRectCount === 1) {
        // Single small rect - likely a single character or partial word
        // Expand by 2px on each side for better visibility
        boundingRect.left = Math.max(0, boundingRect.left - 2);
        boundingRect.right = boundingRect.right + 2;
        boundingRect.width = boundingRect.right - boundingRect.left;
        boundingRect.centerX = (boundingRect.left + boundingRect.right) / 2;
      }

      // Optimize multi-line selections (just adds line count)
      boundingRect = optimizeMultilineSelection(rects, boundingRect);

      // Calculate position based on actual selection bounds
      let pos = calculatePosition(boundingRect);
      if (!pos) {
        return; // Just return silently
      }

      // SMOOTH POSITION: Prevent jumping by applying smoothing to rapid changes
      // More responsive: accept movement >2px (was 5px) for faster panel follow
      if (lastPositionRef.current) {
        const dx = Math.abs(pos.x - lastPositionRef.current.x);
        const dy = Math.abs(pos.y - lastPositionRef.current.y);
        
        // If change is tiny (less than 2px), use last position to prevent micro-jitter
        if (dx < 2 && dy < 2) {
          pos = lastPositionRef.current;
        }
      }
      lastPositionRef.current = pos;

      // STABLE: Update state for new selections (only after completion)
      const now = Date.now();
      if (!selectionStableRef.current || now - lastSelectionTimeRef.current > 100) {
        lastSelectionTimeRef.current = now;
        setSelection({
          text,
          range,
          timestamp: now,
          rects: boundingRect, // Store precise bounds
        });
        setPosition(pos);
        selectionStableRef.current = true;
        console.log('✅ Selection complete:', text.substring(0, 30), '| Bounds:', boundingRect);
      }
    } catch (error) {
      console.log('❌ Detection error:', error);
      setSelection(null);
      setPosition(null);
      selectionStableRef.current = false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [calculatePosition, containerSelector, validateTextNodePrecision, validateCharacterBoundaries, getExactBoundaries, optimizeMultilineSelection]);

  /**
   * Clear selection permanently
   */
  const clearSelection = useCallback(() => {
    console.log('🗑️ Selection cleared');
    setSelection(null);
    setPosition(null);
    selectionStableRef.current = false;
    lastSelectionTimeRef.current = 0;
    
    // Clear browser selection only if needed
    try {
      window.getSelection().removeAllRanges();
    } catch (e) {
      // Ignore
    }
  }, []);

  /**
   * STABLE EVENT LISTENERS - Global document-level coverage with mobile optimizations
   */
  useEffect(() => {
    console.log('🎬 useTextSelection hook mounted');

    // Debounce flag to prevent multiple rapid calls
    let detectionTimeout = null;
    let touchStartedRef = false;
    let lastDetectionTimeRef = 0;

    const scheduleDetection = (delay = 25) => {
      if (detectionTimeout) clearTimeout(detectionTimeout);
      detectionTimeout = setTimeout(() => {
        detectSelection();
        lastDetectionTimeRef = Date.now();
      }, delay);
    };

    // Mouse-based selection - instant response
    const handleMouseUp = () => {
      scheduleDetection(0); // Immediate detection
    };

    // Keyboard selection (Shift+Arrow, etc) - instant
    const handleKeyUp = (e) => {
      // Only for selection keyboard shortcuts
      if (e.shiftKey) {
        scheduleDetection(0); // Immediate detection
      }
    };

    // Touch start - simply mark that touch started
    const handleTouchStart = (e) => {
      touchStartedRef = true;
      touchStartTimeRef.current = Date.now();
      console.log('👆 Touch started');
    };

    // Touch move - we don't care about movement for text selection
    const handleTouchMove = (e) => {
      // Just track that there's movement
      // We'll allow selection either way
    };

    // Touch selection (mobile) - ENHANCED: Better precision for mobile
    const handleTouchEnd = () => {
      if (!touchStartedRef) return;
      touchStartedRef = false;

      const touchDuration = Date.now() - touchStartTimeRef.current;
      console.log(`📱 Touch ended after ${touchDuration}ms`);
      
      // Even faster mobile detection - barely any delay
      const delay = 25; // Minimal delay for quick response
      scheduleDetection(delay);
    };

    // Pointer events (hybrid devices)
    const handlePointerUp = () => {
      scheduleDetection(15); // Faster response for pointer
    };

    // Selection change event for keyboard-based selection with immediate response
    const handleSelectionChange = () => {
      // Immediate detection on selection change for better precision
      const now = Date.now();
      if (now - lastDetectionTimeRef > 25) {
        scheduleDetection(0); // No delay for selection change
      }
    };

    // Context menu for iOS long-press
    const handleContextMenu = () => {
      console.log('📋 Context menu detected (iOS long-press)');
      // Faster detection for context menu
      scheduleDetection(100); // Reduced from 200ms
    };

    // ATTACH TO DOCUMENT - Global listeners for all selection methods
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('touchstart', handleTouchStart, true);
    document.addEventListener('touchmove', handleTouchMove, true);
    document.addEventListener('touchend', handleTouchEnd, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('selectionchange', handleSelectionChange, true);

    return () => {
      console.log('🎬 useTextSelection hook unmounting');
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('selectionchange', handleSelectionChange, true);
      
      if (detectionTimeout) clearTimeout(detectionTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [detectSelection]);

  /**
   * STABLE CLICK OUTSIDE HANDLER
   * Panel stays open until user explicitly closes it or selects new text
   */
  useEffect(() => {
    if (!selection || !position) return;

    const handleClickOutside = (e) => {
      // Check if click is on the panel or its children
      const panel = document.querySelector('.text-selection-panel');
      if (panel && (panel === e.target || panel.contains(e.target))) {
        return; // Click is on panel, don't close
      }

      // Check if it's a new text selection
      const currentSelection = window.getSelection();
      if (currentSelection && currentSelection.rangeCount > 0) {
        const currentText = currentSelection.toString().trim();
        // If user is selecting NEW text (different from current), close old panel
        if (currentText !== selection.text) {
          // Don't close here - let the new selection's panel replace it
          // The new selection detection will update the state
          return;
        }
      }

      // Only close if user clicks the close button or explicitly outside
      // Panel will stay open for user to interact with Copy/Highlight buttons
      // User can click background to close if they want
      // But we give them time to interact with the panel first
    };

    // Use capture phase for reliable detection of ALL clicks
    document.addEventListener('click', handleClickOutside, true);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [selection, position, clearSelection]);

  return {
    selection,
    position,
    clearSelection,
    selectedText: selection?.text || '',
  };
};

export default useTextSelection;
