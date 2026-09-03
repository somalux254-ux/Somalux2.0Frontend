export const PrivacyTab = ({ settings, handleToggle, showSavedMessage }) => (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Privacy Settings</h2>
        <p className="settings-stp-page-section-description">Control your privacy and visibility</p>
      </div>
    </div>
    
    <div className="settings-stp-options-group">
      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Profile Visibility</label>
          <p className="option-description">Who can see your profile</p>
        </div>
        <select 
          className="settings-stp-page-select"
          value={settings.privacy.profileVisibility}
          onChange={(e) => handleToggle('privacy', 'profileVisibility', e.target.value)}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="connections">Connections Only</option>
        </select>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Show Email Address</label>
          <p className="option-description">Allow others to see your email</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="showEmail"
            checked={settings.privacy.showEmail}
            onChange={() => handleToggle('privacy', 'showEmail')}
          />
          <label htmlFor="showEmail"></label>
        </div>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Show Phone Number</label>
          <p className="option-description">Allow others to see your phone</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="showPhone"
            checked={settings.privacy.showPhone}
            onChange={() => handleToggle('privacy', 'showPhone')}
          />
          <label htmlFor="showPhone"></label>
        </div>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Allow Messages</label>
          <p className="option-description">Let others message you</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="allowMessages"
            checked={settings.privacy.allowMessages}
            onChange={() => handleToggle('privacy', 'allowMessages')}
          />
          <label htmlFor="allowMessages"></label>
        </div>
      </div>
    </div>
  </div>
);
