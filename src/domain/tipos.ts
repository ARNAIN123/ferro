// Modelo de datos de Ferro. Todas las fechas son milisegundos desde epoch (Date.now()).

export const MUSCULOS = [
  'pecho',
  'espalda',
  'hombros',
  'trapecio',
  'biceps',
  'triceps',
  'antebrazos',
  'abdomen',
  'lumbares',
  'gluteos',
  'cuadriceps',
  'isquiotibiales',
  'aductores',
  'gemelos',
] as const
export type Musculo = (typeof MUSCULOS)[number]

export const MATERIALES = ['barra', 'mancuernas', 'maquina', 'polea', 'peso_corporal', 'otro'] as const
export type Material = (typeof MATERIALES)[number]

export interface Ejercicio {
  id: string
  nombre: string
  musculoPrincipal: Musculo
  musculosSecundarios: Musculo[]
  material: Material
  /** Salto de peso en kg para los botones +/− y la progresión. */
  saltoPeso: number
  /** Ajustes fijos de la máquina: altura del asiento, agarre… */
  notasFijas: string
  personalizado: boolean
  archivado: boolean
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

export type OrigenEntrada = 'enlace' | 'ubicacion' | 'manual'

/** Llegada al gimnasio. Puede existir sin entreno (p. ej. check-in por ubicación). */
export interface Entrada {
  id: string
  hora: number
  origen: OrigenEntrada
  sesionId?: string
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
  objetivoSemanal: number
  descansoDefecto: number
  horasEntreCheckins: number
  gimnasioLat: number | null
  gimnasioLng: number | null
  radioM: number
  tema: Tema
  wakeLock: boolean
  vibracion: boolean
  ultimaCopia: number | null
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  id: 'ajustes',
  objetivoSemanal: 4,
  descansoDefecto: 120,
  horasEntreCheckins: 3,
  gimnasioLat: null,
  gimnasioLng: null,
  radioM: 200,
  tema: 'oscuro',
  wakeLock: true,
  vibracion: true,
  ultimaCopia: null,
}
