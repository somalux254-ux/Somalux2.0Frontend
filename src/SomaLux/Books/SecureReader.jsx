// SecureReader.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { supabase } from './supabaseClient';
import { API_URL } from '../../config';
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiMaximize2,
  FiMinimize2,
  FiRotateCcw,
  FiRefreshCw,
  FiAlignJustify,
  FiFile,
  FiSun,
  FiCheckCircle,
} from 'react-icons/fi';
import TextSelectionPanel from './TextSelectionPanel';
import useTextSelection from './useTextSelection';
import useMobileZoomGestures from './hooks/useMobileZoomGestures';
import './SecureReader.css'; // Import CSS file

// Verify worker is configured (set in pdfConfig.js at startup)
let secureReaderWorkerReady = false;
if (pdfjs.GlobalWorkerOptions.workerSrc) {
  console.log('✅ SecureReader: Worker ready:', pdfjs.GlobalWorkerOptions.workerSrc);
  secureReaderWorkerReady = true;
} else {
  console.error('❌ PDF worker not configured! Attempting fallback...');
  try {
    const fallbackWorker = '/pdf.worker.min.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = fallbackWorker;
    secureReaderWorkerReady = true;
    console.log('✅ SecureReader: Worker set to fallback:', fallbackWorker);
  } catch (e) {
    console.error('❌ Failed to set PDF worker fallback in SecureReader:', e);
    secureReaderWorkerReady = false;
  }
}

