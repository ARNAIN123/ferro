import { Cabecera } from '../../components/Cabecera'
import { Vacio } from '../../components/ui'
import { PestanasRutinas } from './PestanasRutinas'

export function RutinasPage() {
  return (
    <>
      <Cabecera titulo="Rutinas" />
      <PestanasRutinas />
      <Vacio titulo="Aún no tienes rutinas" />
    </>
  )
}
