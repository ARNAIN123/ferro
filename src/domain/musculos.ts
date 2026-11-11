// División muscular (ronda 4): grupo → músculo → porción o cabeza. Cada hoja es un `Musculo` (una
// región del cuerpo 3D, en el mismo orden que MUSCULOS) y es lo que llevan los ejercicios.
// Las zonas (ZONAS, las regiones de la ronda 2) quedan para el mapa y las animaciones 2D, que
// agrupan varios músculos en la misma forma.
import { MUSCULOS, type Musculo, type Zona } from './tipos'

export const GRUPOS = ['cuello', 'hombros', 'pecho', 'espalda', 'brazos', 'core', 'cadera', 'piernas'] as const
export type Grupo = (typeof GRUPOS)[number]

export const NOMBRE_GRUPO: Record<Grupo, string> = {
  cuello: 'Cuello',
  hombros: 'Hombros',
  pecho: 'Pecho',
  espalda: 'Espalda',
  brazos: 'Brazos',
  core: 'Core',
  cadera: 'Cadera',
  piernas: 'Piernas',
}

export interface InfoMusculo {
  grupo: Grupo
  /** Músculo al que pertenece la porción (si es una porción o cabeza): «Pectoral mayor», «Tríceps»… */
  musculo?: string
  /** Nombre completo, para listas y fichas. */
  nombre: string
  /** Nombre corto, para chips y mapas. */
  corto: string
  /** Músculo profundo: no llega a la piel; al resaltarlo, lo que tiene encima se vuelve translúcido. */
  profundo?: boolean
  /** Zona del mapa y las animaciones 2D. */
  zona: Zona
}

