/**
 * Service Worker Registration & Management
 * Handles SW lifecycle, updates, and feature cache invalidation
 */

/**
 * Register service worker
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    console.log('Service Worker registered:', registration);

    // Don't check for updates automatically to avoid continuous reloading
    // Users can manually refresh to get updates

    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed - features refreshing');
      // Only notify, don't reload to avoid infinite loops
      if (window.__featureFlagsContext) {
        window.__featureFlagsContext.refreshFeatures?.();
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
};

/**
 * Notify user that new version is available
 * Can show toast or banner
 */
function notifyNewVersionAvailable(registration) {
  // You can implement a toast notification here
  console.log('New app version available');
  // Don't auto-update - let user manually refresh when ready
}

/**
 * Tell service worker to skip waiting and activate immediately
 */
export const skipWaiting = (registration) => {
  const worker = registration?.waiting;
  if (worker) {
    worker.postMessage({ type: 'SKIP_WAITING' });
  }
};

/**
 * Clear features cache - triggers feature refresh
 */
export const clearFeaturesCache = () => {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_FEATURES_CACHE',
    });
  }
};

/**
 * Clear all caches
 */
export const clearAllCaches = () => {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_ALL_CACHES',
    });
  }
};

/**
 * Listen for messages from service worker
 */
export const listenForServiceWorkerMessages = (callback) => {
  navigator.serviceWorker?.addEventListener('message', (event) => {
    const { type, data } = event.data;

    if (type === 'FEATURE_UPDATE') {
      console.log('Feature update from service worker:', data);
      callback({ type, data });
    }
  });
};

export default registerServiceWorker;
