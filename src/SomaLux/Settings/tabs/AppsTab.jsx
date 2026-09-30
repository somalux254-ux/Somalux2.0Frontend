import { API_URL } from '../../../config';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';
import { FiCheck, FiLoader } from 'react-icons/fi';
import React from 'react';

const APK_DOWNLOAD_URL = `${API_URL}/api/android/apk/download?source=settings-apps`;
const PLAYERPAL_APK_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/download/PlayPal/PlayPal.apk';
const LUMINAR_APK_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/download/Luminar/Luminar.apk';
const JOBLINK_APK_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/download/Joblink/Joblink.apk';
const STAYLINK_APK_URL = 'https://github.com/somalux254-ux/Somalux2.0Frontend/releases/download/StayLink/Staylink.apk';
const DOWNLOADED_APPS_KEY = 'somalux-downloaded-apps';
const ApkInstaller = registerPlugin('ApkInstaller');

const apps = [
  { name: 'Somalux', detectionNames: ['Somalux', 'somalux'], packageIds: ['com.somalux.app', 'com.somalux'], description: 'Books and exam papers', logo: '/Som144.png', installable: true, apkUrl: APK_DOWNLOAD_URL },
  { name: 'PlayerPal', detectionNames: ['PlayerPal', 'PlayPal', 'playerpal', 'playpal'], packageIds: ['com.playerpal.app', 'com.playerpal', 'com.playpal'], description: 'Your media companion', logo: '/PlayerPal.png', installable: true, apkUrl: PLAYERPAL_APK_URL },
  { name: 'Joblink', detectionNames: ['Joblink', 'joblink', 'job-link', 'job link'], packageIds: ['com.joblink.app', 'com.joblink'], description: 'Jobs and opportunities', logo: '/LinkWhite192.png', installable: true, apkUrl: JOBLINK_APK_URL },
  { name: 'Luminar', detectionNames: ['Luminar', 'luminar', 'luminar app'], packageIds: ['com.luminar.app', 'com.luminar'], description: 'Learn and grow', logo: '/Luminar192.png', installable: true, apkUrl: LUMINAR_APK_URL },
  { name: 'Staylink', detectionNames: ['Staylink', 'StayLink', 'staylink', 'stay-link', 'stay link'], packageIds: ['com.staylink.app', 'com.staylink'], description: 'Stay connected', logo: '/PaltechWhite192.png', installable: true, apkUrl: STAYLINK_APK_URL },
];

