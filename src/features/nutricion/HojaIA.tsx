import { useEffect, useRef, useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Boton, claseInput } from '../../components/ui'
import { guardarAlimento, registrarAlimento, type AlimentoCualquiera } from '../../db/nutricion'
import type { ItemInterpretado } from '../../domain/interpretacion'
import { valoresDe } from '../../domain/registroComidas'
import { NOMBRE_COMIDA, type Comida } from '../../domain/tiposNutricion'
import { avisar } from '../../lib/avisos'
import { leerClaveIA } from '../../lib/claveIA'
import { fmtEntero, fmtKg, parseNumero } from '../../lib/formato'

interface Props {
  abierta: boolean
  onCerrar: () => void
  /** Al terminar de añadir se cierra también la hoja de añadir. */
  onTerminado: () => void
  fecha: string
  comida: Comida
  alimentos: readonly AlimentoCualquiera[]
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Describir la comida en texto: la IA propone, yo reviso y añado. */
export function HojaIA({ abierta, onCerrar, onTerminado, fecha, comida, alimentos }: Props) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<{ cargando: boolean; error: string | null }>({ cargando: false, error: null })
  const [items, setItems] = useState<(ItemInterpretado & { incluido: boolean })[] | null>(null)
  const peticion = useRef<AbortController | null>(null)

  useEffect(() => {
    if (abierta) return
    peticion.current?.abort()
    setItems(null)
    setEstado({ cargando: false, error: null })
  }, [abierta])

  const interpretar = async () => {
    const t = texto.trim()
    if (!t) return
    peticion.current?.abort()
    const c = new AbortController()
    peticion.current = c
    setEstado({ cargando: true, error: null })
    try {
      const catalogo = alimentos.map((a) => ({ id: a.id, nombre: a.nombre, estado: a.estado }))
      // El SDK solo se descarga la primera vez que se usa.
      const { interpretarComida } = await import('../../lib/interpretarComida')
      const r = await interpretarComida(t, leerClaveIA(), catalogo, c.signal)
      if (c.signal.aborted) return
      setItems(r.map((i) => ({ ...i, incluido: true })))
      setEstado({ cargando: false, error: r.length ? null : 'No se encontró ningún alimento en el texto.' })
    } catch (e) {
      if (!c.signal.aborted) setEstado({ cargando: false, error: e instanceof Error ? e.message : 'No se pudo interpretar.' })
    }
  }

  const anadir = async () => {
    if (!items) return
    const elegidos = items.filter((i) => i.incluido)
    for (const i of elegidos) {
      const existente = i.alimentoId ? alimentos.find((a) => a.id === i.alimentoId) : undefined
      const alimento =
        existente ??
        (await guardarAlimento({ id: `ia-${slug(i.nombre)}${i.estado ? `-${i.estado}` : ''}`, nombre: i.nombre, origen: 'ia', estado: i.estado, por100: i.por100, raciones: [] }))
      await registrarAlimento({ fecha, comida, alimento, gramos: i.gramos, racion: null })
    }
    avisar(`${elegidos.length} ${elegidos.length === 1 ? 'alimento añadido' : 'alimentos añadidos'} a ${NOMBRE_COMIDA[comida].toLowerCase()}`)
    setTexto('')
    onCerrar()
    onTerminado()
  }

  const cambiar = (n: number, cambios: Partial<ItemInterpretado & { incluido: boolean }>) => setItems((l) => l && l.map((i, k) => (k === n ? { ...i, ...cambios } : i)))
  const incluidos = items?.filter((i) => i.incluido) ?? []

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Describe lo que has comido">
      <div className="space-y-3 pb-2">
        {!items ? (
          <>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder="Por ejemplo: 200 g de pollo a la plancha con 80 g de arroz en crudo y un yogur"
              className={`${claseInput} min-h-24 py-3`}
            />
            <p className="text-xs text-muted">El texto se envía a Anthropic con tu clave. Revisarás el resultado antes de guardarlo.</p>
            {estado.error && <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">{estado.error}</p>}
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Boton onClick={onCerrar}>Volver</Boton>
              <Boton variante="primario" grande onClick={interpretar} disabled={!texto.trim() || estado.cargando}>
                {estado.cargando ? 'Interpretando…' : 'Interpretar'}
              </Boton>
            </div>
          </>
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {items.map((i, n) => {
                const v = valoresDe(i.por100, i.gramos)
                return (
                  <li key={`${i.nombre}-${n}`} className={`flex items-center gap-3 px-3 py-2 ${i.incluido ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={i.incluido}
                      onChange={(e) => cambiar(n, { incluido: e.target.checked })}
                      aria-label={`Incluir ${i.nombre}`}
                      className="size-5 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{i.nombre}</span>
                      <span className="block text-xs text-muted">
                        {i.estado ? `${i.estado} · ` : ''}
                        {i.alimentoId ? 'de tu base' : 'valores estimados por la IA'} · {v.kcal} kcal · <span className="text-accent">{fmtKg(v.proteina)} g prot.</span>
                      </span>
                    </span>
                    <label className="flex items-baseline gap-1">
                      <span className="sr-only">Gramos de {i.nombre}</span>
                      <input
                        inputMode="numeric"
                        defaultValue={String(i.gramos)}
                        onBlur={(e) => {
                          const g = parseNumero(e.target.value)
                          if (g !== null && g > 0) cambiar(n, { gramos: Math.min(3000, Math.round(g)) })
                          else e.target.value = String(i.gramos)
                        }}
                        className="num w-16 rounded-lg bg-surface-2 px-2 py-1.5 text-right font-semibold"
                      />
                      <span className="text-sm text-muted">g</span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="text-sm text-muted">
              Total: {fmtEntero(incluidos.reduce((s, i) => s + valoresDe(i.por100, i.gramos).kcal, 0))} kcal ·{' '}
              {fmtKg(Math.round(incluidos.reduce((s, i) => s + valoresDe(i.por100, i.gramos).proteina, 0) * 10) / 10)} g de proteína
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Boton onClick={() => setItems(null)}>Editar texto</Boton>
              <Boton variante="primario" grande onClick={anadir} disabled={incluidos.length === 0}>
                Añadir {incluidos.length} a {NOMBRE_COMIDA[comida].toLowerCase()}
              </Boton>
            </div>
          </>
        )}
      </div>
    </Hoja>
  )
}
