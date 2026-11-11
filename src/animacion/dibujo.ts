// Dibujo de la figura y del material a partir de una pose resuelta. Cada fotograma devuelve la
// misma lista de formas con la misma estructura, para poder animarlas interpolando sus valores.
import type { Zona as ZonaMuscular } from '../domain/tipos'
import { angulo, desde, dir, lerp, mas, por, type P } from './geometria'
import { anterior, L, SUELO, type PoseFrontal, type PoseLateral } from './esqueleto'

export type Clase =
  | 'cuerpo'
  | 'lejos'
  | 'musculo'
  | 'musculoLejos'
  | 'disco'
  | 'metal'
  | 'banco'
  | 'cable'
  | 'torre'
  | 'suelo'
  | 'surco'
  | 'barra'
  | 'caja'
  | 'bancoAncho'

/** `fuera`: no cuenta para encuadrar la escena (cables y barras largas que pueden salirse). */
export type Forma =
  | { k: string; tipo: 'path'; d: string; clase: Clase; fuera?: boolean }
  | { k: string; tipo: 'circulo'; c: P; r: number; clase: Clase; fuera?: boolean }

export type Vista = 'lateral' | 'frontal' | 'dorsal' | 'cenital'

/** Material que se dibuja. Las posiciones fijas (bancos, torres) van en coordenadas absolutas. */
export type Equipo =
  | { tipo: 'barra'; discos?: 'grandes' | 'pequenos'; en?: 'pies' }
  | { tipo: 'mancuernas'; manos?: readonly (0 | 1)[]; en?: 'pies' }
  | { tipo: 'disco' }
  | { tipo: 'landmine'; pivote: P }
  | { tipo: 'polea'; anclaje: P; a?: 'manos' | 'mano0' | 'mano1' | 'tobillo0'; anclaje2?: P }
  | { tipo: 'multipower'; en?: 'pies' }
  | { tipo: 'banco'; asiento: readonly [P, P]; respaldo?: readonly [P, P]; patas?: boolean; delante?: boolean }
  | { tipo: 'caja'; x: number; y: number; ancho: number }
  | { tipo: 'rodillo'; c: P }

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const pt = (p: P) => `${f1(p[0])} ${f1(p[1])}`
const medio = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/** Curva cerrada suave por una lista de puntos (siempre la misma estructura de órdenes). */
function cerrada(pts: readonly P[]): string {
  const n = pts.length
  let d = `M${pt(medio(pts[n - 1]!, pts[0]!))}`
  for (let i = 0; i < n; i++) d += `Q${pt(pts[i]!)} ${pt(medio(pts[i]!, pts[(i + 1) % n]!))}`
  return `${d}Z`
}
const lente = (o1: P, cExt: P, o2: P, cInt: P) => `M${pt(o1)}Q${pt(cExt)} ${pt(o2)}Q${pt(cInt)} ${pt(o1)}Z`
const linea = (a: P, b: P) => `M${pt(a)}L${pt(b)}`

// ── Miembros ────────────────────────────────────────────────────────────────────────────────

interface Perfil {
  /** Radio en la articulación de arriba y en la de abajo. */
  ra: number
  rb: number
  /** Abultamiento máximo por delante y por detrás (sobre el radio medio). */
  delante: number
  detras: number
  /** Dónde está el máximo del abultamiento (0–1) por delante y por detrás. */
  pico?: readonly [number, number]
}

const PERFIL = {
  brazo: { ra: 5.6, rb: 3.9, delante: 1.6, detras: 1.9, pico: [0.55, 0.4] },
  antebrazo: { ra: 4.2, rb: 2.7, delante: 0.9, detras: 0.6, pico: [0.25, 0.25] },
  muslo: { ra: 8.4, rb: 5.6, delante: 1.4, detras: 1.2, pico: [0.4, 0.45] },
  tibia: { ra: 5.2, rb: 3.2, delante: 0.2, detras: 2.2, pico: [0.3, 0.28] },
} satisfies Record<string, Perfil>
type Segmento = keyof typeof PERFIL

/** Radio del contorno a la altura `f` (0 arriba, 1 abajo) por un lado (1 delante, −1 detrás). */
function radio(p: Perfil, f: number, lado: 1 | -1): number {
  const base = lerp(p.ra, p.rb, Math.min(1, Math.max(0, f)))
  const [pd, pt2] = p.pico ?? [0.5, 0.5]
  const pico = lado === 1 ? pd : pt2
  const amp = lado === 1 ? p.delante : p.detras
  const k = f <= pico ? f / pico : (1 - f) / (1 - pico)
  return base + amp * Math.sin((Math.max(0, Math.min(1, k)) * Math.PI) / 2)
}

/** Contorno de un miembro de A a B. `normal` apunta hacia "delante" del miembro. */
function contornoMiembro(a: P, b: P, perfil: Perfil, normal: P): string {
  const largo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const d: P = [(b[0] - a[0]) / largo, (b[1] - a[1]) / largo]
  const en = (f: number, lado: 1 | -1, k = 1): P => mas(mas(a, por(d, largo * f)), por(normal, lado * radio(perfil, f, lado) * k))
  const pts: P[] = [
    en(0, 1, 1.05),
    en(0.25, 1, 1.12),
    en(0.55, 1, 1.12),
    en(0.85, 1, 1.1),
    en(1, 1, 1.05),
    mas(b, por(d, perfil.rb * 1.1)),
    en(1, -1, 1.05),
    en(0.85, -1, 1.1),
    en(0.55, -1, 1.12),
    en(0.25, -1, 1.12),
    en(0, -1, 1.05),
    mas(a, por(d, -perfil.ra * 1.1)),
  ]
  return cerrada(pts)
}

