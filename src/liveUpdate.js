import { Capacitor } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

const DEFAULT_LIVE_UPDATE_URL = process.env.REACT_APP_LIVE_UPDATE_BASE_URL || 'https://somalux.co.ke';
const isLiveReload = process.env.ANDROID_LIVE_RELOAD === 'true' || Boolean(process.env.CAPACITOR_LIVE_RELOAD_URL);

const getUpdateManifestUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
    return new URL('/ota/latest.json', window.location.origin).toString();
  }

  return `${DEFAULT_LIVE_UPDATE_URL}/ota/latest.json`;
};

export const initializeLiveUpdate = async () => {
  if (!Capacitor.isNativePlatform() || isLiveReload) return;

  try {
    const manifestUrl = `${getUpdateManifestUrl()}?t=${Date.now()}`;
    const readyResult = await LiveUpdate.ready();
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
    });

    if (!response.ok) return;

    const manifest = await response.json();
    if (!manifest.bundleId || !manifest.url || manifest.bundleId === readyResult.currentBundleId) return;

    const bundleUrl = /^https?:\/\//i.test(manifest.url)
      ? manifest.url
      : `${DEFAULT_LIVE_UPDATE_URL}${manifest.url.startsWith('/') ? '' : '/'}${manifest.url}`;

    await LiveUpdate.downloadBundle({
      artifactType: 'zip',
      bundleId: manifest.bundleId,
      checksum: manifest.checksum,
      url: bundleUrl,
    });
    await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
    console.log('[LiveUpdate] Update downloaded and will apply on next app launch.');
  } catch (error) {
    console.warn('[LiveUpdate] Update check failed:', error?.message || error);
  }
};