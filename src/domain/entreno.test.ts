import { describe, expect, it } from 'vitest'
import {
  ajustarPeso,
  cierreAutomatico,
  descansoPorTipo,
  descansoTrasSerie,
  destinoTrasSerie,
  grupoSuperserie,
  prerrellenarSeries,
  propagarCambio,
  restanteMs,
  serieSiguiente,
  siguienteRir,
  siguienteTipo,
  type SerieBase,
} from './entreno'

const s = (orden: number, peso: number, reps: number, tipo: SerieBase['tipo'] = 'normal'): SerieBase => ({
  orden,
  peso,
  reps,
  tipo,
  rir: null,
})

describe('prerrellenado', () => {
  it('sin historial usa 0 kg y el mínimo del rango', () => {
    expect(prerrellenarSeries(3, 8, [])).toEqual([
      { tipo: 'normal', peso: 0, reps: 8 },
      { tipo: 'normal', peso: 0, reps: 8 },
      { tipo: 'normal', peso: 0, reps: 8 },
    ])
  })

  it('copia cada serie de la última vez y repite los calentamientos', () => {
    const ultimas = [s(2, 60, 10), s(0, 40, 10, 'calentamiento'), s(1, 60, 12), s(3, 60, 9), s(4, 45, 12, 'drop')]
    expect(prerrellenarSeries(3, 8, ultimas)).toEqual([
      { tipo: 'calentamiento', peso: 40, reps: 10 },
      { tipo: 'normal', peso: 60, reps: 12 },
      { tipo: 'normal', peso: 60, reps: 10 },
      { tipo: 'normal', peso: 60, reps: 9 },
    ])
  })

  it('si la última vez hice menos series, repite la última', () => {
    expect(prerrellenarSeries(3, 8, [s(0, 50, 10), s(1, 52.5, 8)]).map((x) => x.peso)).toEqual([50, 52.5, 52.5])
  })

  it('una serie añadida copia la última', () => {
    expect(serieSiguiente([s(0, 50, 10), s(1, 55, 8)], 6)).toEqual({ tipo: 'normal', peso: 55, reps: 8 })
    expect(serieSiguiente([], 6)).toEqual({ tipo: 'normal', peso: 0, reps: 6 })
  })
})

describe('ajustes de una serie', () => {
  it('suma y resta el salto sin bajar de cero ni acumular decimales raros', () => {
    expect(ajustarPeso(60, 2.5, 1)).toBe(62.5)
    expect(ajustarPeso(1, 2, -1)).toBe(0)
    expect(ajustarPeso(0.1, 0.1, 1)).toBe(0.2)
  })
  it('alterna tipo y RIR', () => {
    expect(siguienteTipo('normal')).toBe('calentamiento')
    expect(siguienteTipo('calentamiento')).toBe('drop')
    expect(siguienteTipo('drop')).toBe('normal')
    expect(siguienteRir(null)).toBe(0)
    expect(siguienteRir(2)).toBe(3)
    expect(siguienteRir(4)).toBeNull()
  })
})

describe('propagación de cambios', () => {
  const series = [
    { id: '1', orden: 0, tipo: 'normal' as const, completada: true, peso: 60, reps: 10 },
    { id: '2', orden: 1, tipo: 'normal' as const, completada: false, peso: 60, reps: 10 },
    { id: '3', orden: 2, tipo: 'normal' as const, completada: false, peso: 60, reps: 9 },
    { id: '4', orden: 3, tipo: 'drop' as const, completada: false, peso: 60, reps: 9 },
  ]

  it('las series pendientes siguientes con el mismo valor heredan el cambio', () => {
    expect(propagarCambio(series, '2', 'peso', 62.5)).toEqual([
      { id: '2', valor: 62.5 },
      { id: '3', valor: 62.5 },
    ])
  })

  it('no toca series con otro valor, ya hechas, anteriores ni de otro tipo', () => {
    expect(propagarCambio(series, '2', 'reps', 11)).toEqual([{ id: '2', valor: 11 }])
    expect(propagarCambio(series, '1', 'peso', 65).map((c) => c.id)).toEqual(['1', '2', '3'])
  })
})

describe('superseries', () => {
  // A y B en superserie, C suelto, D y E en superserie.
  const lista = [
    { superserieConSiguiente: true, saltado: false, descansoSeg: 60 },
    { superserieConSiguiente: false, saltado: false, descansoSeg: 90 },
    { superserieConSiguiente: false, saltado: false, descansoSeg: 120 },
    { superserieConSiguiente: true, saltado: false, descansoSeg: 45 },
    { superserieConSiguiente: false, saltado: false, descansoSeg: 75 },
  ]

  it('detecta el grupo', () => {
    expect(grupoSuperserie(lista, 0)).toEqual([0, 1])
    expect(grupoSuperserie(lista, 1)).toEqual([0, 1])
    expect(grupoSuperserie(lista, 2)).toEqual([2])
    expect(grupoSuperserie(lista, 4)).toEqual([3, 4])
  })

  it('alterna entre los ejercicios del grupo con series pendientes', () => {
    const todos = () => true
    expect(destinoTrasSerie(lista, 0, todos)).toBe(1)
    expect(destinoTrasSerie(lista, 1, todos)).toBe(0)
    expect(destinoTrasSerie(lista, 2, todos)).toBe(2)
    expect(destinoTrasSerie(lista, 0, (i) => i === 0)).toBe(0)
  })

  it('solo descansa al terminar la vuelta de la superserie', () => {
    expect(descansoTrasSerie(lista, 0, 1)).toBe(0)
    expect(descansoTrasSerie(lista, 1, 0)).toBe(90)
    expect(descansoTrasSerie(lista, 0, 0)).toBe(90)
    expect(descansoTrasSerie(lista, 2, 2)).toBe(120)
  })
})

describe('descanso según el tipo de serie', () => {
  it('no descansa antes de un drop set y acorta tras un calentamiento', () => {
    expect(descansoPorTipo(120, 'normal', 'drop')).toBe(0)
    expect(descansoPorTipo(120, 'calentamiento', 'normal')).toBe(60)
    expect(descansoPorTipo(45, 'calentamiento', 'normal')).toBe(45)
    expect(descansoPorTipo(120, 'normal', null)).toBe(120)
    expect(descansoPorTipo(0, 'normal', 'normal')).toBe(0)
  })
})

describe('temporizador y cierre automático', () => {
  it('calcula el descanso desde la hora de fin', () => {
    expect(restanteMs(10_000, 4_000)).toBe(6_000)
    expect(restanteMs(10_000, 20_000)).toBe(0)
    expect(restanteMs(null, 1)).toBe(0)
  })

  const h = 3600_000
  const enCurso = { estado: 'en_curso' as const, entrada: 0, ultimaActividad: 1 * h }

  it('no cierra si hubo actividad en las últimas 3 h', () => {
    expect(cierreAutomatico(enCurso, 1 * h, 3.5 * h)).toBeNull()
  })

  it('cierra con la hora de la última serie tras 3 h sin actividad', () => {
    expect(cierreAutomatico(enCurso, 0.9 * h, 4.1 * h)).toBe(0.9 * h)
  })

  it('no toca sesiones terminadas', () => {
    expect(cierreAutomatico({ ...enCurso, estado: 'terminada' }, 0, 99 * h)).toBeNull()
  })
})