/** Músculo sobre un miembro: franja entre `f` (a lo largo) y de `hondo` a `exterior` (a lo ancho). */
function musculoMiembro(a: P, b: P, perfil: Perfil, normal: P, lado: 1 | -1, f: readonly [number, number], hondo: number, exterior = 0.92): string {
  const largo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const d: P = [(b[0] - a[0]) / largo, (b[1] - a[1]) / largo]
  const en = (t: number, k: number): P => mas(mas(a, por(d, largo * t)), por(normal, lado * radio(perfil, t, lado) * k))
  const fm = (f[0] + f[1]) / 2
  return lente(en(f[0], lerp(hondo, exterior, 0.5)), en(fm, exterior * 1.18), en(f[1], lerp(hondo, exterior, 0.5)), en(fm, hondo))
}

// ── Tronco lateral ──────────────────────────────────────────────────────────────────────────

const TRONCO_DELANTE: readonly (readonly [number, number])[] = [
  [-0.08, 8],
  [0.12, 10],
  [0.36, 9.4],
  [0.6, 11],
  [0.8, 13],
  [0.93, 11.6],
  [1.07, 5],
]
const TRONCO_DETRAS: readonly (readonly [number, number])[] = [
  [1.07, -7],
  [0.92, -10.4],
  [0.7, -12],
  [0.46, -10.4],
  [0.24, -11],
  [0.04, -14],
  [-0.1, -10.5],
]

function grosorTronco(f: number, lado: 1 | -1): number {
  const tabla = lado === 1 ? TRONCO_DELANTE : [...TRONCO_DETRAS].reverse()
  for (let i = 0; i < tabla.length - 1; i++) {
    const [fa, va] = tabla[i]!
    const [fb, vb] = tabla[i + 1]!
    if (f <= fb || i === tabla.length - 2) return Math.abs(lerp(va, vb, Math.min(1, Math.max(0, (f - fa) / (fb - fa)))))
  }
  return 9
}

function puntoTronco(p: PoseLateral, f: number, off: number): P {
  return mas(mas(p.cadera, por(dir(p.tronco), L.tronco * f)), por(anterior(p.tronco), off))
}

// ── Músculos que se resaltan ────────────────────────────────────────────────────────────────

type SitioLateral =
  | { en: Segmento; lado: 1 | -1; f: readonly [number, number]; hondo: number; exterior?: number }
  | { en: 'tronco'; lado: 1 | -1; f: readonly [number, number]; hondo: number; exterior?: number }
  | { en: 'cuello' }

const SITIOS_LATERAL: Record<ZonaMuscular, SitioLateral[]> = {
  pectoral_superior: [{ en: 'tronco', lado: 1, f: [0.84, 1.0], hondo: 0.35 }],
  pectoral_inferior: [{ en: 'tronco', lado: 1, f: [0.63, 0.86], hondo: 0.3 }],
  deltoides_anterior: [{ en: 'brazo', lado: 1, f: [-0.14, 0.42], hondo: 0.05 }],
  deltoides_lateral: [{ en: 'brazo', lado: 1, f: [-0.16, 0.44], hondo: -0.5, exterior: 0.45 }],
  deltoides_posterior: [{ en: 'brazo', lado: -1, f: [-0.14, 0.42], hondo: 0.05 }],
  biceps: [{ en: 'brazo', lado: 1, f: [0.3, 0.86], hondo: 0.02 }],
  braquial: [{ en: 'brazo', lado: 1, f: [0.55, 0.96], hondo: -0.25, exterior: 0.55 }],
  triceps: [{ en: 'brazo', lado: -1, f: [0.16, 0.92], hondo: 0 }],
  antebrazos: [
    { en: 'antebrazo', lado: 1, f: [0.04, 0.7], hondo: 0 },
    { en: 'antebrazo', lado: -1, f: [0.04, 0.62], hondo: 0.1 },
  ],
  trapecio: [{ en: 'tronco', lado: -1, f: [0.84, 1.1], hondo: 0.15 }, { en: 'cuello' }],
  espalda_media: [{ en: 'tronco', lado: -1, f: [0.66, 0.92], hondo: 0.5, exterior: 0.97 }],
  dorsales: [{ en: 'tronco', lado: -1, f: [0.42, 0.86], hondo: 0.05 }],
  lumbares: [{ en: 'tronco', lado: -1, f: [0.12, 0.44], hondo: 0.45 }],
  abdomen: [{ en: 'tronco', lado: 1, f: [0.12, 0.62], hondo: 0.4 }],
  oblicuos: [{ en: 'tronco', lado: 1, f: [0.18, 0.58], hondo: -0.45, exterior: 0.45 }],
  gluteo_mayor: [{ en: 'tronco', lado: -1, f: [-0.14, 0.2], hondo: 0.15 }],
  gluteo_medio: [{ en: 'tronco', lado: -1, f: [0.06, 0.3], hondo: -0.2, exterior: 0.55 }],
  cuadriceps: [{ en: 'muslo', lado: 1, f: [0.1, 0.9], hondo: 0 }],
  isquiotibiales: [{ en: 'muslo', lado: -1, f: [0.14, 0.88], hondo: 0.05 }],
  aductores: [{ en: 'muslo', lado: 1, f: [0.04, 0.52], hondo: -0.45, exterior: 0.3 }],
  gemelos: [{ en: 'tibia', lado: -1, f: [0.04, 0.55], hondo: 0 }],
  soleo: [{ en: 'tibia', lado: -1, f: [0.45, 0.82], hondo: 0.35, exterior: 0.98 }],
  cuello: [{ en: 'cuello' }],
}

