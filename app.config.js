require('dotenv').config();

export default {
  expo: {
    owner: 'abrumancusl',
    name: 'FitCheck',
    slug: 'FitCheck',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    updates: {
      url: 'https://u.expo.dev/c5fb2e99-a114-4384-8c5f-29a1345100e6',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      removeBgApiKey: process.env.EXPO_PUBLIC_REMOVE_BG_API_KEY || '',
      eas: {
        projectId: 'c5fb2e99-a114-4384-8c5f-29a1345100e6',
      },
    },
  },
};
