// SimpleScrollReader.jsx - Like Microsoft Edge PDF viewer - just scroll to read
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FiX, FiList, FiDownload, FiBarChart2, FiEdit3, FiBookmark, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { PDFDocument } from 'pdf-lib';
import saveAs from 'file-saver';
import SummaryModal from './SummaryModal';
import DownloadModal from './DownloadModal';
import StatisticsModal from './StatisticsModal';
import TextSelectionPanel from './TextSelectionPanel';
import useWPSPrecisionSelectionPerfect from './useWPSPrecisionSelectionPerfect';
import { generateSummaryDocument } from './utils/generateWordDoc';
import useMobileZoomGestures from './hooks/useMobileZoomGestures';
import ZoomClarity from './ZoomClarity';
import { getPersistentPdfSource } from './utils/persistentPdfCache';
import loadingSvg from './loading.svg';
import './SimpleScrollReader.css';

// Verify worker is configured (set in pdfConfig.js at startup)
let simpleReaderWorkerReady = false;

if (pdfjs.GlobalWorkerOptions.workerSrc) {
  console.log('✅ SimpleScrollReader: Worker ready:', pdfjs.GlobalWorkerOptions.workerSrc);
  simpleReaderWorkerReady = true;
} else {
  console.error('❌ PDF worker not configured! Attempting fallback...');
  try {
    const fallbackWorker = '/pdf.worker.min.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = fallbackWorker;
    simpleReaderWorkerReady = true;
    console.log('✅ SimpleScrollReader: Worker set to fallback:', fallbackWorker);
  } catch (e) {
    console.error('❌ Failed to set PDF worker fallback in SimpleScrollReader:', e);
    simpleReaderWorkerReady = false;
  }
}

