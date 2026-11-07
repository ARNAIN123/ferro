// Cada lunes, al abrir Nutrición: recalcula el gasto real y ajusta el objetivo de la semana.
import { DIAS_SOLO_ESTIMACION, metabolismoBasal, recalibrar, type DiaIngesta } from '../domain/nutricion'
import { resumenSemana, sumar } from '../domain/registroComidas'
import { claveDia, inicioSemana, sumarDias } from '../domain/semanas'
import type { AjusteSemanal, RegistroComida } from '../domain/tiposNutricion'
import { leerAjustes } from '../hooks/useAjustes'
import { db } from './db'

const fechaMas = (fecha: string, dias: number) => claveDia(sumarDias(new Date(`${fecha}T12:00`).getTime(), dias))

/** Lunes de la semana de `ahora` (AAAA-MM-DD). */
export const lunesDe = (ahora: number) => claveDia(inicioSemana(ahora))

/**
 * Si es una semana nueva y aún no se ha ajustado, calcula el ajuste y lo guarda. Las dos primeras
 * semanas se mantiene la estimación (solo se comprueba el límite del basal con el peso actual).
 */
export async function recalibrarSiToca(ahora = Date.now()): Promise<AjusteSemanal | null> {
  const perfil = await db.nutricion.get('perfil')
  if (!perfil) return null
  const lunes = lunesDe(ahora)
  if (perfil.inicio >= lunes || perfil.ajustes.some((a) => a.lunes === lunes)) return null

  const ajustes = await leerAjustes()
  const pesos = await db.pesosCorporales.where('fecha').aboveOrEqual(fechaMas(lunes, -28)).toArray()
  const ultimo = await db.pesosCorporales.orderBy('fecha').last()
  if (!ultimo) return null
  const kg = ultimo.kg
  const basal = ajustes.edad && ajustes.alturaCm ? metabolismoBasal({ sexo: perfil.sexo, kg, alturaCm: ajustes.alturaCm, edad: ajustes.edad }) : perfil.basal

  const hasta = fechaMas(lunes, -1)
  const desde = fechaMas(lunes, -14)
  const comidas = await db.comidas.where('fecha').between(desde, hasta, true, true).toArray()
  const porDia = new Map<string, RegistroComida[]>()
  for (const c of comidas) porDia.set(c.fecha, [...(porDia.get(c.fecha) ?? []), c])
  const ingestas: DiaIngesta[] = Array.from({ length: 14 }, (_, i) => {
    const fecha = fechaMas(desde, i)
    const del = porDia.get(fecha)
    return { fecha, kcal: del ? sumar(del).kcal : null }
  })

  const dias = Math.round((new Date(`${lunes}T12:00`).getTime() - new Date(`${perfil.inicio}T12:00`).getTime()) / 86_400_000)
  let ajuste: AjusteSemanal
  if (dias < DIAS_SOLO_ESTIMACION) {
    const nuevo = Math.max(perfil.objetivoKcal, Math.ceil(basal / 10) * 10)
    ajuste = { lunes, gastoReal: null, objetivoAnterior: perfil.objetivoKcal, objetivoNuevo: nuevo, motivo: 'estimacion', mediaIngesta: resumenSemana(comidas).mediaKcal, cambioSemanal: null }
  } else {
    const r = recalibrar({ hasta, ingestas, pesos, objetivoActual: perfil.objetivoKcal, basal, objetivo: perfil.objetivo, ritmo: perfil.ritmo, kg })
    ajuste = { lunes, gastoReal: r.gastoReal, objetivoAnterior: perfil.objetivoKcal, objetivoNuevo: r.nuevoObjetivo, motivo: r.motivo, mediaIngesta: r.mediaIngesta, cambioSemanal: r.cambioSemanal }
  }
  await db.nutricion.update('perfil', { ajustes: [...perfil.ajustes, ajuste], objetivoKcal: ajuste.objetivoNuevo, basal })
  return ajuste
}
