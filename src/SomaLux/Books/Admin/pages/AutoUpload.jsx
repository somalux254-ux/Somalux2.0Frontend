import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUpload, FiFolder, FiRefreshCw, FiX, FiFile, FiBook, FiFileText, FiClock, FiPause, FiPlay } from 'react-icons/fi';
import { createBook, createBookSubmission, fetchCategories } from '../api';
import { getUniversitiesForDropdown, getFacultiesByUniversity, createPastPaper, createPastPaperSubmission, searchUnitFaculty, clearPastPapersCache, checkDuplicatePastPaper, logUploadHistory, extractPastPaperMetadataBackend, extractFirstPageMetadata } from '../pastPapersApi';
import { findMatchingUniversity, findMatchingFaculty, guessFacultyFromUnitCode } from '../utils/extractPastPaperMetadata';
import * as pdfjsLib from 'pdfjs-dist';

// Books Auto Upload Component
const BooksAutoUploadContent = ({ userProfile, asSubmission, showToast }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadedCount, setUploadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [canResume, setCanResume] = useState(false);
  const [resumeState, setResumeState] = useState(null);
  const [isResumingUpload, setIsResumingUpload] = useState(false);
  const folderInputRef = useRef(null);
  const uploadAbortRef = useRef(false);
  const pauseRef = useRef(false);
  const resumeIndexRef = useRef(0);


  // Check if we have a paused upload in localStorage (for immediate UI rendering before state updates)
  const savedUploadState = (() => {
    try {
      const saved = localStorage.getItem('booksUploadState');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.fileNames && state.fileNames.length > 0 && (state.paused || state.uploading)) {
          return state;
        }
      }
    } catch (e) {
      console.error('⚡ [QUICK CHECK] Error checking localStorage:', e);
    }
    return null;
  })();

  useEffect(() => {
    // Configure PDF.js worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    fetchCategories().then(setCategories).catch(() => setCategories([]));
    
    // Check for incomplete uploads
    checkForIncompleteUpload();
  }, []);

  const checkForIncompleteUpload = () => {
    
    const savedState = localStorage.getItem('booksUploadState');
    
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        
        // Check if upload was incomplete (paused or in progress)
        if (state.fileNames && state.fileNames.length > 0 && (state.paused || state.uploading)) {
          
          // RESTORE UI STATE FROM SAVED STATE
          setUploadProgress({ current: state.currentIndex + 1, total: state.total });
          setUploadedCount(state.uploaded);
          setFailedCount(state.failed);
          setDuplicatesCount(state.duplicates || 0);
          setUploading(true);  // ← SET THIS TO SHOW PROGRESS BAR AND PAUSE/RESUME BUTTONS
          
          // CRITICAL: If the upload was paused, set the pause ref so it stays paused on resume
          if (state.paused) {
            pauseRef.current = true;
            setPaused(true);  // ← SET THE PAUSED STATE SO UI REFLECTS IT
          }
          setCanResume(true);
          setResumeState(state);
        } 
      } catch (e) {
        console.error('❌ [RESUME CHECK] Error parsing saved upload state:', e);
        localStorage.removeItem('booksUploadState');
      }
    } 
  };

  const saveUploadState = (files, progress, uploaded, failed, dupes, paused, uploading) => {
    const state = {
      fileNames: files.map(f => f.name),
      currentIndex: progress.current - 1,
      total: progress.total,
      uploaded,
      failed,
      duplicates: dupes,
      paused,
      uploading,
      timestamp: Date.now()
    };
    
    
    try {
      localStorage.setItem('booksUploadState', JSON.stringify(state));
    } catch (error) {
      console.error('❌ [SAVE STATE] Failed to save to localStorage:', error);
      if (error.name === 'QuotaExceededError') {
        console.error('❌ [SAVE STATE] localStorage quota exceeded!');
      }
    }
  };

  const clearUploadState = () => {
    try {
      localStorage.removeItem('booksUploadState');
    } catch (error) {
      console.error('❌ [CLEAR STATE] Failed to clear:', error);
    }
    setCanResume(false);
  };

  const internalShowToast = (message, type = 'info') => {
    showToast(message, type);
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const extractCoverFromPDF = async (pdfFile) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      if (pdfDoc.numPages > 0) {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              const coverFile = new File([blob], `${pdfFile.name.replace('.pdf', '')}_cover.png`, { type: 'image/png' });
              resolve(coverFile);
            } else {
              resolve(null);
            }
          }, 'image/png', 0.95);
        });
      }
    } catch (error) {
      console.error('Error extracting cover:', error);
    }
    return null;
  };

  /**
   * Extract metadata from PDF including author, title, etc.
   * @param {File} pdfFile - The PDF file to extract metadata from
   * @returns {Promise<Object>} - Extracted metadata
   */
  const extractMetadataFromPDF = async (pdfFile) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Try to get PDF metadata
      let author = '';
      let title = '';
      
      try {
        const metadata = await pdfDoc.getMetadata().catch(() => null);
        if (metadata && metadata.info) {
          author = (metadata.info.Author || metadata.info.author || '').trim();
          title = (metadata.info.Title || metadata.info.title || '').trim();
        }
      } catch (e) {
        console.warn('Could not extract PDF metadata:', e);
      }
      
      // If we couldn't get author from metadata, try to extract from text
      if (!author && pdfDoc.numPages > 0) {
        try {
          // Get first 5 pages for comprehensive extraction
          let pageText = '';
          const pagesToCheck = Math.min(5, pdfDoc.numPages);
          
          for (let i = 1; i <= pagesToCheck; i++) {
            try {
              const page = await pdfDoc.getPage(i);
              const textContent = await page.getTextContent();
              pageText += ' ' + textContent.items.map(item => item.str).join(' ');
            } catch (e) {
              console.warn(`Could not extract text from page ${i}`);
            }
          }
          
          // Normalize whitespace
          pageText = pageText.replace(/\s+/g, ' ').trim();
          
          // Split into lines for better pattern matching
          const lines = pageText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
          
          // Helper function to validate author names
          const isValidAuthorName = (name) => {
            if (!name) return false;
            // Should have at least 3 characters
            if (name.length < 3) return false;
            // Should not be all numbers
            if (/^\d+$/.test(name)) return false;
            // Should start with capital letter
            if (!/^[A-Z]/.test(name)) return false;
            // Should not contain more than 2 commas or semicolons
            if ((name.match(/[,;]/g) || []).length > 2) return false;
            return true;
          };
          
          // Helper function to clean author names
          const cleanAuthorName = (name) => {
            if (!name) return '';
            // Remove extra whitespace
            name = name.replace(/\s+/g, ' ').trim();
            // Remove trailing punctuation except apostrophes and hyphens
            name = name.replace(/[.,;:!?]+$/, '').trim();
            // Extract first part if there are commas (Last, First format)
            if (name.includes(',')) {
              const parts = name.split(',').map(p => p.trim());
              if (parts.length === 2) {
                name = `${parts[1]} ${parts[0]}`.trim();
              }
            }
            // Limit to reasonable length
            if (name.length > 100) {
              name = name.split(/[,;]/)[0].trim();
            }
            return name;
          };
          
          // Try patterns in order of specificity
          
          // Pattern 1: Explicit "Author:" or "Authors:" label
          if (!author) {
            const match = pageText.match(/\bauthors?:\s*([A-Z][A-Za-z\s\-'.&,]+?)(?=\n|;|©|\d{4}|ISBN|Edition|$)/i);
            if (match && isValidAuthorName(match[1])) {
              author = cleanAuthorName(match[1]);
            }
          }
          
          // Pattern 2: "by Author Name" format
          if (!author) {
            const match = pageText.match(/\bby\s+([A-Z][A-Za-z\s\-'.&,]+?)(?=\n|\.|;|,\s*\d{4}|©|ISBN|$)/i);
            if (match && isValidAuthorName(match[1])) {
              author = cleanAuthorName(match[1]);
            }
          }
          
          // Pattern 3: Look in title pages (usually lines near top)
          if (!author && lines.length > 0) {
            // Check first 20 lines for author patterns
            for (let i = 0; i < Math.min(20, lines.length); i++) {
              const line = lines[i];
              // Look for capitalized names (usually 2-4 words)
              const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/);
              if (nameMatch && isValidAuthorName(nameMatch[1]) && nameMatch[1].length > 4) {
                // Check if it looks like a real name (not a title like "Chapter" or "Introduction")
                if (!/^(Chapter|Introduction|Foreword|Preface|Contents|Index|Appendix|Bibliography)$/i.test(nameMatch[1])) {
                  author = cleanAuthorName(nameMatch[1]);
                  break;
                }
              }
            }
          }
          
          // Pattern 4: "Written by", "Authored by", "Compiled by", etc.
          if (!author) {
            const match = pageText.match(/(?:written|authored|compiled|created|edited)\s+by\s+([A-Z][A-Za-z\s\-'.&,]+?)(?=\n|;|,\s*\d{4}|©|$)/i);
            if (match && isValidAuthorName(match[1])) {
              author = cleanAuthorName(match[1]);
            }
          }
          
          // Pattern 5: Name before year or edition indicators
          if (!author) {
            const match = pageText.match(/([A-Z][A-Za-z\s\-'.&]+?)\s+(?:Edition|©\s*\d{4}|\d{4}|ISBN)/);
            if (match && isValidAuthorName(match[1])) {
              author = cleanAuthorName(match[1]);
            }
          }
          
          // Pattern 6: University/Organization authors (e.g., "MIT", "Harvard University")
          if (!author) {
            const match = pageText.match(/([A-Z][A-Za-z\s\-'.&]*(?:University|Institute|College|Department|Laboratory|Press))/);
            if (match && isValidAuthorName(match[1])) {
              author = cleanAuthorName(match[1]);
            }
          }
          
          // Pattern 7: Multiple author format (Name1 and Name2, or Name1, Name2)
          if (!author) {
            const match = pageText.match(/([A-Z][A-Za-z\s\-'.]+?)\s+(?:and|,)\s+([A-Z][A-Za-z\s\-'.]+?)(?=\n|;|,\s*\d{4}|©|$)/);
            if (match && isValidAuthorName(match[1])) {
              author = cleanAuthorName(match[1]);
            }
          }
          
          // Pattern 8: Look for ALL CAPS names (older books)
          if (!author) {
            const allCapsLines = lines.filter(l => /^[A-Z\s\-'.&]+$/.test(l) && l.length > 3);
            for (const line of allCapsLines) {
              if (isValidAuthorName(line)) {
                const name = line.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
                if (isValidAuthorName(name)) {
                  author = cleanAuthorName(name);
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn('Could not extract text from PDF:', e);
        }
      }
      
      // Use filename as fallback for title if not found in PDF
      if (!title) {
        title = pdfFile.name.replace(/\.pdf$/i, '').trim();
      }
      
      return {
        author,
        title,
        description: '',
        year: null,
        language: 'English',
        isbn: '',
        pages: pdfDoc.numPages || 0,
        publisher: ''
      };
    } catch (error) {
      console.error('Error extracting metadata from PDF:', error);
      // Fallback to basic metadata from filename
      return extractBasicMetadataFromName(pdfFile.name);
    }
  };

  const extractBasicMetadataFromName = (fileName) => {
    // Try to extract title from filename
    const name = fileName.replace('.pdf', '').trim();
    return {
      title: name.length > 3 ? name : '',
      author: '',
      description: '',
      year: null,
      language: 'English',
      isbn: '',
      pages: 0,
      publisher: ''
    };
  };

  const handleFolderSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      internalShowToast('No PDF files found in selected folder', 'error');
      return;
    }

    setSelectedFiles(pdfFiles);
    
    // If resuming, check if these files match and skip already-uploaded ones
    if (isResumingUpload && resumeState) {
      const matchedFiles = pdfFiles.filter(f => resumeState.fileNames.includes(f.name));
      if (matchedFiles.length === 0) {
        internalShowToast('❌ Selected files do not match the upload to resume', 'error');
        return;
      }
      if (matchedFiles.length < resumeState.fileNames.length) {
        internalShowToast(`⚠️ Only found ${matchedFiles.length} of ${resumeState.fileNames.length} files. Upload will continue with available files.`, 'warning');
      }
      setSelectedFiles(matchedFiles);
      // SET THE RESUME INDEX FOR THE UPLOAD FUNCTION
      resumeIndexRef.current = resumeState.currentIndex + 1;
      internalShowToast(`✅ Found ${matchedFiles.length} files to resume upload (${resumeState.currentIndex + 1}/${resumeState.total} already processed)`, 'success');
    } else {
      internalShowToast(`Found ${pdfFiles.length} PDF files`, 'success');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Handle dropped files/folders
    const items = e.dataTransfer.items;
    const files = [];

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file.name.toLowerCase().endsWith('.pdf')) {
            files.push(file);
          }
        }
      }
    }

    if (files.length === 0) {
      internalShowToast('No PDF files found', 'error');
      return;
    }

    setSelectedFiles(files);
    internalShowToast(`Found ${files.length} PDF files`, 'success');
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      internalShowToast('No files selected', 'error');
      return;
    }

    setUploading(true);
    setPaused(false);
    uploadAbortRef.current = false;
    pauseRef.current = false;
    
    // If resuming, restore counts from saved state
    const startFromIndex = resumeIndexRef.current;
    const initialUploaded = resumeState?.uploaded || 0;
    const initialFailed = resumeState?.failed || 0;
    const initialDupes = resumeState?.duplicates || 0;
    
    
    // Only reset progress if not resuming
    if (startFromIndex === 0) {
      setUploadProgress({ current: 0, total: selectedFiles.length });
      setUploadedCount(0);
      setFailedCount(0);
      setDuplicatesCount(0);
    } else {
      // Resuming: restore previous progress
      setUploadProgress({ current: startFromIndex, total: selectedFiles.length });
      setUploadedCount(initialUploaded);
      setFailedCount(initialFailed);
      setDuplicatesCount(initialDupes);
      internalShowToast(`Resuming from file ${startFromIndex + 1}/${selectedFiles.length}`, 'info');
    }

    let uploaded = initialUploaded;
    let failed = initialFailed;
    let duplicates = initialDupes;
    for (let i = startFromIndex; i < selectedFiles.length; i++) {
      // Check if upload was aborted
      if (uploadAbortRef.current) {
        clearUploadState();
        setUploading(false);
        internalShowToast('Upload cancelled', 'info');
        break;
      }

      // Check if paused and wait
      while (pauseRef.current && !uploadAbortRef.current) {
        // Save state while paused
        saveUploadState(selectedFiles, { current: i, total: selectedFiles.length }, uploaded, failed, duplicates, true, true);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });
      // Save progress
      saveUploadState(selectedFiles, { current: i + 1, total: selectedFiles.length }, uploaded, failed, duplicates, false, true);

      try {
        // Extract cover
        const cover = await extractCoverFromPDF(file);

        // Extract metadata from PDF (including author, title, pages, etc.)
        const metadata = await extractMetadataFromPDF(file);
        const categoryId = selectedCategoryId || null;
        const metadataWithCategory = { ...metadata, category_id: categoryId };

        // Determine if user is admin
        const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'editor';

        // Upload
        if (isAdmin) {
          await createBook({ metadata: metadataWithCategory, pdfFile: file, coverFile: cover });
        } else {
          await createBookSubmission({ metadata: metadataWithCategory, pdfFile: file, coverFile: cover });
        }

        uploaded++;
        setUploadedCount(uploaded);
        // SAVE PROGRESS AFTER EACH FILE COMPLETES
        saveUploadState(selectedFiles, { current: i + 1, total: selectedFiles.length }, uploaded, failed, duplicates, false, true);
      } catch (error) {
        console.error(`❌ [FILE ERROR] Failed to upload ${file.name}:`, error);
        failed++;
        setFailedCount(failed);
        // SAVE PROGRESS AFTER FAILURE TOO
        saveUploadState(selectedFiles, { current: i + 1, total: selectedFiles.length }, uploaded, failed, duplicates, false, true);
      }
    }

    clearUploadState();
    resumeIndexRef.current = 0;
    setIsResumingUpload(false);
    setResumeState(null);
    setUploading(false);
    setPaused(false);
    const message = `Upload complete: ${uploaded} successful, ${failed} failed`;
    internalShowToast(message, failed === 0 ? 'success' : 'info');
    
    // Clear selected files after upload
    setTimeout(() => {
      setSelectedFiles([]);
      setUploadProgress({ current: 0, total: 0 });
    }, 2000);
  };

  const handlePause = () => {
    pauseRef.current = true;
    setPaused(true);
    
    // CRITICAL: Save state immediately when pause is clicked
    saveUploadState(selectedFiles, uploadProgress, uploadedCount, failedCount, duplicatesCount, true, true);
    
    internalShowToast('Upload paused', 'info');
  };

  const handleResume = async () => {
    
    pauseRef.current = false;
    setPaused(false);
    
    // CRITICAL: Call uploadFiles() again to continue from saved index
    if (selectedFiles && selectedFiles.length > 0) {
      await uploadFiles(selectedFiles);
    }
    
    internalShowToast('Upload resumed', 'info');
  };

  const handleCancel = () => {
    uploadAbortRef.current = true;
    pauseRef.current = false;
    setUploading(false);
    setPaused(false);
    internalShowToast('Upload cancelled', 'info');
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setUploadProgress({ current: 0, total: 0 });
    setUploadedCount(0);
    setFailedCount(0);
    setDuplicatesCount(0);
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const progressPercent = (uploadProgress.total || savedUploadState?.total || 0) > 0 ? ((uploadProgress.current || savedUploadState?.currentIndex + 1 || 0) / (uploadProgress.total || savedUploadState?.total || 0)) * 100 : 0;
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;

  return (
    <div className="panel">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#e9edef', fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' }}>
          Bulk Upload from Folder
        </h2>
        <p style={{ color: '#8696a0', fontSize: '13px', margin: '0' }}>
          Select a folder to upload multiple PDF files at once
        </p>
      </div>

      {asSubmission && (
        <div style={{
          marginBottom: '15px',
          padding: '10px 12px',
          background: '#1f2c33',
          border: '1px solid #00a884',
          borderRadius: '6px',
          color: '#00a884',
          fontSize: '12px'
        }}>
          📋 Your uploads will be reviewed and appear after approval
        </div>
      )}

      {/* Main Content */}
      {isResumingUpload && !selectedFiles.length ? (
        // Resuming - show instructions
        <div style={{
          border: '2px dashed #2196F3',
          borderRadius: '8px',
          padding: '40px 20px',
          textAlign: 'center',
          background: 'rgba(33, 150, 243, 0.08)',
          marginBottom: '20px'
        }}>
          <FiRefreshCw size={40} style={{ color: '#2196F3', marginBottom: '12px' }} />
          <h3 style={{ color: '#e9edef', fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0' }}>
            Resume Upload
          </h3>
          <p style={{ color: '#8696a0', fontSize: '13px', margin: '0 0 16px 0' }}>
            Select the SAME folder to resume upload
          </p>
          {resumeState && (
            <div style={{
              background: '#1f2c33',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#8696a0',
              textAlign: 'left',
              maxWidth: '400px',
              margin: '0 auto 16px'
            }}>
              <div>📊 Previous Progress:</div>
              <div style={{ marginTop: '8px', color: '#00a884' }}>
                ✓ {resumeState.uploaded} uploaded
              </div>
              <div style={{ color: '#ea4335' }}>
                ✗ {resumeState.failed} failed
              </div>
              <div style={{ color: '#f1b233' }}>
                ⏭️ {resumeState.duplicates} duplicates
              </div>
              <div style={{ marginTop: '8px', color: '#2196F3' }}>
                📁 {resumeState.total - resumeState.currentIndex - 1} files remaining
              </div>
            </div>
          )}
          <button
            onClick={() => folderInputRef.current?.click()}
            style={{
              padding: '12px 24px',
              background: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FiFolder size={16} />
            Select Folder to Resume
          </button>
        </div>
      ) : selectedFiles.length === 0 ? (
        // Upload Area
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => folderInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#00a884' : '#374151'}`,
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(0, 168, 132, 0.08)' : '#0b141a',
            transition: 'all 0.2s'
          }}
        >
          <FiFolder size={40} style={{ color: '#00a884', marginBottom: '12px' }} />
          <h3 style={{ color: '#e9edef', fontSize: '16px', fontWeight: '500', margin: '0 0 4px 0' }}>
            Select Folder or Drag & Drop
          </h3>
          <p style={{ color: '#8696a0', fontSize: '13px', margin: '0' }}>
            Choose a folder with PDF files
          </p>
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory="true"
            directory=""
            multiple
            onChange={handleFolderSelect}
            style={{ display: 'none' }}
            accept=".pdf"
          />
        </div>
      ) : (
        <>
          {/* File List */}
          <div style={{
            background: '#0b141a',
            border: '1px solid #1f2c33',
            borderRadius: '8px',
            marginBottom: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1f2c33',
              background: '#0b141a'
            }}>
              <div style={{ color: '#e9edef', fontSize: '13px', fontWeight: '500' }}>
                Files ({selectedFiles.length > 0 ? selectedFiles.length : ((resumeState || savedUploadState)?.fileNames?.length || 0)}) • {selectedFiles.length > 0 ? totalSize.toFixed(1) : 'resuming...'} MB
              </div>
            </div>

            <div style={{
              maxHeight: '250px',
              overflowY: 'auto'
            }}>
              {selectedFiles.length > 0 ? (
                // Show actual files if selected
                selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      borderBottom: idx < selectedFiles.length - 1 ? '1px solid #1f2c33' : 'none',
                      color: '#8696a0',
                      fontSize: '12px'
                    }}
                  >
                    <FiFile size={14} style={{ color: '#00a884', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <span style={{ color: '#8696a0', fontSize: '11px', flexShrink: 0 }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ))
              ) : (resumeState || savedUploadState) && (resumeState || savedUploadState).fileNames ? (
                // Show saved file names if resuming a paused upload
                (resumeState || savedUploadState).fileNames.map((fileName, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      borderBottom: idx < resumeState.fileNames.length - 1 ? '1px solid #1f2c33' : 'none',
                      color: '#8696a0',
                      fontSize: '12px'
                    }}
                  >
                    <FiFile size={14} style={{ color: '#00a884', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName}
                    </span>
                  </div>
                ))
              ) : null}
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#e9edef', fontSize: '13px', fontWeight: '600' }}>
              Book Category
            </label>
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              style={{
                width: 'fit-content',
                minWidth: '220px',
                maxWidth: '420px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #374151',
                background: '#0b141a',
                color: '#e9edef',
                fontSize: '14px'
              }}
            >
              <option value="">No category selected</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Progress */}
          {(uploading || savedUploadState) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                color: '#8696a0',
                fontSize: '12px'
              }}>
                <span>Progress: {uploadProgress.current || (savedUploadState?.currentIndex + 1) || 0} / {uploadProgress.total || savedUploadState?.total || 0}</span>
                <span>✓ {uploadedCount || savedUploadState?.uploaded || 0} | ⏭️ {duplicatesCount || savedUploadState?.duplicates || 0} | ✗ {failedCount || savedUploadState?.failed || 0}</span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#1f2c33',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: '#00a884',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              onClick={uploadFiles}
              disabled={uploading || paused}
              style={{
                padding: '12px 24px',
                background: uploading ? 'linear-gradient(135deg, #00a884 0%, #00d4aa 100%)' : 'linear-gradient(135deg, #00a884 0%, #00d4aa 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: uploading ? 0.7 : 1,
                boxShadow: uploading ? '0 2px 8px rgba(0, 168, 132, 0.3)' : '0 4px 12px rgba(0, 168, 132, 0.4)',
                transition: 'all 0.3s ease',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!uploading) {
                  e.target.style.boxShadow = '0 6px 16px rgba(0, 168, 132, 0.5)';
                  e.target.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!uploading) {
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 168, 132, 0.4)';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {uploading ? (
                <>
                  <FiRefreshCw style={{ animation: paused ? 'none' : 'spin 1s linear infinite' }} />
                  {paused ? 'Paused' : 'Uploading...'}
                </>
              ) : (
                <>
                  <FiUpload size={16} />
                  Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
            {uploading && (
              <>
                {!paused ? (
                  <button
                    onClick={handlePause}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #f1b233 0%, #ffc657 100%)',
                      color: '#1f2c33',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(241, 178, 51, 0.3)',
                      transition: 'all 0.3s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.boxShadow = '0 6px 16px rgba(241, 178, 51, 0.4)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.boxShadow = '0 4px 12px rgba(241, 178, 51, 0.3)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <FiPause size={16} />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #00a884 0%, #00d4aa 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0, 168, 132, 0.3)',
                      transition: 'all 0.3s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.boxShadow = '0 6px 16px rgba(0, 168, 132, 0.4)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.boxShadow = '0 4px 12px rgba(0, 168, 132, 0.3)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <FiPlay size={16} />
                    Resume
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #ea4335 0%, #f66b6b 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(234, 67, 53, 0.3)',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.boxShadow = '0 6px 16px rgba(234, 67, 53, 0.4)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.boxShadow = '0 4px 12px rgba(234, 67, 53, 0.3)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <FiX size={16} />
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={clearSelection}
              disabled={uploading}
              style={{
                padding: '10px 16px',
                background: '#1f2c33',
                color: '#8696a0',
                border: '1px solid #374151',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: uploading ? 0.5 : 1
              }}
            >
              <FiX size={14} />
              Clear
            </button>
            {canResume && !uploading && (
              <button
                onClick={() => {
                  setIsResumingUpload(true);
                  internalShowToast('📁 Please select the SAME folder to continue upload', 'info');
                }}
                style={{
                  padding: '10px 16px',
                  background: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FiRefreshCw size={14} />
                Resume Previous
              </button>
            )}
          </div>
        </>
      )}

      {/* Results */}
      {(uploadedCount > 0 || duplicatesCount > 0 || failedCount > 0) && !uploading && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: '#0b141a',
          border: `1px solid ${failedCount === 0 ? '#00a884' : '#f1b233'}`,
          borderRadius: '8px'
        }}>
          <div style={{ color: '#e9edef', fontSize: '13px', fontWeight: '500', marginBottom: '12px' }}>
            Upload Complete
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#00a884', fontSize: '20px', fontWeight: '600', marginBottom: '2px' }}>
                {uploadedCount}
              </div>
              <div style={{ color: '#8696a0', fontSize: '11px' }}>Uploaded</div>
            </div>
            {duplicatesCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#f1b233', fontSize: '20px', fontWeight: '600', marginBottom: '2px' }}>
                  {duplicatesCount}
                </div>
                <div style={{ color: '#8696a0', fontSize: '11px' }}>Skipped (Duplicates)</div>
              </div>
            )}
            {failedCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ea4335', fontSize: '20px', fontWeight: '600', marginBottom: '2px' }}>
                  {failedCount}
                </div>
                <div style={{ color: '#8696a0', fontSize: '11px' }}>Failed</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          maxWidth: '300px',
          width: 'calc(100% - 40px)',
          background: toast.type === 'error' ? '#ea4335' : toast.type === 'success' ? '#00a884' : '#374151',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '6px',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          animation: 'slideIn 0.3s ease'
        }}>
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ'} {toast.message}
        </div>
      )}
    </div>
  );
};

// Past Papers Auto Upload Component
const PastPapersAutoUploadContent = ({ userProfile, asSubmission, showToast }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadedCount, setUploadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [customFaculty, setCustomFaculty] = useState('');
  const [useCustomFaculty, setUseCustomFaculty] = useState(false);
  const [universities, setUniversities] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [extractedMetadata, setExtractedMetadata] = useState(null);
  const [canResumePastPapers, setCanResumePastPapers] = useState(false);
  const [resumeStatePastPapers, setResumeStatePastPapers] = useState(null);
  const [isResumingPastPapersUpload, setIsResumingPastPapersUpload] = useState(false);
  const folderInputRef = useRef(null);
  const uploadAbortRef = useRef(false);
  const pauseRef = useRef(false);
  const resumeIndexRef = useRef(0);
  const handleResumePastPapersRef = useRef(null);

  const internalShowToast = useCallback((message, type = 'info') => {
    showToast(message, type);
  }, [showToast]);

  // localStorage helper functions for past papers
  const savePastPapersUploadState = (files, progress, uploaded, failed, dupes, paused = false, uploading = false) => {
    try {
      const state = {
        fileNames: files.map(f => f.name),
        currentIndex: progress.current - 1,
        total: progress.total,
        uploaded, failed, duplicates: dupes,
        paused, uploading,
        timestamp: Date.now()
      };
      localStorage.setItem('pastPapersUploadState', JSON.stringify(state));
    } catch (error) {
      console.error('❌ [SAVE PAST PAPERS] Failed to save:', error);
    }
  };

  const clearPastPapersUploadState = () => {
    localStorage.removeItem('pastPapersUploadState');
  };

  const checkForIncompletePastPapersUpload = () => {
    const savedState = localStorage.getItem('pastPapersUploadState');
    
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        
        // Check if upload was incomplete (paused or in progress)
        if (state.fileNames && state.fileNames.length > 0 && (state.paused || state.uploading)) {
          
          // RESTORE UI STATE
          setUploadProgress({ current: state.currentIndex + 1, total: state.total });
          setUploadedCount(state.uploaded);
          setFailedCount(state.failed);
          setDuplicatesCount(state.duplicates || 0);
          setUploading(true);
          
          // If paused, keep it paused
          if (state.paused) {
            pauseRef.current = true;
            setPaused(true);
          }
          
          setCanResumePastPapers(true);
          setResumeStatePastPapers(state);
        } 
      } catch (error) {
        console.error('❌ [PAST PAPERS CHECK] Error parsing state:', error);
      }
    }
  };

  // Load universities on mount
  useEffect(() => {
    const loadUniversities = async () => {
      try {
        const unis = await getUniversitiesForDropdown();
        setUniversities(unis);
      } catch (error) {
        console.error('❌ Failed to load universities:', error);
      }
    };
    loadUniversities();
    checkForIncompletePastPapersUpload();
  }, []);

  // Load faculties when university is selected
  useEffect(() => {
    const loadFaculties = async () => {
      if (university) {
        try {
          const facs = await getFacultiesByUniversity(university);
          setFaculties(facs || []);
          // Reset faculty selection when university changes
          setFaculty('');
          setCustomFaculty('');
          setUseCustomFaculty(false);
        } catch (error) {
          console.error('❌ Failed to load faculties:', error);
          setFaculties([]);
        }
      } else {
        setFaculties([]);
        setFaculty('');
        setCustomFaculty('');
        setUseCustomFaculty(false);
      }
    };
    loadFaculties();
  }, [university]);

  // Auto-resume incomplete past papers upload
  useEffect(() => {
    if (canResumePastPapers && !uploading && !isResumingPastPapersUpload) {
      setIsResumingPastPapersUpload(true);
      handleResumePastPapersRef.current?.();
    }
  }, [canResumePastPapers, uploading, isResumingPastPapersUpload]);

  // Load faculties when university changes
  useEffect(() => {
    const loadFaculties = async () => {
      if (!university) {
        setFaculties([]);
        setFaculty('');
        return;
      }
      try {
        const facs = await getFacultiesByUniversity(university);
        setFaculties(facs);
        
        // If we have extracted faculty, try to match it
        if (extractedMetadata?.faculty && facs.length > 0) {
          const matchedFaculty = findMatchingFaculty(extractedMetadata.faculty, facs);
          if (matchedFaculty) {
            setFaculty(matchedFaculty);
            internalShowToast(`✓ Auto-filled: University & Faculty detected from PDF`, 'success');
          }
        }
      } catch (error) {
        console.error('Failed to load faculties:', error);
        setFaculties([]);
      }
    };
    loadFaculties();
  }, [university, extractedMetadata?.faculty, internalShowToast]);

  // Auto-extract metadata from PDF (using first-page header extraction)
  const autoExtractMetadata = async (pdfFile, unisList = null) => {
    try {
      
      // STRATEGY 1: Try first-page academic header extraction (NEW - HIGH ACCURACY)
      let pdfMetadata = await extractFirstPageMetadata(pdfFile);
      
      
      // If first-page extraction succeeded with good quality, use it
      if (pdfMetadata && pdfMetadata.validation && pdfMetadata.validation.quality !== 'poor') {
        setExtractedMetadata(pdfMetadata);
      } else {
        
        // STRATEGY 2: Fallback to full-page backend extraction (OCR + Direct text)
        pdfMetadata = await extractPastPaperMetadataBackend(pdfFile);
        
        
        if (pdfMetadata) {
          setExtractedMetadata(pdfMetadata);
        } else {
          console.warn('⚠️ [AUTO-EXTRACT] Both extraction strategies failed');
          setExtractedMetadata(null);
        }
      }

      // Use provided universities list or fallback to state
      const unis = unisList || universities;
      
      // Try to match university from PDF (if extraction succeeded)
      if (pdfMetadata && pdfMetadata.faculty && unis.length > 0) {
        
        // Look for a university that has this faculty
        for (const uni of unis) {
          try {
            const facs = await getFacultiesByUniversity(uni.id);
            if (facs.some(f => f.toLowerCase() === pdfMetadata.faculty.toLowerCase())) {
              setUniversity(uni.id);
              setFaculty(pdfMetadata.faculty);
              break;
            }
          } catch (e) {
            // Continue to next university
          }
        }
      }

      // Show success message with extraction source
      let source = 'filename (fallback)';
      if (pdfMetadata?.source === 'first-page-extracted') {
        source = `first page (${pdfMetadata.validation.quality} quality)`;
      } else if (pdfMetadata?.source === 'backend-extracted') {
        source = 'PDF content via OCR';
      }
      
      internalShowToast(`✅ Metadata extracted from ${source}`, 'success');
      
    } catch (error) {
      console.error('⚠️ [AUTO-EXTRACT] Extraction error:', error);
      setExtractedMetadata(null);
      // Don't fail - allow upload with filename extraction
      internalShowToast('✅ Ready to upload (will extract from filename)', 'success');
    }
  };

  const handleFolderSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      internalShowToast('No PDF files found in selected folder', 'error');
      return;
    }

    setSelectedFiles(pdfFiles);
    internalShowToast(`Found ${pdfFiles.length} PDF files`, 'success');
    
    // Ensure universities are loaded before extracting
    const performExtraction = async () => {
      let unis = universities;
      
      // If universities not yet loaded, wait and load them
      if (!unis || unis.length === 0) {
        try {
          unis = await getUniversitiesForDropdown({ forceRefresh: true });
          setUniversities(unis);
        } catch (error) {
          console.error('❌ Failed to load universities during extraction:', error);
          internalShowToast('Failed to load universities - please try again', 'error');
          return;
        }
      }
      
      // Now extract with loaded universities
      autoExtractMetadata(pdfFiles[0], unis);
    };
    
    performExtraction();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const items = e.dataTransfer.items;
    const files = [];

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file.name.toLowerCase().endsWith('.pdf')) {
            files.push(file);
          }
        }
      }
    }

    if (files.length === 0) {
      internalShowToast('No PDF files found', 'error');
      return;
    }

    setSelectedFiles(files);
    internalShowToast(`Found ${files.length} PDF files`, 'success');
    
    // Ensure universities are loaded before extracting
    const performExtraction = async () => {
      let unis = universities;
      
      // If universities not yet loaded, wait and load them
      if (!unis || unis.length === 0) {
        try {
          unis = await getUniversitiesForDropdown({ forceRefresh: true });
          setUniversities(unis);
        } catch (error) {
          console.error('❌ Failed to load universities during extraction:', error);
          internalShowToast('Failed to load universities - please try again', 'error');
          return;
        }
      }
      
      // Now extract with loaded universities
      autoExtractMetadata(files[0], unis);
    };
    
    performExtraction();
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      internalShowToast('No files selected', 'error');
      return;
    }

    if (!university) {
      internalShowToast('❌ Please select a university first', 'error');
      return;
    }

    setUploading(true);
    setPaused(false);
    uploadAbortRef.current = false;
    pauseRef.current = false;
    setUploadProgress({ current: 0, total: selectedFiles.length });
    setUploadedCount(0);
    setFailedCount(0);
    setDuplicatesCount(0);

    let uploaded = 0;
    let failed = 0;
    let duplicates = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      // Check if upload was aborted
      if (uploadAbortRef.current) {
        setUploading(false);
        internalShowToast('Upload cancelled', 'info');
        break;
      }

      // Check if paused and wait
      while (pauseRef.current && !uploadAbortRef.current) {
        // Save state while paused
        savePastPapersUploadState(selectedFiles, { current: i, total: selectedFiles.length }, uploaded, failed, duplicates);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });
      
      // Save initial progress
      savePastPapersUploadState(selectedFiles, { current: i + 1, total: selectedFiles.length }, uploaded, failed, duplicates);
      
      let metadata = null; // Declare here so it's accessible in catch block
      
      // Declare extraction variables at function level for use in Egerton detection
      let unit_code = '';
      let unit_name = '';
      let year = '';
      let semester = '';
      let exam_type = '';
      const fileExtractedMetadata = i === 0 ? extractedMetadata : null;

      try {
        // ✅ PRIORITY 1: Use first-page extracted metadata (highest accuracy)
        if (fileExtractedMetadata && fileExtractedMetadata.source === 'first-page-extracted' && fileExtractedMetadata.validation.isValid) {
          
          unit_code = fileExtractedMetadata.unitCode || '';
          unit_name = fileExtractedMetadata.unitName || '';
          year = fileExtractedMetadata.year || null;
          semester = fileExtractedMetadata.semester || '';
          exam_type = fileExtractedMetadata.examType || 'Main';
          
        }
        // ✅ PRIORITY 2: Use backend extracted metadata (OCR + direct text)
        else if (fileExtractedMetadata && fileExtractedMetadata.source === 'backend-extracted') {
          
          unit_code = fileExtractedMetadata.unitCode || '';
          unit_name = fileExtractedMetadata.unitName || '';
          year = fileExtractedMetadata.year || null;
          semester = fileExtractedMetadata.semester || '';
          exam_type = fileExtractedMetadata.examType || 'Main';
          
        } 
        // ⚠️ FALLBACK: Parse filename if no extraction available
        else {
          
          const fileNameWithoutExt = file.name.replace('.pdf', '').trim();
          
          // Try underscore-separated format first
          let parts = fileNameWithoutExt.split('_');
          
          
          if (parts.length >= 2) {
            // Standard format: CODE_Name_Year_Sem_Type
            unit_code = parts[0] || '';
            unit_name = parts[1] || '';
            year = parts[2] || '';
            semester = parts[3] || '';
            exam_type = parts[4] || '';
          } else {
            // Fallback: try to extract from space-separated filename: "CODE NUMBER MONTH YEAR" or "PREFIX CODE NUMBER MONTH YEAR"
            try {
              // Extract year first (most reliable) - look for 4-digit year
              const yearMatch = fileNameWithoutExt.match(/\b(19|20)\d{2}\b/);
              year = yearMatch ? yearMatch[0] : '';
              
              // Try to extract course code and numbers (handles DIP EDFO 0112, AGBM 0220, SOCI 104, etc.)
              // Matches: "DIP EDFO 0112", "AGBM 0220", "SOCI 104", "CODE123", etc.
              
              // First, try pattern with potential prefix: "WORD WORD DIGITS" or "WORD DIGITS"
              let codeMatch = fileNameWithoutExt.match(/\b([A-Z]{2,4})\s+(\d{3,4})\b/i);
              
              if (codeMatch) {
                // Found single code with numbers: "EDFO 0112"
                const letters = codeMatch[1];
                const numbers = codeMatch[2];
                
                unit_name = letters;
                unit_code = numbers;
              } else {
                // Try pattern with prefix: "DIP EDFO" where EDFO is the real code
                codeMatch = fileNameWithoutExt.match(/\b([A-Z]{3})\s+([A-Z]{2,4})\s+(\d{3,4})\b/i);
                if (codeMatch) {
                  // codeMatch[1] = prefix (e.g., "DIP")
                  // codeMatch[2] = unit code letters (e.g., "EDFO")
                  // codeMatch[3] = unit code numbers (e.g., "0112")
                  const letters = codeMatch[2];
                  const numbers = codeMatch[3];
                  
                  unit_name = letters;
                  unit_code = numbers;
                } else {
                  // Last resort: just use the whole filename
                  unit_name = fileNameWithoutExt;
                }
              }
            } catch (e) {
              console.warn('⚠️ Error parsing filename:', e);
              unit_name = fileNameWithoutExt;
            }
          }
          
        }
        
        // EGERTON UNIVERSITY AUTO-DETECTION FOR PAPERS
        // If we have Egerton unit codes, automatically set Egerton University
        let selectedUniversity = university || null;
        
        // If no university selected, try to detect from unit code pattern
        if (!selectedUniversity) {
          // Check if this looks like an Egerton unit code
          const egerton_codes = new Set([
            'AGEC', 'AGBM', 'ANSC', 'APHY', 'CROP', 'HORT', 'SOIL', 'LPBP', 'DAIR', 'FOST', 'AENG', 'ENTM', 'AGRI',
            'ECON', 'BECO', 'STAT', 'LITL', 'ENGL', 'KISW', 'LINS', 'FREN', 'GERM', 'CRSS', 'SOCI', 'PSCS', 'PHIL', 'HIST', 'RELI', 'ANTH', 'LIBS', 'COMM',
            'BACT', 'BFIN', 'BOPM', 'BBIS', 'BMGT', 'BBAM', 'BCOM', 'PROC', 'ENTR', 'HRM', 'MARK',
            'AGED', 'ACDS', 'ADSN', 'CDEV', 'CIEM', 'BUST', 'EPSC', 'EDFO', 'EDUC', 'MENT', 'PSYC', 'GUID', 'COUN', 'ECD', 'SPEC',
            'AGEN', 'CEEN', 'ECEN', 'IEEN', 'MEEN', 'WREN', 'BENG', 'CENG', 'SENG', 'EENG', 'PENG', 'TENG', 'MENG', 'COMP', 'ICT', 'CSCI', 'DATA', 'SOFT', 'NETS',
            'ENVS', 'GEOG', 'NRES', 'FRST', 'DRLM', 'WILD', 'ECOT', 'WEM', 'LAND', 'ENVI', 'ENMS', 'CLEE', 'WRES', 'FRES', 'SWCO', 'CONS', 'NARE',
            'ANAT', 'PHYS', 'PATH', 'NURS', 'NUTR', 'COMH', 'REPH', 'PEDI', 'IMED', 'SURG', 'CLIN', 'EPID', 'MICB', 'MED', 'MEDS', 'PHAR', 'PHARM', 'CHEM', 'DENT', 'DRES', 'PUHE',
            'LAW', 'LLB', 'CLAW', 'PLAW', 'ILWA', 'LAWI', 'LAWS',
            'BIOL', 'ZOO', 'BOT', 'BCMB', 'ORGA', 'INOR', 'PHCH', 'MECH', 'ELEC', 'OPTI', 'BIO', 'ZOOL', 'ECOL', 'GENT', 'ALGE', 'CALC', 'GEOL', 'MING', 'GEOM',
            'VAPH', 'VMTP', 'VPMP', 'VETA', 'PARA', 'ANAV', 'VMED', 'VETS', 'VSUR', 'DVSO', 'VPAT', 'VPHE', 'DVET', 'VANA', 'VPHY'
          ]);
          
          const unitPrefix = unit_name.replace(/\d+/g, '').toUpperCase().trim();
          if (egerton_codes.has(unitPrefix)) {
            // Find Egerton University ID in the universities list
            const egerton = universities.find(u => u.name?.toLowerCase().includes('egerton'));
            if (egerton) {
              selectedUniversity = egerton.id;
            }
          }
        }
        
        // Fallback: try extracted metadata university
        if (!selectedUniversity && fileExtractedMetadata?.university) {
          selectedUniversity = findMatchingUniversity(fileExtractedMetadata.university, universities);
        }
        
        // Egerton-specific unit code to faculty mapping
        // ======================================================
        // EGERTON UNIVERSITY 2026 - VERIFIED UNIT CODES
        // 161 Verified Codes Across 10 Faculties
        // ======================================================
        const egerton_unit_mapping = {
          // ========== 1. FACULTY OF AGRICULTURE (FoA) - 13 codes ==========
          'AGEC': 'Agriculture', 'AGBM': 'Agriculture',
          'ANSC': 'Agriculture', 'APHY': 'Agriculture',
          'CROP': 'Agriculture', 'HORT': 'Agriculture',
          'SOIL': 'Agriculture', 'LPBP': 'Agriculture',
          'DAIR': 'Agriculture', 'FOST': 'Agriculture',
          'AENG': 'Agriculture', 'ENTM': 'Agriculture',
          'AGRI': 'Agriculture',
          
          // ========== 2. FACULTY OF ARTS & SOCIAL SCIENCES (FASS) - 18 codes ==========
          'ECON': 'FASS', 'BECO': 'FASS',
          'LITL': 'FASS',
          'ENGL': 'FASS', 'KISW': 'FASS',
          'LINS': 'FASS', 'FREN': 'FASS',
          'GERM': 'FASS', 'CRSS': 'FASS',
          'SOCI': 'FASS', 'PSCS': 'FASS',
          'PHIL': 'FASS', 'HIST': 'FASS',
          'RELI': 'FASS', 'ANTH': 'FASS',
          'LIBS': 'FASS', 'COMM': 'FASS',
          
          // ========== 3. FACULTY OF COMMERCE (FoC) - 11 codes ==========
          'BACT': 'Commerce', 'BFIN': 'Commerce',
          'BOPM': 'Commerce', 'BBIS': 'Commerce',
          'BMGT': 'Commerce', 'BBAM': 'Commerce',
          'BCOM': 'Commerce', 'PROC': 'Commerce',
          'ENTR': 'Commerce', 'HRM': 'Commerce',
          'MARK': 'Commerce',
          
          // ========== 4. FACULTY OF EDUCATION & COMMUNITY DEVELOPMENT STUDIES (FEDCOS) - 15 codes ==========
          'AGED': 'FEDCOS',
          'ACDS': 'FEDCOS',
          'ADSN': 'FEDCOS',
          'CDEV': 'FEDCOS',
          'CIEM': 'FEDCOS',
          'BUST': 'FEDCOS',
          'EPSC': 'FEDCOS',
          'EDFO': 'FEDCOS',
          'EDUC': 'FEDCOS',
          'MENT': 'FEDCOS',
          'PSYC': 'FEDCOS',
          'GUID': 'FEDCOS',
          'COUN': 'FEDCOS',
          'ECD': 'FEDCOS',
          'SPEC': 'FEDCOS',
          
          // ========== 5. FACULTY OF ENGINEERING & TECHNOLOGY (FET) - 20 codes ==========
          'AGEN': 'FET',
          'CEEN': 'FET',
          'ECEN': 'FET',
          'IEEN': 'FET',
          'MEEN': 'FET',
          'WREN': 'FET',
          'BENG': 'FET',
          'CENG': 'FET',
          'SENG': 'FET',
          'EENG': 'FET',
          'PENG': 'FET',
          'TENG': 'FET',
          'MENG': 'FET',
          'ICT': 'FET',
          'CSCI': 'FET',
          'DATA': 'FET',
          'SOFT': 'FET',
          'NETS': 'FET',
          
          // ========== 6. FACULTY OF ENVIRONMENT & RESOURCES DEVELOPMENT (FERD) - 17 codes ==========
          'ENVS': 'FERD',
          'GEOG': 'FERD',
          'NRES': 'FERD',
          'FRST': 'FERD',
          'DRLM': 'FERD',
          'WILD': 'FERD',
          'ECOT': 'FERD',
          'WEM': 'FERD',
          'LAND': 'FERD',
          'ENVI': 'FERD',
          'ENMS': 'FERD',
          'CLEE': 'FERD',
          'WRES': 'FERD',
          'FRES': 'FERD',
          'SWCO': 'FERD',
          'CONS': 'FERD',
          'NARE': 'FERD',
          
          // ========== 7. FACULTY OF HEALTH SCIENCES (FHS) - 21 codes ==========
          'ANAT': 'Health Sciences',
          'PATH': 'Health Sciences', 'NURS': 'Health Sciences',
          'NUTR': 'Health Sciences', 'COMH': 'Health Sciences',
          'REPH': 'Health Sciences', 'PEDI': 'Health Sciences',
          'IMED': 'Health Sciences', 'SURG': 'Health Sciences',
          'CLIN': 'Health Sciences', 'EPID': 'Health Sciences',
          'MICB': 'Health Sciences', 'MED': 'Health Sciences',
          'MEDS': 'Health Sciences', 'PHAR': 'Health Sciences',
          'PHARM': 'Health Sciences',
          'DENT': 'Health Sciences', 'DRES': 'Health Sciences',
          'PUHE': 'Health Sciences',
          
          // ========== 8. FACULTY OF LAW (FoL) - 7 codes ==========
          'LAW': 'Law', 'LLB': 'Law',
          'CLAW': 'Law', 'PLAW': 'Law',
          'ILWA': 'Law', 'LAWI': 'Law',
          'LAWS': 'Law',
          
          // ========== 9. FACULTY OF SCIENCE (FoS) - 25 codes ==========
          'BIOL': 'Science', 'ZOO': 'Science',
          'BOT': 'Science', 'BCMB': 'Science',
          'CHEM': 'Science', 'COMP': 'Science',
          'MATH': 'Science', 'STAT': 'Science',
          'PHYS': 'Science', 'MET': 'Science',
          'ORGA': 'Science', 'INOR': 'Science',
          'PHCH': 'Science', 'MECH': 'Science',
          'ELEC': 'Science', 'OPTI': 'Science',
          'BIO': 'Science', 'ZOOL': 'Science',
          'ECOL': 'Science', 'GENT': 'Science',
          'ALGE': 'Science', 'CALC': 'Science',
          'GEOL': 'Science', 'MING': 'Science',
          'GEOM': 'Science',
          
          // ========== 10. FACULTY OF VETERINARY MEDICINE & SURGERY (FVMS) - 15 codes ==========
          'VAPH': 'Veterinary Medicine and Surgery',
          'VMTP': 'Veterinary Medicine and Surgery',
          'VPMP': 'Veterinary Medicine and Surgery',
          'VETA': 'Veterinary Medicine and Surgery',
          'PARA': 'Veterinary Medicine and Surgery',
          'ANAV': 'Veterinary Medicine and Surgery',
          'VMED': 'Veterinary Medicine and Surgery',
          'VETS': 'Veterinary Medicine and Surgery',
          'VSUR': 'Veterinary Medicine and Surgery',
          'DVSO': 'Veterinary Medicine and Surgery',
          'VPAT': 'Veterinary Medicine and Surgery',
          'VPHE': 'Veterinary Medicine and Surgery',
          'DVET': 'Veterinary Medicine and Surgery',
          'VANA': 'Veterinary Medicine and Surgery',
          'VPHY': 'Veterinary Medicine and Surgery'
        };

        // EGERTON-ONLY STRICT DETECTION - EXACT MATCH ONLY
        const detectEgertonFaculty = (unitPrefix) => {
          if (!unitPrefix) return null;
          
          // ONLY EXACT MATCH
          const faculty = egerton_unit_mapping[unitPrefix];
          if (faculty) {
            return faculty;
          }
          
          return null;
        };
        
        // Faculty priority: user selection > extracted > Google Search > Semantic detection > code guessing > 'Unknown'
        let selectedFaculty = useCustomFaculty ? customFaculty : (faculty || fileExtractedMetadata?.faculty);
        
        // Try Google Search if faculty not selected by user and not found from PDF extraction
        if (!faculty && !customFaculty && !selectedFaculty && selectedUniversity && unit_code) {
          try {
            // Get university name from the universities list
            const universityObj = universities.find(u => u.id === selectedUniversity);
            if (universityObj?.name) {
              const searchResult = await searchUnitFaculty(universityObj.name, unit_code, unit_name);
              
              if (searchResult?.faculty) {
                selectedFaculty = searchResult.faculty;
              } 
            }
          } catch (error) {
            console.warn('⚠️ Google Search failed, trying smart Egerton detection:', error);
          }
        }
        
        // Fallback: Try Egerton strict detection (exact match only) - only if faculty not manually selected
        if (!faculty && !customFaculty && !selectedFaculty && unit_name) {
          const unitPrefix = unit_name.replace(/\d+/g, '').toUpperCase().trim();
          selectedFaculty = detectEgertonFaculty(unitPrefix);
          
        }
        
        // Fallback: Try to guess faculty from unit code/name - only if faculty not manually selected
        if (!faculty && !customFaculty && !selectedFaculty && unit_name) {
          selectedFaculty = guessFacultyFromUnitCode(unit_code, unit_name);
        }
        
        selectedFaculty = selectedFaculty || 'Unknown';
        
        // CRITICAL: Ensure university_id is NEVER null by defaulting to Egerton if undetected
        let finalUniversity = selectedUniversity;
        if (!finalUniversity && universities.length > 0) {
          // Default to Egerton University if no university detected
          const egerton = universities.find(u => u.name?.toLowerCase().includes('egerton'));
          if (egerton) {
            finalUniversity = egerton.id;
          } else {
            // If Egerton not found, use the first university in the list
            finalUniversity = universities[0]?.id;
          }
        }
        
        metadata = {
          university_id: finalUniversity || null,
          faculty: selectedFaculty,
          unit_code: unit_code || fileExtractedMetadata?.unitCode || '',
          unit_name: unit_name || fileExtractedMetadata?.unitName || '',
          year: (year && !isNaN(year)) ? Number(year) : (fileExtractedMetadata?.year || new Date().getFullYear()),
          semester: semester || fileExtractedMetadata?.semester || '',
          exam_type: exam_type || fileExtractedMetadata?.examType || 'Main',
          uploaded_by: userProfile?.id || userProfile?.uid || null
        };


        // Use the proper API function instead of direct fetch
        // This ensures data is saved with correct field names to the database

        // CHECK FOR DUPLICATES BEFORE UPLOADING
        const duplicateCheck = await checkDuplicatePastPaper({
          universityId: metadata.university_id,
          faculty: metadata.faculty,
          unitCode: metadata.unit_code,
          unitName: metadata.unit_name,
          year: metadata.year
        });

        if (duplicateCheck.exists) {
          
          // Log duplicate to history
          await logUploadHistory({
            fileName: file.name,
            status: 'duplicate',
            paperTitle: `${metadata.unit_code} - ${metadata.unit_name}`,
            universityId: metadata.university_id,
            faculty: metadata.faculty,
            unitCode: metadata.unit_code,
            unitName: metadata.unit_name,
            year: metadata.year,
            uploadedBy: userProfile?.id,
            isDuplicate: true
          });
          
          duplicates++;
          setDuplicatesCount(duplicates);
          internalShowToast(`⏭️ Skipped "${file.name}" - Paper already uploaded (${duplicateCheck.paper.unit_code} ${duplicateCheck.paper.unit_name} ${duplicateCheck.paper.year})`, 'warning');
          continue; // Skip to next file
        }


        const uploadFunction = asSubmission ? createPastPaperSubmission : createPastPaper;
        const pastPaperRecord = await uploadFunction({
          metadata: {
            title: `${metadata.unit_code} - ${metadata.unit_name}`,
            university_id: metadata.university_id,
            faculty: metadata.faculty,
            unit_code: metadata.unit_code,
            unit_name: metadata.unit_name,
            year: metadata.year,
            semester: metadata.semester,
            exam_type: metadata.exam_type
          },
          pdfFile: file
        });


        // Log successful upload to history
        await logUploadHistory({
          fileName: file.name,
          status: 'success',
          paperTitle: `${metadata.unit_code} - ${metadata.unit_name}`,
          universityId: metadata.university_id,
          faculty: metadata.faculty,
          unitCode: metadata.unit_code,
          unitName: metadata.unit_name,
          year: metadata.year,
          uploadedBy: userProfile?.id
        });

        uploaded++;
        setUploadedCount(uploaded);
        
        // Save progress to localStorage
        savePastPapersUploadState(selectedFiles, { current: i + 1, total: selectedFiles.length }, uploaded, failed, duplicates);
        
        // Clear past papers cache so newly uploaded papers appear immediately
        try { clearPastPapersCache(); } catch (e) {}
      } catch (error) {
        console.error(`❌ Failed to upload ${file.name}:`, error);
        console.error('Error details:', { 
          message: error?.message, 
          code: error?.code,
          stack: error?.stack
        });

        // Log failed upload to history
        await logUploadHistory({
          fileName: file.name,
          status: 'failed',
          paperTitle: `${metadata.unit_code} - ${metadata.unit_name}`,
          universityId: metadata.university_id,
          faculty: metadata.faculty,
          unitCode: metadata.unit_code,
          unitName: metadata.unit_name,
          year: metadata.year,
          uploadedBy: userProfile?.id,
          errorMessage: error?.message || 'Unknown error'
        }).catch(err => console.error('Failed to log error history:', err));

        failed++;
        setFailedCount(failed);
        
        // Save progress to localStorage even on failure
        savePastPapersUploadState(selectedFiles, { current: i + 1, total: selectedFiles.length }, uploaded, failed, duplicates);
      }
    }

    setUploading(false);
    
    // Clear localStorage when upload completes
    clearPastPapersUploadState();
    
    // Final cache clear to ensure all new papers are visible
    try { clearPastPapersCache(); } catch (e) {}
    
    let message = `Upload complete: ${uploaded} successful, ${duplicates} duplicates skipped, ${failed} failed`;
    if (failed > 0) {
      message += ' ❌ Check browser console for error details';
    }
    const messageType = failed === 0 ? 'success' : (duplicates > 0 ? 'warning' : 'error');
    internalShowToast(message, messageType);
    
    setTimeout(() => {
      setSelectedFiles([]);
      setUploadProgress({ current: 0, total: 0 });
      setUniversity('');
      setFaculty('');
      setCustomFaculty('');
      setUseCustomFaculty(false);
      setFaculties([]);
      setExtractedMetadata(null);
    }, 2000);
  };

  const handlePausePastPapers = () => {
    pauseRef.current = true;
    setPaused(true);
    
    // CRITICAL: Save state immediately when pause is clicked
    savePastPapersUploadState(selectedFiles, uploadProgress, uploadedCount, failedCount, duplicatesCount, true, true);
    
    internalShowToast('Upload paused', 'info');
  };

  const handleResumePastPapers = async () => {
    
    pauseRef.current = false;
    setPaused(false);
    
    // CRITICAL: Call uploadFiles() again to continue from saved index
    if (selectedFiles && selectedFiles.length > 0) {
      await uploadFiles();
    }
    
    internalShowToast('Upload resumed', 'info');
  };
  handleResumePastPapersRef.current = handleResumePastPapers;

  const handleCancelPastPapers = () => {
    uploadAbortRef.current = true;
    pauseRef.current = false;
    setUploading(false);
    setPaused(false);
    internalShowToast('Upload cancelled', 'info');
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setUploadProgress({ current: 0, total: 0 });
    setUploadedCount(0);
    setFailedCount(0);
    setUniversity('');
    setFaculty('');
    setCustomFaculty('');
    setUseCustomFaculty(false);
    setFaculties([]);
    setExtractedMetadata(null);
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  // Check if we have a paused upload in localStorage (for immediate UI rendering before state updates)
  const savedPastPapersState = (() => {
    try {
      const saved = localStorage.getItem('pastPapersUploadState');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.fileNames && state.fileNames.length > 0 && (state.paused || state.uploading)) {
          return state;
        }
      }
    } catch (e) {
      console.error('⚡ [PAST PAPERS QUICK CHECK] Error:', e);
    }
    return null;
  })();

  const progressPercent = (uploadProgress.total || savedPastPapersState?.total || 0) > 0 ? ((uploadProgress.current || savedPastPapersState?.currentIndex + 1 || 0) / (uploadProgress.total || savedPastPapersState?.total || 0)) * 100 : 0;
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;

  return (
    <div className="panel">
      <style>{`
        div[style*="overflowY"]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#e9edef', fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' }}>
          Bulk Upload Past Papers from Folder
        </h2>
        <p style={{ color: '#8696a0', fontSize: '13px', margin: '0' }}>
          Select a folder to upload multiple past papers with automatic metadata extraction
        </p>
      </div>

      {asSubmission && (
        <div style={{
          marginBottom: '15px',
          padding: '10px 12px',
          background: '#1f2c33',
          border: '1px solid #00a884',
          borderRadius: '6px',
          color: '#00a884',
          fontSize: '12px'
        }}>
          📋 Your uploads will be reviewed and appear after approval
        </div>
      )}

      {/* Main Content */}
      {selectedFiles.length === 0 && !canResumePastPapers ? (
        // Upload Area
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => folderInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#00a884' : '#374151'}`,
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(0, 168, 132, 0.08)' : '#0b141a',
            transition: 'all 0.2s'
          }}
        >
          <FiFolder size={40} style={{ color: '#00a884', marginBottom: '12px' }} />
          <h3 style={{ color: '#e9edef', fontSize: '16px', fontWeight: '500', margin: '0 0 4px 0' }}>
            Select Folder or Drag & Drop
          </h3>
          <p style={{ color: '#8696a0', fontSize: '13px', margin: '0' }}>
            Choose a folder with past paper PDF files
          </p>
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory="true"
            directory=""
            multiple
            onChange={handleFolderSelect}
            style={{ display: 'none' }}
            accept=".pdf"
          />
        </div>
      ) : canResumePastPapers && selectedFiles.length === 0 ? (
        // Resume Previous Upload Section
        <>
          {/* File List */}
          <div style={{
            background: '#0b141a',
            border: '1px solid #1f2c33',
            borderRadius: '8px',
            marginBottom: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1f2c33',
              background: '#0b141a'
            }}>
              <div style={{ color: '#e9edef', fontSize: '13px', fontWeight: '500' }}>
                Files ({(resumeStatePastPapers || savedPastPapersState)?.fileNames?.length || 0}) • resuming...
              </div>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {(resumeStatePastPapers || savedPastPapersState) && (resumeStatePastPapers || savedPastPapersState).fileNames ? (
                (resumeStatePastPapers || savedPastPapersState).fileNames.map((fileName, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: '1px solid #1f2c33',
                      color: '#8696a0',
                      fontSize: '12px'
                    }}
                  >
                    <FiFile size={14} style={{ marginRight: '8px', color: '#00a884' }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName}
                    </span>
                  </div>
                ))
              ) : null}
            </div>
          </div>

          {/* Progress */}
          {(uploading || savedPastPapersState) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                color: '#8696a0',
                fontSize: '12px'
              }}>
                <span>Progress: {uploadProgress.current || (savedPastPapersState?.currentIndex + 1) || 0} / {uploadProgress.total || savedPastPapersState?.total || 0}</span>
                <span>✓ {uploadedCount || savedPastPapersState?.uploaded || 0} | ⏭️ {duplicatesCount || savedPastPapersState?.duplicates || 0} | ✗ {failedCount || savedPastPapersState?.failed || 0}</span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#1f2c33',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: '#00a884',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}

          {/* Resume Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleResumePastPapers}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#00a884',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FiPlay size={14} />
              Resume Previous Upload
            </button>
            <button
              onClick={handleCancelPastPapers}
              style={{
                padding: '10px 16px',
                background: '#374151',
                color: '#e9edef',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear
            </button>
          </div>
        </>
      ) : (
        <>
          {/* University and Faculty Selection - Side by Side */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* University Selection */}
            <div style={{
              background: '#0b141a',
              border: '1px solid #1f2c33',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <label style={{ color: '#e9edef', fontSize: '13px', fontWeight: '500', marginBottom: '6px', display: 'block' }}>
                Select University
              </label>
              <select
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#1f2c33',
                  color: '#ffffff',
                  border: university ? '2px solid #00a884' : '1px solid #374151',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                  marginBottom: '0',
                  fontWeight: university ? '600' : '400'
                }}
              >
                <option value="">-- Select University --</option>
                {universities.map(uni => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty Selection */}
            {university && (
              <div style={{
                background: '#0b141a',
                border: '1px solid #1f2c33',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <label style={{ color: '#e9edef', fontSize: '13px', fontWeight: '500', marginBottom: '6px', display: 'block' }}>
                  Select Faculty
                </label>
                {!useCustomFaculty ? (
                  <select
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    disabled={uploading || faculties.length === 0}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1f2c33',
                      color: '#ffffff',
                      border: faculty ? '2px solid #00a884' : '1px solid #374151',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      outline: 'none',
                      marginBottom: '0',
                      fontWeight: faculty ? '600' : '400'
                    }}
                  >
                    <option value="">
                      {faculties.length === 0 ? 'No faculties available' : 'Select Faculty (Optional)'}
                    </option>
                    {faculties.map(fac => (
                      <option key={fac} value={fac}>
                        {fac}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g., Engineering, Business, Arts"
                    value={customFaculty}
                    onChange={(e) => setCustomFaculty(e.target.value)}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1f2c33',
                      color: '#ffffff',
                      border: customFaculty ? '2px solid #00a884' : '1px solid #374151',
                      borderRadius: '6px',
                      fontSize: '13px',
                      outline: 'none',
                      marginBottom: '0',
                      fontWeight: customFaculty ? '600' : '400',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#00a884')}
                    onBlur={(e) => (e.target.style.borderColor = customFaculty ? '#00a884' : '#374151')}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0' }}>
                  <input
                    type="checkbox"
                    id="custom-faculty-toggle"
                    checked={useCustomFaculty}
                    onChange={(e) => {
                      setUseCustomFaculty(e.target.checked);
                      if (!e.target.checked) {
                        setCustomFaculty('');
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      accentColor: '#00a884'
                    }}
                    disabled={uploading}
                  />
                  <label htmlFor="custom-faculty-toggle" style={{ color: '#8696a0', fontSize: '12px', cursor: 'pointer', margin: '0' }}>
                    Enter custom faculty name
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* File List */}
          <div style={{
            background: '#0b141a',
            border: '1px solid #1f2c33',
            borderRadius: '8px',
            marginBottom: '20px',
            marginTop: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1f2c33',
              background: '#0b141a'
            }}>
              <div style={{ color: '#e9edef', fontSize: '13px', fontWeight: '500' }}>
                Files ({selectedFiles.length > 0 ? selectedFiles.length : ((resumeStatePastPapers || savedPastPapersState)?.fileNames?.length || 0)}) • {selectedFiles.length > 0 ? totalSize.toFixed(1) : 'resuming...'} MB
              </div>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {selectedFiles.length > 0 ? (
                selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: '1px solid #1f2c33',
                      color: '#8696a0',
                      fontSize: '12px'
                    }}
                  >
                    <FiFile size={14} style={{ marginRight: '8px', color: '#00a884' }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <span style={{ marginLeft: '8px', color: '#374151' }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ))
              ) : (resumeStatePastPapers || savedPastPapersState) && (resumeStatePastPapers || savedPastPapersState).fileNames ? (
                (resumeStatePastPapers || savedPastPapersState).fileNames.map((fileName, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: '1px solid #1f2c33',
                      color: '#8696a0',
                      fontSize: '12px'
                    }}
                  >
                    <FiFile size={14} style={{ marginRight: '8px', color: '#00a884' }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName}
                    </span>
                  </div>
                ))
              ) : null}
            </div>
          </div>

          {/* Progress */}
          {(uploading || savedPastPapersState) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                color: '#8696a0',
                fontSize: '12px'
              }}>
                <span>Progress: {uploadProgress.current || (savedPastPapersState?.currentIndex + 1) || 0} / {uploadProgress.total || savedPastPapersState?.total || 0}</span>
                <span>✓ {uploadedCount || savedPastPapersState?.uploaded || 0} | ⏭️ {duplicatesCount || savedPastPapersState?.duplicates || 0} | ✗ {failedCount || savedPastPapersState?.failed || 0}</span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#1f2c33',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: '#00a884',
                  transition: 'width 0.3s'
                }} />
              </div>
              {uploadedCount > 0 && (
                <div style={{
                  marginTop: '8px',
                  color: '#00a884',
                  fontSize: '12px'
                }}>
                  ✓ {uploadedCount} uploaded
                </div>
              )}
              {failedCount > 0 && (
                <div style={{
                  marginTop: '4px',
                  color: '#ea4335',
                  fontSize: '12px'
                }}>
                  ✗ {failedCount} failed
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {!uploading && !savedPastPapersState && (
              <>
                <button
                  onClick={uploadFiles}
                  disabled={selectedFiles.length === 0}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: selectedFiles.length === 0 ? '#374151' : '#00a884',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background 0.2s'
                  }}
                >
                  🚀 Upload {selectedFiles.length} Files
                </button>
                <button
                  onClick={clearSelection}
                  style={{
                    padding: '10px 16px',
                    background: '#374151',
                    color: '#e9edef',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </>
            )}
            {(uploading || savedPastPapersState) && (
              <>
                <button
                  disabled={true}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: uploading ? '#00a88466' : '#374151',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: uploading ? 0.6 : 1
                  }}
                >
                  <FiRefreshCw style={{ animation: paused ? 'none' : 'spin 1s linear infinite' }} />
                  {paused ? 'Paused' : 'Uploading...'}
                </button>
                {!paused ? (
                  <button
                    onClick={handlePausePastPapers}
                    style={{
                      padding: '10px 16px',
                      background: '#f1b233',
                      color: '#1f2c33',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <FiPause size={14} />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handleResumePastPapers}
                    style={{
                      padding: '10px 16px',
                      background: '#00a884',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <FiPlay size={14} />
                    Resume
                  </button>
                )}
                <button
                  onClick={handleCancelPastPapers}
                  style={{
                    padding: '10px 16px',
                    background: '#ea4335',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FiX size={14} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </>
      )}

    </div>
  );
};

// Main TabContainer Component
const AutoUpload = ({ userProfile, asSubmission = false }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('books'); // 'books' or 'pastpapers'
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const tabStyles = `
    .autoupload-tabs-container {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 2px solid #374151;
    }
    .autoupload-tab-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: transparent;
      border: none;
      color: #8696a0;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      transition: all 0.3s ease;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
    }
    .autoupload-tab-button:hover {
      color: #e9edef;
      background: rgba(0, 168, 132, 0.05);
    }
    .autoupload-tab-button.active {
      color: #00a884;
      border-bottom-color: #00a884;
    }
  `;

  return (
    <>
      <style>{tabStyles}</style>
      
      <div className="panel">
        {/* Tab Buttons and History Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="autoupload-tabs-container">
            <button
              className={`autoupload-tab-button ${activeTab === 'books' ? 'active' : ''}`}
              onClick={() => setActiveTab('books')}
            >
              <FiBook size={18} />
              Books Auto Upload
            </button>
            <button
              className={`autoupload-tab-button ${activeTab === 'pastpapers' ? 'active' : ''}`}
              onClick={() => setActiveTab('pastpapers')}
            >
              <FiFileText size={18} />
              Past Papers Auto Upload
            </button>
          </div>
          <button
            onClick={() => navigate('/books/admin/upload-history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#0a1419',
              color: '#e9edef',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#121f28';
              e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#0a1419';
              e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.4)';
            }}
          >
            <FiClock size={16} />
            History
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ marginTop: '20px' }}>
          {activeTab === 'books' && (
            <BooksAutoUploadContent userProfile={userProfile} asSubmission={asSubmission} showToast={showToast} />
          )}
          {activeTab === 'pastpapers' && (
            <PastPapersAutoUploadContent userProfile={userProfile} asSubmission={asSubmission} showToast={showToast} />
          )}
        </div>
      </div>

      {/* Global Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          maxWidth: '300px',
          width: 'calc(100% - 40px)',
          background: toast.type === 'error' ? '#ea4335' : toast.type === 'success' ? '#00a884' : '#374151',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '6px',
          zIndex: 10001,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          animation: 'slideIn 0.3s ease'
        }}>
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ'} {toast.message}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default AutoUpload;