/** Zonas en el tronco de frente/espalda: [x1, x2] (desde el centro) y [f1, f2] (de cadera a hombros). */
type Zona = { x: readonly [number, number]; f: readonly [number, number]; simetrica?: boolean }
type SitioFrontal = { en: 'zona'; zona: Zona } | { en: Segmento; lado: 1 | -1; f: readonly [number, number]; hondo: number; exterior?: number } | { en: 'cuello' } | { en: 'trapecio' }

const SITIOS_FRONTAL: Partial<Record<ZonaMuscular, SitioFrontal[]>> = {
  pectoral_superior: [{ en: 'zona', zona: { x: [1.5, 15], f: [0.84, 0.98] } }],
  pectoral_inferior: [{ en: 'zona', zona: { x: [1.5, 15.5], f: [0.64, 0.85] } }],
  deltoides_anterior: [{ en: 'brazo', lado: -1, f: [-0.12, 0.36], hondo: -0.2 }],
  deltoides_lateral: [{ en: 'brazo', lado: 1, f: [-0.16, 0.38], hondo: -0.3 }],
  biceps: [{ en: 'brazo', lado: 1, f: [0.3, 0.86], hondo: -0.6, exterior: 0.6 }],
  braquial: [{ en: 'brazo', lado: 1, f: [0.55, 0.95], hondo: 0.2 }],
  triceps: [{ en: 'brazo', lado: -1, f: [0.25, 0.88], hondo: 0.35 }],
  antebrazos: [{ en: 'antebrazo', lado: 1, f: [0.04, 0.65], hondo: -0.7, exterior: 0.8 }],
  trapecio: [{ en: 'trapecio' }],
  dorsales: [{ en: 'zona', zona: { x: [11, 15.5], f: [0.5, 0.8] } }],
  abdomen: [{ en: 'zona', zona: { x: [-5, 5], f: [0.12, 0.62], simetrica: false } }],
  oblicuos: [{ en: 'zona', zona: { x: [7, 12], f: [0.14, 0.56] } }],
  gluteo_medio: [{ en: 'zona', zona: { x: [10, 14], f: [-0.04, 0.16] } }],
  cuadriceps: [{ en: 'muslo', lado: 1, f: [0.1, 0.88], hondo: -0.55, exterior: 0.85 }],
  aductores: [{ en: 'muslo', lado: -1, f: [0.02, 0.52], hondo: 0.1 }],
  gemelos: [
    { en: 'tibia', lado: 1, f: [0.06, 0.5], hondo: 0.35 },
    { en: 'tibia', lado: -1, f: [0.06, 0.48], hondo: 0.4 },
  ],
  soleo: [
    { en: 'tibia', lado: 1, f: [0.45, 0.8], hondo: 0.5 },
    { en: 'tibia', lado: -1, f: [0.45, 0.78], hondo: 0.5 },
  ],
  cuello: [{ en: 'cuello' }],
}

const SITIOS_DORSAL: Partial<Record<ZonaMuscular, SitioFrontal[]>> = {
  trapecio: [{ en: 'trapecio' }],
  espalda_media: [{ en: 'zona', zona: { x: [2, 9.5], f: [0.64, 0.9] } }],
  dorsales: [{ en: 'zona', zona: { x: [6, 15.5], f: [0.4, 0.78] } }],
  lumbares: [{ en: 'zona', zona: { x: [1.5, 7], f: [0.1, 0.4] } }],
  gluteo_mayor: [{ en: 'zona', zona: { x: [1.5, 12.5], f: [-0.24, 0.08] } }],
  gluteo_medio: [{ en: 'zona', zona: { x: [8, 13.5], f: [0.05, 0.2] } }],
  deltoides_posterior: [{ en: 'brazo', lado: -1, f: [-0.14, 0.36], hondo: -0.3 }],
  deltoides_lateral: [{ en: 'brazo', lado: 1, f: [-0.16, 0.38], hondo: -0.1 }],
  triceps: [{ en: 'brazo', lado: 1, f: [0.2, 0.88], hondo: -0.6, exterior: 0.75 }],
  antebrazos: [{ en: 'antebrazo', lado: 1, f: [0.04, 0.65], hondo: -0.7, exterior: 0.8 }],
  isquiotibiales: [{ en: 'muslo', lado: 1, f: [0.14, 0.88], hondo: -0.6, exterior: 0.8 }],
  aductores: [{ en: 'muslo', lado: -1, f: [0.04, 0.5], hondo: 0.2 }],
  gemelos: [
    { en: 'tibia', lado: 1, f: [0.05, 0.52], hondo: -0.05 },
    { en: 'tibia', lado: -1, f: [0.05, 0.5], hondo: -0.05 },
  ],
  soleo: [
    { en: 'tibia', lado: 1, f: [0.48, 0.82], hondo: 0.4 },
    { en: 'tibia', lado: -1, f: [0.48, 0.8], hondo: 0.4 },
  ],
  cuello: [{ en: 'cuello' }],
}

