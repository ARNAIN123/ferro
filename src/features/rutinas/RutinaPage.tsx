import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { ListaOrdenable } from '../../components/ListaOrdenable'
import { Boton, claseInput, Etiqueta, Interruptor, Vacio } from '../../components/ui'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import {
  actualizarEjercicioDeRutina,
  anadirEjercicioARutina,
  archivarRutina,
  ordenarEjerciciosDeRutina,
  quitarEjercicioDeRutina,
  renombrarRutina,
} from '../../db/rutinas'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { Ejercicio, RutinaEjercicio } from '../../domain/tipos'
import { fmtCrono } from '../../lib/formato'
import { Paso } from '../ajustes/Paso'
import { SelectorEjercicio } from '../ejercicios/SelectorEjercicio'

export function RutinaPage() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const datos = useLiveQuery(async () => {
    const rutina = await db.rutinas.get(id)
    if (!rutina) return { rutina: null, plan: [], ejercicios: new Map<string, Ejercicio>() }
    const plan = await db.rutinaEjercicios.where('rutinaId').equals(id).sortBy('orden')
    const ejercicios = new Map((await db.ejercicios.bulkGet(plan.map((p) => p.ejercicioId))).filter((e) => !!e).map((e) => [e.id, e]))
    return { rutina, plan, ejercicios }
  }, [id])
  const [nombre, setNombre] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [selector, setSelector] = useState(false)

  const nombreGuardado = datos?.rutina?.nombre
  useEffect(() => {
    if (nombreGuardado !== undefined) setNombre(nombreGuardado)
  }, [nombreGuardado])

  if (!datos) return <Cabecera titulo="" atras="/rutinas" />
  const { rutina, plan, ejercicios } = datos
  if (!rutina)
    return (
      <>
        <Cabecera titulo="Rutina" atras="/rutinas" />
        <Vacio titulo="Esta rutina no existe" />
      </>
    )

  const guardarNombre = () => {
    const limpio = nombre.trim()
    if (limpio && limpio !== rutina.nombre) void renombrarRutina(rutina.id, limpio)
    else setNombre(rutina.nombre)
  }

  return (
    <>
      <Cabecera titulo={rutina.nombre} subtitulo={rutina.archivada ? 'Archivada' : 'Editar rutina'} atras="/rutinas" />

      <label className="mt-3 block">
        <span className="sr-only">Nombre de la rutina</span>
        <input
          className={`${claseInput} condensada text-lg font-bold`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarNombre}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Ej. A — Torso"
        />
      </label>

      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <h2 className="font-bold">Ejercicios</h2>
        <span className="text-sm text-muted">{plan.reduce((t, p) => t + p.series, 0)} series</span>
      </div>

      {plan.length === 0 ? (
        <Vacio titulo="Rutina vacía">Añade los ejercicios en el orden en que los haces.</Vacio>
      ) : (
        <ListaOrdenable items={plan} onOrdenar={(l) => ordenarEjerciciosDeRutina(l.map((p) => p.id))} className="space-y-2">
          {(p, asa) => (
            <FilaPlan
              p={p}
              ejercicio={ejercicios.get(p.ejercicioId)}
              asa={asa}
              abierto={abierto === p.id}
              onAlternar={() => setAbierto(abierto === p.id ? null : p.id)}
              esUltimo={plan[plan.length - 1]?.id === p.id}
            />
          )}
        </ListaOrdenable>
      )}

      <Boton className="mt-3 w-full" onClick={() => setSelector(true)}>
        <Icono nombre="mas" tamano={20} /> Añadir ejercicio
      </Boton>

      <div className="mt-8 grid gap-2">
        {!rutina.archivada && plan.length > 0 && (
          <Boton
            variante="primario"
            grande
            onClick={async () => {
              await iniciarSesion(rutina.id)
              navegar('/entreno')
            }}
          >
            <Icono nombre="play" /> Empezar esta rutina
          </Boton>
        )}
        <Boton variante="fantasma" className="text-muted" onClick={() => archivarRutina(rutina.id, !rutina.archivada)}>
          <Icono nombre="archivar" tamano={20} /> {rutina.archivada ? 'Recuperar al ciclo' : 'Archivar rutina'}
        </Boton>
      </div>

      <SelectorEjercicio
        abierta={selector}
        onCerrar={() => setSelector(false)}
        titulo="Añadir ejercicio"
        onElegir={async (e) => {
          await anadirEjercicioARutina(rutina.id, e.id)
          setSelector(false)
        }}
      />
    </>
  )
}

