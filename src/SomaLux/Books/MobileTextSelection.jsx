/**
 * MobileTextSelection.jsx
 * Native-style text selection with handles for mobile
 * Similar to WhatsApp, WPS Office with accurate start/end handles
 */

import React, { useState, useEffect, useRef } from 'react';
import { FiCopy, FiEdit, FiMessageSquare, FiGlobe, FiMic, FiFileText } from 'react-icons/fi';
import './MobileTextSelection.css';

const MobileTextSelection = ({ 
  selection, 
  position, 
  onCopy, 
  onHighlight, 
  onClose,
  onSummarize,
  onExplain,
  onTranslate,
  onReadAloud,
  onAddNote
}) => {
  const [showMenu, setShowMenu] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const selectionBoxRef = useRef(null);
  const startHandleRef = useRef(null);
  const endHandleRef = useRef(null);

  // Show copy feedback for 1.5 seconds
  useEffect(() => {
    if (copiedFeedback) {
      const timer = setTimeout(() => setCopiedFeedback(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copiedFeedback]);

  if (!selection || !position || !showMenu) {
    return null;
  }

  const handleCopy = () => {
    onCopy();
    setCopiedFeedback(true);
  };

  const handleHighlight = (color) => {
    onHighlight(color);
    setShowMenu(false);
  };

  return (
    <>
      {/* Selection Box with Handles */}
      {selection.selectionRects && selection.selectionRects.length > 0 && (
        <>
          {/* Start Handle */}
          <div
            ref={startHandleRef}
            className="mobile-selection-handle start-handle"
            style={{
              left: `${selection.selectionRects[0].left + window.scrollX}px`,
              top: `${selection.selectionRects[0].top - 8 + window.scrollY}px`,
            }}
            title="Drag to adjust selection start"
          >
            <div className="handle-circle" />
          </div>

          {/* End Handle */}
          <div
            ref={endHandleRef}
            className="mobile-selection-handle end-handle"
            style={{
              left: `${selection.selectionRects[selection.selectionRects.length - 1].right - 8 + window.scrollX}px`,
              top: `${selection.selectionRects[selection.selectionRects.length - 1].bottom - 8 + window.scrollY}px`,
            }}
            title="Drag to adjust selection end"
          >
            <div className="handle-circle" />
          </div>
        </>
      )}

      {/* Context Menu */}
      <div
        className="mobile-text-menu"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${Math.max(10, position.y - 60)}px`,
          zIndex: 2000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {copiedFeedback ? (
          <div className="menu-feedback">
            <div className="feedback-checkmark">✓</div>
            <span>Copied!</span>
          </div>
        ) : (
          <div className="menu-buttons">
            <button className="menu-btn" onClick={handleCopy} title="Copy">
              <FiCopy size={18} />
              <span>Copy</span>
            </button>

            <button className="menu-btn" onClick={onSummarize} title="Summarize">
              <FiMessageSquare size={18} />
              <span>Summarize</span>
            </button>

            <button className="menu-btn" onClick={onExplain} title="Explain">
              <FiEdit size={18} />
              <span>Explain</span>
            </button>

            <button className="menu-btn" onClick={onTranslate} title="Translate">
              <FiGlobe size={18} />
              <span>Translate</span>
            </button>

            <button className="menu-btn" onClick={onReadAloud} title="Read Aloud">
              <FiMic size={18} />
              <span>Read</span>
            </button>

            <button className="menu-btn" onClick={onAddNote} title="Add Note">
              <FiFileText size={18} />
              <span>Note</span>
            </button>
          </div>
        )}
      </div>

      {/* Close on background tap */}
      <div
        className="mobile-selection-overlay"
        onClick={onClose}
        style={{ zIndex: 1999 }}
      />
    </>
  );
};

export default MobileTextSelection;
