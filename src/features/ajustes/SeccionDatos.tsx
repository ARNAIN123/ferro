import { useEffect, useRef, useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { generarCopiaJson, generarCsvSeries, leerCopia, marcarCopiaHecha, restaurarCopia } from '../../db/copias'
import { prepararCatalogo } from '../../db/db'
import type { Ajustes } from '../../domain/tipos'
import { CARPETA_NATIVA, compartir, guardarArchivo, puedeCompartirArchivos } from '../../lib/archivos'
import { avisar } from '../../lib/avisos'
import { fmtHace } from '../../lib/formato'
import { esNativa } from '../../lib/plataforma'

type Pendiente = Extract<Awaited<ReturnType<typeof leerCopia>>, { ok: true }>

export function SeccionDatos({ a }: { a: Ajustes }) {
  const [persistente, setPersistente] = useState<boolean | null>(null)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const conCompartir = puedeCompartirArchivos()
  const nativa = esNativa()
  const guardadoEn = nativa ? ` en ${CARPETA_NATIVA}` : ''

  useEffect(() => {
    if (nativa) return
    navigator.storage?.persisted?.().then(setPersistente, () => setPersistente(false))
  }, [nativa])

  const copiaJson = async (modo: 'guardar' | 'compartir') => {
    const { nombre, contenido } = await generarCopiaJson()
    try {
      if (modo === 'compartir') {
        if (!(await compartir(nombre, contenido, 'application/json'))) return
      } else await guardarArchivo(nombre, contenido, 'application/json')
    } catch {
      return avisar('No se pudo guardar la copia. Prueba a enviarla a Drive o al correo.')
    }
    await marcarCopiaHecha()
    avisar(modo === 'guardar' ? `Copia guardada${guardadoEn}` : 'Copia de seguridad creada')
  }

  return (
    <Tarjeta>
      <h2 id="datos" className="font-bold">
        Datos y copias de seguridad
      </h2>
      <p className="mt-1 text-sm text-muted">
        Todo se guarda solo en este móvil.{' '}
        {nativa && 'Desinstalar Ferro borra sus datos (actualizarla no): haz copias de vez en cuando.'}
        {persistente === true && 'Almacenamiento persistente activo: Android no lo borrará por falta de espacio.'}
        {persistente === false && 'Instala la app para que Android no borre los datos si falta espacio.'}
      </p>
      <p className="mt-2 text-sm">
        Última copia: <span className="font-semibold">{a.ultimaCopia ? fmtHace(a.ultimaCopia) : 'nunca'}</span>
      </p>

      <div className="mt-3 grid gap-2">
        <Boton variante="primario" onClick={() => copiaJson('guardar')}>
          <Icono nombre="descargar" tamano={20} /> Exportar copia (JSON)
        </Boton>
        {conCompartir && (
          <Boton onClick={() => copiaJson('compartir')}>
            <Icono nombre="subir" tamano={20} /> Enviar copia a Drive, correo…
          </Boton>
        )}
        <Boton
          onClick={async () => {
            const { nombre, contenido } = await generarCsvSeries()
            try {
              await guardarArchivo(nombre, contenido, 'text/csv;charset=utf-8')
              if (nativa) avisar(`CSV guardado${guardadoEn}`)
            } catch {
              avisar('No se pudo guardar el CSV.')
            }
          }}
        >
          <Icono nombre="descargar" tamano={20} /> Exportar series (CSV)
        </Boton>
        <Boton variante="fantasma" className="text-muted" onClick={() => entrada.current?.click()}>
          <Icono nombre="subir" tamano={20} /> Importar copia…
        </Boton>
        <input
          ref={entrada}
          type="file"
          // En Android las copias bajadas de Drive o del correo no siempre llegan como JSON: se valida el contenido.
          accept={nativa ? undefined : 'application/json,.json'}
          className="hidden"
          onChange={async (e) => {
            const archivo = e.target.files?.[0]
            e.target.value = ''
            if (!archivo) return
            const r = await leerCopia(archivo)
            if (!r.ok) return avisar(r.error)
            setPendiente(r)
          }}
        />
      </div>

      <Hoja abierta={pendiente !== null} onCerrar={() => setPendiente(null)} titulo="¿Restaurar esta copia?">
        {pendiente && (
          <div className="space-y-3 pb-2">
            <p className="text-muted">
              Contiene {pendiente.resumen}
              {pendiente.copia.exportado && ` (hecha el ${new Date(pendiente.copia.exportado).toLocaleDateString('es-ES')})`}.
            </p>
            <p className="font-semibold text-danger">Sustituirá todos los datos actuales de este móvil.</p>
            <Boton
              variante="primario"
              className="w-full"
              onClick={async () => {
                await restaurarCopia(pendiente.copia)
                await prepararCatalogo()
                setPendiente(null)
                avisar('Copia restaurada')
              }}
            >
              Restaurar
            </Boton>
            <Boton className="w-full" onClick={() => setPendiente(null)}>
              Cancelar
            </Boton>
          </div>
        )}
      </Hoja>
    </Tarjeta>
  )
}
