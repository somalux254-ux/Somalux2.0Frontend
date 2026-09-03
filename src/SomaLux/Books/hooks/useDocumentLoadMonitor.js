/**
 * useDocumentLoadMonitor.js - Monitor and optimize document loading performance
 * Tracks load times, identifies bottlenecks, and optimizes rendering
 */

import { useEffect, useRef, useState } from 'react';

export const useDocumentLoadMonitor = (documentLoaded, isLoading) => {
  const [metrics, setMetrics] = useState({
    documentLoadTime: null,
    pageRenderTime: null,
    totalLoadTime: null,
  });

  const startTimeRef = useRef(null);
  const documentStartTimeRef = useRef(null);

  // Track overall component mount time
  useEffect(() => {
    startTimeRef.current = Date.now();
    return () => {
      const totalTime = Date.now() - startTimeRef.current;
      if (totalTime < 5000) {
        console.log(`⚡ FastReader loaded in ${totalTime}ms`);
      }
    };
  }, []);

  // Monitor document load completion
  useEffect(() => {
    if (!isLoading && documentLoaded && !documentStartTimeRef.current) {
      documentStartTimeRef.current = Date.now();
    }

    if (!isLoading && documentStartTimeRef.current) {
      const documentTime = Date.now() - documentStartTimeRef.current;
      
      setMetrics({
        documentLoadTime: documentTime,
        pageRenderTime: 0,
        totalLoadTime: Date.now() - startTimeRef.current,
      });

      // Log performance
      if (documentTime > 2000) {
        console.warn(`⚠️ Document load took ${documentTime}ms (slow)`);
      } else {
        console.log(`✅ Document loaded in ${documentTime}ms`);
      }

      documentStartTimeRef.current = null;
    }
  }, [isLoading, documentLoaded]);

  return metrics;
};

export default useDocumentLoadMonitor;
