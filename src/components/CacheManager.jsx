import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { downloadOptimizer } from '../utils/DownloadOptimizer';

const CacheManagerContainer = styled.div`
  background: rgba(20, 30, 48, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  backdrop-filter: blur(10px);
`;

const Title = styled.h3`
  color: #e5e7eb;
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.9rem;
  color: #9ca3af;

  &:last-child {
    border-bottom: none;
  }
`;

const StatLabel = styled.span`
  color: #d1d5db;
`;

const StatValue = styled.span`
  color: #10b981;
  font-weight: 600;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const Button = styled.button`
  flex: 1;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  color: #e5e7eb;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3));
    border-color: rgba(99, 102, 241, 0.5);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FileList = styled.div`
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px;
`;

const FileItem = styled.div`
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.8rem;
  color: #9ca3af;

  &:last-child {
    border-bottom: none;
  }
`;

const FileName = styled.div`
  color: #e5e7eb;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileInfo = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: #6b7280;
  font-size: 0.75rem;
`;

/**
 * CacheManager - Display and manage download cache
 */
export const CacheManager = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    // Refresh stats every 5 seconds
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const cacheStats = await downloadOptimizer.getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (window.confirm('Clear all cached files? This will delete all offline downloads.')) {
      await downloadOptimizer.clearCache();
      setStats(null);
      await loadStats();
    }
  };

  if (loading) {
    return (
      <CacheManagerContainer>
        <Title>📦 Download Cache</Title>
        <StatRow>
          <StatLabel>Loading cache info...</StatLabel>
        </StatRow>
      </CacheManagerContainer>
    );
  }

  if (!stats) {
    return (
      <CacheManagerContainer>
        <Title>📦 Download Cache</Title>
        <StatRow>
          <StatLabel>No cached files yet</StatLabel>
        </StatRow>
        <StatRow>
          <StatLabel>Download files to populate cache</StatLabel>
        </StatRow>
      </CacheManagerContainer>
    );
  }

  return (
    <CacheManagerContainer>
      <Title>📦 Download Cache Manager</Title>

      <StatRow>
        <StatLabel>Cached Files</StatLabel>
        <StatValue>{stats.fileCount}</StatValue>
      </StatRow>

      <StatRow>
        <StatLabel>Total Cache Size</StatLabel>
        <StatValue>{stats.formattedSize}</StatValue>
      </StatRow>

      {stats.files && stats.files.length > 0 && (
        <>
          <Title style={{ marginTop: '12px', fontSize: '0.9rem' }}>📄 Cached Files</Title>
          <FileList>
            {stats.files.map((file, index) => (
              <FileItem key={index}>
                <FileName title={file.filename}>
                  {file.filename}
                </FileName>
                <FileInfo>
                  <span>{file.size}</span>
                  <span>{file.timestamp}</span>
                </FileInfo>
              </FileItem>
            ))}
          </FileList>
        </>
      )}

      <ButtonGroup>
        <Button onClick={loadStats}>🔄 Refresh</Button>
        <Button onClick={handleClear} style={{ color: '#ef4444' }}>
          🗑️ Clear Cache
        </Button>
      </ButtonGroup>
    </CacheManagerContainer>
  );
};

export default CacheManager;
