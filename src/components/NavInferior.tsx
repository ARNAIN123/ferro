import { NavLink } from 'react-router'
import { Icono, type NombreIcono } from './Icono'

const PESTANAS: { a: string; texto: string; icono: NombreIcono }[] = [
  { a: '/', texto: 'Hoy', icono: 'hoy' },
  { a: '/rutinas', texto: 'Rutinas', icono: 'rutinas' },
  { a: '/progreso', texto: 'Progreso', icono: 'progreso' },
  { a: '/ajustes', texto: 'Ajustes', icono: 'ajustes' },
]

export function NavInferior() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-safe backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {PESTANAS.map((p) => (
          <li key={p.a}>
            <NavLink
              to={p.a}
              end={p.a === '/'}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icono nombre={p.icono} grosor={isActive ? 2.4 : 2} />
                  {p.texto}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
