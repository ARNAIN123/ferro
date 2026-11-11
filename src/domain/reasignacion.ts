// Ronda 4: de los músculos de antes (las 23 zonas, o nombres aún más antiguos) a la división completa.
// Cada patrón de movimiento (el mismo que elige la animación: remo, jalón, press, curl…) tiene sus
// músculos, con ajustes por el nombre (martillo, inverso, inclinado, declinado, sumo…). Si no hay
// regla, cada zona pasa a sus músculos. Lo usan la biblioteca (una vez, para generar el catálogo),
// la migración de los ejercicios propios y retirados, y la importación de copias antiguas.
import { asignarAnimacion } from '../animacion/asignacion'
import { MUSCULOS, ZONAS, type Material, type Musculo, type Zona } from './tipos'

/** Nombres anteriores a la ronda 2 → zonas. */
const ANTIGUOS: Record<string, Zona[]> = {
  espalda: ['dorsales'],
  pecho: ['pectoral_inferior', 'pectoral_superior'],
  hombros: ['deltoides_anterior', 'deltoides_lateral'],
  gluteos: ['gluteo_mayor'],
  abductores: ['gluteo_medio'],
}

const CUADRICEPS: Musculo[] = ['recto_femoral', 'vasto_lateral', 'vasto_medial']
const ISQUIOS: Musculo[] = ['biceps_femoral', 'semitendinoso', 'semimembranoso']
const TRICEPS: Musculo[] = ['triceps_larga', 'triceps_lateral', 'triceps_medial']
const GEMELOS: Musculo[] = ['gemelo_medial', 'gemelo_lateral']

/** Cada zona, a sus músculos (cuando no hay una regla más fina). */
const DE_ZONA: Record<Zona, Musculo[]> = {
  pectoral_superior: ['pectoral_clavicular'],
  pectoral_inferior: ['pectoral_esternal'],
  deltoides_anterior: ['deltoides_anterior'],
  deltoides_lateral: ['deltoides_lateral'],
  deltoides_posterior: ['deltoides_posterior'],
  biceps: ['biceps'],
  braquial: ['braquial'],
  triceps: TRICEPS,
  antebrazos: ['flexores_antebrazo'],
  trapecio: ['trapecio_superior'],
  espalda_media: ['romboides', 'trapecio_medio'],
  dorsales: ['dorsal_ancho'],
  lumbares: ['erectores_espinales'],
  abdomen: ['recto_abdominal'],
  oblicuos: ['oblicuos'],
  gluteo_mayor: ['gluteo_mayor'],
  gluteo_medio: ['gluteo_medio'],
  cuadriceps: CUADRICEPS,
  isquiotibiales: ISQUIOS,
  aductores: ['aductores'],
  gemelos: GEMELOS,
  soleo: ['soleo'],
  cuello: ['esternocleidomastoideo'],
}

const esMusculo = (m: string): m is Musculo => (MUSCULOS as readonly string[]).includes(m)
const esZona = (m: string): m is Zona => (ZONAS as readonly string[]).includes(m)

/** Zonas de una lista de músculos antiguos (los nombres actuales que ya son músculos se ignoran). */
export function zonasDe(lista: readonly string[]): Zona[] {
  return [...new Set(lista.flatMap((m) => ANTIGUOS[m] ?? (esZona(m) ? [m] : [])))]
}

/** ¿Es una lista de la ronda 4? (todos los nombres son músculos y alguno no es también una zona). */
export const esListaNueva = (lista: readonly string[]): boolean => lista.length > 0 && lista.every(esMusculo) && lista.some((m) => !esZona(m))

const expandir = (zonas: readonly Zona[]): Musculo[] => [...new Set(zonas.flatMap((z) => DE_ZONA[z]))]

const texto = (s: string) =>
  s
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export interface Antiguo {
  id?: string
  nombre: string
  material: Material
  musculosPrincipales: readonly string[]
  musculosSecundarios: readonly string[]
}

export interface MusculosFinos {
  principales: Musculo[]
  secundarios: Musculo[]
}

