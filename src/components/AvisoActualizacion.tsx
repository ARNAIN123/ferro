import { useRegisterSW } from 'virtual:pwa-register/react'
import { Boton } from './ui'

/**
 * La app se actualiza solo cuando tú lo pides: así una versión nueva nunca recarga la página en mitad de un entreno.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayVersion, setHayVersion],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Busca versiones nuevas cada hora mientras la app está abierta.
      if (registro) setInterval(() => registro.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  if (!hayVersion) return null
  return (
    <div
      role="status"
      className="anim-aparecer fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-2xl"
    >
      <p className="flex-1 text-sm font-medium">Hay una versión nueva de Ferro.</p>
      <Boton variante="fantasma" className="px-3 text-muted" onClick={() => setHayVersion(false)}>
        Luego
      </Boton>
      <Boton variante="primario" className="px-4" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </Boton>
    </div>
  )
}
