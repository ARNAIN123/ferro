import { describe, expect, it } from 'vitest'
import {
  ESCALAS,
  gruposSinTrabajar,
  nivelesDeEjercicio,
  nivelesDeTrabajo,
  nivelIntensidad,
  rotulosEscala,
  trabajoMuscular,
} from './mapaMuscular'
import type { Musculo } from './tipos'

const ejercicios = new Map<string, { musculosPrincipales: Musculo[]; musculosSecundarios: Musculo[] }>([
  ['banca', { musculosPrincipales: ['pectoral_inferior'], musculosSecundarios: ['triceps', 'deltoides_anterior'] }],
  ['hipthrust', { musculosPrincipales: ['gluteo_mayor'], musculosSecundarios: ['isquiotibiales'] }],
  ['peso-muerto', { musculosPrincipales: ['lumbares', 'isquiotibiales'], musculosSecundarios: ['gluteo_mayor', 'isquiotibiales'] }],
])

describe('intensidad muscular', () => {
  it('cada serie cuenta 1 para principales y 0,5 para secundarios', () => {
    const t = trabajoMuscular(
      [
        { ejercicioId: 'banca', tipo: 'normal' },
        { ejercicioId: 'banca', tipo: 'normal' },
        { ejercicioId: 'banca', tipo: 'drop' },
      ],
      ejercicios,
    )
    expect(t.get('pectoral_inferior')?.series).toBe(3)
    expect(t.get('triceps')?.series).toBe(1.5)
    expect(t.get('deltoides_anterior')?.series).toBe(1.5)
  })

  it('los calentamientos no cuentan', () => {
    const t = trabajoMuscular([{ ejercicioId: 'banca', tipo: 'calentamiento' }], ejercicios)
    expect(t.size).toBe(0)
  })

  it('suma varios ejercicios y recuerda cuánto aportó cada uno', () => {
    const t = trabajoMuscular(
      [
        { ejercicioId: 'hipthrust', tipo: 'normal' },
        { ejercicioId: 'peso-muerto', tipo: 'normal' },
      ],
      ejercicios,
    )
    expect(t.get('gluteo_mayor')?.series).toBe(1.5)
    expect(t.get('gluteo_mayor')?.porEjercicio.get('hipthrust')).toBe(1)
    expect(t.get('gluteo_mayor')?.porEjercicio.get('peso-muerto')).toBe(0.5)
    // Un músculo que es principal y secundario a la vez solo cuenta como principal.
    expect(t.get('isquiotibiales')?.porEjercicio.get('peso-muerto')).toBe(1)
  })

  it('una rutina cuenta sus series previstas', () => {
    const t = trabajoMuscular([{ ejercicioId: 'banca', cantidad: 4 }], ejercicios)
    expect(t.get('pectoral_inferior')?.series).toBe(4)
    expect(t.get('triceps')?.series).toBe(2)
  })
})

describe('niveles de intensidad', () => {
  it('0 sin trabajo, 1 con cualquier cosa y hasta 5', () => {
    expect([0, 0.5, 2, 4, 6, 9, 30].map((v) => nivelIntensidad(v, ESCALAS.sesion))).toEqual([0, 1, 2, 3, 4, 5, 5])
    expect([3, 10, 15, 20].map((v) => nivelIntensidad(v, ESCALAS.semana))).toEqual([1, 3, 4, 5])
  })

  it('en periodos largos usa la media semanal', () => {
    const t = trabajoMuscular(Array.from({ length: 40 }, () => ({ ejercicioId: 'banca', tipo: 'normal' as const })), ejercicios)
    expect(nivelesDeTrabajo(t, ESCALAS.semana, 30 / 7).get('pectoral_inferior')).toBe(3) // 40 series en 30 días ≈ 9,3/semana
  })

  it('el mapa de un ejercicio marca principales al máximo y secundarios suaves', () => {
    const n = nivelesDeEjercicio(ejercicios.get('banca')!)
    expect(n.get('pectoral_inferior')).toBe(5)
    expect(n.get('triceps')).toBe(2)
  })

  it('rótulos de la leyenda', () => {
    expect(rotulosEscala(ESCALAS.semana)).toEqual(['1–3', '4–6', '7–10', '11–15', '16+'])
    expect(rotulosEscala(ESCALAS.sesion)).toEqual(['1', '2–3', '4–5', '6–8', '9+'])
  })
})

describe('aviso de grupos sin trabajar', () => {
  it('detecta grupos grandes ausentes en el ciclo', () => {
    const t = trabajoMuscular([{ ejercicioId: 'banca', cantidad: 4 }], ejercicios)
    expect(gruposSinTrabajar(t)).toEqual(['Espalda', 'Cuádriceps', 'Isquiotibiales', 'Glúteos'])
  })

  it('basta con un trabajo secundario suficiente', () => {
    const t = trabajoMuscular([{ ejercicioId: 'hipthrust', cantidad: 4 }], ejercicios)
    expect(gruposSinTrabajar(t)).not.toContain('Isquiotibiales')
    expect(gruposSinTrabajar(t)).not.toContain('Glúteos')
  })
})