const SimpleScrollReader = ({ src, title, author, onClose, sampleText, cacheKey }) => {
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 1;
  const DEFAULT_ZOOM = MIN_ZOOM;
  const useNativeTextToSpeech = Capacitor.isNativePlatform?.() === true;
  const nativeTtsLanguageRef = useRef(null);
  const nativeTtsInitPromiseRef = useRef(null);

  const prepareBrowserTextToSpeech = useCallback(async () => {
    if (useNativeTextToSpeech) return true;
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      console.error('[tts] Browser speech synthesis is unavailable');
      return false;
    }

    window.speechSynthesis.resume();
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 1000);
        const handleVoicesChanged = () => {
          clearTimeout(timeout);
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          resolve();
        };
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true });
      });
      voices = window.speechSynthesis.getVoices();
    }
    console.log('[tts] Browser speech engine ready', {
      voiceCount: voices.length,
      paused: window.speechSynthesis.paused,
      speaking: window.speechSynthesis.speaking,
      pending: window.speechSynthesis.pending,
      defaultVoice: voices.find(voice => voice.default)?.name || null
    });
    // Chrome can speak with its default voice even when getVoices() is still empty.
    return true;
  }, [useNativeTextToSpeech]);

  const prepareNativeTextToSpeech = useCallback(async () => {
    if (!useNativeTextToSpeech) return true;
    if (nativeTtsLanguageRef.current) return true;
    if (!nativeTtsInitPromiseRef.current) {
      nativeTtsInitPromiseRef.current = (async () => {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          try {
            const { languages = [] } = await TextToSpeech.getSupportedLanguages();
            const language = languages.find(value => /^en(-|$)/i.test(value)) || languages[0];
            if (language) {
              nativeTtsLanguageRef.current = language;
              console.log('[tts] Native engine ready', { language, languageCount: languages.length });
              return true;
            }
          } catch (error) {
            console.warn('[tts] Native engine not ready', { attempt: attempt + 1, error: error.message });
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.error('[tts] No Android text-to-speech language is installed');
        return false;
      })().finally(() => {
        nativeTtsInitPromiseRef.current = null;
      });
    }
    return nativeTtsInitPromiseRef.current;
  }, [useNativeTextToSpeech]);
  const getZoomPercent = (value) => Math.max(0, Math.min(100, Math.round((Math.log(Math.max(MIN_ZOOM, value) / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM)) * 100)));
  // Debug: Log the PDF source
  useEffect(() => {
    console.log('🔍 SimpleScrollReader received PDF source', {
      sourceType: src?.startsWith('blob:') ? 'persistent-cache' : 'signed-url',
      hasSource: Boolean(src),
      cacheKey
    });
    loadingStartedAtRef.current = Date.now();
    if (!src) {
      console.warn('⚠️ No PDF source provided!');
    }
  }, [src]);

  const [numPages, setNumPages] = useState(null);
  const [documentSource, setDocumentSource] = useState(null);
  const [scale, setScale] = useState(DEFAULT_ZOOM);
  const [mobileScale, setMobileScale] = useState(DEFAULT_ZOOM); // Separate mobile zoom state
  const mobileScaleRef = useRef(DEFAULT_ZOOM);
  const loadingMessages = ['Loading book', 'Rendering pages', 'Opening book'];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const zoomTimeoutRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firstPageReady, setFirstPageReady] = useState(false);
  const hasRenderedFirstPageRef = useRef(false);
  const loadingStartedAtRef = useRef(Date.now());
  const [pdfError, setPdfError] = useState(!simpleReaderWorkerReady);
  const [showTOC, setShowTOC] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [audioCurrentPage, setAudioCurrentPage] = useState(1);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [pageTextMap, setPageTextMap] = useState({});
  const [sentenceMap, setSentenceMap] = useState([]);
  const pageTextMapRef = useRef({});
  const pdfDocumentRef = useRef(null);
  const textLoadPromiseRef = useRef(null);
  const isReaderMountedRef = useRef(true);

  useEffect(() => () => {
    isReaderMountedRef.current = false;
  }, []);
  const [isPaused, setIsPaused] = useState(false);
  const [audioPageIndex, setAudioPageIndex] = useState(1);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryPageNumber, setSummaryPageNumber] = useState(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [statisticsModalOpen, setStatisticsModalOpen] = useState(false);
  const [bookmarksPageOpen, setBookmarksPageOpen] = useState(false);
  const [notes, setNotes] = useState(new Map());
  const [readingStartTime, setReadingStartTime] = useState(new Date());
  const [totalReadingTime, setTotalReadingTime] = useState(0);
  const [mobileButtonsVisible, setMobileButtonsVisible] = useState(window.innerWidth > 768 ? true : false); // Show on desktop, hide on mobile by default

  useEffect(() => {
    if (useNativeTextToSpeech || !isAudioPlaying || !window.speechSynthesis) return undefined;

    const keepSpeechAlive = window.setInterval(() => {
      if (!isPlayingRef.current) return;
      if (window.speechSynthesis.paused) {
        console.log('[tts] Resuming paused browser speech');
        window.speechSynthesis.resume();
      } else if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending && Date.now() - lastSpeechActivityRef.current > 1800) {
        console.warn('[tts] Speech engine stalled; restarting current page');
        window.speechSynthesis.cancel();
        lastSpeechActivityRef.current = Date.now();
        playPageAudioRef.current?.();
      }
    }, 4000);

    return () => window.clearInterval(keepSpeechAlive);
  }, [isAudioPlaying, useNativeTextToSpeech]);

  // Use perfect WPS-grade selection with uniform styling support (all colors/styles)
  const { selection, position, clearSelection, isSelecting, lensData, bounds } = useWPSPrecisionSelectionPerfect('.simple-scroll-reader');
  const containerRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const contentAreaRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(null);
  const pageRefsMap = useRef({});
  const zoomIndicatorRef = useRef(null);
  const scaleRef = useRef(1.0);
  const audioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const playPageAudioRef = useRef(null);
  const lastSpeechActivityRef = useRef(0);
  const speechRetryCountRef = useRef(0);
  const currentPageAudioRef = useRef(1);
  const pausedPageRef = useRef(null);
  const pausedSentenceIndexRef = useRef(0);
  
  // Edge optimization: Scroll tracking
  const lastScrollTimeRef = useRef(0);
  const scrollRAFRef = useRef(null);
  
  // Virtual scrolling: only render visible pages + buffer
  const [visiblePages, setVisiblePages] = useState(new Set());
  const RENDER_BUFFER = 1; // Render 1 page above/below viewport (aggressive)
  const [shouldRenderTextLayer, setShouldRenderTextLayer] = useState(false); // Delay text layer rendering

  // Check if PDF source is available
  const hasPdfSource = !!src;

  useEffect(() => {
    let active = true;
    setDocumentSource(null);
    pdfDocumentRef.current = null;
    getPersistentPdfSource(cacheKey, src).then(cachedSource => {
      if (active) setDocumentSource(cachedSource);
    });
    return () => {
      active = false;
    };
  }, [cacheKey, src]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return undefined;

    const updatePageWidth = () => {
      setPageWidth(Math.max(1, scrollArea.clientWidth - 24));
    };

    updatePageWidth();
    const resizeObserver = new ResizeObserver(updatePageWidth);
    resizeObserver.observe(scrollArea);
    return () => resizeObserver.disconnect();
  }, []);

  // Debug: Monitor selection state
  useEffect(() => {
    if (selection) {
      console.log('📲 SimpleScrollReader - Selection state updated:', { selection, position });
    }
  }, [selection, position]);
  const handleDocumentLoad = (pdfDocument) => {
    const nextNumPages = pdfDocument?.numPages || 0;
    pdfDocumentRef.current = pdfDocument;
    setNumPages(nextNumPages);
    setLoadingMessageIndex(1);
    // Prioritize the first page; adjacent pages are added after it is visible.
    const initialVisiblePages = new Set();
    initialVisiblePages.add(1);
    setVisiblePages(initialVisiblePages);
  };

  const handleFirstPageRender = () => {
    if (hasRenderedFirstPageRef.current) return;

    hasRenderedFirstPageRef.current = true;
    console.log('[pdf-load] First page rendered', {
      durationMs: Date.now() - loadingStartedAtRef.current,
      title
    });
    setFirstPageReady(true);
    setLoadingMessageIndex(2);
    setIsLoading(false);

    const revealAdjacentPages = () => {
      setVisiblePages((currentPages) => {
        const nextPages = new Set(currentPages);
        for (let page = 2; page <= Math.min(3, numPages); page++) {
          nextPages.add(page);
        }
        return nextPages;
      });
      setShouldRenderTextLayer(true);
    };

    const isMobileViewport = isMobileDevice || window.innerWidth <= 768;
    if (isMobileViewport) {
      setTimeout(revealAdjacentPages, 250);
    } else {
      requestAnimationFrame(revealAdjacentPages);
    }
  };

  // Track reading time - reduced to 5s interval to prevent excessive re-renders (88% reduction)
  useEffect(() => {
    const timer = setInterval(() => {
      setTotalReadingTime(prev => prev + 5); // Increment by 5 seconds
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // Add or update note for current page
  // Get note for current page
  const getCurrentPageNote = () => {
    return notes.get(currentPage);
  };

  // Get reading statistics
  const getStatistics = () => {
    const timeInMinutes = Math.floor(totalReadingTime / 60);
    const readPercentage = numPages ? Math.floor((currentPage / numPages) * 100) : 0;
    
    return {
      totalPages: numPages || 0,
      currentPage: currentPage,
      bookmarkedPages: getBookmarkedPages().length,
      notes: notes.size,
      readingTime: timeInMinutes,
      readPercentage: readPercentage,
      pagesPerMinute: timeInMinutes > 0 ? (currentPage / timeInMinutes).toFixed(2) : 0
    };
  };

  const zoomIn = useCallback(() => {
    requestAnimationFrame(() => {
      setScale(s => Math.min(MAX_ZOOM, s * 1.1));
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
    setMobileScale(s => Math.min(MAX_ZOOM, s * 1.1));
  }, []);

  const mobileZoomOut = useCallback(() => {
    setMobileScale(s => Math.max(0.25, s - 0.1));
  }, []);

  const mobileResetZoom = useCallback(() => {
    setMobileScale(1.0);
  }, []);

  const mobileSetZoom = useCallback((nextScale) => {
    setMobileScale(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale)));
  }, []);

  useEffect(() => {
    mobileScaleRef.current = mobileScale;
  }, [mobileScale]);

  const previewMobileZoom = useCallback((nextScale, finalScale) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    if (nextScale === null) {
      scrollArea.style.removeProperty('--pinch-ratio');
      scrollArea.classList.remove('pinch-preview');
      if (zoomIndicatorRef.current) {
        zoomIndicatorRef.current.textContent = `${getZoomPercent(finalScale || mobileScaleRef.current || DEFAULT_ZOOM)}%`;
      }
      return;
    }
    const baseScale = mobileScaleRef.current || DEFAULT_ZOOM;
    scrollArea.style.setProperty('--pinch-ratio', String(nextScale / baseScale));
    scrollArea.classList.add('pinch-preview');
    if (zoomIndicatorRef.current) {
      zoomIndicatorRef.current.textContent = `${getZoomPercent(nextScale)}%`;
    }
  }, []);

  // Initialize mobile zoom gestures hook - defined after zoom functions
  const { isMobileDevice } = useMobileZoomGestures(
    scrollAreaRef,
    mobileZoomIn,
    mobileZoomOut,
    mobileResetZoom,
    mobileSetZoom,
    mobileScale,
    previewMobileZoom
  );
  const effectiveScale = isMobileDevice ? mobileScale : scale;

  // --- Zoom stability & clarity fix ------------------------------------------------
  // (1) devicePixelRatio must only reflect the SCREEN's real pixel density. It was
  //     previously multiplied by the zoom factor on top of `width` (below) already
  //     being scaled by the same factor, so the canvas react-pdf had to draw grew
  //     with the SQUARE of the zoom level (up to ~16x the base pixel count at max
  //     zoom on mobile). That runaway pixel count is what caused stutter, flashes,
  //     and occasional blank/black pages while pinch-zooming on phones. Capping it
  //     to the device's actual pixel ratio keeps every render well within what the
  //     device can comfortably rasterize, without any visible loss of sharpness
  //     (you never see more detail than the screen can show anyway).
  const baseDevicePixelRatio = window.devicePixelRatio || 1;
  const pdfDevicePixelRatio = Math.min(baseDevicePixelRatio, isMobileDevice ? 2 : 3);

  // (2) The PDF canvas was being re-rendered (and, via a `key` containing a
  //     3-decimal scale value, fully REMOUNTED) on every single micro-change of
  //     the live pinch/zoom value. That's the other half of the instability -
  //     dozens of expensive canvas teardown/redraw cycles per second during a
  //     gesture. `committedScale` only updates once zooming has paused briefly,
  //     and is snapped to 5% steps, so the heavy PDF re-render happens a handful
  //     of times per zoom instead of on every frame. The live `effectiveScale`
  //     keeps driving ZoomClarity's instant CSS-based zoom feedback below, so
  //     the zoom still feels immediate - only the expensive redraw is throttled.
  //     The final, settled width/resolution is identical to before, so image
  //     sharpness once you stop zooming is unchanged.
  const [committedScale, setCommittedScale] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    const quantized = Math.round(effectiveScale * 20) / 20; // nearest 5%
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(() => {
      setCommittedScale(quantized);
    }, isMobileDevice ? 180 : 60);
    return () => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, [effectiveScale, isMobileDevice]);

  // Bridge the short gap between a live zoom change (effectiveScale, updated
  // as soon as a gesture/button commits) and the debounced value that
  // actually drives the PDF canvas resolution (committedScale, above). The
  // live pinch preview (previewMobileZoom/--pinch-ratio) already handles the
  // moment-to-moment finger tracking and clears itself the instant a gesture
  // ends - at that exact instant this takes over with the same effective
  // ratio (effectiveScale / committedScale), so there is no visible "snap"
  // while waiting for the sharper canvas to finish drawing. Once the canvas
  // catches up this resolves to 1x and removes itself.
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    const ratio = committedScale > 0 ? effectiveScale / committedScale : 1;
    if (Math.abs(ratio - 1) < 0.005) {
      scrollArea.style.removeProperty('--zoom-correction');
      scrollArea.classList.remove('zoom-correcting');
    } else {
      scrollArea.style.setProperty('--zoom-correction', String(ratio));
      scrollArea.classList.add('zoom-correcting');
    }
  }, [effectiveScale, committedScale]);

  // Pan gesture hook for zoomed content - allows swiping to see full content when zoomed
  // Ultra-optimized scroll handler with virtual rendering - tracks current page and visible pages
  useEffect(() => {
    const handleScroll = () => {
      // Skip scroll updates during document loading to prevent flickering
      if (isLoading) return;
      
      const now = performance.now();
      
      // Skip if recent scroll update (batch updates)
      if (now - lastScrollTimeRef.current < 16) return;
      lastScrollTimeRef.current = now;
      
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      
      scrollRAFRef.current = requestAnimationFrame(() => {
        if (!scrollAreaRef.current || !numPages || isLoading) return;
        
        const scrollTop = scrollAreaRef.current.scrollTop;
        const containerHeight = scrollAreaRef.current.clientHeight;
        let currentPageFound = false;
        const newVisiblePages = new Set();

        // Find current page and visible pages for virtual rendering
        for (let page = 1; page <= numPages; page++) {
          const pageElement = pageRefsMap.current[page];
          if (!pageElement) continue;
          
          const rect = pageElement.getBoundingClientRect();
          const elementTop = scrollTop + rect.top;
          const elementBottom = elementTop + rect.height;
          
          // Update current page only if in viewport center
          if (!currentPageFound && elementTop <= scrollTop + containerHeight / 2 && elementBottom >= scrollTop + containerHeight / 2) {
            setCurrentPage(previousPage => previousPage === page ? previousPage : page);
            currentPageFound = true;
          }
          
          // Mark pages as visible if they're in viewport + buffer
          const bufferHeight = containerHeight * RENDER_BUFFER;
          if (elementBottom >= scrollTop - bufferHeight && elementTop <= scrollTop + containerHeight + bufferHeight) {
            newVisiblePages.add(page);
          }
        }
        
        // Keep pages mounted after first render to prevent flashing while scrolling.
        setVisiblePages(prev => {
          const nextPages = new Set(prev);
          newVisiblePages.forEach(page => nextPages.add(page));
          if (nextPages.size === prev.size) {
            return prev;
          }
          return nextPages;
        });
      });
    };

    const scrollArea = scrollAreaRef.current;
    if (scrollArea && !isLoading) {
      scrollArea.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (scrollArea) {
        scrollArea.removeEventListener('scroll', handleScroll);
      }
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, [numPages, isLoading]);



  // Handle keyboard shortcuts - MS Edge style zooming
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          e.stopPropagation();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          e.stopPropagation();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          e.stopPropagation();
          resetZoom();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [zoomIn, zoomOut, resetZoom]);

  // Handle mouse wheel zooming - MS Edge style (Ctrl + scroll)
  useEffect(() => {
    const handleWheel = (e) => {
      if ((e.ctrlKey || e.metaKey) && scrollAreaRef.current && e.target.closest('.ssr-container')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Zoom in on scroll up, out on scroll down
        if (e.deltaY < 0) {
          zoomIn();
        } else if (e.deltaY > 0) {
          zoomOut();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheel, { capture: true });
  }, [zoomIn, zoomOut]);

  // Jump to page
  const jumpToPage = (page) => {
    const pageElement = pageRefsMap.current[page];
    if (pageElement && scrollAreaRef.current) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(page);
    }
  };

  // Toggle bookmark for a page
  const toggleBookmark = (page) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(page)) {
        newBookmarks.delete(page);
      } else {
        newBookmarks.add(page);
      }
      return newBookmarks;
    });
  };

  // Get sorted bookmarked pages
  const getBookmarkedPages = () => {
    return Array.from(bookmarks).sort((a, b) => a - b);
  };



  // Open summary modal for a page
  const openSummary = (pageNumber) => {
    setSummaryPageNumber(pageNumber);
    setSummaryModalOpen(true);
  };

  // Open download modal
  const openDownloadModal = () => {
    if (getBookmarkedPages().length === 0) {
      alert('No bookmarked pages to export');
      return;
    }
    setDownloadModalOpen(true);
  };

  // Export bookmarked pages as PDF
  const exportBookmarkedPagesPDF = useCallback(async () => {
    if (getBookmarkedPages().length === 0) {
      alert('No bookmarked pages to export');
      return;
    }

    try {
      const pdfDoc = await PDFDocument.load(await fetch(src).then(res => res.arrayBuffer()));
      const bookmarkedPageIndices = getBookmarkedPages().map(p => p - 1); // Convert to 0-indexed
      
      const newPdf = await PDFDocument.create();
      
      for (const pageIndex of bookmarkedPageIndices) {
        if (pageIndex < pdfDoc.getPageCount()) {
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
          newPdf.addPage(copiedPage);
        }
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, `${title}-bookmarked-pages.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export bookmarked pages');
    }
  }, [bookmarks, src, title]);

  // Export summary as Word document
  const exportSummaryAsWord = useCallback(async () => {
    if (getBookmarkedPages().length === 0) {
      alert('No bookmarked pages to export');
      return;
    }

    try {
      await generateSummaryDocument(pageTextMap, getBookmarkedPages(), title);
    } catch (error) {
      console.error('Error exporting summary:', error);
      alert('Failed to export summary');
    }
  }, [bookmarks, src, title]);

  // Play audio for current page - page by page reading
  const loadTextPage = useCallback(async (pageNum) => {
    const pdfDoc = pdfDocumentRef.current;
    if (!pdfDoc || pageTextMapRef.current[pageNum]) return pageTextMapRef.current[pageNum];

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageData = {
      text: textContent.items.map(item => item.str).join(' '),
      pageNum
    };
    pageTextMapRef.current[pageNum] = pageData;
    setPageTextMap(current => ({ ...current, [pageNum]: pageData }));
    return pageData;
  }, []);

  const playPageAudio = useCallback(() => {
    if (!useNativeTextToSpeech && (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined')) {
      setIsAudioPlaying(false);
      setIsPaused(false);
      return;
    }

    // Check if we've reached the end
    if (currentPageAudioRef.current > numPages) {
      setIsAudioPlaying(false);
      setAudioPageIndex(1);
      currentPageAudioRef.current = 1;
      isPlayingRef.current = false;
      return;
    }

    const pageNum = currentPageAudioRef.current;
    setAudioPageIndex(pageNum);

    // Get text for current page
    const pageData = pageTextMapRef.current[pageNum];
    if (!pageData || !pageData.text) {
      loadTextPage(pageNum).then(loadedPage => {
        if (!isPlayingRef.current) return;
        if (loadedPage?.text?.trim()) {
          playPageAudio();
        } else {
          currentPageAudioRef.current += 1;
          playPageAudio();
        }
      }).catch(error => {
        console.error('[tts] Page text extraction failed', { page: pageNum, error: error.message });
        currentPageAudioRef.current += 1;
        if (isPlayingRef.current) playPageAudio();
      });
      return;
    }

    // Extract sentences from this page for natural reading
    const pageText = pageData.text;
    const sentences = pageText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    if (sentences.length === 0) {
      // Page has no readable content, skip to next
      currentPageAudioRef.current += 1;
      setTimeout(() => {
        if (isPlayingRef.current) {
          playPageAudio();
        }
      }, 300);
      return;
    }

    // Scroll to current page
    const pageElement = pageRefsMap.current[pageNum];
    if (pageElement && scrollAreaRef.current) {
      scrollAreaRef.current.scrollIntoView = true;
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }

    // Read all sentences on this page
    let sentenceIndex = 0;

    const readNextSentence = () => {
      if (sentenceIndex >= sentences.length) {
        // Page finished, move to next page
        currentPageAudioRef.current += 1;
        setTimeout(() => {
          if (isPlayingRef.current) {
            playPageAudio();
          }
        }, 500); // Pause between pages
        return;
      }

      if (!isPlayingRef.current) {
        return; // Audio stopped
      }

      const sentence = sentences[sentenceIndex];
      const utterance = new SpeechSynthesisUtterance(sentence);
      lastSpeechActivityRef.current = Date.now();

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => /^en(-|_)/i.test(voice.lang)) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.lang = preferredVoice?.lang || 'en-US';
      utterance.pitch = 1;
      utterance.volume = 1;
      console.log('[tts] Browser sentence starting', {
        page: pageNum,
        sentenceLength: sentence.length,
        voice: preferredVoice?.name || null,
        language: preferredVoice?.lang || null,
        volume: utterance.volume
      });

      utterance.onend = () => {
        console.log('[tts] Browser sentence completed', { page: pageNum });
        lastSpeechActivityRef.current = Date.now();
        speechRetryCountRef.current = 0;
        sentenceIndex += 1;
        if (isPlayingRef.current) {
          // Natural pause between sentences
          setTimeout(readNextSentence, 350);
        }
      };

      utterance.onerror = () => {
        console.error('[tts] Browser speech synthesis error', {
          page: pageNum,
          speaking: window.speechSynthesis.speaking,
          paused: window.speechSynthesis.paused,
          pending: window.speechSynthesis.pending
        });
        if (isPlayingRef.current && speechRetryCountRef.current < 2) {
          speechRetryCountRef.current += 1;
          setTimeout(readNextSentence, 500);
          return;
        }
        setIsAudioPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
      };

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    };

    if (useNativeTextToSpeech) {
      let sentenceIndex = 0;
      const speakNextNativeSentence = () => {
        if (!isPlayingRef.current || sentenceIndex >= sentences.length) {
          if (isPlayingRef.current) {
            currentPageAudioRef.current += 1;
            playPageAudio();
          }
          return;
        }

        TextToSpeech.speak({
          text: sentences[sentenceIndex],
          lang: nativeTtsLanguageRef.current || 'en-US',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          queueStrategy: 0
        }).then(() => {
          console.log('[tts] Native sentence completed', { page: pageNum, sentenceLength: sentences[sentenceIndex].length });
          sentenceIndex += 1;
          setTimeout(speakNextNativeSentence, 150);
        }).catch(error => {
          console.error('[tts] Native sentence failed', {
            page: pageNum,
            sentenceLength: sentences[sentenceIndex].length,
            error: error.message || String(error)
          });
          setIsAudioPlaying(false);
          isPlayingRef.current = false;
        });
      };

      speakNextNativeSentence();
      return;
    }

    // Start reading sentences on this page
    readNextSentence();
  }, [loadTextPage, pageTextMap, numPages, useNativeTextToSpeech]);

  playPageAudioRef.current = playPageAudio;

  const ensureTextLoaded = useCallback(async () => {
    if (extractedText === 'PDF loaded' && Object.keys(pageTextMapRef.current).length > 0) return;
    if (!textLoadPromiseRef.current) {
      textLoadPromiseRef.current = (async () => {
        try {
          const textSource = documentSource || src;
          if (!isReaderMountedRef.current || (!textSource && !pdfDocumentRef.current)) return;

          const pdfDoc = pdfDocumentRef.current || await pdfjs.getDocument(textSource).promise;
          pdfDocumentRef.current = pdfDoc;
          const pageMapData = {};

          if (!isReaderMountedRef.current) return;
          const page = await pdfDoc.getPage(1);
          const textContent = await page.getTextContent();
          pageMapData[1] = {
            text: textContent.items.map(item => item.str).join(' '),
            pageNum: 1
          };

          if (!isReaderMountedRef.current) return;
          pageTextMapRef.current = pageMapData;
          setPageTextMap(pageMapData);
          setExtractedText('PDF loaded');
        } catch (error) {
          if (!isReaderMountedRef.current) return;
          console.error('Error extracting text from PDF:', error);
          setPageTextMap({});
          pageTextMapRef.current = {};
          setExtractedText('');
          textLoadPromiseRef.current = null;
        }
      })();
    }
    await textLoadPromiseRef.current;
  }, [documentSource, extractedText, src]);

  // Toggle audio playback (play/pause)
  const toggleAudio = useCallback(async () => {
    console.log('[tts] Toggle requested', {
      native: useNativeTextToSpeech,
      isAudioPlaying,
      isPaused,
      hasExtractedText: Boolean(extractedText)
    });
    if (useNativeTextToSpeech) {
      const ready = await prepareNativeTextToSpeech();
      if (!ready) return;
      if (isAudioPlaying) {
        await TextToSpeech.stop();
        setIsAudioPlaying(false);
        isPlayingRef.current = false;
        return;
      }
    } else if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      console.warn('Text-to-speech is not available on this device');
      return;
    }

    if (isAudioPlaying) {
      // Pause audio - save position for resume
      window.speechSynthesis.pause();
      setIsAudioPlaying(false);
      setIsPaused(true);
      isPlayingRef.current = false;
      pausedPageRef.current = currentPageAudioRef.current;
    } else if (isPaused) {
      // Resume from pause - continue from saved position
      window.speechSynthesis.resume();
      setIsAudioPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
    } else {
      const ready = await prepareBrowserTextToSpeech();
      if (!ready) return;
      await ensureTextLoaded();
      const firstPageText = pageTextMapRef.current[1]?.text?.trim() || '';
      console.log('[tts] Text extraction ready', {
        pageCount: Object.keys(pageTextMapRef.current).length,
        firstPageCharacters: firstPageText.length
      });
      if (!firstPageText) {
        console.error('[tts] PDF contains no extractable text');
        setIsAudioPlaying(false);
        isPlayingRef.current = false;
        return;
      }
      // Start fresh from page 1
      if (!useNativeTextToSpeech) window.speechSynthesis.cancel();
      currentPageAudioRef.current = 1;
      pausedPageRef.current = null;
      pausedSentenceIndexRef.current = 0;
      
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
      }

      setAudioPageIndex(1);
      isPlayingRef.current = true;
      setIsAudioPlaying(true);
      setIsPaused(false);
      setAudioProgress(0);
      playPageAudio();
    }
  }, [ensureTextLoaded, isAudioPlaying, isPaused, playPageAudio, prepareBrowserTextToSpeech, prepareNativeTextToSpeech, useNativeTextToSpeech]);

  // Stop audio completely and reset
  const stopAudio = useCallback(() => {
    if (useNativeTextToSpeech) {
      TextToSpeech.stop().catch(() => {});
    }
    window.speechSynthesis?.cancel?.();
    setIsAudioPlaying(false);
    setIsPaused(false);
    setAudioProgress(0);
    setAudioPageIndex(1);
    currentPageAudioRef.current = 1;
    pausedPageRef.current = null;
    pausedSentenceIndexRef.current = 0;
    isPlayingRef.current = false;
  }, [useNativeTextToSpeech]);

  // Copy selected text
  const copyText = async () => {
    if (selection && selection.text && selection.text.length > 0) {
      try {
        await navigator.clipboard.writeText(selection.text);
        console.log('✅ Text copied to clipboard');
        // Panel stays open with feedback animation
      } catch (err) {
        console.error('❌ Failed to copy:', err);
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = selection.text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          console.log('✅ Text copied via fallback');
        } catch (e) {
          console.error('❌ Fallback copy failed:', e);
        }
        document.body.removeChild(textarea);
      }
    }
  };

  // Add highlight for selected text
  const addHighlight = (color) => {
    if (!selection || !selection.text || selection.text.length === 0) return;

    try {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.rangeCount === 0) {
        console.warn('⚠️ No selection range');
        return;
      }

      const range = sel.getRangeAt(0);
      const highlightColor = getHighlightColor(color);
      
      // Clone the range to avoid mutating it
      const rangeCopy = range.cloneRange();
      
      // Get all text nodes in the range
      const textNodes = [];
      const walker = document.createTreeWalker(
        rangeCopy.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        // Check if node is within the range
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        
        // If ranges overlap, include the node
        if (rangeCopy.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 1 &&
            rangeCopy.compareBoundaryPoints(Range.START_TO_END, nodeRange) > -1) {
          textNodes.push(node);
        }
      }

      if (textNodes.length === 0) {
        console.warn('⚠️ No text nodes found in selection');
        return;
      }

      // Highlight each text node (handles multi-line selections)
      textNodes.forEach((textNode) => {
        const span = document.createElement('span');
        span.style.backgroundColor = highlightColor;
        span.style.opacity = '0.35';
        span.className = 'highlighted-text';
        
        // For each text node, wrap it or partial text if at boundaries
        const parent = textNode.parentNode;
        
        // Create a partial selection within this text node
        const nodeRange = document.createRange();
        
        if (textNode === rangeCopy.startContainer && textNode === rangeCopy.endContainer) {
          // Single node: partial selection
          const beforeText = textNode.nodeValue.substring(0, rangeCopy.startOffset);
          const selectedPart = textNode.nodeValue.substring(rangeCopy.startOffset, rangeCopy.endOffset);
          const afterText = textNode.nodeValue.substring(rangeCopy.endOffset);
          
          // Replace node with: before + span(selected) + after
          if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), textNode);
          }
          
          span.appendChild(document.createTextNode(selectedPart));
          parent.insertBefore(span, textNode);
          
          if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), textNode);
          }
          
          parent.removeChild(textNode);
        } else if (textNode === rangeCopy.startContainer) {
          // Start node: partial from startOffset to end
          const beforeText = textNode.nodeValue.substring(0, rangeCopy.startOffset);
          const selectedPart = textNode.nodeValue.substring(rangeCopy.startOffset);
          
          if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), textNode);
          }
          
          span.appendChild(document.createTextNode(selectedPart));
          parent.insertBefore(span, textNode);
          parent.removeChild(textNode);
        } else if (textNode === rangeCopy.endContainer) {
          // End node: partial from start to endOffset
          const selectedPart = textNode.nodeValue.substring(0, rangeCopy.endOffset);
          const afterText = textNode.nodeValue.substring(rangeCopy.endOffset);
          
          span.appendChild(document.createTextNode(selectedPart));
          parent.insertBefore(span, textNode);
          
          if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), textNode);
          }
          
          parent.removeChild(textNode);
        } else {
          // Middle node: wrap entire text
          span.appendChild(document.createTextNode(textNode.nodeValue));
          parent.insertBefore(span, textNode);
          parent.removeChild(textNode);
        }
      });

      console.log(`✨ Highlighted: "${selection.text.substring(0, 30)}..." in ${color}`);
      sel.removeAllRanges();
    } catch (err) {
      console.error('❌ Highlight failed:', err);
    }
  };

  // Helper to get highlight color hex value
  const getHighlightColor = (colorName) => {
    const colors = {
      yellow: '#FFFF00',
      green: '#00FF00',
      blue: '#0080FF',
      pink: '#FF0080',
      orange: '#FF3300'
    };
    return colors[colorName.toLowerCase()] || '#FFFF00';
  };

  return (
    <div className="ssr-overlay" style={{ pointerEvents: 'none' }}>
      <div className="ssr-container" onClick={e => e.stopPropagation()} style={{ pointerEvents: 'auto' }}>
        {/* Header with page indicator */}
        <div className="ssr-header">
          <div className="ssr-title-section">
            <h2 className="ssr-title">{title}</h2>
            {author && <p className="ssr-author">{author}</p>}
          </div>
          
          <div className="ssr-top-controls">
            {/* Audio progress indicator - show page reading */}
            {(isAudioPlaying || isPaused) && numPages && (
              <div className="ssr-audio-status" title={`Reading page ${audioPageIndex} of ${numPages}`}>
                <span className="ssr-audio-label">📖</span>
                <span className="ssr-audio-page">{audioPageIndex}</span>
                <span className="ssr-audio-sep">/</span>
                <span className="ssr-audio-total">{numPages}</span>
              </div>
            )}

            <div ref={zoomIndicatorRef} className="ssr-zoom-indicator" aria-live="polite" title="Current zoom">
              {getZoomPercent(isMobileDevice ? mobileScale : scale)}%
            </div>

            {/* Container for buttons that can be hidden/shown on mobile */}
            <div className={`ssr-mobile-controls-wrapper ${mobileButtonsVisible ? 'visible' : 'hidden'}`}>
            
            {/* Page indicator - hidden when panel is hidden */}
            {numPages && (
              <div className="ssr-page-indicator">
                <span className="ssr-page-num">{currentPage}</span>
                <span className="ssr-page-sep">/</span>
                <span className="ssr-page-total">{numPages}</span>
              </div>
            )}

            {/* Icon buttons only - no containers */}
            <button onClick={() => setShowTOC(!showTOC)} className="ssr-icon-btn ssr-toc-toggle" title="Toggle table of contents">
              <FiList size={18} />
            </button>

            {/* Bookmark current page button - toggles bookmark */}
            <button 
              onClick={() => toggleBookmark(currentPage)}
              className={`ssr-icon-btn ssr-bookmark-btn-desktop ${bookmarks.has(currentPage) ? 'active' : ''}`}
              title={bookmarks.has(currentPage) ? 'Remove bookmark' : 'Add bookmark'}
            >
              ⭐
            </button>

            {/* Mobile bookmark button with icon */}
            <button 
              onClick={() => toggleBookmark(currentPage)}
              className={`ssr-icon-btn ssr-bookmark-btn-mobile ${bookmarks.has(currentPage) ? 'active' : ''}`}
              title={bookmarks.has(currentPage) ? 'Remove bookmark' : 'Add bookmark'}
            >
              <FiBookmark size={18} fill={bookmarks.has(currentPage) ? 'currentColor' : 'none'} />
            </button>

            </div>

            {/* Voice control stays visible when the other toolbar controls are collapsed. */}
            <div className="ssr-audio-controls-group">
              {!isAudioPlaying && !isPaused && (
                <button type="button" onClick={(event) => { event.stopPropagation(); toggleAudio(); }} className="ssr-icon-btn" title="Play audio" aria-label="Play audio">
                  ▶️
                </button>
              )}
              {isAudioPlaying && (
                <button type="button" onClick={(event) => { event.stopPropagation(); toggleAudio(); }} className="ssr-icon-btn active" title="Pause audio" aria-label="Pause audio">
                  ⏸️
                </button>
              )}
              {isPaused && (
                <button type="button" onClick={(event) => { event.stopPropagation(); toggleAudio(); }} className="ssr-icon-btn" title="Resume audio" aria-label="Resume audio">
                  ▶️
                </button>
              )}
              {(isAudioPlaying || isPaused) && (
                <button type="button" onClick={(event) => { event.stopPropagation(); stopAudio(); }} className="ssr-icon-btn" title="Stop audio" aria-label="Stop audio">
                  ⏹️
                </button>
              )}
            </div>
          </div>

          {/* Mobile button toggle - show/hide all buttons */}
          <button 
            onClick={() => setMobileButtonsVisible(!mobileButtonsVisible)} 
            className={`ssr-icon-btn ssr-mobile-toggle ${!mobileButtonsVisible ? 'hidden' : ''}`}
            title="Toggle controls visibility"
          >
            ⋮
          </button>

          {/* Close button - positioned at top right corner */}
          <button onClick={onClose} className="ssr-close-corner-btn" title="Close (Esc)">
            <FiX size={18} />
          </button>
        </div>

        {/* Main content area with TOC sidebar */}
        <div className="ssr-main-content">
          {/* Table of Contents Sidebar - Toggleable like Edge */}
          {showTOC && (
            <div className="ssr-toc-sidebar">
              <div className="ssr-toc-header">
                <h3>Pages</h3>
              </div>

              {/* Bookmarks section */}
              {getBookmarkedPages().length > 0 && (
                <div className="ssr-bookmarks-section ssr-bookmarks-mobile">
                  <div className="ssr-bookmarks-title">
                    <span>⭐ Bookmarks</span>
                    <button 
                      onClick={openDownloadModal} 
                      className="ssr-bookmark-export-btn"
                      title="Download bookmarked pages"
                    >
                      <FiDownload size={14} />
                    </button>
                  </div>
                  <div className="ssr-bookmarks-list">
                    {getBookmarkedPages().map((page) => (
                      <div
                        key={`bookmark-${page}`}
                        className={`ssr-bookmark-item ${currentPage === page ? 'active' : ''}`}
                        onClick={() => jumpToPage(page)}
                      >
                        <span className="ssr-bookmark-page">⭐ {page}</span>
                        <div className="ssr-bookmark-spacer"></div>
                        <div className="ssr-bookmark-actions">
                          <button
                            className="ssr-bookmark-summary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSummary(page);
                            }}
                            title="View summary"
                          >
                            📋
                          </button>
                          <button
                            className="ssr-bookmark-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(page);
                            }}
                            title="Remove bookmark"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="ssr-toc-list">
                {numPages && Array.from({ length: numPages }, (_, idx) => idx + 1).map((page) => (
                  <div
                    key={page}
                    className={`ssr-toc-item ${currentPage === page ? 'active' : ''}`}
                    onClick={() => jumpToPage(page)}
                  >
                    <span className="ssr-toc-page">{page}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scroll area - continuous pages */}
          <div className={`ssr-scroll-area simple-scroll-reader ${isMobileDevice && mobileScale > DEFAULT_ZOOM ? 'mobile-zoom-active' : ''}`} ref={(el) => {
            scrollAreaRef.current = el;
            contentAreaRef.current = el;
          }}>
            {isLoading && (
              <div className="ssr-loading simple-reader-loader" role="status" aria-live="polite">
                <div className="simple-reader-loader__indicator" aria-hidden="true">
                  <img
                    src={loadingSvg}
                    alt=""
                    className="simple-reader-loader__svg"
                  />
                </div>
                <p key={loadingMessages[loadingMessageIndex]} className="simple-reader-loader__message">
                  {loadingMessages[loadingMessageIndex]}
                </p>
                <div
                  className="simple-reader-loader__progress"
                  style={{ '--loader-progress': `${((loadingMessageIndex + 1) / loadingMessages.length) * 100}%` }}
                  aria-hidden="true"
                />
              </div>
            )}

            {!hasPdfSource && !isLoading ? (
              <div className="ssr-error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '600px', gap: '20px', textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '48px' }}>📄</div>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>PDF File Not Available</h2>
                <p style={{ margin: '0', color: '#9ca3af' }}>The PDF file could not be loaded. Please try another book or contact support.</p>
                {sampleText && (
                  <div style={{ marginTop: '20px', maxHeight: '400px', overflowY: 'auto', width: '100%', textAlign: 'left' }}>
                    <p style={{ color: '#9ca3af', fontSize: '12px' }}>Preview from book description:</p>
                    {sampleText.split('\n').slice(0, 100).map((line, idx) => (
                      <p key={idx} style={{ margin: '4px 0', color: '#d1d5db', lineHeight: 1.4, fontSize: '13px' }}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {hasPdfSource && documentSource && (
              <div
                style={isMobileDevice ? {
                  width: '100%',
                  willChange: 'contents',
                  height: 'auto',
                  display: 'block',
                  pointerEvents: 'auto',
                  backfaceVisibility: 'hidden',
                  overflow: 'visible'
                } : {}}
              >
                <Document
                  file={documentSource}
                  onLoadSuccess={handleDocumentLoad}
                  onError={(error) => {
                    console.error('PDF loading error in SimpleScrollReader:', error?.message || error);
                    setPdfError(true);
                  }}
                  loading={null}
                  error={
                    <div className="ssr-error">
                      {pdfError 
                        ? '❌ Failed to load PDF. The file may be corrupted or inaccessible. Please refresh and try again.'
                        : 'Failed to load PDF. The file may be corrupted or inaccessible.'}
                    </div>
                  }
                >
                  {/* Keep a bounded render window so large PDFs do not exhaust Android memory. */}
                  <ZoomClarity
                    scale={effectiveScale}
                    defaultScale={DEFAULT_ZOOM}
                  >
                    <div className="ssr-document">
                    {numPages && Array.from({ length: numPages }, (_, idx) => {
                      const pageNum = idx + 1;
                      const isVisible = visiblePages.has(pageNum);
                      const isCurrentPage = pageNum === currentPage;
                      const enableTextLayer = shouldRenderTextLayer && (isCurrentPage || Math.abs(pageNum - currentPage) === 1);

                      if (!isVisible) {
                        return (
                          <div
                            key={pageNum}
                            className="ssr-page ssr-page-placeholder"
                            ref={(el) => {
                              if (el) pageRefsMap.current[pageNum] = el;
                            }}
                            style={{ minHeight: '800px' }}
                            aria-hidden="true"
                          />
                        );
                      }

                      return (
                        <div
                          key={pageNum}
                          className="ssr-page"
                          ref={(el) => {
                            if (el) pageRefsMap.current[pageNum] = el;
                          }}
                        >
                          <Page
                              // Coarse (5%-step), debounced key: the canvas only remounts a
                              // handful of times per zoom gesture instead of on every frame,
                              // which is what made pinch-zooming feel unstable before.
                              key={`${pageNum}-${committedScale.toFixed(2)}`}
                              pageNumber={pageNum}
                              width={pageWidth ? pageWidth * (committedScale / MIN_ZOOM) : undefined}
                              devicePixelRatio={pdfDevicePixelRatio}
                              renderTextLayer={enableTextLayer}
                              renderAnnotationLayer={false}
                              loading=""
                              onRenderError={(error) => {
                                console.warn('PDF page render error:', error?.message || error);
                                setPdfError(true);
                              }}
                              onRenderSuccess={pageNum === 1 ? handleFirstPageRender : undefined}
                            />
                        </div>
                      );
                    })}
                    </div>
                  </ZoomClarity>
                </Document>
              </div>
            )}
            {!hasPdfSource && (
              <div className="ssr-error">
                ❌ No PDF source provided. The file location may be invalid.
              </div>
            )}
          </div>
        </div>

        {/* Floating View Bookmarks Button - Mobile Only, Shows only when bookmarks exist */}
        {getBookmarkedPages().length > 0 && (
          <button
            onClick={() => setBookmarksPageOpen(true)}
            className="ssr-floating-bookmarks-btn"
            title="View all bookmarks"
          >
            <FiBookmark size={24} />
            <span className="ssr-bookmarks-badge">{getBookmarkedPages().length}</span>
          </button>
        )}

        {/* Summary Modal */}
        <SummaryModal
          isOpen={summaryModalOpen}
          pageNumber={summaryPageNumber}
          pageText={summaryPageNumber ? pageTextMap[summaryPageNumber]?.text : ''}
          title={title}
          onClose={() => setSummaryModalOpen(false)}
        />

        {/* Download Modal */}
        <DownloadModal
          isOpen={downloadModalOpen}
          onClose={() => setDownloadModalOpen(false)}
          onDownloadPDF={exportBookmarkedPagesPDF}
          onDownloadSummary={exportSummaryAsWord}
          bookmarkCount={getBookmarkedPages().length}
        />

        {/* Statistics Modal */}
        <StatisticsModal
          isOpen={statisticsModalOpen}
          statistics={getStatistics()}
          onClose={() => setStatisticsModalOpen(false)}
        />

        {/* Bookmarks Page/Modal for Mobile */}
        {bookmarksPageOpen && (
          <div className="ssr-bookmarks-page-overlay">
            <div className="ssr-bookmarks-page">
              <div className="ssr-bookmarks-page-header">
                <div className="ssr-bookmarks-page-header-content">
                  <h2>⭐ My Bookmarks</h2>
                  <span className="ssr-bookmarks-page-count">{getBookmarkedPages().length} marked page{getBookmarkedPages().length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => setBookmarksPageOpen(false)}
                  className="ssr-bookmarks-page-close"
                  title="Close bookmarks"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="ssr-bookmarks-page-content">
                {getBookmarkedPages().length > 0 ? (
                  <div className="ssr-bookmarks-page-list">
                    {getBookmarkedPages().map((page, index) => (
                      <div
                        key={`bookmark-page-${page}`}
                        className={`ssr-bookmarks-page-item ${currentPage === page ? 'active' : ''} ${notes.get(page) ? 'has-note' : ''}`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div 
                          className="ssr-bookmarks-page-item-left"
                          onClick={() => {
                            jumpToPage(page);
                            setBookmarksPageOpen(false);
                          }}
                        >
                          <div className="ssr-bookmarks-page-item-number-box">
                            <span className="ssr-bookmarks-page-item-number">{page}</span>
                            {notes.get(page) && (
                              <span className="ssr-bookmarks-page-item-note-tick">✓</span>
                            )}
                          </div>
                          <div className="ssr-bookmarks-page-item-details">
                            <div className="ssr-bookmarks-page-item-title">Page {page}</div>
                            {notes.get(page) && (
                              <div className="ssr-bookmarks-page-item-note-preview">
                                <span className="ssr-bookmarks-page-item-note-icon">📝</span>
                                {notes.get(page).text ? notes.get(page).text.substring(0, 50) : notes.get(page).substring(0, 50)}
                              </div>
                            )}
                          </div>
                          {currentPage === page && <span className="ssr-bookmarks-page-item-reading">Reading</span>}
                        </div>
                        <div className="ssr-bookmarks-page-item-actions">
                          <button
                            className="ssr-bookmarks-page-action-btn ssr-bookmarks-page-summary-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSummary(page);
                            }}
                            title="View summary"
                          >
                            📋
                          </button>
                          <button
                            className="ssr-bookmarks-page-action-btn ssr-bookmarks-page-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(page);
                            }}
                            title="Remove bookmark"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ssr-bookmarks-page-empty">
                    <div className="ssr-bookmarks-page-empty-icon">⭐</div>
                    <p>No bookmarks yet</p>
                    <small>Mark pages while reading to keep track</small>
                  </div>
                )}
              </div>

              {getBookmarkedPages().length > 0 && (
                <div className="ssr-bookmarks-page-footer">
                  <button
                    onClick={openDownloadModal}
                    className="ssr-bookmarks-page-download-btn"
                    title="Download bookmarked pages"
                  >
                    <FiDownload size={16} /> Download All ({getBookmarkedPages().length})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* High-precision Text Selection Panel */}
      {selection && position && (
        <TextSelectionPanel
          position={position}
          selectedText={selection.text}
          onCopy={copyText}
          onHighlight={addHighlight}
          onClose={clearSelection}
          summaryModalOpen={summaryModalOpen}
        />
      )}

      {/* Mobile Zoom Controls - Only visible on mobile (≤ 768px) */}
      {/* Mobile Zoom Controls moved to header */}
    </div>
  );
};

export default SimpleScrollReader;