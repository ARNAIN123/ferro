import { useEffect, useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { Tarjeta, Vacio } from '../../components/ui'
import { Deteccion, hayDeteccion, type AnotacionDeteccion } from '../../lib/deteccion'
import { fmtFechaCorta, fmtHora } from '../../lib/formato'

const EVENTOS: Record<string, string> = {
  s3_abierta: 'S3 FIT ZONE abierta',
  wifi_desconectada: 'WiFi desconectada',
  comprobacion: 'Comprobación de salida',
}

/** Últimos eventos de la detección: para ajustar el radio y entender por qué algo no se registró. */
export function RegistroDeteccionPage() {
  const [registro, setRegistro] = useState<AnotacionDeteccion[] | null>(null)

  useEffect(() => {
    if (!hayDeteccion()) return setRegistro([])
    const cargar = () => Deteccion.registro().then((r) => setRegistro(r.registro), () => setRegistro([]))
    void cargar()
    const h = Deteccion.addListener('cambio', () => void cargar())
    return () => void h.then((x) => x.remove())
  }, [])

  return (
    <>
      <Cabecera titulo="Registro de detección" subtitulo="Entrada y salida del gimnasio" atras="/ajustes#gimnasio" />
      {registro === null ? null : registro.length === 0 ? (
        <Vacio titulo="Sin eventos todavía">
          {hayDeteccion()
            ? 'Aquí aparecerá cada aviso de MacroDroid y cada comprobación de salida, con la distancia y la decisión.'
            : 'La detección solo funciona en la app Android.'}
        </Vacio>
      ) : (
        <Tarjeta className="mt-2 p-0">
          <ol className="divide-y divide-line">
            {registro.map((r, i) => (
              <li key={`${r.hora}-${i}`} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{EVENTOS[r.evento] ?? r.evento}</span>
                  <span className="num shrink-0 text-sm text-muted">
                    {fmtFechaCorta(r.hora)} · {fmtHora(r.hora)}
                  </span>
                </div>
                <p className={`mt-0.5 text-sm ${/registrada|confirmada/i.test(r.decision) ? 'text-ok' : 'text-muted'}`}>{r.decision}</p>
                {r.distancia !== undefined && (
                  <p className="num mt-0.5 text-xs text-muted">
                    A {r.distancia} m{r.precision !== undefined && ` · precisión ±${r.precision} m`}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}
    </>
  )
}
