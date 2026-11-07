import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Boton, Campo, claseInput, Segmentado, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { guardarPerfil } from '../../db/nutricion'
import { guardarPeso } from '../../db/peso'
import {
  gastoEstimado,
  macrosDelDia,
  metabolismoBasal,
  objetivoCalorico,
  PROTEINA_POR_DEFECTO,
  RITMO_PORCENTAJE,
  type ObjetivoNutricion,
  type Ritmo,
  type Sexo,
} from '../../domain/nutricion'
import { claveDia } from '../../domain/semanas'
import { guardarAjustes, useAjustes } from '../../hooks/useAjustes'
import { actividadReciente, type ActividadReciente } from '../../lib/actividad'
import { fmtEntero, fmtKg, parseNumero } from '../../lib/formato'
import { Paso } from '../ajustes/Paso'

const OBJETIVOS: { valor: ObjetivoNutricion; texto: string; detalle: string }[] = [
  { valor: 'perder', texto: 'Perder grasa', detalle: 'manteniendo el músculo' },
  { valor: 'mantener', texto: 'Mantener', detalle: 'mi peso actual' },
  { valor: 'ganar', texto: 'Ganar músculo', detalle: 'con un superávit pequeño' },
]
const RITMOS: { valor: Ritmo; texto: string }[] = [
  { valor: 'suave', texto: 'Suave' },
  { valor: 'moderado', texto: 'Moderado' },
  { valor: 'rapido', texto: 'Rápido' },
]