export const AppsTab = () => {
  const [appAction, setAppAction] = React.useState('Install');
  const [currentAppId, setCurrentAppId] = React.useState(null);
  const [installedApps, setInstalledApps] = React.useState({});
  const [downloadedApps, setDownloadedApps] = React.useState({});
  const [installingApp, setInstallingApp] = React.useState(null);
  const [openingApp, setOpeningApp] = React.useState(null);
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const cancelledDownload = React.useRef(false);
  const checkingStates = React.useRef(false);

  const refreshAppStates = React.useCallback(async () => {
    if (Capacitor.getPlatform() === 'web' || checkingStates.current) return;
    checkingStates.current = true;

    try {
      let savedDownloadedApps = {};
      try {
        savedDownloadedApps = JSON.parse(window.localStorage.getItem(DOWNLOADED_APPS_KEY) || '{}');
      } catch (error) {}

      const result = await ApkInstaller.getAppStates({
        apps: apps.filter((app) => app.installable).map((app) => ({
          name: app.name,
          packageIds: (app.packageIds || []).join('|'),
          filename: `${app.name.toLowerCase()}.apk`,
        })),
      });
      const states = result?.apps || {};
      const installed = Object.fromEntries(apps.map((app) => [app.name, Boolean(states[app.name]?.installed)]));
      const downloaded = Object.fromEntries(apps.map((app) => [
        app.name,
        Boolean(states[app.name]?.downloaded && savedDownloadedApps[app.name] && !installed[app.name]),
      ]));

      setInstalledApps(installed);
      setDownloadedApps(downloaded);
      Object.keys(installed).forEach((name) => {
        if (installed[name]) delete savedDownloadedApps[name];
      });
      window.localStorage.setItem(DOWNLOADED_APPS_KEY, JSON.stringify(savedDownloadedApps));
    } catch (error) {
      console.warn('[AppsTab] Unable to refresh app states:', error?.message || error);
    } finally {
      checkingStates.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return undefined;

    let listener;
    ApkInstaller.addListener('downloadProgress', ({ progress }) => {
      setDownloadProgress(Number(progress) || 0);
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove();
    };
  }, []);

  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return undefined;

    const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refreshAppStates();
    });

    return () => {
      appStateListener.then((listener) => listener.remove());
    };
  }, [refreshAppStates]);

  React.useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return undefined;

    let isMounted = true;
    void refreshAppStates();

    CapacitorApp.getInfo()
      .then(({ id, version }) => {
        if (isMounted) setCurrentAppId(String(id || '').toLowerCase());
        return fetch(`${API_URL}/api/android/apk/status?currentVersion=${encodeURIComponent(version)}`);
      })
      .then((response) => response.json())
      .then(({ updateAvailable }) => {
        if (isMounted && updateAvailable) setAppAction('Update');
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [refreshAppStates]);

  const installApp = async (app) => {
    try {
      window.localStorage.setItem('somalux-apk-download-started', 'true');
    } catch (error) {}

    if (Capacitor.getPlatform() === 'web') return;

    setInstallingApp(app.name);
    setDownloadProgress(0);
    cancelledDownload.current = false;
    try {
      await ApkInstaller.install({ url: app.apkUrl, filename: `${app.name.toLowerCase()}.apk` });
      setDownloadedApps((current) => ({ ...current, [app.name]: true }));
      try {
        const saved = JSON.parse(window.localStorage.getItem(DOWNLOADED_APPS_KEY) || '{}');
        window.localStorage.setItem(DOWNLOADED_APPS_KEY, JSON.stringify({ ...saved, [app.name]: true }));
      } catch (error) {}
      await refreshAppStates();
    } catch (error) {
      if (!cancelledDownload.current) window.alert(error?.message || `Unable to install ${app.name}.`);
    } finally {
      setInstallingApp(null);
      setDownloadProgress(0);
    }
  };

  const installDownloadedApp = async (app) => {
    try {
      await ApkInstaller.installDownloaded({ filename: `${app.name.toLowerCase()}.apk` });
      await refreshAppStates();
    } catch (error) {
      window.alert(error?.message || `Downloaded ${app.name} APK is not available.`);
    }
  };

  const openApp = async (app) => {
    setOpeningApp(app.name);
    try {
      await ApkInstaller.openApp({
        appName: app.name,
        packageIds: (app.packageIds || []).join('|'),
      });
    } catch (error) {
      window.alert(error?.message || `Unable to open ${app.name}.`);
    } finally {
      setOpeningApp(null);
    }
  };

  const cancelInstall = async () => {
    cancelledDownload.current = true;
    const appBeingCancelled = installingApp;
    try {
      await ApkInstaller.cancel();
    } finally {
      if (appBeingCancelled) {
        setDownloadedApps((current) => ({ ...current, [appBeingCancelled]: false }));
        try {
          const saved = JSON.parse(window.localStorage.getItem(DOWNLOADED_APPS_KEY) || '{}');
          delete saved[appBeingCancelled];
          window.localStorage.setItem(DOWNLOADED_APPS_KEY, JSON.stringify(saved));
        } catch (error) {}
      }
      setInstallingApp(null);
      setDownloadProgress(0);
    }
  };

  const installingAppData = apps.find((app) => app.name === installingApp);

  return (
    <div className="settings-stp-page-section">
      <div className="settings-stp-app-grid">
        {apps.map((app) => {
          const isInstalled = Boolean(installedApps[app.name]);
          const isDownloaded = Boolean(downloadedApps[app.name] && !isInstalled);
          const isCurrentApp = (app.packageIds || []).some((packageId) => packageId.toLowerCase() === currentAppId);

          return (
            <div className="settings-stp-app-tile" key={app.name}>
              <span className="settings-stp-app-icon">
                <img className={`settings-stp-app-logo-${app.name.toLowerCase()}`} src={app.logo} alt="" />
              </span>
              <span className="settings-stp-app-details">
                <span className="settings-stp-app-name">{app.name}</span>
                <span className="settings-stp-app-description">{app.description}</span>
              </span>
              {app.installable && !isCurrentApp && !isInstalled && !isDownloaded && (app.name !== 'Somalux' || appAction === 'Install') && (
                Capacitor.getPlatform() === 'web' ? (
                  <a className="settings-stp-app-install" href={app.apkUrl} onClick={() => installApp(app)}>
                    {app.name === 'Somalux' ? appAction : 'Install'}
                  </a>
                ) : (
                  <button className="settings-stp-app-install" type="button" onClick={() => installApp(app)} disabled={installingApp === app.name}>
                    {installingApp === app.name ? (
                      <span className="settings-stp-app-install-loading" role="status" aria-label={`Downloading ${app.name}`}>
                        <FiLoader aria-hidden="true" />
                        Downloading
                      </span>
                    ) : (app.name === 'Somalux' ? appAction : 'Install')}
                  </button>
                )
              )}
              {app.installable && !isCurrentApp && !isInstalled && !isDownloaded && app.name === 'Somalux' && appAction === 'Update' && (
                <a className="settings-stp-app-install" href={app.apkUrl} onClick={() => installApp(app)}>
                  Update
                </a>
              )}
              {app.installable && isCurrentApp && (
                <span className="settings-stp-app-install settings-stp-app-installed" aria-label="Currently open">
                  Opened
                </span>
              )}
              {app.installable && !isCurrentApp && isInstalled && Capacitor.getPlatform() === 'android' && (
                <button
                  className="settings-stp-app-install"
                  type="button"
                  onClick={() => openApp(app)}
                  disabled={openingApp === app.name}
                >
                  {openingApp === app.name ? 'Opening…' : 'Open'}
                </button>
              )}
              {app.installable && !isCurrentApp && isInstalled && Capacitor.getPlatform() !== 'android' && (
                <span className="settings-stp-app-install settings-stp-app-installed">
                  Installed
                </span>
              )}
              {app.installable && !isCurrentApp && isDownloaded && (
                <>
                  <span className="settings-stp-app-install settings-stp-app-downloaded" aria-label="Downloaded">
                    <FiCheck aria-hidden="true" />
                  </span>
                  {Capacitor.getPlatform() !== 'web' && (
                    <button className="settings-stp-app-install" type="button" onClick={() => installDownloadedApp(app)}>
                      Install
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {installingApp && Capacitor.getPlatform() !== 'web' && (
        <aside className="settings-app-download-prompt" role="status" aria-live="polite">
          <div className="settings-app-download-prompt-header">
            <div className="settings-app-download-prompt-icon">
              <img src={installingAppData?.logo} alt="" />
            </div>
            <div className="settings-app-download-prompt-copy">
              <strong>Installing {installingApp}</strong>
              <span>Preparing the app for installation</span>
            </div>
            <strong className="settings-app-download-percent">{downloadProgress}%</strong>
          </div>
          <div className="settings-app-download-progress-track" aria-hidden="true">
            <span style={{ width: `${downloadProgress}%` }} />
          </div>
          <div className="settings-app-download-prompt-footer">
            <span>Keep this screen open</span>
            <button className="settings-app-download-prompt-cancel" type="button" onClick={cancelInstall}>
              Cancel
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};
