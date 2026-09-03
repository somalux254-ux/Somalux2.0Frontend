import React from 'react';

export const PreferencesTab = ({ settings, handleSelectChange }) => {
  return (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Preferences</h2>
        <p className="settings-stp-page-section-description">Customize your experience</p>
      </div>
    </div>
    <div className="settings-stp-options-group">
      <div className="settings-stp-page-option" style={{ flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div className="option-info" style={{ width: '100%' }}>
          <label className="option-label">Theme</label>
          <p className="option-description">Choose your preferred theme</p>
        </div>
        <div className="theme-mode-options">
          {[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ].map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`theme-mode-option ${settings.preferences.theme === mode.value ? 'active' : ''}`}
              onClick={() => handleSelectChange('preferences', 'theme', mode.value)}
              aria-pressed={settings.preferences.theme === mode.value}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  </div>
  );
};
