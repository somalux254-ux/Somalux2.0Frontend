import { API_URL } from '../../../config';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import React from 'react';

const APK_DOWNLOAD_URL = `${API_URL}/api/android/apk/download?source=settings-apps`;

const apps = [
  { name: 'Somalux', description: 'Books and exam papers', logo: '/Som144.png', installable: true },
  { name: 'PlayerPal', description: 'Your media companion', logo: '/PlayerPal.png' },
  { name: 'Joblink', description: 'Jobs and opportunities', logo: '/LinkWhite192.png' },
  { name: 'Luminar', description: 'Learn and grow', logo: '/Luminar192.png' },
  { name: 'Staylink', description: 'Stay connected', logo: '/PaltechWhite192.png' },
];

export const AppsTab = () => {
  const [appAction, setAppAction] = React.useState('Install');

  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return undefined;

    let isMounted = true;
    CapacitorApp.getInfo()
      .then(({ version }) => fetch(`${API_URL}/api/android/apk/status?currentVersion=${encodeURIComponent(version)}`))
      .then((response) => response.json())
      .then(({ updateAvailable }) => {
        if (isMounted) setAppAction(updateAvailable ? 'Update' : 'Installed');
      })
      .catch(() => {
        if (isMounted) setAppAction('Installed');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const installApp = () => {
    try {
      window.localStorage.setItem('somalux-apk-download-started', 'true');
    } catch (error) {}
  };

  return (
    <div className="settings-stp-page-section">
      <div className="settings-stp-app-grid">
        {apps.map((app) => (
          <div className="settings-stp-app-tile" key={app.name}>
            <span className="settings-stp-app-icon">
              <img className={`settings-stp-app-logo-${app.name.toLowerCase()}`} src={app.logo} alt="" />
            </span>
            <span className="settings-stp-app-details">
              <span className="settings-stp-app-name">{app.name}</span>
              <span className="settings-stp-app-description">{app.description}</span>
            </span>
            {app.installable && appAction === 'Install' && (
              <a className="settings-stp-app-install" href={APK_DOWNLOAD_URL} onClick={installApp}>
                {appAction}
              </a>
            )}
            {app.installable && appAction === 'Update' && (
              <a className="settings-stp-app-install" href={APK_DOWNLOAD_URL} onClick={installApp}>
                Update
              </a>
            )}
            {app.installable && appAction === 'Installed' && (
              <span className="settings-stp-app-install settings-stp-app-coming-soon">
                Installed
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
