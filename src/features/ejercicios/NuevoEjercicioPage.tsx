import { useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { crearEjercicio } from '../../db/ejercicios'
import { FormEjercicio } from './FormEjercicio'

export function NuevoEjercicioPage() {
  const navegar = useNavigate()
  return (
    <>
      <Cabecera titulo="Nuevo ejercicio" atras />
      <div className="mt-4">
        <FormEjercicio
          textoGuardar="Crear ejercicio"
          onGuardar={async (datos) => {
            const id = await crearEjercicio(datos)
            navegar(`/rutinas/ejercicios/${id}`, { replace: true })
          }}
        />
      </div>
    </>
  )
}