// ── Figura lateral ──────────────────────────────────────────────────────────────────────────

const normalMiembro = (a: P, b: P): P => dir(angulo(a, b) + 90)

function dibujarLateral(p: PoseLateral, resaltar: ReadonlySet<ZonaMuscular>, sufijo: string, capa: 'lejos' | 'cerca'): Forma[] {
  const i = capa === 'lejos' ? 1 : 0
  const claseCuerpo: Clase = capa === 'lejos' ? 'lejos' : 'cuerpo'
  const claseMusculo: Clase = capa === 'lejos' ? 'musculoLejos' : 'musculo'
  const brazo = p.brazos[i]
  const pierna = p.piernas[i]
  const out: Forma[] = []
  const sitiosDe = (seg: Segmento) =>
    [...resaltar].flatMap((m) => SITIOS_LATERAL[m].filter((s): s is Extract<SitioLateral, { en: Segmento }> => s.en === seg))

  const miembro = (seg: Segmento, a: P, b: P) => {
    const n = normalMiembro(a, b)
    out.push({ k: `${seg}${sufijo}`, tipo: 'path', d: contornoMiembro(a, b, PERFIL[seg], n), clase: claseCuerpo })
    sitiosDe(seg).forEach((s, j) =>
      out.push({ k: `${seg}${sufijo}m${j}`, tipo: 'path', d: musculoMiembro(a, b, PERFIL[seg], n, s.lado, s.f, s.hondo, s.exterior), clase: claseMusculo }),
    )
  }

  // Pierna
  miembro('muslo', pierna.cadera, pierna.rodilla)
  miembro('tibia', pierna.rodilla, pierna.tobillo)
  out.push({ k: `rodilla${sufijo}`, tipo: 'circulo', c: pierna.rodilla, r: PERFIL.tibia.ra * 1.02, clase: claseCuerpo })
  out.push({ k: `pie${sufijo}`, tipo: 'path', d: pie(pierna.talon, pierna.tobillo, pierna.punta), clase: claseCuerpo })
  // Brazo
  miembro('brazo', brazo.hombro, brazo.codo)
  miembro('antebrazo', brazo.codo, brazo.muneca)
  out.push({ k: `codo${sufijo}`, tipo: 'circulo', c: brazo.codo, r: PERFIL.antebrazo.ra * 0.98, clase: claseCuerpo })
  out.push({ k: `mano${sufijo}`, tipo: 'path', d: mano(brazo.muneca, brazo.agarre), clase: claseCuerpo })
  return out
}

function pie(talon: P, tobillo: P, punta: P): string {
  const d = angulo(talon, punta)
  const n = dir(d - 90) // hacia arriba si el pie va hacia delante
  return cerrada([mas(talon, por(n, 2.4)), mas(tobillo, por(n, 3.8)), mas(punta, por(n, 1.4)), desde(punta, d, 1.6), mas(punta, por(n, -1.6)), mas(talon, por(n, -2.2)), desde(talon, d, -2)])
}

function mano(muneca: P, agarre: P): string {
  const d = angulo(muneca, agarre)
  const n = dir(d + 90)
  return cerrada([mas(muneca, por(n, 2.9)), desde(mas(agarre, por(n, 2.6)), d, 1.5), desde(agarre, d, 3.6), desde(mas(agarre, por(n, -2.6)), d, 1.5), mas(muneca, por(n, -2.9))])
}

