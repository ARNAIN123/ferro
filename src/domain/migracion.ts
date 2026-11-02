// Migraciones de datos (funciones puras). La base de datos las aplica en sus versiones de Dexie.
import type { Categoria, Ejercicio, Material, Mecanica, Musculo, Nivel } from './tipos'

/**
 * v1 → v2: la biblioteca propia (88 ejercicios) pasa a Free Exercise DB.
 * Cada id antiguo apunta a su equivalente nuevo. Los que no existen en la base
 * (máquinas modernas) se añaden al catálogo conservando su id antiguo.
 */
export const MAPA_IDS_V1: Record<string, string> = {
  'press-banca': 'Barbell_Bench_Press_-_Medium_Grip',
  'press-banca-inclinado': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'press-banca-declinado': 'Decline_Barbell_Bench_Press',
  'press-mancuernas': 'Dumbbell_Bench_Press',
  'press-inclinado-mancuernas': 'Incline_Dumbbell_Press',
  'aperturas-mancuernas': 'Dumbbell_Flyes',
  'press-pecho-maquina': 'Leverage_Chest_Press',
  'press-inclinado-maquina': 'Leverage_Incline_Chest_Press',
  contractora: 'Butterfly',
  'cruce-poleas': 'Cable_Crossover',
  'fondos-paralelas': 'Dips_-_Chest_Version',
  flexiones: 'Pushups',
  dominadas: 'Pullups',
  'dominadas-supinas': 'Chin-Up',
  'dominadas-asistidas': 'dominadas-asistidas',
  'jalon-pecho': 'Wide-Grip_Lat_Pulldown',
  'jalon-estrecho': 'Close-Grip_Front_Lat_Pulldown',
  'remo-barra': 'Bent_Over_Barbell_Row',
  'remo-t': 'T-Bar_Row_with_Handle',
  'remo-mancuerna': 'One-Arm_Dumbbell_Row',
  'remo-polea-baja': 'Seated_Cable_Rows',
  'remo-maquina': 'Leverage_Iso_Row',
  'remo-invertido': 'Inverted_Row',
  'pullover-polea': 'Straight-Arm_Pulldown',
  'peso-muerto': 'Barbell_Deadlift',
  hiperextensiones: 'Hyperextensions_Back_Extensions',
  'press-militar': 'Standing_Military_Press',
  'press-hombro-mancuernas': 'Dumbbell_Shoulder_Press',
  'press-hombro-maquina': 'Leverage_Shoulder_Press',
  'press-arnold': 'Arnold_Dumbbell_Press',
  'elevaciones-laterales': 'Side_Lateral_Raise',
  'elevaciones-laterales-polea': 'Standing_Low-Pulley_Deltoid_Raise',
  'elevaciones-laterales-maquina': 'elevaciones-laterales-maquina',
  'elevaciones-frontales': 'Front_Dumbbell_Raise',
  pajaros: 'Reverse_Flyes',
  'contractora-inversa': 'Reverse_Machine_Flyes',
  'face-pull': 'Face_Pull',
  'encogimientos-barra': 'Barbell_Shrug',
  'encogimientos-mancuernas': 'Dumbbell_Shrug',
  'curl-barra': 'Barbell_Curl',
  'curl-barra-z': 'EZ-Bar_Curl',
  'curl-mancuernas': 'Dumbbell_Bicep_Curl',
  'curl-martillo': 'Hammer_Curls',
  'curl-inclinado': 'Incline_Dumbbell_Curl',
  'curl-concentrado': 'Concentration_Curls',
  'curl-polea': 'Standing_Biceps_Cable_Curl',
  'curl-predicador-maquina': 'Machine_Preacher_Curls',
  'extension-triceps-polea': 'Triceps_Pushdown',
  'extension-triceps-cuerda': 'Triceps_Pushdown_-_Rope_Attachment',
  'extension-triceps-cabeza-polea': 'Cable_Rope_Overhead_Triceps_Extension',
  'extension-triceps-mancuerna': 'Standing_Dumbbell_Triceps_Extension',
  'press-frances': 'EZ-Bar_Skullcrusher',
  'press-banca-cerrado': 'Close-Grip_Barbell_Bench_Press',
  'patada-triceps': 'Tricep_Dumbbell_Kickback',
  'fondos-banco': 'Bench_Dips',
  'fondos-maquina': 'Dip_Machine',
  'curl-muneca': 'Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench',
  sentadilla: 'Barbell_Squat',
  'sentadilla-frontal': 'Front_Barbell_Squat',
  'sentadilla-multipower': 'Smith_Machine_Squat',
  'sentadilla-hack': 'Hack_Squat',
  'sentadilla-pendulo': 'sentadilla-pendulo',
  prensa: 'Leg_Press',
  'extension-cuadriceps': 'Leg_Extensions',
  'sentadilla-goblet': 'Goblet_Squat',
  'sentadilla-bulgara': 'Split_Squat_with_Dumbbells',
  zancadas: 'Dumbbell_Lunges',
  'subidas-banco': 'Dumbbell_Step_Ups',
  'peso-muerto-rumano': 'Romanian_Deadlift',
  'peso-muerto-rumano-mancuernas': 'Stiff-Legged_Dumbbell_Deadlift',
  'buenos-dias': 'Good_Morning',
  'curl-femoral-tumbado': 'Lying_Leg_Curls',
  'curl-femoral-sentado': 'Seated_Leg_Curl',
  'hip-thrust': 'Barbell_Hip_Thrust',
  'hip-thrust-maquina': 'hip-thrust-maquina',
  'puente-gluteo': 'Butt_Lift_Bridge',
  'patada-gluteo-polea': 'One-Legged_Cable_Kickback',
  'abductores-maquina': 'Thigh_Abductor',
  'aductores-maquina': 'Thigh_Adductor',
  'talones-de-pie': 'Standing_Calf_Raises',
  'talones-sentado': 'Seated_Calf_Raise',
  'gemelos-prensa': 'Calf_Press_On_The_Leg_Press_Machine',
  'crunch-polea': 'Cable_Crunch',
  'crunch-maquina': 'Ab_Crunch_Machine',
  crunch: 'Crunches',
  'elevacion-piernas-colgado': 'Hanging_Leg_Raise',
  'rueda-abdominal': 'Ab_Roller',
  'press-pallof': 'Pallof_Press',
}

