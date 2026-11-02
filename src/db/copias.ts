import { crearCopia, seriesACsv, TABLAS, validarCopia, type FilaCsv, type NombreTabla } from '../domain/copias'
import { NOMBRE_MUSCULO, NOMBRE_TIPO_SERIE } from '../domain/etiquetas'
import { claveDia } from '../domain/semanas'
import { guardarAjustes } from '../hooks/useAjustes'
import { db } from './db'

const tabla = (t: NombreTabla) => db.table(t)

export async function generarCopiaJson(): Promise<{ nombre: string; contenido: string }> {
  const datos = {} as Record<NombreTabla, { id: string }[]>
  await db.transaction('r', TABLAS.map(tabla), async () => {
    for (const t of TABLAS) datos[t] = await tabla(t).toArray()
  })
  return { nombre: `ferro-copia-${claveDia(Date.now())}.json`, contenido: JSON.stringify(crearCopia(datos)) }
}

/** Marca la copia como hecha (para el recordatorio de Hoy). */
export const marcarCopiaHecha = () => guardarAjustes({ ultimaCopia: Date.now() })

export type ResultadoImportacion = { ok: true; resumen: string } | { ok: false; error: string }

/** Lee un JSON y lo valida sin tocar nada todavía. */
export async function leerCopia(archivo: File) {
  try {
    return validarCopia(JSON.parse(await archivo.text()))
  } catch {
    return { ok: false as const, error: 'El archivo no es un JSON válido.' }
  }
}

/** Sustituye todos los datos por los de la copia, en una sola transacción (o todo o nada). */
export async function restaurarCopia(copia: Extract<Awaited<ReturnType<typeof leerCopia>>, { ok: true }>['copia']): Promise<void> {
  await db.transaction('rw', TABLAS.map(tabla), async () => {
    for (const t of TABLAS) {
      await tabla(t).clear()
      await tabla(t).bulkAdd(copia.datos[t])
    }
  })
}

export async function generarCsvSeries(): Promise<{ nombre: string; contenido: string }> {
  const [series, sesiones, ejercicios, molestias] = await Promise.all([
    db.series.filter((s) => s.completada).toArray(),
    db.sesiones.toArray(),
    db.ejercicios.toArray(),
    db.molestias.toArray(),
  ])
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]))
  const ejercicioPorId = new Map(ejercicios.map((e) => [e.id, e]))
  const molestiaDe = new Map(molestias.map((m) => [`${m.sesionId}|${m.ejercicioId}`, m.nota || 'sí']))
  const numero = new Map<string, number>()
  const filas: FilaCsv[] = series
    .filter((s) => sesionPorId.get(s.sesionId)?.estado === 'terminada')
    .sort((a, b) => (a.hora ?? 0) - (b.hora ?? 0))
    .map((s) => {
      const clave = `${s.sesionId}|${s.sesionEjercicioId}`
      numero.set(clave, (numero.get(clave) ?? 0) + 1)
      const e = ejercicioPorId.get(s.ejercicioId)
      return {
        hora: s.hora ?? sesionPorId.get(s.sesionId)!.entrada,
        rutina: sesionPorId.get(s.sesionId)!.rutinaNombre,
        ejercicio: e?.nombre ?? s.ejercicioId,
        musculo: e ? e.musculosPrincipales.map((m) => NOMBRE_MUSCULO[m]).join(', ') : '',
        serie: numero.get(clave)!,
        tipo: NOMBRE_TIPO_SERIE[s.tipo].toLowerCase(),
        peso: s.peso,
        reps: s.reps,
        rir: s.rir,
        molestia: molestiaDe.get(`${s.sesionId}|${s.ejercicioId}`) ?? '',
      }
    })
  return { nombre: `ferro-series-${claveDia(Date.now())}.csv`, contenido: seriesACsv(filas) }
}
