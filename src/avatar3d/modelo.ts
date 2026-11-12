// El avatar paramétrico (public/modelos/avatar.glb + avatar.json, de scripts/blender/generar-avatar.py):
// el cuerpo de MakeHuman en la postura de reposo de Ferro, con el esqueleto de 24 huesos, un
// deformador por cada esquina de MakeHuman (sexo × edad × músculo × peso) y otros para las medidas.
import { accesor, disperso, leerGlb } from './glb'

export type Vec3 = [number, number, number]

export interface InfoAvatar {
  version: number
  vertices: number
  /** Vértices que mueven los deformadores: la piel y los ojos. Detrás van los músculos profundos. */
  vertices_forma: number
  triangulos: number
  triangulos_piel: number
  regiones: string[]
  profundos: string[]
  texels_por_region: number[]
  piezas: { nombre: string; vertices: number; triangulos: number }[]
  huesos: string[]
  padres: (string | null)[]
  /** Dónde acaba cada hueso: la articulación siguiente o un extremo (coronilla, yema, uña). */
  colas: Record<string, string>
  /** Articulaciones (y extremos) de la forma de referencia, en metros, con la y hacia arriba. */
  articulaciones: Record<string, Vec3>
  macro: {
    /** Años de las dos edades de MakeHuman que usa el avatar (joven y mayor). */
    edades: [number, number]
    esquinas: { sexo: number; edad: number; musculo: number; peso: number; morfo: number; articulaciones: Vec3[] }[]
    /** Volumen (litros) y alto (m) de cada forma: [sexo][edad][músculo][peso], en una rejilla de 0 a 1. */
    volumen: number[][][][]
    alto: number[][][][]
  }
  objetivos: { nombre: string; morfo: number; articulaciones: Vec3[] }[]
  texturas: { regiones: { archivo: string; lado: number }; relieve: { archivo: string; lado: number } }
}

/** Partes del cuerpo: para medir sin confundir el brazo con el costado ni una pierna con la otra. */
export const PARTES = ['tronco', 'brazo.L', 'brazo.R', 'pierna.L', 'pierna.R'] as const

function parteDeHueso(hueso: string): number {
  const [base, lado] = hueso.split('.')
  if (/^(brazo|antebrazo|mano|dedos\d?|pulgar\d?|indice\d|anular\d|menique\d)$/.test(base ?? '')) return lado === 'L' ? 1 : 2
  if (base === 'muslo' || base === 'pierna' || base === 'pie' || base === 'punta') return lado === 'L' ? 3 : 4
  return 0
}

export interface ModeloAvatar {
  info: InfoAvatar
  vertices: number
  /** Forma de referencia. */
  posiciones: Float32Array
  uv: Float32Array
  indices: Uint16Array
  /** Cuatro huesos por vértice y sus pesos (0–255). */
  huesos4: Uint8Array
  pesos4: Uint8Array
  /** Vértice de MakeHuman de cada vértice de dibujo (los de una costura del mapa UV comparten el suyo). */
  origen: Uint16Array
  origenes: number
  /** Parte del cuerpo y hueso que más pesa en cada vértice. */
  parte: Uint8Array
  hueso: Uint8Array
  /** Triángulos de la piel (índice del triángulo) de cada parte. */
  triangulosDeParte: Uint32Array[]
  /** Deformadores: filas (vértices) que mueven y cuánto, en 1/32767 de metro. */
  morfos: { filas: Uint16Array | Uint32Array; valores: Int16Array }[]
  /** Nombres de las articulaciones, en el orden de los desplazamientos de cada deformador. */
  articulaciones: string[]
  /** Unión de los músculos profundos a la piel: sus vecinos de piel y lo que pesa cada uno (0–255). */
  union: { primero: number; vecinos: number; indices: Uint16Array; pesos: Uint8Array }
}