/**
 * Músculos de la ronda 4 de un ejercicio con músculos de antes. Si ya está al día, lo devuelve igual
 * (es idempotente).
 */
export function musculosFinos(e: Antiguo): MusculosFinos {
  if (esListaNueva([...e.musculosPrincipales, ...e.musculosSecundarios]) || (e.musculosPrincipales.length === 0 && e.musculosSecundarios.length === 0))
    return limpiar(e.musculosPrincipales.filter(esMusculo), e.musculosSecundarios.filter(esMusculo))
  const zp = zonasDe(e.musculosPrincipales)
  const zs = zonasDe(e.musculosSecundarios).filter((z) => !zp.includes(z))
  const base = { p: expandir(zp), s: expandir(zs) }
  let patron = ''
  try {
    patron = asignarAnimacion({ id: e.id ?? '', nombre: e.nombre, material: e.material, musculosPrincipales: base.p.length ? base.p : ['pectoral_esternal'] }).animacion.patron
  } catch {
    // Sin patrón: se queda con las zonas.
  }
  const r = reglas(patron, texto(`${e.nombre} ${e.id ?? ''}`), e.material, base, zp, zs)
  return limpiar(r.p, r.s)
}

/** Sin repetidos y sin secundarios que ya son principales. */
function limpiar(p: readonly Musculo[], s: readonly Musculo[]): MusculosFinos {
  const principales = [...new Set(p)]
  return { principales, secundarios: [...new Set(s)].filter((m) => !principales.includes(m)) }
}

type Lista = { p: Musculo[]; s: Musculo[] }

