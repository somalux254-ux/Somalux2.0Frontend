import React from 'react';
import './DownloadLimitModal.css';

const DownloadLimitModal = ({ 
  isOpen, 
  onClose, 
  remaining, 
  limit, 
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className="download-limit-modal-overlay" onClick={onClose}>
      <div className="download-limit-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Message */}
        <div className="download-limit-modal-body">
          <h3 className="limit-title">Daily Download Limit</h3>
          <p className="limit-message">You've reached your {limit} downloads for today</p>
        </div>

        {/* Actions */}
        <div className="download-limit-modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadLimitModal;
