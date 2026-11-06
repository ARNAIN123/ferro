// Vibraciones cortas de la regla deslizable: suave en cada paso, más marcada en cada marca grande.
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { esNativa } from './plataforma'
import { vibrar } from './vibrar'

let ultima = 0

/** Un "tic" háptico. Como mucho uno cada 25 ms, para que un lanzamiento rápido no sea un zumbido. */
export function tic(fuerte = false): void {
  const ahora = performance.now()
  if (ahora - ultima < 25) return
  ultima = ahora
  if (esNativa()) void Haptics.impact({ style: fuerte ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {})
  else vibrar(fuerte ? 16 : 5)
}
