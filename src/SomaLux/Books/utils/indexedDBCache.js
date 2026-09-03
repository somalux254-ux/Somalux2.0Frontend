/**
 * IndexedDB persistent cache for ultra-fast offline/online book loading
 */

const DB_NAME = 'SomaLuxBooksDB';
const DB_VERSION = 2;
const STORES = {
  BOOKS: 'books',
  SEARCH: 'search_cache',
  TRENDING: 'trending',
  USER_CACHE: 'user_cache'
};

class IndexedDBCache {
  constructor() {
    this.db = null;
    this.isReady = this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available');
        resolve(false);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (db.objectStoreNames.contains('categories')) {
          db.deleteObjectStore('categories');
        }

        // Create object stores
        Object.values(STORES).forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            const objectStore = db.createObjectStore(store, { keyPath: 'id' });
            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log(`📦 Created store: ${store}`);
          }
        });
      };
    });
  }

  async saveBooks(page, books, ttlHours = 24) {
    if (!this.db) return;

    try {
      const tx = this.db.transaction([STORES.BOOKS], 'readwrite');
      const store = tx.objectStore(STORES.BOOKS);

      const now = Date.now();
      const expiresAt = now + (ttlHours * 60 * 60 * 1000);

      books.forEach((book, index) => {
        store.put({
          id: `${page}_${index}`,
          page,
          book,
          timestamp: now,
          expiresAt
        });
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`✅ Saved ${books.length} books for page ${page}`);
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Save books error:', e);
    }
  }

  async loadBooks(page) {
    if (!this.db) return null;

    try {
      const tx = this.db.transaction([STORES.BOOKS], 'readonly');
      const store = tx.objectStore(STORES.BOOKS);
      const index = store.index('timestamp');

      return new Promise((resolve) => {
        const request = index.getAll();
        
        request.onsuccess = () => {
          const results = request.result
            .filter(item => item.page === page && item.expiresAt > Date.now())
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(item => item.book);

          if (results.length > 0) {
            console.log(`🔥 Loaded ${results.length} books from IndexedDB page ${page}`);
            resolve(results);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('Load books error:', e);
      return null;
    }
  }

  async saveSearchResults(query, results, ttlHours = 24) {
    if (!this.db) return;

    try {
      const tx = this.db.transaction([STORES.SEARCH], 'readwrite');
      const store = tx.objectStore(STORES.SEARCH);

      const now = Date.now();
      
      store.put({
        id: query.toLowerCase(),
        query,
        results,
        timestamp: now,
        expiresAt: now + (ttlHours * 60 * 60 * 1000)
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log(`✅ Saved search results for "${query}"`);
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Save search error:', e);
    }
  }

  async loadSearchResults(query) {
    if (!this.db) return null;

    try {
      const tx = this.db.transaction([STORES.SEARCH], 'readonly');
      const store = tx.objectStore(STORES.SEARCH);

      return new Promise((resolve) => {
        const request = store.get(query.toLowerCase());
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.expiresAt > Date.now()) {
            console.log(`🔥 Loaded search results from IndexedDB for "${query}"`);
            resolve(result.results);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('Load search error:', e);
      return null;
    }
  }

  async clearExpiredData() {
    if (!this.db) return;

    const now = Date.now();
    const stores = Object.values(STORES);

    stores.forEach(storeName => {
      try {
        const tx = this.db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(STORES.BOOKS);
        const index = store.index('timestamp');

        const range = IDBKeyRange.upperBound(now);
        index.openCursor(range).onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.value.expiresAt < now) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      } catch (e) {
        console.warn(`Error clearing ${storeName}:`, e);
      }
    });

    console.log('🗑️ Cleared expired IndexedDB data');
  }

  async getStorageStats() {
    if (!this.db) return null;

    try {
      let totalItems = 0;
      let storageBreakdown = {};

      const promises = Array.from(Object.values(STORES)).map(storeName => {
        return new Promise((resolve) => {
          const tx = this.db.transaction([storeName], 'readonly');
          const store = tx.objectStore(storeName);
          const request = store.count();
          
          request.onsuccess = () => {
            storageBreakdown[storeName] = request.result;
            totalItems += request.result;
            resolve();
          };

          request.onerror = () => resolve();
        });
      });

      await Promise.all(promises);

      return {
        totalItems,
        breakdown: storageBreakdown,
        estimatedSizeMB: (totalItems * 5) / 1024 / 1024 // Rough estimate
      };
    } catch (e) {
      console.warn('Storage stats error:', e);
      return null;
    }
  }

  async clearAll() {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(Object.values(STORES), 'readwrite');
      
      Object.values(STORES).forEach(storeName => {
        tx.objectStore(storeName).clear();
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          console.log('🗑️ Cleared all IndexedDB data');
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Clear all error:', e);
    }
  }
}

// Export singleton
export const indexedDBCache = new IndexedDBCache();
