/**
 * Clear All Upload History and Caches
 * ============================================================
 * Browser-side utility to clear all cached data
 * 
 * Usage:
 * 1. Open browser DevTools (F12)
 * 2. Go to Console tab
 * 3. Copy all code and paste into console
 * 4. Press Enter
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CACHE_CONFIG = {
  // localStorage keys to clear
  localStoragePatterns: [
    'pastPapers:',
    'universities:',
    'dropdown',
    'myPrivacyCache',
    'userProfile',
    'books:',
    'authors:',
    'cacheControl',
    'cache_',
    'upload_',
  ],
  
  // IndexedDB databases to delete
  indexedDBDatabases: [
    'books',
    'authors',
    'past_papers',
    'SomaLux',
    'SomaLuxCache',
    'app_cache',
    'pdf_cache',
  ],
  
  // Service Worker caches to delete
  serviceWorkerCaches: [
    'v1',
    'v2',
    'app-cache',
    'data-cache',
    'file-cache',
    'pages-cache',
  ]
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================


// ============================================================
// PART 1: CLEAR LOCAL STORAGE
// ============================================================

function clearLocalStorage() {
  let cleared = 0;
  let errors = 0;

  try {
    const keys = Object.keys(localStorage);
    
    // Clear by pattern
    keys.forEach(key => {
      const shouldClear = CACHE_CONFIG.localStoragePatterns.some(pattern => 
        key.startsWith(pattern)
      );
      
      if (shouldClear) {
        try {
          localStorage.removeItem(key);
          cleared++;
        } catch (e) {
          errors++;
        }
      }
    });
    
    return { cleared, errors };
  } catch (e) {
    return { cleared: 0, errors: 1 };
  }
}

// ============================================================
// PART 2: CLEAR SESSION STORAGE
// ============================================================

function clearSessionStorage() {
  try {
    const itemCount = sessionStorage.length;
    sessionStorage.clear();
    return { cleared: itemCount, errors: 0 };
  } catch (e) {
    return { cleared: 0, errors: 1 };
  }
}

// ============================================================
// PART 3: CLEAR INDEXED DB
// ============================================================

async function clearIndexedDB() {
  let deleted = 0;
  let errors = 0;

  // Get all IndexedDB databases
  if ('databases' in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        try {
          indexedDB.deleteDatabase(db.name);
          deleted++;
        } catch (e) {
          errors++;
        }
      }
    } catch (e) {
    }
  }
  
  // Also try to delete specific known databases
  for (const dbName of CACHE_CONFIG.indexedDBDatabases) {
    try {
      indexedDB.deleteDatabase(dbName);
      deleted++;
    } catch (e) {
      // Silent fail for known DBs
    }
  }

  return { deleted, errors };
}

// ============================================================
// PART 4: CLEAR SERVICE WORKER CACHE
// ============================================================

async function clearServiceWorkerCache() {
  
  if (!('caches' in window)) {
    return { deleted: 0, errors: 0 };
  }

  try {
    const cacheNames = await caches.keys();
    let deleted = 0;
    let errors = 0;

    for (const cacheName of cacheNames) {
      try {
        const deleted_result = await caches.delete(cacheName);
        if (deleted_result) {
          deleted++;
        }
      } catch (e) {
        errors++;
      }
    }

    return { deleted, errors };
  } catch (e) {
    return { deleted: 0, errors: 1 };
  }
}

// ============================================================
// PART 5: CLEAR COOKIES
// ============================================================

function clearCookies() {
  let cleared = 0;

  try {
    document.cookie.split(";").forEach(c => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      
      if (name) {
        document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
        document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/;domain=localhost`;
        cleared++;
      }
    });
    
    return { cleared, errors: 0 };
  } catch (e) {
    return { cleared: 0, errors: 1 };
  }
}

// ============================================================
// PART 6: MAIN EXECUTION
// ============================================================

async function clearAllCaches() {

  const results = {
    localStorage: clearLocalStorage(),
    sessionStorage: clearSessionStorage(),
    cookies: clearCookies(),
  };

  // Async operations
  results.indexedDB = await clearIndexedDB();
  results.serviceWorkerCache = await clearServiceWorkerCache();




  return results;
}

// ============================================================
// EXECUTE
// ============================================================

// Run the cache clearing
clearAllCaches().catch(error => {
});

// ============================================================
// EXPORT FOR MANUAL USE
// ============================================================

// Global functions for individual cache clearing
window.clearCaches = {
  localStorage: clearLocalStorage,
  sessionStorage: clearSessionStorage,
  indexedDB: clearIndexedDB,
  serviceWorkerCache: clearServiceWorkerCache,
  cookies: clearCookies,
  all: clearAllCaches,
};
