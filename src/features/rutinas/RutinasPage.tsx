import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { ListaOrdenable } from '../../components/ListaOrdenable'
import { Boton, Etiqueta, Vacio } from '../../components/ui'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import { aplicarPlantilla, PLANTILLAS } from '../../db/plantillas'
import { archivarRutina, duplicarRutina, eliminarRutina, ordenarCiclo } from '../../db/rutinas'
import { rutinaQueToca, rutinasDelCiclo } from '../../domain/ciclo'
import type { Rutina } from '../../domain/tipos'
import { PestanasRutinas } from './PestanasRutinas'

export function RutinasPage() {
  const navegar = useNavigate()
  const datos = useLiveQuery(async () => {
    const [rutinas, plan, sesiones, enCurso] = await Promise.all([
      db.rutinas.toArray(),
      db.rutinaEjercicios.toArray(),
      db.sesiones.toArray(),
      db.sesiones.where('estado').equals('en_curso').count(),
    ])
    const resumen = new Map<string, { ejercicios: number; series: number }>()
    for (const re of plan) {
      const r = resumen.get(re.rutinaId) ?? { ejercicios: 0, series: 0 }
      resumen.set(re.rutinaId, { ejercicios: r.ejercicios + 1, series: r.series + re.series })
    }
    return { rutinas, resumen, toca: rutinaQueToca(rutinas, sesiones)?.id ?? null, hayEnCurso: enCurso > 0 }
  }, [])
  const [menu, setMenu] = useState<Rutina | null>(null)
  const [plantillas, setPlantillas] = useState(false)
  const [verArchivadas, setVerArchivadas] = useState(false)

  if (!datos) return <Cabecera titulo="Rutinas" />
  const ciclo = rutinasDelCiclo(datos.rutinas)
  const archivadas = datos.rutinas.filter((r) => r.archivada)

  const nueva = () => navegar('/rutinas/nueva')

  return (
    <>
      <Cabecera
        titulo="Rutinas"
        accion={
          <button
            type="button"
            onClick={nueva}
            aria-label="Nueva rutina"
            className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <Icono nombre="mas" />
          </button>
        }
      />
      <PestanasRutinas />

      {ciclo.length === 0 ? (
        <div className="space-y-4">
          <Vacio titulo="Aún no tienes rutinas">Crea la tuya o empieza rápido con una plantilla.</Vacio>
          <Boton variante="primario" className="w-full" onClick={() => setPlantillas(true)}>
            Ver plantillas
          </Boton>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            Tu ciclo. Arrastra <Icono nombre="arrastre" tamano={14} className="inline align-[-2px]" /> para cambiar el orden: toca la
            siguiente a la última que hiciste.
          </p>
          <ListaOrdenable items={ciclo} onOrdenar={(l) => ordenarCiclo(l.map((r) => r.id))} className="space-y-2">
            {(r, asa) => {
              const info = datos.resumen.get(r.id)
              const toca = datos.toca === r.id
              return (
                <div className={`flex items-center rounded-3xl border bg-surface pr-1 ${toca ? 'border-accent' : 'border-line'}`}>
                  {asa}
                  <Link to={`/rutinas/${r.id}`} className="flex min-h-18 min-w-0 flex-1 flex-col justify-center py-3">
                    <span className="flex items-center gap-2">
                      <span className="condensada truncate text-lg font-bold">{r.nombre}</span>
                      {toca && <Etiqueta className="bg-accent-soft text-accent">Toca</Etiqueta>}
                    </span>
                    <span className="text-sm text-muted">
                      {info ? `${info.ejercicios} ejercicios · ${info.series} series` : 'Sin ejercicios'}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Opciones de ${r.nombre}`}
                    onClick={() => setMenu(r)}
                    className="grid size-12 shrink-0 place-items-center rounded-full text-muted active:bg-surface-2"
                  >
                    <Icono nombre="puntos" />
                  </button>
                </div>
              )
            }}
          </ListaOrdenable>
          <Boton variante="fantasma" className="mt-3 w-full text-muted" onClick={() => setPlantillas(true)}>
            Añadir desde plantilla
          </Boton>
        </>
      )}

      {archivadas.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setVerArchivadas(!verArchivadas)}
            aria-expanded={verArchivadas}
            className="flex min-h-12 w-full items-center gap-2 font-semibold text-muted"
          >
            <Icono nombre="archivar" tamano={20} />
            Archivadas ({archivadas.length})
            <Icono nombre="abajo" tamano={18} className={`ml-auto transition ${verArchivadas ? 'rotate-180' : ''}`} />
          </button>
          {verArchivadas && (
            <ul className="mt-2 divide-y divide-line rounded-3xl border border-line bg-surface">
              {archivadas.map((r) => (
                <li key={r.id} className="flex min-h-14 items-center gap-2 pl-4">
                  <Link to={`/rutinas/${r.id}`} className="min-w-0 flex-1 truncate py-3 text-muted">
                    {r.nombre}
                  </Link>
                  <Boton variante="fantasma" className="text-accent" onClick={() => archivarRutina(r.id, false)}>
                    Recuperar
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Hoja abierta={menu !== null} onCerrar={() => setMenu(null)} titulo={menu?.nombre ?? ''}>
        {menu && (
          <div className="grid gap-2 pb-2">
            <Boton
              variante="primario"
              onClick={async () => {
                await iniciarSesion(menu.id)
                navegar('/entreno')
              }}
            >
              <Icono nombre="play" tamano={20} /> {datos.hayEnCurso ? 'Retomar entreno en curso' : 'Empezar esta rutina'}
            </Boton>
            <Boton
              onClick={async () => {
                const id = await duplicarRutina(menu.id)
                setMenu(null)
                if (id) navegar(`/rutinas/${id}`)
              }}
            >
              <Icono nombre="copiar" tamano={20} /> Duplicar
            </Boton>
            <Boton
              onClick={async () => {
                await archivarRutina(menu.id, true)
                setMenu(null)
              }}
            >
              <Icono nombre="archivar" tamano={20} /> Archivar
            </Boton>
            <Boton
              variante="peligro"
              onClick={async () => {
                if (!confirm(`¿Eliminar "${menu.nombre}"? Tu historial de entrenos se conserva.`)) return
                await eliminarRutina(menu.id)
                setMenu(null)
              }}
            >
              <Icono nombre="papelera" tamano={20} /> Eliminar
            </Boton>
          </div>
        )}
      </Hoja>

      <Hoja abierta={plantillas} onCerrar={() => setPlantillas(false)} titulo="Plantillas">
        <p className="mb-3 text-sm text-muted">Se añaden al final de tu ciclo y puedes editarlas como cualquier rutina.</p>
        <ul className="space-y-3 pb-2">
          {PLANTILLAS.map((p) => (
            <li key={p.clave} className="rounded-2xl border border-line p-4">
              <p className="condensada text-lg font-bold">{p.nombre}</p>
              <p className="text-sm text-muted">{p.descripcion}</p>
              <p className="mt-1 text-sm">{p.rutinas.map((r) => r.nombre).join(' · ')}</p>
              <Boton
                variante="secundario"
                className="mt-3 w-full"
                onClick={async () => {
                  await aplicarPlantilla(p.clave)
                  setPlantillas(false)
                }}
              >
                Usar esta plantilla
              </Boton>
            </li>
          ))}
        </ul>
      </Hoja>
    </>
  )
}
