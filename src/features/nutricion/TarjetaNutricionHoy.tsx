import { Link } from 'react-router'
import { Icono } from '../../components/Icono'
import { fmtEntero } from '../../lib/formato'
import { useDiaNutricion } from './useDiaNutricion'

/** Tarjeta compacta de Hoy: lo que me queda de calorías y de proteína. */
export function TarjetaNutricionHoy({ fecha }: { fecha: string }) {
  const dia = useDiaNutricion(fecha)
  if (!dia) return null
  const clase = 'flex min-h-14 w-full items-center gap-3 rounded-3xl border border-line bg-surface px-4 text-left active:bg-surface-2'
  if (!dia.perfil || !dia.objetivo) {
    return (
      <Link to="/nutricion" className={clase}>
        <Icono nombre="nutricion" tamano={20} className="text-muted" />
        <span className="flex-1">
          <span className="font-semibold">Nutrición</span>
          <span className="block text-sm text-muted">{dia.perfil ? 'Registra tu peso para calcular el objetivo' : 'Calcula tu objetivo en un minuto'}</span>
        </span>
        <Icono nombre="adelante" tamano={20} className="text-muted" />
      </Link>
    )
  }
  const kcal = Math.round(dia.objetivo.kcal - dia.comido.kcal)
  const prot = Math.round(dia.objetivo.proteina - dia.comido.proteina)
  return (
    <Link to="/nutricion" className={clase}>
      <Icono nombre="nutricion" tamano={20} className="text-muted" />
      <span className="flex-1">
        {kcal >= 0 ? (
          <span className="font-semibold">
            Te quedan <span className="num">{fmtEntero(kcal)}</span> kcal
            {prot > 0 && (
              <>
                {' · '}
                <span className="num text-accent">{prot} g de proteína</span>
              </>
            )}
          </span>
        ) : (
          <span className="font-semibold">
            Objetivo de hoy cubierto
            {prot > 0 && (
              <>
                {' · faltan '}
                <span className="num text-accent">{prot} g de proteína</span>
              </>
            )}
          </span>
        )}
        <span className="block text-sm text-muted">
          {fmtEntero(dia.comido.kcal)} de {fmtEntero(dia.objetivo.kcal)} kcal{dia.entrena ? ' · día de entreno' : ''}
        </span>
      </span>
      <Icono nombre="mas" tamano={20} className="text-accent" />
    </Link>
  )
}
