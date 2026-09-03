import React, { useState, useEffect } from 'react';
import { FiDownload, FiFilter, FiX, FiTrendingUp, FiCheckCircle, FiAlertCircle, FiSkipBack, FiTrash2 } from 'react-icons/fi';
import { fetchUploadHistory, getUploadHistoryStats, clearAllUploadHistory } from '../pastPapersApi';
import '../styles/UploadHistory.css';

export const UploadHistory = ({ userProfile, onClose, reloadTrigger = 0 }) => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ today: 0, total: 0, duplicates: 0, failed: 0, successful: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const pageSize = 20;

  const loadHistory = async (pageNum = page, filterStatus = statusFilter) => {
    try {
      setLoading(true);
      const result = await fetchUploadHistory({
        page: pageNum,
        pageSize,
        status: filterStatus
      });
      setHistory(result.data || []);
      setTotalCount(result.count || 0);
    } catch (err) {
      console.error('Failed to load upload history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await getUploadHistoryStats();
      setStats(stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Load data when page or filter changes
  useEffect(() => {
    loadHistory(page, statusFilter);
    loadStats();
  }, [page, statusFilter]);

  // Reset and reload when reloadTrigger changes
  useEffect(() => {
    console.log('Clearing history from UI');
    setHistory([]);
    setTotalCount(0);
    setStats({ today: 0, total: 0, duplicates: 0, failed: 0, successful: 0 });
    setPage(1);
    setStatusFilter(null);
  }, [reloadTrigger]);

  // Initial load on mount
  useEffect(() => {
    loadHistory(1, null);
    loadStats();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="badge success">✓ Success</span>;
      case 'failed':
        return <span className="badge error">✗ Failed</span>;
      case 'duplicate':
        return <span className="badge warning">⏭️ Duplicate</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <FiCheckCircle style={{ color: '#00a884' }} />;
      case 'failed':
        return <FiAlertCircle style={{ color: '#ea4335' }} />;
      case 'duplicate':
        return <FiSkipBack style={{ color: '#f1b233' }} />;
      default:
        return null;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleClearAllHistory = async () => {
    if (window.confirm('Are you sure you want to delete ALL upload history? This action cannot be undone.')) {
      try {
        setIsClearing(true);
        await clearAllUploadHistory();
        await loadHistory();
        await loadStats();
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
    <div className="upload-history-panel">
      <div className="upload-history-header">
        <h2>Upload History</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn danger"
            onClick={handleClearAllHistory}
            disabled={isClearing || history.length === 0}
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
              cursor: isClearing || history.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isClearing || history.length === 0 ? 0.6 : 1
            }}
          >
            <FiTrash2 size={16} />
            {isClearing ? 'Clearing...' : 'Clear All History'}
          </button>
          <button className="close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value">{stats.today}</div>
          <div className="stat-icon"><FiTrendingUp /></div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Successful</div>
          <div className="stat-value">{stats.successful}</div>
          <div className="stat-icon"><FiCheckCircle /></div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Duplicates</div>
          <div className="stat-value">{stats.duplicates}</div>
          <div className="stat-icon"><FiSkipBack /></div>
        </div>
        <div className="stat-card error">
          <div className="stat-label">Failed</div>
          <div className="stat-value">{stats.failed}</div>
          <div className="stat-icon"><FiAlertCircle /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-icon"><FiDownload /></div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <FiFilter size={16} />
          <span>Filter by status:</span>
        </div>
        <button
          className={`filter-btn ${!statusFilter ? 'active' : ''}`}
          onClick={() => { setStatusFilter(null); setPage(1); }}
        >
          All
        </button>
        <button
          className={`filter-btn success ${statusFilter === 'success' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('success'); setPage(1); }}
        >
          Success
        </button>
        <button
          className={`filter-btn warning ${statusFilter === 'duplicate' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('duplicate'); setPage(1); }}
        >
          Duplicates
        </button>
        <button
          className={`filter-btn error ${statusFilter === 'failed' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('failed'); setPage(1); }}
        >
          Failed
        </button>
      </div>

      {/* History Table */}
      <div className="history-table-container">
        {loading ? (
          <div className="loading">Loading upload history...</div>
        ) : history.length === 0 ? (
          <div className="empty-state">No upload history found</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>File Name</th>
                <th>Unit Code</th>
                <th>Unit Name</th>
                <th>University</th>
                <th>Faculty</th>
                <th>Year</th>
                <th>Uploaded By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className={`status-${record.status}`}>
                  <td className="status-cell">
                    <div className="status-badge">
                      {getStatusIcon(record.status)}
                      {getStatusBadge(record.status)}
                    </div>
                  </td>
                  <td className="file-name">
                    <span title={record.file_name}>{record.file_name}</span>
                    {record.error_message && (
                      <div className="error-detail" title={record.error_message}>
                        {record.error_message}
                      </div>
                    )}
                  </td>
                  <td>{record.unit_code || '—'}</td>
                  <td>{record.unit_name || '—'}</td>
                  <td>{record.universities?.name || '—'}</td>
                  <td>{record.faculty || '—'}</td>
                  <td>{record.year || '—'}</td>
                  <td>{record.profiles?.full_name || record.profiles?.email || '—'}</td>
                  <td className="date">{formatDate(record.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination" style={{ justifyContent: 'center', gap: '24px' }}>
          <button
            className="btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
