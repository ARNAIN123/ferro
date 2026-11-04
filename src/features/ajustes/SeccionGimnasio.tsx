import { App } from '@capacitor/app'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icono } from '../../components/Icono'
import { Boton, Interruptor, Tarjeta } from '../../components/ui'
import { importarEventosDeteccion } from '../../db/deteccion'
import type { Ajustes } from '../../domain/tipos'
import { guardarAjustes } from '../../hooks/useAjustes'
import { avisar } from '../../lib/avisos'
import { Deteccion, hayDeteccion, type EstadoDeteccion } from '../../lib/deteccion'
import { fmtHora } from '../../lib/formato'
import { obtenerPosicion } from '../../lib/ubicacion'
import { Paso } from './Paso'

export function SeccionGimnasio({ a }: { a: Ajustes }) {
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoDeteccion | null>(null)
  const [probando, setProbando] = useState(false)
  const nativa = hayDeteccion()
  const guardada = a.gimnasioLat !== null && a.gimnasioLng !== null

  const refrescar = useCallback(() => {
    if (nativa) Deteccion.estado().then(setEstado, () => setEstado(null))
  }, [nativa])

  // Al volver de los ajustes de Android, los permisos pueden haber cambiado.
  useEffect(() => {
    refrescar()
    if (!nativa) return
    const h = App.addListener('appStateChange', ({ isActive }) => isActive && refrescar())
    return () => void h.then((x) => x.remove())
  }, [nativa, refrescar])

  const capturar = async () => {
    setBuscando(true)
    setError(null)
    try {
      const p = nativa ? await Deteccion.ubicacionActual() : await obtenerPosicion(20000, 0)
      await guardarAjustes({ gimnasioLat: p.lat, gimnasioLng: p.lng })
      avisar(`Ubicación guardada (precisión ±${Math.round(p.precision)} m)`)
      refrescar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido obtener la ubicación.')
    } finally {
      setBuscando(false)
    }
  }

  const probar = async () => {
    setProbando(true)
    try {
      setEstado(await Deteccion.simular({ evento: 's3_abierta' }))
      await importarEventosDeteccion()
      const { registro } = await Deteccion.registro()
      if (registro[0]) avisar(registro[0].decision, { texto: 'Ver registro', ruta: '/ajustes/deteccion' }, 6000)
    } catch {
      avisar('No se ha podido hacer la prueba.')
    } finally {
      setProbando(false)
    }
  }

  return (
    <Tarjeta>
      <h2 id="gimnasio" className="font-bold">
        Gimnasio y detección
      </h2>
      <p className="mt-1 text-sm text-muted">
        {nativa
          ? 'La entrada se registra sola al abrir S3 FIT ZONE en el gimnasio (avisa MacroDroid) y la salida al alejarte. Si empiezas a entrenar sin entrada, cuenta la hora de inicio.'
          : 'La detección de entrada y salida solo funciona en la app Android. Aquí la entrada es la hora de inicio del entreno.'}
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

      <Paso etiqueta="Radio de entrada" valor={a.radioM} unidad="m" min={50} max={1000} paso={25} onCambio={(radioM) => guardarAjustes({ radioM })} />
      <Paso
        etiqueta="Margen para la salida"
        valor={a.margenSalidaM}
        unidad="m"
        min={50}
        max={1000}
        paso={25}
        onCambio={(margenSalidaM) => guardarAjustes({ margenSalidaM })}
      />
      <p className="-mt-1 text-xs text-muted">La salida exige dos comprobaciones seguidas a más de {a.radioM + a.margenSalidaM} m.</p>
      <Paso
        etiqueta="Horas entre entradas"
        valor={a.horasEntreCheckins}
        unidad="h"
        min={1}
        max={12}
        onCambio={(horasEntreCheckins) => guardarAjustes({ horasEntreCheckins })}
      />

      {nativa && (
        <>
          <Interruptor
            activo={a.notificarEntrada}
            onCambio={(notificarEntrada) => guardarAjustes({ notificarEntrada })}
            etiqueta="Avisar al registrar la entrada"
            descripcion="Notificación discreta «Entrada registrada · 18:04». Ferro no se abre."
          />

          {estado?.presencia && (
            <p className="mt-2 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
              <span className="size-2.5 shrink-0 rounded-full bg-ok" />
              En el gimnasio desde las <span className="num font-semibold">{fmtHora(estado.presencia.entrada)}</span>: comprobando la salida.
            </p>
          )}

          {estado && <Permisos estado={estado} onCambio={setEstado} />}

          <div className="mt-3 grid gap-2">
            <Boton onClick={probar} disabled={probando || !guardada}>
              <Icono nombre="play" tamano={18} /> {probando ? 'Comprobando ubicación…' : 'Probar: como si abriera S3 FIT ZONE'}
            </Boton>
            <Link
              to="/ajustes/deteccion"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-muted active:bg-surface-2"
            >
              <Icono nombre="historial" tamano={18} /> Registro de detección
            </Link>
          </div>

          {estado && <DatosMacroDroid receptor={estado.receptor} />}
        </>
      )}
    </Tarjeta>
  )
}

