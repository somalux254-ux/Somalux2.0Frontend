import React, { useState, useEffect } from 'react';
import { FiFolder, FiPlus, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import './FolderSelectModal.css';
import { 
  setSelectedFolder as saveSelectedFolder, 
  addCustomFolder, 
  getCustomFolders, 
  removeCustomFolder,
  getDefaultFolders 
} from '../utils/downloadFolderManager';
import { API_URL as API_BASE } from '../../config';

/**
 * FolderSelectModal - Component for selecting and managing download folders
 * Features:
 * - Displays default folders (always available)
 * - Displays custom folders from localStorage
 * - Create new folders and save to localStorage
 * - Delete custom folders from localStorage
 * - Select a folder for downloads
 */
const FolderSelectModal = ({ isOpen, onClose, onFolderSelect, currentFolder }) => {
  const [defaultFolders, setDefaultFolders] = useState([]);
  const [customFolders, setCustomFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(currentFolder || 'Downloads');
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolder, setParentFolder] = useState('Downloads');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = () => {
    try {
      setLoading(true);
      setError('');
      
      const downloadsFolder = { name: 'Downloads', path: 'Downloads', size: 0 };
      setDefaultFolders([downloadsFolder]);
      
      const allCustom = getCustomFolders();
      const downloadsSubfolders = allCustom.filter(folder => 
        folder.path === 'Downloads' || folder.path.startsWith('Downloads/')
      );
      setCustomFolders(downloadsSubfolders);
      
      console.log('✓ Loaded folders:', { custom: downloadsSubfolders.length });
    } catch (err) {
      setError(`Error loading folders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const folderPath = parentFolder === 'Downloads' 
        ? `Downloads/${newFolderName.trim()}`
        : `${parentFolder}/${newFolderName.trim()}`;
      
      console.log(`📁 Creating: ${folderPath}`);
      const response = await fetch(`${API_BASE}/api/elib/download-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: newFolderName.trim(),
          parentFolder: parentFolder
        })
      });

      const data = await response.json();
      
      if (!data.ok) {
        setError(data.error || 'Failed to create');
        return;
      }

      addCustomFolder(data.folderPath, newFolderName.trim());
      loadFolders();
      setSelectedFolder(data.folderPath);
      saveSelectedFolder(data.folderPath);
      onFolderSelect(data.folderPath);
      
      setNewFolderName('');
      setParentFolder('Downloads');
      setShowNewFolderInput(false);
      
      // Show notification with tick
      setNotificationMessage(newFolderName.trim());
      setNotificationType('success');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomFolder = (folderPath) => {
    const folderName = folderPath.split('/').pop();
    if (window.confirm(`Delete ${folderName}?`)) {
      try {
        setLoading(true);
        setError('');
        
        console.log(`🗑️  Deleting: ${folderPath}`);
        
        fetch(`${API_BASE}/api/elib/download-folders`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath })
        })
          .then(res => res.json())
          .then(data => {
            if (data.ok) {
              removeCustomFolder(folderPath);
              loadFolders();
              
              if (selectedFolder === folderPath) {
                setSelectedFolder('Downloads');
                saveSelectedFolder('Downloads');
              }
              
              setNotificationMessage(folderName);
              setNotificationType('warning');
              setShowNotification(true);
              setTimeout(() => setShowNotification(false), 2000);
            } else {
              setError(`❌ ${data.error || 'Delete failed'}`);
            }
          })
          .catch(err => setError(`❌ ${err.message}`))
          .finally(() => setLoading(false));
      } catch (err) {
        setError(`❌ ${err.message}`);
        setLoading(false);
      }
    }
  };

  const handleFolderSelect = (folderPath) => {
    setSelectedFolder(folderPath);
  };

  const handleConfirm = () => {
    if (selectedFolder) {
      saveSelectedFolder(selectedFolder);
      onFolderSelect(selectedFolder);
      onClose();
    } else {
      setError('Select a folder');
    }
  };
  if (!isOpen) return null;

  const allFolders = [...defaultFolders, ...customFolders];

  return (
    <div className="folder-modal-overlay">
      <div className="folder-modal">
        <div className="folder-modal-header">
          <h2 className="folder-modal-title">📁 Select Folder</h2>
          <button className="folder-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        <div className="folder-modal-content">
          {/* Folders List */}
          <div className="folders-container">
            {loading ? (
              <div className="loading-message">Loading...</div>
            ) : allFolders.length === 0 ? (
              <div className="empty-message">No folders</div>
            ) : (
              <div className="folders-list">
                {/* Downloads */}
                {defaultFolders.length > 0 && (
                  <div className="folders-section">
                    <div className="folders-group">
                      {defaultFolders.map((folder) => (
                        <button
                          key={folder.path}
                          className={`folder-button ${selectedFolder === folder.path ? 'selected' : ''}`}
                          onClick={() => handleFolderSelect(folder.path)}
                        >
                          <FiFolder size={16} />
                          <span>{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Folders */}
                {customFolders.length > 0 && (
                  <div className="folders-section">
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', paddingLeft: '4px' }}>
                      {customFolders.length} subfolder{customFolders.length !== 1 ? 's' : ''}
                    </div>
                    <div className="folders-group">
                      {customFolders.map((folder) => (
                        <div key={folder.path} className="folder-item custom">
                          <button
                            className={`folder-button ${selectedFolder === folder.path ? 'selected' : ''}`}
                            onClick={() => handleFolderSelect(folder.path)}
                          >
                            <FiFolder size={16} />
                            <span>{folder.name}</span>
                          </button>
                          <button
                            className="btn-delete-folder"
                            onClick={() => deleteCustomFolder(folder.path)}
                            title="Delete"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Create Folder Section */}
          {showNewFolderInput && (
            <div className="create-folder-section">
              <div className="new-folder-input">
                <select
                  value={parentFolder}
                  onChange={(e) => setParentFolder(e.target.value)}
                  className="input-field"
                  style={{ marginBottom: '8px' }}
                >
                  {defaultFolders.map(f => <option key={f.path} value={f.path}>{f.name}</option>)}
                  {customFolders.map(f => <option key={f.path} value={f.path}>{f.name}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                  className="input-field"
                  autoFocus
                  style={{ marginBottom: '8px' }}
                />
                <div className="button-group">
                  <button className="btn-confirm" onClick={createFolder} disabled={loading}>
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-message" style={{ marginTop: '12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Notification */}
        {showNotification && (
          <div className={`folder-notification-overlay ${notificationType}`}>
            <div className={`folder-notification-card ${notificationType}`}>
              <div className={`notification-icon ${notificationType}`}>✓</div>
              <div className="notification-text">
                {notificationType === 'success' ? (
                  <>
                    <div className={`notification-title ${notificationType}`}>Created</div>
                    <div className={`notification-folder ${notificationType}`}>{notificationMessage}</div>
                  </>
                ) : (
                  <>
                    <div className={`notification-title ${notificationType}`}>{notificationMessage}</div>
                    <div className={`notification-folder ${notificationType}`}>deleted</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="folder-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          {!showNewFolderInput && (
            <button
              className="btn btn-new-folder"
              onClick={() => setShowNewFolderInput(true)}
              disabled={loading}
              title="Create a new folder"
            >
              <FiPlus size={16} /> New Folder
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || !selectedFolder}
          >
            <FiCheck size={16} /> Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderSelectModal;
