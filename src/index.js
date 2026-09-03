// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';

// 🔧 CRITICAL: Initialize PDF worker FIRST before any other imports
import './pdfConfig.js';

import { SomaLux } from './SomaLux';
import SpeedTracker from './SpeedTracker';
import { supabase } from './SomaLux/Books/supabaseClient';
import { handleOAuthCallback } from './utils/oauthHandler';
// Register the service worker so the site is installable as a PWA.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
    } catch (error) {
      console.warn('Service worker registration failed:', error);
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

const hydrateAuthSession = async () => {
  try {
    await handleOAuthCallback(supabase);
  } catch (error) {
    console.warn('Auth hydration failed:', error);
  }
};

hydrateAuthSession();

const AppEntry = () =>
  window.location.pathname === '/speed'
    ? <SpeedTracker />
    : <SomaLux />;

root.render(
  <React.StrictMode>
    <AppEntry />
  </React.StrictMode>
);
