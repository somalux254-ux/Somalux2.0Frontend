import React, { useState, useEffect, useCallback, useRef } from 'react';
import './AboutUsTab.css';

export const AboutUsTab = ({ onOpenAgreement, onOpenPrivacy }) => {
  const currentVersion = process.env.REACT_APP_VERSION || '1.0.0';
  const websiteUrl = 'https://www.somalux.co.ke';
  const websiteDisplayUrl = 'www.somalux.co.ke';
  const [copyStatus, setCopyStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleAgreementClick = (e) => {
    e.preventDefault();
    if (typeof onOpenAgreement === 'function') {
      onOpenAgreement();
    }
  };

  const handlePrivacyClick = (e) => {
    e.preventDefault();
    if (typeof onOpenPrivacy === 'function') {
      onOpenPrivacy();
    }
  };

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const fallbackCopy = async (text) => {
    return new Promise((resolve) => {
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = text;
      tempTextArea.setAttribute('readonly', '');
      tempTextArea.style.position = 'fixed';
      tempTextArea.style.top = '-9999px';
      tempTextArea.style.left = '-9999px';
      tempTextArea.style.opacity = '0';
      document.body.appendChild(tempTextArea);

      window.setTimeout(() => {
        tempTextArea.focus();
        tempTextArea.select();
        tempTextArea.setSelectionRange(0, text.length);
        const didCopy = document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        resolve(Boolean(didCopy));
      }, 0);
    });
  };

  const handleCopyWebsite = async () => {
    try {
      let copied = false;

      if (!copied && typeof navigator?.clipboard?.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(websiteUrl);
          copied = true;
        } catch (browserError) {
          console.warn('[AboutUsTab] Browser clipboard write failed, trying fallback:', browserError);
        }
      }

      if (!copied) {
        copied = await fallbackCopy(websiteUrl);
      }

      if (!copied) {
        throw new Error('Clipboard write did not complete');
      }

      setCopyStatus('Copied!');
    } catch (error) {
      console.warn('[AboutUsTab] Failed to copy website URL:', error);
      setCopyStatus('Copy failed');
    }

    closeMenu();
    window.setTimeout(() => setCopyStatus(''), 2000);
  };

  const handleOpenWebsite = () => {
    closeMenu();
    window.open(websiteUrl, '_blank', 'noopener,noreferrer');
  };

  const openWebsiteActionMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [menuOpen, closeMenu]);

  return (
    <div className="about-us-tab">
      <div className="about-us-logo-wrapper">
        <img className="about-us-logo" src="/Som152.png" alt="Somalux logo" />
        <span className="about-us-version">App Version {currentVersion}</span>
        <div className="about-us-website-row">
          <span className="about-us-website-label">Official Website:</span>
          <button
            type="button"
            className="about-us-website-button"
            onClick={openWebsiteActionMenu}
          >
            {websiteDisplayUrl}
          </button>
          {menuOpen && (
            <div ref={menuRef} className="about-us-action-menu">
              <button type="button" className="about-us-action-item" onClick={handleOpenWebsite}>
                Open
              </button>
              <button type="button" className="about-us-action-item" onClick={handleCopyWebsite}>
                Copy
              </button>
            </div>
          )}
          {copyStatus ? <span className="about-us-website-status">{copyStatus}</span> : null}
        </div>
      </div>

      <div className="about-us-bottom-text">
        <p>
          By continuing, you agree to our <a href="#agreement" onClick={handleAgreementClick}>User Agreement</a> and <a href="#privacy" onClick={handlePrivacyClick}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};
