import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-accent text-accent-ink font-bold active:brightness-90',
  secundario: 'bg-surface-2 text-fg font-semibold active:brightness-110',
  fantasma: 'bg-transparent text-fg font-semibold active:bg-surface-2',
  peligro: 'bg-transparent text-danger font-semibold border border-danger/40 active:bg-danger/10',
}

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  grande?: boolean
}

export function Boton({ variante = 'secundario', grande, className = '', type = 'button', ...resto }: BotonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 transition disabled:opacity-40 ${
        grande ? 'min-h-16 text-lg' : 'min-h-12'
      } ${VARIANTES[variante]} ${className}`}
      {...resto}
    />
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-surface p-4 ${className}`}>{children}</section>
}

export function Etiqueta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted ${className}`}>
      {children}
    </span>
  )
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <p className="condensada text-xl font-bold">{titulo}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

interface CampoProps {
  etiqueta: string
  children: ReactNode
  ayuda?: ReactNode
}

export function Campo({ etiqueta, children, ayuda }: CampoProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-muted">{ayuda}</span>}
    </label>
  )
}

export const claseInput =
  'w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3.5 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none'

interface InterruptorProps {
  activo: boolean
  onCambio: (v: boolean) => void
  etiqueta: string
  descripcion?: string
}

export function Interruptor({ activo, onCambio, etiqueta, descripcion }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambio(!activo)}
      className="flex min-h-14 w-full items-center gap-4 text-left"
    >
      <span className="flex-1">
        <span className="block font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-sm text-muted">{descripcion}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? 'bg-accent' : 'bg-surface-2 border border-line'}`}>
        <span
          className={`absolute top-1 size-5 rounded-full transition-all ${activo ? 'left-6 bg-accent-ink' : 'left-1 bg-muted'}`}
        />
      </span>
    </button>
  )
}

interface SegmentadoProps<T extends string> {
  opciones: { valor: T; texto: string }[]
  valor: T
  onCambio: (v: T) => void
  etiqueta: string
}

export function Segmentado<T extends string>({ opciones, valor, onCambio, etiqueta }: SegmentadoProps<T>) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex rounded-2xl bg-surface-2 p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onCambio(o.valor)}
          className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold transition ${
            valor === o.valor ? 'bg-surface text-fg shadow-sm' : 'text-muted'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
