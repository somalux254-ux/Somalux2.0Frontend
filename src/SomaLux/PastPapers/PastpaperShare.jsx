import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiShare2, FiCopy, FiTwitter, FiFacebook, FiLinkedin, FiMail, FiCheck } from 'react-icons/fi';
import styled from 'styled-components';

const ShareContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const ShareButtonStyled = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: ${(props) => (props.$isSharing ? 'default' : 'pointer')};
  transition: all 0.2s ease;
  background: transparent;
  color: #4b5563;

  &:hover {
    background: ${(props) => (props.$isSharing ? 'transparent' : 'rgba(243, 244, 246, 0.2)')};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  ${(props) => {
    switch (props.$variant) {
      case 'minimal':
        return `
          padding: 6px;
          border-radius: 50%;
          width: 36px;
          height: 36px;
        `;
      case 'large':
        return `
          padding: 10px 16px;
          font-size: 1rem;
          border-radius: 6px;
          gap: 8px;
          min-width: 100px;
          font-weight: 500;
        `;
      default:
        return `
          padding: 8px 12px;
          font-size: 0.9rem;
          border-radius: 6px;
          gap: 8px;
          min-width: 90px;
          font-weight: 500;
        `;
    }
  }}
`;

const ShareMenu = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 8px 0;
  z-index: 50;
  min-width: 160px;
  margin-bottom: 8px;
`;

const ShareOption = styled.button`
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  width: 100%;
  text-align: left;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f3f4f6;
  }
`;

const CopyStatus = styled.div`
  position: absolute;
  top: -38px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 20;
`;

const Divider = styled.div`
  height: 1px;
  background-color: #e5e7eb;
  margin: 4px 0;
`;

const Spinner = styled.span`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid ${(props) => (props.$variant === 'large' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)')};
  border-left-color: ${(props) => (props.$variant === 'large' ? 'white' : '#3b82f6')};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export const ShareButton = ({ paper, variant = 'default' }) => {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const shareButtonRef = useRef(null);
  const shareMenuRef = useRef(null);

  // Check if component is mounted to avoid SSR issues
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Close share menu when clicking outside
  useEffect(() => {
    if (!showShareOptions) return;

    const handleClickOutside = (event) => {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target) &&
        shareButtonRef.current &&
        !shareButtonRef.current.contains(event.target)
      ) {
        setShowShareOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareOptions]);

  // Check if native sharing is available
  const canUseNativeShare = () => {
    return isMounted && navigator.share && typeof navigator.share === 'function';
  };

  // Detect mobile devices
  const isMobileDevice = () => {
    if (!isMounted) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  const handleShare = async (method) => {
    if (!paper || (!paper.course && !paper.title)) {
      setCopyStatus('Cannot share: Invalid paper data');
      setTimeout(() => setCopyStatus(''), 2000);
      return;
    }

    const shareUrl = window.location.href;
    const shareText = `Check out this past paper: "${paper.course || paper.title}" from ${paper.university} (${paper.year})`;
    const hashtags = 'pastpapers,exams,study';

    try {
      switch (method) {
        case 'copy':
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = `${shareText}\n${shareUrl}`;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
          setCopyStatus('Copied to clipboard!');
          setTimeout(() => setCopyStatus(''), 2000);
          break;

        case 'twitter':
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(hashtags)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'facebook':
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'linkedin':
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'email':
          window.open(
            `mailto:?subject=${encodeURIComponent(`Past Paper: ${paper.course || paper.title}`)}&body=${encodeURIComponent(`${shareText}%0A%0A${shareUrl}%0A%0A`)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;

        case 'native':
          await navigator.share({
            title: shareText,
            text: paper.description ? `Check out this past paper: ${paper.description.substring(0, 100)}...` : shareText,
            url: shareUrl,
          });
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Error sharing:', error);
      setCopyStatus('Failed to share');
      setTimeout(() => setCopyStatus(''), 2000);
    } finally {
      setShowShareOptions(false);
    }
  };

  return (
    <ShareContainer>
      <ShareButtonStyled
        ref={shareButtonRef}
        onClick={async () => {
          if (isSharing) return;
          setIsSharing(true);
          try {
            if (canUseNativeShare() && isMobileDevice()) {
              await handleShare('native');
            } else {
              setShowShareOptions(!showShareOptions);
            }
          } catch (error) {
            console.error('Sharing failed:', error);
            setShowShareOptions(true);
          } finally {
            setIsSharing(false);
          }
        }}
        disabled={isSharing}
        $variant={variant}
        $isSharing={isSharing}
        aria-label="Share this paper"
        aria-haspopup="true"
        aria-expanded={showShareOptions}
      >
        {isSharing ? (
          <>
            <Spinner $variant={variant} />
            {variant !== 'minimal' && 'Sharing...'}
          </>
        ) : (
          <>
            <FiShare2 size={variant === 'large' ? 24 : 24} /> {/* Unified icon size to 24 */}
            {variant !== 'minimal' && 'Share'}
          </>
        )}
      </ShareButtonStyled>

      {copyStatus && (
        <CopyStatus>
          <FiCheck size={14} style={{ flexShrink: 0 }} />
          {copyStatus}
        </CopyStatus>
      )}

      {showShareOptions && (
        <ShareMenu ref={shareMenuRef} role="menu">
          <ShareOption onClick={() => handleShare('copy')} role="menuitem">
            <FiCopy size={16} /> Copy Link
          </ShareOption>
          <Divider />
          <ShareOption onClick={() => handleShare('twitter')} role="menuitem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#000000">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Twitter
          </ShareOption>
          <ShareOption onClick={() => handleShare('facebook')} role="menuitem">
            <FiFacebook size={16} color="#4267B2" /> Facebook
          </ShareOption>
          <ShareOption onClick={() => handleShare('linkedin')} role="menuitem">
            <FiLinkedin size={16} color="#0077B5" /> LinkedIn
          </ShareOption>
          <ShareOption onClick={() => handleShare('email')} role="menuitem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#D44638">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg> Email
          </ShareOption>
          {canUseNativeShare() && isMobileDevice() && (
            <>
              <Divider />
              <ShareOption onClick={() => handleShare('native')} role="menuitem">
                <FiShare2 size={16} /> More options...
              </ShareOption>
            </>
          )}
        </ShareMenu>
      )}
    </ShareContainer>
  );
};

ShareButton.propTypes = {
  paper: PropTypes.shape({
    course: PropTypes.string,
    title: PropTypes.string,
    university: PropTypes.string,
    year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    description: PropTypes.string,
  }).isRequired,
  variant: PropTypes.oneOf(['default', 'minimal', 'large']),
};

ShareButton.defaultProps = {
  variant: 'default',
};