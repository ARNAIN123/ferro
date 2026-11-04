// Genera src/components/avatar/trazados.ts (el avatar muscular) a partir de la figura de Open Muscle Map
// (MIT, ver catalogo/fuente/avatar). Aplana las transformaciones, traduce cada panel a una región de Ferro,
// divide el pectoral en porción superior e inferior y calcula las líneas internas (fibras) de cada músculo
// según su forma: en huso (bíceps, cuádriceps…) o en abanico hacia su tendón (pectoral, deltoides, dorsal…).
// Uso: node scripts/generar-avatar.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const raiz = (r) => fileURLToPath(new URL(`../${r}`, import.meta.url))
const svg = readFileSync(raiz('catalogo/fuente/avatar/open-muscle-map-male.svg'), 'utf8')

// Músculo de Open Muscle Map (+ subregión) → región de Ferro y forma de sus fibras.
// tendon: hacia dónde convergen las fibras en abanico ('medial' = hacia el centro del cuerpo).
const REGIONES = {
  sternocleidomastoid: { region: 'esternocleidomastoideo', fibras: 'huso' },
  'trapezius:upper': { region: 'trapecio_superior', fibras: 'abanico', tendon: 'arriba' },
  'trapezius:upper_lateral': { region: 'trapecio_superior', fibras: 'huso' },
  'trapezius:middle_lower': { region: 'trapecio_medio', fibras: 'abanico', tendon: 'lateral' },
  anterior_deltoid: { region: 'deltoides_anterior', fibras: 'abanico', tendon: 'abajo' },
  lateral_deltoid: { region: 'deltoides_lateral', fibras: 'abanico', tendon: 'abajo' },
  posterior_deltoid: { region: 'deltoides_posterior', fibras: 'abanico', tendon: 'abajo' },
  pectoralis_major: { region: 'pectoral', fibras: 'abanico', tendon: 'lateral' },
  biceps_brachii: { region: 'biceps', fibras: 'huso' },
  brachialis: { region: 'braquial', fibras: 'huso' },
  triceps_brachii: { region: 'triceps', fibras: 'huso' },
  forearm_flexors: { region: 'antebrazo_flexores', fibras: 'huso' },
  forearm_extensors: { region: 'antebrazo_extensores', fibras: 'huso' },
  serratus_anterior: { region: 'serrato', fibras: 'huso' },
  'serratus_anterior:lower': { region: 'serrato', fibras: 'huso' },
  rectus_abdominis: { region: 'recto_abdominal', fibras: 'vertical' },
  external_oblique: { region: 'oblicuos', fibras: 'huso' },
  posterior_rotator_cuff: { region: 'manguito_posterior', fibras: 'abanico', tendon: 'lateral' },
  latissimus_dorsi: { region: 'dorsal_ancho', fibras: 'abanico', tendon: 'arriba' },
  erector_spinae: { region: 'lumbares', fibras: 'vertical' },
  gluteus_medius: { region: 'gluteo_medio', fibras: 'abanico', tendon: 'abajo' },
  gluteus_maximus: { region: 'gluteo_mayor', fibras: 'abanico', tendon: 'lateral' },
  tensor_fasciae_latae: { region: 'tensor_fascia', fibras: 'huso' },
  iliotibial_tract: { region: 'cintilla_iliotibial', fibras: 'vertical' },
  iliopsoas: { region: 'psoas', fibras: 'huso' },
  hip_adductors: { region: 'aductores', fibras: 'huso' },
  sartorius: { region: 'sartorio', fibras: 'huso' },
  rectus_femoris: { region: 'recto_femoral', fibras: 'huso' },
  vastus_lateralis: { region: 'vasto_lateral', fibras: 'huso' },
  vastus_medialis: { region: 'vasto_medial', fibras: 'huso' },
  biceps_femoris: { region: 'biceps_femoral', fibras: 'huso' },
  medial_hamstrings: { region: 'isquios_mediales', fibras: 'huso' },
  gastrocnemius: { region: 'gemelo', fibras: 'huso' },
  soleus: { region: 'soleo', fibras: 'huso' },
  tibialis_anterior: { region: 'tibial', fibras: 'huso' },
  fibularis_group: { region: 'peroneos', fibras: 'huso' },
  patella_region: { region: 'rotula' },
  patellar_tendon_region: { region: 'tendon_rotuliano' },
  popliteal_region: { region: 'popliteo' },
  achilles_tendon: { region: 'aquiles' },
}

// --- Lectura del SVG ---

const num = (v) => Math.round(v * 10) / 10
const grupo =
  /<g id="male-(front|rear)-([^"]+)" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)"([^>]*)>\s*(?:<title[^>]*>[^<]*<\/title>\s*)?<path d="([^"]+)"([^>]*)\/?>/g
