import { useLiveQuery } from 'dexie-react-hooks'
import { Boton, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { actualizarPerfil } from '../../db/nutricion'
import { macrosDelDia } from '../../domain/nutricion'
import { resumenSemana } from '../../domain/registroComidas'
import { claveDia, sumarDias } from '../../domain/semanas'
import type { AjusteSemanal, PerfilNutricion } from '../../domain/tiposNutricion'
import { fmtEntero, fmtKg } from '../../lib/formato'

export const MOTIVO_AJUSTE: Record<string, string> = {
  estimacion: 'Las dos primeras semanas se mantiene la estimación inicial.',
  pocos_registros: 'Para calcular tu gasto real hacen falta al menos 10 días con comidas registradas en las dos últimas semanas. Se mantiene el objetivo.',
  poco_peso: 'Faltan pesos para ver la tendencia (al menos 3 en cada semana). Se mantiene el objetivo.',
  ajustado: 'Ajustado con tu gasto real.',
  limitado: 'Ajustado con tu gasto real, como mucho 150 kcal por semana para que el cambio sea suave.',
  sin_cambios: 'Vas al ritmo previsto: sin cambios.',
}

/** Revisión de los lunes: medias de la semana pasada, tendencia del peso y el ajuste aplicado. */
export function RevisionSemanal({ perfil, ajuste, kg, alCerrar }: { perfil: PerfilNutricion; ajuste: AjusteSemanal; kg: number; alCerrar?: () => void }) {
  const semana = useLiveQuery(async () => {
    const lunes = new Date(`${ajuste.lunes}T12:00`).getTime()
    const desde = claveDia(sumarDias(lunes, -7))
    const hasta = claveDia(sumarDias(lunes, -1))
    return resumenSemana(await db.comidas.where('fecha').between(desde, hasta, true, true).toArray())
  }, [ajuste.lunes])
  const proteinaObjetivo = macrosDelDia({ kcalDia: ajuste.objetivoAnterior, kcalMedia: ajuste.objetivoAnterior, kg, proteinaGkg: perfil.proteinaGkg }).proteina
  const cambio = ajuste.objetivoNuevo - ajuste.objetivoAnterior

  return (
    <Tarjeta className="border-accent">
      <h2 className="font-bold">Revisión de la semana</h2>
      <dl className="mt-2 space-y-1.5 text-sm">
        <Fila nombre="Media de calorías">
          {semana?.mediaKcal != null ? `${fmtEntero(semana.mediaKcal)} kcal` : '—'} <span className="text-muted">(objetivo {fmtEntero(ajuste.objetivoAnterior)})</span>
        </Fila>
        <Fila nombre="Media de proteína">
          <span className="text-accent">{semana?.mediaProteina != null ? `${semana.mediaProteina} g` : '—'}</span> <span className="text-muted">(objetivo {proteinaObjetivo} g)</span>
        </Fila>
        {semana && <Fila nombre="Días registrados">{semana.diasRegistrados} de 7</Fila>}
        <Fila nombre="Tendencia del peso">
          {ajuste.cambioSemanal != null ? `${ajuste.cambioSemanal > 0 ? '+' : ajuste.cambioSemanal < 0 ? '−' : ''}${fmtKg(Math.abs(ajuste.cambioSemanal))} kg por semana` : 'Aún sin datos suficientes'}
        </Fila>
        <Fila nombre="Gasto real calculado">{ajuste.gastoReal != null ? `${fmtEntero(ajuste.gastoReal)} kcal al día` : 'Aún estimado'}</Fila>
        <Fila nombre="Objetivo desde hoy">
          <span className="font-semibold">{fmtEntero(ajuste.objetivoNuevo)} kcal</span>
          {cambio !== 0 && <span className="text-muted"> ({cambio > 0 ? '+' : '−'}{fmtEntero(Math.abs(cambio))})</span>}
        </Fila>
      </dl>
      <p className="mt-2 text-sm text-muted">{MOTIVO_AJUSTE[ajuste.motivo] ?? ''}</p>
      {alCerrar && (
        <Boton
          className="mt-3 w-full"
          onClick={async () => {
            await actualizarPerfil({ revisionVista: ajuste.lunes })
            alCerrar()
          }}
        >
          Entendido
        </Boton>
      )}
    </Tarjeta>
  )
}

function Fila({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{nombre}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  )
}
