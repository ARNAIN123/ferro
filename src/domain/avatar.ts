// Avatar muscular: qué regiones del dibujo pinta cada músculo de la base de datos, y niveles de la semana.
import type { Musculo } from './tipos'

/** Regiones del avatar (ver scripts/generar-avatar.mjs). */
export type RegionAvatar =
  | 'esternocleidomastoideo'
  | 'trapecio_superior'
  | 'trapecio_medio'
  | 'deltoides_anterior'
  | 'deltoides_lateral'
  | 'deltoides_posterior'
  | 'manguito_posterior'
  | 'pectoral_superior'
  | 'pectoral_inferior'
  | 'serrato'
  | 'biceps'
  | 'braquial'
  | 'triceps'
  | 'antebrazo_flexores'
  | 'antebrazo_extensores'
  | 'dorsal_ancho'
  | 'lumbares'
  | 'recto_abdominal'
  | 'oblicuos'
  | 'gluteo_mayor'
  | 'gluteo_medio'
  | 'tensor_fascia'
  | 'cintilla_iliotibial'
  | 'psoas'
  | 'sartorio'
  | 'aductores'
  | 'recto_femoral'
  | 'vasto_lateral'
  | 'vasto_medial'
  | 'biceps_femoral'
  | 'isquios_mediales'
  | 'gemelo'
  | 'soleo'
  | 'tibial'
  | 'peroneos'
  | 'rotula'
  | 'tendon_rotuliano'
  | 'popliteo'
  | 'aquiles'

/** Tendones y zonas que no son músculos: se dibujan, pero nunca se colorean ni se tocan. */
export const NO_MUSCULO: ReadonlySet<RegionAvatar> = new Set(['rotula', 'tendon_rotuliano', 'popliteo', 'aquiles'])

/** Qué regiones del avatar 2D (el mapa sin WebGL) pinta cada grupo muscular. */
export const REGIONES_AVATAR: Record<Musculo, RegionAvatar[]> = {
  cuello: ['esternocleidomastoideo'],
  trapecio: ['trapecio_superior'],
  hombros: ['deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior'],
  pecho: ['pectoral_superior', 'pectoral_inferior', 'serrato'],
  biceps: ['biceps', 'braquial'],
  triceps: ['triceps'],
  antebrazos: ['antebrazo_flexores', 'antebrazo_extensores'],
  espalda_alta: ['trapecio_medio', 'manguito_posterior'],
  dorsales: ['dorsal_ancho'],
  lumbares: ['lumbares'],
  abdominales: ['recto_abdominal', 'psoas'],
  oblicuos: ['oblicuos'],
  gluteos: ['gluteo_mayor'],
  abductores: ['gluteo_medio', 'tensor_fascia'],
  aductores: ['aductores'],
  cuadriceps: ['recto_femoral', 'vasto_lateral', 'vasto_medial', 'sartorio'],
  isquiotibiales: ['biceps_femoral', 'isquios_mediales'],
  gemelos: ['gemelo', 'soleo', 'tibial', 'peroneos'],
}

// Cada región del dibujo es de un solo grupo.
const MUSCULO_DE_REGION = new Map<RegionAvatar, Musculo>()
for (const [m, rs] of Object.entries(REGIONES_AVATAR) as [Musculo, RegionAvatar[]][]) for (const r of rs) if (!MUSCULO_DE_REGION.has(r)) MUSCULO_DE_REGION.set(r, m)

/** Músculo que representa una región (null si no corresponde a ninguno). */
export const musculoDeRegionAvatar = (r: RegionAvatar): Musculo | null => MUSCULO_DE_REGION.get(r) ?? null

/** Nivel de cada región a partir del nivel de cada músculo. */
export function nivelesPorRegionAvatar(niveles: ReadonlyMap<Musculo, number>): Map<RegionAvatar, number> {
  const r = new Map<RegionAvatar, number>()
  for (const [m, n] of niveles) for (const region of REGIONES_AVATAR[m]) r.set(region, Math.max(r.get(region) ?? 0, n))
  return r
}

/** Niveles fijos del avatar de la semana: 1–3, 4–6, 7–10, 11–15 y 16 o más series. */
export const ESCALA_SEMANA_AVATAR = [4, 7, 11, 16] as const
