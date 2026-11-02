import { Link } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Tarjeta } from '../../components/ui'
import { fmtFechaLarga } from '../../lib/formato'

export function HoyPage() {
  return (
    <>
      <Cabecera titulo="Hoy" subtitulo={<span className="capitalize">{fmtFechaLarga(Date.now())}</span>} />
      <Tarjeta className="mt-4">
        <p className="condensada text-2xl font-bold">Bienvenido a Ferro</p>
        <p className="mt-1 text-muted">
          Empieza revisando la <Link to="/rutinas/ejercicios" className="text-accent underline">biblioteca de ejercicios</Link>.
        </p>
      </Tarjeta>
    </>
  )
}
