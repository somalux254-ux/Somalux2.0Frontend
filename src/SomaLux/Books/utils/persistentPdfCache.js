const CACHE_NAME = 'somalux-pdf-files-v1';
const inFlightCaches = new Map();
const objectUrls = new Set();

const cacheRequestFor = (cacheKey) => new Request(
  `https://somalux.local/pdf-cache/${encodeURIComponent(cacheKey)}`
);

export async function getPersistentPdfSource(cacheKey, networkSource) {
  if (!cacheKey || !networkSource || !('caches' in window)) return networkSource;

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheRequestFor(cacheKey));
    if (!cachedResponse) return networkSource;

    const blobUrl = URL.createObjectURL(await cachedResponse.blob());
    objectUrls.add(blobUrl);
    console.log('[pdf-cache] Persistent cache hit', { cacheKey });
    return blobUrl;
  } catch (error) {
    console.warn('[pdf-cache] Persistent cache read failed', { cacheKey, error: error.message });
    return networkSource;
  }
}

export function cachePdfAfterFirstPage(cacheKey, networkSource) {
  if (!cacheKey || !networkSource || !('caches' in window) || inFlightCaches.has(cacheKey)) return;

  const request = (async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheRequest = cacheRequestFor(cacheKey);
      if (await cache.match(cacheRequest)) return;

      const response = await fetch(networkSource, { cache: 'no-store' });
      if (!response.ok) return;

      await cache.put(cacheRequest, response);
      console.log('[pdf-cache] Cached after first page', { cacheKey });
    } catch (error) {
      console.warn('[pdf-cache] Background cache failed', { cacheKey, error: error.message });
    } finally {
      inFlightCaches.delete(cacheKey);
    }
  })();

  inFlightCaches.set(cacheKey, request);
}

export async function clearPersistentPdfCache() {
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls.clear();
  return 'caches' in window ? caches.delete(CACHE_NAME) : false;
}
