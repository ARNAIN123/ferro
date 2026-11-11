import type { ReactNode } from 'react'
import { Icono } from '../../components/Icono'
import { anadirSerie, saltarEjercicio } from '../../db/entreno'
import type { Serie } from '../../domain/tipos'
import { fmtCrono, fmtKg } from '../../lib/formato'
import { FilaSerie } from './FilaSerie'
import type { EjercicioVista } from './useEntreno'
import { nombresDeMusculos } from '../../domain/musculos'

interface Props {
  vista: EjercicioVista
  ultimaVez: Serie[] | undefined
  seleccionId: string | null
  superserieCon: string[]
  sugerencia?: ReactNode
  onSeleccionar: (id: string) => void
  onCompletar: (serie: Serie) => void
  onMenu: () => void
}

export function TarjetaEjercicio({ vista, ultimaVez, seleccionId, superserieCon, sugerencia, onSeleccionar, onCompletar, onMenu }: Props) {
  const { se, ejercicio, series, molestia } = vista
  const saltado = se.estado === 'saltado'
  let numero = 0

  return (
    <article className="anim-aparecer" aria-label={ejercicio?.nombre}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="condensada text-[1.75rem] leading-tight font-extrabold tracking-tight">{ejercicio?.nombre ?? 'Ejercicio'}</h2>
          <p className="num mt-0.5 text-base text-muted">
            {se.seriesObjetivo} × {se.repsMin}–{se.repsMax}
            <span className="font-sans font-normal">
              {' '}
              · descanso {fmtCrono(se.descansoSeg)}
              {ejercicio && ` · ${nombresDeMusculos(ejercicio.musculosPrincipales).join(', ')}`}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Opciones del ejercicio"
          className="-mr-2 grid size-12 shrink-0 place-items-center rounded-full active:bg-surface-2"
        >
          <Icono nombre="puntos" />
        </button>
      </header>

      <div className="mt-2 flex flex-wrap gap-2 empty:hidden">
        {sugerencia}
        {superserieCon.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <Icono nombre="cadena" tamano={14} /> Superserie con {superserieCon.join(' y ')}
          </span>
        )}
        {se.sustituyeA && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
            <Icono nombre="cambiar" tamano={14} /> Alternativa
          </span>
        )}
        {molestia && (
          <button
            type="button"
            onClick={onMenu}
            className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn"
          >
            <Icono nombre="aviso" tamano={14} /> Molestia{molestia.nota && `: ${molestia.nota}`}
          </button>
        )}
      </div>

      {(ejercicio?.notasFijas || se.nota) && (
        <div className="mt-3 space-y-1 rounded-2xl border border-line px-3.5 py-2.5 text-sm">
          {ejercicio?.notasFijas && (
            <p className="flex gap-2">
              <Icono nombre="nota" tamano={16} className="mt-0.5 shrink-0 text-muted" />
              <span className="whitespace-pre-line">{ejercicio.notasFijas}</span>
            </p>
          )}
          {se.nota && <p className="text-muted italic">{se.nota}</p>}
        </div>
      )}

      {ultimaVez && ultimaVez.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium">Última vez: </span>
          <span className="num font-semibold">
            {ultimaVez
              .filter((s) => s.tipo !== 'calentamiento')
              .map((s) => `${fmtKg(s.peso)}×${s.reps}`)
              .join(' · ')}
          </span>
        </p>
      )}

      {saltado ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-5 text-center">
          <p className="font-semibold">Ejercicio saltado</p>
          <button
            type="button"
            onClick={() => saltarEjercicio(se.id, false)}
            className="mt-2 min-h-12 rounded-xl px-4 font-semibold text-accent"
          >
            Hacerlo igualmente
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2" aria-label="Series">
            {series.map((s) => {
              if (s.tipo === 'normal') numero++
              return (
                <FilaSerie
                  key={s.id}
                  serie={s}
                  numero={numero}
                  seleccionada={s.id === seleccionId}
                  onSeleccionar={() => onSeleccionar(s.id)}
                  onCompletar={() => onCompletar(s)}
                />
              )
            })}
          </ul>
          <button
            type="button"
            onClick={async () => {
              const id = await anadirSerie(se.id)
              if (id) onSeleccionar(id)
            }}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line font-semibold text-muted active:bg-surface"
          >
            <Icono nombre="mas" tamano={20} /> Añadir serie
          </button>
        </>
      )}
    </article>
  )
}
