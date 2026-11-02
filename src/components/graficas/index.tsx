import { lazy, Suspense, type ComponentType } from 'react'

// Recharts va en un trozo aparte: el arranque y el modo entreno no lo necesitan.
function perezosa<P extends object>(cargar: () => Promise<ComponentType<P>>, alto: number) {
  const Grafica = lazy(async () => ({ default: await cargar() }))
  return function GraficaPerezosa(props: P) {
    return (
      <Suspense fallback={<div style={{ height: alto }} className="animate-pulse rounded-2xl bg-surface-2/60" />}>
        <Grafica {...props} />
      </Suspense>
    )
  }
}

const modulo = () => import('./Graficas')

export const GraficaE1rm = perezosa(async () => (await modulo()).GraficaE1rm, 200)
export const GraficaVolumen = perezosa(async () => (await modulo()).GraficaVolumen, 160)
export const GraficaAsistencia = perezosa(async () => (await modulo()).GraficaAsistencia, 150)
export const GraficaMusculos = perezosa(async () => (await modulo()).GraficaMusculos, 200)
export const GraficaPeso = perezosa(async () => (await modulo()).GraficaPeso, 220)
