import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { MiniaturaEjercicio } from '../../components/ImagenEjercicio'
import { ListaOrdenable } from '../../components/ListaOrdenable'
import { MapaConDetalle } from '../../components/mapa/MapaConDetalle'
import { Boton, claseInput, Tarjeta, Vacio } from '../../components/ui'
import { detalleSesion } from '../../db/consultas'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import { archivarRutina, guardarRutina } from '../../db/rutinas'
import { valoresPorDefecto } from '../../domain/biblioteca'
import { rutinasDelCiclo } from '../../domain/ciclo'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { ESCALAS, gruposSinTrabajar, nivelesDeTrabajo, rotulosEscala, trabajoMuscular } from '../../domain/mapaMuscular'
import { ajustarItem, alternarSuperserie, normalizarPlan, planDesdeSesion, type ItemPlan } from '../../domain/rutinas'
import type { Ejercicio } from '../../domain/tipos'
import { avisar } from '../../lib/avisos'
import { fmtCrono, plural } from '../../lib/formato'
import { nuevoId } from '../../lib/id'
import { SelectorEjercicios } from '../ejercicios/SelectorEjercicios'

interface Borrador {
  id: string | null
  nombre: string
  items: ItemPlan[]
}

/**
 * Crear o editar una rutina en una sola pantalla: nombre → añadir ejercicios → ajustar → guardar.
 * Los cambios se guardan de una vez con "Guardar". `/rutinas/nueva?desde=<sesión>` parte de un entreno hecho.
 */
