import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Boton, claseInput } from '../../components/ui'
import { guardarNotas } from '../../db/ejercicios'
import { guardarMolestia, quitarMolestia, saltarEjercicio } from '../../db/entreno'
import type { EjercicioVista } from './useEntreno'

interface Props {
  vista: EjercicioVista | null
  onCerrar: () => void
  onCambiar: () => void
}

/** Acciones de un ejercicio durante el entreno: alternativa, saltar, molestia y notas fijas. */
export function MenuEjercicio({ vista, onCerrar, onCambiar }: Props) {
  const [notaMolestia, setNotaMolestia] = useState('')
  const [notasFijas, setNotasFijas] = useState('')
  const [modo, setModo] = useState<'menu' | 'molestia' | 'notas'>('menu')

  useEffect(() => {
    setModo('menu')
    setNotaMolestia(vista?.molestia?.nota ?? '')
    setNotasFijas(vista?.ejercicio?.notasFijas ?? '')
  }, [vista?.se.id, vista?.molestia?.nota, vista?.ejercicio?.notasFijas])

  if (!vista) return <Hoja abierta={false} onCerrar={onCerrar} titulo="">{null}</Hoja>
  const { se, ejercicio, molestia } = vista
  const saltado = se.estado === 'saltado'

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={ejercicio?.nombre ?? 'Ejercicio'}>
      {modo === 'menu' && (
        <div className="grid gap-2 pb-2">
          <Boton onClick={onCambiar} className="justify-start">
            <Icono nombre="cambiar" tamano={20} /> Cambiar por una alternativa
          </Boton>
          <Boton
            className="justify-start"
            onClick={async () => {
              await saltarEjercicio(se.id, !saltado)
              onCerrar()
            }}
          >
            <Icono nombre="saltar" tamano={20} /> {saltado ? 'Volver a hacerlo' : 'Saltar ejercicio'}
          </Boton>
          <Boton className={`justify-start ${molestia ? 'text-warn' : ''}`} onClick={() => setModo('molestia')}>
            <Icono nombre="aviso" tamano={20} /> {molestia ? 'Editar molestia' : 'Marcar molestia'}
          </Boton>
          <Boton className="justify-start" onClick={() => setModo('notas')}>
            <Icono nombre="nota" tamano={20} /> Notas fijas (ajustes de máquina)
          </Boton>
          {ejercicio && (
            <Link
              to={`/rutinas/ejercicios/${ejercicio.id}`}
              className="flex min-h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-muted active:bg-surface-2"
            >
              <Icono nombre="historial" tamano={20} /> Ver historial del ejercicio
            </Link>
          )}
        </div>
      )}

      {modo === 'molestia' && (
        <div className="space-y-3 pb-2">
          <p className="text-sm text-muted">Quedará marcada en el historial de este ejercicio.</p>
          <textarea
            className={`${claseInput} min-h-24 py-3`}
            value={notaMolestia}
            onChange={(e) => setNotaMolestia(e.target.value)}
            placeholder="Opcional: hombro derecho al bajar…"
            aria-label="Nota de la molestia"
          />
          <Boton
            variante="primario"
            className="w-full"
            onClick={async () => {
              await guardarMolestia(se.sesionId, se.ejercicioId, notaMolestia.trim())
              onCerrar()
            }}
          >
            Guardar molestia
          </Boton>
          {molestia && (
            <Boton
              variante="fantasma"
              className="w-full text-muted"
              onClick={async () => {
                await quitarMolestia(molestia.id)
                onCerrar()
              }}
            >
              Quitar molestia
            </Boton>
          )}
        </div>
      )}

      {modo === 'notas' && ejercicio && (
        <div className="space-y-3 pb-2">
          <textarea
            className={`${claseInput} min-h-28 py-3`}
            value={notasFijas}
            onChange={(e) => setNotasFijas(e.target.value)}
            placeholder="Asiento en 4, agarre neutro…"
            aria-label="Notas fijas"
          />
          <Boton
            variante="primario"
            className="w-full"
            onClick={async () => {
              await guardarNotas(ejercicio.id, notasFijas.trim())
              onCerrar()
            }}
          >
            Guardar notas
          </Boton>
        </div>
      )}
    </Hoja>
  )
}
