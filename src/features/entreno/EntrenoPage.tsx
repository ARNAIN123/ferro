import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Boton } from '../../components/ui'
import {
  alternarSerie,
  anadirEjercicioASesion,
  cambiarEjercicio,
  cambiarValorSerie,
  eliminarSerie,
  irAEjercicio,
  terminarSesion,
  borrarSesion,
} from '../../db/entreno'
import { ajustarPeso, grupoSuperserie } from '../../domain/entreno'
import { NOMBRE_TIPO_SERIE } from '../../domain/etiquetas'
import { nombreCorto } from '../../domain/texto'
import type { Serie } from '../../domain/tipos'
import { useAhora } from '../../hooks/useAhora'
import { useAjustes } from '../../hooks/useAjustes'
import { useWakeLock } from '../../hooks/useWakeLock'
import { fmtCrono, fmtKg } from '../../lib/formato'
import { vibrar, VIBRACION_SERIE } from '../../lib/vibrar'
import { SelectorEjercicio } from '../ejercicios/SelectorEjercicio'
import { CampoNumero } from './CampoNumero'
import { Descanso } from './Descanso'
import { MenuEjercicio } from './MenuEjercicio'
import { TarjetaEjercicio } from './TarjetaEjercicio'
import { ChipProgresion } from './ChipProgresion'
import { useEntreno, useHistorial } from './useEntreno'

