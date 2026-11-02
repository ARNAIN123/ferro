// Búsqueda y filtros de la biblioteca, y valores por defecto al añadir un ejercicio a una rutina.
import { coincide } from './texto'
import type { Categoria, Ejercicio, Material, Musculo } from './tipos'

export interface Filtros {
  texto: string
  /** null = todas las categorías. Por defecto, fuerza. */
  categoria: Categoria | null
  musculo: Musculo | null
  material: Material | null
  /** Incluir los ejercicios archivados (solo personalizados pueden archivarse). */
  archivados?: boolean
}

export const FILTROS_INICIALES: Filtros = { texto: '', categoria: 'fuerza', musculo: null, material: null }

type Filtrable = Pick<
  Ejercicio,
  'nombre' | 'alias' | 'categoria' | 'musculosPrincipales' | 'musculosSecundarios' | 'material' | 'archivado' | 'personalizado'
>

/**
 * Filtra y ordena: busca en el nombre en español y en el alias (inglés y sinónimos).
 * Con un músculo elegido aparecen primero los que lo tienen como principal.
 * Si se busca por texto se ignora la categoría, para encontrar cualquier ejercicio.
 */
export function filtrarEjercicios<T extends Filtrable>(lista: readonly T[], f: Filtros): T[] {
  const texto = f.texto.trim()
  const resultado = lista.filter((e) => {
    if (Boolean(e.archivado) !== Boolean(f.archivados)) return false
    if (!texto && f.categoria && e.categoria !== f.categoria) return false
    if (f.material && e.material !== f.material) return false
    if (f.musculo && !e.musculosPrincipales.includes(f.musculo) && !e.musculosSecundarios.includes(f.musculo)) return false
    if (texto && !coincide(`${e.nombre} ${e.alias}`, texto)) return false
    return true
  })
  const peso = (e: T) => (f.musculo && !e.musculosPrincipales.includes(f.musculo) ? 1 : 0)
  return resultado.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, 'es'))
}

const MUSCULOS_GRANDES: readonly Musculo[] = ['pecho', 'dorsales', 'espalda_media', 'hombros', 'cuadriceps', 'isquiotibiales', 'gluteos', 'lumbares']
const MATERIAL_PESADO: readonly Material[] = ['barra', 'barra_z', 'mancuernas', 'maquina', 'kettlebell']

/** Compuesto grande: multiarticular, de un grupo grande y con carga importante (sentadilla, press de banca, remo…). */
export function esCompuestoGrande(e: Pick<Ejercicio, 'mecanica' | 'musculosPrincipales' | 'material'>): boolean {
  return (
    e.mecanica === 'compuesto' &&
    MATERIAL_PESADO.includes(e.material) &&
    e.musculosPrincipales.some((m) => MUSCULOS_GRANDES.includes(m))
  )
}

export interface ValoresPlan {
  series: number
  repsMin: number
  repsMax: number
  descansoSeg: number
}

/** 3 series de 8–12 con 90 s de descanso; 2 min 30 s en los compuestos grandes. */
export function valoresPorDefecto(e: Pick<Ejercicio, 'mecanica' | 'musculosPrincipales' | 'material'>): ValoresPlan {
  return { series: 3, repsMin: 8, repsMax: 12, descansoSeg: esCompuestoGrande(e) ? 150 : 90 }
}
