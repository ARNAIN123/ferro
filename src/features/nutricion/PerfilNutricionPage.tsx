import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Boton, Interruptor, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { actualizarPerfil } from '../../db/nutricion'
import { macrosDelDia, PROTEINA_MAX, PROTEINA_MIN, RITMO_PORCENTAJE } from '../../domain/nutricion'
import { fmtEntero, fmtFechaCorta, fmtKg } from '../../lib/formato'
import { Paso } from '../ajustes/Paso'
import { Asistente } from './Asistente'
import { MOTIVO_AJUSTE } from './RevisionSemanal'

const OBJETIVO: Record<string, string> = { perder: 'Perder grasa manteniendo el músculo', mantener: 'Mantener el peso', ganar: 'Ganar músculo' }
const RITMO: Record<string, string> = { suave: 'suave', moderado: 'moderado', rapido: 'rápido' }

/** Mi objetivo de nutrición: proteína, reto de fruta y verdura, rehacer el cálculo e historial de revisiones. */
export function PerfilNutricionPage() {
  const navegar = useNavigate()
  const [rehaciendo, setRehaciendo] = useState(false)
  const datos = useLiveQuery(async () => ({ perfil: (await db.nutricion.get('perfil')) ?? null, peso: await db.pesosCorporales.orderBy('fecha').last() }), [])
  if (!datos) return null
  const { perfil, peso } = datos
  if (!perfil || rehaciendo) {
    return (
      <div className="pb-6">
        <Cabecera titulo={perfil ? 'Rehacer el cálculo' : 'Nutrición'} atras />
        <div className="mt-2">
          <Asistente alTerminar={() => (perfil ? setRehaciendo(false) : navegar('/nutricion'))} />
        </div>
      </div>
    )
  }
  const macros = peso ? macrosDelDia({ kcalDia: perfil.objetivoKcal, kcalMedia: perfil.objetivoKcal, kg: peso.kg, proteinaGkg: perfil.proteinaGkg }) : null

  return (
    <div className="space-y-3 pb-6">
      <Cabecera titulo="Tu objetivo" atras />
      <Tarjeta>
        <p className="text-sm text-muted">
          {OBJETIVO[perfil.objetivo]}
          {perfil.objetivo !== 'mantener' && ` · ritmo ${RITMO[perfil.ritmo]} (${String(RITMO_PORCENTAJE[perfil.ritmo]).replace('.', ',')} % del peso por semana)`}
        </p>
        <p className="num mt-1 text-4xl font-bold">
          {fmtEntero(perfil.objetivoKcal)} <span className="text-lg font-medium text-muted">kcal de media al día</span>
        </p>
        {macros && (
          <p className="mt-1 text-sm">
            <span className="font-semibold text-accent">{macros.proteina} g de proteína</span> · {macros.carbohidratos} g de hidratos · {macros.grasa} g de grasa
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Metabolismo basal {fmtEntero(perfil.basal)} kcal{perfil.formulaBasal === 'katch' ? ' (Katch-McArdle, con tu porcentaje de grasa)' : ''}: el objetivo nunca baja de ahí. Los días de entreno llevan algo más de hidratos y los de descanso algo menos; el total de la semana es el mismo.
        </p>
        <div className="mt-2 border-t border-line pt-2">
          <Paso
            etiqueta="Proteína (g por kg)"
            valor={perfil.proteinaGkg}
            unidad=""
            min={PROTEINA_MIN}
            max={PROTEINA_MAX}
            paso={0.1}
            formato={(v) => fmtKg(Math.round(v * 10) / 10)}
            onCambio={(v) => actualizarPerfil({ proteinaGkg: Math.round(v * 10) / 10 })}
          />
        </div>
        <Boton className="mt-2 w-full" onClick={() => setRehaciendo(true)}>
          Rehacer el cálculo
        </Boton>
      </Tarjeta>

      <Tarjeta>
        <Interruptor
          activo={perfil.retoActivo}
          onCambio={(v) => actualizarPerfil({ retoActivo: v })}
          etiqueta="Reto de fruta y verdura"
          descripcion="Una propuesta suave a la semana, con una forma fácil de tomarla. Sin rachas ni presión."
        />
        {perfil.retos.some((r) => r.estado === 'gusta' || r.estado === 'no_gusta') && (
          <p className="mt-1 text-sm text-muted">
            Te gustan {perfil.retos.filter((r) => r.estado === 'gusta').length} · No te gustan {perfil.retos.filter((r) => r.estado === 'no_gusta').length}
          </p>
        )}
      </Tarjeta>

      <section>
        <h2 className="mb-1.5 px-1 text-sm font-semibold tracking-wide text-muted uppercase">Revisiones de los lunes</h2>
        {perfil.ajustes.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">El primer lunes aparecerá aquí la primera revisión.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {[...perfil.ajustes].reverse().map((a) => {
              const cambio = a.objetivoNuevo - a.objetivoAnterior
              return (
                <li key={a.lunes} className="px-4 py-3">
                  <p className="flex justify-between gap-2 font-semibold">
                    <span>Lunes {fmtFechaCorta(new Date(`${a.lunes}T12:00`).getTime())}</span>
                    <span className="num">
                      {fmtEntero(a.objetivoNuevo)} kcal
                      {cambio !== 0 && <span className="font-normal text-muted"> ({cambio > 0 ? '+' : '−'}{fmtEntero(Math.abs(cambio))})</span>}
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    {a.gastoReal != null && `Gasto real ${fmtEntero(a.gastoReal)} kcal · `}
                    {a.mediaIngesta != null && `media ${fmtEntero(a.mediaIngesta)} kcal · `}
                    {MOTIVO_AJUSTE[a.motivo] ?? ''}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
