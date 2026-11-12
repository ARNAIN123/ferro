import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Lo que se ve si algo de dentro falla, con el motivo. */
  alFallar: (error: Error, reintentar: () => void) => ReactNode
  children: ReactNode
}

/**
 * Límite de errores: si algo de dentro falla al dibujarse, se ve `alFallar` en vez de quedarse la
 * pantalla vacía (sin él, React desmonta toda la app). El error se guarda para poder consultarlo.
 */
export class LimiteError extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ferro:', error, info.componentStack)
    guardarUltimoError(error)
  }

  reintentar = () => this.setState({ error: null })

  render() {
    return this.state.error ? this.props.alFallar(this.state.error, this.reintentar) : this.props.children
  }
}

/** El último error (solo en este móvil), para poder contarlo. */
export function guardarUltimoError(error: unknown): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error))
    localStorage.setItem('ferro.ultimoError', `${new Date().toISOString()} · ${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 6).join('\n')}`)
  } catch {
    // Sin localStorage: no se guarda.
  }
}

/** Pantalla que sustituye a una pantalla que ha fallado: el motivo y cómo seguir. */
export function PantallaError({ error, reintentar }: { error: Error; reintentar: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-24">
      <h1 className="condensada text-3xl font-bold">Algo ha fallado</h1>
      <p className="mt-2 text-muted">Esta pantalla no se ha podido mostrar. Tus datos no se han tocado.</p>
      <p className="mt-4 rounded-2xl bg-surface-2 px-3 py-2 font-mono text-xs break-words select-text">
        {error.name}: {error.message}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={reintentar} className="min-h-12 rounded-2xl bg-accent px-5 font-bold text-accent-ink">
          Reintentar
        </button>
        <button type="button" onClick={() => window.location.assign('/')} className="min-h-12 rounded-2xl bg-surface-2 px-5 font-semibold">
          Ir a Hoy
        </button>
      </div>
    </div>
  )
}
