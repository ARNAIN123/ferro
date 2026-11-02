// Copias de seguridad: formato JSON versionado, validación al importar, CSV de series y recordatorio.
import { claveDia } from './semanas'

export const VERSION_COPIA = 1

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
] as const
export type NombreTabla = (typeof TABLAS)[number]

export interface Copia {
  app: 'ferro'
  version: number
  exportado: string
  datos: Record<NombreTabla, { id: string }[]>
}

export function crearCopia(datos: Record<NombreTabla, { id: string }[]>, ahora = Date.now()): Copia {
  return { app: 'ferro', version: VERSION_COPIA, exportado: new Date(ahora).toISOString(), datos }
}

export type ResultadoValidacion = { ok: true; copia: Copia; resumen: string } | { ok: false; error: string }

/** Comprueba que un JSON es una copia de Ferro válida antes de sustituir nada. */
export function validarCopia(json: unknown): ResultadoValidacion {
  if (typeof json !== 'object' || json === null) return { ok: false, error: 'El archivo no es un JSON válido.' }
  const c = json as Partial<Copia>
  if (c.app !== 'ferro') return { ok: false, error: 'Este archivo no es una copia de seguridad de Ferro.' }
  if (typeof c.version !== 'number' || c.version > VERSION_COPIA)
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
  return { ok: true, copia: { app: 'ferro', version: c.version, exportado: String(c.exportado ?? ''), datos }, resumen }
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
