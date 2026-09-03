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

function logStatus(message, status = 'info') {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳'
  };
  const icon = icons[status] || '•';
  const style = {
    success: 'color: #10b981; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
    warning: 'color: #f59e0b; font-weight: bold;',
    info: 'color: #3b82f6; font-weight: bold;',
    loading: 'color: #8b5cf6; font-weight: bold;'
  };
  console.log(`%c${icon} ${message}`, style[status] || '');
}

// ============================================================
// PART 1: CLEAR LOCAL STORAGE
// ============================================================

function clearLocalStorage() {
  logStatus('Clearing localStorage...', 'loading');
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
    
    logStatus(`Cleared ${cleared} localStorage items`, 'success');
    return { cleared, errors };
  } catch (e) {
    logStatus(`localStorage error: ${e.message}`, 'error');
    return { cleared: 0, errors: 1 };
  }
}

// ============================================================
// PART 2: CLEAR SESSION STORAGE
// ============================================================

function clearSessionStorage() {
  logStatus('Clearing sessionStorage...', 'loading');
  try {
    const itemCount = sessionStorage.length;
    sessionStorage.clear();
    logStatus(`Cleared sessionStorage (${itemCount} items)`, 'success');
    return { cleared: itemCount, errors: 0 };
  } catch (e) {
    logStatus(`sessionStorage error: ${e.message}`, 'error');
    return { cleared: 0, errors: 1 };
  }
}

// ============================================================
// PART 3: CLEAR INDEXED DB
// ============================================================

async function clearIndexedDB() {
  logStatus('Clearing IndexedDB...', 'loading');
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
          logStatus(`Deleted IndexedDB: ${db.name}`, 'success');
        } catch (e) {
          errors++;
          logStatus(`Failed to delete ${db.name}: ${e.message}`, 'error');
        }
      }
    } catch (e) {
      logStatus(`IndexedDB.databases() not supported: ${e.message}`, 'warning');
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

  logStatus(`IndexedDB cleanup processed`, 'success');
  return { deleted, errors };
}

// ============================================================
// PART 4: CLEAR SERVICE WORKER CACHE
// ============================================================

async function clearServiceWorkerCache() {
  logStatus('Clearing Service Worker caches...', 'loading');
  
  if (!('caches' in window)) {
    logStatus('Service Worker Cache API not available', 'warning');
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
          logStatus(`Deleted cache: ${cacheName}`, 'success');
        }
      } catch (e) {
        errors++;
        logStatus(`Failed to delete cache ${cacheName}: ${e.message}`, 'error');
      }
    }

    logStatus(`Service Worker caches cleared (${deleted} caches)`, 'success');
    return { deleted, errors };
  } catch (e) {
    logStatus(`Service Worker cache error: ${e.message}`, 'error');
    return { deleted: 0, errors: 1 };
  }
}

// ============================================================
// PART 5: CLEAR COOKIES
// ============================================================

function clearCookies() {
  logStatus('Clearing cookies...', 'loading');
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
    
    logStatus(`Cleared ${cleared} cookies`, 'success');
    return { cleared, errors: 0 };
  } catch (e) {
    logStatus(`Cookies error: ${e.message}`, 'error');
    return { cleared: 0, errors: 1 };
  }
}

// ============================================================
// PART 6: MAIN EXECUTION
// ============================================================

async function clearAllCaches() {
  console.clear();
  logStatus('═══════════════════════════════════════════════════', 'info');
  logStatus('CLEARING ALL UPLOAD HISTORY & SYSTEM CACHES', 'info');
  logStatus('═══════════════════════════════════════════════════', 'info');
  console.log('');

  const results = {
    localStorage: clearLocalStorage(),
    sessionStorage: clearSessionStorage(),
    cookies: clearCookies(),
  };

  // Async operations
  results.indexedDB = await clearIndexedDB();
  results.serviceWorkerCache = await clearServiceWorkerCache();

  console.log('');
  logStatus('═══════════════════════════════════════════════════', 'info');
  logStatus('SUMMARY', 'info');
  logStatus('═══════════════════════════════════════════════════', 'info');

  console.table({
    'localStorage': `${results.localStorage.cleared} items cleared`,
    'sessionStorage': `${results.sessionStorage.cleared} items cleared`,
    'Cookies': `${results.cookies.cleared} items cleared`,
    'IndexedDB': `Processed`,
    'Service Worker Cache': `${results.serviceWorkerCache.deleted} caches cleared`,
  });

  console.log('');
  logStatus('✅ ALL CACHES CLEARED SUCCESSFULLY!', 'success');
  logStatus('Next steps:', 'info');
  console.log(`
  1. Hard Refresh Browser:
     • Windows/Linux: Ctrl + Shift + Delete
     • Mac: Cmd + Shift + Delete or Cmd + Opt + E
  
  2. Or press Ctrl+F5 / Cmd+Shift+R for hard reload
  
  3. Log out and log back in if needed
  
  4. Check that upload history is now empty in admin panel
  `);

  return results;
}

// ============================================================
// EXECUTE
// ============================================================

// Run the cache clearing
clearAllCaches().then(results => {
  logStatus('Cache clearing process complete!', 'success');
  console.log('Results:', results);
}).catch(error => {
  logStatus(`Unexpected error: ${error.message}`, 'error');
  console.error(error);
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

console.log('Cache clearing utilities available as window.clearCaches');
