// Lo que comparten el cuerpo 3D y las animaciones en React: entorno y luces de estudio.
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { crearEntorno, lucesEstudio } from '../../animacion3d/estudio'

export { BASE, conDraco, crearEntorno, leerColores, lucesEstudio } from '../../animacion3d/estudio'

export function useEntornoEstudio(): void {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const e = crearEntorno(gl)
    scene.environment = e.textura
    invalidate()
    return () => {
      scene.environment = null
      e.liberar()
    }
  }, [gl, scene, invalidate])
}

export function LucesEstudio() {
  const luces = useMemo(lucesEstudio, [])
  return (
    <>
      {luces.map((luz, i) => (
        <primitive key={i} object={luz} />
      ))}
    </>
  )
}
