import { lazy, Suspense, useMemo, useState } from 'react'
import { Segmentado, Tarjeta } from '../../components/ui'
import { haceMeses, type CuerpoDelDia } from '../../domain/cuerpo'
import { claveDia } from '../../domain/semanas'
import type { Musculo } from '../../domain/tipos'
import { useCuerpo } from '../../hooks/useCuerpo'
import { fmtKg } from '../../lib/formato'

const Cuerpo3D = lazy(() => import('../../components/cuerpo3d/Cuerpo3D').then((m) => ({ default: m.Cuerpo3D })))
const SIN_NIVELES: ReadonlyMap<Musculo, number> = new Map()
type Plazo = '1' | '3' | '6'
const signo = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtKg(Math.abs(v))}`

/** Mi avatar de hace 1, 3 o 6 meses al lado del de ahora, girando a la vez. */
export function AntesAhora() {
  const [plazo, setPlazo] = useState<Plazo>('3')
  const hoy = claveDia(Date.now())
  const ahora = useCuerpo()
  const antes = useCuerpo(haceMeses(hoy, Number(plazo)))
  const cuerpos = useMemo(() => (antes && ahora ? [antes.datos, ahora.datos] : []), [antes, ahora])
  const hayAntes = antes?.kg != null

  return (
    <Tarjeta>
      <h2 className="mb-3 font-bold">Antes / Ahora</h2>
      <Segmentado<Plazo>
        etiqueta="Comparar con hace"
        valor={plazo}
        onCambio={setPlazo}
        opciones={[
          { valor: '1', texto: 'Hace 1 mes' },
          { valor: '3', texto: '3 meses' },
          { valor: '6', texto: '6 meses' },
        ]}
      />
      {!antes || !ahora ? null : !hayAntes ? (
        <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-3 text-sm text-muted">
          Hace {plazo === '1' ? 'un mes' : `${plazo} meses`} aún no tenías ningún peso registrado. Cuando lleves ese tiempo apuntando tu peso, aquí verás cómo has cambiado.
        </p>
      ) : (
        <>
          <Suspense fallback={<div className="aspect-square w-full" aria-hidden />}>
            <Cuerpo3D niveles={SIN_NIVELES} cuerpos={cuerpos} proporcion="aspect-square" className="mt-2" />
          </Suspense>
          <div className="mt-1 grid grid-cols-2 gap-3 text-center text-sm">
            <Resumen titulo={`Hace ${plazo === '1' ? '1 mes' : `${plazo} meses`}`} c={antes} />
            <Resumen titulo="Ahora" c={ahora} />
          </div>
          <Cambios antes={antes} ahora={ahora} />
        </>
      )}
    </Tarjeta>
  )
}

function Resumen({ titulo, c }: { titulo: string; c: CuerpoDelDia }) {
  return (
    <p>
      <span className="block text-xs font-semibold tracking-wide text-muted uppercase">{titulo}</span>
      <span className="num text-lg font-bold">{fmtKg(c.datos.kg)} kg</span>
      {c.grasa && <span className="num block text-muted">{fmtKg(c.grasa.pct)} % de grasa</span>}
    </p>
  )
}

function Cambios({ antes, ahora }: { antes: CuerpoDelDia; ahora: CuerpoDelDia }) {
  const lineas: string[] = [`${signo(Math.round((ahora.datos.kg - antes.datos.kg) * 10) / 10)} kg`]
  if (antes.grasa && ahora.grasa && antes.grasa.pct !== ahora.grasa.pct) lineas.push(`${signo(Math.round((ahora.grasa.pct - antes.grasa.pct) * 10) / 10)} puntos de grasa`)
  for (const m of ['cintura', 'pecho', 'brazo', 'muslo'] as const) {
    const a = antes.datos.medidas?.[m]
    const b = ahora.datos.medidas?.[m]
    if (a && b && a !== b) lineas.push(`${m} ${signo(Math.round((b - a) * 10) / 10)} cm`)
  }
  return <p className="mt-2 border-t border-line pt-2 text-center text-sm text-muted">Cambio: {lineas.join(' · ')}</p>
}
