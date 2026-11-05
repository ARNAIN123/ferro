// De las poses clave a los fotogramas de un bucle de ~2,6 s, listos para animar con SVG (SMIL):
// cada forma tiene la misma estructura en todos los fotogramas y solo cambian sus números.
import type { Musculo } from '../domain/tipos'
import { dibujar, enPies, type Clase, type Forma } from './dibujo'
import { interpolar, resolverFrontal, resolverLateral, SUELO, type Control, type ControlFrontal, type PoseLateral } from './esqueleto'
import type { Animacion } from './patrones'

export const DURACION_S = 2.6
export const FOTOGRAMAS = 40

export type FormaAnimada =
  | { k: string; tipo: 'path'; clase: Clase; d: string[] }
  | { k: string; tipo: 'circulo'; clase: Clase; cx: number[]; cy: number[]; r: number }

export interface Escena {
  viewBox: readonly [number, number, number, number]
  /** Vista cenital: se dibuja girada 90° (tumbado, visto desde arriba). */
  girar: boolean
  formas: FormaAnimada[]
  /** Fotograma más representativo para la miniatura estática. */
  fotogramaFijo: number
}

const suave = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

/**
 * Posición en la secuencia de poses clave para t ∈ [0, 1). Con dos poses: ida y vuelta con
 * pausas en los extremos. Con más: se recorren en orden y la última vuelve a la primera.
 */
export function enLaSecuencia(t: number, claves: number): { de: number; a: number; f: number } {
  if (claves === 2) {
    const tramos: [number, number, number, number][] = [
      [0, 0.1, 0, 0],
      [0.1, 0.48, 0, 1],
      [0.48, 0.58, 1, 1],
      [0.58, 1, 1, 0],
    ]
    for (const [ini, fin, de, a] of tramos)
      if (t < fin) return de === a ? { de, a, f: 0 } : { de, a, f: suave((t - ini) / (fin - ini)) }
    return { de: 0, a: 0, f: 0 }
  }
  const paso = 1 / claves
  const i = Math.min(claves - 1, Math.floor(t / paso))
  const local = (t - i * paso) / paso
  const pausa = 0.18
  return local < pausa ? { de: i, a: i, f: 0 } : { de: i, a: (i + 1) % claves, f: suave((local - pausa) / (1 - pausa)) }
}

function pose(a: Animacion, t: number) {
  const { de, a: hasta, f } = enLaSecuencia(t, a.claves.length)
  const c = interpolar(a.claves[de]!, a.claves[hasta]!, f)
  return a.vista === 'lateral' ? resolverLateral(c as Control) : resolverFrontal(c as ControlFrontal)
}

function puntoBarra(a: Animacion, p: PoseLateral): number | null {
  const mp = a.equipo.find((e) => e.tipo === 'multipower')
  if (!mp) return null
  return mp.tipo === 'multipower' && mp.en === 'pies' ? enPies(p)[0] : p.brazos[0].agarre[0]
}

const numeros = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

/** Escena animada. Con `soloFijo` calcula solo el fotograma de la miniatura (mucho más rápido). */
export function generarEscena(a: Animacion, musculos: readonly Musculo[], soloFijo = false): Escena {
  const resaltar = new Set(musculos)
  const primera = pose(a, 0)
  const fijo = { barraX: primera.vista === 'lateral' ? puntoBarra(a, primera) : null }
  const cuadros: Forma[][] = []
  const fijoT = 0.5
  if (soloFijo) cuadros.push(dibujar(pose(a, fijoT), a.vista, a.equipo, resaltar, fijo))
  else for (let i = 0; i < FOTOGRAMAS; i++) cuadros.push(dibujar(pose(a, i / FOTOGRAMAS), a.vista, a.equipo, resaltar, fijo))

  const girar = a.vista === 'cenital'
  const transformar = (x: number, y: number): [number, number] => (girar ? [100 + (y - 100), 100 - (x - 100)] : [x, y])

  // Encuadre: todo lo que se dibuja salvo cables y barras largas.
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const incluir = (x: number, y: number, r = 0) => {
    const [tx, ty] = transformar(x, y)
    x0 = Math.min(x0, tx - r)
    y0 = Math.min(y0, ty - r)
    x1 = Math.max(x1, tx + r)
    y1 = Math.max(y1, ty + r)
  }
  for (const cuadro of cuadros)
    for (const f of cuadro) {
      if (f.fuera) continue
      if (f.tipo === 'circulo') incluir(f.c[0], f.c[1], f.r)
      else {
        const n = numeros(f.d)
        for (let i = 0; i + 1 < n.length; i += 2) incluir(n[i]!, n[i + 1]!, 3)
      }
    }
  if (!girar) y1 = Math.max(y1, SUELO + 2)
  const margen = 8
  const lado = Math.max(x1 - x0, y1 - y0) + margen * 2
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const viewBox = [cx - lado / 2, cy - lado / 2, lado, lado] as const

  // Una forma animada por clave, con los valores de cada fotograma.
  const formas: FormaAnimada[] = []
  if (!girar) formas.push({ k: 'suelo', tipo: 'path', clase: 'suelo', d: [`M${(viewBox[0] - 2).toFixed(1)} ${SUELO}L${(viewBox[0] + lado + 2).toFixed(1)} ${SUELO}`] })
  const primeras = cuadros[0]!
  for (const [i, f] of primeras.entries()) {
    const serie = cuadros.map((c) => c[i]!)
    if (serie.some((g) => g.k !== f.k || g.tipo !== f.tipo)) throw new Error(`Fotogramas con distinta estructura en ${a.patron}: ${f.k}`)
    if (f.tipo === 'circulo') {
      formas.push({ k: f.k, tipo: 'circulo', clase: f.clase, cx: serie.map((g) => (g as typeof f).c[0]), cy: serie.map((g) => (g as typeof f).c[1]), r: f.r })
    } else {
      formas.push({ k: f.k, tipo: 'path', clase: f.clase, d: serie.map((g) => (g as typeof f).d) })
    }
  }
  return { viewBox, girar, formas, fotogramaFijo: soloFijo ? 0 : Math.round(FOTOGRAMAS * fijoT) }
}
