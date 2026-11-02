import { BrowserRouter, Route, Routes } from 'react-router'
import { AvisoActualizacion } from './components/AvisoActualizacion'
import { Marco } from './components/Marco'
import { AjustesPage } from './features/ajustes/AjustesPage'
import { EjercicioPage } from './features/ejercicios/EjercicioPage'
import { EjerciciosPage } from './features/ejercicios/EjerciciosPage'
import { NuevoEjercicioPage } from './features/ejercicios/NuevoEjercicioPage'
import { HoyPage } from './features/hoy/HoyPage'
import { ProgresoPage } from './features/progreso/ProgresoPage'
import { RutinasPage } from './features/rutinas/RutinasPage'
import { useAjustes } from './hooks/useAjustes'
import { useTema } from './hooks/useTema'

export function App() {
  const ajustes = useAjustes()
  useTema(ajustes.tema)

  return (
    <BrowserRouter>
      <AvisoActualizacion />
      <Routes>
        <Route element={<Marco />}>
          <Route index element={<HoyPage />} />
          <Route path="rutinas" element={<RutinasPage />} />
          <Route path="rutinas/ejercicios" element={<EjerciciosPage />} />
          <Route path="rutinas/ejercicios/nuevo" element={<NuevoEjercicioPage />} />
          <Route path="rutinas/ejercicios/:id" element={<EjercicioPage />} />
          <Route path="progreso" element={<ProgresoPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="*" element={<HoyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
