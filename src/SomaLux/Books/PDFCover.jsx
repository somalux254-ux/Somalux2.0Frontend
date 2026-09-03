// PDFCover.jsx - Renders the first page of a PDF as a cover thumbnail
import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Verify worker is configured (set in pdfConfig.js at startup)
// Check if it's properly set before use
let workerReady = false;
if (pdfjs.GlobalWorkerOptions.workerSrc) {
  console.log('✅ PDFCover: Worker ready:', pdfjs.GlobalWorkerOptions.workerSrc);
  workerReady = true;
} else {
  console.error('❌ PDF worker not configured! Attempting fallback...');
  try {
    const fallbackWorker = '/pdf.worker.min.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = fallbackWorker;
    workerReady = true;
    console.log('✅ PDFCover: Worker set to fallback:', fallbackWorker);
  } catch (e) {
    console.error('❌ Failed to set PDF worker fallback:', e);
    workerReady = false;
  }
}

const PDFCover = ({ src, alt, className, style, onClick, loading = 'lazy', onLoadComplete }) => {
  const [error, setError] = useState(!workerReady);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = React.useRef(null);
  const [containerWidth, setContainerWidth] = useState(280);
  const renderAttemptRef = useRef(0);

  // Update PDF width based on container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // Use container width minus padding, but max 280px
        setContainerWidth(Math.min(width - 4, 280));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // If PDF worker not ready, show fallback immediately
  if (!workerReady) {
    console.warn('PDF worker not ready, showing fallback for:', src);
    return (
      <div
        className={className}
        style={{
          ...style,
          backgroundColor: '#00a884',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '0.8em',
          textAlign: 'center',
          padding: '10px',
        }}
        onClick={onClick}
      >
        📄 PDF
      </div>
    );
  }

  if (error || !src) {
    // Fallback to placeholder if PDF fails to load
    return (
      <div
        className={className}
        style={{
          ...style,
          backgroundColor: '#00a884',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '0.8em',
          textAlign: 'center',
          padding: '10px',
        }}
        onClick={onClick}
      >
        📄 PDF
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        width: '100%',
      }}
      onClick={onClick}
    >
      {isLoading && (
        <div style={{ textAlign: 'center', color: '#888', padding: '20px', position: 'absolute', display: 'none' }}>
          Preview...
        </div>
      )}
      <Document
        file={src}
        onLoadSuccess={() => {
          // Document loaded successfully
          setIsLoading(false);
          renderAttemptRef.current = 0;
          console.log('✅ PDF document loaded:', src);
          if (onLoadComplete) {
            onLoadComplete();
          }
        }}
        onError={(error) => {
          console.warn('PDF load error (will display fallback):', error?.message || error);
          // Check if it's a worker-related error
          if (error?.message?.includes('worker') || error?.message?.includes('sendWithPromise')) {
            console.error('⚠️ Worker error detected, reinitializing...');
            // Force reinitialize worker
            try {
              pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
            } catch (e) {
              console.error('Failed to reinitialize worker:', e);
            }
          }
          setIsLoading(false);
          setError(true);
        }}
        loading={<div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Preview PDF...</div>}
      >
        <Page
          pageNumber={1}
          width={containerWidth}
          onRenderError={(error) => {
            console.warn('PDF render error (will display fallback):', error?.message || error);
            setIsLoading(false);
            setError(true);
          }}
          onError={(error) => {
            console.warn('PDF page error (will display fallback):', error?.message || error);
            setIsLoading(false);
            setError(true);
          }}
        />
      </Document>
    </div>
  );
};

export default React.memo(PDFCover);
