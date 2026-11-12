import { useEffect, useMemo, useState } from 'react'
import type { DatosCuerpo } from '../domain/cuerpo'
import { cargarModeloAvatar, type ModeloAvatar } from './modelo'
import { resolverForma, type FormaResuelta } from './resolver'

/**
 * La forma del avatar para unos datos del cuerpo (sus medidas, la grasa a la que corresponde…), fuera
 * del visor. Mientras se descarga el modelo, null. El cálculo se comparte con el del visor.
 */
export function useFormaResuelta(datos: DatosCuerpo | null | undefined): FormaResuelta | null {
  const [modelo, setModelo] = useState<ModeloAvatar | null>(null)
  useEffect(() => {
    let vivo = true
    cargarModeloAvatar().then(
      (m) => vivo && setModelo(m),
      () => undefined,
    )
    return () => {
      vivo = false
    }
  }, [])
  const clave = datos ? JSON.stringify(datos) : ''
  return useMemo(() => (modelo && datos ? resolverForma(modelo, datos) : null), [modelo, clave]) // eslint-disable-line react-hooks/exhaustive-deps
}