const atributo = (texto, nombre) => texto.match(new RegExp(`${nombre}="([^"]*)"`))?.[1] ?? ''

/** Aplana las transformaciones del grupo y del trazado: todo queda en coordenadas absolutas. */
function aplanar(d, tx, ty, s, px, py) {
  const comandos = []
  for (const [, letra, resto] of d.matchAll(/([MCZ])([^MCZ]*)/g)) {
    const n = resto.trim() ? resto.trim().split(/[\s,]+/).map(Number) : []
    const puntos = []
    for (let i = 0; i < n.length; i += 2) puntos.push([tx + s * (n[i] + px), ty + s * (n[i + 1] + py)])
    comandos.push({ letra, puntos })
  }
  return comandos
}

const aTexto = (comandos) =>
  comandos.map((c) => c.letra + c.puntos.map(([x, y]) => `${num(x)} ${num(y)}`).join(' ')).join('')

/** Puntos del contorno (las curvas muestreadas) para medir la forma. */
function muestras(comandos) {
  const pts = []
  let actual = [0, 0]
  for (const c of comandos) {
    if (c.letra === 'M') actual = c.puntos[0]
    if (c.letra !== 'C') continue
    for (let i = 0; i < c.puntos.length; i += 3) {
      const [p1, p2, p3] = c.puntos.slice(i, i + 3)
      for (const t of [0.25, 0.5, 0.75, 1]) {
        const u = 1 - t
        pts.push([
          u ** 3 * actual[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
          u ** 3 * actual[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
        ])
      }
      actual = p3
    }
  }
  return pts
}

const partes = { front: [], rear: [] }
const siluetas = {}
for (const m of svg.matchAll(grupo)) {
  const [, vista, clave, tx, ty, s, attrsG, d, attrsP] = m
  const tp = atributo(attrsP, 'transform').match(/translate\(([-\d.]+),([-\d.]+)\)/)
  const comandos = aplanar(d, +tx, +ty, +s, tp ? +tp[1] : 0, tp ? +tp[2] : 0)
  if (clave.startsWith('silhouette')) {
    siluetas[vista] = comandos
    continue
  }
  const musculo = atributo(attrsG, 'data-muscle-id')
  const sub = atributo(attrsG, 'data-subregion')
  const conf = REGIONES[`${musculo}:${sub}`] ?? REGIONES[musculo]
  if (!conf) throw new Error(`Sin región para ${musculo}:${sub}`)
  partes[vista].push({ conf, lado: atributo(attrsG, 'data-side') === 'left' ? 'izq' : 'der', comandos })
}

// --- Geometría de cada músculo: eje principal y fibras ---

function forma(pts) {
  const n = pts.length
  const cx = pts.reduce((a, p) => a + p[0], 0) / n
  const cy = pts.reduce((a, p) => a + p[1], 0) / n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of pts) {
    sxx += (x - cx) ** 2
    syy += (y - cy) ** 2
    sxy += (x - cx) * (y - cy)
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { cx, cy, u: [Math.cos(ang), Math.sin(ang)] }
}

/** Fibras: curvas paralelas al eje (en huso, juntas en los extremos) o rectas que convergen en el tendón. */
function fibras(pts, conf, centroCuerpo) {
  if (!conf.fibras) return ''
  let { cx, cy, u } = forma(pts)
  if (conf.fibras === 'vertical') u = [0, 1]
  let n = [-u[1], u[0]]
  const proy = (p, v) => (p[0] - cx) * v[0] + (p[1] - cy) * v[1]
  let s0 = Math.min(...pts.map((p) => proy(p, u)))
  let s1 = Math.max(...pts.map((p) => proy(p, u)))
  const t0 = Math.min(...pts.map((p) => proy(p, n)))
  const t1 = Math.max(...pts.map((p) => proy(p, n)))
  const P = (s, t) => [cx + u[0] * s + n[0] * t, cy + u[1] * s + n[1] * t]

  if (conf.fibras === 'abanico') {
    // Que el tendón quede en s1: se le da la vuelta al eje si hace falta.
    const extremo = P(s1, 0)
    const otro = P(s0, 0)
    const mejor = {
      abajo: extremo[1] >= otro[1],
      arriba: extremo[1] <= otro[1],
      lateral: Math.abs(extremo[0] - centroCuerpo) >= Math.abs(otro[0] - centroCuerpo),
      medial: Math.abs(extremo[0] - centroCuerpo) <= Math.abs(otro[0] - centroCuerpo),
    }[conf.tendon]
    if (!mejor) {
      u = [-u[0], -u[1]]
      n = [-u[1], u[0]]
      ;[s0, s1] = [-s1, -s0]
    }
  }

  const ancho = t1 - t0
  const cuantas = Math.max(3, Math.min(14, Math.round(ancho / 6.5)))
  const margen = (s1 - s0) * 0.08
  const trazos = []
  for (let k = 1; k < cuantas; k++) {
    const t = t0 + (ancho * k) / cuantas
    const tm = t - (t0 + t1) / 2
    const medio = (t0 + t1) / 2
    if (conf.fibras === 'abanico') {
      const a = P(s0 - margen, t)
      const b = P(s1 + margen, medio + tm * 0.12)
      trazos.push(`M${num(a[0])} ${num(a[1])}L${num(b[0])} ${num(b[1])}`)
    } else {
      // Huso: un poco abiertas en el centro y juntas hacia los extremos (cuadrática con punto medio en t).
      const a = P(s0 - margen, medio + tm * 0.4)
      const c = P((s0 + s1) / 2, medio + tm * 1.6)
      const b = P(s1 + margen, medio + tm * 0.4)
      trazos.push(`M${num(a[0])} ${num(a[1])}Q${num(c[0])} ${num(c[1])} ${num(b[0])} ${num(b[1])}`)
    }
  }
  return trazos.join('')
}

const caja = (comandos) => {
  const pts = comandos.flatMap((c) => c.puntos)
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]
}

const salida = {}
for (const vista of ['front', 'rear']) {
  const [x0, y0, x1, y1] = caja(siluetas[vista])
  const centro = (x0 + x1) / 2
  const lista = []
  for (const p of partes[vista]) {
    const pts = muestras(p.comandos)
    const base = { lado: p.lado, d: aTexto(p.comandos) }
    if (p.conf.region === 'pectoral') {
      // Porción clavicular (superior) y esternal (inferior): un corte algo inclinado hacia el hombro.
      const [bx0, by0, bx1, by1] = caja(p.comandos)
      const yCorte = by0 + (by1 - by0) * 0.4
      const caida = (by1 - by0) * 0.12
      const interior = p.lado === 'der' ? bx1 : bx0
      const exterior = p.lado === 'der' ? bx0 : bx1
      const yInt = yCorte + caida
      const yExt = yCorte - caida
      const arriba = `M${num(interior)} ${num(by0 - 5)}L${num(interior)} ${num(yInt)}L${num(exterior)} ${num(yExt)}L${num(exterior)} ${num(by0 - 5)}Z`
      const abajo = `M${num(interior)} ${num(yInt)}L${num(interior)} ${num(by1 + 5)}L${num(exterior)} ${num(by1 + 5)}L${num(exterior)} ${num(yExt)}Z`
      const f = fibras(pts, p.conf, centro)
      lista.push({ ...base, region: 'pectoral_superior', recorte: arriba, fibras: f })
      lista.push({ ...base, region: 'pectoral_inferior', recorte: abajo, fibras: f })
      continue
    }
    lista.push({ ...base, region: p.conf.region, fibras: fibras(pts, p.conf, centro) })
  }
  const margen = 12
  salida[vista] = {
    silueta: aTexto(siluetas[vista]),
    caja: [num(x0 - margen), num(y0 - margen), num(x1 - x0 + 2 * margen), num(y1 - y0 + 2 * margen)],
    partes: lista,
  }
}

const regiones = [...new Set([...salida.front.partes, ...salida.rear.partes].map((p) => p.region))]
const datos = (v) => JSON.stringify(salida[v])

// El tipo RegionAvatar vive en domain/avatar.ts: TypeScript comprueba que todas las regiones generadas existen.
writeFileSync(
  raiz('src/components/avatar/trazados.ts'),
  `// Generado por scripts/generar-avatar.mjs. No editar a mano.
// Figura base: Open Muscle Map (MIT License, Copyright (c) 2026 PerspicaciousGuy), ver catalogo/fuente/avatar.
import type { RegionAvatar } from '../../domain/avatar'

export interface ParteAvatar {
  region: RegionAvatar
  lado: 'izq' | 'der'
  d: string
  /** Líneas internas del músculo (se recortan con su contorno). */
  fibras: string
  /** Solo una parte del trazado (porciones del pectoral). */
  recorte?: string
}

export interface VistaAvatar {
  silueta: string
  /** viewBox: x, y, ancho, alto. */
  caja: [number, number, number, number]
  partes: ParteAvatar[]
}

export const FRENTE: VistaAvatar = ${datos('front')}

export const ESPALDA: VistaAvatar = ${datos('rear')}
`,
)
console.log(`✓ avatar: ${salida.front.partes.length} partes delante, ${salida.rear.partes.length} detrás, ${regiones.length} regiones`)
console.log(regiones.join(', '))
