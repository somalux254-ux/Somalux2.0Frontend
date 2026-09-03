/**
 * Cache Manager - Local Storage with TTL and Real-time Updates
 * Reduces Supabase requests and improves performance
 */

const CACHE_PREFIX = 'elib_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = '1.0';

export class CacheManager {
  constructor(namespace = 'default') {
    this.namespace = namespace;
    this.memoryCache = new Map();
    this.subscribers = new Map();
  }

  /**
   * Generate cache key
   */
  _generateKey(key) {
    return `${CACHE_PREFIX}${this.namespace}_${key}`;
  }

  /**
   * Set cache with TTL
   */
  set(key, data, ttl = DEFAULT_TTL) {
    const cacheKey = this._generateKey(key);
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl,
      version: CACHE_VERSION
    };

    try {
      // Store in memory cache
      this.memoryCache.set(cacheKey, cacheData);

      // Store in localStorage
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));

      // Notify subscribers
      this._notifySubscribers(key, data);

      return true;
    } catch (error) {
      console.warn('Cache set failed:', error);
      // If localStorage is full, clear old entries
      if (error.name === 'QuotaExceededError') {
        this.clearExpired();
        // Retry once
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Get cached data
   */
  get(key, fallbackValue = null) {
    const cacheKey = this._generateKey(key);

    // Check memory cache first (fastest)
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (this._isValid(cached)) {
        return cached.data;
      }
      this.memoryCache.delete(cacheKey);
    }

    // Check localStorage
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        
        // Validate version and TTL
        if (this._isValid(cached)) {
          // Restore to memory cache
          this.memoryCache.set(cacheKey, cached);
          return cached.data;
        }
        
        // Expired, remove it
        localStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.warn('Cache get failed:', error);
    }

    return fallbackValue;
  }

  /**
   * Check if cached data is valid
   */
  _isValid(cached) {
    if (!cached || cached.version !== CACHE_VERSION) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    return age < cached.ttl;
  }

  /**
   * Remove specific cache entry
   */
  remove(key) {
    const cacheKey = this._generateKey(key);
    this.memoryCache.delete(cacheKey);
    localStorage.removeItem(cacheKey);
    return true;
  }

  /**
   * Clear all cache for this namespace
   */
  clear() {
    const prefix = `${CACHE_PREFIX}${this.namespace}_`;
    
    // Clear memory cache
    this.memoryCache.clear();

    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    return true;
  }

  /**
   * Clear expired entries across all namespaces
   */
  clearExpired() {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = JSON.parse(localStorage.getItem(key));
          if (!this._isValid(cached)) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} expired cache entries`);
    return keysToRemove.length;
  }

  /**
   * Subscribe to cache updates (real-time)
   */
  subscribe(key, callback) {
    const cacheKey = this._generateKey(key);
    if (!this.subscribers.has(cacheKey)) {
      this.subscribers.set(cacheKey, new Set());
    }
    this.subscribers.get(cacheKey).add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(cacheKey);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(cacheKey);
        }
      }
    };
  }

  /**
   * Notify subscribers of updates
   */
  _notifySubscribers(key, data) {
    const cacheKey = this._generateKey(key);
    const subs = this.subscribers.get(cacheKey);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Subscriber callback error:', error);
        }
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalSize = 0;
    let totalEntries = 0;
    let expiredEntries = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
          totalEntries++;
          
          try {
            const cached = JSON.parse(value);
            if (!this._isValid(cached)) {
              expiredEntries++;
            }
          } catch {
            expiredEntries++;
          }
        }
      }
    }

    return {
      totalEntries,
      expiredEntries,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      memoryEntries: this.memoryCache.size
    };
  }
}

// Singleton instances for different data types
export const booksCache = new CacheManager('books');
export const statsCache = new CacheManager('stats');
export const userCache = new CacheManager('user');

// Auto-clear expired entries on app load
setTimeout(() => {
  booksCache.clearExpired();
}, 1000);

export default CacheManager;
