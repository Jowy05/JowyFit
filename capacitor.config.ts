import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jowy05.jowyfit',
  appName: 'JowyFit',
  webDir: 'dist',
  android: {
    // La app web se sirve desde el propio APK: funciona sin conexión.
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_jowyfit',
      iconColor: '#FF7A1A',
    },
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#10151C',
    },
  },
}

export default config