const SecureReader = ({ src, title, author, onClose, userId, bookId, pages, sessionId: sessionIdProp, openedAt: openedAtProp }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [mobileScale, setMobileScale] = useState(1.0); // Separate mobile zoom state
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrollMode, setScrollMode] = useState(false);
  const [warmMode, setWarmMode] = useState(false);
  const [pdfError, setPdfError] = useState(!secureReaderWorkerReady);
  
  // Highlight state
  const [highlights, setHighlights] = useState([]);
  
  // Use custom hook for high-precision text selection
  console.log('🔧 SecureReader: About to call useTextSelection hook');
  const { selection, position, clearSelection, selectedText } = useTextSelection('.pdf-container');
  console.log('🔧 SecureReader: useTextSelection hook returned', { selection, position });

  // PDF container ref for mobile gestures
  const pdfContainerRef = useRef(null);

  // Debug: Monitor selection state
  useEffect(() => {
    if (selection) {
      console.log('📲 SecureReader - Selection state updated:', { selection, position });
    }
  }, [selection, position]);

  // Stable per-reader session identifiers for watermarking
  const [sessionId] = useState(() => {
    if (sessionIdProp) return sessionIdProp;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `sess_${Math.random().toString(36).slice(2, 10)}`;
  });

  const [openedAt] = useState(() => {
    if (openedAtProp) return openedAtProp;
    return new Date().toISOString();
  });

  const visibleWatermarkText = React.useMemo(() => {
    const shortSession = sessionId ? sessionId.slice(0, 8) : '';
    const ts = new Date(openedAt).toLocaleString();
    const uid = userId || 'anonymous';
    return `${uid} · ${ts} · ${shortSession}`;
  }, [userId, openedAt, sessionId]);

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

  // Block common save/print shortcuts while reader is open
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const isModifier =
        e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;

      // MS Edge style zooming - Ctrl/Cmd + +/- and scroll
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

      // If S, P, or G is pressed with ANY modifier key (except zoom keys handled above), block it
      if (isModifier && ['s', 'p', 'g'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Blocked shortcut for: ${key.toUpperCase()}`);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [zoomIn, zoomOut, resetZoom]);

  // Handle mouse wheel zooming - MS Edge style (Ctrl + scroll)
  useEffect(() => {
    const handleWheel = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const pdfContainer = document.querySelector('.pdf-container');
        if (pdfContainer && e.target.closest('.pdf-container')) {
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

  const handleDocumentLoad = ({ numPages: nextNumPages }) => {
    setNumPages(nextNumPages || 1);
    setPageNumber(1);
  };

  const goPrev = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goNext = () => {
    setPageNumber(prev => (numPages ? Math.min(numPages, prev + 1) : prev + 1));
  };

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

  const toggleFullscreen = () => {
    setIsFullscreen(v => !v);
  };

  const rotate = () => {
    setRotation(r => (r + 90) % 360);
  };

  const resetView = () => {
    setScale(1.0);
    setRotation(0);
    setPageNumber(1);
  };

  const toggleScrollMode = () => {
    setScrollMode(m => !m);
  };

  const toggleWarmMode = () => {
    setWarmMode(m => !m);
  };

  const handleMarkFinished = async () => {
    if (!userId || !bookId) {
      alert('You need to be signed in to mark this book as finished.');
      return;
    }
    onClose();
  };

  // Add highlight
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

  // Build CSS classes dynamically
  const containerClasses = [
    'secure-reader-container',
    isFullscreen ? 'fullscreen' : '',
    warmMode ? 'warm-mode' : ''
  ].filter(Boolean).join(' ');

  const pdfContainerClasses = [
    'pdf-container',
    isFullscreen ? 'fullscreen' : '',
    warmMode ? 'warm-mode' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className="secure-reader-overlay"
      onClick={onClose}
      data-watermark-user={userId || ''}
      data-watermark-session={sessionId}
      data-watermark-opened-at={openedAt}
    >
      <div
        className={containerClasses}
        onClick={e => e.stopPropagation()}
        onContextMenu={e => e.preventDefault()}
      >
        <div className="secure-reader-header">
          <div className="title-section">
            <h3 className="secure-reader-title">{title}</h3>
            {author && <p className="secure-reader-author">by {author}</p>}
          </div>

          <div className="button-group">
            {/* Mobile Zoom Controls - Inside button panel */}
            {isMobileDevice && (
              <>
                <button
                  className={`icon-button ${mobileScale <= 0.25 ? 'disabled' : ''}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); mobileZoomOut?.(); }}
                  disabled={mobileScale <= 0.25}
                  title="Zoom Out"
                >
                  −
                </button>

                <span className="zoom-display-secure">{Math.round(mobileScale * 100)}%</span>

                <button
                  className={`icon-button ${mobileScale >= 5.0 ? 'disabled' : ''}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); mobileZoomIn?.(); }}
                  disabled={mobileScale >= 5.0}
                  title="Zoom In"
                >
                  +
                </button>

                {Math.round(mobileScale * 100) !== 100 && (
                  <button
                    className="icon-button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); mobileResetZoom?.(); }}
                    title="Reset Zoom"
                  >
                    ↺
                  </button>
                )}
              </>
            )}

            <button
              className="icon-button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
            </button>
            
            <button
              className="icon-button"
              onClick={toggleScrollMode}
              title={scrollMode ? 'Single page mode' : 'Scroll mode'}
            >
              {scrollMode ? <FiFile size={14} /> : <FiAlignJustify size={14} />}
            </button>
            
            <button
              className="icon-button"
              onClick={rotate}
              title="Rotate 90°"
            >
              <FiRotateCcw size={14} />
            </button>
            
            <button
              className="icon-button"
              onClick={resetView}
              title="Reset view"
            >
              <FiRefreshCw size={14} />
            </button>
            
            <button
              className={`icon-button ${warmMode ? 'warm-mode' : ''}`}
              onClick={toggleWarmMode}
              title="Reading mode"
            >
              <FiSun size={14} />
            </button>
            
            <button
              className="finish-button"
              onClick={handleMarkFinished}
              title="Mark book as finished (updates goals & stats)"
            >
              <FiCheckCircle size={14} />
              <span style={{ fontSize: 11 }}>Finished</span>
            </button>
            
            <button
              className="close-button"
              onClick={onClose}
              title="Close reader"
            >
              <FiX size={16} />
              <span style={{ fontSize: 12 }}>Close reader</span>
            </button>
          </div>
        </div>

        <div className="content-area">
          <div className={pdfContainerClasses} ref={pdfContainerRef}>
            {/* Visible watermark overlay */}
            <div className="watermark-overlay">
              <div className="watermark-text">
                {visibleWatermarkText}
              </div>
            </div>

            {/* PDF content */}
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
                onError={(error) => {
                  console.error('PDF loading error in SecureReader:', error?.message || error);
                  setPdfError(true);
                }}
                loading={
                  <div className="loading-text">Loading book pages...</div>
                }
              >
              {pdfError ? (
                <div className="loading-text" style={{ color: '#ff6b6b', padding: '20px' }}>
                  ❌ Failed to load PDF. Please refresh the page or try again later.
                </div>
              ) : scrollMode && numPages
                ? Array.from({ length: numPages }, (_, idx) => (
                  <div 
                    key={idx + 1} 
                    className="pdf-page-container"
                  >
                    <Page
                      pageNumber={idx + 1}
                      scale={isMobileDevice ? 1 : scale}
                      rotate={rotation}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                      onRenderError={(error) => {
                        console.warn('PDF page render error:', error?.message || error);
                        setPdfError(true);
                      }}
                    />
                  </div>
                ))
                : (
                  <Page
                    pageNumber={pageNumber}
                    scale={isMobileDevice ? 1 : scale}
                    rotate={rotation}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                    onRenderError={(error) => {
                      console.warn('PDF page render error:', error?.message || error);
                      setPdfError(true);
                    }}
                  />
                )}
              </Document>
            </div>
            
            <span>
              {scrollMode
                ? numPages
                  ? `Scroll mode · ${numPages} pages`
                  : 'Scroll mode'
                : `Page ${pageNumber}${numPages ? ` of ${numPages}` : ''}`}
            </span>
            
            <div className="navigation-group">
              <button
                className="page-button"
                onClick={goPrev}
                disabled={scrollMode || pageNumber <= 1}
                title={scrollMode ? 'Previous page (disabled in scroll mode)' : 'Previous page'}
              >
                <FiChevronLeft size={14} />
              </button>
              
              <button
                className="page-button"
                onClick={goNext}
                disabled={scrollMode || (numPages && pageNumber >= numPages)}
                title={scrollMode ? 'Next page (disabled in scroll mode)' : 'Next page'}
              >
                <FiChevronRight size={14} />
              </button>
            </div>
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
        {/* Mobile Zoom Controls moved to header */}
      </div>
    </div>
  );
};

export default SecureReader;