/**
 * DownloadOptimizer - High-performance download utility
 * Features:
 * - Streaming downloads with progress tracking
 * - Parallel chunk downloads for large files
 * - Aggressive browser caching
 * - IndexedDB offline storage
 * - Automatic retry on failure
 */

export class DownloadOptimizer {
  constructor(options = {}) {
    this.maxConcurrentChunks = options.maxConcurrentChunks || 4;
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB chunks
    this.cacheDBName = 'SomaLuxDownloads';
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Download a file with maximum speed using streaming and caching
   */
  async downloadFile(url, filename, onProgress = null) {
    try {
      // Try to get from cache first
      const cachedBlob = await this.getCachedFile(filename);
      if (cachedBlob) {
        console.log('✅ Using cached file:', filename);
        this.triggerDownload(cachedBlob, filename);
        return;
      }

      // Fetch file with aggressive caching and streaming
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = parseInt(response.headers.get('content-length') || 0);
      const chunks = [];
      let downloadedBytes = 0;

      // Stream the response for memory efficiency
      const reader = response.body.getReader();
      
      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          downloadedBytes += value.length;
          
          if (onProgress && contentLength > 0) {
            const progress = (downloadedBytes / contentLength) * 100;
            onProgress(progress, downloadedBytes, contentLength);
          }
        } catch (error) {
          reader.cancel();
          throw error;
        }
      }

      // Create blob and cache it
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const blob = new Blob(chunks, { type: contentType });

      // Cache for offline access
      await this.cacheFile(filename, blob);

      // Trigger download
      this.triggerDownload(blob, filename);
      
      console.log(`✅ Downloaded ${filename} (${this.formatBytes(blob.size)})`);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * Download file with automatic retry on failure
   */
  async fetchWithRetry(url, attempt = 0) {
    try {
      return await fetch(url, {
        method: 'GET',
        cache: 'force-cache', // Use browser cache aggressively
        headers: {
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=31536000', // 1 year
        },
        priority: 'high', // High priority in browser's fetch queue
      });
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await this.delay(this.retryDelay * Math.pow(2, attempt)); // Exponential backoff
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Download large files using parallel chunks
   */
  async downloadLargeFile(url, filename, onProgress = null) {
    try {
      // Get file size first
      const headResponse = await this.fetchWithRetry(url);
      const contentLength = parseInt(headResponse.headers.get('content-length') || 0);

      if (contentLength < 5 * 1024 * 1024) {
        // If under 5MB, use simple streaming
        return this.downloadFile(url, filename, onProgress);
      }

      // Download using parallel chunks
      const chunkCount = Math.ceil(contentLength / this.chunkSize);
      const chunks = new Array(chunkCount);
      let downloadedBytes = 0;

      // Download chunks in parallel
      const activeDownloads = [];
      for (let i = 0; i < chunkCount; i++) {
        activeDownloads.push(this.downloadChunk(url, i, chunks, contentLength)
          .then((bytes) => {
            downloadedBytes += bytes;
            if (onProgress) {
              const progress = (downloadedBytes / contentLength) * 100;
              onProgress(progress, downloadedBytes, contentLength);
            }
          })
        );

        // Limit concurrent downloads
        if (activeDownloads.length >= this.maxConcurrentChunks) {
          await Promise.race(activeDownloads);
          activeDownloads.splice(0, activeDownloads.length - (this.maxConcurrentChunks - 1));
        }
      }

      // Wait for all downloads
      await Promise.all(activeDownloads);

      // Combine chunks and create blob
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      
      // Cache for offline access
      await this.cacheFile(filename, blob);

      // Trigger download
      this.triggerDownload(blob, filename);
      
      console.log(`✅ Downloaded large file ${filename} (${this.formatBytes(blob.size)})`);
    } catch (error) {
      console.error('Large file download failed:', error);
      throw error;
    }
  }

  /**
   * Download a single chunk of a file
   */
  async downloadChunk(url, chunkIndex, chunks, totalSize) {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize - 1, totalSize - 1);

    const response = await this.fetchWithRetry(url);
    const reader = response.body.getReader();
    const chunk = [];
    let bytesRead = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunk.push(value);
      bytesRead += value.length;
    }

    chunks[chunkIndex] = new Uint8Array(
      chunk.reduce((acc, val) => new Uint8Array([...acc, ...val]))
    );

    return bytesRead;
  }

  /**
   * Cache file in IndexedDB for offline access
   */
  async cacheFile(filename, blob) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction('files', 'readwrite');
      const objectStore = transaction.objectStore('files');

      await new Promise((resolve, reject) => {
        const request = objectStore.put({
          filename,
          blob,
          timestamp: Date.now(),
          size: blob.size,
        });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });

      console.log(`💾 Cached ${filename} in IndexedDB`);
    } catch (error) {
      console.warn('Failed to cache file:', error);
    }
  }

  /**
   * Get cached file from IndexedDB
   */
  async getCachedFile(filename) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction('files', 'readonly');
      const objectStore = transaction.objectStore('files');

      return new Promise((resolve, reject) => {
        const request = objectStore.get(filename);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.blob : null);
        };
      });
    } catch (error) {
      console.warn('Failed to get cached file:', error);
      return null;
    }
  }

  /**
   * Trigger browser download
   */
  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Open or create IndexedDB database
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.cacheDBName, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          const objectStore = db.createObjectStore('files', { keyPath: 'filename' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Delay utility for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction('files', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = transaction.objectStore('files').clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
      console.log('✅ Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction('files', 'readonly');
      const objectStore = transaction.objectStore('files');

      return new Promise((resolve, reject) => {
        const request = objectStore.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const files = request.result;
          const totalSize = files.reduce((sum, f) => sum + f.size, 0);
          resolve({
            fileCount: files.length,
            totalSize,
            formattedSize: this.formatBytes(totalSize),
            files: files.map(f => ({
              filename: f.filename,
              size: this.formatBytes(f.size),
              timestamp: new Date(f.timestamp).toLocaleString(),
            })),
          });
        };
      });
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const downloadOptimizer = new DownloadOptimizer({
  maxConcurrentChunks: 4,
  chunkSize: 1024 * 1024, // 1MB chunks
  retryAttempts: 3,
  retryDelay: 1000,
});
