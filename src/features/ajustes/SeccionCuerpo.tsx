import { App } from '@capacitor/app'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Boton, Campo, claseInput, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import type { Ajustes } from '../../domain/tipos'
import { guardarAjustes } from '../../hooks/useAjustes'
import { fmtEntero, fmtKg, parseNumero } from '../../lib/formato'
import { Salud, haySalud, type EstadoSalud } from '../../lib/salud'
import { Paso } from './Paso'

/** Pasos (Health Connect) y los datos del cuerpo con los que se estiman las calorías. */
export function SeccionCuerpo({ a }: { a: Ajustes }) {
  const ultimoPeso = useLiveQuery(() => db.pesosCorporales.orderBy('fecha').last(), [])

  return (
    <Tarjeta>
      <h2 id="cuerpo" className="mb-1 scroll-mt-4 font-bold">
        Pasos y calorías
      </h2>
      <p className="mb-2 text-sm text-muted">Con tu peso y tu altura, Hoy estima las calorías de tus pasos y de tus entrenos.</p>

      <Paso
        etiqueta="Objetivo de pasos"
        valor={a.objetivoPasos}
        unidad=""
        min={1000}
        max={40000}
        paso={500}
        formato={fmtEntero}
        onCambio={(v) => guardarAjustes({ objetivoPasos: v })}
      />

      <div className="mt-2 grid grid-cols-2 gap-3">
        <CampoNumero
          etiqueta="Altura (cm)"
          valor={a.alturaCm}
          min={100}
          max={250}
          onGuardar={(v) => guardarAjustes({ alturaCm: v })}
        />
        <CampoNumero etiqueta="Edad" valor={a.edad} min={10} max={110} onGuardar={(v) => guardarAjustes({ edad: v })} />
      </div>

      <p className="mt-3 flex min-h-12 items-center justify-between gap-2 text-sm">
        <span>
          Peso:{' '}
          {ultimoPeso ? (
            <span className="num font-semibold">{fmtKg(ultimoPeso.kg)} kg</span>
          ) : (
            <span className="text-muted">{haySalud() ? 'sin registros (se usará el de Health Connect)' : 'sin registros'}</span>
          )}
        </span>
        <Link to="/peso" className="flex min-h-11 items-center px-2 font-semibold text-accent">
          Registrar peso
        </Link>
      </p>

      <Link to="/ajustes/cuerpo" className="mt-1 flex min-h-12 items-center justify-between gap-2 border-t border-line pt-2 text-sm">
        <span>
          <span className="font-semibold">Perfil corporal</span>
          <span className="block text-muted">Tu avatar: sexo, medidas con cinta, grasa corporal y Antes / Ahora.</span>
        </span>
        <span aria-hidden className="text-lg text-muted">
          ›
        </span>
      </Link>

      {haySalud() && <HealthConnect />}
    </Tarjeta>
  )
}

/** Número opcional que se guarda al salir del campo; vacío = sin dato. */
export function CampoNumero({
  etiqueta,
  valor,
  min,
  max,
  onGuardar,
}: {
  etiqueta: string
  valor: number | null
  min: number
  max: number
  onGuardar: (v: number | null) => void
}) {
  const [texto, setTexto] = useState(valor === null ? '' : String(valor))
  const [anterior, setAnterior] = useState(valor)
  if (valor !== anterior) {
    setAnterior(valor)
    setTexto(valor === null ? '' : String(valor))
  }
  const n = parseNumero(texto)
  const invalido = texto.trim() !== '' && (n === null || n < min || n > max)

  return (
    <Campo etiqueta={etiqueta}>
      <input
        inputMode="numeric"
        className={`${claseInput} num ${invalido ? 'border-danger' : ''}`}
        value={texto}
        placeholder="—"
        aria-invalid={invalido}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          if (texto.trim() === '') onGuardar(null)
          else if (!invalido && n !== null) onGuardar(Math.round(n))
        }}
      />
    </Campo>
  )
}

function HealthConnect() {
  const [estado, setEstado] = useState<EstadoSalud | null>(null)
  const refrescar = useCallback(() => {
    Salud.estado().then(setEstado, () => setEstado(null))
  }, [])

  // Al volver de Health Connect, los permisos pueden haber cambiado.
  useEffect(() => {
    refrescar()
    const h = App.addListener('appStateChange', ({ isActive }) => isActive && refrescar())
    return () => void h.then((x) => x.remove())
  }, [refrescar])

  const texto = !estado
    ? 'Comprobando…'
    : estado.disponible === 'no'
      ? 'Este móvil no tiene Health Connect.'
      : estado.disponible === 'actualizar'
        ? 'Hay que instalar o actualizar Health Connect.'
        : estado.pasos
          ? `Conectado: pasos${estado.peso ? ' y peso' : ' (sin permiso para el peso)'}.`
          : 'Sin permiso para leer los pasos.'

  return (
    <div className="mt-2 border-t border-line pt-3">
      <p className="font-medium">Health Connect</p>
      <p className="mt-0.5 text-sm text-muted">{texto}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {estado?.disponible === 'si' && !(estado.pasos && estado.peso) && (
          <Boton variante="primario" onClick={() => Salud.pedirPermisos().then(setEstado, refrescar)}>
            Conectar
          </Boton>
        )}
        {estado && estado.disponible !== 'no' && (
          <Boton onClick={() => void Salud.abrirHealthConnect().catch(() => {})}>
            {estado.disponible === 'si' ? 'Abrir Health Connect' : 'Instalar'}
          </Boton>
        )}
      </div>
    </div>
  )
}
