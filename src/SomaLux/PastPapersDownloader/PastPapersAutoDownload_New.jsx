import React, { useState, useEffect } from 'react';
import { FiDownload, FiLoader, FiAlertCircle } from 'react-icons/fi';
import './PastPapersAutoDownload.css';
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

  const copyExample = () => {
    navigator.clipboard.writeText('https://pastpapers.ku.ac.ke/handle/123456789/4547');
  };

  const downloadPdf = async (file) => {
    try {
      setDownloading(prev => ({ ...prev, [file.url]: true }));
      
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    if (statusInterval) clearInterval(statusInterval);
  };

  return (
    <div className="pp-container">
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 'bold' }}>
        📥 Paste URL & Auto-Download
      </h1>
      
      {error && (
        <div className="pp-error" style={{ marginBottom: '16px' }}>
          <FiAlertCircle /> {error}
        </div>
      )}

      {!processId ? (
        <div className="pp-step">
          <h2 style={{ marginBottom: '8px' }}>Download PDFs from DSpace Collection</h2>
          <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '20px' }}>
            Paste a DSpace collection, community, or item URL to download all PDFs automatically
          </p>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Paste URL here (e.g., https://example.com/handle/123456789/4547)"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #444',
                backgroundColor: '#222',
                color: '#fff',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
              onKeyPress={(e) => e.key === 'Enter' && startDownload()}
            />
            <button
              onClick={handlePaste}
              disabled={loading}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#666',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#777')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#666')}
            >
              📋 PASTE
            </button>
          </div>

          <button
            onClick={startDownload}
            disabled={loading || !sourceUrl.trim()}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading || !sourceUrl.trim() ? '#555' : '#00a884',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading || !sourceUrl.trim() ? 'not-allowed' : 'pointer',
              marginBottom: '20px',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <>
                <FiLoader style={{ animation: 'spin 1s linear infinite' }} /> ANALYZING...
              </>
            ) : (
              <>
                <FiDownload /> START DOWNLOAD
              </>
            )}
          </button>

          <div style={{ 
            backgroundColor: '#1e3a4c', 
            padding: '12px 16px', 
            borderRadius: '8px',
            fontSize: '13px',
            color: '#aaa'
          }}>
            <strong style={{ color: '#0f9' }}>Example URLs:</strong>
            <div style={{ marginTop: '8px', fontFamily: 'monospace', color: '#0f9', cursor: 'pointer' }}
              onClick={copyExample}
              title="Click to copy"
              onMouseEnter={(e) => e.target.style.color = '#0ff'}
              onMouseLeave={(e) => e.target.style.color = '#0f9'}
            >
              https://pastpapers.ku.ac.ke/handle/123456789/4547
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px' }}>Click to copy example</div>
          </div>

          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <div className="pp-step">
          <h2 style={{ marginBottom: '20px' }}>Download Results</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px' }}>
              Status: <strong style={{ color: processStatus?.status === 'completed' ? '#0f9' : '#0ff' }}>
                {processStatus?.status.toUpperCase()}
              </strong>
            </div>
            
            {processStatus && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#0f4c2a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00a884' }}>
                    {processStatus.stats.total}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Total</div>
                </div>
                <div style={{ backgroundColor: '#1a3a1a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ff00' }}>
                    {processStatus.stats.successful}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Ready</div>
                </div>
                <div style={{ backgroundColor: '#3a2a1a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffaa00' }}>
                    {processStatus.stats.failed}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Failed</div>
                </div>
                <div style={{ backgroundColor: '#2a2a3a', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#aaa' }}>
                    {processStatus.stats.processed}/{processStatus.stats.total}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Done</div>
                </div>
              </div>
            )}

            {processStatus?.status === 'running' && (
              <div style={{ 
                backgroundColor: '#1a3a3a', 
                padding: '12px 16px', 
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <FiLoader style={{ animation: 'spin 1s linear infinite', color: '#00a884', fontSize: '18px' }} />
                <span>Processing PDF links... {processStatus.stats.processed}/{processStatus.stats.total}</span>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '12px', color: '#00a884' }}>
                {files.filter(f => f.status === 'ready').length} PDFs Ready to Download
              </h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '6px' }}>
                {files.map((file, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: file.status === 'ready' ? '#1a2a1a' : '#2a1a1a',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    borderLeft: `3px solid ${file.status === 'ready' ? '#00a884' : '#ff6b6b'}`,
                    transition: 'background-color 0.2s'
                  }}>
                    <div style={{ flex: 1, minWidth: '0' }}>
                      <div style={{ color: file.status === 'ready' ? '#fff' : '#aaa', wordBreak: 'break-word' }}>
                        {file.filename}
                      </div>
                      {file.status === 'failed' && (
                        <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px' }}>
                          {file.error}
                        </div>
                      )}
                    </div>
                    {file.status === 'ready' ? (
                      <button
                        onClick={() => downloadPdf(file)}
                        disabled={downloading[file.url]}
                        style={{
                          marginLeft: '12px',
                          padding: '8px 12px',
                          backgroundColor: downloading[file.url] ? '#555' : '#00a884',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: downloading[file.url] ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseEnter={(e) => !downloading[file.url] && (e.target.style.backgroundColor = '#00b399')}
                        onMouseLeave={(e) => !downloading[file.url] && (e.target.style.backgroundColor = '#00a884')}
                      >
                        {downloading[file.url] ? (
                          <>
                            <FiLoader style={{ animation: 'spin 1s linear infinite' }} /> Downloading
                          </>
                        ) : (
                          <>
                            <FiDownload /> Download
                          </>
                        )}
                      </button>
                    ) : (
                      <span style={{ marginLeft: '12px', fontSize: '12px', color: '#ff6b6b', whiteSpace: 'nowrap' }}>✗ Failed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={clearForm}
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '20px',
              backgroundColor: '#444',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#555'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#444'}
          >
            ↺ Download Another Collection
          </button>
        </div>
      )}

      <style>{`
        .pp-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
        }
        .pp-step {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #333;
          border-radius: 12px;
          padding: 24px;
        }
        .pp-error {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid #ff6b6b;
          border-radius: 8px;
          color: #ff6b6b;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default PastPapersAutoDownload;
