const config = {
  appId: 'com.somalux.app',
  appName: 'Somalux',
  webDir: 'build',
  bundledWebRuntime: false,
  ...(process.env.CAPACITOR_LIVE_RELOAD === 'true'
    ? {
        server: {
          url: process.env.CAPACITOR_LIVE_RELOAD_URL,
          cleartext: true,
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

module.exports = config;
