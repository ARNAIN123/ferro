import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Interruptor, Segmentado, Tarjeta } from '../../components/ui'
import type { Tema } from '../../domain/tipos'
import { guardarAjustes, useAjustes } from '../../hooks/useAjustes'
import { esNativa } from '../../lib/plataforma'
import { Paso } from './Paso'
import { SeccionActualizaciones } from './SeccionActualizaciones'
import { SeccionDatos } from './SeccionDatos'
import { SeccionGimnasio } from './SeccionGimnasio'
import { SeccionImagenes } from './SeccionImagenes'

export function AjustesPage() {
  const a = useAjustes()
  const { hash } = useLocation()

  // Desde el recordatorio de Hoy se llega a /ajustes#datos.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <>
      <Cabecera titulo="Ajustes" />
      <div className="mt-4 space-y-4">
        <Tarjeta>
          <h2 className="mb-3 font-bold">Entreno</h2>
          <Paso
            etiqueta="Objetivo semanal"
            valor={a.objetivoSemanal}
            unidad={a.objetivoSemanal === 1 ? 'día' : 'días'}
            min={1}
            max={7}
            onCambio={(v) => guardarAjustes({ objetivoSemanal: v })}
          />
          <Paso
            etiqueta="Descanso por defecto"
            valor={a.descansoDefecto}
            unidad="s"
            min={15}
            max={600}
            paso={15}
            onCambio={(v) => guardarAjustes({ descansoDefecto: v })}
          />
          <Interruptor
            etiqueta="Pantalla encendida"
            descripcion="Evita que el móvil se bloquee durante el entreno."
            activo={a.wakeLock}
            onCambio={(v) => guardarAjustes({ wakeLock: v })}
          />
          <Interruptor
            etiqueta="Vibración"
            descripcion="Al completar una serie y al acabar el descanso."
            activo={a.vibracion}
            onCambio={(v) => guardarAjustes({ vibracion: v })}
          />
        </Tarjeta>

        <SeccionGimnasio a={a} />

        <Tarjeta>
          <h2 className="mb-3 font-bold">Apariencia</h2>
          <Segmentado<Tema>
            etiqueta="Tema"
            valor={a.tema}
            onCambio={(tema) => guardarAjustes({ tema })}
            opciones={[
              { valor: 'oscuro', texto: 'Oscuro' },
              { valor: 'claro', texto: 'Claro' },
              { valor: 'sistema', texto: 'Sistema' },
            ]}
          />
        </Tarjeta>

        {/* En la app Android las imágenes van dentro del APK: no hace falta descargarlas. */}
        {!esNativa() && <SeccionImagenes />}

        <SeccionDatos a={a} />

        {esNativa() && <SeccionActualizaciones />}

        <p className="pt-2 text-center text-xs text-muted">
          Ferro v{__APP_VERSION__} ·{' '}
          <a href="/licencias.txt" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Créditos y licencias
          </a>
        </p>
      </div>
    </>
  )
}
