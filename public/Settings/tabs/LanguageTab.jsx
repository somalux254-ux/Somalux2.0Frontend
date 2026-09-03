export const LanguageTab = ({ settings, handleSelectChange }) => (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Language Settings</h2>
        <p className="settings-stp-page-section-description">Choose your preferred language</p>
      </div>
    </div>
    
    <div className="settings-stp-options-group">
      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Interface Language</label>
          <p className="option-description">Language for the app interface</p>
        </div>
        <select 
          className="settings-stp-page-select"
          value={settings.preferences?.language || 'English'}
          onChange={(e) => handleSelectChange('preferences', 'language', e.target.value)}
        >
          <option value="English">English</option>
          <option value="Spanish">Español</option>
          <option value="French">Français</option>
          <option value="Swahili">Kiswahili</option>
        </select>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Content Language</label>
          <p className="option-description">Language for job listings and content</p>
        </div>
        <select 
          className="settings-stp-page-select"
          defaultValue="English"
        >
          <option value="English">English</option>
          <option value="Spanish">Español</option>
          <option value="French">Français</option>
          <option value="Swahili">Kiswahili</option>
        </select>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Date Format</label>
          <p className="option-description">How dates are displayed</p>
        </div>
        <select 
          className="settings-stp-page-select"
          defaultValue="MM/DD/YYYY"
        >
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>
    </div>
  </div>
);
