import { Outlet } from 'react-router'
import { NavInferior } from './NavInferior'

/** Marco de las pestañas: contenido con márgenes seguros y barra inferior. */
export function Marco() {
  return (
    <>
      <main className="mx-auto max-w-lg px-safe pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <NavInferior />
    </>
  )
}
