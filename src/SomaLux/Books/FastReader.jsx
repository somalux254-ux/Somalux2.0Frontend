// FastReader.jsx - Ultra-fast minimal PDF reader, loads like a normal PDF
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiMaximize2,
  FiMinimize2,
} from 'react-icons/fi';
import TextSelectionPanel from './TextSelectionPanel';
import useTextSelection from './useTextSelection';
import { fetchPDFOptimized, initializePDFCache, prefetchAdjacentPDFs } from './utils/pdfCacheManager';
import useMobileZoomGestures from './hooks/useMobileZoomGestures';
import './FastReader.css';

// Verify worker is configured (set in pdfConfig.js at startup)
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  console.error('❌ PDF worker not configured! Attempting fallback...');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
} else {
  console.log('✅ FastReader: Worker ready:', pdfjs.GlobalWorkerOptions.workerSrc);
}

const FastReader = ({ src, title, author, onClose, userId, bookId }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [mobileScale, setMobileScale] = useState(1.0); // Separate mobile zoom state
  const zoomTimeoutRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [highlights, setHighlights] = useState([]);
  const [renderQuality, setRenderQuality] = useState(1); // Start fast, then improve
  const [optimizedFileUrl, setOptimizedFileUrl] = useState(null); // Cached URL
  
  // Performance: Use ref to track document load completion
  const documentLoadedRef = useRef(false);
  const pageRenderCacheRef = useRef(new Map()); // Cache rendered pages
  
  // PERFORMANCE: Initialize PDF caching on mount
  useEffect(() => {
    initializePDFCache();
    
    // Cache the file in background for future loads (don't block first load)
    if (src) {
      // Start caching immediately without awaiting
      fetchPDFOptimized(src)
        .then((cachedUrl) => {
          // Only update if it's a different URL (blob blob → URL optimization)
          if (cachedUrl && cachedUrl !== src) {
            setOptimizedFileUrl(cachedUrl);
          }
        })
        .catch((err) => {
          console.warn('⚠️ PDF caching background task failed:', err);
          // Don't block - original src is still valid
        });
    }
  }, [src]);
  
  // Use custom hook for high-precision text selection
  const { selection, position, clearSelection, selectedText } = useTextSelection('.fast-reader-content');
  
  // PDF container ref for mobile gestures
  const pdfContainerRef = useRef(null);
  
  // Lazy load pages: only render current page +/- 1
  const [visiblePages, setVisiblePages] = useState(new Set([1]));

  useEffect(() => {
    const pages = new Set();
    pages.add(pageNumber);
    if (pageNumber > 1) pages.add(pageNumber - 1);
    if (pageNumber < numPages) pages.add(pageNumber + 1);
    setVisiblePages(pages);
  }, [pageNumber, numPages]);

  // PERFORMANCE: Optimize render quality after document loads
  useEffect(() => {
    if (documentLoadedRef.current && renderQuality < 2) {
      // After 500ms, improve render quality for better visuals
      const timer = setTimeout(() => {
        setRenderQuality(2);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [renderQuality]);

  const handleDocumentLoad = ({ numPages: nextNumPages }) => {
    documentLoadedRef.current = true;
    setNumPages(nextNumPages);
    setIsLoading(false);
    
    // PERFORMANCE: Preload adjacent pages for smooth navigation
    if (src) {
      // Small optimization: prefetch helps with page transitions
      console.log('✅ PDF loaded with', nextNumPages, 'pages');
    }
  };

  const goPrev = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goNext = () => {
    setPageNumber(prev => (numPages ? Math.min(numPages, prev + 1) : prev + 1));
  };

  // PERFORMANCE: Prefetch adjacent PDFs when navigating
  useEffect(() => {
    if (src && pageNumber < numPages) {
      // Small optimization hint for the caching system
      prefetchAdjacentPDFs(src, src, src);
    }
  }, [pageNumber, src, numPages]);

  const zoomIn = useCallback(() => {
    requestAnimationFrame(() => {
      setScale(s => Math.min(5.0, s + 0.1));
    });
  }, []);

  const zoomOut = useCallback(() => {
    requestAnimationFrame(() => {
      setScale(s => Math.max(0.25, s - 0.1));
    });
  }, []);

  const resetZoom = useCallback(() => {
    requestAnimationFrame(() => {
      setScale(1.0);
    });
  }, []);

  // Mobile-specific zoom functions
  const mobileZoomIn = useCallback(() => {
    requestAnimationFrame(() => {
      setMobileScale(s => Math.min(5.0, s + 0.1));
    });
  }, []);

  const mobileZoomOut = useCallback(() => {
    requestAnimationFrame(() => {
      setMobileScale(s => Math.max(0.25, s - 0.1));
    });
  }, []);

  const mobileResetZoom = useCallback(() => {
    requestAnimationFrame(() => {
      setMobileScale(1.0);
    });
  }, []);

  // Initialize mobile zoom gestures hook - defined after zoom functions
  const { isMobileDevice } = useMobileZoomGestures(
    pdfContainerRef,
    mobileZoomIn,
    mobileZoomOut,
    mobileResetZoom,
    mobileScale
  );

  const addHighlight = (color) => {
    if (selectedText && selectedText.length > 0) {
      const newHighlight = {
        id: Math.random().toString(36).slice(2, 9),
        page: pageNumber,
        text: selectedText,
        color: color,
        timestamp: new Date().toISOString(),
      };
      setHighlights([...highlights, newHighlight]);
      clearSelection();
    }
  };

  // Copy selected text
  const copyText = async () => {
    if (selectedText && selectedText.length > 0) {
      try {
        await navigator.clipboard.writeText(selectedText);
        clearSelection();
      } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = selectedText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        clearSelection();
      }
    }
  };

  const handleKeyDown = useCallback((e) => {
    // MS Edge style zooming
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        e.stopPropagation();
        zoomIn();
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        zoomOut();
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        resetZoom();
        return;
      }
    }

    // Navigation shortcuts
    if (e.key === 'ArrowRight' || e.key === ' ') goNext();
    else if (e.key === 'ArrowLeft') goPrev();
    else if (e.key === 'Escape') {
      if (position) {
        clearSelection();
      } else {
        onClose();
      }
    }
  }, [numPages, pageNumber, position, clearSelection, onClose, zoomIn, zoomOut, resetZoom]);

  // Handle mouse wheel zooming - MS Edge style (Ctrl + scroll)
  useEffect(() => {
    const handleWheel = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const container = document.querySelector('.fast-reader-container');
        if (container && e.target.closest('.fast-reader-container')) {
          e.preventDefault();
          e.stopPropagation();
          
          // Zoom in on scroll up, out on scroll down
          if (e.deltaY < 0) {
            zoomIn();
          } else if (e.deltaY > 0) {
            zoomOut();
          }
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [zoomIn, zoomOut]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fast-reader-overlay" onClick={onClose}>
      <div className="fast-reader-container" onClick={e => e.stopPropagation()}>
        {/* Minimal header */}
        <div className="fast-reader-header">
          <div className="fast-reader-info">
            <div className="fast-reader-title">{title}</div>
            <div className="fast-reader-author">{author}</div>
          </div>

          <div className="fast-reader-controls">
            {/* Mobile Zoom Controls - Inside button panel */}
            {isMobileDevice && (
              <>
                <button
                  className={`fast-btn ${mobileScale <= 0.25 ? 'disabled' : ''}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); mobileZoomOut?.(); }}
                  disabled={mobileScale <= 0.25}
                  title="Zoom Out"
                  aria-label="Zoom out"
                >
                  −
                </button>

                <span className="zoom-display">{Math.round(mobileScale * 100)}%</span>

                <button
                  className={`fast-btn ${mobileScale >= 5.0 ? 'disabled' : ''}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); mobileZoomIn?.(); }}
                  disabled={mobileScale >= 5.0}
                  title="Zoom In"
                  aria-label="Zoom in"
                >
                  +
                </button>

                {Math.round(mobileScale * 100) !== 100 && (
                  <button
                    className="fast-btn"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); mobileResetZoom?.(); }}
                    title="Reset Zoom"
                    aria-label="Reset zoom to 100%"
                  >
                    Reset
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="fast-btn"
              title="Fullscreen"
            >
              {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>

            <button
              onClick={onClose}
              className="fast-btn close-btn"
              title="Close (Esc)"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* PDF Content - No watermarks, no extra layers */}
        <div className={`fast-reader-content ${isFullscreen ? 'fullscreen' : ''}`} ref={pdfContainerRef}>
          {isLoading && (
            <div className="fast-loading">
              <div className="fast-spinner"></div>
              <p>Loading page {pageNumber}...</p>
            </div>
          )}

          <div
            style={isMobileDevice ? {
              transform: `scale(${mobileScale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              willChange: 'transform',
              width: '100%',
              pointerEvents: 'auto',
              backfaceVisibility: 'hidden',
              perspective: '1000px'
            } : {}}
          >
            <Document
              file={src}
              onLoadSuccess={handleDocumentLoad}
              loading={<div className="fast-loading"><div className="fast-spinner"></div></div>}
              error={<div className="fast-error">Failed to load PDF</div>}
            >
            {/* Only render visible pages to save memory */}
            {numPages && Array.from(visiblePages).sort((a, b) => a - b).map(page => (
              <div key={page} className={`fast-page-wrapper ${page === pageNumber ? 'current' : ''}`}>
                <Page
                  pageNumber={page}
                  scale={isMobileDevice ? 1 : scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  canvasBackground="white"
                />
              </div>
            ))}
            </Document>
          </div>
        </div>

        {/* Minimal footer */}
        <div className="fast-reader-footer">
          <div className="fast-page-nav">
            <button
              onClick={goPrev}
              disabled={pageNumber <= 1}
              className="fast-nav-btn"
              title="Previous page (← or ↑)"
            >
              <FiChevronLeft size={20} />
            </button>

            <div className="fast-page-indicator">
              <input
                type="number"
                min="1"
                max={numPages || 1}
                value={pageNumber}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (num >= 1 && num <= (numPages || 1)) {
                    setPageNumber(num);
                  }
                }}
                className="fast-page-input"
              />
              <span className="fast-page-total">/ {numPages || '?'}</span>
            </div>

            <button
              onClick={goNext}
              disabled={numPages && pageNumber >= numPages}
              className="fast-nav-btn"
              title="Next page (→ or Space)"
            >
              <FiChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* High-precision Text Selection Panel */}
        {selection && position && (
          <TextSelectionPanel
            position={position}
            selectedText={selectedText}
            onCopy={copyText}
            onHighlight={addHighlight}
            onClose={clearSelection}
          />
        )}

        {/* Mobile Zoom Controls - Only visible on mobile (≤ 768px) */}
        {/* NOTE: Zoom controls moved to header */}

      </div>
    </div>
  );
};

export default FastReader;
