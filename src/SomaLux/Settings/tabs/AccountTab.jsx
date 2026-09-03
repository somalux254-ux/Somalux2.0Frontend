import { useState } from 'react';

export const AccountTab = ({ 
  showConfirmDelete, 
  setShowConfirmDelete, 
  handleDeleteAccount,
  connectedDevices = [],
  currentDeviceToken = null,
  loadingDevices = false,
  handleRevokeDevice,
  deletingDeviceId,
  deletingAccount
}) => {
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get device display name
  const getDeviceLabel = (platform) => {
    const labels = {
      'android': '📱 Android Device',
      'ios': '📱 iOS Device',
      'web': '🌐 Web Browser',
      'windows': '💻 Windows Desktop',
      'macos': '🖥️ Mac Desktop',
      'linux': '🐧 Linux Desktop',
      'chrome': '🌐 Chrome Browser',
      'firefox': '🌐 Firefox Browser',
      'safari': '🌐 Safari Browser',
      'edge': '🌐 Edge Browser'
    };
    return labels[platform?.toLowerCase()] || `📱 ${platform || 'Unknown Device'}`;
  };

  // Extract system details from metadata
  const getSystemDetails = (device) => {
    const details = [];
    
    if (device.metadata) {
      const meta = typeof device.metadata === 'string' ? JSON.parse(device.metadata) : device.metadata;
      
      // OS Version
      if (meta.os_version) {
        details.push(`OS: ${meta.os_version}`);
      }
      
      // Browser/App Version
      if (meta.app_version) {
        details.push(`App: v${meta.app_version}`);
      } else if (meta.browser_version) {
        details.push(`Browser: ${meta.browser_version}`);
      }
      
      // Device Model
      if (meta.device_model) {
        details.push(`Device: ${meta.device_model}`);
      }
      
      // Screen Resolution
      if (meta.screen_resolution) {
        details.push(`Screen: ${meta.screen_resolution}`);
      }
      
      // User Agent
      if (meta.user_agent) {
        details.push(`UA: ${meta.user_agent}`);
      }
      
      // Last IP
      if (meta.last_ip) {
        details.push(`IP: ${meta.last_ip}`);
      }
      
      // Location
      if (meta.location) {
        details.push(`Location: ${meta.location}`);
      }
    }
    
    return details;
  };

  return (
    <div className="settings-stp-page-section">
      <div className="section-header">
        <div>
          <h2 className="settings-stp-page-section-title">Account Settings</h2>
          <p className="settings-stp-page-section-description">Manage your account</p>
        </div>
      </div>
      
      <div className="settings-stp-options-group">
        <div className="settings-stp-page-option">
          <div className="option-info">
            <label className="option-label">Connected Devices</label>
            <p className="option-description">Manage devices with access to your account</p>
          </div>
          <button 
            className="settings-stp-page-select" 
            style={{ marginLeft: 'auto', padding: '8px 16px', cursor: 'pointer' }}
            onClick={() => setShowDevicesModal(true)}
            disabled={loadingDevices}
          >
            {loadingDevices ? 'Loading...' : 'View'}
          </button>
        </div>

        <div className="danger-zone">
          <div className="danger-item">
            <div className="danger-info">
              <p className="danger-title">Delete Account</p>
              <p className="danger-description">Permanently delete your account and all data</p>
            </div>
            <button 
              className="danger-btn"
              onClick={() => setShowConfirmDelete(true)}
              disabled={deletingAccount}
            >
              {deletingAccount ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>

        {/* Connected Devices Modal */}
        {showDevicesModal && (
          <div className="modal-overlay" onClick={() => setShowDevicesModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Connected Devices</h3>
                <button 
                  className="modal-close-btn"
                  onClick={() => setShowDevicesModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                {loadingDevices ? (
                  <p style={{ textAlign: 'center', padding: '20px' }}>Loading devices...</p>
                ) : connectedDevices && connectedDevices.length > 0 ? (
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {connectedDevices.map((device) => {
                      const systemDetails = getSystemDetails(device);
                      const isCurrentDevice = Boolean(
                        currentDeviceToken && device.token && currentDeviceToken === device.token
                      );
                      return (
                        <div 
                          key={device.id} 
                          style={{
                            padding: '12px',
                            marginBottom: '8px',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            backgroundColor: '#1a1a1a'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '4px 0', fontWeight: '600', fontSize: '14px' }}>
                              {getDeviceLabel(device.platform)}
                              {isCurrentDevice && (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  backgroundColor: 'rgba(0, 168, 68, 0.16)',
                                  color: '#4ade80',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em'
                                }}>
                                  This device
                                </span>
                              )}
                            </p>
                            <p style={{ margin: '4px 0', fontSize: '11px', color: '#999' }}>
                              Added: {formatDate(device.created_at)}
                            </p>
                            {device.updated_at && device.updated_at !== device.created_at && (
                              <p style={{ margin: '4px 0', fontSize: '11px', color: '#888' }}>
                                Last seen: {formatDate(device.updated_at)}
                              </p>
                            )}
                            {systemDetails.length > 0 && (
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                                {systemDetails.map((detail, idx) => (
                                  <p key={idx} style={{ margin: '3px 0', fontSize: '10px', color: '#aaa', wordBreak: 'break-word' }}>
                                    {detail}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (isCurrentDevice) return;
                              handleRevokeDevice && handleRevokeDevice(device.id, false);
                            }}
                            disabled={isCurrentDevice || deletingDeviceId === device.id}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: isCurrentDevice ? '#4b5563' : '#ff6b6b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isCurrentDevice ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              whiteSpace: 'nowrap',
                              marginLeft: '8px',
                              opacity: deletingDeviceId === device.id || isCurrentDevice ? 0.7 : 1,
                              transition: 'opacity 0.2s',
                              flexShrink: 0
                            }}
                            title={isCurrentDevice ? 'You cannot revoke the device you are currently using.' : 'Revoke this device'}
                          >
                            {isCurrentDevice ? 'Current Device' : (deletingDeviceId === device.id ? 'Revoking...' : 'Revoke')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No connected devices found
                  </p>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #333', padding: '12px', textAlign: 'right' }}>
                <button 
                  className="settings-stp-page-select"
                  onClick={() => setShowDevicesModal(false)}
                  style={{ padding: '8px 16px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmDelete && (
          <div className="confirm-dialog">
            <h3>Confirm Account Deletion</h3>
            <p>This will permanently delete your account and all associated data. This action cannot be undone.</p>
            <div className="confirm-buttons">
              <button 
                className="confirm-btn confirm-delete" 
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                aria-label="Confirm delete account"
              >
                {deletingAccount ? 'Deleting...' : 'Delete'}
              </button>
              <button 
                className="confirm-btn confirm-cancel" 
                onClick={() => setShowConfirmDelete(false)}
                disabled={deletingAccount}
                aria-label="Cancel account deletion"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          backgroundColor: rgba(0, 0, 0, 0.9);
          display: flex;
          alignItems: center;
          justifyContent: center;
          zIndex: 1000;
        }

        .modal-content {
          backgroundColor: #0a0a0a;
          borderRadius: 12px;
          boxShadow: 0 10px 40px rgba(0, 0, 0, 0.9);
          maxWidth: 500px;
          width: 90%;
          maxHeight: 80vh;
          overflow: hidden;
          display: flex;
          flexDirection: column;
          border: 1px solid #333;
        }

        .modal-header {
          display: flex;
          justifyContent: space-between;
          alignItems: center;
          padding: 16px;
          borderBottom: 1px solid #333;
        }

        .modal-header h3 {
          margin: 0;
          fontSize: 18px;
          fontWeight: 600;
        }

        .modal-close-btn {
          color: #999;
          transition: color 0.2s;
        }

        .modal-close-btn:hover {
          color: #fff;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .modal-footer {
          display: flex;
          justifyContent: flex-end;
          gap: 8px;
        }

        .confirm-dialog {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: #0a0a0a;
          padding: 24px;
          border-radius: 12px;
          box-shadow: none;
          z-index: 1001;
          max-width: 400px;
          width: 90%;
          animation: none;
        }

        .confirm-dialog h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        .confirm-dialog p {
          margin: 0 0 20px 0;
          color: #ccc;
          line-height: 1.5;
        }

        .confirm-buttons {
          display: flex;
          flex-direction: row;
          gap: 12px;
          justify-content: flex-end;
          width: 100%;
        }

        .confirm-btn {
          padding: 10px 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: none;
          background-color: #222;
          color: #fff;
          flex: 0 1 auto;
          min-width: 110px;
          white-space: nowrap;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
          outline: none;
        }

        .confirm-btn:not(:disabled):hover {
          transform: none;
          box-shadow: none;
          background-color: #222;
        }

        .confirm-btn:not(:disabled):active {
          transform: none;
          box-shadow: none;
          background-color: #222;
          outline: none;
        }

        .confirm-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .confirm-delete {
          background: #ff6b6b !important;
          background-image: none !important;
          color: #fff;
          border: 1px solid #ff6b6b;
          box-shadow: none;
        }

        .confirm-delete:not(:disabled):hover {
          background: #ff5252 !important;
          background-image: none !important;
          border-color: #ff5252;
        }

        .confirm-cancel {
          background-color: #444;
          color: #fff;
        }

        @keyframes dropIn {
          from { transform: translate(-50%, -44%) scale(0.99); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        .danger-item {
          padding: 12px;
          marginTop: 12px;
          borderRadius: 8px;
          backgroundColor: transparent;
          border: 1px solid rgba(255, 107, 107, 0.25);
          display: flex;
          justifyContent: space-between;
          alignItems: center;
        }

        .danger-btn {
          padding: 8px 12px;
          min-width: 120px;
          backgroundColor: #ff6b6b;
          color: white;
          border: none;
          borderRadius: 8px;
          cursor: pointer;
          fontWeight: 600;
          fontSize: 13px;
          transition: none;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
          outline: none;
        }

        .danger-btn:not(:disabled):active {
          transform: none;
          box-shadow: none;
          background-color: #ff6b6b;
          outline: none;
        }

        .danger-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
