import React, { createContext, useCallback, useContext, useState } from 'react';

const AdminUIContext = createContext(null);

export const AdminUIProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const [toasts, setToasts] = useState([]);

  const confirm = useCallback((options = {}) => {
    const {
      title = 'Are you sure?',
      message = '',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      variant = 'default', // 'danger' | 'default'
    } = options;

    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        variant,
        resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(null);
  }, []);

  const prompt = useCallback((options = {}) => {
    const {
      title = 'Input required',
      message = '',
      label = 'Value',
      defaultValue = '',
      multiline = false,
      confirmLabel = 'OK',
      cancelLabel = 'Cancel',
      variant = 'default',
    } = options;

    return new Promise((resolve) => {
      setPromptState({
        open: true,
        title,
        message,
        label,
        value: defaultValue,
        multiline,
        confirmLabel,
        cancelLabel,
        variant,
        resolve,
      });
    });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState(null);
  }, []);

  const showToast = useCallback(({ type = 'info', message }) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <AdminUIContext.Provider value={{ confirm, prompt, showToast }}>
      {children}

      {/* Global confirm modal */}
      {confirmState?.open && (
        <div className="modal-overlay" onClick={() => { confirmState.resolve(false); closeConfirm(); }}>
          <div
            className="modal-content confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 18 }}>{confirmState.title}</h2>
            </div>
            <div className="modal-body">
              {confirmState.message && (
                <p style={{ margin: 0, color: '#cfd8dc', fontSize: 14 }}>{confirmState.message}</p>
              )}
            </div>
            <div className="actions" style={{ padding: '0 24px 20px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => {
                  confirmState.resolve(false);
                  closeConfirm();
                }}
              >
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button
                className={`btn ${confirmState.variant === 'danger' ? 'danger' : 'primary'}`}
                style={{ marginLeft: 8 }}
                onClick={() => {
                  confirmState.resolve(true);
                  closeConfirm();
                }}
              >
                {confirmState.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global prompt modal */}
      {promptState?.open && (
        <div className="modal-overlay" onClick={() => { promptState.resolve(null); closePrompt(); }}>
          <div
            className="modal-content confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 18 }}>{promptState.title}</h2>
            </div>
            <div className="modal-body">
              {promptState.message && (
                <p style={{ marginTop: 0, marginBottom: 10, color: '#cfd8dc', fontSize: 14 }}>{promptState.message}</p>
              )}
              <label className="label" style={{ marginBottom: 6 }}>{promptState.label}</label>
              {promptState.multiline ? (
                <textarea
                  className="input"
                  rows={3}
                  value={promptState.value}
                  onChange={(e) => setPromptState((prev) => prev ? { ...prev, value: e.target.value } : prev)}
                />
              ) : (
                <input
                  className="input"
                  value={promptState.value}
                  onChange={(e) => setPromptState((prev) => prev ? { ...prev, value: e.target.value } : prev)}
                />
              )}
            </div>
            <div className="actions" style={{ padding: '0 24px 20px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => {
                  promptState.resolve(null);
                  closePrompt();
                }}
              >
                {promptState.cancelLabel || 'Cancel'}
              </button>
              <button
                className={`btn ${promptState.variant === 'danger' ? 'danger' : 'primary'}`}
                style={{ marginLeft: 8 }}
                onClick={() => {
                  promptState.resolve(promptState.value);
                  closePrompt();
                }}
              >
                {promptState.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AdminUIContext.Provider>
  );
};

export const useAdminUI = () => {
  const ctx = useContext(AdminUIContext);
  if (!ctx) {
    throw new Error('useAdminUI must be used within an AdminUIProvider');
  }
  return ctx;
};
