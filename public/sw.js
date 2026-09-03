// Service Worker for SomaLux Downloads - High-Speed Caching & Offline Access
const CACHE_NAME = 'somalux-downloads-v2';
const DOWNLOAD_CACHE = 'somalux-files-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {
        // Ignore errors for missing files
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  );
  self.clients.claim();
});

// Fetch event - implement smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle document requests
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          // Only cache full responses (200), not partial ones (206)
          if (fetchResponse.ok && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return fetchResponse;
        }).catch(() => {
          return caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Handle file downloads (PDFs, etc.)
  if (request.method === 'GET' && (url.pathname.match(/\.(pdf|epub|doc|docx)$/i) || request.headers.get('accept')?.includes('pdf'))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request, {
          // Enable range requests for faster resume
          headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            ...request.headers
          }
        }).then((response) => {
          // Cache successful downloads - skip partial responses (206)
          if (response.ok && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DOWNLOAD_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Return cached version if offline
          return caches.match(request);
        });
      })
    );
    return;
  }

  // Handle other requests with network-first strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses - skip partial responses (206)
        if (response.ok && response.status === 200 && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache if offline, or return offline page
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});

// Handle background sync for queued downloads
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-downloads') {
    event.waitUntil(syncPendingDownloads());
  }
});

async function syncPendingDownloads() {
  try {
    // Check IndexedDB for pending downloads
    const db = await openDB('SomaLuxDownloads');
    const pendingDownloads = await db.getAll('pending');
    
    for (const download of pendingDownloads) {
      try {
        const response = await fetch(download.url);
        // Only cache full responses (200), not partial ones (206)
        if (response.ok && response.status === 200) {
          const cache = await caches.open(DOWNLOAD_CACHE);
          await cache.put(download.url, response.clone());
          await db.delete('pending', download.id);
        }
      } catch (error) {
        console.error('Sync download failed:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

function openDB(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
