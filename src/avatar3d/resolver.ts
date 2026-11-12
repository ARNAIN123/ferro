// Del perfil corporal a la forma del avatar. MakeHuman describe un cuerpo con «músculo» y «peso»;
// aquí se buscan los valores que dan el peso real (con el volumen de la malla y la densidad del
// cuerpo) con la composición de una persona musculada (ronda 5: ni gorda ni flaca, sea cual sea su
// porcentaje de grasa), y después se ajustan las medidas de cinta que se hayan tomado.
import type { Sexo } from '../domain/nutricion'
import { AJUSTE_NEUTRO, definicionMuscular, densidadCorporal, MEDIDAS, type AjusteFino, type DatosCuerpo, type NombreMedida } from '../domain/cuerpo'
import { construirForma, type FormaAvatar, type NombreObjetivo, type ParametrosForma } from './forma'
import { medirAvatar } from './medidas'
import type { InfoAvatar, ModeloAvatar } from './modelo'

export interface FormaResuelta {
  parametros: ParametrosForma
  forma: FormaAvatar
  /** Fuerza del relieve muscular (más con menos grasa). */
  definicion: number
  /** Porcentaje de grasa al que corresponde la forma (el de un cuerpo musculado, no el mío). */
  grasa: number
  /** Lo que mide el avatar (cm). */
  medidas: Record<NombreMedida, number>
}

/**
 * Porcentaje de grasa al que se parece cada esquina de MakeHuman: [sexo][músculo][peso] (mínimo,
 * medio y máximo). En MakeHuman el «músculo» mínimo es un cuerpo blando y el máximo, uno seco y
 * marcado: con el peso al máximo dan, respectivamente, un cuerpo obeso y uno de culturista.
 */
export const GRASA_ESQUINA: readonly (readonly (readonly number[])[])[] = [
  [
    [10, 33, 48],
    [17, 23, 29],
    [12, 16, 22],
  ],
  [
    [5, 27, 42],
    [9, 15, 21],
    [5, 8, 16],
  ],
]

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const mezcla = (a: number, b: number, t: number) => a + (b - a) * t

/** Interpola una tabla cuadrada (músculo × peso, de 0 a 1). */
function enTabla(tabla: readonly (readonly number[])[], musculo: number, peso: number): number {
  const n = tabla.length - 1
  const x = limitar(musculo, 0, 1) * n
  const y = limitar(peso, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(x))
  const j = Math.min(n - 1, Math.floor(y))
  const a = x - i
  const b = y - j
  return mezcla(mezcla(tabla[i]![j]!, tabla[i]![j + 1]!, b), mezcla(tabla[i + 1]![j]!, tabla[i + 1]![j + 1]!, b), a)
}

/** Edad en años → la de MakeHuman (0 = 25 años o menos, 1 = 90). */
export function edadMakeHuman(info: InfoAvatar, anos: number): number {
  const [joven, mayor] = info.macro.edades
  return limitar((anos - joven) / (mayor - joven), 0, 1)
}

/** Grasa (%) y masa (kg) de la forma de MakeHuman con ese músculo y ese peso, a la altura dada. */
export function cuerpoDeMakeHuman(info: InfoAvatar, sexo: number, edad: number, musculo: number, peso: number, alturaM: number): { grasa: number; kg: number } {
  const en = (t: number[][][][]) => mezcla(enTabla(t[sexo]![0]!, musculo, peso), enTabla(t[sexo]![1]!, musculo, peso), edad)
  const litros = en(info.macro.volumen) * (alturaM / en(info.macro.alto)) ** 3
  const grasa = enTabla(GRASA_ESQUINA[sexo]!, musculo, peso)
  return { grasa, kg: litros * densidadCorporal(grasa) }
}

const PASOS = 40

/** Porcentaje de grasa de un cuerpo musculado, ni gordo ni flaco: [mínimo, máximo]. */
export const FRANJA_ATLETICA: Record<Sexo, readonly [number, number]> = { hombre: [8, 14], mujer: [17, 24] }

/** Lo que cuesta cada punto de grasa fuera de la franja y que falte músculo, frente a un 1 % de peso. */
const PESO_FRANJA = 25
const PESO_MUSCULO = 30

/**
 * Músculo y peso de MakeHuman de una persona musculada con mi peso y mi altura: la grasa dentro de
 * la franja atlética y, entre las formas que dan mi peso, la de más músculo. Si nadie tan musculado
 * pesa tanto (un cuerpo muy pesado), el avatar se queda en el más musculado posible, más ligero que
 * yo, antes que engordarlo; si peso muy poco, sale fibroso. Mi porcentaje de grasa no se usa.
 */
export function resolverMacro(info: InfoAvatar, d: DatosCuerpo): { musculo: number; peso: number; grasa: number; kg: number } {
  const sexo = d.sexo === 'hombre' ? 1 : 0
  const edad = edadMakeHuman(info, d.edad)
  const [minimo, maximo] = FRANJA_ATLETICA[d.sexo]
  let mejor = { musculo: 0.5, peso: 0.5, grasa: 0, kg: 0, error: Infinity }
  for (let i = 0; i <= PASOS; i++) {
    for (let j = 0; j <= PASOS; j++) {
      const c = cuerpoDeMakeHuman(info, sexo, edad, i / PASOS, j / PASOS, d.alturaCm / 100)
      const fuera = c.grasa < minimo ? minimo - c.grasa : c.grasa > maximo ? c.grasa - maximo : 0
      const error = (((c.kg - d.kg) / d.kg) * 100) ** 2 + PESO_FRANJA * fuera ** 2 + PESO_MUSCULO * (1 - i / PASOS) ** 2
      if (error < mejor.error) mejor = { musculo: i / PASOS, peso: j / PASOS, ...c, error }
    }
  }
  return mejor
}

