import { Capacitor } from '@capacitor/core'

/** true dentro de la app Android (Capacitor); false en el navegador y en los tests. */
export const esNativa = (): boolean => Capacitor.isNativePlatform()
