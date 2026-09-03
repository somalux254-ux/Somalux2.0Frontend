import React, { useState, useEffect } from 'react';
import { FiDownload, FiRefreshCw, FiPlay, FiPause, FiX, FiCheck, FiAlertCircle, FiGrid } from 'react-icons/fi';
import './PastPapersDownloader.css';
import { API_URL as API_BASE } from '../../config';

const PastPapersDownloader = ({ userProfile, asSubmission = false }) => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [currentProcess, setCurrentProcess] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [incompleteProcess, setIncompleteProcess] = useState(null);
  const [toast, setToast] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 12;

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (error) showToast(error, 'error');
  }, [error]);

  // Fetch available schools
  useEffect(() => {
    const fetchSchools = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/elib/pastpapers/schools`);
        const data = await response.json();
        if (data.ok) {
          setSchools(data.schools);
        } else {
          setError(data.error || 'Failed to fetch schools');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  // Poll for process status
  useEffect(() => {
    if (!currentProcess) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/elib/pastpapers/download/status/${currentProcess.id}`);
        const data = await response.json();

        if (response.ok && data.ok && data.process) {
          const safeProcess = {
            ...data.process,
            stats: {
              total: data.process?.stats?.total ?? 0,
              processed: data.process?.stats?.processed ?? 0,
              successful: data.process?.stats?.successful ?? 0,
              failed: data.process?.stats?.failed ?? 0,
              skipped: data.process?.stats?.skipped ?? 0
            }
          };
          setCurrentProcess(safeProcess);

          if (safeProcess.status === 'completed' || safeProcess.status === 'failed') {
            clearInterval(interval);
            fetchProcesses();
          }
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentProcess?.id]);

  // Fetch all download processes
  const fetchProcesses = async () => {
    try {
      const userId = userProfile?.id || userProfile?.uid || null;
      const url = userId 
        ? `${API_BASE}/api/elib/pastpapers/downloads/processes?userId=${userId}`
        : `${API_BASE}/api/elib/pastpapers/downloads/processes`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.ok) {
        setProcesses(data.processes.sort((a, b) => 
          new Date(b.startTime) - new Date(a.startTime)
        ));

        // Check for incomplete process
        const incomplete = data.processes.find(p => 
          (p.status === 'paused' || p.status === 'failed') && !incompleteProcess
        );
        if (incomplete) {
          setIncompleteProcess(incomplete);
        }
      }
    } catch (err) {
      console.error('Failed to fetch processes:', err);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, []);

  // Start bulk download
  const handleStartDownload = async () => {
    if (!selectedSchool) {
      showToast('Please select a school', 'error');
      return;
    }

    const userId = userProfile?.id || userProfile?.uid || null;

    try {
      const response = await fetch(`${API_BASE}/api/elib/pastpapers/bulk-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchool.id,
          schoolName: selectedSchool.name,
          userId
        })
      });

      const data = await response.json();
      if (data.ok) {
        setCurrentProcess(data.process);
        showToast(`Started downloading from ${selectedSchool.name}`, 'success');
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handlePause = async () => {
    if (!currentProcess) return;
    try {
      const response = await fetch(
        `${API_BASE}/api/elib/pastpapers/download/pause/${currentProcess.id}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.ok) {
        setCurrentProcess({ ...currentProcess, status: 'paused' });
        showToast('Download paused', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResume = async () => {
    if (!currentProcess) return;
    try {
      const response = await fetch(
        `${API_BASE}/api/elib/pastpapers/download/resume/${currentProcess.id}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.ok) {
        setCurrentProcess({ ...currentProcess, status: 'running' });
        showToast('Download resumed', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleStop = async () => {
    if (!currentProcess) return;
    try {
      const response = await fetch(
        `${API_BASE}/api/elib/pastpapers/download/stop/${currentProcess.id}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.ok) {
        showToast('Download stopped', 'success');
        setCurrentProcess(null);
        setShowStopConfirm(false);
        fetchProcesses();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const resumeIncompleteProcess = async () => {
    if (!incompleteProcess) return;
    try {
      const response = await fetch(
        `${API_BASE}/api/elib/pastpapers/download/resume/${incompleteProcess.id}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.ok) {
        setCurrentProcess(incompleteProcess);
        setShowResumeConfirm(false);
        setIncompleteProcess(null);
        showToast('Download resumed', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getProgressPercentage = () => {
    if (!currentProcess?.stats?.total) return 0;
    return Math.round((currentProcess.stats.processed / currentProcess.stats.total) * 100);
  };

  const paginatedProcesses = processes.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  );

  const totalPages = Math.ceil(processes.length / HISTORY_PAGE_SIZE);

  return (
    <div className="past-papers-downloader">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="pp-container">
        {/* School Selection Section */}
        <div className="pp-section">
          <h2>
            <FiDownload /> Select School to Download
          </h2>

          {loading && <div className="pp-loading">Loading schools...</div>}

          {!loading && (
            <div className="pp-schools-grid">
              {schools.map((school) => (
                <div
                  key={school.id}
                  className={`pp-school-card ${selectedSchool?.id === school.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSchool(school)}
                >
                  <div className="pp-school-content">
                    <h3>{school.name}</h3>
                    <p className="pp-school-count">{school.paperCount} papers</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedSchool && (
            <button
              className="pp-btn pp-btn-primary"
              onClick={handleStartDownload}
              disabled={!selectedSchool || !!currentProcess}
            >
              <FiPlay /> Start Download: {selectedSchool.name}
            </button>
          )}
        </div>

        {/* Resume Incomplete Section */}
        {showResumeConfirm && incompleteProcess && (
          <div className="pp-modal-overlay">
            <div className="pp-modal">
              <h3>Resume Download?</h3>
              <p>
                You have an incomplete download from <strong>{incompleteProcess.schoolName}</strong>
              </p>
              <p className="pp-stats">
                {incompleteProcess.stats?.successful || 0} papers downloaded,{' '}
                {incompleteProcess.stats?.total - incompleteProcess.stats?.processed || 0} remaining
              </p>
              <div className="pp-modal-buttons">
                <button className="pp-btn pp-btn-secondary" onClick={() => setShowResumeConfirm(false)}>
                  Start New
                </button>
                <button className="pp-btn pp-btn-primary" onClick={resumeIncompleteProcess}>
                  <FiRefreshCw /> Resume
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Download Progress Section */}
        {currentProcess && (
          <div className="pp-section pp-progress-section">
            <h2>Download in Progress</h2>
            <div className="pp-progress-card">
              <div className="pp-progress-header">
                <h3>{currentProcess.schoolName}</h3>
                <span className={`pp-status pp-status-${currentProcess.status}`}>
                  {currentProcess.status.toUpperCase()}
                </span>
              </div>

              <div className="pp-progress-stats">
                <div className="pp-stat">
                  <span className="pp-stat-label">Processed</span>
                  <span className="pp-stat-value">
                    {currentProcess.stats?.processed || 0} / {currentProcess.stats?.total || 0}
                  </span>
                </div>
                <div className="pp-stat">
                  <span className="pp-stat-label">Successful</span>
                  <span className="pp-stat-value pp-stat-success">
                    {currentProcess.stats?.successful || 0}
                  </span>
                </div>
                <div className="pp-stat">
                  <span className="pp-stat-label">Failed</span>
                  <span className="pp-stat-value pp-stat-failed">
                    {currentProcess.stats?.failed || 0}
                  </span>
                </div>
                <div className="pp-stat">
                  <span className="pp-stat-label">Skipped</span>
                  <span className="pp-stat-value pp-stat-skipped">
                    {currentProcess.stats?.skipped || 0}
                  </span>
                </div>
              </div>

              <div className="pp-progress-bar">
                <div
                  className="pp-progress-fill"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <p className="pp-progress-text">{getProgressPercentage()}% complete</p>

              {currentProcess.errors && currentProcess.errors.length > 0 && (
                <div className="pp-errors">
                  <h4>
                    <FiAlertCircle /> Errors ({currentProcess.errors.length})
                  </h4>
                  <ul>
                    {currentProcess.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {currentProcess.errors.length > 5 && (
                      <li>... and {currentProcess.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="pp-progress-controls">
                {currentProcess.status === 'running' && (
                  <>
                    <button className="pp-btn pp-btn-secondary" onClick={handlePause}>
                      <FiPause /> Pause
                    </button>
                    <button
                      className="pp-btn pp-btn-danger"
                      onClick={() => setShowStopConfirm(true)}
                    >
                      <FiX /> Stop
                    </button>
                  </>
                )}
                {currentProcess.status === 'paused' && (
                  <>
                    <button className="pp-btn pp-btn-primary" onClick={handleResume}>
                      <FiPlay /> Resume
                    </button>
                    <button
                      className="pp-btn pp-btn-danger"
                      onClick={() => setShowStopConfirm(true)}
                    >
                      <FiX /> Stop
                    </button>
                  </>
                )}
                {(currentProcess.status === 'completed' || currentProcess.status === 'failed') && (
                  <button
                    className="pp-btn pp-btn-secondary"
                    onClick={() => setCurrentProcess(null)}
                  >
                    <FiX /> Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stop Confirmation Modal */}
        {showStopConfirm && (
          <div className="pp-modal-overlay">
            <div className="pp-modal">
              <h3>Stop Download?</h3>
              <p>
                {currentProcess.stats?.successful || 0} papers downloaded so far.
              </p>
              <p className="pp-warning">You can resume this download later.</p>
              <div className="pp-modal-buttons">
                <button className="pp-btn pp-btn-secondary" onClick={() => setShowStopConfirm(false)}>
                  Continue
                </button>
                <button className="pp-btn pp-btn-danger" onClick={handleStop}>
                  <FiX /> Stop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download History Section */}
        <div className="pp-section">
          <h2>
            <FiGrid /> Download History
          </h2>

          {processes.length === 0 ? (
            <p className="pp-empty">No download history yet</p>
          ) : (
            <>
              <div className="pp-history-grid">
                {paginatedProcesses.map((process) => (
                  <div key={process.id} className="pp-history-card">
                    <div className="pp-history-header">
                      <h4>{process.schoolName}</h4>
                      <span className={`pp-status pp-status-${process.status}`}>
                        {process.status}
                      </span>
                    </div>

                    <div className="pp-history-stats">
                      <div className="pp-hist-stat">
                        <FiCheck className="pp-icon-success" />
                        <span>{process.stats?.successful || 0} downloaded</span>
                      </div>
                      <div className="pp-hist-stat">
                        <FiX className="pp-icon-failed" />
                        <span>{process.stats?.failed || 0} failed</span>
                      </div>
                      <div className="pp-hist-stat">
                        <span>{process.stats?.skipped || 0} skipped</span>
                      </div>
                    </div>

                    <p className="pp-history-time">
                      {new Date(process.startTime).toLocaleString()}
                    </p>

                    {(process.status === 'paused' || process.status === 'failed') && (
                      <button
                        className="pp-btn pp-btn-small pp-btn-primary"
                        onClick={() => {
                          setIncompleteProcess(process);
                          setShowResumeConfirm(true);
                        }}
                      >
                        <FiRefreshCw /> Resume
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pp-pagination">
                  <button
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(historyPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {historyPage} of {totalPages}
                  </span>
                  <button
                    disabled={historyPage === totalPages}
                    onClick={() => setHistoryPage(historyPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PastPapersDownloader;