/** Cuánto mueve cada deslizador del ajuste fino su deformador. */
const FUERZA_AJUSTE: Record<keyof AjusteFino, number> = { hombros: 1, piernas: 0.5, brazos: 0.5, cintura: 1 }
const TOPE_OBJETIVO = 2

/**
 * Volumen muscular de más (ronda 5): los deformadores de medidas que dan hombros, pecho, brazos,
 * piernas y cuello (no la cintura ni la cadera), para que el avatar se vea más musculado sin engordar.
 * Unos 2–4 cm más de perímetro en un hombre; en una mujer, el 70 %. Las medidas con cinta mandan.
 */
export const VOLUMEN: Partial<Record<NombreObjetivo, number>> = { hombros: 0.25, pecho: 0.35, brazo: 0.3, antebrazo: 0.4, muslo: 0.25, gemelo: 0.2, cuello: 0.25 }

/** Lo último que se ha resuelto (el ajuste fino en directo y «Antes / Ahora» repiten cálculos). */
const MEMORIA = 12
const recordadas = new WeakMap<ModeloAvatar, { bases: Map<string, Base>; formas: Map<string, FormaResuelta> }>()

function recordar<T>(mapa: Map<string, T>, clave: string, calcular: () => T): T {
  const previa = mapa.get(clave)
  if (previa !== undefined) return previa
  const v = calcular()
  mapa.set(clave, v)
  if (mapa.size > MEMORIA) mapa.delete(mapa.keys().next().value!)
  return v
}

interface Base {
  macro: ReturnType<typeof resolverMacro>
  objetivos: Partial<Record<NombreObjetivo, number>>
}

/** La forma de un cuerpo. Lo lento (peso y medidas de cinta) se recuerda; el ajuste fino es inmediato. */
export function resolverForma(modelo: ModeloAvatar, datos: DatosCuerpo): FormaResuelta {
  let memoria = recordadas.get(modelo)
  if (!memoria) recordadas.set(modelo, (memoria = { bases: new Map(), formas: new Map() }))
  const { bases } = memoria
  // La grasa no da forma al avatar: dos días que solo cambian en ella dan el mismo cuerpo.
  const d: DatosCuerpo = { ...datos, grasaPct: undefined }
  return recordar(memoria.formas, JSON.stringify(d), () => {
    const base = recordar(bases, JSON.stringify({ ...d, ajuste: undefined }), () => resolverBase(modelo, d))
    return conAjuste(modelo, d, base)
  })
}

function resolverBase(modelo: ModeloAvatar, d: DatosCuerpo): Base {
  const { info } = modelo
  const macro = resolverMacro(info, d)
  const sexo = d.sexo === 'hombre' ? 1 : 0
  const base = { sexo, edad: edadMakeHuman(info, d.edad), musculo: macro.musculo, peso: macro.peso, alturaM: d.alturaCm / 100 }
  const k = d.sexo === 'hombre' ? 1 : 0.7
  const objetivos: Partial<Record<NombreObjetivo, number>> = Object.fromEntries(Object.entries(VOLUMEN).map(([o, t]) => [o, t * k]))
  const medir = (o: Partial<Record<NombreObjetivo, number>>) => medirAvatar(modelo, construirForma(modelo, { ...base, objetivos: o }), sexo)

  // Medidas de cinta: cada una mueve su deformador hasta que el avatar mide lo mismo.
  const pedidas = MEDIDAS.filter((m) => (d.medidas?.[m] ?? 0) > 0)
  for (let vuelta = 0; vuelta < 3 && pedidas.length; vuelta++) {
    const ahora = medir(objetivos)
    for (const m of pedidas) {
      const deseada = d.medidas![m]!
      const t0 = objetivos[m] ?? 0
      const t1 = t0 + (deseada > ahora[m] ? 0.25 : -0.25)
      const pendiente = (medir({ ...objetivos, [m]: t1 })[m] - ahora[m]) / (t1 - t0)
      if (Math.abs(pendiente) > 0.01) objetivos[m] = limitar(t0 + (deseada - ahora[m]) / pendiente, -TOPE_OBJETIVO, TOPE_OBJETIVO)
    }
  }
  return { macro, objetivos }
}

function conAjuste(modelo: ModeloAvatar, d: DatosCuerpo, base: Base): FormaResuelta {
  const { macro } = base
  const sexo = d.sexo === 'hombre' ? 1 : 0
  const objetivos = { ...base.objetivos }
  // Ajuste fino: se suma a lo que digan los datos.
  const ajuste = { ...AJUSTE_NEUTRO, ...d.ajuste }
  for (const a of Object.keys(FUERZA_AJUSTE) as (keyof AjusteFino)[]) {
    const t = limitar(ajuste[a], -1, 1) * FUERZA_AJUSTE[a]
    if (t) objetivos[a] = limitar((objetivos[a] ?? 0) + t, -TOPE_OBJETIVO - 1, TOPE_OBJETIVO + 1)
  }

  const parametros: ParametrosForma = { sexo, edad: edadMakeHuman(modelo.info, d.edad), musculo: macro.musculo, peso: macro.peso, alturaM: d.alturaCm / 100, objetivos }
  const forma = construirForma(modelo, parametros)
  return {
    parametros,
    forma,
    definicion: definicionMuscular(d.sexo, macro.grasa, macro.musculo),
    grasa: Math.round(macro.grasa * 10) / 10,
    medidas: medirAvatar(modelo, forma, sexo),
  }
}