/** Asistente de 1 minuto: con mis datos calcula el gasto, el objetivo y los macros. */
export function Asistente({ alTerminar }: { alTerminar?: () => void }) {
  const ajustes = useAjustes()
  const ultimoPeso = useLiveQuery(() => db.pesosCorporales.orderBy('fecha').last(), [])
  const previo = useLiveQuery(async () => (await db.nutricion.get('perfil')) ?? null, [])
  const [sexo, setSexo] = useState<Sexo>('hombre')
  const [edad, setEdad] = useState('')
  const [altura, setAltura] = useState('')
  const [peso, setPeso] = useState('')
  const [objetivo, setObjetivo] = useState<ObjetivoNutricion>('perder')
  const [ritmo, setRitmo] = useState<Ritmo>('moderado')
  const [proteina, setProteina] = useState(PROTEINA_POR_DEFECTO)
  const [actividad, setActividad] = useState<ActividadReciente | null>(null)
  const [cargado, setCargado] = useState(false)

  // Rellena con lo que ya sabe la app (y, si rehago el cálculo, con mis elecciones anteriores).
  useEffect(() => {
    if (cargado || ultimoPeso === undefined || previo === undefined) return
    setEdad(ajustes.edad ? String(ajustes.edad) : '')
    setAltura(ajustes.alturaCm ? String(ajustes.alturaCm) : '')
    setPeso(ultimoPeso ? fmtKg(ultimoPeso.kg) : '')
    if (previo) {
      setSexo(previo.sexo)
      setObjetivo(previo.objetivo)
      setRitmo(previo.ritmo)
      setProteina(previo.proteinaGkg)
    }
    setCargado(true)
  }, [ajustes, ultimoPeso, previo, cargado])

  const kg = parseNumero(peso)
  const cm = parseNumero(altura)
  const anos = parseNumero(edad)
  const valido = kg !== null && kg >= 30 && kg <= 250 && cm !== null && cm >= 120 && cm <= 230 && anos !== null && anos >= 14 && anos <= 100

  useEffect(() => {
    if (!valido) return
    let vivo = true
    void actividadReciente(kg!, cm!).then((a) => vivo && setActividad(a))
    return () => {
      vivo = false
    }
  }, [valido, kg, cm])

  const basal = valido ? metabolismoBasal({ sexo, kg: kg!, alturaCm: cm!, edad: anos! }) : null
  const gasto = basal !== null && actividad ? gastoEstimado(basal, actividad.kcal) : null
  const obj = basal !== null && gasto !== null ? objetivoCalorico({ gasto, basal, objetivo, ritmo, kg: kg! }) : null
  const macros = obj ? macrosDelDia({ kcalDia: obj.kcal, kcalMedia: obj.kcal, kg: kg!, proteinaGkg: proteina }) : null

  const empezar = async () => {
    if (!valido || basal === null || gasto === null || !obj) return
    await guardarAjustes({ edad: Math.round(anos!), alturaCm: Math.round(cm!) })
    if (!ultimoPeso || Math.abs(ultimoPeso.kg - kg!) >= 0.05) await guardarPeso(claveDia(Date.now()), Math.round(kg! * 10) / 10)
    await guardarPerfil({
      id: 'perfil',
      sexo,
      objetivo,
      ritmo,
      proteinaGkg: proteina,
      inicio: claveDia(Date.now()),
      basal,
      gastoInicial: gasto,
      objetivoKcal: obj.kcal,
      // Rehacer el cálculo no borra nada: conserva el historial de revisiones y los retos.
      ajustes: previo?.ajustes ?? [],
      retoActivo: previo?.retoActivo ?? true,
      retos: previo?.retos ?? [],
      ...(previo?.entrenoManual ? { entrenoManual: previo.entrenoManual } : {}),
      ...(previo?.revisionVista ? { revisionVista: previo.revisionVista } : {}),
    })
    alTerminar?.()
  }

  return (
    <div className="space-y-3">
      <Tarjeta>
        <h2 className="font-bold">Tus datos</h2>
        <div className="mt-3">
          <Segmentado<Sexo>
            etiqueta="Sexo"
            valor={sexo}
            onCambio={setSexo}
            opciones={[
              { valor: 'hombre', texto: 'Hombre' },
              { valor: 'mujer', texto: 'Mujer' },
            ]}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Campo etiqueta="Edad">
            <input inputMode="numeric" className={`${claseInput} num`} value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="—" />
          </Campo>
          <Campo etiqueta="Altura (cm)">
            <input inputMode="numeric" className={`${claseInput} num`} value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="—" />
          </Campo>
          <Campo etiqueta="Peso (kg)">
            <input inputMode="decimal" className={`${claseInput} num`} value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="—" />
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-bold">Objetivo</h2>
        <div className="mt-3 grid gap-2">
          {OBJETIVOS.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setObjetivo(o.valor)}
              aria-pressed={objetivo === o.valor}
              className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left ${
                objetivo === o.valor ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'
              }`}
            >
              <span>
                <span className="block font-semibold">{o.texto}</span>
                <span className="text-sm text-muted">{o.detalle}</span>
              </span>
            </button>
          ))}
        </div>
        {objetivo !== 'mantener' && (
          <div className="mt-3">
            <p className="mb-1.5 text-sm font-medium text-muted">Ritmo</p>
            <Segmentado<Ritmo> etiqueta="Ritmo" valor={ritmo} onCambio={setRitmo} opciones={RITMOS} />
            {kg !== null && (
              <p className="mt-1.5 text-sm text-muted">
                {fmtKg(Math.round(kg * RITMO_PORCENTAJE[ritmo] * 10) / 1000)} kg por semana ({String(RITMO_PORCENTAJE[ritmo]).replace('.', ',')} % de tu peso)
              </p>
            )}
          </div>
        )}
        <div className="mt-2">
          <Paso
            etiqueta="Proteína (g por kg)"
            valor={proteina}
            unidad=""
            min={1.6}
            max={2.2}
            paso={0.1}
            formato={(v) => fmtKg(Math.round(v * 10) / 10)}
            onCambio={(v) => setProteina(Math.round(v * 10) / 10)}
          />
        </div>
      </Tarjeta>

      {obj && macros && basal !== null && gasto !== null && actividad && (
        <Tarjeta className="border-accent">
          <p className="text-sm text-muted">Tu objetivo para empezar</p>
          <p className="num mt-1 text-4xl font-bold">
            {fmtEntero(obj.kcal)} <span className="text-lg font-medium text-muted">kcal al día</span>
          </p>
          <p className="mt-2 text-sm">
            <span className="font-semibold text-accent">{macros.proteina} g de proteína</span> · {macros.carbohidratos} g de hidratos · {macros.grasa} g de grasa
          </p>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-muted">
            <div className="flex justify-between">
              <dt>Metabolismo basal (Mifflin-St Jeor)</dt>
              <dd className="num">{fmtEntero(basal)} kcal</dd>
            </div>
            <div className="flex justify-between">
              <dt>
                Actividad ({actividad.pasosReales ? `${fmtEntero(actividad.pasosMedios)} pasos de media` : `${fmtEntero(actividad.pasosMedios)} pasos supuestos`} y entrenos)
              </dt>
              <dd className="num">{fmtEntero(actividad.kcal)} kcal</dd>
            </div>
            <div className="flex justify-between">
              <dt>Gasto diario estimado (con la digestión)</dt>
              <dd className="num">{fmtEntero(gasto)} kcal</dd>
            </div>
          </dl>
          {obj.limitadoPorBasal && (
            <p className="mt-2 text-sm">Para no bajar de tu metabolismo basal, el objetivo se queda en el basal: irás algo más despacio.</p>
          )}
          <p className="mt-2 text-xs text-muted">
            Las dos primeras semanas se usa esta estimación. Después, cada lunes se recalcula con lo que comes y cómo cambia tu peso.
          </p>
          <Boton variante="primario" grande className="mt-4 w-full" onClick={empezar}>
            {previo ? 'Guardar el nuevo objetivo' : 'Empezar'}
          </Boton>
        </Tarjeta>
      )}
      {!valido && cargado && <p className="px-1 text-sm text-muted">Completa edad, altura y peso para calcular tu objetivo.</p>}
    </div>
  )
}
