import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { asignarAnimacion } from '../../animacion/asignacion'
import { AnimacionVisible } from '../../components/animacion/AnimacionEjercicio'
import { Cabecera } from '../../components/Cabecera'
import { Segmentado } from '../../components/ui'
import { db } from '../../db/db'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'

type Orden = 'patron' | 'nombre'

// Galería de revisión de las animaciones (ronda 2, fase 6): todos los ejercicios de la biblioteca,
// agrupados por patrón de movimiento. Ruta /vista-previa/animaciones, enlazada desde Ajustes.
export function GaleriaAnimaciones() {
  const [orden, setOrden] = useState<Orden>('patron')
  const ejercicios = useLiveQuery(() => db.ejercicios.filter((e) => !e.retirado && !e.archivado).toArray(), [])
  const grupos = useMemo(() => {
    if (!ejercicios) return []
    const con = ejercicios.map((e) => ({ e, a: asignarAnimacion(e) })).sort((x, y) => x.e.nombre.localeCompare(y.e.nombre, 'es'))
    if (orden === 'nombre') return [{ titulo: `${con.length} ejercicios`, items: con }]
    const porPatron = new Map<string, typeof con>()
    for (const x of con) porPatron.set(x.a.animacion.patron, [...(porPatron.get(x.a.animacion.patron) ?? []), x])
    return [...porPatron.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([titulo, items]) => ({ titulo, items }))
  }, [ejercicios, orden])

  return (
    <>
      <Cabecera titulo="Galería de animaciones" subtitulo="Para revisar: todas las de la biblioteca" atras />
      <div className="mt-3 mb-4">
        <Segmentado<Orden>
          etiqueta="Orden"
          valor={orden}
          onCambio={setOrden}
          opciones={[
            { valor: 'patron', texto: 'Por patrón' },
            { valor: 'nombre', texto: 'Por nombre' },
          ]}
        />
      </div>
      {grupos.map((g) => (
        <section key={g.titulo} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">
            {g.titulo} <span className="num font-normal">· {g.items.length}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {g.items.map(({ e, a }) => (
              <li key={e.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <AnimacionVisible ejercicio={e} className="aspect-square w-full bg-surface-2" />
                <div className="p-2.5">
                  <p className="line-clamp-2 text-sm leading-snug font-semibold">{e.nombre}</p>
                  <p className="mt-1 text-xs text-muted">
                    {NOMBRE_MATERIAL[e.material]} · {e.musculosPrincipales.map((m) => NOMBRE_MUSCULO[m]).join(', ')}
                  </p>
                  {a.regla === 'genérica' && <p className="mt-1 text-xs text-warn">Animación genérica</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
