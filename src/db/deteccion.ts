import { planificarEventos } from '../domain/deteccion'
import { leerAjustes } from '../hooks/useAjustes'
import { Deteccion, hayDeteccion } from '../lib/deteccion'
import { db } from './db'
import { cerrarSesionAlSalir, sesionEnCurso } from './entreno'

let importando: Promise<number> | null = null

/**
 * Pasa a la base de datos las entradas y salidas que la detección nativa registró con la app
 * cerrada. Devuelve cuántos eventos había. Se llama al abrir Ferro, al volver a ella y cuando
 * la detección avisa de un cambio.
 */
export function importarEventosDeteccion(): Promise<number> {
  if (!hayDeteccion()) return Promise.resolve(0)
  importando ??= (async () => {
    const { eventos } = await Deteccion.tomarEventos()
    if (!eventos.length) return 0
    const { horasEntreCheckins } = await leerAjustes()
    const enCurso = await sesionEnCurso()
    const plan = planificarEventos(eventos, await db.entradas.toArray(), enCurso ? { id: enCurso.id, entrada: enCurso.entrada } : null, horasEntreCheckins)
    await db.transaction('rw', db.entradas, db.sesiones, async () => {
      await db.entradas.bulkPut(plan.nuevas)
      for (const c of plan.cambios) await db.entradas.update(c.id, c.cambios)
      for (const l of plan.llegadas) await db.sesiones.update(l.sesionId, { entrada: l.hora, origenEntrada: 'deteccion' })
    })
    if (plan.cerrar) await cerrarSesionAlSalir(plan.cerrar.sesionId, plan.cerrar.salida)
    return eventos.length
  })().finally(() => {
    importando = null
  })
  return importando
}
