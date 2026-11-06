import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ajustar, inercia, marcasCruzadas, valorTrasArrastre, VELOCIDAD_MINIMA } from '../domain/regla'
import { tic } from '../lib/haptica'

interface Props {
  valor: number
  onCambio: (v: number) => void
  min: number
  max: number
  /** Paso al que se ajusta (0,1 kg, 5 g…). */
  paso: number
  /** Cada cuánto hay una marca grande con su número (1 kg, 50 g…). */
  marcaGrande: number
  /** Píxeles por paso. */
  pasoPx?: number
  etiqueta: string
  formatoMarca?: (v: number) => string
}

const ALTO = 64

/**
 * Regla horizontal deslizable: se arrastra con el dedo, un lanzamiento rápido sigue por inercia y
 * siempre acaba ajustada al paso. Vibra suave en cada paso y más marcado en cada marca grande.
 */
export function Regla({ valor, onCambio, min, max, paso, marcaGrande, pasoPx = 12, etiqueta, formatoMarca = String }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(320)
  // Valor continuo mientras se arrastra o sigue por inercia; el que se emite va siempre ajustado.
  const [crudo, setCrudo] = useState(valor)
  const activo = useRef(false)
  const gesto = useRef<{ x0: number; v0: number; muestras: [number, number][] } | null>(null)
  const animacion = useRef<number | null>(null)
  const actual = useRef(valor)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setAncho(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Cambios desde fuera (botones, teclado) mueven la regla si no la estoy tocando.
  useEffect(() => {
    if (!activo.current) {
      actual.current = valor
      setCrudo(valor)
    }
  }, [valor])

  useEffect(() => () => {
    if (animacion.current !== null) cancelAnimationFrame(animacion.current)
  }, [])

  const mover = (v: number) => {
    const limitado = Math.min(max, Math.max(min, v))
    const { pasos, grandes } = marcasCruzadas(actual.current, limitado, paso, marcaGrande)
    if (grandes > 0) tic(true)
    else if (pasos > 0) tic(false)
    actual.current = limitado
    setCrudo(limitado)
    const ajustado = ajustar(limitado, paso, min, max)
    if (ajustado !== valor) onCambio(ajustado)
    return limitado
  }

  const terminar = () => {
    activo.current = false
    const final = ajustar(actual.current, paso, min, max)
    actual.current = final
    setCrudo(final)
    onCambio(final)
  }

  const parar = () => {
    if (animacion.current !== null) cancelAnimationFrame(animacion.current)
    animacion.current = null
  }

  const abajo = (e: PointerEvent<HTMLDivElement>) => {
    parar()
    activo.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sin captura el arrastre funciona igual mientras el dedo siga encima.
    }
    gesto.current = { x0: e.clientX, v0: actual.current, muestras: [[performance.now(), e.clientX]] }
  }

  const arrastre = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    if (!g) return
    g.muestras.push([performance.now(), e.clientX])
    if (g.muestras.length > 6) g.muestras.shift()
    mover(valorTrasArrastre(g.v0, e.clientX - g.x0, pasoPx, paso))
  }

  const arriba = () => {
    const g = gesto.current
    gesto.current = null
    if (!g) return
    // Velocidad de los últimos ~80 ms (px/ms).
    const ahora = performance.now()
    const recientes = g.muestras.filter(([t]) => ahora - t < 100)
    const [t0, x0] = recientes[0] ?? [ahora, 0]
    const [t1, x1] = recientes.at(-1) ?? [ahora, 0]
    const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0
    if (Math.abs(v) < 0.25) return terminar()
    const base = actual.current
    const inicio = performance.now()
    const paso1 = () => {
      const t = performance.now() - inicio
      const { dx, v: vt } = inercia(v, t)
      const nuevo = mover(valorTrasArrastre(base, dx, pasoPx, paso))
      if (Math.abs(vt) < VELOCIDAD_MINIMA || nuevo <= min || nuevo >= max) {
        animacion.current = null
        return terminar()
      }
      animacion.current = requestAnimationFrame(paso1)
    }
    animacion.current = requestAnimationFrame(paso1)
  }

  const tecla = (e: KeyboardEvent) => {
    const d = { ArrowRight: paso, ArrowUp: paso, ArrowLeft: -paso, ArrowDown: -paso, PageUp: marcaGrande, PageDown: -marcaGrande }[e.key]
    if (d === undefined) return
    e.preventDefault()
    onCambio(ajustar(valor + d, paso, min, max))
  }

  // Marcas visibles alrededor del valor.
  const mitad = ancho / 2
  const rango = (mitad / pasoPx) * paso
  const desde = Math.ceil((crudo - rango) / paso)
  const hasta = Math.floor((crudo + rango) / paso)
  const porGrande = Math.round(marcaGrande / paso)
  const porMedia = porGrande % 2 === 0 ? porGrande / 2 : 0
  const marcas: { x: number; tipo: 'g' | 'm' | 'p'; v: number }[] = []
  for (let i = desde; i <= hasta; i++) {
    const v = i * paso
    if (v < min - 1e-9 || v > max + 1e-9) continue
    const tipo = i % porGrande === 0 ? 'g' : porMedia && i % porMedia === 0 ? 'm' : 'p'
    marcas.push({ x: mitad + ((v - crudo) / paso) * pasoPx, tipo, v })
  }

  return (
    <div
      ref={caja}
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={valor}
      onKeyDown={tecla}
      onPointerDown={abajo}
      onPointerMove={arrastre}
      onPointerUp={arriba}
      onPointerCancel={arriba}
      className="relative w-full cursor-grab touch-pan-y overflow-hidden rounded-2xl bg-surface-2 select-none focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
      style={{ height: ALTO }}
    >
      <svg width={ancho} height={ALTO} className="block" aria-hidden>
        {marcas.map((m) => (
          <g key={m.v.toFixed(4)}>
            <line
              x1={m.x}
              x2={m.x}
              y1={0}
              y2={m.tipo === 'g' ? 26 : m.tipo === 'm' ? 17 : 10}
              className={m.tipo === 'p' ? 'stroke-muted/50' : 'stroke-muted'}
              strokeWidth={m.tipo === 'g' ? 2 : 1.2}
            />
            {m.tipo === 'g' && (
              <text x={m.x} y={46} textAnchor="middle" className="num fill-muted text-[12px]">
                {formatoMarca(m.v)}
              </text>
            )}
          </g>
        ))}
        {/* Bordes que se desvanecen */}
        <defs>
          <linearGradient id="regla-borde" x1="0" x2="1">
            <stop offset="0" stopColor="var(--surface-2)" stopOpacity="1" />
            <stop offset="0.18" stopColor="var(--surface-2)" stopOpacity="0" />
            <stop offset="0.82" stopColor="var(--surface-2)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--surface-2)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width={ancho} height={ALTO} fill="url(#regla-borde)" />
        <line x1={mitad} x2={mitad} y1={0} y2={ALTO - 8} className="stroke-accent" strokeWidth={3} strokeLinecap="round" />
      </svg>
    </div>
  )
}
