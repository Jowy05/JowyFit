import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jowy05.jowyfit',
  appName: 'JowyFit',
  webDir: 'dist',
  android: {
    // La app web se sirve desde el propio APK: funciona sin conexión.
    allowMixedContent: false,
    // Open Food Facts pide que las apps se identifiquen.
    appendUserAgent: 'JowyFit (+https://github.com/Jowy05/JowyFit)',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_jowyfit',
      iconColor: '#7F26FB',
    },
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#110C1B',
    },
  },
}

export default config
