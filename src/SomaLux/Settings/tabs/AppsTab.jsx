export const AppsTab = () => (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Connected Apps</h2>
        <p className="settings-stp-page-section-description">Manage applications with access to your account</p>
      </div>
    </div>
    
    <div className="settings-stp-options-group">
      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Gmail Integration</label>
          <p className="option-description">Connected - Click to disconnect</p>
        </div>
        <button className="settings-stp-page-select" style={{ marginLeft: 'auto', padding: '8px 16px', cursor: 'pointer', color: '#ff6b6b' }}>
          Disconnect
        </button>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">LinkedIn</label>
          <p className="option-description">Not connected</p>
        </div>
        <button className="settings-stp-page-select" style={{ marginLeft: 'auto', padding: '8px 16px', cursor: 'pointer', background: 'rgba(0, 217, 255, 0.1)', border: '1px solid rgba(0, 217, 255, 0.2)', color: '#00d9ff' }}>
          Connect
        </button>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Google Calendar</label>
          <p className="option-description">Not connected</p>
        </div>
        <button className="settings-stp-page-select" style={{ marginLeft: 'auto', padding: '8px 16px', cursor: 'pointer', background: 'rgba(0, 217, 255, 0.1)', border: '1px solid rgba(0, 217, 255, 0.2)', color: '#00d9ff' }}>
          Connect
        </button>
      </div>
    </div>
  </div>
);