interface FilaProps {
  p: RutinaEjercicio
  ejercicio: Ejercicio | undefined
  asa: ReactNode
  abierto: boolean
  onAlternar: () => void
  esUltimo: boolean
}

function FilaPlan({ p, ejercicio, asa, abierto, onAlternar, esUltimo }: FilaProps) {
  const [nota, setNota] = useState(p.nota)
  const cambiar = (c: Partial<RutinaEjercicio>) => actualizarEjercicioDeRutina(p.id, c)

  return (
    <div className={`rounded-3xl border border-line bg-surface ${p.superserieConSiguiente ? 'rounded-b-lg border-b-accent/60' : ''}`}>
      <div className="flex items-center pr-1">
        {asa}
        <button type="button" onClick={onAlternar} aria-expanded={abierto} className="min-w-0 flex-1 py-3 text-left">
          <span className="block truncate font-semibold">{ejercicio?.nombre ?? 'Ejercicio eliminado'}</span>
          <span className="num block text-sm font-medium text-muted">
            {p.series} × {p.repsMin}–{p.repsMax} · {fmtCrono(p.descansoSeg)}
            {ejercicio && <span className="font-sans font-normal"> · {NOMBRE_MUSCULO[ejercicio.musculoPrincipal]}</span>}
          </span>
        </button>
        {p.superserieConSiguiente && (
          <Etiqueta className="mr-1 bg-accent-soft text-accent">
            <Icono nombre="cadena" tamano={14} /> Superserie
          </Etiqueta>
        )}
        <Icono nombre="abajo" tamano={20} className={`mr-3 shrink-0 text-muted transition ${abierto ? 'rotate-180' : ''}`} />
      </div>
      {abierto && (
        <div className="anim-aparecer border-t border-line px-4 pt-2 pb-4">
          <Paso etiqueta="Series" valor={p.series} unidad="" min={1} max={12} onCambio={(series) => cambiar({ series })} />
          <Paso
            etiqueta="Reps mínimas"
            valor={p.repsMin}
            unidad=""
            min={1}
            max={100}
            onCambio={(repsMin) => cambiar({ repsMin, repsMax: Math.max(repsMin, p.repsMax) })}
          />
          <Paso
            etiqueta="Reps máximas"
            valor={p.repsMax}
            unidad=""
            min={1}
            max={100}
            onCambio={(repsMax) => cambiar({ repsMax, repsMin: Math.min(repsMax, p.repsMin) })}
          />
          <Paso
            etiqueta="Descanso"
            valor={p.descansoSeg}
            unidad="s"
            min={0}
            max={600}
            paso={15}
            onCambio={(descansoSeg) => cambiar({ descansoSeg })}
          />
          {!esUltimo && (
            <Interruptor
              etiqueta="Superserie con el siguiente"
              descripcion="Sin descanso entre los dos; descansas al acabar la vuelta."
              activo={p.superserieConSiguiente}
              onCambio={(superserieConSiguiente) => cambiar({ superserieConSiguiente })}
            />
          )}
          <label className="mt-2 block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Nota para este ejercicio</span>
            <input
              className={claseInput}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={() => nota !== p.nota && cambiar({ nota })}
              placeholder="Ej. bajar en 3 segundos"
            />
          </label>
          <Boton variante="peligro" className="mt-4 w-full" onClick={() => quitarEjercicioDeRutina(p.id)}>
            <Icono nombre="papelera" tamano={20} /> Quitar de la rutina
          </Boton>
        </div>
      )}
    </div>
  )
}