function tronco(p: PoseLateral, resaltar: ReadonlySet<ZonaMuscular>): Forma[] {
  const contorno = cerrada([
    ...TRONCO_DELANTE.map(([f, o]) => puntoTronco(p, f, o)),
    ...TRONCO_DETRAS.map(([f, o]) => puntoTronco(p, f, o)),
  ])
  const out: Forma[] = []
  // Cuello y cabeza
  const u = dir(p.tronco)
  const n = anterior(p.tronco)
  const base = p.cuello
  const ejeCabeza = angulo(base, p.cabeza)
  const nc = dir(ejeCabeza - 90)
  const cuello = `M${pt(mas(base, por(n, 4.6)))}L${pt(mas(desde(base, ejeCabeza, 9), por(nc, 4)))}L${pt(mas(desde(base, ejeCabeza, 9), por(nc, -4.4)))}L${pt(mas(mas(base, por(n, -5.2)), por(u, -2)))}Z`
  out.push({ k: 'cuello', tipo: 'path', d: cuello, clase: 'cuerpo' })
  if ([...resaltar].some((m) => SITIOS_LATERAL[m].some((s) => s.en === 'cuello')))
    out.push({ k: 'cuellom', tipo: 'path', d: cuello, clase: 'musculo' })
  // Una nariz mínima indica hacia dónde mira (sin rostro).
  out.push({ k: 'nariz', tipo: 'circulo', c: mas(p.cabeza, mas(por(dir(ejeCabeza - 90), L.cabeza - 0.6), por(dir(ejeCabeza), -1.5))), r: 2.1, clase: 'cuerpo' })
  out.push({ k: 'cabeza', tipo: 'circulo', c: p.cabeza, r: L.cabeza, clase: 'cuerpo' })
  out.push({ k: 'tronco', tipo: 'path', d: contorno, clase: 'cuerpo' })
  let j = 0
  for (const m of resaltar)
    for (const s of SITIOS_LATERAL[m]) {
      if (s.en !== 'tronco') continue
      const ext = s.exterior ?? 0.92
      const fm = (s.f[0] + s.f[1]) / 2
      const en = (f: number, k: number) => puntoTronco(p, f, s.lado * grosorTronco(f, s.lado) * k)
      out.push({
        k: `troncom${j++}`,
        tipo: 'path',
        d: lente(en(s.f[0], lerp(s.hondo, ext, 0.5)), en(fm, ext * 1.14), en(s.f[1], lerp(s.hondo, ext, 0.5)), en(fm, s.hondo)),
        clase: 'musculo',
      })
    }
  // Hombro (deltoides) encima del tronco
  return out
}

// ── Figura frontal / dorsal ─────────────────────────────────────────────────────────────────

const ANCHO_TRONCO: readonly (readonly [number, number])[] = [
  [-0.06, 12.5],
  [0.16, 12.8],
  [0.4, 11.4],
  [0.64, 13.6],
  [0.84, 16.4],
  [1.0, 17.6],
]

function dibujarFrontal(p: PoseFrontal, resaltar: ReadonlySet<ZonaMuscular>, dorsal: boolean): Forma[] {
  const u = dir(p.tronco)
  const lat = dir(p.tronco - 90)
  const altura = Math.hypot(p.centroHombros[0] - p.cadera[0], p.centroHombros[1] - p.cadera[1])
  const enTronco = (f: number, x: number): P => mas(mas(p.cadera, por(u, altura * f)), por(lat, x))
  const anchoHombros = Math.hypot(p.brazos[0].hombro[0] - p.brazos[1].hombro[0], p.brazos[0].hombro[1] - p.brazos[1].hombro[1]) / 2
  const k = anchoHombros / L.hombros
  const sitios = dorsal ? SITIOS_DORSAL : SITIOS_FRONTAL
  const out: Forma[] = []

  // Piernas y brazos (los dos lados se ven igual de cerca).
  const sitiosDe = (seg: Segmento) =>
    [...resaltar].flatMap((m) => (sitios[m] ?? []).filter((s): s is Extract<SitioFrontal, { en: Segmento }> => s.en === seg))
  const miembro = (seg: Segmento, a: P, b: P, lado: number, i: number) => {
    const n = por(normalMiembro(a, b), lado)
    out.push({ k: `${seg}${i}`, tipo: 'path', d: contornoMiembro(a, b, PERFIL[seg], n), clase: 'cuerpo' })
    sitiosDe(seg).forEach((s, j) =>
      out.push({ k: `${seg}${i}m${j}`, tipo: 'path', d: musculoMiembro(a, b, PERFIL[seg], n, s.lado, s.f, s.hondo, s.exterior), clase: 'musculo' }),
    )
  }
  p.piernas.forEach((pi, i) => {
    const lado = i === 0 ? 1 : -1
    miembro('muslo', pi.cadera, pi.rodilla, lado, i)
    miembro('tibia', pi.rodilla, pi.tobillo, lado, i)
    out.push({ k: `rodilla${i}`, tipo: 'circulo', c: pi.rodilla, r: PERFIL.tibia.ra, clase: 'cuerpo' })
    out.push({ k: `pie${i}`, tipo: 'path', d: pie(pi.talon, pi.tobillo, pi.punta), clase: 'cuerpo' })
  })

  // Tronco
  const derecha = ANCHO_TRONCO.map(([f, w]) => enTronco(f, w * (f > 0.6 ? lerp(1, k, (f - 0.6) / 0.4) : 1)))
  const izquierda = [...ANCHO_TRONCO].reverse().map(([f, w]) => enTronco(f, -w * (f > 0.6 ? lerp(1, k, (f - 0.6) / 0.4) : 1)))
  const cuelloBase = p.cuello
  const ejeCabeza = angulo(cuelloBase, p.cabeza)
  const nc = dir(ejeCabeza - 90)
  const cuello = `M${pt(mas(cuelloBase, por(lat, 5.5)))}L${pt(mas(desde(cuelloBase, ejeCabeza, 9), por(nc, -4.6)))}L${pt(mas(desde(cuelloBase, ejeCabeza, 9), por(nc, 4.6)))}L${pt(mas(cuelloBase, por(lat, -5.5)))}Z`
  out.push({ k: 'cuello', tipo: 'path', d: cuello, clase: 'cuerpo' })
  out.push({ k: 'cabeza', tipo: 'circulo', c: p.cabeza, r: L.cabeza, clase: 'cuerpo' })
  out.push({
    k: 'tronco',
    tipo: 'path',
    d: cerrada([...derecha, mas(cuelloBase, por(lat, 7)), mas(cuelloBase, por(lat, -7)), ...izquierda, enTronco(-0.12, 0)]),
    clase: 'cuerpo',
  })
  // Detalles anatómicos discretos: línea alba de frente, columna de espalda.
  out.push({ k: 'surco', tipo: 'path', d: linea(enTronco(dorsal ? 0.15 : 0.12, 0), enTronco(dorsal ? 0.95 : 0.62, 0)), clase: 'surco' })

  let j = 0
  for (const m of resaltar)
    for (const s of sitios[m] ?? []) {
      if (s.en === 'zona') {
        const { x, f, simetrica = true } = s.zona
        const zona = (sg: number) =>
          cerrada([enTronco(f[0], sg * x[0]), enTronco(f[0], sg * x[1]), enTronco(f[1], sg * x[1] * k), enTronco(f[1], sg * x[0])])
        out.push({ k: `zona${j++}`, tipo: 'path', d: zona(1), clase: 'musculo' })
        if (simetrica) out.push({ k: `zona${j++}`, tipo: 'path', d: zona(-1), clase: 'musculo' })
      } else if (s.en === 'trapecio') {
        const t = dorsal
          ? cerrada([enTronco(1.1, 0), enTronco(0.98, 14 * k), enTronco(0.86, 7), enTronco(0.6, 0), enTronco(0.86, -7), enTronco(0.98, -14 * k)])
          : cerrada([enTronco(1.08, 4.5), enTronco(0.99, 15 * k), enTronco(0.97, 5), enTronco(0.97, -5), enTronco(0.99, -15 * k), enTronco(1.08, -4.5)])
        out.push({ k: `zona${j++}`, tipo: 'path', d: t, clase: 'musculo' })
      } else if (s.en === 'cuello') {
        out.push({ k: `zona${j++}`, tipo: 'path', d: cuello, clase: 'musculo' })
      }
    }

  p.brazos.forEach((b, i) => {
    const lado = i === 0 ? 1 : -1
    miembro('brazo', b.hombro, b.codo, lado, i)
    miembro('antebrazo', b.codo, b.muneca, lado, i)
    out.push({ k: `codo${i}`, tipo: 'circulo', c: b.codo, r: PERFIL.antebrazo.ra, clase: 'cuerpo' })
    out.push({ k: `mano${i}`, tipo: 'path', d: mano(b.muneca, b.agarre), clase: 'cuerpo' })
  })
  return out
}

