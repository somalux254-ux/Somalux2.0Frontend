import React, { useState } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import './DownloadModal.css';

const DownloadModal = ({ isOpen, onClose, onDownloadPDF, onDownloadSummary, bookmarkCount }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePDFDownload = async () => {
    setIsLoading(true);
    try {
      await onDownloadPDF();
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  const handleSummaryDownload = async () => {
    setIsLoading(true);
    try {
      await onDownloadSummary();
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="download-modal-overlay" onClick={onClose}>
      <div className="download-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="download-modal-header">
          <h3>Download Bookmarked Pages</h3>
          <button onClick={onClose} className="download-modal-close">
            <FiX size={20} />
          </button>
        </div>

        {/* Info */}
        <div className="download-modal-info">
          <p>You have <strong>{bookmarkCount}</strong> bookmarked page{bookmarkCount !== 1 ? 's' : ''}. Choose how you'd like to download:</p>
        </div>

        {/* Options */}
        <div className="download-options">
          {/* Raw Pages PDF */}
          <div className="download-option">
            <div className="option-header">
              <div className="option-icon pdf">📄</div>
              <div className="option-title">
                <h4>Raw Pages</h4>
                <p>Download original bookmarked pages</p>
              </div>
            </div>
            <div className="option-details">
              <span className="option-format">PDF Format</span>
              <button
                onClick={handlePDFDownload}
                disabled={isLoading}
                className="download-btn pdf"
              >
                <FiDownload size={16} />
                {isLoading ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* Summary Document */}
          <div className="download-option">
            <div className="option-header">
              <div className="option-icon docx">📝</div>
              <div className="option-title">
                <h4>Summary</h4>
                <p>Download summaries of all bookmarked pages</p>
              </div>
            </div>
            <div className="option-details">
              <span className="option-format">DOCX Format</span>
              <button
                onClick={handleSummaryDownload}
                disabled={isLoading}
                className="download-btn docx"
              >
                <FiDownload size={16} />
                {isLoading ? 'Downloading...' : 'Download Word'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="download-modal-footer">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
