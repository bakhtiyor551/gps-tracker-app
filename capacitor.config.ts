import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'gps-tracker-app',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  }
};

export default config;