const MUSCULO_V1: Record<string, Musculo> = { espalda: 'dorsales' }
const migrarMusculo = (m: string): Musculo => MUSCULO_V1[m] ?? (m as Musculo)

/** Forma de un ejercicio en la versión 1 de la base de datos. */
export interface EjercicioV1 {
  id: string
  nombre: string
  musculoPrincipal: string
  musculosSecundarios: string[]
  material: string
  saltoPeso?: number
  notasFijas: string
  personalizado: boolean
  archivado: boolean
  reinicioProgresion?: number
}

export const idMigrado = (id: string): string => MAPA_IDS_V1[id] ?? id

/** Ejercicio v1 → v2. Los campos del catálogo se completan después al sincronizarlo. */
export function migrarEjercicioV1(e: EjercicioV1): Ejercicio {
  const principal = migrarMusculo(e.musculoPrincipal)
  return {
    id: e.personalizado ? e.id : idMigrado(e.id),
    nombre: e.nombre,
    alias: '',
    musculosPrincipales: [principal],
    musculosSecundarios: e.musculosSecundarios.map(migrarMusculo).filter((m) => m !== principal),
    material: e.material as Material,
    categoria: 'fuerza',
    nivel: null,
    mecanica: null,
    instrucciones: [],
    imagenes: 0,
    notasFijas: e.notasFijas ?? '',
    personalizado: e.personalizado,
    archivado: e.archivado,
    ...(e.reinicioProgresion ? { reinicioProgresion: e.reinicioProgresion } : {}),
  }
}

