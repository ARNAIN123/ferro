import { Cabecera } from '../../components/Cabecera'
import { Vacio } from '../../components/ui'

export function ProgresoPage() {
  return (
    <>
      <Cabecera titulo="Progreso" />
      <div className="mt-4">
        <Vacio titulo="Todavía no hay datos">Aquí verás tu asistencia, récords y gráficas.</Vacio>
      </div>
    </>
  )
}
