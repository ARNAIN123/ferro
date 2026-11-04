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

/** Qué regiones del avatar representan cada músculo de la base de datos. */
export const REGIONES_AVATAR: Record<Musculo, RegionAvatar[]> = {
  pecho: ['pectoral_superior', 'pectoral_inferior'],
  hombros: ['deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior'],
  biceps: ['biceps', 'braquial'],
  triceps: ['triceps'],
  antebrazos: ['antebrazo_flexores', 'antebrazo_extensores'],
  trapecio: ['trapecio_superior'],
  espalda_media: ['trapecio_medio', 'manguito_posterior'],
  dorsales: ['dorsal_ancho'],
  lumbares: ['lumbares'],
  abdomen: ['recto_abdominal', 'oblicuos'],
  gluteos: ['gluteo_mayor', 'gluteo_medio'],
  abductores: ['tensor_fascia', 'cintilla_iliotibial'],
  aductores: ['aductores'],
  cuadriceps: ['recto_femoral', 'vasto_lateral', 'vasto_medial'],
  isquiotibiales: ['biceps_femoral', 'isquios_mediales'],
  gemelos: ['gemelo', 'soleo'],
  cuello: ['esternocleidomastoideo'],
}

const MUSCULO_DE_REGION = new Map<RegionAvatar, Musculo>(
  (Object.entries(REGIONES_AVATAR) as [Musculo, RegionAvatar[]][]).flatMap(([m, rs]) => rs.map((r) => [r, m] as const)),
)

/** Músculo de la base de datos que representa una región (null si no corresponde a ninguno). */
export const musculoDeRegionAvatar = (r: RegionAvatar): Musculo | null => MUSCULO_DE_REGION.get(r) ?? null

/** Nivel de cada región a partir del nivel de cada músculo. */
export function nivelesPorRegionAvatar(niveles: ReadonlyMap<Musculo, number>): Map<RegionAvatar, number> {
  const r = new Map<RegionAvatar, number>()
  for (const [m, n] of niveles) for (const region of REGIONES_AVATAR[m]) r.set(region, Math.max(r.get(region) ?? 0, n))
  return r
}

/** Niveles fijos del avatar de la semana: 1–3, 4–6, 7–10, 11–15 y 16 o más series. */
export const ESCALA_SEMANA_AVATAR = [4, 7, 11, 16] as const
