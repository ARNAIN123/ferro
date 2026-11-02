import { BrowserRouter, Route, Routes } from 'react-router'
import { AvisoActualizacion } from './components/AvisoActualizacion'
import { Marco } from './components/Marco'
import { AjustesPage } from './features/ajustes/AjustesPage'
import { EjercicioPage } from './features/ejercicios/EjercicioPage'
import { EjerciciosPage } from './features/ejercicios/EjerciciosPage'
import { NuevoEjercicioPage } from './features/ejercicios/NuevoEjercicioPage'
import { EntrenoPage } from './features/entreno/EntrenoPage'
import { ResumenPage } from './features/entreno/ResumenPage'
import { HistorialPage } from './features/historial/HistorialPage'
import { SesionPage } from './features/historial/SesionPage'
import { HoyPage } from './features/hoy/HoyPage'
import { ProgresoPage } from './features/progreso/ProgresoPage'
import { RutinaPage } from './features/rutinas/RutinaPage'
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
          <Route path="rutinas/:id" element={<RutinaPage />} />
          <Route path="progreso" element={<ProgresoPage />} />
          <Route path="progreso/historial" element={<HistorialPage />} />
          <Route path="progreso/historial/:id" element={<SesionPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="*" element={<HoyPage />} />
        </Route>
        <Route path="entreno" element={<EntrenoPage />} />
        <Route path="entreno/resumen/:id" element={<ResumenPage />} />
      </Routes>
    </BrowserRouter>
  )
}
