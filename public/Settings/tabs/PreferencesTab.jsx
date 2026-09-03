import React from 'react';

export const PreferencesTab = ({ settings, handleSelectChange, handleToggle, showSavedMessage }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [screenshotDragging, setScreenshotDragging] = React.useState(false);
  const toggleRef = React.useRef(null);
  const screenshotToggleRef = React.useRef(null);
  const dragStartX = React.useRef(0);
  const screenshotDragStartX = React.useRef(0);

  const updateTheme = React.useCallback((clientX) => {
    if (!toggleRef.current) return;
    const rect = toggleRef.current.getBoundingClientRect();
    const x = clientX - rect.left;

    if (x < rect.width / 2) {
      if (settings.preferences.theme !== 'light') {
        handleSelectChange('preferences', 'theme', 'light');
      }
    } else if (settings.preferences.theme !== 'dark') {
      handleSelectChange('preferences', 'theme', 'dark');
    }
  }, [handleSelectChange, settings.preferences.theme]);

  const updateScreenshot = React.useCallback((clientX) => {
    if (!screenshotToggleRef.current) return;
    const rect = screenshotToggleRef.current.getBoundingClientRect();
    const x = clientX - rect.left;

    console.log('updateScreenshot - x position:', x, 'width/2:', rect.width / 2, 'current allowScreenshots:', settings.privacy.allowScreenshots);

    if (x < rect.width / 2) {
      console.log('Dragged left - should allow screenshots');
      if (settings.privacy.allowScreenshots !== true) {
        console.log('Toggling to allow');
        handleToggle('privacy', 'allowScreenshots');
      }
    } else if (settings.privacy.allowScreenshots !== false) {
      console.log('Dragged right - should block screenshots');
      console.log('Toggling to block');
      handleToggle('privacy', 'allowScreenshots');
    }
  }, [handleToggle, settings.privacy.allowScreenshots]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    dragStartX.current = e.touches[0].clientX;
  };

  const handleScreenshotMouseDown = (e) => {
    setScreenshotDragging(true);
    screenshotDragStartX.current = e.clientX;
  };

  const handleScreenshotTouchStart = (e) => {
    setScreenshotDragging(true);
    screenshotDragStartX.current = e.touches[0].clientX;
  };

  const handleMouseMove = React.useCallback((e) => {
    if (!isDragging) return;
    updateTheme(e.clientX);
  }, [isDragging, updateTheme]);

  const handleTouchMove = React.useCallback((e) => {
    if (!isDragging) return;
    updateTheme(e.touches[0].clientX);
  }, [isDragging, updateTheme]);

  const handleScreenshotMouseMove = React.useCallback((e) => {
    if (!screenshotDragging) return;
    updateScreenshot(e.clientX);
  }, [screenshotDragging, updateScreenshot]);

  const handleScreenshotTouchMove = React.useCallback((e) => {
    if (!screenshotDragging) return;
    updateScreenshot(e.touches[0].clientX);
  }, [screenshotDragging, updateScreenshot]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleScreenshotMouseUp = React.useCallback(() => {
    setScreenshotDragging(false);
  }, []);

  const handleScreenshotTouchEnd = React.useCallback(() => {
    setScreenshotDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, false);
      document.addEventListener('mouseup', handleMouseUp, false);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, false);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove, false);
        document.removeEventListener('mouseup', handleMouseUp, false);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd, false);
      };
    }
  }, [handleMouseMove, handleMouseUp, handleTouchEnd, handleTouchMove, isDragging]);

  React.useEffect(() => {
    if (screenshotDragging) {
      document.addEventListener('mousemove', handleScreenshotMouseMove, false);
      document.addEventListener('mouseup', handleScreenshotMouseUp, false);
      document.addEventListener('touchmove', handleScreenshotTouchMove, { passive: false });
      document.addEventListener('touchend', handleScreenshotTouchEnd, false);
      return () => {
        document.removeEventListener('mousemove', handleScreenshotMouseMove, false);
        document.removeEventListener('mouseup', handleScreenshotMouseUp, false);
        document.removeEventListener('touchmove', handleScreenshotTouchMove);
        document.removeEventListener('touchend', handleScreenshotTouchEnd, false);
      };
    }
  }, [handleScreenshotMouseMove, handleScreenshotMouseUp, handleScreenshotTouchEnd, handleScreenshotTouchMove, screenshotDragging]);

  return (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Preferences</h2>
        <p className="settings-stp-page-section-description">Customize your experience</p>
      </div>
    </div>
    
    <div className="settings-stp-page-option" style={{ flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div className="option-info" style={{ width: '100%' }}>
        <label className="option-label">Screenshots</label>
        <p className="option-description">Block other users from taking screenshots of your profile</p>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div 
          ref={screenshotToggleRef}
          onMouseDown={handleScreenshotMouseDown}
          onTouchStart={handleScreenshotTouchStart}
          style={{
            position: 'relative',
            width: '140px',
            height: '32px',
            backgroundColor: !settings.privacy.allowScreenshots ? 'rgba(0, 168, 68, 0.3)' : 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(0, 217, 255, 0.25)',
            borderRadius: '20px',
            cursor: screenshotDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
            transition: screenshotDragging ? 'none' : 'box-shadow 0.3s ease-out',
            flexShrink: 0,
            userSelect: 'none',
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            boxShadow: 'none'
          }}
        >
          {/* Toggle Knob */}
          <div
            style={{
              position: 'absolute',
              width: '26px',
              height: '26px',
              backgroundColor: !settings.privacy.allowScreenshots ? '#00a844' : '#888888',
              borderRadius: '50%',
              boxShadow: 'none',
              transform: `translateX(${!settings.privacy.allowScreenshots ? '108px' : '0px'})`,
              transition: screenshotDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              left: '3px',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>
    </div>
    
    <div className="settings-stp-options-group">
      {/* Location Opt-in Toggle */}
      <div className="settings-stp-page-option" style={{ flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div className="option-info" style={{ width: '100%' }}>
          <label className="option-label">Location</label>
          <p className="option-description">Allow Joblink to access your device location for nearby search and job suggestions</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => handleToggle('preferences', 'allowLocation')}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(0,217,255,0.15)',
              background: settings.preferences.allowLocation ? 'rgba(0,168,68,0.15)' : 'transparent',
              cursor: 'pointer'
            }}
          >
            {settings.preferences.allowLocation ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="settings-stp-page-option" style={{ flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div className="option-info" style={{ width: '100%' }}>
          <label className="option-label">Theme</label>
          <p className="option-description">Choose your preferred theme</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div 
            ref={toggleRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{
              position: 'relative',
              width: '140px',
              height: '32px',
              backgroundColor: settings.preferences.theme === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(0, 217, 255, 0.25)',
              borderRadius: '20px',
              cursor: isDragging ? 'grabbing' : 'grab',
              display: 'flex',
              alignItems: 'center',
              padding: '0 6px',
              transition: isDragging ? 'none' : 'box-shadow 0.3s ease-out',
              flexShrink: 0,
              userSelect: 'none',
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              boxShadow: 'none'
            }}
          >
            {/* Sun Icon */}
            <span style={{ 
              fontSize: '14px',
              color: settings.preferences.theme === 'light' ? '#ffcc00' : '#666',
              transition: isDragging ? 'none' : 'color 0.5s ease-out',
              zIndex: 1,
              pointerEvents: 'none',
              opacity: isDragging ? 0.6 : 1
            }}>☀️</span>
            
            {/* Toggle Knob */}
            <div
              style={{
                position: 'absolute',
                width: '26px',
                height: '26px',
                backgroundColor: settings.preferences.theme === 'light' ? '#333333' : '#ffffff',
                borderRadius: '50%',
                boxShadow: 'none',
                transform: `translateX(${settings.preferences.theme === 'light' ? '0px' : '108px'})`,
                transition: isDragging ? 'none' : 'transform 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                left: '3px',
                pointerEvents: 'none'
              }}
            />
            
            {/* Moon Icon */}
            <span style={{ 
              fontSize: '14px',
              color: settings.preferences.theme === 'dark' ? '#88ccff' : '#666',
              transition: isDragging ? 'none' : 'color 0.5s ease-out',
              marginLeft: 'auto',
              zIndex: 1,
              pointerEvents: 'none',
              opacity: isDragging ? 0.6 : 1
            }}>🌙</span>
          </div>
        </div>
      </div>

    </div>
  </div>
  );
};
