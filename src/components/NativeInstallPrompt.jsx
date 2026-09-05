import React from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import { API_URL } from '../config';
import './NativeInstallPrompt.css';

const APK_DOWNLOAD_URL = `${API_URL}/api/android/apk/download?source=website-prompt`;
const APK_DOWNLOAD_STARTED_KEY = 'somalux-apk-download-started';

export const NativeInstallPrompt = () => {
  const [isVisible, setIsVisible] = React.useState(() => {
    let downloadStarted = false;
    try {
      downloadStarted = window.localStorage.getItem(APK_DOWNLOAD_STARTED_KEY) === 'true';
    } catch (error) {}
    return Capacitor.getPlatform() === 'web' && !downloadStarted;
  });

  React.useEffect(() => {
    if (Capacitor.getPlatform() !== 'web') {
      setIsVisible(false);
      return undefined;
    }

    const reminderId = window.setInterval(() => {
      let downloadStarted = false;
      try {
        downloadStarted = window.localStorage.getItem(APK_DOWNLOAD_STARTED_KEY) === 'true';
      } catch (error) {}

      if (downloadStarted) {
        setIsVisible(false);
        return;
      }

      setIsVisible((visible) => !visible);
    }, 30000);

    return () => window.clearInterval(reminderId);
  }, []);

  const startDownload = () => {
    try {
      window.localStorage.setItem(APK_DOWNLOAD_STARTED_KEY, 'true');
    } catch (error) {}
    setIsVisible(false);
  };

  const dismissPrompt = () => setIsVisible(false);

  if (!isVisible) return null;

  return (
    <aside className="native-install-prompt" role="status" aria-label="Install Somalux">
      <img className="native-install-logo" src="/Som96.png" alt="" />
      <div>
        <strong>Somalux</strong>
        <span>Download and install the mobile app for a better experience.</span>
      </div>
      <a className="native-install-action" href={APK_DOWNLOAD_URL} onClick={startDownload}>
        <FiDownload size={24} aria-hidden="true" />
        <span>Download and install</span>
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
