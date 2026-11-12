// Tipos de la sección de nutrición (tablas de Dexie desde la versión 4).
import type { FormulaBasal, ObjetivoNutricion, Ritmo, Sexo, Valores100 } from './nutricion'

export type Comida = 'desayuno' | 'antes' | 'comida' | 'merienda' | 'despues' | 'cena'

/** Orden del día. "Antes" y "Después de entrenar" solo aparecen los días de entreno. */
export const COMIDAS: readonly Comida[] = ['desayuno', 'comida', 'merienda', 'antes', 'despues', 'cena']
export const COMIDAS_ENTRENO: ReadonlySet<Comida> = new Set(['antes', 'despues'])

export const NOMBRE_COMIDA: Record<Comida, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  antes: 'Antes de entrenar',
  despues: 'Después de entrenar',
  cena: 'Cena',
}

export type Estado = 'crudo' | 'cocinado' | null

export interface Racion {
  nombre: string
  gramos: number
}

/** Alimento guardado en el móvil: de Open Food Facts (escaneado o buscado), creado por mí o por la IA. */
export interface Alimento {
  id: string
  nombre: string
  marca?: string
  /** Código de barras. */
  codigo?: string
  origen: 'off' | 'propio' | 'ia'
  estado: Estado
  por100: Valores100 & { fibra?: number }
  raciones: Racion[]
  creado: number
}

/** Alimento genérico de la base incluida en la app (USDA, en español). */
export interface AlimentoGenerico {
  id: string
  nombre: string
  estado: Estado
  categoria: string
  por100: Valores100 & { fibra?: number }
  raciones: Racion[]
  fuente: string
}

/** Lo que comí: guarda una copia de los valores para que el historial no cambie si edito el alimento. */
export interface RegistroComida {
  id: string
  /** Día local AAAA-MM-DD. */
  fecha: string
  comida: Comida
  alimentoId: string
  nombre: string
  gramos: number
  racion: string | null
  valores: Valores100
  hora: number
}

export interface Plato {
  id: string
  nombre: string
  items: { alimentoId: string; nombre: string; gramos: number }[]
  creado: number
  usos: number
}

export interface AguaDia {
  /** El día (AAAA-MM-DD). */
  id: string
  ml: number
}

export type EstadoReto = 'propuesto' | 'probado' | 'gusta' | 'no_gusta'

export interface Reto {
  /** Alimento genérico propuesto. */
  alimentoId: string
  /** Lunes de la semana del reto. */
  semana: string
  estado: EstadoReto
}

export interface AjusteSemanal {
  /** Lunes en que se aplicó. */
  lunes: string
  gastoReal: number | null
  objetivoAnterior: number
  objetivoNuevo: number
  motivo: string
  mediaIngesta: number | null
  cambioSemanal: number | null
}

export interface PerfilNutricion {
  id: 'perfil'
  sexo: Sexo
  objetivo: ObjetivoNutricion
  ritmo: Ritmo
  proteinaGkg: number
  /** Día en que hice el asistente: las dos primeras semanas se usa la estimación. */
  inicio: string
  basal: number
  /** Con qué fórmula se calculó el basal (Katch-McArdle si había porcentaje de grasa). */
  formulaBasal?: FormulaBasal
  gastoInicial: number
  /** Objetivo medio diario vigente (kcal). */
  objetivoKcal: number
  ajustes: AjusteSemanal[]
  /** Reto suave de fruta y verdura (desactivable). */
  retoActivo: boolean
  retos: Reto[]
  /** Último lunes cuya revisión semanal ya vi. */
  revisionVista?: string
  /** Días marcados a mano como de entreno (true) o de descanso (false). */
  entrenoManual?: Record<string, boolean>
}
