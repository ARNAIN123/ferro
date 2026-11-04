import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ferro.app',
  appName: 'Ferro',
  webDir: 'dist',
  // El origen (https://localhost) no debe cambiar nunca: IndexedDB, y con ella todos tus datos,
  // va ligada a él. Cambiar el esquema o el host equivaldría a empezar con la app vacía.
  server: { androidScheme: 'https', hostname: 'localhost' },
  android: {
    // Fondo mientras carga la web, igual que el tema oscuro de la app (sin destello blanco).
    backgroundColor: '#11100e',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_ferro',
      iconColor: '#ff6b1f',
    },
  },
}

export default config
