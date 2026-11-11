// Búsqueda de ejercicios por músculo (el único buscador de la app es el mapa) y valores por defecto
// al añadir un ejercicio a una rutina.
import type { Ejercicio, Material, Musculo } from './tipos'

type Buscable = Pick<Ejercicio, 'id' | 'nombre' | 'musculosPrincipales' | 'musculosSecundarios' | 'archivado' | 'retirado'>

export interface EjerciciosDeMusculo<T> {
  /** Su músculo principal es ese. */
  principal: T[]
  /** Lo tienen como secundario. */
  tambien: T[]
}

/**
 * Ejercicios de un músculo en dos apartados: "Principal" y "También lo trabajan". En cada uno van
 * primero los que más uso y después por orden alfabético. Los archivados y los retirados no salen.
 */
export function ejerciciosDeMusculo<T extends Buscable>(lista: readonly T[], musculo: Musculo, usos: ReadonlyMap<string, number> = new Map()): EjerciciosDeMusculo<T> {
  const orden = (a: T, b: T) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es')
  const disponibles = lista.filter((e) => !e.archivado && !e.retirado)
  return {
    principal: disponibles.filter((e) => e.musculosPrincipales.includes(musculo)).sort(orden),
    tambien: disponibles.filter((e) => !e.musculosPrincipales.includes(musculo) && e.musculosSecundarios.includes(musculo)).sort(orden),
  }
}

/** Cuántas veces he usado cada ejercicio (en entrenos y en rutinas), para ordenar las listas. */
export function contarUsos(...listas: readonly (readonly { ejercicioId: string }[])[]): Map<string, number> {
  const usos = new Map<string, number>()
  for (const lista of listas) for (const { ejercicioId } of lista) usos.set(ejercicioId, (usos.get(ejercicioId) ?? 0) + 1)
  return usos
}

type Comparable = Pick<Ejercicio, 'id' | 'nombre' | 'musculosPrincipales' | 'musculosSecundarios' | 'mecanica' | 'archivado' | 'retirado'>

const palabras = (n: string) => new Set(n.toLowerCase().split(/[^a-záéíóúñü]+/).filter((p) => p.length > 3))

/**
 * Equivalente más parecido de la biblioteca para un ejercicio retirado (una máquina, por ejemplo):
 * pesa sobre todo coincidir en músculos principales, después en secundarios y en el tipo (compuesto o
 * aislamiento), y como desempate las palabras del nombre ("press", "inclinado"…).
 */
export function equivalenteMasParecido<T extends Comparable>(retirado: Comparable, biblioteca: readonly T[]): T | null {
  const nombre = palabras(retirado.nombre)
  let mejor: T | null = null
  let puntos = 0
  for (const e of biblioteca) {
    if (e.id === retirado.id || e.retirado || e.archivado) continue
    const enPrincipal = e.musculosPrincipales.filter((m) => retirado.musculosPrincipales.includes(m)).length
    if (enPrincipal === 0) continue
    const todos = [...retirado.musculosPrincipales, ...retirado.musculosSecundarios]
    const enSecundario = e.musculosSecundarios.filter((m) => todos.includes(m)).length
    const sobran = e.musculosPrincipales.length - enPrincipal
    const comunes = [...palabras(e.nombre)].filter((p) => nombre.has(p)).length
    const p = enPrincipal * 10 + enSecundario * 2 - sobran * 4 + (e.mecanica && e.mecanica === retirado.mecanica ? 3 : 0) + comunes
    if (p > puntos || (p === puntos && mejor && e.nombre.localeCompare(mejor.nombre, 'es') < 0)) {
      mejor = e
      puntos = p
    }
  }
  return mejor
}

const MUSCULOS_GRANDES: readonly Musculo[] = [
  'pectoral_clavicular',
  'pectoral_esternal',
  'pectoral_costal',
  'dorsal_ancho',
  'romboides',
  'trapecio_medio',
  'deltoides_anterior',
  'recto_femoral',
  'vasto_lateral',
  'vasto_medial',
  'biceps_femoral',
  'semitendinoso',
  'semimembranoso',
  'gluteo_mayor',
  'erectores_espinales',
]
const MATERIAL_PESADO: readonly Material[] = ['barra', 'barra_z', 'barra_hexagonal', 'landmine', 'mancuernas', 'multipower', 'maquina', 'kettlebell']

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