// ── Material ────────────────────────────────────────────────────────────────────────────────

const RADIO_DISCO = { grandes: 16, pequenos: 11 } as const

function mancuerna(k: string, c: P, eje: number, clase: Clase = 'metal'): Forma[] {
  const a = desde(c, eje, 7.5)
  const b = desde(c, eje, -7.5)
  const n = dir(eje + 90)
  const cabeza = (q: P) => cerrada([mas(desde(q, eje, 2.6), por(n, 4.6)), mas(desde(q, eje, -2.6), por(n, 4.6)), mas(desde(q, eje, -2.6), por(n, -4.6)), mas(desde(q, eje, 2.6), por(n, -4.6))])
  return [
    { k: `${k}e`, tipo: 'path', d: linea(a, b), clase: 'barra' },
    { k: `${k}a`, tipo: 'path', d: cabeza(a), clase },
    { k: `${k}b`, tipo: 'path', d: cabeza(b), clase },
  ]
}

interface Capas {
  fondo: Forma[]
  medio: Forma[]
  frente: Forma[]
}

function materialLateral(p: PoseLateral, equipo: readonly Equipo[], fijo: { barraX: number | null }): Capas {
  const c: Capas = { fondo: [], medio: [], frente: [] }
  const [cerca, lejos] = p.brazos
  equipo.forEach((e, i) => {
    const k = `eq${i}`
    switch (e.tipo) {
      case 'barra':
      case 'multipower': {
        if (e.tipo === 'multipower' && fijo.barraX !== null) {
          c.fondo.push({ k: `${k}g`, tipo: 'path', d: linea([fijo.barraX - 3, 14], [fijo.barraX - 3, SUELO]), clase: 'torre' })
          c.fondo.push({ k: `${k}h`, tipo: 'path', d: linea([fijo.barraX - 14, 14], [fijo.barraX + 8, 14]), clase: 'torre' })
        }
        const r = e.tipo === 'barra' && e.discos === 'pequenos' ? RADIO_DISCO.pequenos : e.tipo === 'multipower' ? 13 : RADIO_DISCO.grandes
        const centro = e.en === 'pies' ? enPies(p) : cerca.agarre
        c.frente.push({ k: `${k}d`, tipo: 'circulo', c: centro, r, clase: 'disco' })
        c.frente.push({ k: `${k}c`, tipo: 'circulo', c: centro, r: 2.6, clase: 'metal' })
        break
      }
      case 'mancuernas': {
        if (e.en === 'pies') {
          c.frente.push(...mancuerna(`${k}p`, enPies(p), angulo(p.piernas[0].tobillo, p.piernas[0].punta) + 90))
          break
        }
        const manos = e.manos ?? [0, 1]
        if (manos.includes(1)) c.medio.push(...mancuerna(`${k}l`, lejos.agarre, angulo(lejos.codo, lejos.muneca) + 90))
        if (manos.includes(0)) c.frente.push(...mancuerna(`${k}c`, cerca.agarre, angulo(cerca.codo, cerca.muneca) + 90))
        break
      }
      case 'disco': {
        const eje = angulo(cerca.codo, cerca.muneca) + 90
        const n = dir(eje + 90)
        const centro = cerca.agarre
        c.frente.push({
          k: `${k}d`,
          tipo: 'path',
          d: cerrada([mas(desde(centro, eje, 13), por(n, 2.6)), mas(desde(centro, eje, -13), por(n, 2.6)), mas(desde(centro, eje, -13), por(n, -2.6)), mas(desde(centro, eje, 13), por(n, -2.6))]),
          clase: 'disco',
        })
        break
      }
      case 'landmine': {
        const ang = angulo(e.pivote, cerca.agarre)
        const punta = desde(cerca.agarre, ang, 16)
        c.fondo.push({ k: `${k}p`, tipo: 'circulo', c: e.pivote, r: 3.5, clase: 'metal', fuera: true })
        c.medio.push({ k: `${k}b`, tipo: 'path', d: linea(e.pivote, punta), clase: 'barra', fuera: true })
        c.frente.push({ k: `${k}d`, tipo: 'circulo', c: desde(cerca.agarre, ang, 10), r: 11, clase: 'disco' })
        break
      }
      case 'polea': {
        const destinos: P[] =
          e.a === 'tobillo0' ? [p.piernas[0].tobillo] : e.a === 'mano1' ? [lejos.agarre] : e.a === 'mano0' ? [cerca.agarre] : [cerca.agarre]
        c.fondo.push({ k: `${k}t`, tipo: 'path', d: linea([e.anclaje[0], SUELO], [e.anclaje[0], Math.min(e.anclaje[1] - 8, 24)]), clase: 'torre' })
        c.fondo.push({ k: `${k}r`, tipo: 'circulo', c: e.anclaje, r: 4, clase: 'metal' })
        destinos.forEach((d, j) => {
          c.medio.push({ k: `${k}c${j}`, tipo: 'path', d: linea(e.anclaje, d), clase: 'cable', fuera: true })
          c.frente.push({ k: `${k}m${j}`, tipo: 'circulo', c: d, r: 2.4, clase: 'metal' })
        })
        break
      }
      case 'banco': {
        const [a, b] = e.asiento
        ;(e.delante ? c.frente : c.medio).push({ k: `${k}a`, tipo: 'path', d: linea(a, b), clase: 'banco' })
        if (e.respaldo) c.medio.push({ k: `${k}r`, tipo: 'path', d: linea(e.respaldo[0], e.respaldo[1]), clase: 'banco' })
        if (e.patas !== false) {
          const pa = lerpP2(a, b, 0.15)
          const pb = lerpP2(a, b, 0.85)
          c.fondo.push({ k: `${k}p1`, tipo: 'path', d: linea(pa, [pa[0], SUELO]), clase: 'torre' })
          c.fondo.push({ k: `${k}p2`, tipo: 'path', d: linea(pb, [pb[0], SUELO]), clase: 'torre' })
        }
        break
      }
      case 'caja':
        c.fondo.push({
          k: `${k}c`,
          tipo: 'path',
          d: `M${pt([e.x, SUELO])}L${pt([e.x, e.y])}L${pt([e.x + e.ancho, e.y])}L${pt([e.x + e.ancho, SUELO])}Z`,
          clase: 'caja',
        })
        break
      case 'rodillo':
        c.medio.push({ k: `${k}r`, tipo: 'circulo', c: e.c, r: 4.5, clase: 'banco' })
        break
    }
  })
  return c
}

