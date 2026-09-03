import React from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import './NativeInstallPrompt.css';

const APK_DOWNLOAD_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/latest/download/somalux.apk';
const DISMISSED_KEY = 'somalux-native-install-prompt-dismissed';

export const NativeInstallPrompt = () => {
  const [isVisible, setIsVisible] = React.useState(() => {
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    const wasDismissed = window.localStorage.getItem(DISMISSED_KEY) === 'true';
    return !Capacitor.isNativePlatform() && !isStandalone && !wasDismissed;
  });

  const dismissPrompt = () => {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside className="native-install-prompt" role="status">
      <div>
        <strong>Get the SomaLux app</strong>
        <span>Download the Android app for the full experience.</span>
      </div>
      <a className="native-install-action" href={APK_DOWNLOAD_URL} onClick={dismissPrompt}>
        <FiDownload aria-hidden="true" />
        <span>Download APK</span>
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
