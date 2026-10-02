import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brixgames.app',
  appName: 'Brix Games',
  webDir: 'dist',
  server: {
    url: 'https://brix1.onrender.com',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
