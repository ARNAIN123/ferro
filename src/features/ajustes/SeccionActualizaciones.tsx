import { useState } from 'react'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { abrirDescarga, buscarActualizacion, type ResultadoBusqueda } from '../../lib/actualizaciones'

/** Solo en la app Android: compara con la última release de GitHub y abre la descarga del APK. */
export function SeccionActualizaciones() {
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBusqueda | null>(null)

  const buscar = async () => {
    setBuscando(true)
    try {
      setResultado(await buscarActualizacion())
    } finally {
      setBuscando(false)
    }
  }

  return (
    <Tarjeta>
      <h2 className="font-bold">Actualizaciones</h2>
      <p className="mt-1 text-sm text-muted">
        Tienes la versión <span className="num font-semibold text-fg">{__APP_VERSION__}</span>. Al instalar una nueva encima se
        conservan todos tus datos.
      </p>

      {resultado?.estado === 'disponible' ? (
        <div className="mt-3 rounded-2xl bg-accent-soft p-3">
          <p className="font-semibold">Hay una versión nueva: {resultado.actualizacion.version}</p>
          {resultado.actualizacion.notas && <p className="mt-1 text-sm whitespace-pre-line text-muted">{resultado.actualizacion.notas}</p>}
          <Boton variante="primario" className="mt-3 w-full" onClick={() => abrirDescarga(resultado.actualizacion.url)}>
            <Icono nombre="descargar" tamano={20} /> Descargar APK
          </Boton>
          <p className="mt-2 text-xs text-muted">Se abre en Chrome. Cuando termine, toca el archivo y pulsa «Actualizar».</p>
        </div>
      ) : (
        <>
          <Boton className="mt-3 w-full" disabled={buscando} onClick={buscar}>
            <Icono nombre="descargar" tamano={20} /> {buscando ? 'Buscando…' : 'Buscar actualizaciones'}
          </Boton>
          {resultado?.estado === 'al-dia' && <p className="mt-2 text-sm text-muted">Tienes la última versión.</p>}
          {resultado?.estado === 'error' && <p className="mt-2 text-sm text-warn">{resultado.mensaje}</p>}
        </>
      )}
    </Tarjeta>
  )
}