export const INFO_MUSCULO: Record<Musculo, InfoMusculo> = {
  esternocleidomastoideo: { grupo: 'cuello', nombre: 'Esternocleidomastoideo', corto: 'Esternocleidomastoideo', zona: 'cuello' },
  esplenio: { grupo: 'cuello', nombre: 'Esplenio (extensores del cuello)', corto: 'Esplenio', zona: 'cuello' },

  deltoides_anterior: { grupo: 'hombros', musculo: 'Deltoides', nombre: 'Deltoides anterior', corto: 'Deltoides anterior', zona: 'deltoides_anterior' },
  deltoides_lateral: { grupo: 'hombros', musculo: 'Deltoides', nombre: 'Deltoides lateral', corto: 'Deltoides lateral', zona: 'deltoides_lateral' },
  deltoides_posterior: { grupo: 'hombros', musculo: 'Deltoides', nombre: 'Deltoides posterior', corto: 'Deltoides posterior', zona: 'deltoides_posterior' },

  pectoral_clavicular: { grupo: 'pecho', musculo: 'Pectoral mayor', nombre: 'Pectoral mayor, porción clavicular (superior)', corto: 'Pectoral superior', zona: 'pectoral_superior' },
  pectoral_esternal: { grupo: 'pecho', musculo: 'Pectoral mayor', nombre: 'Pectoral mayor, porción esternal (media)', corto: 'Pectoral medio', zona: 'pectoral_inferior' },
  pectoral_costal: { grupo: 'pecho', musculo: 'Pectoral mayor', nombre: 'Pectoral mayor, porción costal (inferior)', corto: 'Pectoral inferior', zona: 'pectoral_inferior' },
  serrato_anterior: { grupo: 'pecho', nombre: 'Serrato anterior', corto: 'Serrato anterior', zona: 'oblicuos' },

  trapecio_superior: { grupo: 'espalda', musculo: 'Trapecio', nombre: 'Trapecio superior', corto: 'Trapecio superior', zona: 'trapecio' },
  trapecio_medio: { grupo: 'espalda', musculo: 'Trapecio', nombre: 'Trapecio medio', corto: 'Trapecio medio', zona: 'espalda_media' },
  trapecio_inferior: { grupo: 'espalda', musculo: 'Trapecio', nombre: 'Trapecio inferior', corto: 'Trapecio inferior', zona: 'espalda_media' },
  romboides: { grupo: 'espalda', nombre: 'Romboides', corto: 'Romboides', zona: 'espalda_media' },
  dorsal_ancho: { grupo: 'espalda', nombre: 'Dorsal ancho', corto: 'Dorsal ancho', zona: 'dorsales' },
  redondo_mayor: { grupo: 'espalda', nombre: 'Redondo mayor', corto: 'Redondo mayor', zona: 'espalda_media' },
  infraespinoso: { grupo: 'espalda', musculo: 'Manguito rotador', nombre: 'Infraespinoso', corto: 'Infraespinoso', zona: 'espalda_media' },
  redondo_menor: { grupo: 'espalda', musculo: 'Manguito rotador', nombre: 'Redondo menor', corto: 'Redondo menor', zona: 'espalda_media' },
  supraespinoso: { grupo: 'espalda', musculo: 'Manguito rotador', nombre: 'Supraespinoso', corto: 'Supraespinoso', profundo: true, zona: 'trapecio' },
  subescapular: { grupo: 'espalda', musculo: 'Manguito rotador', nombre: 'Subescapular', corto: 'Subescapular', profundo: true, zona: 'espalda_media' },
  erectores_espinales: { grupo: 'espalda', nombre: 'Erectores espinales (lumbares)', corto: 'Lumbares', zona: 'lumbares' },

  biceps: { grupo: 'brazos', nombre: 'Bíceps', corto: 'Bíceps', zona: 'biceps' },
  braquial: { grupo: 'brazos', nombre: 'Braquial', corto: 'Braquial', zona: 'braquial' },
  braquiorradial: { grupo: 'brazos', nombre: 'Braquiorradial', corto: 'Braquiorradial', zona: 'antebrazos' },
  triceps_larga: { grupo: 'brazos', musculo: 'Tríceps', nombre: 'Tríceps, cabeza larga', corto: 'Tríceps (larga)', zona: 'triceps' },
  triceps_lateral: { grupo: 'brazos', musculo: 'Tríceps', nombre: 'Tríceps, cabeza lateral', corto: 'Tríceps (lateral)', zona: 'triceps' },
  triceps_medial: { grupo: 'brazos', musculo: 'Tríceps', nombre: 'Tríceps, cabeza medial', corto: 'Tríceps (medial)', zona: 'triceps' },
  flexores_antebrazo: { grupo: 'brazos', musculo: 'Antebrazo', nombre: 'Flexores del antebrazo', corto: 'Flexores del antebrazo', zona: 'antebrazos' },
  extensores_antebrazo: { grupo: 'brazos', musculo: 'Antebrazo', nombre: 'Extensores del antebrazo', corto: 'Extensores del antebrazo', zona: 'antebrazos' },

  recto_abdominal: { grupo: 'core', nombre: 'Recto abdominal', corto: 'Abdominales', zona: 'abdomen' },
  oblicuos: { grupo: 'core', nombre: 'Oblicuos', corto: 'Oblicuos', zona: 'oblicuos' },

  gluteo_mayor: { grupo: 'cadera', musculo: 'Glúteos', nombre: 'Glúteo mayor', corto: 'Glúteo mayor', zona: 'gluteo_mayor' },
  gluteo_medio: { grupo: 'cadera', musculo: 'Glúteos', nombre: 'Glúteo medio', corto: 'Glúteo medio', zona: 'gluteo_medio' },
  gluteo_menor: { grupo: 'cadera', musculo: 'Glúteos', nombre: 'Glúteo menor', corto: 'Glúteo menor', profundo: true, zona: 'gluteo_medio' },
  tensor_fascia_lata: { grupo: 'cadera', nombre: 'Tensor de la fascia lata', corto: 'Tensor fascia lata', zona: 'gluteo_medio' },
  psoas_iliaco: { grupo: 'cadera', nombre: 'Psoas-ilíaco (flexores de cadera)', corto: 'Psoas-ilíaco', profundo: true, zona: 'cuadriceps' },

  recto_femoral: { grupo: 'piernas', musculo: 'Cuádriceps', nombre: 'Cuádriceps, recto femoral', corto: 'Recto femoral', zona: 'cuadriceps' },
  vasto_lateral: { grupo: 'piernas', musculo: 'Cuádriceps', nombre: 'Cuádriceps, vasto lateral', corto: 'Vasto lateral', zona: 'cuadriceps' },
  vasto_medial: { grupo: 'piernas', musculo: 'Cuádriceps', nombre: 'Cuádriceps, vasto medial', corto: 'Vasto medial', zona: 'cuadriceps' },
  sartorio: { grupo: 'piernas', nombre: 'Sartorio', corto: 'Sartorio', zona: 'cuadriceps' },
  aductores: { grupo: 'piernas', nombre: 'Aductores', corto: 'Aductores', zona: 'aductores' },
  biceps_femoral: { grupo: 'piernas', musculo: 'Isquiotibiales', nombre: 'Isquiotibiales, bíceps femoral', corto: 'Bíceps femoral', zona: 'isquiotibiales' },
  semitendinoso: { grupo: 'piernas', musculo: 'Isquiotibiales', nombre: 'Isquiotibiales, semitendinoso', corto: 'Semitendinoso', zona: 'isquiotibiales' },
  semimembranoso: { grupo: 'piernas', musculo: 'Isquiotibiales', nombre: 'Isquiotibiales, semimembranoso', corto: 'Semimembranoso', zona: 'isquiotibiales' },
  gemelo_medial: { grupo: 'piernas', musculo: 'Gemelos', nombre: 'Gemelo medial', corto: 'Gemelo medial', zona: 'gemelos' },
  gemelo_lateral: { grupo: 'piernas', musculo: 'Gemelos', nombre: 'Gemelo lateral', corto: 'Gemelo lateral', zona: 'gemelos' },
  soleo: { grupo: 'piernas', nombre: 'Sóleo', corto: 'Sóleo', zona: 'soleo' },
  tibial_anterior: { grupo: 'piernas', nombre: 'Tibial anterior', corto: 'Tibial anterior', zona: 'soleo' },
  peroneos: { grupo: 'piernas', nombre: 'Peroneos', corto: 'Peroneos', zona: 'soleo' },
}

