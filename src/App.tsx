import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AvisoActualizacion } from './components/AvisoActualizacion'
import { Avisos } from './components/Avisos'
import { Marco } from './components/Marco'
import { EmpezarPage } from './features/entreno/EmpezarPage'
import { EntrenoPage } from './features/entreno/EntrenoPage'
import { HoyPage } from './features/hoy/HoyPage'
import { useAjustes } from './hooks/useAjustes'
import { useAvisoDescanso } from './hooks/useAvisoDescanso'
import { useTema } from './hooks/useTema'
import { useVigilancia } from './hooks/useVigilancia'
import { esNativa } from './lib/plataforma'

// Hoy y el modo entreno van en el arranque; el resto se carga al entrar
// (todo queda precacheado igualmente, así que también funciona sin conexión).
function perezosa<K extends string>(cargar: () => Promise<Record<K, ComponentType>>, nombre: K) {
  return lazy(async () => ({ default: (await cargar())[nombre] }))
}

const RutinasPage = perezosa(() => import('./features/rutinas/RutinasPage'), 'RutinasPage')
const RutinaPage = perezosa(() => import('./features/rutinas/RutinaPage'), 'RutinaPage')
const EjerciciosPage = perezosa(() => import('./features/ejercicios/EjerciciosPage'), 'EjerciciosPage')
const NuevoEjercicioPage = perezosa(() => import('./features/ejercicios/NuevoEjercicioPage'), 'NuevoEjercicioPage')
const EjercicioPage = perezosa(() => import('./features/ejercicios/EjercicioPage'), 'EjercicioPage')
const ProgresoPage = perezosa(() => import('./features/progreso/ProgresoPage'), 'ProgresoPage')
const HistorialPage = perezosa(() => import('./features/historial/HistorialPage'), 'HistorialPage')
const SesionPage = perezosa(() => import('./features/historial/SesionPage'), 'SesionPage')
const PesoPage = perezosa(() => import('./features/peso/PesoPage'), 'PesoPage')
const AjustesPage = perezosa(() => import('./features/ajustes/AjustesPage'), 'AjustesPage')
const RegistroDeteccionPage = perezosa(() => import('./features/ajustes/RegistroDeteccionPage'), 'RegistroDeteccionPage')
const ResumenPage = perezosa(() => import('./features/entreno/ResumenPage'), 'ResumenPage')
const VistaPreviaAvatar = perezosa(() => import('./features/vista-previa/VistaPreviaAvatar'), 'VistaPreviaAvatar')
const GaleriaAnimaciones = perezosa(() => import('./features/vista-previa/GaleriaAnimaciones'), 'GaleriaAnimaciones')

export function App() {
  const ajustes = useAjustes()
  useTema(ajustes.tema)
  useVigilancia()
  useAvisoDescanso()

  return (
    <BrowserRouter>
      {/* En la app Android las actualizaciones llegan como APK (Ajustes → Buscar actualizaciones). */}
      {!esNativa() && <AvisoActualizacion />}
      <Avisos />
      <Suspense fallback={null}>
        <Routes>
          <Route element={<Marco />}>
            <Route index element={<HoyPage />} />
            <Route path="rutinas" element={<RutinasPage />} />
            <Route path="rutinas/ejercicios" element={<EjerciciosPage />} />
            <Route path="rutinas/ejercicios/nuevo" element={<NuevoEjercicioPage />} />
            <Route path="rutinas/ejercicios/:id" element={<EjercicioPage />} />
            <Route path="rutinas/nueva" element={<RutinaPage />} />
            <Route path="rutinas/:id" element={<RutinaPage />} />
            <Route path="progreso" element={<ProgresoPage />} />
            <Route path="progreso/historial" element={<HistorialPage />} />
            <Route path="progreso/historial/:id" element={<SesionPage />} />
            <Route path="peso" element={<PesoPage />} />
            <Route path="ajustes" element={<AjustesPage />} />
            <Route path="ajustes/deteccion" element={<RegistroDeteccionPage />} />
            <Route path="vista-previa/avatar" element={<VistaPreviaAvatar />} />
            <Route path="vista-previa/animaciones" element={<GaleriaAnimaciones />} />
            <Route path="*" element={<HoyPage />} />
          </Route>
          <Route path="empezar" element={<EmpezarPage />} />
          <Route path="entreno" element={<EntrenoPage />} />
          <Route path="entreno/resumen/:id" element={<ResumenPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
