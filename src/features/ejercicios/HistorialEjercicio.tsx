import { Link } from 'react-router'
import { Icono } from '../../components/Icono'
import { Vacio } from '../../components/ui'
import type { EntradaHistorial } from '../../db/consultas'
import { epley } from '../../domain/marcas'
import { fmtFechaCorta, fmtKg } from '../../lib/formato'

export function HistorialEjercicio({ historial }: { historial: EntradaHistorial[] }) {
  if (historial.length === 0) return <Vacio titulo="Aún no lo has hecho">Su historial aparecerá aquí.</Vacio>
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {historial.map(({ sesion, series, molestia }) => {
        const efectivas = series.filter((s) => s.tipo !== 'calentamiento')
        const mejor = Math.max(0, ...efectivas.map((s) => epley(s.peso, s.reps)))
        return (
          <li key={sesion.id}>
            <Link to={`/progreso/historial/${sesion.id}`} className="block px-4 py-3 active:bg-surface-2">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{fmtFechaCorta(sesion.entrada)}</span>
                <span className="truncate text-sm text-muted">{sesion.rutinaNombre}</span>
              </span>
              <span className="num mt-1 block text-base">
                {efectivas.map((s) => `${fmtKg(s.peso)}×${s.reps}${s.tipo === 'drop' ? 'D' : ''}`).join('  ·  ') || '—'}
              </span>
              {mejor > 0 && <span className="text-xs text-muted">1RM estimado {fmtKg(Math.round(mejor * 10) / 10)} kg</span>}
              {molestia && (
                <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-warn">
                  <Icono nombre="aviso" tamano={16} /> Molestia{molestia.nota && `: ${molestia.nota}`}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
