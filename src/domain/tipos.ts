// Modelo de datos de Ferro. Todas las fechas son milisegundos desde epoch (Date.now()).

import type { AjusteFino } from './cuerpo'
import type { Sexo } from './nutricion'

/**
 * Músculos (ronda 4): división completa, grupo → músculo → porción o cabeza (ver domain/musculos.ts).
 * Los ejercicios usan estos nombres para principales y secundarios. El orden es el de las regiones
 * del cuerpo 3D (id = índice + 1), así que solo se añaden al final.
 */
export const MUSCULOS = [
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
export type Musculo = (typeof MUSCULOS)[number]

/**
 * Zonas del mapa y las animaciones 2D (las regiones de la ronda 2). Cada músculo pertenece a una
 * (`zonaDe`); también son los nombres de los músculos antes de la ronda 4, que se migran.
 */
export const ZONAS = [
  'pectoral_superior',
  'pectoral_inferior',
  'deltoides_anterior',
  'deltoides_lateral',
  'deltoides_posterior',
  'biceps',
  'braquial',
  'triceps',
  'antebrazos',
  'trapecio',
  'espalda_media',
  'dorsales',
  'lumbares',
  'abdomen',
  'oblicuos',
  'gluteo_mayor',
  'gluteo_medio',
  'cuadriceps',
  'isquiotibiales',
  'aductores',
  'gemelos',
  'soleo',
  'cuello',
] as const
export type Zona = (typeof ZONAS)[number]

/**
 * Materiales. La biblioteca solo usa los de peso libre, polea y multipower (MATERIALES_BIBLIOTECA);
 * los demás quedan para ejercicios antiguos del historial y los propios.
 */
export const MATERIALES = [
  'barra',
  'barra_z',
  'barra_hexagonal',
  'landmine',
  'mancuernas',
  'discos',
  'polea',
  'multipower',
  'kettlebell',
  'maquina',
  'peso_corporal',
  'bandas',
  'balon_medicinal',
  'fitball',
  'foam_roller',
  'otro',
  'ninguno',
] as const
export type Material = (typeof MATERIALES)[number]

export const MATERIALES_BIBLIOTECA: readonly Material[] = ['barra', 'barra_z', 'barra_hexagonal', 'landmine', 'mancuernas', 'discos', 'polea', 'multipower']

export const CATEGORIAS = ['fuerza', 'halterofilia', 'strongman', 'pliometria', 'cardio', 'estiramientos'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export type Nivel = 'principiante' | 'intermedio' | 'avanzado'
export type Mecanica = 'compuesto' | 'aislamiento'

export interface Ejercicio {
  id: string
  nombre: string
  /** Nombre original en inglés y sinónimos, para buscar en los dos idiomas. */
  alias: string
  musculosPrincipales: Musculo[]
  musculosSecundarios: Musculo[]
  material: Material
  categoria: Categoria
  nivel: Nivel | null
  mecanica: Mecanica | null
  instrucciones: string[]
  /** Mis notas: ajustes de la máquina, agarre… Es lo único editable de la ficha. */
  notasFijas: string
  personalizado: boolean
  archivado: boolean
  /** Ya no está en la biblioteca (máquina, peso corporal…): se conserva por el historial, pero no se puede elegir. */
  retirado?: boolean
  /** Si eliges "bajar un 10 % y reconstruir", el estancamiento se cuenta desde aquí. */
  reinicioProgresion?: number
}

export interface Rutina {
  id: string
  nombre: string
  posicionCiclo: number
  archivada: boolean
  creada: number
}

export interface RutinaEjercicio {
  id: string
  rutinaId: string
  ejercicioId: string
  orden: number
  series: number
  repsMin: number
  repsMax: number
  descansoSeg: number
  nota: string
  superserieConSiguiente: boolean
}

/**
 * 'deteccion' = la detección nativa (abrir S3 FIT ZONE en el gimnasio). 'entreno' = no hubo detección y se usó
 * la hora de inicio del entreno. 'enlace', 'ubicacion' y 'manual' solo existen en datos antiguos.
 */
export type OrigenEntrada = 'deteccion' | 'entreno' | 'enlace' | 'ubicacion' | 'manual'

/** Llegada al gimnasio (y salida, si se detectó). Puede existir sin entreno. */
export interface Entrada {
  id: string
  hora: number
  origen: OrigenEntrada
  sesionId?: string
  /** Salida del gimnasio detectada (primera señal de salida). */
  salida?: number
}

export type EstadoSesion = 'en_curso' | 'terminada'

export interface Sesion {
  id: string
  rutinaId: string | null
  /** Copia del nombre por si la rutina se renombra o archiva después. */
  rutinaNombre: string
  entrada: number
  salida: number | null
  origenEntrada: OrigenEntrada
  estado: EstadoSesion
  /** Hora de la última acción del usuario; sirve para el cierre automático. */
  ultimaActividad: number
  cierreAutomatico?: boolean
  /** Hora absoluta en la que termina el descanso en curso. */
  descansoFin: number | null
  descansoDuracion: number | null
  /** Tarjeta visible (SesionEjercicio), para retomar exactamente donde estaba. */
  ejercicioActivoId: string | null
}

export type EstadoSesionEjercicio = 'activo' | 'saltado'

/** Plan concreto de un ejercicio dentro de una sesión (puede diferir de la rutina). */
export interface SesionEjercicio {
  id: string
  sesionId: string
  ejercicioId: string
  orden: number
  seriesObjetivo: number
  repsMin: number
  repsMax: number
  descansoSeg: number
  nota: string
  superserieConSiguiente: boolean
  estado: EstadoSesionEjercicio
  /** Ejercicio original si se cambió por una alternativa. */
  sustituyeA?: string
  anadido: boolean
}

export type TipoSerie = 'calentamiento' | 'normal' | 'drop'

export interface Serie {
  id: string
  sesionId: string
  sesionEjercicioId: string
  ejercicioId: string
  orden: number
  tipo: TipoSerie
  peso: number
  reps: number
  rir: number | null
  completada: boolean
  hora: number | null
}

export interface Molestia {
  id: string
  sesionId: string
  ejercicioId: string
  nota: string
  hora: number
}

export interface PesoCorporal {
  id: string
  /** Día local en formato AAAA-MM-DD (uno por día). */
  fecha: string
  kg: number
  /** De dónde viene: sin origen o 'manual' si lo apunté yo; 'salud' si lo trajo Health Connect. */
  origen?: 'manual' | 'salud'
}

export type Tema = 'oscuro' | 'claro' | 'sistema'

export interface Ajustes {
  id: 'ajustes'
  /** Días al mes que quiero ir al gimnasio. */
  objetivoMensual: number
  /** Pasos al día. */
  objetivoPasos: number
  /** Para estimar la longitud del paso y las calorías. */
  alturaCm: number | null
  edad: number | null
  descansoDefecto: number
  horasEntreCheckins: number
  gimnasioLat: number | null
  gimnasioLng: number | null
  radioM: number
  /** La salida exige estar a más de radio + margen. */
  margenSalidaM: number
  /** Notificación discreta "Entrada registrada · 18:04". */
  notificarEntrada: boolean
  tema: Tema
  wakeLock: boolean
  vibracion: boolean
  ultimaCopia: number | null
  /** Versión del catálogo de ejercicios sincronizada en la base de datos. */
  versionCatalogo?: string
  /** Perfil corporal (ronda 4): con el sexo, la edad, la altura, el peso y las medidas se da forma al avatar. */
  sexo?: Sexo | null
  /** Ajuste fino visual del avatar (de −1 a 1 cada deslizador). */
  ajusteAvatar?: AjusteFino
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  id: 'ajustes',
  objetivoMensual: 16,
  objetivoPasos: 10_000,
  alturaCm: null,
  edad: null,
  descansoDefecto: 120,
  horasEntreCheckins: 3,
  gimnasioLat: null,
  gimnasioLng: null,
  radioM: 150,
  margenSalidaM: 150,
  notificarEntrada: true,
  tema: 'oscuro',
  wakeLock: true,
  vibracion: true,
  ultimaCopia: null,
}
