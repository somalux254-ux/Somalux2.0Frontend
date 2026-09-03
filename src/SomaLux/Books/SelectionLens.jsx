/**
 * SelectionLens.jsx - VISUAL FEEDBACK COMPONENT
 * Shows real-time selection feedback like WPS
 * 
 * Displays:
 * - Selected text preview
 * - Word count
 * - Character count
 * - Selection confidence
 */

import React from 'react';
import { FiEye, FiX } from 'react-icons/fi';
import './SelectionLens.css';

const SelectionLens = ({ lensData, onClose, isVisible }) => {
  if (!isVisible || !lensData) return null;

  return (
    <div className="selection-lens-container" style={{
      position: 'fixed',
      left: `${lensData.bounds?.right + 10}px`,
      top: `${lensData.bounds?.top}px`,
      zIndex: 1999,
    }}>
      <div className="selection-lens">
        <div className="lens-header">
          <FiEye size={14} />
          <span>Selection</span>
          <button 
            className="lens-close" 
            onClick={onClose}
            aria-label="Close lens"
          >
            <FiX size={12} />
          </button>
        </div>

        <div className="lens-preview">
          <p className="lens-text">{lensData.text}</p>
        </div>

        <div className="lens-stats">
          <div className="stat">
            <span className="stat-label">Words:</span>
            <span className="stat-value">{lensData.words}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Chars:</span>
            <span className="stat-value">{lensData.chars}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Confidence:</span>
            <div className="confidence-bar">
              <div 
                className="confidence-fill"
                style={{ width: `${lensData.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectionLens;
