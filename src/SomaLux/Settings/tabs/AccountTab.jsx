export const AccountTab = ({ 
  showConfirmDelete, 
  setShowConfirmDelete, 
  handleDeleteAccount,
  deletingAccount
}) => {
  return (
    <div className="settings-stp-page-section">
      <div className="section-header">
        <div>
          <h2 className="settings-stp-page-section-title">Account Settings</h2>
          <p className="settings-stp-page-section-description">Manage your account</p>
        </div>
      </div>
      
      <div className="settings-stp-options-group">
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
