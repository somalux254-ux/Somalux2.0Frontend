import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const ProgressContainer = styled(motion.div)`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(20, 30, 48, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 9999;
`;

const ProgressLabel = styled.div`
  color: #e5e7eb;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProgressBarBg = styled.div`
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressBarFill = styled(motion.div)`
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 3px;
`;

const ProgressStats = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #9ca3af;
  gap: 8px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #e5e7eb;
  }
`;

/**
 * DownloadProgressTracker - Shows download progress with speed and time estimates
 */
export const DownloadProgressTracker = ({
  isVisible,
  filename,
  progress,
  downloadedBytes,
  totalBytes,
  speed,
  timeRemaining,
  onClose,
}) => {
  const [startTime] = useState(Date.now());

  if (!isVisible) return null;

  const progressPercent = Math.min(progress || 0, 100);
  const speedMBps = speed ? (speed / (1024 * 1024)).toFixed(2) : '0.00';

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === Infinity) return '--:--';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <ProgressContainer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <CloseButton onClick={onClose}>✕</CloseButton>
      
      <ProgressLabel title={filename}>
        📥 {filename}
      </ProgressLabel>

      <ProgressBarBg>
        <ProgressBarFill
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </ProgressBarBg>

      <ProgressStats>
        <span>{progressPercent.toFixed(0)}%</span>
        <span>{formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}</span>
        <span>{speedMBps} MB/s</span>
        <span>{formatTime(timeRemaining)}</span>
      </ProgressStats>
    </ProgressContainer>
  );
};

export default DownloadProgressTracker;