export const grupoDe = (m: Musculo): Grupo => INFO_MUSCULO[m].grupo
export const zonaDe = (m: Musculo): Zona => INFO_MUSCULO[m].zona
export const esProfundo = (m: Musculo): boolean => INFO_MUSCULO[m].profundo === true

/** Músculos profundos, en orden: su índice + 1 es la marca de la piel que tienen encima en el modelo. */
export const PROFUNDOS: readonly Musculo[] = MUSCULOS.filter(esProfundo)

/** Músculos de cada grupo, en el orden de MUSCULOS. */
export const MUSCULOS_DE_GRUPO: Record<Grupo, Musculo[]> = Object.fromEntries(GRUPOS.map((g) => [g, MUSCULOS.filter((m) => INFO_MUSCULO[m].grupo === g)])) as Record<Grupo, Musculo[]>

/** Los que comparten músculo (las otras porciones o cabezas), sin él. */
export function hermanos(m: Musculo): Musculo[] {
  const padre = INFO_MUSCULO[m].musculo
  return padre ? MUSCULOS.filter((x) => x !== m && INFO_MUSCULO[x].musculo === padre) : []
}

/** Niveles por zona 2D: cada zona toma el nivel más alto de sus músculos. */
export function nivelesPorZona(niveles: ReadonlyMap<Musculo, number>): Map<Zona, number> {
  const r = new Map<Zona, number>()
  for (const [m, n] of niveles) {
    const z = zonaDe(m)
    r.set(z, Math.max(r.get(z) ?? 0, n))
  }
  return r
}

// ── Músculos profundos ──────────────────────────────────────────────────────────────────────

/**
 * Qué músculos de la superficie tiene encima cada músculo profundo (los que se vuelven translúcidos
 * al resaltarlo). Tiene que coincidir con la piel marcada en el modelo (ver el test de cuerpo3d).
 */
export const ENCIMA_DE: Partial<Record<Musculo, readonly Musculo[]>> = {
  supraespinoso: ['trapecio_medio', 'deltoides_lateral'],
  subescapular: ['infraespinoso', 'redondo_mayor', 'redondo_menor', 'trapecio_inferior'],
  gluteo_menor: ['gluteo_medio', 'gluteo_mayor', 'tensor_fascia_lata'],
  psoas_iliaco: ['recto_abdominal', 'oblicuos', 'sartorio'],
}

/** Músculos profundos que hay debajo de uno de la superficie. */
export const debajoDe = (m: Musculo): Musculo[] => PROFUNDOS.filter((p) => ENCIMA_DE[p]?.includes(m))

/** Hacia dónde girar el cuerpo para ver cada músculo profundo (0 = de frente, π = de espaldas). */
export const ANGULO_PROFUNDO: Partial<Record<Musculo, number>> = {
  supraespinoso: Math.PI,
  subescapular: Math.PI,
  gluteo_menor: Math.PI * 0.72,
  psoas_iliaco: 0,
}

// ── Nombres ─────────────────────────────────────────────────────────────────────────────────

/**
 * Nombres para enseñar una lista de músculos: si están todas las porciones de un músculo, se dice
 * el músculo («Tríceps», «Cuádriceps»); si no, cada porción.
 */
export function nombresDeMusculos(lista: readonly Musculo[]): string[] {
  const presentes = new Set(lista)
  const dichos = new Set<string>()
  const r: string[] = []
  for (const m of lista) {
    const padre = INFO_MUSCULO[m].musculo
    if (padre && [m, ...hermanos(m)].every((x) => presentes.has(x))) {
      if (!dichos.has(padre)) r.push(padre)
      dichos.add(padre)
    } else r.push(INFO_MUSCULO[m].corto)
  }
  return r
}

/** «Piernas › Cuádriceps» (o solo el grupo si el músculo no tiene porciones). */
export const rutaDe = (m: Musculo): string => [NOMBRE_GRUPO[INFO_MUSCULO[m].grupo], INFO_MUSCULO[m].musculo].filter(Boolean).join(' › ')
