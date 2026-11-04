import { describe, expect, it } from 'vitest'
import { planificarEventos, type EventoDeteccion } from './deteccion'
import type { Entrada } from './tipos'

const h = 1_730_000_000_000
const min = 60_000

describe('eventos de la detección nativa', () => {
  it('una entrada detectada se crea con su hora y origen', () => {
    const plan = planificarEventos([{ id: 'e1', tipo: 'entrada', hora: h }], [], null, 3)
    expect(plan.nuevas).toEqual([{ id: 'e1', hora: h, origen: 'deteccion' }])
  })

  it('no se duplica si ya hay una entrada en la ventana, ni se importa dos veces la misma', () => {
    const existentes: Entrada[] = [{ id: 'x', hora: h - 60 * min, origen: 'deteccion' }]
    expect(planificarEventos([{ id: 'e1', tipo: 'entrada', hora: h }], existentes, null, 3).nuevas).toEqual([])
    const ya: Entrada[] = [{ id: 'e1', hora: h, origen: 'deteccion' }]
    expect(planificarEventos([{ id: 'e1', tipo: 'entrada', hora: h }], ya, null, 3).nuevas).toEqual([])
  })

  it('si el entreno ya creó la entrada (el aviso llegó tarde), se corrige con la hora detectada', () => {
    const existentes: Entrada[] = [{ id: 'x', hora: h + 6 * min, origen: 'entreno', sesionId: 's1' }]
    const plan = planificarEventos([{ id: 'e1', tipo: 'entrada', hora: h }], existentes, null, 3)
    expect(plan.nuevas).toEqual([])
    expect(plan.cambios).toEqual([{ id: 'x', cambios: { hora: h, origen: 'deteccion' } }])
    expect(plan.llegadas).toEqual([{ sesionId: 's1', hora: h }])
  })

  it('la salida se apunta en su entrada y cierra el entreno en curso con esa hora', () => {
    const existentes: Entrada[] = [{ id: 'e1', hora: h, origen: 'deteccion', sesionId: 's1' }]
    const salida: EventoDeteccion = { id: 's', tipo: 'salida', hora: h + 90 * min, entrada: h }
    const plan = planificarEventos([salida], existentes, { id: 's1', entrada: h + 5 * min }, 3)
    expect(plan.cambios).toEqual([{ id: 'e1', cambios: { salida: h + 90 * min } }])
    expect(plan.cerrar).toEqual({ sesionId: 's1', salida: h + 90 * min })
  })

  it('entrada y salida en la misma tanda; un entreno empezado después de salir no se cierra', () => {
    const eventos: EventoDeteccion[] = [
      { id: 's', tipo: 'salida', hora: h + 80 * min, entrada: h },
      { id: 'e1', tipo: 'entrada', hora: h },
    ]
    const plan = planificarEventos(eventos, [], { id: 'casa', entrada: h + 120 * min }, 3)
    expect(plan.nuevas).toEqual([{ id: 'e1', hora: h, origen: 'deteccion' }])
    expect(plan.cambios).toEqual([{ id: 'e1', cambios: { salida: h + 80 * min } }])
    expect(plan.cerrar).toBeNull()
  })

  it('una salida sin entrada detectada se apunta en la entrada más reciente (p. ej. la del entreno)', () => {
    const existentes: Entrada[] = [{ id: 'x', hora: h, origen: 'entreno' }]
    const plan = planificarEventos([{ id: 's', tipo: 'salida', hora: h + 70 * min, entrada: h - 5 * min }], existentes, null, 3)
    expect(plan.cambios).toEqual([{ id: 'x', cambios: { salida: h + 70 * min } }])
  })
})
