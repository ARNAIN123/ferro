export const VIBRACION_SERIE = 35
export const VIBRACION_DESCANSO = [180, 90, 180, 90, 320]

/** Vibra si el móvil lo permite. Chrome solo vibra tras haber tocado la página, y nunca con la app en segundo plano. */
export function vibrar(patron: number | number[], habilitado = true): void {
  if (!habilitado || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(patron)
  } catch {
    // Algunos navegadores lanzan si no hubo interacción previa.
  }
}