export function EntrenoPage() {
  const datos = useEntreno()
  const ajustes = useAjustes()
  const navegar = useNavigate()
  useWakeLock(ajustes.wakeLock && Boolean(datos))

  const [seleccionManual, setSeleccionManual] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [selector, setSelector] = useState<'anadir' | 'cambiar' | null>(null)
  const [terminando, setTerminando] = useState(false)
  const ejerciciosHist = useMemo(
    () => datos?.ejercicios.map((e) => ({ id: e.se.ejercicioId, reinicio: e.ejercicio?.reinicioProgresion })) ?? [],
    [datos],
  )
  const historial = useHistorial(datos?.sesion.id, ejerciciosHist)
  const ahora = useAhora(1000)
  const toque = useRef<{ x: number; y: number } | null>(null)
  // Al terminar, la sesión deja de estar en curso antes de navegar al resumen: evita la redirección a Hoy.
  const [saliendo, setSaliendo] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const activoIdx = datos ? Math.max(0, datos.ejercicios.findIndex((e) => e.se.id === datos.sesion.ejercicioActivoId)) : 0
  const activo = datos?.ejercicios[activoIdx]
  const seleccion: Serie | undefined =
    activo?.series.find((s) => s.id === seleccionManual) ??
    activo?.series.find((s) => !s.completada) ??
    activo?.series[activo.series.length - 1]

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [activo?.se.id])

  if (datos === undefined) return <div className="h-dvh bg-bg" />
  if (datos === null) return saliendo ? <div className="h-dvh bg-bg" /> : <Navigate to="/" replace />

  const { sesion, ejercicios } = datos
  const ir = (i: number) => {
    const destino = ejercicios[Math.max(0, Math.min(ejercicios.length - 1, i))]
    if (destino && destino.se.id !== activo?.se.id) {
      setSeleccionManual(null)
      void irAEjercicio(sesion.id, destino.se.id)
    }
  }

  const completar = async (serie: Serie) => {
    const hecha = await alternarSerie(serie.id)
    if (hecha) vibrar(VIBRACION_SERIE, ajustes.vibracion)
    setSeleccionManual(null)
  }

  const totalSeries = ejercicios.reduce((t, e) => t + (e.se.estado === 'saltado' ? 0 : e.series.length), 0)
  const hechas = ejercicios.reduce((t, e) => t + e.series.filter((s) => s.completada).length, 0)
  const siguienteConPendientes = ejercicios.findIndex((e, i) => i > activoIdx && e.se.estado !== 'saltado' && e.pendientes > 0)
  const cualquieraConPendientes = ejercicios.findIndex((e) => e.se.estado !== 'saltado' && e.pendientes > 0)
  const grupo = activo ? grupoSuperserie(ejercicios.map((e) => ({ ...e.se, saltado: e.se.estado === 'saltado' })), activoIdx) : []
  const companeros = grupo.filter((k) => k !== activoIdx).map((k) => ejercicios[k]?.ejercicio?.nombre ?? '')

  const alDeslizar = (e: PointerEvent) => {
    const inicio = toque.current
    toque.current = null
    if (!inicio) return
    const dx = e.clientX - inicio.x
    const dy = e.clientY - inicio.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) ir(activoIdx + (dx < 0 ? 1 : -1))
  }

  const pendienteActiva = activo?.se.estado !== 'saltado' && (activo?.pendientes ?? 0) > 0
  const objetivo = seleccion && !seleccion.completada ? seleccion : activo?.series.find((s) => !s.completada)
  const numeroDe = (s: Serie) => (s.tipo === 'normal' ? activo!.series.filter((x) => x.tipo === 'normal').indexOf(s) + 1 : 0)

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      {/* Cabecera */}
      <header className="border-b border-line pt-safe">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => navegar('/')}
            aria-label="Salir del modo entreno (el entreno sigue en curso)"
            className="grid size-12 place-items-center rounded-full active:bg-surface-2"
          >
            <Icono nombre="abajo" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{sesion.rutinaNombre}</p>
            <p className="num text-xs text-muted">
              {fmtCrono((ahora - sesion.entrada) / 1000)} · {hechas}/{totalSeries} series
            </p>
          </div>
          <Boton variante="secundario" className="min-h-11 px-4 text-sm" onClick={() => setTerminando(true)}>
            Terminar
          </Boton>
        </div>
        {/* Tira de ejercicios */}
        <nav aria-label="Ejercicios del entreno" className="mx-auto max-w-lg">
          <ol className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
            {ejercicios.map((e, i) => {
              const hechasE = e.series.filter((s) => s.completada).length
              const completo = e.series.length > 0 && e.pendientes === 0
              const actual = i === activoIdx
              return (
                <li key={e.se.id} className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => ir(i)}
                    aria-current={actual ? 'step' : undefined}
                    className={`flex h-10 max-w-36 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
                      actual
                        ? 'bg-fg text-bg'
                        : completo
                          ? 'bg-accent-soft text-accent'
                          : e.se.estado === 'saltado'
                            ? 'bg-surface text-muted line-through'
                            : 'bg-surface text-fg'
                    }`}
                  >
                    {e.molestia && <span className="size-2 shrink-0 rounded-full bg-warn" aria-label="con molestia" />}
                    <span className="truncate">{e.ejercicio ? nombreCorto(e.ejercicio.nombre) : ''}</span>
                    <span className="num shrink-0 opacity-70">
                      {hechasE}/{e.series.length}
                    </span>
                  </button>
                  {e.se.superserieConSiguiente && <span className="mx-0.5 h-0.5 w-2 bg-accent" aria-hidden="true" />}
                </li>
              )
            })}
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setSelector('anadir')}
                aria-label="Añadir ejercicio"
                className="grid size-10 place-items-center rounded-full border border-dashed border-line text-muted"
              >
                <Icono nombre="mas" tamano={20} />
              </button>
            </li>
          </ol>
        </nav>
      </header>

      {/* Tarjeta del ejercicio */}
      <div
        ref={scroller}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => (toque.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={alDeslizar}
        onPointerCancel={() => (toque.current = null)}
      >
        <div className="mx-auto max-w-lg px-4 pt-4 pb-6">
          {activo ? (
            <TarjetaEjercicio
              key={activo.se.id}
              vista={activo}
              ultimaVez={historial?.get(activo.se.ejercicioId)?.ultima}
              sugerencia={
                <ChipProgresion
                  vista={activo}
                  recientes={historial?.get(activo.se.ejercicioId)?.recientes}
                  onCambiar={() => setSelector('cambiar')}
                />
              }
              seleccionId={seleccion?.id ?? null}
              superserieCon={companeros}
              onSeleccionar={setSeleccionManual}
              onCompletar={completar}
              onMenu={() => setMenuAbierto(true)}
            />
          ) : (
            <div className="py-16 text-center">
              <p className="condensada text-2xl font-bold">Entreno libre</p>
              <p className="mt-1 text-muted">Añade el primer ejercicio para empezar.</p>
              <Boton variante="primario" className="mt-5" onClick={() => setSelector('anadir')}>
                <Icono nombre="mas" tamano={20} /> Añadir ejercicio
              </Boton>
            </div>
          )}
        </div>
      </div>

      {/* Panel inferior: descanso, edición de la serie y acción principal */}
      <footer className="border-t border-line bg-bg pb-safe">
        <div className="mx-auto max-w-lg space-y-2.5 px-3 pt-2.5 pb-3">
          <Descanso sesionId={sesion.id} fin={sesion.descansoFin} duracion={sesion.descansoDuracion} vibracion={ajustes.vibracion} />

          {activo && seleccion && activo.se.estado !== 'saltado' && (
            <div>
              <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold text-muted">
                <span>
                  {seleccion.tipo === 'normal' ? `Serie ${numeroDe(seleccion)}` : NOMBRE_TIPO_SERIE[seleccion.tipo]}
                  {seleccion.completada && ' · hecha'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSeleccionManual(null)
                    void eliminarSerie(seleccion.id)
                  }}
                  className="flex min-h-9 items-center gap-1 rounded-lg px-2 active:bg-surface-2"
                >
                  <Icono nombre="papelera" tamano={16} /> Quitar serie
                </button>
              </div>
              <div className="flex gap-3">
                <CampoNumero
                  etiqueta="peso"
                  unidad="kg"
                  decimales
                  valor={seleccion.peso}
                  onCambio={(peso) => cambiarValorSerie(seleccion.id, 'peso', () => peso)}
                  onPaso={(d) => cambiarValorSerie(seleccion.id, 'peso', (p) => ajustarPeso(p, activo.ejercicio?.saltoPeso ?? 2.5, d))}
                />
                <CampoNumero
                  etiqueta="repeticiones"
                  unidad="reps"
                  valor={seleccion.reps}
                  onCambio={(reps) => cambiarValorSerie(seleccion.id, 'reps', () => reps)}
                  onPaso={(d) => cambiarValorSerie(seleccion.id, 'reps', (r) => r + d)}
                />
              </div>
            </div>
          )}

          {pendienteActiva && objetivo ? (
            <Boton variante="primario" grande className="w-full" onClick={() => completar(objetivo)}>
              <Icono nombre="check" grosor={3} />
              <span>
                {objetivo.tipo === 'normal' ? `Serie ${numeroDe(objetivo)}` : NOMBRE_TIPO_SERIE[objetivo.tipo]}
                <span className="num ml-2 font-bold opacity-80">
                  {fmtKg(objetivo.peso)} × {objetivo.reps}
                </span>
              </span>
            </Boton>
          ) : siguienteConPendientes >= 0 || cualquieraConPendientes >= 0 ? (
            <Boton variante="primario" grande className="w-full" onClick={() => ir(siguienteConPendientes >= 0 ? siguienteConPendientes : cualquieraConPendientes)}>
              <span className="truncate">
                Siguiente: {ejercicios[siguienteConPendientes >= 0 ? siguienteConPendientes : cualquieraConPendientes]?.ejercicio?.nombre}
              </span>
              <Icono nombre="adelante" />
            </Boton>
          ) : (
            <Boton variante="primario" grande className="w-full" onClick={() => setTerminando(true)} disabled={hechas === 0}>
              <Icono nombre="bandera" /> Terminar entreno
            </Boton>
          )}
        </div>
      </footer>

      <MenuEjercicio
        vista={menuAbierto && activo ? activo : null}
        onCerrar={() => setMenuAbierto(false)}
        onCambiar={() => {
          setMenuAbierto(false)
          setSelector('cambiar')
        }}
      />

      <SelectorEjercicio
        abierta={selector !== null}
        onCerrar={() => setSelector(null)}
        titulo={selector === 'cambiar' ? 'Cambiar por…' : 'Añadir ejercicio'}
        musculo={selector === 'cambiar' ? activo?.ejercicio?.musculoPrincipal : undefined}
        excluir={selector === 'cambiar' && activo ? [activo.se.ejercicioId] : []}
        onElegir={async (e) => {
          const modo = selector
          setSelector(null)
          setSeleccionManual(null)
          if (modo === 'cambiar' && activo) await cambiarEjercicio(activo.se.id, e.id)
          else await anadirEjercicioASesion(sesion.id, e.id)
        }}
      />

      <Hoja abierta={terminando} onCerrar={() => setTerminando(false)} titulo="¿Terminar el entreno?">
        <div className="space-y-3 pb-2">
          {hechas === 0 ? (
            <p className="text-muted">No has completado ninguna serie, así que no se guardará ningún entreno.</p>
          ) : (
            totalSeries > hechas && (
              <p className="text-muted">
                Quedan {totalSeries - hechas} series sin marcar. No se guardarán; las que has hecho, sí.
              </p>
            )
          )}
          <Boton
            variante="primario"
            grande
            className="w-full"
            onClick={async () => {
              setSaliendo(true)
              const guardada = await terminarSesion(sesion.id)
              setTerminando(false)
              navegar(guardada ? `/entreno/resumen/${sesion.id}` : '/', { replace: true })
            }}
          >
            {hechas === 0 ? 'Salir sin guardar' : 'Terminar y ver resumen'}
          </Boton>
          <Boton className="w-full" onClick={() => setTerminando(false)}>
            Seguir entrenando
          </Boton>
          {hechas > 0 && (
            <Boton
              variante="peligro"
              className="w-full"
              onClick={async () => {
                if (!confirm('¿Descartar este entreno? Se borrarán todas sus series.')) return
                setSaliendo(true)
                await borrarSesion(sesion.id)
                navegar('/', { replace: true })
              }}
            >
              Descartar entreno
            </Boton>
          )}
        </div>
      </Hoja>
    </div>
  )
}
