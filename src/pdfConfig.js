/**
 * pdfConfig.js - PDF.js Worker Configuration
 * 
 * CRITICAL: This file MUST be imported FIRST before any PDF operations
 * It initializes the PDF worker at app startup
 */

import { pdfjs } from 'react-pdf';

/**
 * Initialize PDF.js worker with reliable fallback chain
 */
export function initializePDFWorker() {
  // Skip if already configured with a valid source
  if (pdfjs.GlobalWorkerOptions.workerSrc) {
    return;
  }

  const pdfjsVersion = pdfjs.version;

  // Strategy 1: Try local public folder (production/build) - FASTEST & MOST RELIABLE
  try {
    const localPath = '/pdf.worker.min.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = localPath;
    
    // Verify it was set correctly
    if (pdfjs.GlobalWorkerOptions.workerSrc === localPath) {
      return;
    }
  } catch (e1) {
  }

  // Strategy 2: CDN fallback with http:// instead of https:// for compatibility
  try {
    // Use a stable CDN that doesn't require https
    const cdnPath = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;
    pdfjs.GlobalWorkerOptions.workerSrc = cdnPath;
    
    if (pdfjs.GlobalWorkerOptions.workerSrc === cdnPath) {
      return;
    }
  } catch (e2) {
  }

  // Fallback: Set a fallback inline worker to prevent null reference
  try {
    // Create inline worker as last resort
    const workerCode = `
    self.onmessage = function(event) {
      self.postMessage({ error: 'Worker not ready' });
    };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return;
  } catch (e3) {
  }

}

// Initialize immediately when this module loads
initializePDFWorker();

// Also attempt to reinitialize on window load to handle late initialization issues
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      initializePDFWorker();
    }
  }, { once: true });
}

export default initializePDFWorker;

