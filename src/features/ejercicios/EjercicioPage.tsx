import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { AnimacionEjercicio } from '../../components/animacion/AnimacionEjercicio'
import { Animacion3D } from '../../components/animacion3d/Animacion3D'
import { MapaMuscular } from '../../components/mapa/MapaMuscular'
import { Boton, claseInput, Etiqueta, Tarjeta, Vacio } from '../../components/ui'
import { historialEjercicio } from '../../db/consultas'
import { db } from '../../db/db'
import { archivarEjercicio, guardarNotas } from '../../db/ejercicios'
import { NOMBRE_CATEGORIA, NOMBRE_MATERIAL, NOMBRE_MECANICA, NOMBRE_NIVEL } from '../../domain/etiquetas'
import { nivelesDeEjercicio } from '../../domain/mapaMuscular'
import type { Musculo } from '../../domain/tipos'
import { HistorialEjercicio } from './HistorialEjercicio'
import { ProgresoEjercicio } from './ProgresoEjercicio'
import { nombresDeMusculos } from '../../domain/musculos'

const lista = (ms: readonly Musculo[]) => nombresDeMusculos(ms).join(', ')

/** Ficha del ejercicio. Músculos, material e instrucciones son de solo lectura: solo se editan mis notas. */
export function EjercicioPage() {
  const { id = '' } = useParams()
  const ejercicio = useLiveQuery(() => db.ejercicios.get(id), [id])
  const historial = useLiveQuery(() => historialEjercicio(id), [id])
  const [editandoNotas, setEditandoNotas] = useState(false)
  const [notas, setNotas] = useState('')

  if (ejercicio === undefined) return <Cabecera titulo="" atras />
  if (!ejercicio)
    return (
      <>
        <Cabecera titulo="Ejercicio" atras="/rutinas/ejercicios" />
        <Vacio titulo="Este ejercicio no existe" />
      </>
    )

  return (
    <>
      <Cabecera titulo={ejercicio.nombre} subtitulo={ejercicio.personalizado ? 'Ejercicio propio' : NOMBRE_CATEGORIA[ejercicio.categoria]} atras />

      <div className="mt-3 space-y-4">
        <figure className="overflow-hidden rounded-3xl bg-surface-2">
          <Animacion3D
            ejercicio={ejercicio}
            musculos={{ principales: ejercicio.musculosPrincipales, secundarios: ejercicio.musculosSecundarios }}
            className="mx-auto max-w-sm"
            sinWebgl={<AnimacionEjercicio ejercicio={ejercicio} className="mx-auto aspect-square w-full max-w-sm" />}
          />
        </figure>

        <div className="flex flex-wrap gap-2">
          {ejercicio.archivado && <Etiqueta className="text-warn">Archivado</Etiqueta>}
          <Etiqueta>{NOMBRE_MATERIAL[ejercicio.material]}</Etiqueta>
          {ejercicio.nivel && <Etiqueta>{NOMBRE_NIVEL[ejercicio.nivel]}</Etiqueta>}
          {ejercicio.mecanica && <Etiqueta>{NOMBRE_MECANICA[ejercicio.mecanica]}</Etiqueta>}
        </div>

        <Tarjeta>
          <h2 className="font-bold">Músculos</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted">Principales</dt>
              <dd className="font-semibold">{lista(ejercicio.musculosPrincipales)}</dd>
            </div>
            {ejercicio.musculosSecundarios.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted">Secundarios</dt>
                <dd>{lista(ejercicio.musculosSecundarios)}</dd>
              </div>
            )}
          </dl>
          <MapaMuscular niveles={nivelesDeEjercicio(ejercicio)} className="mt-3 h-72" />
          <p className="mt-1 flex justify-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-accent" /> Principal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-accent opacity-50" /> Secundario
            </span>
          </p>
        </Tarjeta>

        <Tarjeta>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Icono nombre="nota" tamano={18} /> Mis notas
            </h2>
            <button
              type="button"
              onClick={() => {
                setNotas(ejercicio.notasFijas)
                setEditandoNotas(true)
              }}
              className="-mr-2 flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-accent"
            >
              <Icono nombre="editar" tamano={16} /> Editar
            </button>
          </div>
          {ejercicio.notasFijas ? (
            <p className="mt-1 whitespace-pre-line">{ejercicio.notasFijas}</p>
          ) : (
            <p className="mt-1 text-sm text-muted">Ajustes de la máquina, agarre, altura del asiento… Se ven durante el entreno.</p>
          )}
        </Tarjeta>

        {ejercicio.instrucciones.length > 0 && (
          <Tarjeta>
            <h2 className="mb-2 font-bold">Cómo se hace</h2>
            <ol className="space-y-2">
              {ejercicio.instrucciones.map((paso, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-sm">{i + 1}</span>
                  <span className="leading-relaxed">{paso}</span>
                </li>
              ))}
            </ol>
          </Tarjeta>
        )}

        {historial && <ProgresoEjercicio ejercicio={ejercicio} historial={historial} />}

        <section>
          <h2 className="mb-2 font-bold">Mi historial</h2>
          {historial && <HistorialEjercicio historial={historial} />}
        </section>

        {ejercicio.personalizado && (
          <Boton
            variante={ejercicio.archivado ? 'secundario' : 'peligro'}
            className="w-full"
            onClick={() => archivarEjercicio(ejercicio.id, !ejercicio.archivado)}
          >
            <Icono nombre="archivar" tamano={20} />
            {ejercicio.archivado ? 'Recuperar ejercicio' : 'Archivar ejercicio'}
          </Boton>
        )}
      </div>

      <Hoja abierta={editandoNotas} onCerrar={() => setEditandoNotas(false)} titulo="Mis notas">
        <div className="space-y-3 pb-2">
          <textarea
            className={`${claseInput} min-h-32 py-3`}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Asiento en 4, respaldo en 2, agarre neutro…"
            aria-label="Mis notas"
          />
          <Boton
            variante="primario"
            className="w-full"
            onClick={async () => {
              await guardarNotas(ejercicio.id, notas.trim())
              setEditandoNotas(false)
            }}
          >
            Guardar notas
          </Boton>
        </div>
      </Hoja>
    </>
  )
}
