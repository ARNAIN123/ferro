import { useEffect, useRef, useState } from 'react'
import { Icono } from '../../components/Icono'
import { urlImagen } from '../../components/ImagenEjercicio'
import { Boton, Tarjeta } from '../../components/ui'
import { BYTES_IMAGENES } from '../../catalogo/version'
import { db } from '../../db/db'
import { avisar } from '../../lib/avisos'
import { fmtEntero, fmtKg } from '../../lib/formato'
import { contarGuardadas, descargarImagenes } from '../../lib/imagenes'

async function todasLasUrls(): Promise<string[]> {
  const ejercicios = await db.ejercicios.filter((e) => e.imagenes > 0).toArray()
  return ejercicios.flatMap((e) => Array.from({ length: e.imagenes }, (_, n) => urlImagen(e.id, n)))
}

/** Las imágenes se guardan al verlas; aquí se pueden bajar todas para usarlas en modo avión. */
export function SeccionImagenes() {
  const [estado, setEstado] = useState<{ guardadas: number; total: number } | null>(null)
  const [descargando, setDescargando] = useState(false)
  const control = useRef<AbortController | null>(null)
  const mb = fmtKg(Math.round((BYTES_IMAGENES / 1048576) * 10) / 10)

  useEffect(() => {
    void todasLasUrls().then(async (urls) => setEstado({ guardadas: await contarGuardadas(urls), total: urls.length }))
    return () => control.current?.abort()
  }, [])

  const descargar = async () => {
    const urls = await todasLasUrls()
    control.current = new AbortController()
    setDescargando(true)
    const r = await descargarImagenes(urls, (guardadas, total) => setEstado({ guardadas, total }), control.current.signal)
    setDescargando(false)
    if (!control.current.signal.aborted) avisar(r.fallos ? `Faltan ${r.fallos} imágenes: vuelve a intentarlo con conexión` : 'Todas las imágenes están disponibles sin conexión')
  }

  const completo = estado !== null && estado.total > 0 && estado.guardadas >= estado.total
  const pct = estado && estado.total ? (estado.guardadas / estado.total) * 100 : 0

  return (
    <Tarjeta>
      <h2 className="font-bold">Imágenes de los ejercicios</h2>
      <p className="mt-1 text-sm text-muted">
        Se guardan solas al verlas. Para tenerlas todas en modo avión, descárgalas de una vez ({mb} MB en total).
      </p>
      {estado && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={estado.total} aria-valuenow={estado.guardadas}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="num mt-1.5 text-sm">
            {fmtEntero(estado.guardadas)} de {fmtEntero(estado.total)} imágenes guardadas
          </p>
        </div>
      )}
      {descargando ? (
        <Boton className="mt-3 w-full" onClick={() => control.current?.abort()}>
          Cancelar descarga
        </Boton>
      ) : (
        <Boton variante={completo ? 'secundario' : 'primario'} className="mt-3 w-full" disabled={completo} onClick={descargar}>
          <Icono nombre={completo ? 'check' : 'descargar'} tamano={20} />
          {completo ? 'Todas descargadas' : 'Descargar todas las imágenes para usar sin conexión'}
        </Boton>
      )}
    </Tarjeta>
  )
}
