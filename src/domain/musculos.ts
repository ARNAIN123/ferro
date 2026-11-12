// División muscular (ronda 5): 18 grupos grandes, como se dicen en el gimnasio. Cada ejercicio lleva
// sus grupos principales y secundarios. Los modelos 3D siguen teniendo sus 48 regiones (las de la
// división fina de la ronda 4): cada región pertenece a un grupo y se pinta con él.
// Las zonas (ZONAS, las regiones de la ronda 2) quedan para el mapa y las animaciones 2D.
import { MUSCULOS, type Musculo, type Zona } from './tipos'

export interface InfoMusculo {
  /** Nombre para listas, fichas y mapas. */
  nombre: string
  /** Zonas del mapa y las animaciones 2D que pinta (la primera es la principal). */
  zonas: readonly Zona[]
}

export const INFO_MUSCULO: Record<Musculo, InfoMusculo> = {
  cuello: { nombre: 'Cuello', zonas: ['cuello'] },
  trapecio: { nombre: 'Trapecio', zonas: ['trapecio'] },
  hombros: { nombre: 'Hombros', zonas: ['deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior'] },
  pecho: { nombre: 'Pecho', zonas: ['pectoral_inferior', 'pectoral_superior'] },
  biceps: { nombre: 'Bíceps', zonas: ['biceps', 'braquial'] },
  triceps: { nombre: 'Tríceps', zonas: ['triceps'] },
  antebrazos: { nombre: 'Antebrazos', zonas: ['antebrazos'] },
  espalda_alta: { nombre: 'Espalda alta', zonas: ['espalda_media'] },
  dorsales: { nombre: 'Dorsales', zonas: ['dorsales'] },
  lumbares: { nombre: 'Lumbares', zonas: ['lumbares'] },
  abdominales: { nombre: 'Abdominales', zonas: ['abdomen'] },
  oblicuos: { nombre: 'Oblicuos', zonas: ['oblicuos'] },
  gluteos: { nombre: 'Glúteos', zonas: ['gluteo_mayor'] },
  abductores: { nombre: 'Abductores', zonas: ['gluteo_medio'] },
  aductores: { nombre: 'Aductores', zonas: ['aductores'] },
  cuadriceps: { nombre: 'Cuádriceps', zonas: ['cuadriceps'] },
  isquiotibiales: { nombre: 'Isquiotibiales', zonas: ['isquiotibiales'] },
  gemelos: { nombre: 'Gemelos', zonas: ['gemelos', 'soleo'] },
}

export const nombreDe = (m: Musculo): string => INFO_MUSCULO[m].nombre

/** Zona principal de un grupo (la que eligen las animaciones 2D de los ejercicios propios). */
export const zonaDe = (m: Musculo): Zona => INFO_MUSCULO[m].zonas[0]!

/** Niveles por zona 2D: cada zona toma el nivel más alto de los grupos que la pintan. */
export function nivelesPorZona(niveles: ReadonlyMap<Musculo, number>): Map<Zona, number> {
  const r = new Map<Zona, number>()
  for (const [m, n] of niveles) for (const z of INFO_MUSCULO[m].zonas) r.set(z, Math.max(r.get(z) ?? 0, n))
  return r
}

/** Nombres de una lista de grupos, sin repetir. */
export const nombresDeMusculos = (lista: readonly Musculo[]): string[] => [...new Set(lista)].map(nombreDe)

// ── Regiones de los modelos 3D ──────────────────────────────────────────────────────────────

/**
 * Regiones de los modelos 3D (public/modelos): las 48 de la división fina de la ronda 4, en el
 * orden de sus ids (id = índice + 1). Los scripts de Blender usan la misma lista; no se reordena.
 */
export const REGIONES_MODELO = [
  'esternocleidomastoideo',
  'esplenio',
  'deltoides_anterior',
  'deltoides_lateral',
  'deltoides_posterior',
  'pectoral_clavicular',
  'pectoral_esternal',
  'pectoral_costal',
  'serrato_anterior',
  'trapecio_superior',
  'trapecio_medio',
  'trapecio_inferior',
  'romboides',
  'dorsal_ancho',
  'redondo_mayor',
  'infraespinoso',
  'redondo_menor',
  'supraespinoso',
  'subescapular',
  'erectores_espinales',
  'biceps',
  'braquial',
  'braquiorradial',
  'triceps_larga',
  'triceps_lateral',
  'triceps_medial',
  'flexores_antebrazo',
  'extensores_antebrazo',
  'recto_abdominal',
  'oblicuos',
  'gluteo_mayor',
  'gluteo_medio',
  'gluteo_menor',
  'tensor_fascia_lata',
  'psoas_iliaco',
  'recto_femoral',
  'vasto_lateral',
  'vasto_medial',
  'sartorio',
  'aductores',
  'biceps_femoral',
  'semitendinoso',
  'semimembranoso',
  'gemelo_medial',
  'gemelo_lateral',
  'soleo',
  'tibial_anterior',
  'peroneos',
] as const
export type RegionModelo = (typeof REGIONES_MODELO)[number]