export function modeloDesdeGlb(datos: ArrayBuffer, info: InfoAvatar): ModeloAvatar {
  const glb = leerGlb(datos)
  const malla = glb.json.meshes[0]
  const p = malla?.primitives[0]
  if (!malla || !p) throw new Error('El avatar no tiene malla')
  const at = (nombre: string) => {
    const i = p.attributes[nombre]
    if (i === undefined) throw new Error(`Al avatar le falta ${nombre}`)
    return accesor(glb, i)
  }
  const posiciones = at('POSITION') as Float32Array
  const vertices = posiciones.length / 3
  const huesos4 = at('JOINTS_0') as Uint8Array
  const pesos4 = at('WEIGHTS_0') as Uint8Array
  const indices = accesor(glb, p.indices) as Uint16Array
  const origen = Uint16Array.from(at('_ORIGEN') as Float32Array)
  let origenes = 0
  for (let i = 0; i < vertices; i++) origenes = Math.max(origenes, origen[i]! + 1)

  const parteDe = info.huesos.map(parteDeHueso)
  const parte = new Uint8Array(vertices)
  const hueso = new Uint8Array(vertices)
  const suma = [0, 0, 0, 0, 0]
  for (let i = 0; i < vertices; i++) {
    suma.fill(0)
    let mayor = 0
    for (let k = 0; k < 4; k++) {
      const w = pesos4[i * 4 + k]!
      suma[parteDe[huesos4[i * 4 + k]!]!]! += w
      if (w > pesos4[i * 4 + mayor]!) mayor = k
    }
    hueso[i] = huesos4[i * 4 + mayor]!
    parte[i] = suma.indexOf(Math.max(...suma))
  }
  // Un triángulo es de una parte si lo son sus tres vértices (los de las uniones no se usan para medir).
  const porParte: number[][] = PARTES.map(() => [])
  for (let t = 0; t < info.triangulos_piel; t++) {
    const a = parte[indices[t * 3]!]!
    if (a === parte[indices[t * 3 + 1]!] && a === parte[indices[t * 3 + 2]!]) porParte[a]!.push(t)
  }

  const morfos = (p.targets ?? []).map((t) => {
    const d = disperso(glb, t.POSITION!)
    return { filas: d.filas, valores: d.valores as Int16Array }
  })
  const u = malla.extras?.union as { primero: number; vecinos: number; indices: number; pesos: number } | undefined
  if (!u) throw new Error('Al avatar le falta la unión de los músculos profundos')

  return {
    info,
    vertices,
    posiciones,
    uv: at('TEXCOORD_0') as Float32Array,
    indices,
    huesos4,
    pesos4,
    origen,
    origenes,
    parte,
    hueso,
    triangulosDeParte: porParte.map((l) => Uint32Array.from(l)),
    morfos,
    articulaciones: Object.keys(info.articulaciones),
    union: { primero: u.primero, vecinos: u.vecinos, indices: accesor(glb, u.indices) as Uint16Array, pesos: accesor(glb, u.pesos) as Uint8Array },
  }
}

const BASE = import.meta.env.BASE_URL
let cargando: Promise<ModeloAvatar> | null = null

/** Descarga el avatar (una sola vez). */
export function cargarModeloAvatar(): Promise<ModeloAvatar> {
  cargando ??= (async () => {
    const [glb, info] = await Promise.all([fetch(`${BASE}modelos/avatar.glb`), fetch(`${BASE}modelos/avatar.json`)])
    if (!glb.ok || !info.ok) throw new Error('No se ha podido cargar el avatar')
    return modeloDesdeGlb(await glb.arrayBuffer(), (await info.json()) as InfoAvatar)
  })()
  // Si falla, se queda el fallo (hasta reabrir la app): el visor lo usa con `use()`, y una promesa
  // nueva en cada intento lo haría pedir el modelo sin parar y congelaría la pantalla.
  cargando.catch(() => undefined)
  return cargando
}
