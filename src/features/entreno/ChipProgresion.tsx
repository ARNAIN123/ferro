import { useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Boton } from '../../components/ui'
import { aplicarValores, descargarEjercicio } from '../../db/entreno'
import { asignarObjetivos, descarga, estancado, sugerenciaAplicada, sugerirProgresion } from '../../domain/progresion'
import { saltoDe } from '../../domain/etiquetas'
import type { Serie } from '../../domain/tipos'
import { fmtKg } from '../../lib/formato'
import type { EjercicioVista } from './useEntreno'

interface Props {
  vista: EjercicioVista
  recientes: Serie[][] | undefined
  onCambiar: () => void
}

/**
 * Etiqueta discreta con la sugerencia de progresión ("↑ 2,5 kg", "+1 rep").
 * Nunca cambia nada sola: solo se aplica al tocarla.
 */
export function ChipProgresion({ vista, recientes, onCambiar }: Props) {
  const [aviso, setAviso] = useState(false)
  const { se, ejercicio, series } = vista
  if (!recientes || !ejercicio || se.estado === 'saltado') return null

  const sugerencia = recientes[0]
    ? sugerirProgresion(recientes[0], {
        seriesObjetivo: se.seriesObjetivo,
        repsMin: se.repsMin,
        repsMax: se.repsMax,
        salto: saltoDe(ejercicio.material),
      })
    : null
  const atascado = estancado(recientes)
  const hayPendientes = series.some((s) => !s.completada && s.tipo === 'normal')
  const aplicada = sugerencia ? sugerenciaAplicada(series, sugerencia.objetivos) : false

  const texto =
    sugerencia?.tipo === 'subir_peso' ? `↑ ${fmtKg(sugerencia.delta)} kg` : sugerencia?.tipo === 'subir_reps' ? '+1 rep' : 'Mantener'
  const pesoActual = Math.max(0, ...series.filter((s) => s.tipo === 'normal' && !s.completada).map((s) => s.peso))

  return (
    <>
      {sugerencia && hayPendientes && (
        <button
          type="button"
          disabled={aplicada}
          onClick={() => aplicarValores(asignarObjetivos(series, sugerencia.objetivos))}
          aria-label={aplicada ? `Sugerencia aplicada: ${texto}` : `Aplicar sugerencia: ${texto}`}
          className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-bold transition ${
            aplicada ? 'border-transparent bg-surface-2 text-muted' : 'border-accent/50 text-accent active:bg-accent-soft'
          }`}
        >
          {aplicada && <Icono nombre="check" tamano={14} grosor={3} />}
          <span className="num text-sm">{texto}</span>
        </button>
      )}
      {atascado && (
        <button
          type="button"
          onClick={() => setAviso(true)}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-warn/15 px-2.5 text-xs font-semibold text-warn"
        >
          <Icono nombre="aviso" tamano={14} /> Estancado
        </button>
      )}

      <Hoja abierta={aviso} onCerrar={() => setAviso(false)} titulo="Estancamiento">
        <p className="text-muted">
          Llevas 3 sesiones seguidas sin mejorar en <span className="font-semibold text-fg">{ejercicio.nombre}</span>, ni en peso ni en
          repeticiones. Dos opciones:
        </p>
        <div className="mt-4 grid gap-2 pb-2">
          <Boton
            variante="primario"
            className="justify-start text-left"
            disabled={!hayPendientes}
            onClick={async () => {
              await descargarEjercicio(se.id)
              setAviso(false)
            }}
          >
            <Icono nombre="historial" tamano={20} />
            <span>
              Bajar un 10 % y reconstruir
              {pesoActual > 0 && (
                <span className="num ml-1 font-normal opacity-80">
                  ({fmtKg(pesoActual)} → {fmtKg(descarga(pesoActual, saltoDe(ejercicio.material)))} kg)
                </span>
              )}
            </span>
          </Boton>
          <Boton
            className="justify-start"
            onClick={() => {
              setAviso(false)
              onCambiar()
            }}
          >
            <Icono nombre="cambiar" tamano={20} /> Cambiar de ejercicio
          </Boton>
        </div>
      </Hoja>
    </>
  )
}
