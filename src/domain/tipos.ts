// Modelo de datos de Ferro. Todas las fechas son milisegundos desde epoch (Date.now()).

/** Músculos = regiones del avatar (ronda 2). Los ejercicios usan estos nombres para principales y secundarios. */
export const MUSCULOS = [
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
export type Musculo = (typeof MUSCULOS)[number]

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
  /** Número de imágenes (0, 1 o 2) en /img/ejercicios/<id>/<n>.webp. Sin imágenes se muestra el mapa muscular. */
  imagenes: number
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
