import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Regla } from '../../components/Regla'
import { Boton, Campo, claseInput } from '../../components/ui'
import { db } from '../../db/db'
import { alimentosGenericos, anadirPlato, guardarAlimento, registrarAlimento, repetirComida, type AlimentoCualquiera } from '../../db/nutricion'
import { buscar, recientesPara, valoresDe } from '../../domain/registroComidas'
import { claveDia, sumarDias } from '../../domain/semanas'
import { NOMBRE_COMIDA, type AlimentoGenerico, type Comida } from '../../domain/tiposNutricion'
import { avisar } from '../../lib/avisos'
import { escanearCodigo, hayEscaner } from '../../lib/escaner'
import { fmtEntero, fmtKg, parseNumero } from '../../lib/formato'
import { buscarProductos, productoPorCodigo } from '../../lib/openFoodFacts'
import { HojaIA } from './HojaIA'

interface Props {
  abierta: boolean
  onCerrar: () => void
  fecha: string
  comida: Comida
  /** Hay clave de Anthropic: se puede describir la comida en texto. */
  conIA: boolean
}

const ESTADO: Record<string, string> = { crudo: 'Peso en crudo', cocinado: 'Peso cocinado' }

/** Añadir comida en pocos toques: recientes, platos guardados, repetir, buscador y escáner. */
export function HojaAnadir({ abierta, onCerrar, fecha, comida, conIA }: Props) {
  const [texto, setTexto] = useState('')
  const [elegido, setElegido] = useState<AlimentoCualquiera | null>(null)
  const [gramos, setGramos] = useState(100)
  const [racion, setRacion] = useState<string | null>(null)
  const [off, setOff] = useState<{ cargando: boolean; resultados: AlimentoCualquiera[]; error: string | null; buscado: string }>({ cargando: false, resultados: [], error: null, buscado: '' })
  const [creando, setCreando] = useState<{ codigo?: string } | null>(null)
  const [ia, setIa] = useState(false)
  const [genericos, setGenericos] = useState<AlimentoGenerico[]>([])
  const peticion = useRef<AbortController | null>(null)

  useEffect(() => {
    void alimentosGenericos().then(setGenericos)
  }, [])
  useEffect(() => {
    if (!abierta) return
    setTexto('')
    setElegido(null)
    setCreando(null)
    setOff({ cargando: false, resultados: [], error: null, buscado: '' })
  }, [abierta])

  const datos = useLiveQuery(async () => {
    const desde = claveDia(sumarDias(Date.now(), -45))
    const [registros, mios, platos, perfil] = await Promise.all([db.comidas.where('fecha').aboveOrEqual(desde).toArray(), db.alimentos.toArray(), db.platos.toArray(), db.nutricion.get('perfil')])
    const ayer = claveDia(sumarDias(new Date(`${fecha}T12:00`).getTime(), -1))
    const deAyer = await db.comidas.where('[fecha+comida]').equals([ayer, comida]).count()
    // Frutas y verduras del reto que marqué como "me gusta": quedan a mano con mis recientes.
    const gustan = (perfil?.retos ?? []).filter((r) => r.estado === 'gusta').map((r) => r.alimentoId)
    return { registros, mios, platos: platos.sort((a, b) => b.usos - a.usos), ayer, deAyer, gustan }
  }, [fecha, comida])

  const recientes = useMemo(() => {
    if (!datos) return []
    const lista = recientesPara(datos.registros, comida, Date.now(), 12, datos.gustan)
    const extra = datos.gustan
      .filter((id) => !lista.some((r) => r.alimentoId === id))
      .map((id) => genericos.find((g) => g.id === id))
      .filter((g): g is AlimentoGenerico => g !== undefined)
      .map((g) => ({ alimentoId: g.id, nombre: g.nombre, gramos: g.raciones[0]?.gramos ?? 100, racion: g.raciones[0]?.nombre ?? null, puntos: 0 }))
    return [...lista, ...extra]
  }, [datos, comida, genericos])
  const todos = useMemo(() => [...(datos?.mios ?? []), ...genericos], [datos, genericos])
  const resultados = useMemo(() => (texto.trim() ? buscar(todos, texto) : []), [todos, texto])

  const elegir = (a: AlimentoCualquiera, g?: number, r?: string | null) => {
    setElegido(a)
    const primera = a.raciones[0]
    setGramos(g ?? primera?.gramos ?? 100)
    setRacion(r !== undefined ? r : g === undefined && primera ? primera.nombre : null)
  }

  const anadir = async (a: AlimentoCualquiera, g: number, r: string | null) => {
    await registrarAlimento({ fecha, comida, alimento: a, gramos: g, racion: r })
    avisar(`${a.nombre} añadido a ${NOMBRE_COMIDA[comida].toLowerCase()}`)
    onCerrar()
  }

  const buscarId = async (id: string) => todos.find((a) => a.id === id) ?? (await db.alimentos.get(id))

  const escanear = async () => {
    try {
      const codigo = await escanearCodigo()
      if (!codigo) return
      const guardado = await db.alimentos.where('codigo').equals(codigo).first()
      if (guardado) return elegir(guardado)
      avisar('Buscando el producto…')
      const p = await productoPorCodigo(codigo)
      if (!p) {
        avisar('Ese producto no está en Open Food Facts: créalo con sus datos.')
        return setCreando({ codigo })
      }
      elegir(await guardarAlimento(p))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo leer el código')
    }
  }

  const buscarEnOff = async () => {
    const q = texto.trim()
    if (!q) return
    peticion.current?.abort()
    const c = new AbortController()
    peticion.current = c
    setOff({ cargando: true, resultados: [], error: null, buscado: q })
    try {
      setOff({ cargando: false, resultados: await buscarProductos(q, c.signal), error: null, buscado: q })
    } catch (e) {
      if (!c.signal.aborted) setOff({ cargando: false, resultados: [], error: e instanceof Error ? e.message : 'Sin conexión', buscado: q })
    }
  }

  const titulo = elegido ? elegido.nombre : creando ? 'Crear alimento' : `Añadir a ${NOMBRE_COMIDA[comida].toLowerCase()}`

  return (
    <>
      <Hoja abierta={abierta && !ia} onCerrar={onCerrar} titulo={titulo}>
        {elegido ? (
          <Cantidad
            alimento={elegido}
            gramos={gramos}
            racion={racion}
            onGramos={(g, r) => {
              setGramos(g)
              setRacion(r)
            }}
            onVolver={() => setElegido(null)}
            onAnadir={() => anadir(elegido, gramos, racion)}
            comida={comida}
          />
        ) : creando ? (
          <CrearAlimento
            codigo={creando.codigo}
            onCreado={(a) => {
              setCreando(null)
              elegir(a)
            }}
            onVolver={() => setCreando(null)}
          />
        ) : (
          <div className="pb-2">
            <div className="flex gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Buscar alimento</span>
                <Icono nombre="buscar" tamano={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Buscar alimento"
                  enterKeyHint="search"
                  className={`${claseInput} pl-10`}
                />
              </label>
              {hayEscaner() && (
                <button type="button" onClick={escanear} aria-label="Escanear código de barras" className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 active:bg-line">
                  <Icono nombre="codigo" />
                </button>
              )}
              {conIA && (
                <button type="button" onClick={() => setIa(true)} aria-label="Describir lo que he comido" className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent active:bg-line">
                  <Icono nombre="chispa" />
                </button>
              )}
            </div>

            {texto.trim() ? (
              <>
                <ListaAlimentos titulo="Resultados" alimentos={resultados} onElegir={(a) => elegir(a)} vacio="Nada en tus alimentos ni en la base genérica." />
                <Boton className="mt-3 w-full" onClick={buscarEnOff} disabled={off.cargando}>
                  {off.cargando ? 'Buscando…' : `Buscar «${texto.trim()}» en Open Food Facts`}
                </Boton>
                {off.error && <p className="mt-2 text-sm text-muted">No se pudo buscar ({off.error}). Revisa la conexión.</p>}
                {off.buscado === texto.trim() && !off.cargando && !off.error && (
                  <ListaAlimentos
                    titulo="Open Food Facts"
                    alimentos={off.resultados}
                    onElegir={async (a) => elegir(await guardarAlimento({ ...a, creado: Date.now() } as Parameters<typeof guardarAlimento>[0]))}
                    vacio="Sin resultados en Open Food Facts."
                  />
                )}
              </>
            ) : (
              <>
                {datos && datos.deAyer > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const n = await repetirComida(datos.ayer, comida, fecha, comida)
                      avisar(`Repetido: ${n} ${n === 1 ? 'alimento' : 'alimentos'} de ayer`)
                      onCerrar()
                    }}
                    className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-2xl bg-surface-2 px-4 text-left font-semibold active:bg-line"
                  >
                    <Icono nombre="copiar" tamano={18} className="text-muted" /> Repetir {NOMBRE_COMIDA[comida].toLowerCase()} de ayer
                    <span className="ml-auto text-sm font-normal text-muted">{datos.deAyer}</span>
                  </button>
                )}
                {recientes.length > 0 && (
                  <section className="mt-3">
                    <h3 className="mb-1.5 text-sm font-semibold tracking-wide text-muted uppercase">Recientes</h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                      {recientes.map((r) => (
                        <li key={r.alimentoId} className="flex items-center">
                          <button
                            type="button"
                            onClick={async () => {
                              const a = await buscarId(r.alimentoId)
                              if (a) elegir(a, r.gramos, r.racion)
                            }}
                            className="flex min-h-14 flex-1 flex-col justify-center px-4 text-left active:bg-surface-2"
                          >
                            <span className="font-semibold">{r.nombre}</span>
                            <span className="text-sm text-muted">{r.racion ?? `${fmtEntero(r.gramos)} g`}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Añadir ${r.nombre} igual que la última vez`}
                            onClick={async () => {
                              const a = await buscarId(r.alimentoId)
                              if (a) await anadir(a, r.gramos, r.racion)
                            }}
                            className="grid size-14 place-items-center text-accent active:bg-surface-2"
                          >
                            <Icono nombre="mas" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {datos && datos.platos.length > 0 && (
                  <section className="mt-3">
                    <h3 className="mb-1.5 text-sm font-semibold tracking-wide text-muted uppercase">Mis platos</h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                      {datos.platos.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={async () => {
                              await anadirPlato(p, fecha, comida)
                              avisar(`${p.nombre} añadido`)
                              onCerrar()
                            }}
                            className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-2"
                          >
                            <span className="flex-1">
                              <span className="block font-semibold">{p.nombre}</span>
                              <span className="text-sm text-muted">{p.items.map((i) => i.nombre).join(', ')}</span>
                            </span>
                            <Icono nombre="mas" className="text-accent" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {recientes.length === 0 && (!datos || datos.platos.length === 0) && (
                  <p className="mt-4 text-sm text-muted">Busca un alimento{hayEscaner() ? ' o escanea su código de barras' : ''}. Lo que añadas aparecerá aquí la próxima vez.</p>
                )}
                <button type="button" onClick={() => setCreando({})} className="mt-3 flex min-h-12 w-full items-center justify-center text-sm font-semibold text-accent">
                  Crear un alimento con sus valores
                </button>
              </>
            )}
          </div>
        )}
      </Hoja>
      {conIA && <HojaIA abierta={abierta && ia} onCerrar={() => setIa(false)} onTerminado={onCerrar} fecha={fecha} comida={comida} alimentos={todos} />}
    </>
  )
}

function ListaAlimentos({ titulo, alimentos, onElegir, vacio }: { titulo: string; alimentos: AlimentoCualquiera[]; onElegir: (a: AlimentoCualquiera) => void; vacio: string }) {
  return (
    <section className="mt-3">
      <h3 className="mb-1.5 text-sm font-semibold tracking-wide text-muted uppercase">{titulo}</h3>
      {alimentos.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {alimentos.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onElegir(a)} className="flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left active:bg-surface-2">
                <span className="font-semibold">{a.nombre}</span>
                <span className="text-sm text-muted">
                  {'marca' in a && a.marca ? `${a.marca} · ` : ''}
                  {a.por100.kcal} kcal · {fmtKg(a.por100.proteina)} g prot. por 100 g{a.estado ? ` · ${a.estado}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Cantidad({
  alimento,
  gramos,
  racion,
  onGramos,
  onVolver,
  onAnadir,
  comida,
}: {
  alimento: AlimentoCualquiera
  gramos: number
  racion: string | null
  onGramos: (g: number, racion: string | null) => void
  onVolver: () => void
  onAnadir: () => void
  comida: Comida
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const v = valoresDe(alimento.por100, gramos)
  return (
    <div className="pb-2">
      {alimento.estado && (
        <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">{ESTADO[alimento.estado]}</p>
      )}
      {alimento.raciones.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {alimento.raciones.map((r) => (
            <button
              key={r.nombre}
              type="button"
              onClick={() => onGramos(r.gramos, r.nombre)}
              aria-pressed={racion === r.nombre}
              className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${racion === r.nombre ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'}`}
            >
              {r.nombre} <span className="text-muted">({r.gramos} g)</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-baseline justify-center gap-1">
        <input
          aria-label="Cantidad en gramos. Toca para escribirla"
          inputMode="numeric"
          enterKeyHint="done"
          value={texto ?? String(gramos)}
          onFocus={(e) => {
            setTexto(String(gramos))
            e.currentTarget.select()
          }}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            const n = texto === null ? null : parseNumero(texto)
            if (n !== null && n > 0) onGramos(Math.min(2000, Math.round(n)), null)
            setTexto(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="num w-[4.6ch] bg-transparent text-center text-5xl font-bold outline-none focus:text-accent"
        />
        <span className="text-lg font-semibold text-muted">g</span>
      </div>
      <div className="mt-2">
        <Regla
          valor={gramos}
          onCambio={(g) => onGramos(g, null)}
          min={5}
          max={1500}
          paso={5}
          marcaGrande={50}
          pasoPx={10}
          etiqueta="Cantidad en gramos"
          formatoMarca={(g) => String(Math.round(g))}
        />
      </div>
      <p className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-3 text-center text-sm">
        <span>
          <span className="num block text-lg font-bold">{v.kcal}</span>kcal
        </span>
        <span className="text-accent">
          <span className="num block text-lg font-bold">{fmtKg(v.proteina)}</span>proteína
        </span>
        <span>
          <span className="num block text-lg font-bold">{fmtKg(v.carbohidratos)}</span>hidratos
        </span>
        <span>
          <span className="num block text-lg font-bold">{fmtKg(v.grasa)}</span>grasa
        </span>
      </p>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <Boton onClick={onVolver} aria-label="Volver a la lista">
          <Icono nombre="atras" />
        </Boton>
        <Boton variante="primario" grande onClick={onAnadir}>
          Añadir a {NOMBRE_COMIDA[comida].toLowerCase()}
        </Boton>
      </div>
    </div>
  )
}

function CrearAlimento({ codigo, onCreado, onVolver }: { codigo?: string; onCreado: (a: AlimentoCualquiera) => void; onVolver: () => void }) {
  const [nombre, setNombre] = useState('')
  const [valores, setValores] = useState({ kcal: '', proteina: '', carbohidratos: '', grasa: '' })
  const n = (s: string) => parseNumero(s)
  const valido = nombre.trim() && Object.values(valores).every((v) => n(v) !== null && (n(v) as number) >= 0)
  const campo = (k: keyof typeof valores, etiqueta: string) => (
    <Campo etiqueta={etiqueta}>
      <input inputMode="decimal" className={`${claseInput} num`} value={valores[k]} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} placeholder="0" />
    </Campo>
  )
  return (
    <div className="space-y-3 pb-2">
      <Campo etiqueta="Nombre">
        <input className={claseInput} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Yogur de proteínas" />
      </Campo>
      <p className="text-sm text-muted">Valores por 100 g (vienen en la etiqueta).{codigo ? ` Código ${codigo}.` : ''}</p>
      <div className="grid grid-cols-2 gap-2">
        {campo('kcal', 'Calorías (kcal)')}
        {campo('proteina', 'Proteína (g)')}
        {campo('carbohidratos', 'Hidratos (g)')}
        {campo('grasa', 'Grasa (g)')}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Boton onClick={onVolver} aria-label="Volver">
          <Icono nombre="atras" />
        </Boton>
        <Boton
          variante="primario"
          grande
          disabled={!valido}
          onClick={async () => {
            const a = await guardarAlimento({
              id: codigo ? `off-${codigo}` : `propio-${Date.now()}`,
              nombre: nombre.trim(),
              codigo,
              origen: 'propio',
              estado: null,
              por100: { kcal: n(valores.kcal)!, proteina: n(valores.proteina)!, carbohidratos: n(valores.carbohidratos)!, grasa: n(valores.grasa)! },
              raciones: [],
            })
            onCreado(a)
          }}
        >
          Guardar alimento
        </Boton>
      </div>
    </div>
  )
}
