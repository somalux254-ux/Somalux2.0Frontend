import React, { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { UploadHistory } from '../components/UploadHistory';
import { clearAllUploadHistory } from '../pastPapersApi';

const UploadHistoryPage = ({ userProfile }) => {
  const [isClearing, setIsClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleClearAllHistory = async () => {
    if (window.confirm('Are you sure you want to delete ALL upload history? This action cannot be undone.')) {
      try {
        setIsClearing(true);
        await clearAllUploadHistory();
        // Force a complete refresh
        setRefreshKey(prev => prev + 1);
        alert('Upload history cleared successfully!');
      } catch (err) {
        console.error('Failed to clear history:', err);
        alert('Failed to clear upload history. Please try again.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="panel" style={{ minHeight: '500px', background: '#111b21', color: '#e9edef' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px' }}>
        <h2 style={{ 
          color: '#e9edef', 
          fontSize: '1.1rem', 
          fontWeight: '600', 
          margin: 0
        }}>
          Upload History
        </h2>
        <button
          onClick={handleClearAllHistory}
          disabled={isClearing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '14px',
            background: '#ea4335',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isClearing ? 'not-allowed' : 'pointer',
            opacity: isClearing ? 0.6 : 1
          }}
        >
          <FiTrash2 size={16} />
          {isClearing ? 'Clearing...' : 'Clear All History'}
        </button>
      </div>
      
      <style>{`
        /* Dark theme overrides for UploadHistory component - Exact admin colors */
        .upload-history-panel {
          background: transparent;
          color: #e9edef;
          box-shadow: none;
          padding: 0;
          max-height: none;
          overflow: visible;
          border: none;
        }

        .upload-history-header {
          display: none; /* Hide header since we have one above */
        }

        .stats-grid {
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        .stat-card {
          background: #111b21;
          border: 1px solid #2a3942;
          border-left: 4px solid #9ca3af;
          border-radius: 4px;
          padding: 12px;
          color: #e9edef;
          position: relative;
          transition: transform 0.2s;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-card:hover {
          transform: translateY(-2px);
        }

        .stat-card.success {
          background: #111b21;
          border-left-color: #00a884;
        }

        .stat-card.warning {
          background: #111b21;
          border-left-color: #f1b233;
        }

        .stat-card.error {
          background: #111b21;
          border-left-color: #ea4335;
        }

        .stat-label {
          color: #8696a0;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .stat-value {
          color: #e9edef;
          font-size: 1.1rem;
          font-weight: 700;
          margin-top: 2px;
          margin-bottom: 2px;
        }

        .stat-icon {
          display: none;
        }

        .filters {
          background: transparent;
          border: none;
          padding: 12px 0;
          border-radius: 6px;
          margin-bottom: 20px;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-group {
          color: #8696a0;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          gap: 8px;
          align-items: center;
          margin-right: 8px;
        }

        .filter-btn {
          padding: 6px 12px;
          background: #1f2c33;
          border: 1px solid #374151;
          color: #8696a0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: #00a884;
          color: #00a884;
          background: rgba(0, 168, 132, 0.08);
        }

        .filter-btn.active {
          background: #00a884;
          border-color: #00a884;
          color: #fff;
        }

        .filter-btn.success.active {
          background: #00a884;
          border-color: #00a884;
        }

        .filter-btn.warning.active {
          background: #f1b233;
          border-color: #f1b233;
          color: #1f2937;
        }

        .filter-btn.error.active {
          background: #ea4335;
          border-color: #ea4335;
        }

        .history-table-container {
          border: 1px solid #2a3942;
          border-radius: 6px;
          background: transparent;
          overflow-x: auto;
          margin-bottom: 20px;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          color: #e9edef;
        }

        .history-table thead {
          background: #1f2c33;
          border-bottom: 2px solid #2a3942;
        }

        .history-table th {
          color: #8696a0;
          background: #1f2c33;
          font-weight: 600;
          padding: 12px;
          text-align: left;
          white-space: nowrap;
        }

        .history-table tbody tr {
          border-bottom: 1px solid #2a3942;
          transition: background-color 0.2s;
        }

        .history-table tbody tr:hover {
          background: rgba(0, 168, 132, 0.08);
        }

        .history-table td {
          color: #e9edef;
          padding: 12px;
        }

        .history-table tr.status-success td {
          background-color: rgba(0, 168, 132, 0.08);
        }

        .history-table tr.status-failed td {
          background-color: rgba(234, 67, 53, 0.08);
        }

        .history-table tr.status-duplicate td {
          background-color: rgba(241, 178, 51, 0.08);
        }

        .status-cell {
          min-width: 120px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 12px;
        }

        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
          background: #1f2c33;
          color: #8696a0;
        }

        .badge.success {
          background: rgba(0, 168, 132, 0.2);
          color: #00a884;
        }

        .badge.error {
          background: rgba(234, 67, 53, 0.2);
          color: #ea4335;
        }

        .badge.warning {
          background: rgba(241, 178, 51, 0.2);
          color: #f1b233;
        }

        .file-name {
          max-width: 200px;
          word-break: break-word;
        }

        .file-name span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .error-detail {
          font-size: 11px;
          color: #ea4335;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid rgba(234, 67, 53, 0.2);
          word-break: break-word;
          white-space: normal;
        }

        .date {
          font-size: 12px;
          color: #8696a0;
          white-space: nowrap;
        }

        .loading,
        .empty-state {
          color: #8696a0;
          padding: 40px;
          text-align: center;
          font-size: 14px;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
        }

        .pagination-btn {
          padding: 6px 12px;
          background: #1f2c33;
          border: 1px solid #374151;
          color: #8696a0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .pagination-btn:hover:not(:disabled) {
          background: #00a884;
          border-color: #00a884;
          color: #fff;
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          color: #8696a0;
          font-size: 13px;
        }

        .close-btn {
          display: none;
        }
      `}</style>

      <UploadHistory 
        reloadTrigger={refreshKey}
        userProfile={userProfile} 
        onClose={() => {}} 
      />
    </div>
  );
};

export default UploadHistoryPage;
