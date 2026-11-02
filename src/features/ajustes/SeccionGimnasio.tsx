import { useState } from 'react'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import type { Ajustes } from '../../domain/tipos'
import { guardarAjustes } from '../../hooks/useAjustes'
import { avisar } from '../../lib/avisos'
import { obtenerPosicion } from '../../lib/ubicacion'
import { Paso } from './Paso'

export function SeccionGimnasio({ a }: { a: Ajustes }) {
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enlace = `${location.origin}/checkin`
  const guardada = a.gimnasioLat !== null && a.gimnasioLng !== null

  const capturar = async () => {
    setBuscando(true)
    setError(null)
    try {
      const p = await obtenerPosicion(20000, 0)
      await guardarAjustes({ gimnasioLat: p.lat, gimnasioLng: p.lng })
      avisar(`Ubicación guardada (precisión ±${Math.round(p.precision)} m)`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido obtener la ubicación.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <Tarjeta>
      <h2 className="font-bold">Gimnasio y check-in</h2>
      <p className="mt-1 text-sm text-muted">
        La entrada se registra con el enlace de check-in, al abrir la app dentro del radio o, si no hay ninguna reciente, con la hora de inicio del entreno.
      </p>

      <div className="mt-4 rounded-2xl bg-surface-2 p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Icono nombre="ubicacion" tamano={20} className={guardada ? 'text-accent' : 'text-muted'} />
          {guardada ? 'Ubicación guardada' : 'Sin ubicación guardada'}
        </p>
        {guardada && (
          <p className="num mt-1 text-xs text-muted">
            {a.gimnasioLat!.toFixed(5)}, {a.gimnasioLng!.toFixed(5)}
          </p>
        )}
        <Boton variante={guardada ? 'secundario' : 'primario'} className={`mt-3 w-full ${guardada ? 'bg-surface' : ''}`} onClick={capturar} disabled={buscando}>
          {buscando ? 'Buscando señal GPS…' : 'Estoy en el gimnasio ahora'}
        </Boton>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {guardada && (
          <button
            type="button"
            onClick={() => guardarAjustes({ gimnasioLat: null, gimnasioLng: null })}
            className="mt-1 min-h-11 w-full text-sm font-medium text-muted"
          >
            Borrar ubicación
          </button>
        )}
      </div>

      <Paso etiqueta="Radio" valor={a.radioM} unidad="m" min={50} max={1000} paso={50} onCambio={(radioM) => guardarAjustes({ radioM })} />
      <Paso
        etiqueta="Horas entre check-ins"
        valor={a.horasEntreCheckins}
        unidad="h"
        min={1}
        max={12}
        onCambio={(horasEntreCheckins) => guardarAjustes({ horasEntreCheckins })}
      />

      <div className="mt-3">
        <p className="text-sm font-medium text-muted">Enlace de check-in (para MacroDroid)</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-3 text-sm">{enlace}</code>
          <button
            type="button"
            aria-label="Copiar enlace"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(enlace)
                avisar('Enlace copiado')
              } catch {
                avisar('No se ha podido copiar; mantén pulsado el enlace para copiarlo')
              }
            }}
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 active:bg-line"
          >
            <Icono nombre="copiar" tamano={20} />
          </button>
        </div>
      </div>
    </Tarjeta>
  )
}
