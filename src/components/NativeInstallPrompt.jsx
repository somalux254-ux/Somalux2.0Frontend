import React from 'react';
import { FiX } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import { API_URL } from '../config';
import './NativeInstallPrompt.css';

const APK_DOWNLOAD_URL = `${API_URL}/api/android/apk/download?source=website-prompt`;
const APK_DOWNLOAD_STARTED_KEY = 'somalux-apk-download-started';
const APK_PROMPT_VIEW_COUNT_KEY = 'somalux-apk-prompt-view-count';
const MAX_APK_PROMPT_VIEWS = 3;
const APK_PROMPT_DURATION_MS = 10000;

const getBooleanSetting = (key) => {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch (error) {
    return false;
  }
};

export const NativeInstallPrompt = () => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (Capacitor.getPlatform() !== 'web' || getBooleanSetting(APK_DOWNLOAD_STARTED_KEY)) {
      return undefined;
    }

    let viewCount = 0;
    try {
      viewCount = Number.parseInt(window.localStorage.getItem(APK_PROMPT_VIEW_COUNT_KEY) || '0', 10);
    } catch (error) {}

    if (viewCount >= MAX_APK_PROMPT_VIEWS) return undefined;

    try {
      window.localStorage.setItem(APK_PROMPT_VIEW_COUNT_KEY, String(viewCount + 1));
    } catch (error) {}

    setIsVisible(true);
    const timeoutId = window.setTimeout(() => setIsVisible(false), APK_PROMPT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const startDownload = () => {
    try {
      window.localStorage.setItem(APK_DOWNLOAD_STARTED_KEY, 'true');
    } catch (error) {}
    setIsVisible(false);
  };

  const dismissPrompt = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside className="native-install-prompt" role="status" aria-label="Install Somalux App">
      <div className="native-install-content">
        <img className="native-install-logo" src="/Som96.png" alt="" />
        <div className="native-install-text">
          <span className="native-install-label">Install</span>
          <strong>Somalux</strong>
        </div>
      </div>

      <a className="native-install-action" href={APK_DOWNLOAD_URL} onClick={startDownload}>
        <span>Install</span>
      </a>

      <button
        className="native-install-close"
        type="button"
        onClick={dismissPrompt}
        aria-label="Dismiss app download prompt"
      >
        <FiX aria-hidden="true" />
      </button>
    </aside>
  );
};

export default NativeInstallPrompt;