/** Músculos de cada patrón. `zp`/`zs`: zonas principales y secundarias de antes. */
function reglas(patron: string, t: string, material: Material, base: Lista, zp: readonly Zona[], zs: readonly Zona[]): Lista {
  const tiene = (z: Zona) => zp.includes(z) || zs.includes(z)
  const enP = (z: Zona) => zp.includes(z)
  const con = (p: Musculo[], s: Musculo[]): Lista => ({ p, s })
  /** Lo de antes que la regla no cubre (p. ej., los estabilizadores que tenía apuntados). */
  const resto = (l: Lista, ...zonas: Zona[]): Lista => ({ p: l.p, s: [...l.s, ...expandir(zs.filter((z) => zonas.includes(z)))] })

  // ── Pecho ──
  if (patron === 'press declinado') return con(['pectoral_esternal', 'pectoral_costal'], ['deltoides_anterior', ...TRICEPS])
  if (patron === 'press inclinado' || (patron === 'press en polea' && /inclin/.test(t))) return con(['pectoral_clavicular'], ['pectoral_esternal', 'deltoides_anterior', ...TRICEPS])
  if (patron === 'press banco' || patron === 'press suelo' || patron === 'press en polea' || patron === 'press Svend') {
    if (enP('triceps')) return con([...TRICEPS], ['pectoral_esternal', 'deltoides_anterior', ...(/invertido|reverse/.test(t) ? (['pectoral_clavicular'] as Musculo[]) : [])])
    if (patron === 'press Svend') return con(['pectoral_esternal'], ['pectoral_clavicular', 'deltoides_anterior'])
    if (/cuello|guillotin/.test(t)) return con(['pectoral_clavicular', 'pectoral_esternal'], ['deltoides_anterior', ...TRICEPS])
    return con(['pectoral_esternal'], ['pectoral_clavicular', 'pectoral_costal', 'deltoides_anterior', ...TRICEPS])
  }
  if (patron === 'aperturas en banco') {
    if (/inclin/.test(t)) return con(['pectoral_clavicular'], ['pectoral_esternal', 'deltoides_anterior'])
    if (/declin/.test(t)) return con(['pectoral_esternal', 'pectoral_costal'], ['deltoides_anterior'])
    return con(['pectoral_esternal'], ['pectoral_clavicular', 'pectoral_costal', 'deltoides_anterior'])
  }
  if (patron === 'cruce de poleas') return con(['pectoral_esternal', 'pectoral_costal'], ['pectoral_clavicular', 'deltoides_anterior'])
  if (patron === 'cruce de poleas desde abajo') return con(['pectoral_clavicular'], ['pectoral_esternal', 'deltoides_anterior'])
  if (patron === 'vueltas al mundo') return con(['pectoral_esternal'], ['pectoral_clavicular', 'deltoides_anterior', 'serrato_anterior'])
  if (patron === 'pullover')
    return con(['dorsal_ancho', 'pectoral_esternal'], ['redondo_mayor', 'triceps_larga', 'serrato_anterior', 'pectoral_costal', ...(/elevacion frontal|front raise/.test(t) ? (['deltoides_anterior'] as Musculo[]) : [])])
  if (patron === 'protracción de hombros') return con(['serrato_anterior'], ['pectoral_clavicular', 'deltoides_anterior'])

  // ── Hombros ──
  if (patron === 'press de_pie' || patron === 'press sentado') {
    if (/cubano|cuban/.test(t)) return con(['deltoides_anterior', 'infraespinoso', 'redondo_menor'], ['deltoides_lateral', 'deltoides_posterior', 'trapecio_superior', 'supraespinoso'])
    const p: Musculo[] = enP('deltoides_lateral') ? ['deltoides_anterior', 'deltoides_lateral'] : ['deltoides_anterior']
    const s: Musculo[] = ['deltoides_lateral', ...TRICEPS, 'trapecio_superior', 'serrato_anterior', 'pectoral_clavicular']
    if (/balancin|see saw/.test(t)) s.push('oblicuos')
    if (/antigravedad|anti gravity/.test(t)) s.push('trapecio_medio', 'trapecio_inferior')
    return con(p, s)
  }
  if (patron === 'push press') return con(['deltoides_anterior'], ['deltoides_lateral', ...TRICEPS, 'trapecio_superior', 'serrato_anterior', ...CUADRICEPS, 'gluteo_mayor'])
  if (patron === 'press landmine' || patron === 'jammer')
    return resto(con(['deltoides_anterior', 'pectoral_clavicular'], ['deltoides_lateral', ...TRICEPS, 'serrato_anterior']), 'oblicuos', 'abdomen', 'cuadriceps', 'gemelos', 'isquiotibiales')
  if (patron === 'elevación lateral') return resto(con(enP('deltoides_anterior') ? ['deltoides_lateral', 'deltoides_anterior'] : ['deltoides_lateral'], ['supraespinoso', 'trapecio_superior']), 'espalda_media', 'pectoral_inferior', 'gluteo_mayor', 'isquiotibiales', 'lumbares', 'cuadriceps')
  if (patron === 'elevación en Y') return con(['deltoides_lateral', 'deltoides_anterior'], ['supraespinoso', 'trapecio_inferior', 'trapecio_medio', 'serrato_anterior'])
  if (patron === 'elevación frontal') {
    const p: Musculo[] = enP('deltoides_lateral') ? ['deltoides_anterior', 'deltoides_lateral'] : ['deltoides_anterior']
    return resto(con(p, ['pectoral_clavicular', 'deltoides_lateral', 'serrato_anterior']), 'trapecio', 'biceps', 'antebrazos')
  }
  if (patron === 'pájaros') {
    const rotacion = /rotacion|rotation/.test(t)
    return resto(con(rotacion ? ['deltoides_posterior', 'infraespinoso', 'redondo_menor'] : ['deltoides_posterior'], ['infraespinoso', 'redondo_menor', 'romboides', 'trapecio_medio']), 'lumbares', 'trapecio')
  }
  if (patron === 'face pull') return resto(con(['deltoides_posterior', 'infraespinoso', 'redondo_menor'], ['romboides', 'trapecio_medio', 'trapecio_inferior']), 'biceps')
  if (patron === 'rotación externa') return con(['infraespinoso', 'redondo_menor'], ['deltoides_posterior', 'supraespinoso'])
  if (patron === 'rotación interna') return con(['subescapular'], ['pectoral_esternal', 'dorsal_ancho', 'redondo_mayor', 'deltoides_anterior'])
  if (patron === 'remo al mentón') return con(['deltoides_lateral', 'trapecio_superior'], ['deltoides_anterior', 'supraespinoso', 'biceps', 'braquial'])
  if (patron === 'volantes con disco') return con(['deltoides_anterior'], ['deltoides_lateral', 'flexores_antebrazo', 'oblicuos'])

  // ── Espalda ──
  if (patron.startsWith('remo') && patron !== 'remo al mentón') {
    if (/deltoides posterior|rear delt/.test(t)) return con(['deltoides_posterior', 'romboides', 'trapecio_medio'], ['infraespinoso', 'redondo_menor', 'dorsal_ancho', 'biceps'])
    if (/al cuello|to neck/.test(t)) return con(['deltoides_posterior', 'trapecio_medio', 'romboides'], ['trapecio_superior', 'infraespinoso', 'biceps'])
    if (patron === 'remo en polea alta') return con(['dorsal_ancho', 'redondo_mayor'], ['romboides', 'trapecio_medio', 'trapecio_inferior', 'biceps', 'braquial'])
    const s: Musculo[] = ['redondo_mayor', 'deltoides_posterior', 'biceps', 'braquial']
    if (patron === 'remo inclinado' || patron === 'remo Pendlay') s.push('erectores_espinales')
    return con(['dorsal_ancho', 'romboides', 'trapecio_medio'], s)
  }
  if (patron === 'jalón') return con(['dorsal_ancho', 'redondo_mayor'], ['biceps', 'braquial', 'romboides', 'trapecio_inferior', 'deltoides_posterior', ...(/nuca|behind/.test(t) ? (['trapecio_medio'] as Musculo[]) : [])])
  if (patron === 'jalón con brazos rectos') return con(['dorsal_ancho', 'redondo_mayor'], ['triceps_larga', 'deltoides_posterior', 'pectoral_costal'])
  if (patron === 'encogimientos') return con(['trapecio_superior'], ['flexores_antebrazo', ...(/detras|behind/.test(t) ? (['trapecio_medio'] as Musculo[]) : [])])
  if (patron === 'halterofilia: encogimiento') return con(['trapecio_superior'], ['flexores_antebrazo', 'deltoides_posterior', ...GEMELOS])
  if (patron === 'retracción escapular') return con(['romboides', 'trapecio_medio'], ['trapecio_inferior'])

  // ── Bisagras de cadera ──
  if (patron === 'peso muerto') {
    if (material === 'barra_hexagonal') return con([...CUADRICEPS, 'gluteo_mayor'], [...ISQUIOS, 'erectores_espinales', 'trapecio_superior', 'flexores_antebrazo'])
    if (/sumo/.test(t)) return con(['gluteo_mayor', 'aductores', 'vasto_lateral', 'vasto_medial'], [...ISQUIOS, 'erectores_espinales', 'trapecio_superior', 'flexores_antebrazo'])
    if (enP('cuadriceps')) return con([...CUADRICEPS, 'gluteo_mayor'], [...ISQUIOS, 'erectores_espinales', 'flexores_antebrazo', ...(/lateral|side/.test(t) ? (['oblicuos'] as Musculo[]) : [])])
    return con(['gluteo_mayor', ...ISQUIOS, 'erectores_espinales'], ['vasto_lateral', 'vasto_medial', 'aductores', 'trapecio_superior', 'dorsal_ancho', 'flexores_antebrazo'])
  }
  if (patron === 'rack pull') return con(['erectores_espinales', 'gluteo_mayor', 'trapecio_superior'], [...ISQUIOS, 'dorsal_ancho', 'flexores_antebrazo'])
  if (patron === 'peso muerto rumano') return con([...ISQUIOS, 'gluteo_mayor'], ['erectores_espinales', 'aductores', 'flexores_antebrazo'])
  if (patron === 'peso muerto a una pierna') return con([...ISQUIOS, 'gluteo_mayor'], ['gluteo_medio', 'erectores_espinales', 'aductores'])
  if (patron === 'buenos días') {
    if (/sentado|seated/.test(t)) return con(['erectores_espinales'], ['gluteo_mayor'])
    return con([...ISQUIOS, 'erectores_espinales'], ['gluteo_mayor', 'aductores'])
  }
  if (patron === 'pull through') return con(['gluteo_mayor'], [...ISQUIOS, 'erectores_espinales'])

  // ── Brazos ──
  if (patron.startsWith('curl ') && patron !== 'curl femoral') {
    if (/zottman/.test(t)) return con(['biceps', 'braquial', 'braquiorradial'], ['flexores_antebrazo', 'extensores_antebrazo'])
    if (/martillo|hammer/.test(t)) return con(['braquial', 'braquiorradial'], ['biceps', 'flexores_antebrazo'])
    if (/inverso|reverse/.test(t)) return con(['braquiorradial', 'braquial'], ['biceps', 'extensores_antebrazo'])
    return con(['biceps'], ['braquial', 'braquiorradial', 'flexores_antebrazo'])
  }
  if (patron.startsWith('extensión ')) {
    const encima = /sobre_cabeza|polea_espalda/.test(patron) || /sobre la cabeza|por encima|overhead/.test(t)
    const p: Musculo[] = encima ? ['triceps_larga', 'triceps_lateral', 'triceps_medial'] : patron === 'extensión polea_alta' ? ['triceps_lateral', 'triceps_medial', 'triceps_larga'] : [...TRICEPS]
    return con(p, /rompecraneos|skull crusher/.test(t) || (patron === 'extensión declinado' && tiene('pectoral_inferior')) ? ['pectoral_esternal', 'deltoides_anterior'] : [])
  }
  if (patron === 'muñeca') {
    if (/pronacion|pronation/.test(t)) return con(['flexores_antebrazo'], ['braquiorradial'])
    if (/supinacion|supination/.test(t)) return con(['extensores_antebrazo'], ['biceps', 'braquiorradial'])
    if (/rotacion|rotation/.test(t)) return con(['flexores_antebrazo', 'extensores_antebrazo'], ['braquiorradial'])
    if (/prono|palms down/.test(t)) return con(['extensores_antebrazo'], [])
    return con(['flexores_antebrazo'], [])
  }
  if (patron === 'paseo del granjero') return con(['flexores_antebrazo', 'trapecio_superior'], ['oblicuos', 'recto_abdominal', 'gluteo_medio', 'gluteo_mayor', ...CUADRICEPS])

  // ── Core ──
  if (patron === 'crunch' || patron === 'crunch en polea') return /oblicu|oblique/.test(t) ? con(['oblicuos', 'recto_abdominal'], []) : con(['recto_abdominal'], ['oblicuos'])
  if (patron === 'crunch inverso') return con(['recto_abdominal'], ['psoas_iliaco', 'oblicuos'])
  if (patron === 'abdominal con press') return con(['recto_abdominal'], ['psoas_iliaco', 'deltoides_anterior', ...TRICEPS, 'pectoral_esternal'])
  if (patron === 'rodillo abdominal') return resto(con(['recto_abdominal'], ['oblicuos', 'dorsal_ancho', 'psoas_iliaco', 'serrato_anterior']), 'lumbares', 'deltoides_anterior', 'gluteo_mayor', 'isquiotibiales')
  if (patron === 'press Pallof') return con(['oblicuos'], ['recto_abdominal'])
  if (patron === 'giros rusos' || patron === 'leñador' || patron === 'landmine 180' || patron === 'inclinación lateral')
    return resto(con(enP('abdomen') ? ['oblicuos', 'recto_abdominal'] : ['oblicuos'], ['recto_abdominal']), 'gluteo_mayor', 'deltoides_anterior', 'lumbares')

  // ── Cadera y piernas ──
  if (patron === 'hip thrust' || patron === 'puente de glúteo') return con(['gluteo_mayor'], [...ISQUIOS, 'gluteo_medio', 'aductores'])
  if (patron === 'patada de glúteo') return con(['gluteo_mayor'], [...ISQUIOS, 'gluteo_medio'])
  if (patron === 'abducción de cadera') return con(['gluteo_medio', 'gluteo_menor'], ['tensor_fascia_lata', 'gluteo_mayor'])
  if (patron === 'aducción de cadera') return con(['aductores'], [])
  if (patron === 'curl femoral') return con([...ISQUIOS], [...GEMELOS])
  if (patron === 'elevación de gemelos') return con([...GEMELOS], ['soleo'])
  if (patron === 'gemelos sentado') return con(['soleo'], [...GEMELOS])
  if (patron === 'sentadilla sissy') return con([...CUADRICEPS], [])
  if (patron === 'sentadilla de rodillas') return con(['gluteo_mayor'], [...ISQUIOS, 'erectores_espinales', 'recto_abdominal'])
  if (/^(sentadilla|zancada|subida al banco|prensa)/.test(patron)) {
    const sumo = /sumo|plie|wide stance|pies separados/.test(t)
    const unaPierna = /una pierna|bulgara|split|zancada|lunge|subida|step|pistol|lateral/.test(`${patron} ${t}`)
    const p: Musculo[] = [...CUADRICEPS]
    if (enP('gluteo_mayor') || sumo) p.push('gluteo_mayor')
    if (sumo || enP('aductores')) p.push('aductores')
    const s: Musculo[] = ['gluteo_mayor', 'aductores']
    if (unaPierna) s.push('gluteo_medio')
    if (tiene('lumbares')) s.push('erectores_espinales')
    if (tiene('isquiotibiales')) s.push(...ISQUIOS)
    if (tiene('abdomen')) s.push('recto_abdominal')
    if (/overhead/.test(t)) s.push('deltoides_anterior', 'trapecio_superior', ...TRICEPS)
    return con(p, s)
  }

  // ── Cuello ──
  if (patron === 'cuello con disco') return /boca abajo|face down/.test(t) ? con(['esplenio', 'trapecio_superior'], []) : con(['esternocleidomastoideo'], [])

  // ── Halterofilia (triple extensión: cadera, rodilla y tobillo) ──
  if (patron === 'halterofilia: tiron') return con(['gluteo_mayor', ...ISQUIOS, 'erectores_espinales', 'trapecio_superior'], [...CUADRICEPS, ...GEMELOS, 'flexores_antebrazo'])
  if (/^halterofilia: (cargada|arrancada)/.test(patron)) {
    if (/press|jerk|dos tiempos/.test(t))
      return con(['deltoides_anterior', ...CUADRICEPS, 'gluteo_mayor', 'trapecio_superior'], [...ISQUIOS, 'erectores_espinales', 'deltoides_lateral', ...TRICEPS, ...GEMELOS, 'serrato_anterior'])
    const arrancada = patron.includes('arrancada')
    return con(
      ['gluteo_mayor', ...ISQUIOS, ...CUADRICEPS, 'trapecio_superior'],
      ['erectores_espinales', ...GEMELOS, 'deltoides_anterior', 'flexores_antebrazo', ...(arrancada ? (['deltoides_lateral', 'trapecio_medio', ...TRICEPS] as Musculo[]) : (['biceps'] as Musculo[]))],
    )
  }
  if (patron.startsWith('envión')) {
    if (patron === 'envión: flexion' && enP('cuadriceps')) return con([...CUADRICEPS], ['gluteo_mayor', ...GEMELOS, 'recto_abdominal'])
    if (patron === 'envión: flexion') return con(['deltoides_anterior'], ['trapecio_superior', 'flexores_antebrazo'])
    if (patron === 'envión: equilibrio_arrancada') return con([...CUADRICEPS, 'deltoides_lateral'], ['gluteo_mayor', 'deltoides_anterior', 'trapecio_superior', 'trapecio_medio', ...TRICEPS, ...ISQUIOS])
    return con(['deltoides_anterior', ...CUADRICEPS, 'gluteo_mayor'], ['deltoides_lateral', ...TRICEPS, 'trapecio_superior', 'serrato_anterior', ...ISQUIOS, ...GEMELOS])
  }

  // Lo demás: cada zona a sus músculos.
  return base
}
