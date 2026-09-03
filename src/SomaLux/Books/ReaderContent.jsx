import React from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import "./ReaderContent.css";
const ReaderContent = ({
  src,
  numPages,
  pageNumber,
  scale,
  rotation,
  isFullscreen,
  scrollMode,
  warmMode,
  visibleWatermarkText,
  handleDocumentLoad,
  goPrev,
  goNext,
}) => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#020617',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          paddingTop: isFullscreen ? 32 : 24,
          paddingBottom: isFullscreen ? 32 : 24,
          paddingLeft: isFullscreen ? 24 : 16,
          paddingRight: isFullscreen ? 24 : 16,
          background: warmMode
            ? 'radial-gradient(circle at top, #1f2933 0%, #020617 55%, #050308 100%)'
            : '#020617',
          filter: warmMode ? 'sepia(0.25) hue-rotate(-10deg) saturate(1.1)' : 'none',
          position: 'relative',
        }}
      >
        {/* Visible watermark overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.08,
            mixBlendMode: 'screen',
            fontSize: 18,
            letterSpacing: 1.5,
            color: '#f97316',
            textAlign: 'center',
            padding: 32,
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              transform: 'rotate(-24deg)',
              whiteSpace: 'nowrap',
              textShadow: '0 0 18px rgba(15,23,42,0.9)',
            }}
          >
            {visibleWatermarkText}
          </div>
        </div>

        {/* PDF content */}
        <Document
          file={src}
          onLoadSuccess={handleDocumentLoad}
          loading={
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              Loading book pages...
            </div>
          }
        >
          {scrollMode && numPages
            ? Array.from({ length: numPages }, (_, idx) => (
                <div key={idx + 1} style={{ marginBottom: 24 }}>
                  <Page
                    pageNumber={idx + 1}
                    scale={scale}
                    rotate={rotation}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                  />
                </div>
              ))
            : (
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                />
              )}
        </Document>
      </div>

      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#94a3b8',
          fontSize: 12,
        }}
      >
        <span>
          {scrollMode
            ? numPages
              ? `Scroll mode · ${numPages} pages`
              : 'Scroll mode'
            : `Page ${pageNumber}${numPages ? ` of ${numPages}` : ''}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={goPrev}
            disabled={scrollMode || pageNumber <= 1}
            title={
              scrollMode
                ? 'Previous page (disabled in scroll mode)'
                : 'Previous page'
            }
            style={{
              border: 'none',
              background: 'rgba(15,23,42,0.9)',
              color: pageNumber <= 1 ? '#4b5563' : '#e2e8f0',
              borderRadius: 999,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              cursor: pageNumber <= 1 ? 'default' : 'pointer',
            }}
          >
            <FiChevronLeft size={14} />
          </button>
          <button
            onClick={goNext}
            disabled={scrollMode || (numPages && pageNumber >= numPages)}
            title={
              scrollMode ? 'Next page (disabled in scroll mode)' : 'Next page'
            }
            style={{
              border: 'none',
              background: 'rgba(15,23,42,0.9)',
              color: numPages && pageNumber >= numPages ? '#4b5563' : '#e2e8f0',
              borderRadius: 999,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              cursor:
                numPages && pageNumber >= numPages ? 'default' : 'pointer',
            }}
          >
            <FiChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReaderContent;