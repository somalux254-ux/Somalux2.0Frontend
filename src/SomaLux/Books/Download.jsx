import React, { useState, useRef } from 'react';
import { FiDownload, FiFolder } from 'react-icons/fi';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { downloadOptimizer } from '../../utils/DownloadOptimizer';
import { checkDownloadLimit, recordDownload } from '../../utils/downloadLimitService';
import { getSelectedFolder, setSelectedFolder } from '../utils/downloadFolderManager';
import DownloadLimitModal from './DownloadLimitModal';
import FolderSelectModal from '../PastPapersDownloader/FolderSelectModal';

const IconDownloadButton = styled(motion.button)`
  background: transparent; /* Keep background transparent */
  border: none;
  cursor: pointer;
  padding: 8px;
  color: #d3d3d3; /* Changed text/icon color to lightgrey */
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  margin-left: 0; /* Aligns to the left corner */

  &:hover {
    color: #b0b0b0; /* Slightly darker lightgrey for hover effect */
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const FullDownloadButton = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #2a3942;
  background: transparent;
  color: #e5e7eb;
  cursor: pointer;
  transition: transform .15s ease, background .15s ease, border-color .15s ease;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  flex: 0 1 auto;
  min-width: auto;

  &:hover {
    transform: translateY(-1px);
    border-color: #6366f1;
    background: transparent;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  /* When used with BookPanel styles */
  &.btn-readBKP {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid #2a3942;
    background: transparent;
    color: #e5e7eb;
    font-size: 0.8rem;
    font-weight: 500;
    display: inline-flex;
    gap: 6px;
  }

  &.btn-readBKP:hover {
    transform: translateY(-1px);
    border-color: #6366f1;
    background: transparent;
  }

  &.btn-readBKP.btn-action-primaryBKP:first-child:hover {
    border-color: #06b6d4;
    color: #06b6d4;
  }
  
  @media (max-width: 640px) {
    padding: 5px 8px;
    font-size: 0.75rem;
    gap: 4px;
  }
  
  @media (max-width: 480px) {
    padding: 4px 6px;
    font-size: 0.7rem;
    gap: 3px;
  }
`;

// High-speed download utility with streaming and caching
const highSpeedDownload = async (url, filename, folderPath = null) => {
  try {
    // Use DownloadOptimizer for maximum performance
    const response = await fetch(url, {
      method: 'GET',
      cache: 'force-cache', // Use browser cache aggressively
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Priority': 'high',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const chunks = [];

    // Stream response for memory efficiency
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Create blob from chunks
    const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });

    // Trigger download immediately - include folder path in filename if provided
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = folderPath ? `${folderPath}/${filename}` : filename;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 50);

    // Store in IndexedDB for offline access
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open('SomaLuxDownloads', 1);
          req.onupgradeneeded = (e) => {
            const objStore = e.target.result.createObjectStore('files', { keyPath: 'filename' });
            objStore.createIndex('timestamp', 'timestamp', { unique: false });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const transaction = db.transaction('files', 'readwrite');
        transaction.objectStore('files').put({
          filename,
          blob,
          timestamp: Date.now(),
          size: blob.size,
        });
      } catch (e) {
        console.warn('IndexedDB storage failed:', e);
      }
    }
  } catch (error) {
    console.error('High-speed download failed:', error);
    throw error;
  }
};

export const Download = ({
  book,
  file,
  paper,
  variant = 'icon',
  onDownloadStart,
  onDownloadComplete,
  downloadText = 'Save',
  downloadingText = 'Saving...',
  user,
  onUpgradeClick,
  className,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState(null);
  const [selectedFolder, setSelectedFolderState] = useState(() => getSelectedFolder());
  const [showFolderModal, setShowFolderModal] = useState(false);
  const abortControllerRef = useRef(null);

  // Handle case where neither book nor file is provided
  if (!book && !file) {
    return null;
  }

  const handleDownload = async (e) => {
    e.stopPropagation();

    // Check download limit for non-premium users
    const limitCheck = checkDownloadLimit(user);
    if (!limitCheck.allowed) {
      setLimitInfo(limitCheck);
      setShowLimitModal(true);
      return;
    }

    try {
      if (onDownloadStart) {
        const ok = await onDownloadStart();
        if (ok === false) return;
      }
    } catch {
      return;
    }

    setDownloading(true);
    abortControllerRef.current = new AbortController();

    try {
      // If a direct file URL is provided
      if (file) {
        await highSpeedDownload(
          file.url,
          file.filename || file.url.split('/').pop(),
          selectedFolder
        );
        // Record the download
        await recordDownload(user, 'file', file.id || file.filename, file.filename);
      }
      // If a book object is provided (legacy support)
      else if (book) {
        if (book.downloadUrl) {
          // If book has a direct download URL
          await highSpeedDownload(
            book.downloadUrl,
            book.downloadFilename || `${book.title.replace(/\s+/g, '_')}.${book.fileFormat || 'txt'}`,
            selectedFolder
          );
          // Record the download
          await recordDownload(user, 'book', book.id, book.title);
        } else {
          // Fallback to generating a sample text file (original behavior)
          await generateSampleDownload(book, selectedFolder);
          // Record the download
          await recordDownload(user, 'book_sample', book.id, book.title);
        }
      }

      setDownloading(false);
      if (onDownloadComplete) onDownloadComplete();
    } catch (error) {
      setDownloading(false);
      console.error('Download failed:', error);
      if (onDownloadComplete) onDownloadComplete(error);
    }
  };

  const generateSampleDownload = (book, folderPath = null) => {
    const sampleContent = `${book.title} - Sample\nby ${book.author}\n\n${book.sampleText || 'No sample content available'}`;
    const blob = new Blob([sampleContent], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = folderPath ? `${folderPath}/${book.title.replace(/\s+/g, '_')}_Sample.txt` : `${book.title.replace(/\s+/g, '_')}_Sample.txt`;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 50);
  };

  if (variant === 'full') {
    return (
      <>
        <FolderSelectModal
          isOpen={showFolderModal}
          onClose={() => setShowFolderModal(false)}
          onFolderSelect={(folder) => {
            setSelectedFolderState(folder);
            setSelectedFolder(folder);
          }}
          currentFolder={selectedFolder}
        />
        <FullDownloadButton
          onClick={handleDownload}
          disabled={downloading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          aria-label={`Download ${book?.title || paper?.title || file?.filename || 'file'}`}
          className={className}
          style={{ borderColor: '#06b6d4', color: '#06b6d4' }}
        >
          <FiDownload size={18} />
          {downloading ? downloadingText : downloadText}
        </FullDownloadButton>
        <DownloadLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          remaining={limitInfo?.remaining}
          limit={limitInfo?.limit}
          error={limitInfo?.error}
          onUpgradeClick={() => {
            setShowLimitModal(false);
            onUpgradeClick?.();
          }}
        />
      </>
    );
  }

  return (
    <>
      <FolderSelectModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onFolderSelect={(folder) => {
          setSelectedFolderState(folder);
          setSelectedFolder(folder);
        }}
        currentFolder={selectedFolder}
      />
      <IconDownloadButton
        onClick={handleDownload}
        disabled={downloading}
        title={`Download ${book?.title || file?.filename || 'file'}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label={`Download ${book?.title || file?.filename || 'file'}`}
      >
        <FiDownload size={18} />
      </IconDownloadButton>
      <DownloadLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        remaining={limitInfo?.remaining}
        limit={limitInfo?.limit}
        error={limitInfo?.error}
        onUpgradeClick={() => {
          setShowLimitModal(false);
          onUpgradeClick?.();
        }}
      />
    </>
  );
};