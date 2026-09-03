import React, { useState, useEffect } from 'react';
import { FiDownload, FiLoader, FiAlertCircle, FiX, FiCheck, FiFileText, FiClock, FiFolder } from 'react-icons/fi';
import './PastPapersAutoDownload.css';
import FolderSelectModal from './FolderSelectModal';
import { getSelectedFolder, setSelectedFolder } from '../utils/downloadFolderManager';
import { API_URL as API_BASE } from '../../config';

const PastPapersAutoDownload = ({ userProfile, asSubmission = false }) => {
  // URL-based download state
  const [sourceUrl, setSourceUrl] = useState('');
  const [processId, setProcessId] = useState(null);
  const [processStatus, setProcessStatus] = useState(null);
  const [files, setFiles] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState({});
  const [statusInterval, setStatusInterval] = useState(null);
  
  // Folder selection state
  const [selectedFolder, setSelectedFolderState] = useState(() => getSelectedFolder());
  const [showFolderModal, setShowFolderModal] = useState(false);
  
  // Bulk selection state
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [sortCol, setSortCol] = useState('filename');
  const [sortDir, setSortDir] = useState('asc');
  const [downloadedHashes, setDownloadedHashes] = useState(new Set());
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);
  const [downloadStats, setDownloadStats] = useState({ total: 0, downloaded: 0, skipped: 0 });

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [statusInterval]);

  const startDownload = async () => {
    if (!sourceUrl.trim()) {
      setError('Please paste a DSpace URL');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setFiles([]);
      
      const response = await fetch(`${API_BASE}/api/elib/bulk-upload-pastpapers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim(),
          userId: userProfile?.id,
          asSubmission
        })
      });

      const data = await response.json();
      if (!data.ok) {
        setError(data.error || 'Failed to start download');
        return;
      }

      const pId = data.process.id;
      setProcessId(pId);
      setProcessStatus(data.process);

      // Poll for status updates
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/elib/bulk-upload-pastpapers/status/${pId}`);
          const statusData = await statusRes.json();
          
          if (statusData.ok) {
            setProcessStatus(statusData.process);
            
            if (statusData.process.status === 'completed') {
              setFiles(statusData.process.files || []);
              clearInterval(interval);
              setStatusInterval(null);
            }
          }
        } catch (err) {
          console.error('Status check error:', err);
        }
      }, 2000);

      setStatusInterval(interval);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSourceUrl(text);
    } catch (err) {
      setError('Could not paste from clipboard');
    }
  };

  const downloadPdf = async (file) => {
    try {
      setDownloading(prev => ({ ...prev, [file.url]: true }));
      
      const folderPath = selectedFolder || 'Downloads';
      console.log(`🗂️ [DOWNLOAD-SINGLE] Selected folder: "${selectedFolder}"`);
      console.log(`🗂️ [DOWNLOAD-SINGLE] Folder path to send: "${folderPath}"`);
      
      // Use backend to download and save to specific folder
      const response = await fetch(`${API_BASE}/api/elib/download-file-to-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: file.downloadUrl,
          folderPath: folderPath,
          filename: file.filename
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        setError(`✓ Downloaded to: ${result.fullPath}`);
        setTimeout(() => setError(''), 3000);
      } else {
        setError(`Download failed: ${result.error}`);
      }
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [file.url]: false }));
    }
  };

  const clearForm = () => {
    setSourceUrl('');
    setProcessId(null);
    setProcessStatus(null);
    setFiles([]);
    setError('');
    setSelectedFiles(new Set());
    setSelectAll(false);
    if (statusInterval) clearInterval(statusInterval);
  };

  const toggleFileSelection = (fileUrl) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileUrl)) {
      newSelected.delete(fileUrl);
    } else {
      newSelected.add(fileUrl);
    }
    setSelectedFiles(newSelected);
    setSelectAll(newSelected.size === files.filter(f => f.status === 'ready').length);
  };

  // Generate hash from file metadata for duplicate detection
  const generateFileHash = (file) => {
    // Create hash from filename and size
    return `${file.filename.toLowerCase()}_${file.size || 0}`;
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedFiles(new Set());
      setSelectAll(false);
    } else {
      const readyFiles = files.filter(f => f.status === 'ready');
      setSelectedFiles(new Set(readyFiles.map(f => f.url)));
      setSelectAll(true);
    }
  };

  const downloadSelectedFiles = async () => {
    const filesToDownload = files.filter(f => selectedFiles.has(f.url));
    
    if (filesToDownload.length === 0) {
      setError('No files selected');
      return;
    }

    try {
      let downloaded = 0;
      let skipped = 0;
      const newHashes = new Set(downloadedHashes);
      // Use the selected folder directly, don't append collection name
      const folderPath = selectedFolder || 'Downloads';
      
      console.log(`🗂️ [DOWNLOAD-BATCH] Starting download to folder: "${folderPath}"`);
      console.log(`🗂️ [DOWNLOAD-BATCH] Selected folder value: "${selectedFolder}"`);
      console.log(`🗂️ [DOWNLOAD-BATCH] Total files to download: ${filesToDownload.length}`);

      setDownloading(prev => {
        const newState = { ...prev };
        filesToDownload.forEach(f => newState[f.url] = true);
        return newState;
      });

      // Download files sequentially to avoid overload
      // Using backend endpoint to save to specific folder
      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        const fileHash = generateFileHash(file);

        // Check if file is duplicate
        if (downloadedHashes.has(fileHash)) {
          console.log(`Skipping duplicate: ${file.filename}`);
          skipped++;
          continue;
        }

        try {
          // Update downloading state to show progress
          setDownloading(prev => ({
            ...prev,
            [file.url]: `${i + 1}/${filesToDownload.length}`
          }));

          console.log(`📥 Downloading to folder: ${folderPath}`);

          // Call backend to download and save file to specific folder
          const response = await fetch(`${API_BASE}/api/elib/download-file-to-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileUrl: file.downloadUrl,
              folderPath: folderPath,
              filename: file.filename
            })
          });

          const result = await response.json();
          
          if (result.ok) {
            console.log(`✅ Saved to: ${result.fullPath}`);
            // Mark file as downloaded
            newHashes.add(fileHash);
            downloaded++;
          } else {
            console.error(`Failed to download ${file.filename}: ${result.error}`);
          }
          
          // Wait before starting next download
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`Error downloading ${file.filename}:`, err);
        }
      }

      // Update download stats
      setDownloadedHashes(newHashes);
      setDownloadStats(prev => ({
        total: prev.total + downloaded + skipped,
        downloaded: prev.downloaded + downloaded,
        skipped: prev.skipped + skipped
      }));

      if (downloaded > 0 || skipped > 0) {
        setError(`✓ Downloaded: ${downloaded} | Skipped duplicates: ${skipped}`);
      } else {
        setError('No new files to download');
      }
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(prev => {
        const newState = { ...prev };
        filesToDownload.forEach(f => delete newState[f.url]);
        return newState;
      });
    }
  };

  const cancelSelection = () => {
    setSelectedFiles(new Set());
    setSelectAll(false);
  };

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const getSortedFiles = () => {
    const sorted = [...files].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortCol) {
        case 'filename':
          aVal = a.filename.toLowerCase();
          bVal = b.filename.toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'size':
          aVal = a.size || 0;
          bVal = b.size || 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
  };

  return (
    <div>
      <FolderSelectModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          // Refresh selected folder from localStorage after modal closes
          const saved = getSelectedFolder();
          setSelectedFolderState(saved);
        }}
        onFolderSelect={(folder) => {
          setSelectedFolderState(folder);
          setSelectedFolder(folder);
        }}
        currentFolder={selectedFolder}
      />
      
      <div className="panel">
        <div className="panel-title">📥 Auto Download</div>

        {/* Input Section */}
        {!processId ? (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label className="label" style={{ marginBottom: '0.5rem' }}>DSpace URL</label>
                <input
                  type="text"
                  placeholder="Paste URL here"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  disabled={loading}
                  className="input"
                  onKeyPress={(e) => e.key === 'Enter' && startDownload()}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  onClick={handlePaste}
                  disabled={loading}
                  className="btn"
                  title="Paste from clipboard"
                >
                  📋 PASTE
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  onClick={() => setShowFolderModal(true)}
                  disabled={loading}
                  className="btn"
                  title="Select download folder"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <FiFolder size={16} /> Folder
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <button
                  onClick={startDownload}
                  disabled={loading || !sourceUrl.trim()}
                  className="btn primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {loading ? (
                    <>
                      <FiLoader style={{ animation: 'spin 1s linear infinite' }} /> ANALYZING...
                    </>
                  ) : (
                    <>
                      <FiDownload size={16} /> START
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Folder Selection Display */}
            <div style={{
              backgroundColor: '#0f1117',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#8696a0',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #374151'
            }}>
              <FiFolder size={14} style={{ color: '#00a884' }} />
              <span><strong style={{ color: '#e9edef' }}>Download Folder:</strong> {selectedFolder}</span>
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid #ff6b6b',
                borderRadius: '6px',
                color: '#ff6b6b',
                fontSize: '13px',
                marginBottom: '12px'
              }}>
                <FiAlertCircle size={16} /> {error}
              </div>
            )}

          </div>
        ) : (
          <>
            {/* Status Summary */}
            <div style={{ marginBottom: '16px', padding: '12px', background: '#0b141a', borderRadius: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00a884' }}>
                    {processStatus?.stats?.total || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '4px' }}>Total Found</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ff00' }}>
                    {processStatus?.stats?.successful || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '4px' }}>Ready</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffaa00' }}>
                    {processStatus?.stats?.failed || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '4px' }}>Failed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8696a0' }}>
                    {processStatus?.stats?.processed || 0}/{processStatus?.stats?.total || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '4px' }}>Processed</div>
                </div>
              </div>

              {processStatus?.status === 'running' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#1a3a3a',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#00a884'
                }}>
                  <FiLoader style={{ animation: 'spin 1s linear infinite' }} />
                  Processing PDF links... {processStatus.stats.processed}/{processStatus.stats.total}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {files.filter(f => f.status === 'ready').length > 0 && (
              <div className="actions" style={{ marginBottom: '12px' }}>
                <button className="btn primary" onClick={downloadSelectedFiles} disabled={selectedFiles.size === 0 || Object.values(downloading).some(v => v === true)}>
                  {Object.values(downloading).some(v => v === true) ? (
                    <>
                      <FiLoader style={{ animation: 'spin 1s linear infinite' }} size={14} /> Downloading...
                    </>
                  ) : (
                    <>
                      <FiDownload size={14} /> Download Selected ({selectedFiles.size})
                    </>
                  )}
                </button>
                {selectedFiles.size > 0 && (
                  <button className="btn" onClick={cancelSelection}>
                    <FiX size={14} /> Cancel Selection
                  </button>
                )}
              </div>
            )}

            {/* Files Table */}
            {files.length > 0 && (
              <div className="panel" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '12px' }}>
                <table className="table" style={{ minWidth: '800px', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center', padding: '16px 12px' }}>
                        <input
                          type="checkbox"
                          checked={selectAll && files.filter(f => f.status === 'ready').length > 0}
                          onChange={toggleSelectAll}
                          disabled={files.filter(f => f.status === 'ready').length === 0}
                          style={{ cursor: 'pointer', width: '24px', height: '24px', accentColor: '#00a884' }}
                        />
                      </th>
                      <th style={{ width: '50%', cursor: 'pointer' }} onClick={() => toggleSort('filename')}>
                        Filename {sortCol === 'filename' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ width: '20%', cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                        Status {sortCol === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ width: '15%', cursor: 'pointer' }} onClick={() => toggleSort('size')}>
                        Size {sortCol === 'size' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th style={{ width: '15%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedFiles().map((file, idx) => {
                      const isDuplicate = downloadedHashes.has(generateFileHash(file));
                      return (
                      <tr key={idx} style={{ opacity: isDuplicate ? 0.6 : 1 }}>
                        <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.url)}
                            onChange={() => toggleFileSelection(file.url)}
                            disabled={file.status !== 'ready' || isDuplicate}
                            style={{ cursor: file.status === 'ready' && !isDuplicate ? 'pointer' : 'not-allowed', width: '24px', height: '24px', accentColor: '#00a884' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiFileText size={14} style={{ color: isDuplicate ? '#ff6b6b' : '#00a884' }} />
                            <span title={file.filename} style={{ wordBreak: 'break-word', textDecoration: isDuplicate ? 'line-through' : 'none', color: isDuplicate ? '#999' : '#e9edef' }}>
                              {file.filename}
                              {isDuplicate && <span style={{ color: '#ff6b6b', marginLeft: '8px', fontSize: '11px' }}>(Already Downloaded)</span>}
                            </span>
                          </div>
                        </td>
                        <td>
                          {file.status === 'ready' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00a884' }}>
                              <FiCheck size={14} /> Ready
                            </span>
                          ) : file.status === 'processing' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffaa00' }}>
                              <FiClock size={14} /> Processing
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ff6b6b' }}>
                              <FiX size={14} /> {file.error || 'Failed'}
                            </span>
                          )}
                        </td>
                        <td style={{ color: '#8696a0', fontSize: '13px' }}>
                          {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '—'}
                        </td>
                        <td>
                          {file.status === 'ready' ? (
                            <button
                              onClick={() => downloadPdf(file)}
                              disabled={downloading[file.url]}
                              className="btn"
                              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', background: '#00a884', color: '#000', fontWeight: '600' }}
                            >
                              {downloading[file.url] ? (
                                <>
                                  <FiLoader style={{ animation: 'spin 1s linear infinite' }} /> {downloading[file.url] === true ? 'Downloading' : `Queue: ${downloading[file.url]}`}
                                </>
                              ) : (
                                <>
                                  <FiDownload size={12} /> Download
                                </>
                              )}
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#ff6b6b' }}>✗ Failed</span>
                          )}
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: error.includes('✓') ? 'rgba(0, 168, 132, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                border: error.includes('✓') ? '1px solid #00a884' : '1px solid #ff6b6b',
                borderRadius: '6px',
                color: error.includes('✓') ? '#00a884' : '#ff6b6b',
                fontSize: '13px',
                marginBottom: '12px'
              }}>
                {error.includes('✓') ? <FiCheck size={16} /> : <FiAlertCircle size={16} />} {error}
              </div>
            )}

            {downloadStats.total > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '12px'
              }}>
                <div style={{
                  background: 'rgba(0, 168, 132, 0.1)',
                  border: '1px solid #00a884',
                  borderRadius: '6px',
                  padding: '10px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#00a884' }}>{downloadStats.downloaded}</div>
                  <div style={{ fontSize: '11px', color: '#8696a0' }}>Downloaded</div>
                </div>
                <div style={{
                  background: 'rgba(255, 170, 0, 0.1)',
                  border: '1px solid #ffaa00',
                  borderRadius: '6px',
                  padding: '10px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#ffaa00' }}>{downloadStats.skipped}</div>
                  <div style={{ fontSize: '11px', color: '#8696a0' }}>Duplicates Skipped</div>
                </div>
                <div style={{
                  background: 'rgba(100, 150, 200, 0.1)',
                  border: '1px solid #6496c8',
                  borderRadius: '6px',
                  padding: '10px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#6496c8' }}>{downloadStats.total}</div>
                  <div style={{ fontSize: '11px', color: '#8696a0' }}>Total Processed</div>
                </div>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={clearForm}
              className="btn"
              style={{ width: '100%', marginTop: '12px' }}
            >
              ↺ Download Another Collection
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .panel {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 16px;
        }
        .panel-title {
          font-size: 18px;
          font-weight: 600;
          color: #e9edef;
          margin-bottom: 16px;
        }
        .label {
          display: block;
          font-size: 13px;
          color: #8696a0;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .input {
          width: 100%;
          padding: 10px 12px;
          background: #1f2c33;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #e9edef;
          font-size: 13px;
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: #00a884;
          box-shadow: 0 0 0 3px rgba(0, 168, 132, 0.1);
        }
        .input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn {
          padding: 10px 16px;
          background: #374151;
          border: none;
          border-radius: 6px;
          color: #e9edef;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn:hover:not(:disabled) {
          background: #4b5563;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn.primary {
          background: #00a884;
          color: #fff;
        }
        .btn.primary:hover:not(:disabled) {
          background: #00b399;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        .table thead tr {
          border-bottom: 2px solid #374151;
          background: rgba(0, 0, 0, 0.2);
        }
        .table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #8696a0;
          font-size: 12px;
          white-space: nowrap;
          user-select: none;
        }
        .table tbody tr {
          border-bottom: 1px solid #374151;
          transition: background 0.15s;
        }
        .table tbody tr:hover {
          background: rgba(0, 168, 132, 0.05);
        }
        .table td {
          padding: 12px 16px;
          color: #e9edef;
          font-size: 13px;
        }
        .actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
};

export default PastPapersAutoDownload;
