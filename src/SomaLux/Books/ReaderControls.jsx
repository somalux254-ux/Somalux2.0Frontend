import React from 'react';
import {
  FiX,
  FiMaximize2,
  FiMinimize2,
  FiRotateCcw,
  FiRefreshCw,
  FiAlignJustify,
  FiFile,
  FiSun,
  FiCheckCircle,
} from 'react-icons/fi';

const ReaderControls = ({
  title,
  author,
  isFullscreen,
  scrollMode,
  warmMode,
  toggleFullscreen,
  toggleScrollMode,
  zoomIn,
  zoomOut,
  rotate,
  resetView,
  toggleWarmMode,
  handleMarkFinished,
  onClose,
}) => {
  return (
    <div
      style={{
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1e293b',
        background: 'linear-gradient(90deg,#020617,#0b1120)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
          {title}
        </span>
        {author && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>by {author}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          style={{
            border: 'none',
            background: 'rgba(15,23,42,0.9)',
            color: '#e2e8f0',
            borderRadius: 999,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {isFullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
        </button>
        <button
          onClick={toggleScrollMode}
          title={scrollMode ? 'Single page mode' : 'Scroll mode'}
          style={{
            border: 'none',
            background: 'rgba(15,23,42,0.9)',
            color: '#e2e8f0',
            borderRadius: 999,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {scrollMode ? <FiFile size={14} /> : <FiAlignJustify size={14} />}
        </button>
        <button
          onClick={rotate}
          title="Rotate 90°"
          style={{
            border: 'none',
            background: 'rgba(15,23,42,0.9)',
            color: '#e2e8f0',
            borderRadius: 999,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <FiRotateCcw size={14} />
        </button>
        <button
          onClick={resetView}
          title="Reset view"
          style={{
            border: 'none',
            background: 'rgba(15,23,42,0.9)',
            color: '#e2e8f0',
            borderRadius: 999,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <FiRefreshCw size={14} />
        </button>
        <button
          onClick={toggleWarmMode}
          title="Reading mode"
          style={{
            border: 'none',
            background: warmMode ? 'rgba(248,113,113,0.18)' : 'rgba(15,23,42,0.9)',
            color: warmMode ? '#fecaca' : '#e2e8f0',
            borderRadius: 999,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <FiSun size={14} />
        </button>
        <button
          onClick={handleMarkFinished}
          title="Mark book as finished (updates goals & stats)"
          style={{
            border: 'none',
            background: 'rgba(22,163,74,0.18)',
            color: '#bbf7d0',
            borderRadius: 999,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <FiCheckCircle size={14} />
          <span style={{ fontSize: 11 }}>Finished</span>
        </button>
        <button
          onClick={onClose}
          title="Close reader"
          style={{
            border: 'none',
            background: 'rgba(248,250,252,0.08)',
            color: '#e2e8f0',
            borderRadius: 999,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <FiX size={16} />
          <span style={{ fontSize: 12 }}>Close reader</span>
        </button>
      </div>
    </div>
  );
};

export default ReaderControls;