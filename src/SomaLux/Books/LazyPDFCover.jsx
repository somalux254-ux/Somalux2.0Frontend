// LazyPDFCover.jsx - Optimized lazy-loading PDF previews with staggered rendering
import React, { useState, useEffect, useRef } from 'react';
import { FiFileText } from 'react-icons/fi';
import PDFCover from './PDFCover';

const LazyPDFCover = ({ 
  src, 
  alt, 
  className, 
  style, 
  onClick, 
  paperId,
  index,
  totalPapers,
  onLoadComplete 
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [loadingState, setLoadingState] = useState('placeholder'); // placeholder -> loading -> loaded
  const containerRef = useRef(null);
  const intersectionObserverRef = useRef(null);

  useEffect(() => {
    // Use Intersection Observer to detect when paper card comes into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Paper is visible, schedule lazy load with stagger
            scheduleLoad();
            observer.unobserve(entry.target);
          }
        });
      },
      { 
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0.1 
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
      intersectionObserverRef.current = observer;
    }

    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }
    };
  }, []);

  const scheduleLoad = () => {
    // Stagger loading: each PDF loads after a delay based on its position
    // This prevents all PDFs from loading simultaneously
    const staggerDelay = Math.min(index * 150, 3000); // Max 3 second stagger
    
    const timer = setTimeout(() => {
      setLoadingState('loading');
      setShouldRender(true);
    }, staggerDelay);

    return () => clearTimeout(timer);
  };

  const handlePDFLoadComplete = () => {
    setLoadingState('loaded');
    if (onLoadComplete) {
      onLoadComplete(paperId);
    }
  };

  // Always show placeholder initially
  if (loadingState === 'placeholder' || !shouldRender) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          ...style,
          width: '100%',
          height: '140px',
          backgroundColor: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          marginBottom: '8px',
          color: '#8696a0',
          fontSize: '0.8rem',
          textAlign: 'center',
          padding: '8px',
          cursor: 'pointer',
          opacity: 0.8
        }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <FiFileText size={24} />
          <span style={{ fontSize: '0.7rem' }}>Loading preview...</span>
        </div>
      </div>
    );
  }

  // Show loading state while PDF is rendering
  if (loadingState === 'loading') {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          ...style,
          width: '100%',
          height: '140px',
          backgroundColor: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          marginBottom: '8px',
          color: '#8696a0',
          fontSize: '0.8rem',
          textAlign: 'center',
          padding: '8px',
          cursor: 'pointer',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '24px', 
            height: '24px', 
            border: '2px solid #00a884', 
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: '0.7rem' }}>Rendering...</span>
        </div>
      </div>
    );
  }

  // Render actual PDF preview
  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        borderRadius: '6px',
        marginBottom: '8px',
        overflow: 'hidden',
        animation: 'fadeIn 0.3s ease-in-out'
      }}
    >
      <PDFCover
        src={src}
        alt={alt}
        className={className}
        style={{
          width: '100%',
          height: '140px'
        }}
        onClick={onClick}
        loading="lazy"
        onLoadComplete={handlePDFLoadComplete}
      />
    </div>
  );
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);

export default LazyPDFCover;
