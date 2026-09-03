// StatisticsModal.jsx - Display reading statistics with advanced metrics
import React from 'react';
import { FiX } from 'react-icons/fi';
import './StatisticsModal.css';

const StatisticsModal = ({ isOpen, statistics, onClose }) => {
  if (!isOpen) return null;

  const estimatedTimeRemaining = statistics.pagesPerMinute > 0 
    ? Math.ceil((statistics.totalPages - statistics.currentPage) / statistics.pagesPerMinute)
    : 0;

  const estimatedCompletionTime = new Date();
  estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + estimatedTimeRemaining);

  const renderProgressSegments = () => {
    const segments = [];
    for (let i = 0; i < 10; i++) {
      const isFilled = (i * 10) < statistics.readPercentage;
      segments.push(
        <div 
          key={i} 
          className={`sm-progress-segment ${isFilled ? 'filled' : ''}`}
        ></div>
      );
    }
    return segments;
  };

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sm-header">
          <h2>📊 Reading Statistics</h2>
          <button onClick={onClose} className="sm-close-btn">
            <FiX size={20} />
          </button>
        </div>

        <div className="sm-content">
          {/* Progress Section */}
          <div className="sm-progress-section">
            <div className="sm-progress-header">
              <span>📖 Reading Progress</span>
              <span className="sm-progress-percent">{statistics.readPercentage}%</span>
            </div>
            <div className="sm-progress-bar-advanced">
              {renderProgressSegments()}
            </div>
            <div className="sm-progress-details">
              <div>Page {statistics.currentPage} of {statistics.totalPages}</div>
              <div className="sm-remaining-pages">
                {statistics.totalPages - statistics.currentPage} pages remaining
              </div>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="sm-stat-grid">
            <div className="sm-stat-card sm-primary-card">
              <div className="sm-stat-label">Reading Time</div>
              <div className="sm-stat-value">
                {Math.floor(statistics.readingTime / 60)}h {statistics.readingTime % 60}m
              </div>
              <div className="sm-stat-subtext">Total session time</div>
            </div>

            <div className="sm-stat-card sm-secondary-card">
              <div className="sm-stat-label">Reading Speed</div>
              <div className="sm-stat-value">{statistics.pagesPerMinute}</div>
              <div className="sm-stat-subtext">pages/minute</div>
            </div>

            <div className="sm-stat-card sm-tertiary-card">
              <div className="sm-stat-label">Time Remaining</div>
              <div className="sm-stat-value">{estimatedTimeRemaining}m</div>
              <div className="sm-stat-subtext">estimated</div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="sm-secondary-grid">
            <div className="sm-info-card">
              <div className="sm-info-icon">⭐</div>
              <div className="sm-info-content">
                <div className="sm-info-label">Bookmarks</div>
                <div className="sm-info-value">{statistics.bookmarkedPages}</div>
              </div>
            </div>

            <div className="sm-info-card">
              <div className="sm-info-icon">📝</div>
              <div className="sm-info-content">
                <div className="sm-info-label">Notes</div>
                <div className="sm-info-value">{statistics.notes}</div>
              </div>
            </div>

            <div className="sm-info-card">
              <div className="sm-info-icon">📄</div>
              <div className="sm-info-content">
                <div className="sm-info-label">Total Pages</div>
                <div className="sm-info-value">{statistics.totalPages}</div>
              </div>
            </div>
          </div>

          {/* Completion Estimate */}
          <div className="sm-completion-card">
            <div className="sm-completion-title">⏱️ Estimated Completion</div>
            <div className="sm-completion-time">
              {estimatedCompletionTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
            <div className="sm-completion-subtext">
              at current reading pace
            </div>
          </div>

          {/* Reading Performance */}
          <div className="sm-performance-section">
            <div className="sm-performance-title">📈 Performance Metrics</div>
            <div className="sm-metrics-row">
              <div className="sm-metric-item">
                <span className="sm-metric-label">Avg. Session</span>
                <span className="sm-metric-value">{statistics.readingTime > 0 ? Math.round(statistics.currentPage / (statistics.readingTime / 60)) : 0} pages/hr</span>
              </div>
              <div className="sm-metric-item">
                <span className="sm-metric-label">Session Duration</span>
                <span className="sm-metric-value">{Math.floor(statistics.readingTime / 3600)}h {Math.floor((statistics.readingTime % 3600) / 60)}m</span>
              </div>
            </div>
          </div>

          <div className="sm-footer">
            <button onClick={onClose} className="sm-close-button">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsModal;