interface ConEjercicio {
  ejercicioId: string
}

export interface DatosV1 {
  ejercicios: EjercicioV1[]
  rutinaEjercicios: ConEjercicio[]
  sesionEjercicios: (ConEjercicio & { sustituyeA?: string })[]
  series: ConEjercicio[]
  molestias: ConEjercicio[]
}

/**
 * Migra todos los datos: los ejercicios cambian de id y todas sus referencias
 * (rutinas, sesiones, series y molestias) apuntan al nuevo. No se pierde nada:
 * si dos antiguos acaban en el mismo nuevo, sus notas se juntan.
 */
export function migrarDatosV1<T extends DatosV1>(datos: T): Omit<T, 'ejercicios'> & { ejercicios: Ejercicio[] } {
  const porId = new Map<string, Ejercicio>()
  for (const viejo of datos.ejercicios) {
    const nuevo = migrarEjercicioV1(viejo)
    const previo = porId.get(nuevo.id)
    if (!previo) {
      porId.set(nuevo.id, nuevo)
      continue
    }
    porId.set(nuevo.id, {
      ...previo,
      notasFijas: [previo.notasFijas, nuevo.notasFijas].filter(Boolean).join('\n'),
      archivado: previo.archivado && nuevo.archivado,
      reinicioProgresion: Math.max(previo.reinicioProgresion ?? 0, nuevo.reinicioProgresion ?? 0) || undefined,
    })
  }
  const personalizados = new Set(datos.ejercicios.filter((e) => e.personalizado).map((e) => e.id))
  const remap = (id: string) => (personalizados.has(id) ? id : idMigrado(id))
  const conId = <R extends ConEjercicio>(fila: R): R => ({ ...fila, ejercicioId: remap(fila.ejercicioId) })
  return {
    ...datos,
    ejercicios: [...porId.values()],
    rutinaEjercicios: datos.rutinaEjercicios.map(conId),
    sesionEjercicios: datos.sesionEjercicios.map((se) => ({
      ...conId(se),
      ...(se.sustituyeA ? { sustituyeA: remap(se.sustituyeA) } : {}),
    })),
    series: datos.series.map(conId),
    molestias: datos.molestias.map(conId),
  }
}

/** Ejercicio tal como viene del catálogo generado (src/catalogo/ejercicios.json). */
export interface EjercicioCatalogo {
  id: string
  nombre: string
  alias: string
  principales: Musculo[]
  secundarios: Musculo[]
  material: Material
  categoria: Categoria
  nivel: Nivel | null
  mecanica: Mecanica | null
  instrucciones: string[]
  imagenes: number
}

/**
 * Sincroniza el catálogo con lo que hay en la base de datos: actualiza los datos de la biblioteca
 * y conserva lo mío (notas, archivado, reinicio de progresión). Los personalizados no se tocan.
 */
export function sincronizarCatalogo(catalogo: readonly EjercicioCatalogo[], existentes: readonly Ejercicio[]): Ejercicio[] {
  const previos = new Map(existentes.map((e) => [e.id, e]))
  return catalogo
    .filter((c) => !previos.get(c.id)?.personalizado)
    .map((c) => {
      const previo = previos.get(c.id)
      return {
        id: c.id,
        nombre: c.nombre,
        alias: c.alias,
        musculosPrincipales: c.principales,
        musculosSecundarios: c.secundarios,
        material: c.material,
        categoria: c.categoria,
        nivel: c.nivel,
        mecanica: c.mecanica,
        instrucciones: c.instrucciones,
        imagenes: c.imagenes,
        notasFijas: previo?.notasFijas ?? '',
        personalizado: false,
        archivado: previo?.archivado ?? false,
        ...(previo?.reinicioProgresion ? { reinicioProgresion: previo.reinicioProgresion } : {}),
      }
    })
}