export function RutinaPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const desde = params.get('desde')
  const navegar = useNavigate()
  const esNueva = !id || id === 'nueva'

  const [borrador, setBorrador] = useState<Borrador | null | undefined>(undefined)
  const [sucio, setSucio] = useState(false)
  const [selector, setSelector] = useState(false)
  const [archivada, setArchivada] = useState(false)

  // Carga inicial del borrador (una vez por ruta).
  useEffect(() => {
    let vivo = true
    void (async () => {
      if (!esNueva) {
        const rutina = await db.rutinas.get(id)
        const plan = rutina ? await db.rutinaEjercicios.where('rutinaId').equals(rutina.id).sortBy('orden') : []
        if (!vivo) return
        setArchivada(rutina?.archivada ?? false)
        setBorrador(rutina ? { id: rutina.id, nombre: rutina.nombre, items: plan.map((p) => ({ ...p, clave: p.id })) } : null)
        setSucio(false)
        return
      }
      if (desde) {
        const detalle = await detalleSesion(desde)
        if (!vivo) return
        const items = detalle ? planDesdeSesion(detalle.bloques.map((b) => ({ ...b.se, series: b.series })), () => nuevoId()) : []
        const nombre = detalle?.sesion.rutinaId ? `${detalle.sesion.rutinaNombre} (copia)` : ''
        setBorrador({ id: null, nombre, items })
        setSucio(items.length > 0)
        return
      }
      setBorrador({ id: null, nombre: '', items: [] })
    })()
    return () => {
      vivo = false
    }
  }, [id, desde, esNueva])

  const fichas = useLiveQuery(async () => new Map((await db.ejercicios.toArray()).map((e) => [e.id, e])), [])
  const otras = useLiveQuery(async () => {
    const ids = new Set(rutinasDelCiclo(await db.rutinas.toArray()).filter((r) => r.id !== id).map((r) => r.id))
    return (await db.rutinaEjercicios.toArray()).filter((p) => ids.has(p.rutinaId))
  }, [id])

  const trabajo = useMemo(
    () => trabajoMuscular((borrador?.items ?? []).map((i) => ({ ejercicioId: i.ejercicioId, cantidad: i.series })), fichas ?? new Map()),
    [borrador, fichas],
  )
  const sinTrabajar = useMemo(() => {
    if (!borrador || borrador.items.length === 0 || !fichas || !otras) return []
    const todo = [...otras, ...(archivada ? [] : borrador.items)].map((p) => ({ ejercicioId: p.ejercicioId, cantidad: p.series }))
    return gruposSinTrabajar(trabajoMuscular(todo, fichas))
  }, [borrador, fichas, otras, archivada])
  const nombres = useMemo(() => new Map([...(fichas ?? new Map<string, Ejercicio>())].map(([k, e]) => [k, e.nombre])), [fichas])

  if (borrador === null)
    return (
      <>
        <Cabecera titulo="Rutina" atras="/rutinas" />
        <Vacio titulo="Esta rutina no existe" />
      </>
    )
  if (!borrador || !fichas) return <Cabecera titulo={esNueva ? 'Nueva rutina' : ''} atras="/rutinas" />

  const cambiar = (items: ItemPlan[]) => {
    setBorrador({ ...borrador, items: normalizarPlan(items) })
    setSucio(true)
  }
  const ajustar = (i: number, campo: Parameters<typeof ajustarItem>[1], delta: number) =>
    cambiar(borrador.items.map((x, k) => (k === i ? ajustarItem(x, campo, delta) : x)))

  const anadir = (ids: string[]) => {
    const nuevos = ids
      .map((ejercicioId) => fichas.get(ejercicioId))
      .filter((e): e is Ejercicio => Boolean(e))
      .map((e) => ({ clave: nuevoId(), ejercicioId: e.id, nota: '', superserieConSiguiente: false, ...valoresPorDefecto(e) }))
    cambiar([...borrador.items, ...nuevos])
    setSelector(false)
  }

  const valido = borrador.nombre.trim().length > 0 && borrador.items.length > 0
  const totalSeries = borrador.items.reduce((t, p) => t + p.series, 0)
  const guardar = async () => {
    if (!valido) return
    const rutinaId = await guardarRutina({ ...borrador, nombre: borrador.nombre.trim() })
    setSucio(false)
    avisar('Rutina guardada')
    if (esNueva) navegar(`/rutinas/${rutinaId}`, { replace: true })
  }
  const salir = () => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) return
    navegar('/rutinas')
  }

  return (
    <>
      <header className="pt-safe">
        <div className="flex min-h-16 items-center gap-2 pt-3">
          <button type="button" aria-label="Volver" onClick={salir} className="-ml-3 grid size-12 shrink-0 place-items-center rounded-full active:bg-surface-2">
            <Icono nombre="atras" />
          </button>
          <h1 className="condensada flex-1 truncate text-3xl font-extrabold tracking-tight">{esNueva ? 'Nueva rutina' : 'Editar rutina'}</h1>
        </div>
      </header>

      <label className="mt-2 block">
        <span className="sr-only">Nombre de la rutina</span>
        <input
          className={`${claseInput} condensada text-xl font-bold`}
          value={borrador.nombre}
          onChange={(e) => {
            setBorrador({ ...borrador, nombre: e.target.value })
            setSucio(true)
          }}
          placeholder="Nombre, p. ej. A — Torso"
        />
      </label>

      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <h2 className="font-bold">Ejercicios</h2>
        <span className="text-sm text-muted">{totalSeries} {plural(totalSeries, 'serie')}</span>
      </div>

      {borrador.items.length === 0 ? (
        <Vacio titulo="Sin ejercicios todavía">Añade varios de golpe; luego ajusta series, repeticiones y descanso aquí mismo.</Vacio>
      ) : (
        <ListaOrdenable items={borrador.items.map((x) => ({ ...x, id: x.clave }))} onOrdenar={(l) => cambiar(l)}>
          {(item, asa) => {
            const i = borrador.items.findIndex((x) => x.clave === item.clave)
            const e = fichas.get(item.ejercicioId)
            const ultimo = i === borrador.items.length - 1
            return (
              <Fragment>
                <div className={`rounded-3xl border bg-surface ${item.superserieConSiguiente ? 'border-accent/60' : 'border-line'}`}>
                  <div className="flex items-center gap-2 pr-1">
                    {asa}
                    {e && <MiniaturaEjercicio ejercicio={e} className="size-12" />}
                    <span className="min-w-0 flex-1 py-2">
                      <span className="line-clamp-2 leading-snug font-semibold">{e?.nombre ?? 'Ejercicio eliminado'}</span>
                      <span className="block truncate text-xs text-muted">{e?.musculosPrincipales.map((m) => NOMBRE_MUSCULO[m]).join(', ')}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${e?.nombre ?? 'ejercicio'}`}
                      onClick={() => cambiar(borrador.items.filter((_, k) => k !== i))}
                      className="grid size-11 shrink-0 place-items-center rounded-full text-muted active:bg-surface-2"
                    >
                      <Icono nombre="cerrar" tamano={20} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 border-t border-line px-3 py-1.5">
                    <MiniPaso etiqueta="Series" valor={String(item.series)} onMenos={() => ajustar(i, 'series', -1)} onMas={() => ajustar(i, 'series', 1)} />
                    <MiniPaso etiqueta="Descanso" valor={fmtCrono(item.descansoSeg)} onMenos={() => ajustar(i, 'descansoSeg', -15)} onMas={() => ajustar(i, 'descansoSeg', 15)} />
                    <MiniPaso etiqueta="Reps mín." valor={String(item.repsMin)} onMenos={() => ajustar(i, 'repsMin', -1)} onMas={() => ajustar(i, 'repsMin', 1)} />
                    <MiniPaso etiqueta="Reps máx." valor={String(item.repsMax)} onMenos={() => ajustar(i, 'repsMax', -1)} onMas={() => ajustar(i, 'repsMax', 1)} />
                  </div>
                </div>
                {!ultimo && (
                  <div className="flex justify-center py-1">
                    <button
                      type="button"
                      onClick={() => cambiar(alternarSuperserie(borrador.items, i))}
                      aria-pressed={item.superserieConSiguiente}
                      className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                        item.superserieConSiguiente ? 'bg-accent text-accent-ink' : 'text-muted active:bg-surface-2'
                      }`}
                    >
                      <Icono nombre="cadena" tamano={14} /> {item.superserieConSiguiente ? 'En superserie' : 'Superserie'}
                    </button>
                  </div>
                )}
                {ultimo && <div className="h-2" />}
              </Fragment>
            )
          }}
        </ListaOrdenable>
      )}

      <Boton className="mt-2 w-full" onClick={() => setSelector(true)}>
        <Icono nombre="mas" tamano={20} /> Añadir ejercicios
      </Boton>

      {borrador.items.length > 0 && (
        <Tarjeta className="mt-5">
          <h2 className="font-bold">Músculos que cubre</h2>
          <MapaConDetalle
            trabajo={trabajo}
            niveles={nivelesDeTrabajo(trabajo, ESCALAS.sesion)}
            nombres={nombres}
            rotulos={rotulosEscala(ESCALAS.sesion)}
            unidad="series"
            periodo="en la rutina"
            alto="h-64"
          />
          {sinTrabajar.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-warn/10 px-3 py-2.5 text-sm text-warn">
              <Icono nombre="aviso" tamano={18} className="mt-0.5 shrink-0" />
              <span>
                Ningún día de tu ciclo trabaja: <span className="font-semibold">{sinTrabajar.join(', ').toLowerCase()}</span>.
              </span>
            </p>
          )}
        </Tarjeta>
      )}

      {!esNueva && borrador.id && (
        <div className="mt-6 grid gap-2">
          {!archivada && !sucio && (
            <Boton
              onClick={async () => {
                await iniciarSesion(borrador.id!)
                navegar('/entreno')
              }}
            >
              <Icono nombre="play" tamano={20} /> Empezar esta rutina
            </Boton>
          )}
          <Boton
            variante="fantasma"
            className="text-muted"
            onClick={async () => {
              await archivarRutina(borrador.id!, !archivada)
              setArchivada(!archivada)
            }}
          >
            <Icono nombre="archivar" tamano={20} /> {archivada ? 'Recuperar al ciclo' : 'Archivar rutina'}
          </Boton>
        </div>
      )}

      {/* Guardar siempre al alcance del pulgar, por encima de la barra inferior. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-1 mt-6 rounded-3xl bg-bg/90 p-1 backdrop-blur">
        <Boton variante="primario" grande className="w-full" disabled={!valido || (!sucio && !esNueva)} onClick={guardar}>
          <Icono nombre="check" grosor={3} /> {sucio || esNueva ? 'Guardar rutina' : 'Guardada'}
        </Boton>
      </div>

      <SelectorEjercicios
        abierto={selector}
        titulo="Añadir ejercicios"
        excluir={borrador.items.map((x) => x.ejercicioId)}
        onCerrar={() => setSelector(false)}
        onConfirmar={anadir}
      />
    </>
  )
}

function MiniPaso({ etiqueta, valor, onMenos, onMas }: { etiqueta: string; valor: string; onMenos: () => void; onMas: () => void }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-xs text-muted">{etiqueta}</span>
      <span className="flex items-center">
        <button type="button" aria-label={`Menos ${etiqueta.toLowerCase()}`} onClick={onMenos} className="grid size-11 place-items-center rounded-xl active:bg-surface-2">
          <Icono nombre="menos" tamano={18} />
        </button>
        <span className="num w-10 text-center text-lg">{valor}</span>
        <button type="button" aria-label={`Más ${etiqueta.toLowerCase()}`} onClick={onMas} className="grid size-11 place-items-center rounded-xl active:bg-surface-2">
          <Icono nombre="mas" tamano={18} />
        </button>
      </span>
    </div>
  )
}
