import { Link, useSearchParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { MUSCULOS, type Musculo } from '../../domain/tipos'
import { PestanasRutinas } from '../rutinas/PestanasRutinas'
import { BuscadorPorMapa } from './BuscadorPorMapa'

/** Biblioteca: se busca solo con el mapa. El músculo elegido va en la URL para volver a él desde la ficha. */
export function EjerciciosPage() {
  const [params, setParams] = useSearchParams()
  const p = params.get('musculo')
  const musculo = MUSCULOS.includes(p as Musculo) ? (p as Musculo) : null

  return (
    <>
      <Cabecera
        titulo="Rutinas"
        accion={
          <Link
            to="/rutinas/ejercicios/nuevo"
            aria-label="Crear ejercicio propio"
            className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <Icono nombre="mas" />
          </Link>
        }
      />
      <PestanasRutinas />
      <div className="mt-3">
        <BuscadorPorMapa
          musculo={musculo}
          onMusculo={(m) => setParams(m ? { musculo: m } : {}, { replace: true })}
          fila={(e, contenido) => (
            <Link to={`/rutinas/ejercicios/${encodeURIComponent(e.id)}`} className="flex min-h-18 items-center gap-3 px-3 py-2 active:bg-surface-2">
              {contenido}
              {e.notasFijas && <Icono nombre="nota" tamano={18} className="shrink-0 text-muted" />}
            </Link>
          )}
        />
      </div>
    </>
  )
}
