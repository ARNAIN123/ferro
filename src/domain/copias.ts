// Copias de seguridad: formato JSON versionado, validación al importar, CSV de series y recordatorio.
import { migrarDatosV1, migrarMusculosEjercicio, type DatosV1 } from './migracion'
import { claveDia } from './semanas'

export const VERSION_COPIA = 1

/** Versión actual de la base de datos (Dexie). Súbela junto con cada `db.version(n)` nueva. */
export const ESQUEMA_ACTUAL = 7

export const TABLAS = [
  'ejercicios',
  'rutinas',
  'rutinaEjercicios',
  'entradas',
  'sesiones',
  'sesionEjercicios',
  'series',
  'molestias',
  'pesosCorporales',
  'ajustes',
  // Nutrición (esquema 4). Las copias anteriores no las traen y se importan vacías.
  'alimentos',
  'comidas',
  'platos',
  'agua',
  'nutricion',
  // Perfil corporal (esquema 6): medidas con cinta y porcentaje de grasa.
  'medidas',
  'grasas',
] as const
export type NombreTabla = (typeof TABLAS)[number]

export interface Copia {
  app: 'ferro'
  version: number
  /** Versión de la base de datos al exportar. Las copias de la PWA 0.2.0 o anteriores no la traen. */
  esquema?: number
  exportado: string
  datos: Record<NombreTabla, { id: string }[]>
}

export function crearCopia(datos: Record<NombreTabla, { id: string }[]>, ahora = Date.now()): Copia {
  return { app: 'ferro', version: VERSION_COPIA, esquema: ESQUEMA_ACTUAL, exportado: new Date(ahora).toISOString(), datos }
}

/** Esquema de la base de datos con el que se hizo la copia; si no lo trae, se deduce de los datos. */
export function esquemaDeCopia(copia: Copia): number {
  if (copia.esquema) return copia.esquema
  return copia.datos.ejercicios.some((e) => 'musculoPrincipal' in e) ? 1 : 2
}

/**
 * Lleva una copia antigua al esquema actual con las mismas migraciones que la base de datos,
 * para que importar una copia vieja dé el mismo resultado que actualizar la app con esos datos.
 */
export function migrarCopia(copia: Copia): Copia {
  let actual = copia
  if (esquemaDeCopia(actual) < 2) {
    const migrados = migrarDatosV1(actual.datos as unknown as DatosV1)
    actual = { ...actual, esquema: 2, datos: { ...actual.datos, ...migrados } as unknown as Copia['datos'] }
  }
  // Esquemas 2–6 → 7 (ronda 5): los músculos de cada ejercicio pasan a los 18 grupos, como en la
  // base de datos (migrarMusculosEjercicio vale para los nombres de cualquier versión). Del 6 al 7
  // no cambia nada más.
  if (esquemaDeCopia(actual) < 7) {
    const ejercicios = (actual.datos.ejercicios as unknown as Parameters<typeof migrarMusculosEjercicio>[0][]).map(migrarMusculosEjercicio)
    actual = { ...actual, esquema: 7, datos: { ...actual.datos, ejercicios: ejercicios as unknown as Copia['datos']['ejercicios'] } }
  }
  return actual
}

export type ResultadoValidacion = { ok: true; copia: Copia; resumen: string } | { ok: false; error: string }

/** Comprueba que un JSON es una copia de Ferro válida antes de sustituir nada. */
export function validarCopia(json: unknown): ResultadoValidacion {
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'El archivo no es un JSON válido.' }
  const c = json as Partial<Copia>
  if (c.app !== 'ferro') return { ok: false, error: 'Este archivo no es una copia de seguridad de Ferro.' }
  if (typeof c.version !== 'number' || c.version > VERSION_COPIA || (c.esquema ?? 0) > ESQUEMA_ACTUAL)
    return { ok: false, error: 'La copia es de una versión más nueva de Ferro. Actualiza la app antes de importarla.' }
  if (typeof c.datos !== 'object' || c.datos === null) return { ok: false, error: 'La copia no contiene datos.' }
  const datos = {} as Record<NombreTabla, { id: string }[]>
  for (const t of TABLAS) {
    const filas = (c.datos as Record<string, unknown>)[t] ?? []
    if (!Array.isArray(filas)) return { ok: false, error: `La tabla "${t}" está dañada.` }
    if (!filas.every((f) => typeof f === 'object' && f !== null && typeof (f as { id?: unknown }).id === 'string'))
      return { ok: false, error: `Hay registros sin identificador en "${t}".` }
    datos[t] = filas as { id: string }[]
  }
  const resumen = `${datos.sesiones.length} entrenos, ${datos.rutinas.length} rutinas y ${datos.series.length} series`
  const copia: Copia = { app: 'ferro', version: c.version, exportado: String(c.exportado ?? ''), datos }
  if (typeof c.esquema === 'number') copia.esquema = c.esquema
  return { ok: true, copia, resumen }
}

export interface FilaCsv {
  hora: number
  rutina: string
  ejercicio: string
  musculo: string
  serie: number
  tipo: string
  peso: number
  reps: number
  rir: number | null
  molestia: string
}

const CABECERA = ['fecha', 'hora', 'rutina', 'ejercicio', 'musculo', 'serie', 'tipo', 'peso_kg', 'reps', 'rir', 'molestia']

function campo(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * CSV de todas las series, separado por punto y coma y con coma decimal
 * (se abre bien en Excel y Google Sheets en español).
 */
export function seriesACsv(filas: readonly FilaCsv[]): string {
  const lineas = [...filas]
    .sort((a, b) => a.hora - b.hora)
    .map((f) => {
      const d = new Date(f.hora)
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      return [
        claveDia(f.hora),
        hora,
        f.rutina,
        f.ejercicio,
        f.musculo,
        String(f.serie),
        f.tipo,
        String(f.peso).replace('.', ','),
        String(f.reps),
        f.rir === null ? '' : String(f.rir),
        f.molestia,
      ]
        .map(campo)
        .join(';')
    })
  return '﻿' + [CABECERA.join(';'), ...lineas].join('\r\n') + '\r\n'
}

export const DIAS_RECORDATORIO = 14

/**
 * Recordatorio de copia: si la última fue hace más de 2 semanas o, si nunca hice ninguna,
 * si llevo más de 2 semanas usando la app.
 */
export function necesitaCopia(ultimaCopia: number | null, primeraActividad: number | null, ahora: number): boolean {
  const limite = DIAS_RECORDATORIO * 86400_000
  if (ultimaCopia !== null) return ahora - ultimaCopia > limite
  return primeraActividad !== null && ahora - primeraActividad > limite
}
