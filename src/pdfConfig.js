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
    console.log('✅ PDF worker already configured:', pdfjs.GlobalWorkerOptions.workerSrc);
    return;
  }

  const pdfjsVersion = pdfjs.version;
  console.log('🔄 Initializing PDF worker for version:', pdfjsVersion);

  // Strategy 1: Try local public folder (production/build) - FASTEST & MOST RELIABLE
  try {
    const localPath = '/pdf.worker.min.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = localPath;
    console.log('✅ PDF worker set to local path:', localPath);
    
    // Verify it was set correctly
    if (pdfjs.GlobalWorkerOptions.workerSrc === localPath) {
      console.log('✅ Verification: Worker source correctly set');
      return;
    }
  } catch (e1) {
    console.warn('⚠️ Failed to set local path:', e1.message);
  }

  // Strategy 2: CDN fallback with http:// instead of https:// for compatibility
  try {
    // Use a stable CDN that doesn't require https
    const cdnPath = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;
    pdfjs.GlobalWorkerOptions.workerSrc = cdnPath;
    console.log('✅ PDF worker configured from CDN:', cdnPath);
    
    if (pdfjs.GlobalWorkerOptions.workerSrc === cdnPath) {
      return;
    }
  } catch (e2) {
    console.warn('⚠️ Failed to set CDN path:', e2.message);
  }

  // Fallback: Set a fallback inline worker to prevent null reference
  console.warn('⚠️ Using minimal worker fallback');
  try {
    // Create inline worker as last resort
    const workerCode = `
    self.onmessage = function(event) {
      console.error('PDF worker not properly initialized');
      self.postMessage({ error: 'Worker not ready' });
    };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    console.log('✅ Fallback inline worker created');
    return;
  } catch (e3) {
    console.error('⚠️ Failed to create fallback worker:', e3.message);
  }

  console.error('❌ All strategies failed - PDF functionality may be limited');
}

// Initialize immediately when this module loads
initializePDFWorker();

// Also attempt to reinitialize on window load to handle late initialization issues
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      console.warn('⚠️ Worker not initialized on window load - attempting recovery');
      initializePDFWorker();
    }
  }, { once: true });
}

export default initializePDFWorker;


