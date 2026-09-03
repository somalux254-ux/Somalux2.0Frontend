import React, { useState, useMemo, useEffect } from 'react';
import { FiX, FiCopy, FiDownload } from 'react-icons/fi';
import { generateSummary, generateKeyPoints, getTextStats } from './utils/summarizeText';
import './SummaryModal.css';

const SummaryModal = ({ isOpen, pageNumber, pageText, title, onClose }) => {
  const [summaryLength, setSummaryLength] = useState(5);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'keypoints'
  const [copied, setCopied] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const summary = useMemo(() => {
    if (!pageText) return '';
    return generateSummary(pageText, summaryLength);
  }, [pageText, summaryLength]);

  const keyPoints = useMemo(() => {
    if (!pageText) return [];
    return generateKeyPoints(pageText, summaryLength);
  }, [pageText, summaryLength]);

  const stats = useMemo(() => {
    return getTextStats(pageText);
  }, [pageText]);

  const handleCopy = () => {
    const textToCopy = viewMode === 'summary' ? summary : keyPoints.join('\n• ');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const textToCopy = viewMode === 'summary' ? summary : keyPoints.join('\n• ');
    const element = document.createElement('a');
    const file = new Blob([textToCopy], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${title}-page-${pageNumber}-${viewMode}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!isOpen) return null;

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div className="summary-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="summary-modal-header">
          <div className="summary-modal-title">
            <h3>{title}</h3>
            <span className="summary-page-badge">Page {pageNumber}</span>
          </div>
          <button onClick={onClose} className="summary-modal-close" title="Close">
            <FiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="summary-modal-tabs">
          <button
            className={`summary-tab ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            Summary
          </button>
          <button
            className={`summary-tab ${viewMode === 'keypoints' ? 'active' : ''}`}
            onClick={() => setViewMode('keypoints')}
          >
            Key Points
          </button>
        </div>

        {/* Length Control */}
        <div className="summary-length-control">
          <label>Summary Length:</label>
          <input
            type="range"
            min="2"
            max="10"
            value={summaryLength}
            onChange={(e) => setSummaryLength(parseInt(e.target.value))}
            className="summary-slider"
          />
          <span className="summary-length-value">{summaryLength} {viewMode === 'summary' ? 'sentences' : 'points'}</span>
        </div>

        {/* Content */}
        <div className="summary-modal-body">
          {viewMode === 'summary' ? (
            <div className="summary-text">
              <p>{summary}</p>
            </div>
          ) : (
            <div className="summary-keypoints">
              <ul>
                {keyPoints.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Words:</span>
            <span className="stat-value">{stats.words}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Sentences:</span>
            <span className="stat-value">{stats.sentences}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Chars:</span>
            <span className="stat-value">{stats.characters}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="summary-modal-actions">
          <button
            onClick={handleCopy}
            className={`summary-action-btn ${copied ? 'success' : ''}`}
            title="Copy to clipboard"
          >
            <FiCopy size={16} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleDownload} className="summary-action-btn" title="Download as text">
            <FiDownload size={16} />
            Download
          </button>
          <button onClick={onClose} className="summary-action-btn cancel">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
