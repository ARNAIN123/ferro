import { useEffect, useRef, useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { generarCopiaJson, generarCsvSeries, leerCopia, marcarCopiaHecha, restaurarCopia } from '../../db/copias'
import type { Ajustes } from '../../domain/tipos'
import { compartir, descargar, puedeCompartirArchivos } from '../../lib/archivos'
import { avisar } from '../../lib/avisos'
import { fmtHace } from '../../lib/formato'

type Pendiente = Extract<Awaited<ReturnType<typeof leerCopia>>, { ok: true }>

export function SeccionDatos({ a }: { a: Ajustes }) {
  const [persistente, setPersistente] = useState<boolean | null>(null)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const conCompartir = puedeCompartirArchivos()

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente, () => setPersistente(false))
  }, [])

  const copiaJson = async (modo: 'descargar' | 'compartir') => {
    const { nombre, contenido } = await generarCopiaJson()
    if (modo === 'compartir') {
      if (!(await compartir(nombre, contenido, 'application/json'))) return
    } else descargar(nombre, contenido, 'application/json')
    await marcarCopiaHecha()
    avisar('Copia de seguridad creada')
  }

  return (
    <Tarjeta>
      <h2 id="datos" className="font-bold">
        Datos y copias de seguridad
      </h2>
      <p className="mt-1 text-sm text-muted">
        Todo se guarda solo en este móvil.{' '}
        {persistente === true && 'Almacenamiento persistente activo: Android no lo borrará por falta de espacio.'}
        {persistente === false && 'Instala la app para que Android no borre los datos si falta espacio.'}
      </p>
      <p className="mt-2 text-sm">
        Última copia: <span className="font-semibold">{a.ultimaCopia ? fmtHace(a.ultimaCopia) : 'nunca'}</span>
      </p>

      <div className="mt-3 grid gap-2">
        <Boton variante="primario" onClick={() => copiaJson('descargar')}>
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
            descargar(nombre, contenido, 'text/csv;charset=utf-8')
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
          accept="application/json,.json"
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
