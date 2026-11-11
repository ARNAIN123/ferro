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

/**
 * Qué regiones del avatar 2D representan cada músculo (el mapa sin WebGL). Las porciones que el dibujo
 * no separa comparten región; los profundos se pintan en la región que tienen encima.
 */
export const REGIONES_AVATAR: Record<Musculo, RegionAvatar[]> = {
  esternocleidomastoideo: ['esternocleidomastoideo'],
  esplenio: ['esternocleidomastoideo'],
  deltoides_anterior: ['deltoides_anterior'],
  deltoides_lateral: ['deltoides_lateral'],
  deltoides_posterior: ['deltoides_posterior'],
  pectoral_clavicular: ['pectoral_superior'],
  pectoral_esternal: ['pectoral_inferior'],
  pectoral_costal: ['pectoral_inferior'],
  serrato_anterior: ['serrato'],
  trapecio_superior: ['trapecio_superior'],
  trapecio_medio: ['trapecio_medio'],
  trapecio_inferior: ['trapecio_medio'],
  romboides: ['trapecio_medio'],
  dorsal_ancho: ['dorsal_ancho'],
  redondo_mayor: ['manguito_posterior'],
  infraespinoso: ['manguito_posterior'],
  redondo_menor: ['manguito_posterior'],
  supraespinoso: ['trapecio_superior'],
  subescapular: ['manguito_posterior'],
  erectores_espinales: ['lumbares'],
  biceps: ['biceps'],
  braquial: ['braquial'],
  braquiorradial: ['antebrazo_extensores'],
  triceps_larga: ['triceps'],
  triceps_lateral: ['triceps'],
  triceps_medial: ['triceps'],
  flexores_antebrazo: ['antebrazo_flexores'],
  extensores_antebrazo: ['antebrazo_extensores'],
  recto_abdominal: ['recto_abdominal'],
  oblicuos: ['oblicuos'],
  gluteo_mayor: ['gluteo_mayor'],
  gluteo_medio: ['gluteo_medio'],
  gluteo_menor: ['gluteo_medio'],
  tensor_fascia_lata: ['tensor_fascia'],
  psoas_iliaco: ['psoas'],
  recto_femoral: ['recto_femoral'],
  vasto_lateral: ['vasto_lateral'],
  vasto_medial: ['vasto_medial'],
  sartorio: ['sartorio'],
  aductores: ['aductores'],
  biceps_femoral: ['biceps_femoral'],
  semitendinoso: ['isquios_mediales'],
  semimembranoso: ['isquios_mediales'],
  gemelo_medial: ['gemelo'],
  gemelo_lateral: ['gemelo'],
  soleo: ['soleo'],
  tibial_anterior: ['tibial'],
  peroneos: ['peroneos'],
}

// Al tocar una región compartida se elige el primer músculo que la usa (el más superficial).
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
