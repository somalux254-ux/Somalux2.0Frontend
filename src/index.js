// index.js
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// 🔧 CRITICAL: Initialize PDF worker FIRST before any other imports
import './pdfConfig.js';

import { SomaLux } from './SomaLux';
import SpeedTracker from './SpeedTracker';
import { prewarmGoogleSignIn } from './SomaLux/Books/AuthModal';
import { supabase } from './SomaLux/Books/supabaseClient';
import { handleOAuthCallback } from './utils/oauthHandler';
import { handleSubscriptionBack } from './SomaLux/Subscriptions/backNavigation';
import { runBackAction } from './SomaLux/services/backNavigation';
import { initializeTheme } from './theme';
import './theme.css';
// Remove old PWA workers so the website offers the native APK instead.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

prewarmGoogleSignIn();

const hydrateAuthSession = async () => {
  try {
    await handleOAuthCallback(supabase);
  } catch (error) {
    console.warn('Auth hydration failed:', error);
  }
};

hydrateAuthSession();
const removeThemeListener = initializeTheme();

const AppEntry = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const backButtonListener = App.addListener('backButton', async ({ canGoBack }) => {
      if (handleSubscriptionBack()) return;

      if (await runBackAction()) return;

      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, []);

  return window.location.pathname === '/speed'
    ? <SpeedTracker />
    : <SomaLux />;
};

root.render(
  <React.StrictMode>
    <AppEntry />
  </React.StrictMode>
);

window.addEventListener('beforeunload', removeThemeListener, { once: true });
