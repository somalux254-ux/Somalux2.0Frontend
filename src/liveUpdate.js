import { Capacitor } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

const UPDATE_MANIFEST_URL = '/ota/latest.json';

const isLiveReload = process.env.ANDROID_LIVE_RELOAD === 'true' || Boolean(process.env.CAPACITOR_LIVE_RELOAD_URL);

export const initializeLiveUpdate = async () => {
  if (!Capacitor.isNativePlatform() || isLiveReload) return;

  try {
    const readyResult = await LiveUpdate.ready();
    const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });

    if (!response.ok) return;

    const manifest = await response.json();
    if (!manifest.bundleId || !manifest.url || manifest.bundleId === readyResult.currentBundleId) return;

    await LiveUpdate.downloadBundle({
      artifactType: 'zip',
      bundleId: manifest.bundleId,
      checksum: manifest.checksum,
      url: manifest.url,
    });
    await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
    console.log('[LiveUpdate] Update downloaded and will apply on next app launch.');
  } catch (error) {
    console.warn('[LiveUpdate] Update check failed:', error?.message || error);
  }
};