import React from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { Capacitor } from '@capacitor/core';
import './NativeInstallPrompt.css';

const APK_DOWNLOAD_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/latest/download/somalux.apk';
const DISMISSED_KEY = 'somalux-apk-download-prompt-dismissed-v2';

export const NativeInstallPrompt = () => {
  const [isVisible, setIsVisible] = React.useState(() => {
    let wasDismissed = false;
    try {
      wasDismissed = window.localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch (error) {}
    return Capacitor.getPlatform() === 'web' && !wasDismissed;
  });

  const dismissPrompt = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, 'true');
    } catch (error) {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside className="native-install-prompt" role="status" aria-label="Install SomaLux">
      <div>
        <strong>Take SomaLux with you</strong>
        <span>Download the Android app for a faster, fuller reading experience.</span>
      </div>
      <a className="native-install-action" href={APK_DOWNLOAD_URL} onClick={dismissPrompt}>
        <FiDownload size={24} aria-hidden="true" />
        <span>Get the app</span>
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