function Permisos({ estado, onCambio }: { estado: EstadoDeteccion; onCambio: (e: EstadoDeteccion) => void }) {
  const p = estado.permisos
  const filas = [
    {
      ok: p.ubicacionSiempre,
      texto: 'Ubicación «Permitir todo el tiempo»',
      accion: () => Deteccion.pedirUbicacionSiempre().then(onCambio, () => {}),
    },
    { ok: p.notificaciones, texto: 'Notificaciones', accion: () => Deteccion.abrirAjustesApp() },
    { ok: p.alarmasExactas, texto: 'Alarmas exactas', accion: () => Deteccion.abrirAjustesApp() },
    { ok: p.sinRestriccionesBateria, texto: 'Batería sin restricciones', accion: () => Deteccion.abrirAjustesApp() },
  ]
  return (
    <ul className="mt-3 divide-y divide-line rounded-2xl bg-surface-2 px-3">
      {filas.map((f) => (
        <li key={f.texto} className="flex min-h-12 items-center gap-2 text-sm">
          <Icono nombre={f.ok ? 'check' : 'aviso'} tamano={18} className={f.ok ? 'text-ok' : 'text-warn'} />
          <span className="flex-1">{f.texto}</span>
          {!f.ok && (
            <button type="button" onClick={() => void f.accion()} className="min-h-10 rounded-xl px-3 font-semibold text-accent active:bg-line">
              Activar
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Lo que hay que poner en la acción «Enviar intent» de las macros (ver README). */
function DatosMacroDroid({ receptor }: { receptor: EstadoDeteccion['receptor'] }) {
  const datos = [
    ['Paquete', receptor.paquete],
    ['Clase', receptor.clase],
    ['Acción', receptor.accion],
  ] as const
  return (
    <details className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
      <summary className="min-h-10 cursor-pointer content-center font-semibold">Datos para MacroDroid</summary>
      <p className="mt-1 text-muted">Acción «Enviar intent», destino Broadcast. Extra: evento = s3_abierta (entrada) o wifi_desconectada (salida).</p>
      <dl className="mt-2 space-y-1.5 pb-1">
        {datos.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <dt className="w-16 shrink-0 text-muted">{k}</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-xs">{v}</dd>
            <button
              type="button"
              aria-label={`Copiar ${k.toLowerCase()}`}
              onClick={() => navigator.clipboard.writeText(v).then(() => avisar(`${k} copiado`), () => avisar('No se ha podido copiar'))}
              className="grid size-10 shrink-0 place-items-center rounded-xl active:bg-line"
            >
              <Icono nombre="copiar" tamano={16} />
            </button>
          </div>
        ))}
      </dl>
    </details>
  )
}
