import { useState, type ReactNode } from 'react'
import { Icono } from '../../components/Icono'
import { MapaMuscular } from '../../components/mapa/MapaMuscular'
import { claseInput } from '../../components/ui'
import type { Filtros } from '../../domain/biblioteca'
import { NOMBRE_CATEGORIA, NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { CATEGORIAS, MATERIALES, MUSCULOS, type Musculo } from '../../domain/tipos'

const MATERIALES_FILTRO = MATERIALES.filter((m) => m !== 'ninguno' && m !== 'foam_roller')

interface Props {
  filtros: Filtros
  onCambio: (f: Filtros) => void
  /** Bloquea el músculo (p. ej. al buscar alternativas). */
  musculoFijo?: boolean
}

/** Buscador y filtros: categoría (por defecto fuerza), músculo con chips o tocando el mapa, y material. */
export function FiltrosBiblioteca({ filtros, onCambio, musculoFijo }: Props) {
  const [verMapa, setVerMapa] = useState(false)
  const cambiar = (c: Partial<Filtros>) => onCambio({ ...filtros, ...c })

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Icono nombre="buscar" tamano={20} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
        <input
          type="search"
          className={`${claseInput} pl-11`}
          placeholder="Buscar en español o en inglés"
          value={filtros.texto}
          onChange={(e) => cambiar({ texto: e.target.value })}
          aria-label="Buscar ejercicio"
        />
      </div>

      <Fila etiqueta="Categoría">
        <Chip activo={filtros.categoria === null} onClick={() => cambiar({ categoria: null })}>
          Todas
        </Chip>
        {CATEGORIAS.map((c) => (
          <Chip key={c} activo={filtros.categoria === c} onClick={() => cambiar({ categoria: c })}>
            {NOMBRE_CATEGORIA[c]}
          </Chip>
        ))}
      </Fila>

      {!musculoFijo && (
        <>
          <Fila etiqueta="Músculo">
            <button
              type="button"
              onClick={() => setVerMapa(!verMapa)}
              aria-pressed={verMapa}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
                verMapa ? 'border-fg bg-fg text-bg' : 'border-line text-fg'
              }`}
            >
              <Icono nombre="mano" tamano={16} /> Mapa
            </button>
            <Chip activo={filtros.musculo === null} onClick={() => cambiar({ musculo: null })}>
              Todos
            </Chip>
            {MUSCULOS.map((m) => (
              <Chip key={m} activo={filtros.musculo === m} onClick={() => cambiar({ musculo: filtros.musculo === m ? null : m })}>
                {NOMBRE_MUSCULO[m]}
              </Chip>
            ))}
          </Fila>
          {verMapa && (
            <div className="anim-aparecer rounded-2xl border border-line bg-surface p-2">
              <MapaMuscular
                niveles={filtros.musculo ? new Map<Musculo, number>([[filtros.musculo, 5]]) : new Map()}
                seleccionado={filtros.musculo}
                onTocar={(m) => cambiar({ musculo: filtros.musculo === m ? null : m })}
                className="h-64"
              />
              <p className="mt-1 text-center text-xs text-muted">
                {filtros.musculo ? `Filtrando por ${NOMBRE_MUSCULO[filtros.musculo].toLowerCase()}` : 'Toca un músculo para filtrar'}
              </p>
            </div>
          )}
        </>
      )}

      <Fila etiqueta="Material">
        <Chip activo={filtros.material === null} onClick={() => cambiar({ material: null })}>
          Todo
        </Chip>
        {MATERIALES_FILTRO.map((m) => (
          <Chip key={m} activo={filtros.material === m} onClick={() => cambiar({ material: filtros.material === m ? null : m })}>
            {NOMBRE_MATERIAL[m]}
          </Chip>
        ))}
      </Fila>
    </div>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={etiqueta} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
      {children}
    </div>
  )
}

export function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition ${
        activo ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'
      }`}
    >
      {children}
    </button>
  )
}
