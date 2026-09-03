/**
 * useTextExtractionPrecision.js - TEXT EXTRACTION WITH ZERO SPILLAGE
 * Isolates selected text and prevents extraction of adjacent content
 * Works in conjunction with useWPSPrecisionSelection
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useTextExtractionPrecision = (selection, containerSelector = '.simple-scroll-reader') => {
  const [extractedData, setExtractedData] = useState(null);
  const [extractionMetadata, setExtractionMetadata] = useState(null);

  /**
   * ISOLATION: Extract ONLY the selected text
   * No adjacent words, no spillage, no context
   */
  const extractPureText = useCallback((range) => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;

      // Get the exact range content
      const fragment = range.cloneContents();
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(fragment);

      // Get text with all whitespace preserved initially
      let text = tempContainer.textContent;

      // Clean up: normalize whitespace but preserve intentional spacing
      text = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      return text;
    } catch (error) {
      console.error('❌ Text extraction error:', error);
      return null;
    }
  }, []);

  /**
   * METADATA: Extract selection metadata for quality assurance
   */
  const extractMetadata = useCallback((range, text, bounds) => {
    try {
      const rects = range.getClientRects();
      const lineCount = rects.length;

      // Calculate metrics
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
      const confidence = Math.min(100, Math.round((lineCount / 3) * 100)); // 3+ lines = 100%

      // Validate extraction quality
      const qualityChecks = {
        hasMinimumLength: text.length >= 2,
        hasReasonableLength: text.length <= 5000,
        hasWords: words.length >= 1,
        hasMultipleWords: words.length > 1,
        reasonableWordLength: avgWordLength > 1 && avgWordLength < 50,
        singleLineOrMultiple: lineCount === 1 || lineCount > 1,
        noControlChars: !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text),
        noExcessiveSpaces: text.match(/\s{3,}/g) === null
      };

      const qualityScore = Object.values(qualityChecks).filter(v => v).length / Object.keys(qualityChecks).length;

      return {
        textLength: text.length,
        wordCount: words.length,
        lineCount: lineCount,
        avgWordLength: Math.round(avgWordLength * 100) / 100,
        confidence: confidence,
        qualityScore: Math.round(qualityScore * 100),
        qualityChecks: qualityChecks,
        bounds: bounds,
        timestamp: Date.now(),
        extractionMethod: 'PRECISE_WPS'
      };
    } catch (error) {
      console.error('❌ Metadata extraction error:', error);
      return null;
    }
  }, []);

  /**
   * VALIDATION: Ensure extracted text is high quality
   */
  const validateExtraction = useCallback((text, metadata) => {
    try {
      // Must pass minimum quality threshold
      if (metadata.qualityScore < 50) {
        console.warn('⚠️ EXTRACTION: Low quality score', metadata.qualityScore);
        return false;
      }

      // Must have valid text content
      if (!text || text.length === 0) {
        console.warn('⚠️ EXTRACTION: No text content');
        return false;
      }

      // Check for obvious problems
      if (metadata.qualityChecks.noControlChars === false) {
        console.warn('⚠️ EXTRACTION: Contains control characters');
        return false;
      }

      if (metadata.qualityChecks.noExcessiveSpaces === false) {
        console.warn('⚠️ EXTRACTION: Contains excessive spaces (spillage?)');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Extraction validation error:', error);
      return false;
    }
  }, []);

  /**
   * NORMALIZE: Clean text for storage/use
   */
  const normalizeText = useCallback((text) => {
    try {
      return text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1 ') // Ensure space after punctuation
        .replace(/\s+([.,!?])/g, '$1'); // Remove space before punctuation
    } catch (error) {
      console.error('❌ Text normalization error:', error);
      return text;
    }
  }, []);

  /**
   * EXTRACT: Main extraction logic
   */
  const performExtraction = useCallback(() => {
    if (!selection || !selection.range) {
      setExtractedData(null);
      setExtractionMetadata(null);
      return;
    }

    try {
      const text = extractPureText(selection.range);
      if (!text) {
        setExtractedData(null);
        setExtractionMetadata(null);
        return;
      }

      const metadata = extractMetadata(selection.range, text, selection.bounds);
      if (!metadata) {
        setExtractedData(null);
        setExtractionMetadata(null);
        return;
      }

      // Validate extraction
      if (!validateExtraction(text, metadata)) {
        console.warn('⚠️ EXTRACTION: Validation failed');
        setExtractedData(null);
        setExtractionMetadata(metadata); // Still return metadata for debugging
        return;
      }

      // Normalize and store
      const normalizedText = normalizeText(text);
      setExtractedData({
        text: normalizedText,
        originalText: text,
        length: normalizedText.length,
        wordCount: normalizedText.split(/\s+/).length,
        extractedAt: new Date().toISOString()
      });
      setExtractionMetadata(metadata);

      console.log('✅ EXTRACTION: Success', {
        text: normalizedText.substring(0, 100) + '...',
        metadata
      });
    } catch (error) {
      console.error('❌ Extraction process error:', error);
      setExtractedData(null);
      setExtractionMetadata(null);
    }
  }, [selection, extractPureText, extractMetadata, validateExtraction, normalizeText]);

  /**
   * COMPARE: Check if extracted text differs from original
   * (Detects spillage - if extraction changed, spillage occurred)
   */
  const hasSpillage = useCallback(() => {
    if (!selection) return false;
    
    const originalSelectedText = selection.text;
    const extractedText = extractedData?.text;

    if (!originalSelectedText || !extractedText) return false;

    // If lengths differ significantly, spillage likely
    const lengthDiff = Math.abs(originalSelectedText.length - extractedText.length);
    if (lengthDiff > 10) {
      console.warn('⚠️ SPILLAGE: Length mismatch', { original: originalSelectedText.length, extracted: extractedText.length });
      return true;
    }

    return false;
  }, [selection, extractedData]);

  /**
   * CLEAR: Reset extraction
   */
  const clearExtraction = useCallback(() => {
    setExtractedData(null);
    setExtractionMetadata(null);
  }, []);

  // Auto-extract when selection changes
  useEffect(() => {
    if (selection) {
      performExtraction();
    } else {
      clearExtraction();
    }
  }, [selection, performExtraction, clearExtraction]);

  return {
    extractedData,
    extractionMetadata,
    hasSpillage: hasSpillage(),
    performExtraction,
    clearExtraction,
    quality: extractionMetadata?.qualityScore || 0
  };
};

export default useTextExtractionPrecision;
