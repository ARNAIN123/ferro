import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Boton, Etiqueta, Tarjeta, Vacio } from '../../components/ui'
import { historialEjercicio } from '../../db/consultas'
import { db } from '../../db/db'
import { actualizarEjercicio, archivarEjercicio } from '../../db/ejercicios'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { fmtKg } from '../../lib/formato'
import { FormEjercicio } from './FormEjercicio'
import { HistorialEjercicio } from './HistorialEjercicio'

export function EjercicioPage() {
  const { id = '' } = useParams()
  const ejercicio = useLiveQuery(() => db.ejercicios.get(id), [id])
  const historial = useLiveQuery(() => historialEjercicio(id), [id])
  const [editando, setEditando] = useState(false)

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
      <Cabecera
        titulo={ejercicio.nombre}
        subtitulo={`${NOMBRE_MUSCULO[ejercicio.musculoPrincipal]} · ${NOMBRE_MATERIAL[ejercicio.material]}`}
        atras
        accion={
          <button
            type="button"
            aria-label="Editar ejercicio"
            onClick={() => setEditando(true)}
            className="grid size-12 shrink-0 place-items-center rounded-full active:bg-surface-2"
          >
            <Icono nombre="editar" />
          </button>
        }
      />

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {ejercicio.archivado && <Etiqueta className="text-warn">Archivado</Etiqueta>}
          <Etiqueta>Salto {fmtKg(ejercicio.saltoPeso)} kg</Etiqueta>
          {ejercicio.musculosSecundarios.map((m) => (
            <Etiqueta key={m}>{NOMBRE_MUSCULO[m]}</Etiqueta>
          ))}
        </div>

        <Tarjeta>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted">
            <Icono nombre="nota" tamano={18} /> Notas fijas
          </h2>
          {ejercicio.notasFijas ? (
            <p className="whitespace-pre-line">{ejercicio.notasFijas}</p>
          ) : (
            <button type="button" onClick={() => setEditando(true)} className="min-h-10 text-left text-muted">
              Añade los ajustes de la máquina (asiento, agarre…)
            </button>
          )}
        </Tarjeta>

        <section>
          <h2 className="mb-2 font-bold">Historial</h2>
          {historial && <HistorialEjercicio historial={historial} />}
        </section>

        <Boton
          variante={ejercicio.archivado ? 'secundario' : 'peligro'}
          className="w-full"
          onClick={() => archivarEjercicio(ejercicio.id, !ejercicio.archivado)}
        >
          <Icono nombre="archivar" tamano={20} />
          {ejercicio.archivado ? 'Recuperar ejercicio' : 'Archivar ejercicio'}
        </Boton>
      </div>

      <Hoja abierta={editando} onCerrar={() => setEditando(false)} titulo="Editar ejercicio">
        <FormEjercicio
          inicial={ejercicio}
          textoGuardar="Guardar cambios"
          onGuardar={async (datos) => {
            await actualizarEjercicio(ejercicio.id, datos)
            setEditando(false)
          }}
        />
      </Hoja>
    </>
  )
}