/**
 * Grupo de cada región del modelo. El manguito rotador profundo (supraespinoso y subescapular) va con
 * los hombros; el que se ve sobre la escápula (infraespinoso y redondo menor), con la espalda alta.
 */
export const GRUPO_DE_REGION: Record<RegionModelo, Musculo> = {
  esternocleidomastoideo: 'cuello',
  esplenio: 'cuello',
  deltoides_anterior: 'hombros',
  deltoides_lateral: 'hombros',
  deltoides_posterior: 'hombros',
  pectoral_clavicular: 'pecho',
  pectoral_esternal: 'pecho',
  pectoral_costal: 'pecho',
  serrato_anterior: 'pecho',
  trapecio_superior: 'trapecio',
  trapecio_medio: 'espalda_alta',
  trapecio_inferior: 'espalda_alta',
  romboides: 'espalda_alta',
  dorsal_ancho: 'dorsales',
  redondo_mayor: 'dorsales',
  infraespinoso: 'espalda_alta',
  redondo_menor: 'espalda_alta',
  supraespinoso: 'hombros',
  subescapular: 'hombros',
  erectores_espinales: 'lumbares',
  biceps: 'biceps',
  braquial: 'biceps',
  braquiorradial: 'antebrazos',
  triceps_larga: 'triceps',
  triceps_lateral: 'triceps',
  triceps_medial: 'triceps',
  flexores_antebrazo: 'antebrazos',
  extensores_antebrazo: 'antebrazos',
  recto_abdominal: 'abdominales',
  oblicuos: 'oblicuos',
  gluteo_mayor: 'gluteos',
  gluteo_medio: 'abductores',
  gluteo_menor: 'abductores',
  tensor_fascia_lata: 'abductores',
  psoas_iliaco: 'abdominales',
  recto_femoral: 'cuadriceps',
  vasto_lateral: 'cuadriceps',
  vasto_medial: 'cuadriceps',
  sartorio: 'cuadriceps',
  aductores: 'aductores',
  biceps_femoral: 'isquiotibiales',
  semitendinoso: 'isquiotibiales',
  semimembranoso: 'isquiotibiales',
  gemelo_medial: 'gemelos',
  gemelo_lateral: 'gemelos',
  soleo: 'gemelos',
  tibial_anterior: 'gemelos',
  peroneos: 'gemelos',
}

/** Grupo de una región del modelo por su id (1…48; null si no es ningún músculo). */
export const grupoDeRegion = (id: number): Musculo | null => {
  const r = REGIONES_MODELO[id - 1]
  return r ? GRUPO_DE_REGION[r] : null
}

// ── Nombres de versiones anteriores ─────────────────────────────────────────────────────────

/** Zonas (ronda 2–3) y nombres aún más antiguos (v1–v2) que no son ya un grupo. */
const ANTERIORES: Record<string, Musculo> = {
  pectoral_superior: 'pecho',
  pectoral_inferior: 'pecho',
  braquial: 'biceps',
  espalda_media: 'espalda_alta',
  abdomen: 'abdominales',
  gluteo_mayor: 'gluteos',
  gluteo_medio: 'abductores',
  soleo: 'gemelos',
  espalda: 'dorsales',
}

const ES_GRUPO = new Set<string>(MUSCULOS)

/**
 * Grupo de un nombre de músculo de cualquier versión: un grupo de ahora, una región de la división
 * fina (ronda 4), una zona (rondas 2–3) o un nombre de la v1 («pecho», «espalda»…). En todas las
 * versiones, un mismo nombre significa lo mismo, así que no hace falta saber de cuál viene.
 */
export function grupoDeNombre(nombre: string): Musculo | null {
  if (ES_GRUPO.has(nombre)) return nombre as Musculo
  if (nombre in GRUPO_DE_REGION) return GRUPO_DE_REGION[nombre as RegionModelo]
  if (nombre.startsWith('deltoides_')) return 'hombros'
  return ANTERIORES[nombre] ?? null
}

/**
 * Músculos de un ejercicio de cualquier versión → grupos: sin repetidos, sin nombres desconocidos y
 * sin secundarios que ya son principales. Es idempotente.
 */
export function aGrupos(principales: readonly string[], secundarios: readonly string[]): { principales: Musculo[]; secundarios: Musculo[] } {
  const convertir = (l: readonly string[]) => [...new Set(l.map(grupoDeNombre).filter((m): m is Musculo => m !== null))]
  const p = convertir(principales)
  return { principales: p, secundarios: convertir(secundarios).filter((m) => !p.includes(m)) }
}
