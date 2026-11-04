import { actualizacionDisponible, type Actualizacion, type ReleaseGithub } from '../domain/actualizaciones'

/** Repositorio de donde salen los APK. Vacío en las compilaciones locales. */
export const REPO_GITHUB = import.meta.env.VITE_REPO_GITHUB ?? ''

export type ResultadoBusqueda = { estado: 'al-dia' } | { estado: 'disponible'; actualizacion: Actualizacion } | { estado: 'error'; mensaje: string }

/** Consulta la última release publicada en GitHub. */
export async function buscarActualizacion(): Promise<ResultadoBusqueda> {
  if (!REPO_GITHUB) return { estado: 'error', mensaje: 'Esta copia de Ferro se compiló en local y no sabe dónde buscar.' }
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO_GITHUB}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (r.status === 404) return { estado: 'error', mensaje: 'Todavía no hay ninguna versión publicada.' }
    if (!r.ok) return { estado: 'error', mensaje: `GitHub no responde (${r.status}). Prueba más tarde.` }
    const nueva = actualizacionDisponible(__APP_VERSION__, (await r.json()) as ReleaseGithub)
    return nueva ? { estado: 'disponible', actualizacion: nueva } : { estado: 'al-dia' }
  } catch {
    return { estado: 'error', mensaje: 'Sin conexión. Conéctate a internet y vuelve a probar.' }
  }
}

/** Abre la descarga en Chrome: Capacitor manda fuera de la app cualquier URL externa. */
export function abrirDescarga(url: string): void {
  window.location.href = url
}
