// useProgressivePDFLoader.js - Hook to manage progressive PDF preview loading
import { useEffect, useRef, useState } from 'react';

export const useProgressivePDFLoader = (papers = [], options = {}) => {
  const {
    maxConcurrentLoads = 1,        // Load only 1 PDF at a time
    delayBetweenLoads = 200,       // 200ms between starting each load
    prioritizeVisible = true,       // Load visible papers first
  } = options;

  const [loadedPaperIds, setLoadedPaperIds] = useState(new Set());
  const [currentlyLoading, setCurrentlyLoading] = useState(new Set());
  const queueRef = useRef([]);
  const processingRef = useRef(false);

  // Process the loading queue
  useEffect(() => {
    if (processingRef.current || currentlyLoading.size >= maxConcurrentLoads) {
      return;
    }

    if (queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;

    const processQueue = async () => {
      while (
        queueRef.current.length > 0 &&
        currentlyLoading.size < maxConcurrentLoads
      ) {
        const paperId = queueRef.current.shift();

        if (loadedPaperIds.has(paperId) || currentlyLoading.has(paperId)) {
          continue;
        }

        setCurrentlyLoading(prev => new Set([...prev, paperId]));

        // Simulate load time (actual loading happens in component)
        await new Promise(resolve => setTimeout(resolve, delayBetweenLoads));
      }

      processingRef.current = false;
    };

    processQueue();
  }, [currentlyLoading, loadedPaperIds, maxConcurrentLoads, delayBetweenLoads]);

  // Update queue when papers change
  useEffect(() => {
    if (!papers || papers.length === 0) {
      queueRef.current = [];
      return;
    }

    const paperIds = papers.map(p => p.id);
    
    if (prioritizeVisible) {
      // Find visible papers using intersection observer
      const visibleIds = new Set();
      papers.forEach((paper, idx) => {
        const element = document.querySelector(`[data-paper-id="${paper.id}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            visibleIds.add(paper.id);
          }
        }
      });

      // Visible papers first, then the rest
      queueRef.current = [
        ...paperIds.filter(id => visibleIds.has(id)),
        ...paperIds.filter(id => !visibleIds.has(id))
      ].filter(id => !loadedPaperIds.has(id) && !currentlyLoading.has(id));
    } else {
      queueRef.current = paperIds.filter(
        id => !loadedPaperIds.has(id) && !currentlyLoading.has(id)
      );
    }
  }, [papers, prioritizeVisible, loadedPaperIds, currentlyLoading]);

  const markAsLoaded = (paperId) => {
    setLoadedPaperIds(prev => new Set([...prev, paperId]));
    setCurrentlyLoading(prev => {
      const next = new Set(prev);
      next.delete(paperId);
      return next;
    });
  };

  return {
    loadedPaperIds,
    currentlyLoading,
    markAsLoaded,
    progress: papers.length > 0 ? (loadedPaperIds.size / papers.length) * 100 : 0
  };
};
