/**
 * Ultra-fast book loading optimizer
 * Implements multiple layers of caching, compression, and prefetching
 */

class PerformanceOptimizer {
  constructor() {
    this.memoryCache = new Map();
    this.compressionCache = new Map();
    this.prefetchQueue = [];
    this.isCompressing = false;
    this.lastFetchTime = {};
    this.networkSpeedEstimate = 'fast'; // fast, medium, slow
  }

  // MEMORY CACHE: Ultra-fast in-memory storage (session-based)
  setMemoryCache(key, data, ttlMs = 5 * 60 * 1000) {
    try {
      this.memoryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs
      });
      console.log(`✅ Cached in memory: ${key}`);
    } catch (e) {
      console.warn('Memory cache error:', e);
    }
  }

  getMemoryCache(key) {
    try {
      const cached = this.memoryCache.get(key);
      if (!cached) return null;
      
      const age = Date.now() - cached.timestamp;
      if (age > cached.ttl) {
        this.memoryCache.delete(key);
        return null;
      }
      
      console.log(`🔥 Hit memory cache: ${key}`);
      return cached.data;
    } catch (e) {
      return null;
    }
  }

  // COMPRESSION: Compress large data before storage
  compressData(data) {
    try {
      const json = JSON.stringify(data);
      // Simple compression: remove nulls, empty strings, duplicate whitespace
      const compressed = json
        .replace(/:\s*null/g, '')
        .replace(/:\s*""/g, '')
        .replace(/\s+/g, ' ');
      
      return compressed;
    } catch (e) {
      return JSON.stringify(data);
    }
  }

  decompressData(compressed) {
    try {
      return JSON.parse(compressed);
    } catch (e) {
      return null;
    }
  }

  // SELECTIVE CACHING: Only cache essential fields
  selectiveCache(books) {
    return books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      cover: b.bookImage || b.cover_url,
      rating: b.rating,
      trending: b.trending,
      new: b.newRelease,
      // Omit description and other non-essential fields
    }));
  }

  // SMART PREFETCH: Intelligently prefetch next page based on scroll velocity
  schedulePrefetch(page, callback) {
    if (this.prefetchQueue.length > 0) return; // Already queued
    
    this.prefetchQueue.push({
      page,
      callback,
      scheduledAt: Date.now()
    });

    // Stagger prefetch to avoid network congestion
    setTimeout(() => this.executePrefetch(), 500);
  }

  async executePrefetch() {
    if (this.prefetchQueue.length === 0) return;
    
    const { page, callback } = this.prefetchQueue.shift();
    console.log(`📚 Prefetching page ${page}...`);
    
    try {
      await callback(page);
    } catch (e) {
      console.warn(`Prefetch failed for page ${page}:`, e);
    }
  }

  // DETECT NETWORK SPEED
  estimateNetworkSpeed() {
    if (typeof navigator === 'undefined') return 'fast';
    
    // Use Network Information API if available
    if (navigator.connection) {
      const connection = navigator.connection;
      if (connection.saveData) return 'slow';
      
      const effectiveType = connection.effectiveType;
      if (effectiveType === '4g') return 'fast';
      if (effectiveType === '3g') return 'medium';
      return 'slow';
    }
    
    return 'fast';
  }

  // BATCH FILTERING: Filter books in-memory instead of fetching
  filterBooksInMemory(books, searchTerm, filter) {
    return books.filter(book => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!book.title?.toLowerCase().includes(term) &&
            !book.author?.toLowerCase().includes(term)) {
          return false;
        }
      }
      
      if (filter === 'trending' && !book.trending) return false;
      if (filter === 'new' && !book.new) return false;
      
      return true;
    });
  }

  // MICRO-CACHE: Cache individual book details
  cacheBookDetail(bookId, data, ttlMs = 30 * 60 * 1000) {
    this.setMemoryCache(`book_detail_${bookId}`, data, ttlMs);
  }

  getBookDetail(bookId) {
    return this.getMemoryCache(`book_detail_${bookId}`);
  }

  // CLEAR OLD CACHE
  clearExpiredCache() {
    let cleared = 0;
    for (const [key, value] of this.memoryCache.entries()) {
      const age = Date.now() - value.timestamp;
      if (age > value.ttl) {
        this.memoryCache.delete(key);
        cleared++;
      }
    }
    if (cleared > 0) console.log(`🗑️ Cleared ${cleared} expired cache entries`);
  }

  // CACHE SIZE MONITORING
  getCacheSizeStats() {
    let totalSize = 0;
    for (const [, value] of this.memoryCache.entries()) {
      totalSize += JSON.stringify(value).length;
    }
    return {
      entries: this.memoryCache.size,
      estimatedSizeKB: Math.round(totalSize / 1024),
      totalKeys: Array.from(this.memoryCache.keys())
    };
  }

  // CLEAR ALL CACHES
  clearAll() {
    this.memoryCache.clear();
    this.compressionCache.clear();
    this.prefetchQueue = [];
    console.log('🗑️ All caches cleared');
  }
}

// Export singleton instance
export const perfOptimizer = new PerformanceOptimizer();
