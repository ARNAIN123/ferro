import { useEffect, useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { Interruptor, Segmentado, Tarjeta } from '../../components/ui'
import type { Tema } from '../../domain/tipos'
import { guardarAjustes, useAjustes } from '../../hooks/useAjustes'
import { Paso } from './Paso'

export function AjustesPage() {
  const a = useAjustes()
  const [persistente, setPersistente] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente, () => setPersistente(false))
  }, [])

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

        <Tarjeta>
          <h2 className="mb-1 font-bold">Datos</h2>
          <p className="text-sm text-muted">
            Todo se guarda solo en este móvil.{' '}
            {persistente === null
              ? ''
              : persistente
                ? 'Almacenamiento persistente activado: Android no lo borrará por falta de espacio.'
                : 'El navegador aún no ha concedido almacenamiento persistente; instala la app para conseguirlo.'}
          </p>
        </Tarjeta>

        <p className="pt-2 text-center text-xs text-muted">Ferro v{__APP_VERSION__}</p>
      </div>
    </>
  )
}
