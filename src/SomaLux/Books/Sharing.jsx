import React, { useState, useEffect, useRef } from 'react';
import { 
  FiShare2,
  FiCopy,
  FiTwitter,
  FiFacebook,
  FiLinkedin,
  FiMail,
  FiCheck
} from 'react-icons/fi';

export const ShareButton = ({ book, variant = 'default', onShare }) => {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const shareButtonRef = useRef(null);
  const shareMenuRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!showShareOptions) return;

    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target) && 
          shareButtonRef.current && !shareButtonRef.current.contains(event.target)) {
        setShowShareOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareOptions]);

  const canUseNativeShare = () => {
    return isMounted && navigator.share && typeof navigator.share === 'function';
  };

  const isMobileDevice = () => {
    if (!isMounted) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  const handleShare = async (method) => {
    // Generate book-specific URL with book ID
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}?id=${book.id}`;
    const shareText = `Check out "${book.title}" by ${book.author}`;
    const hashtags = 'books,reading';
    
    try {
      switch (method) {
        case 'copy':
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          } else {
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
            `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}%0A%0A${shareUrl}%0A%0A`)}`,
            '_blank',
            'noopener,noreferrer'
          );
          break;
          
        case 'native':
          await navigator.share({
            title: shareText,
            text: book.description ? `Check out this book: ${book.description.substring(0, 100)}...` : shareText,
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

  const getButtonStyles = () => {
    const baseStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      cursor: isSharing ? 'default' : 'pointer',
      transition: 'all 0.2s ease',
      background: 'transparent',
      width: 'fit-content',
      color: '#d1d5db', // Light grey color for share icon and text
      ':hover': {
        backgroundColor: isSharing ? 'transparent' : 'rgba(0,0,0,0.05)'
      }
    };

    switch (variant) {
      case 'minimal':
        return {
          ...baseStyles,
          padding: '6px',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
        };
      case 'large':
        return {
          ...baseStyles,
          padding: '10px 16px',
          fontSize: '1rem',
          borderRadius: '6px',
          gap: '8px',
          fontWeight: '500',
        };
      default:
        return {
          ...baseStyles,
          padding: '8px 12px',
          fontSize: '0.9rem',
          borderRadius: '6px',
          gap: '8px',
          fontWeight: '500',
        };
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={shareButtonRef}
        onClick={async () => {
          if (isSharing) return;
          
          // Check authentication if onShare callback provided
          if (onShare) {
            const allowed = await onShare();
            if (!allowed) return;
          }
          
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
        style={getButtonStyles()}
        aria-label="Share this book"
        aria-haspopup="true"
        aria-expanded={showShareOptions}
      >
        {isSharing ? (
          <>
            <span style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              border: `2px solid ${variant === 'large' ? 'rgba(59,130,246,0.3)' : 'rgba(0,0,0,0.1)'}`,
              borderLeftColor: '#d1d5db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            {variant !== 'minimal' && 'Sharing...'}
          </>
        ) : (
          <>
            <FiShare2 size={variant === 'large' ? 18 : 16} />
            {variant !== 'minimal' && 'Share'}
          </>
        )}
      </button>
      
      {copyStatus && (
        <div style={{
          position: 'absolute',
          top: '-38px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1f2937',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 20
        }}>
          <FiCheck size={14} style={{ flexShrink: 0 }} />
          {copyStatus}
        </div>
      )}
      
      {showShareOptions && (
        <div
          ref={shareMenuRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'transparent',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
            padding: '8px 0',
            zIndex: 50,
            width: 'fit-content',
            marginBottom: '8px'
          }}
          role="menu"
        >
          <button
            onClick={() => handleShare('copy')}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              textAlign: 'left',
              transition: 'background-color 0.2s',
              ':hover': {
                backgroundColor: '#f3f4f6'
              }
            }}
            role="menuitem"
          >
            <FiCopy size={16} /> Copy Link
          </button>
          
          <div style={{
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '4px 0'
          }} />
          
          <button
            onClick={() => handleShare('twitter')}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              textAlign: 'left',
              transition: 'background-color 0.2s',
              ':hover': {
                backgroundColor: '#f3f4f6'
              }
            }}
            role="menuitem"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#000000">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg> Twitter
          </button>
          
          <button
            onClick={() => handleShare('facebook')}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              textAlign: 'left',
              transition: 'background-color 0.2s',
              ':hover': {
                backgroundColor: '#f3f4f6'
              }
            }}
            role="menuitem"
          >
            <FiFacebook size={16} color="#4267B2" /> Facebook
          </button>
          
          <button
            onClick={() => handleShare('linkedin')}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              textAlign: 'left',
              transition: 'background-color 0.2s',
              ':hover': {
                backgroundColor: '#f3f4f6'
              }
            }}
            role="menuitem"
          >
            <FiLinkedin size={16} color="#0077B5" /> LinkedIn
          </button>
          
          <button
            onClick={() => handleShare('email')}
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              textAlign: 'left',
              transition: 'background-color 0.2s',
              ':hover': {
                backgroundColor: '#f3f4f6'
              }
            }}
            role="menuitem"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#D44638">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg> Email
          </button>
          
          {canUseNativeShare() && isMobileDevice() && (
            <>
              <div style={{
                height: '1px',
                backgroundColor: '#e5e7eb',
                margin: '4px 0'
              }} />
              <button
                onClick={() => handleShare('native')}
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background-color 0.2s',
                  ':hover': {
                    backgroundColor: '#f3f4f6'
                  }
                }}
                role="menuitem"
              >
                <FiShare2 size={16} /> More options...
              </button>
            </>
          )}
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};