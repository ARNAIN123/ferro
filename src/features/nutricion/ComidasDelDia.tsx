import { useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Regla } from '../../components/Regla'
import { Boton, Campo, claseInput, Segmentado } from '../../components/ui'
import { borrarRegistro, cambiarCantidad, guardarPlato, repetirComida } from '../../db/nutricion'
import { sumar, valoresDe } from '../../domain/registroComidas'
import { claveDia, sumarDias } from '../../domain/semanas'
import { COMIDAS, COMIDAS_ENTRENO, NOMBRE_COMIDA, type Comida, type RegistroComida } from '../../domain/tiposNutricion'
import { avisar } from '../../lib/avisos'
import { fmtEntero, fmtKg, parseNumero } from '../../lib/formato'

interface Props {
  fecha: string
  registros: readonly RegistroComida[]
  entrena: boolean
  onAnadir: (comida: Comida) => void
}

/** Las comidas del día. "Antes" y "Después de entrenar" solo salen los días de entreno (o si tienen algo). */
export function ComidasDelDia({ fecha, registros, entrena, onAnadir }: Props) {
  const [editando, setEditando] = useState<RegistroComida | null>(null)
  const [opciones, setOpciones] = useState<Comida | null>(null)
  const visibles = COMIDAS.filter((c) => !COMIDAS_ENTRENO.has(c) || entrena || registros.some((r) => r.comida === c))

  return (
    <section aria-label="Comidas" className="space-y-2">
      {visibles.map((c) => {
        const de = registros.filter((r) => r.comida === c)
        const t = sumar(de)
        return (
          <div key={c} className="overflow-hidden rounded-3xl border border-line bg-surface">
            <div className="flex items-center gap-1 pl-4">
              <div className="min-w-0 flex-1 py-3">
                <h3 className="font-bold">{NOMBRE_COMIDA[c]}</h3>
                {de.length > 0 && (
                  <p className="text-sm text-muted">
                    <span className="num">{fmtEntero(t.kcal)}</span> kcal · <span className="num text-accent">{fmtEntero(t.proteina)} g prot.</span>
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setOpciones(c)} aria-label={`Más opciones de ${NOMBRE_COMIDA[c]}`} className="grid size-12 place-items-center text-muted active:bg-surface-2">
                <Icono nombre="puntos" />
              </button>
              <button type="button" onClick={() => onAnadir(c)} aria-label={`Añadir a ${NOMBRE_COMIDA[c]}`} className="grid size-14 place-items-center text-accent active:bg-surface-2">
                <Icono nombre="mas" />
              </button>
            </div>
            {de.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {de.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setEditando(r)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.nombre}</span>
                        <span className="text-xs text-muted">{r.racion ?? `${fmtEntero(r.gramos)} g`}</span>
                      </span>
                      <span className="num text-right text-sm">
                        {fmtEntero(r.valores.kcal)} <span className="text-muted">kcal</span>
                        <span className="block text-xs text-accent">{fmtKg(r.valores.proteina)} g</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      <HojaEditar registro={editando} onCerrar={() => setEditando(null)} />
      <HojaOpciones comida={opciones} fecha={fecha} registros={registros.filter((r) => r.comida === opciones)} onCerrar={() => setOpciones(null)} />
    </section>
  )
}

function HojaEditar({ registro, onCerrar }: { registro: RegistroComida | null; onCerrar: () => void }) {
  const [gramos, setGramos] = useState<number | null>(null)
  const [texto, setTexto] = useState<string | null>(null)
  const g = gramos ?? registro?.gramos ?? 100
  const cerrar = () => {
    setGramos(null)
    setTexto(null)
    onCerrar()
  }
  const por100 = registro && registro.gramos > 0 ? { kcal: (registro.valores.kcal * 100) / registro.gramos, proteina: (registro.valores.proteina * 100) / registro.gramos, carbohidratos: (registro.valores.carbohidratos * 100) / registro.gramos, grasa: (registro.valores.grasa * 100) / registro.gramos } : null
  const v = por100 ? valoresDe(por100, g) : null
  return (
    <Hoja abierta={registro !== null} onCerrar={cerrar} titulo={registro?.nombre ?? ''}>
      {registro && (
        <div className="pb-2">
          <div className="flex items-baseline justify-center gap-1">
            <input
              aria-label="Cantidad en gramos. Toca para escribirla"
              inputMode="numeric"
              value={texto ?? String(g)}
              onFocus={(e) => {
                setTexto(String(g))
                e.currentTarget.select()
              }}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => {
                const n = texto === null ? null : parseNumero(texto)
                if (n !== null && n > 0) setGramos(Math.min(2000, Math.round(n)))
                setTexto(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="num w-[4.6ch] bg-transparent text-center text-5xl font-bold outline-none focus:text-accent"
            />
            <span className="text-lg font-semibold text-muted">g</span>
          </div>
          <div className="mt-2">
            <Regla valor={g} onCambio={setGramos} min={5} max={1500} paso={5} marcaGrande={50} pasoPx={10} etiqueta="Cantidad en gramos" formatoMarca={(x) => String(Math.round(x))} />
          </div>
          {v && (
            <p className="mt-3 text-center text-sm text-muted">
              <span className="num font-semibold text-fg">{v.kcal}</span> kcal · <span className="num font-semibold text-accent">{fmtKg(v.proteina)} g</span> proteína · {fmtKg(v.carbohidratos)} g hidratos ·{' '}
              {fmtKg(v.grasa)} g grasa
            </p>
          )}
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <Boton
              aria-label="Quitar"
              onClick={async () => {
                await borrarRegistro(registro.id)
                avisar(`${registro.nombre} quitado`)
                cerrar()
              }}
            >
              <Icono nombre="papelera" />
            </Boton>
            <Boton
              variante="primario"
              grande
              onClick={async () => {
                if (g !== registro.gramos) await cambiarCantidad(registro.id, g, null)
                cerrar()
              }}
            >
              Guardar
            </Boton>
          </div>
        </div>
      )}
    </Hoja>
  )
}

/** Guardar la comida como plato o copiarla de otro día. */
function HojaOpciones({ comida, fecha, registros, onCerrar }: { comida: Comida | null; fecha: string; registros: readonly RegistroComida[]; onCerrar: () => void }) {
  const [modo, setModo] = useState<'menu' | 'plato' | 'copiar'>('menu')
  const [nombre, setNombre] = useState('')
  const ayer = claveDia(sumarDias(new Date(`${fecha}T12:00`).getTime(), -1))
  const [deFecha, setDeFecha] = useState(ayer)
  const [deComida, setDeComida] = useState<Comida>('desayuno')
  const cerrar = () => {
    setModo('menu')
    setNombre('')
    onCerrar()
  }
  const abrirCopiar = () => {
    setDeFecha(ayer)
    if (comida) setDeComida(comida)
    setModo('copiar')
  }
  if (!comida) return null
  return (
    <Hoja abierta onCerrar={cerrar} titulo={NOMBRE_COMIDA[comida]}>
      <div className="space-y-2 pb-2">
        {modo === 'menu' && (
          <>
            <button type="button" onClick={abrirCopiar} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left font-semibold active:bg-line">
              <Icono nombre="copiar" className="text-muted" /> Repetir una comida de otro día
            </button>
            <button
              type="button"
              disabled={registros.length === 0}
              onClick={() => setModo('plato')}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left font-semibold active:bg-line disabled:opacity-50"
            >
              <Icono nombre="nutricion" className="text-muted" /> Guardar como plato
              {registros.length === 0 && <span className="ml-auto text-sm font-normal text-muted">Aún está vacía</span>}
            </button>
          </>
        )}
        {modo === 'plato' && (
          <>
            <p className="text-sm text-muted">{registros.map((r) => `${r.nombre} (${fmtEntero(r.gramos)} g)`).join(', ')}</p>
            <Campo etiqueta="Nombre del plato">
              <input className={claseInput} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Pollo con arroz" autoFocus />
            </Campo>
            <Boton
              variante="primario"
              grande
              className="w-full"
              disabled={!nombre.trim()}
              onClick={async () => {
                await guardarPlato(nombre, registros)
                avisar(`Plato «${nombre.trim()}» guardado: lo tienes en Mis platos`)
                cerrar()
              }}
            >
              Guardar plato
            </Boton>
          </>
        )}
        {modo === 'copiar' && (
          <>
            <Campo etiqueta="Día">
              <input type="date" max={fecha} className={claseInput} value={deFecha} onChange={(e) => e.target.value && setDeFecha(e.target.value)} />
            </Campo>
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted">Comida</p>
              <Segmentado<Comida>
                etiqueta="Comida de origen"
                valor={deComida}
                onCambio={setDeComida}
                opciones={(['desayuno', 'comida', 'merienda', 'cena'] as const).map((c) => ({ valor: c, texto: NOMBRE_COMIDA[c] }))}
              />
            </div>
            <Boton
              variante="primario"
              grande
              className="w-full"
              onClick={async () => {
                const n = await repetirComida(deFecha, deComida, fecha, comida)
                avisar(n ? `Copiados ${n} ${n === 1 ? 'alimento' : 'alimentos'}` : 'Esa comida estaba vacía')
                if (n) cerrar()
              }}
            >
              Copiar a {NOMBRE_COMIDA[comida].toLowerCase()}
            </Boton>
          </>
        )}
      </div>
    </Hoja>
  )
}
