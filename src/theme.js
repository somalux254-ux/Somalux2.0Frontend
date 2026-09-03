import { Capacitor, registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const SystemBars = registerPlugin('SystemBars');

const getSystemTheme = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
);

export const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('appThemeMode') || localStorage.getItem('appTheme') || 'system';
};

export const applyAppTheme = async (theme) => {
  const nextTheme = theme === 'system' ? getSystemTheme() : (theme === 'light' ? 'light' : 'dark');
  const colors = nextTheme === 'light'
    ? {
        bgPrimary: '#ffffff',
        bgSecondary: '#ffffff',
        bgMain: '#ffffff',
        bgCard: '#ffffff',
        bgDark: '#ffffff',
        bgLight: '#ffffff',
        textPrimary: '#172027',
        textSecondary: '#52616b',
        textMain: '#172027',
        text: '#172027',
        textDark: '#172027',
        textLight: '#52616b',
        borderColor: 'rgba(23, 32, 39, 0.14)',
        borderMuted: 'rgba(23, 32, 39, 0.14)'
      }
    : {
        bgPrimary: '#0c1317',
        bgSecondary: '#111b21',
        bgMain: '#0c1317',
        bgCard: '#111a20',
        bgDark: '#0b141a',
        bgLight: '#0b1216',
        textPrimary: '#eef2f5',
        textSecondary: '#aeb8bf',
        textMain: '#eef2f5',
        text: '#e9edef',
        textDark: '#e9edef',
        textLight: '#8696a0',
        borderColor: '#2a3942',
        borderMuted: 'rgba(255, 255, 255, 0.14)'
      };

  document.documentElement.setAttribute('data-theme', nextTheme);
  document.documentElement.setAttribute('data-theme-mode', theme);
  document.documentElement.style.colorScheme = nextTheme;
  Object.entries(colors).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  });
  document.body.style.backgroundColor = colors.bgPrimary;
  document.body.style.color = colors.textPrimary;

  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setBackgroundColor({ color: nextTheme === 'light' ? '#FFFFFF' : '#0C1317' });
      await StatusBar.setStyle({ style: nextTheme === 'light' ? Style.Dark : Style.Light });
    } catch (error) {
      console.warn('Failed to update native status bar theme:', error);
    }

    try {
      await SystemBars.setTheme({ theme: nextTheme });
    } catch (error) {
      console.warn('Failed to update native system bars theme:', error);
    }
  }
};

export const initializeTheme = () => {
  const savedTheme = localStorage.getItem('appThemeMode') || localStorage.getItem('appTheme') || 'system';
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: light)');
  const applySystemTheme = () => {
    const themeMode = localStorage.getItem('appThemeMode') || localStorage.getItem('appTheme') || 'system';
    if (themeMode === 'system') {
      applyAppTheme('system');
    }
  };

  applyAppTheme(savedTheme);
  mediaQuery?.addEventListener?.('change', applySystemTheme);

  return () => mediaQuery?.removeEventListener?.('change', applySystemTheme);
};