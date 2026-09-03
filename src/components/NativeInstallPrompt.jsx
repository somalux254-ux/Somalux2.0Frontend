import React from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import './NativeInstallPrompt.css';

const APK_DOWNLOAD_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/latest/download/somalux.apk';

export const NativeInstallPrompt = () => {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  return (
    <aside className="native-install-prompt" role="status">
      <div>
        <strong>Get the SomaLux app</strong>
        <span>Download the Android app for the full experience.</span>
      </div>
      <a className="native-install-action" href={APK_DOWNLOAD_URL}>
        <FiDownload aria-hidden="true" />
        <span>Download APK</span>
      </a>
      <button
        className="native-install-close"
        type="button"
        onClick={() => setIsVisible(false)}
        aria-label="Dismiss app download prompt"
      >
        <FiX aria-hidden="true" />
      </button>
    </aside>
  );
};

export default NativeInstallPrompt;