const lerpP2 = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]

/** Punto donde va el material sujeto con los pies (prensa, curl femoral). */
export const enPies = (p: PoseLateral): P => medio(p.piernas[0].tobillo, p.piernas[0].punta)

function materialFrontal(p: PoseFrontal, equipo: readonly Equipo[], cenital: boolean): Capas {
  const c: Capas = { fondo: [], medio: [], frente: [] }
  const [d, i] = p.brazos
  equipo.forEach((e, n) => {
    const k = `eq${n}`
    switch (e.tipo) {
      case 'barra':
      case 'multipower': {
        const eje = angulo(i.agarre, d.agarre)
        const extD = desde(d.agarre, eje, 26)
        const extI = desde(i.agarre, eje, -26)
        c.frente.push({ k: `${k}b`, tipo: 'path', d: linea(extI, extD), clase: 'barra' })
        const r = e.tipo === 'barra' && e.discos === 'pequenos' ? 11 : 16
        const disco = (q: P, kk: string): Forma => {
          const nn = dir(eje + 90)
          return {
            k: kk,
            tipo: 'path',
            d: cerrada([mas(desde(q, eje, 3), por(nn, r)), mas(desde(q, eje, -3), por(nn, r)), mas(desde(q, eje, -3), por(nn, -r)), mas(desde(q, eje, 3), por(nn, -r))]),
            clase: 'disco',
          }
        }
        c.frente.push(disco(desde(d.agarre, eje, 20), `${k}d`), disco(desde(i.agarre, eje, -20), `${k}i`))
        if (e.tipo === 'multipower') {
          c.fondo.push({ k: `${k}g1`, tipo: 'path', d: linea([extD[0] + 6, 14], [extD[0] + 6, SUELO]), clase: 'torre' })
          c.fondo.push({ k: `${k}g2`, tipo: 'path', d: linea([extI[0] - 6, 14], [extI[0] - 6, SUELO]), clase: 'torre' })
        }
        break
      }
      case 'mancuernas':
        for (const [j, b] of [d, i].entries()) {
          if (e.manos && !e.manos.includes(j as 0 | 1)) continue
          c.frente.push(...mancuerna(`${k}${j}`, b.agarre, angulo(b.codo, b.muneca) + 90))
        }
        break
      case 'disco':
        c.frente.push({ k: `${k}d`, tipo: 'circulo', c: medio(d.agarre, i.agarre), r: 13, clase: 'disco' })
        break
      case 'polea': {
        c.fondo.push({ k: `${k}t`, tipo: 'path', d: linea([e.anclaje[0], SUELO], [e.anclaje[0], Math.min(e.anclaje[1] - 8, 24)]), clase: 'torre' })
        c.fondo.push({ k: `${k}r`, tipo: 'circulo', c: e.anclaje, r: 4, clase: 'metal' })
        const destinos: [P, P][] = []
        if (e.a === 'tobillo0') destinos.push([e.anclaje, p.piernas[0].tobillo])
        else if (e.a === 'mano1') destinos.push([e.anclaje, i.agarre])
        else if (e.a === 'mano0') destinos.push([e.anclaje, d.agarre])
        else destinos.push([e.anclaje, medio(d.agarre, i.agarre)])
        if (e.anclaje2) {
          c.fondo.push({ k: `${k}t2`, tipo: 'path', d: linea([e.anclaje2[0], SUELO], [e.anclaje2[0], Math.min(e.anclaje2[1] - 8, 24)]), clase: 'torre' })
          c.fondo.push({ k: `${k}r2`, tipo: 'circulo', c: e.anclaje2, r: 4, clase: 'metal' })
          destinos.splice(0, 1, [e.anclaje, d.agarre], [e.anclaje2, i.agarre])
        }
        destinos.forEach(([a, b], j) => {
          c.medio.push({ k: `${k}c${j}`, tipo: 'path', d: linea(a, b), clase: 'cable', fuera: true })
          c.frente.push({ k: `${k}m${j}`, tipo: 'circulo', c: b, r: 2.4, clase: 'metal' })
        })
        break
      }
      case 'banco': {
        const [a, b] = e.asiento
        const clase: Clase = cenital ? 'bancoAncho' : 'banco'
        c.fondo.push({ k: `${k}a`, tipo: 'path', d: linea(a, b), clase })
        if (e.respaldo) c.fondo.push({ k: `${k}r`, tipo: 'path', d: linea(e.respaldo[0], e.respaldo[1]), clase })
        break
      }
      case 'caja':
        c.fondo.push({
          k: `${k}c`,
          tipo: 'path',
          d: `M${pt([e.x, SUELO])}L${pt([e.x, e.y])}L${pt([e.x + e.ancho, e.y])}L${pt([e.x + e.ancho, SUELO])}Z`,
          clase: 'caja',
        })
        break
      case 'landmine': {
        const centro = medio(d.agarre, i.agarre)
        c.fondo.push({ k: `${k}p`, tipo: 'circulo', c: e.pivote, r: 3.5, clase: 'metal', fuera: true })
        c.medio.push({ k: `${k}b`, tipo: 'path', d: linea(e.pivote, desde(centro, angulo(e.pivote, centro), 14)), clase: 'barra', fuera: true })
        c.frente.push({ k: `${k}d`, tipo: 'circulo', c: desde(centro, angulo(e.pivote, centro), 9), r: 10, clase: 'disco' })
        break
      }
      case 'rodillo':
        break
    }
  })
  return c
}

/** Formas de un fotograma, de atrás hacia delante. */
export function dibujar(
  pose: PoseLateral | PoseFrontal,
  vista: Vista,
  equipo: readonly Equipo[],
  /** Zonas que se pintan de acento (ver zonaDe). */
  resaltar: ReadonlySet<ZonaMuscular>,
  fijo: { barraX: number | null },
): Forma[] {
  if (pose.vista === 'lateral') {
    const m = materialLateral(pose, equipo, fijo)
    return [
      ...m.fondo,
      ...dibujarLateral(pose, resaltar, 'l', 'lejos'),
      ...m.medio,
      ...tronco(pose, resaltar),
      ...dibujarLateral(pose, resaltar, 'c', 'cerca'),
      ...m.frente,
    ]
  }
  const m = materialFrontal(pose, equipo, vista === 'cenital')
  return [...m.fondo, ...m.medio, ...dibujarFrontal(pose, resaltar, vista === 'dorsal'), ...m.frente]
}

