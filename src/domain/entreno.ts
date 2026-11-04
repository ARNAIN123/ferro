// Reglas del modo entreno: prerrellenado, superseries y descanso.
import type { TipoSerie } from './tipos'

export interface SerieBase {
  tipo: TipoSerie
  peso: number
  reps: number
  rir: number | null
  orden: number
}

export interface SerieNueva {
  tipo: TipoSerie
  peso: number
  reps: number
}

/**
 * Series prerrellenadas con lo que hice la última vez: se repiten los calentamientos y,
 * para cada serie efectiva, el peso y las reps de la serie equivalente (o de la última si hice menos).
 */
export function prerrellenarSeries(seriesObjetivo: number, repsMin: number, ultimas: readonly SerieBase[]): SerieNueva[] {
  const ordenadas = [...ultimas].sort((a, b) => a.orden - b.orden)
  const calentamientos = ordenadas.filter((s) => s.tipo === 'calentamiento')
  const efectivas = ordenadas.filter((s) => s.tipo === 'normal')
  const resultado: SerieNueva[] = calentamientos.map((s) => ({ tipo: 'calentamiento', peso: s.peso, reps: s.reps }))
  for (let i = 0; i < seriesObjetivo; i++) {
    const ref = efectivas[i] ?? efectivas[efectivas.length - 1]
    resultado.push({ tipo: 'normal', peso: ref?.peso ?? 0, reps: ref?.reps ?? repsMin })
  }
  return resultado
}

/** Valores para una serie añadida a mano: copia la última de la lista. */
export function serieSiguiente(series: readonly SerieBase[], repsMin: number): SerieNueva {
  const ultima = [...series].sort((a, b) => a.orden - b.orden).at(-1)
  return { tipo: 'normal', peso: ultima?.peso ?? 0, reps: ultima?.reps ?? repsMin }
}

/** Ciclo del tipo de serie al tocar su etiqueta: normal → calentamiento → drop → normal. */
export function siguienteTipo(tipo: TipoSerie): TipoSerie {
  return tipo === 'normal' ? 'calentamiento' : tipo === 'calentamiento' ? 'drop' : 'normal'
}

/** RIR al tocar su etiqueta: sin dato → 0 → 1 → 2 → 3 → 4 → sin dato. */
export function siguienteRir(rir: number | null): number | null {
  if (rir === null) return 0
  return rir >= 4 ? null : rir + 1
}

export function ajustarPeso(peso: number, salto: number, direccion: 1 | -1): number {
  const paso = salto > 0 ? salto : 1
  const nuevo = Math.round((peso + paso * direccion) * 100) / 100
  return Math.max(0, nuevo)
}

interface SerieEditable {
  id: string
  orden: number
  tipo: TipoSerie
  completada: boolean
  peso: number
  reps: number
}

/**
 * Al cambiar el peso o las reps de una serie, las series pendientes posteriores del mismo tipo
 * que tenían el mismo valor lo heredan (subo a 62,5 en la primera → las demás también).
 */
export function propagarCambio(
  series: readonly SerieEditable[],
  id: string,
  campo: 'peso' | 'reps',
  valor: number,
): { id: string; valor: number }[] {
  const base = series.find((s) => s.id === id)
  if (!base) return []
  const anterior = base[campo]
  const cambios = [{ id, valor }]
  if (anterior === valor) return cambios
  for (const s of [...series].sort((a, b) => a.orden - b.orden)) {
    if (s.orden > base.orden && !s.completada && s.tipo === base.tipo && s[campo] === anterior) cambios.push({ id: s.id, valor })
  }
  return cambios
}

export interface EjercicioEnCurso {
  superserieConSiguiente: boolean
  saltado: boolean
}

/** Índices del grupo de superserie al que pertenece el ejercicio `i`. */
export function grupoSuperserie(lista: readonly EjercicioEnCurso[], i: number): number[] {
  let inicio = i
  while (inicio > 0 && lista[inicio - 1]?.superserieConSiguiente) inicio--
  let fin = i
  while (fin < lista.length - 1 && lista[fin]?.superserieConSiguiente) fin++
  const grupo: number[] = []
  for (let k = inicio; k <= fin; k++) grupo.push(k)
  return grupo
}

/**
 * A qué ejercicio saltar tras completar una serie del ejercicio `i`.
 * En superserie se alterna al siguiente del grupo que tenga series pendientes; si no, se queda.
 */
export function destinoTrasSerie(
  lista: readonly EjercicioEnCurso[],
  i: number,
  tienePendientes: (indice: number) => boolean,
): number {
  const grupo = grupoSuperserie(lista, i).filter((k) => !lista[k]?.saltado)
  if (grupo.length <= 1) return i
  const pos = grupo.indexOf(i)
  for (let paso = 1; paso <= grupo.length; paso++) {
    const k = grupo[(pos + paso) % grupo.length]!
    if (tienePendientes(k)) return k
  }
  return i
}

/**
 * Segundos de descanso tras una serie del ejercicio `i`: en superserie solo se descansa
 * al acabar la vuelta (tras el último ejercicio del grupo).
 */
export function descansoTrasSerie(
  lista: readonly (EjercicioEnCurso & { descansoSeg: number })[],
  i: number,
  destino: number,
): number {
  const grupo = grupoSuperserie(lista, i)
  if (grupo.length > 1 && destino > i) return 0
  const ultimo = lista[grupo[grupo.length - 1]!]
  return ultimo?.descansoSeg ?? lista[i]?.descansoSeg ?? 0
}

/**
 * Matices del descanso según el tipo de serie: antes de un drop set no se descansa
 * y tras un calentamiento basta con un minuto como mucho.
 */
export function descansoPorTipo(base: number, tipo: TipoSerie, siguientePendiente: TipoSerie | null): number {
  if (base <= 0 || siguientePendiente === 'drop') return 0
  if (tipo === 'calentamiento') return Math.min(base, 60)
  return base
}

/** Milisegundos que quedan de descanso. Se calcula desde la hora de fin, no acumulando ticks. */
export function restanteMs(fin: number | null, ahora: number): number {
  return fin === null ? 0 : Math.max(0, fin - ahora)
}

/** Si no se detecta la salida, la sesión se da por terminada unos minutos después de la última serie. */
export const MARGEN_SALIDA_TRAS_SERIE_MS = 5 * 60_000

/** La sesión se cierra sola tras `horas` sin actividad, con la hora de la última serie más 5 min como salida. */
export function cierreAutomatico(
  sesion: { estado: 'en_curso' | 'terminada'; entrada: number; ultimaActividad: number },
  ultimaSerie: number | null,
  ahora: number,
  horas = 3,
): number | null {
  if (sesion.estado !== 'en_curso') return null
  const ultima = Math.max(sesion.ultimaActividad, ultimaSerie ?? 0, sesion.entrada)
  if (ahora - ultima < horas * 3600_000) return null
  return ultimaSerie !== null ? ultimaSerie + MARGEN_SALIDA_TRAS_SERIE_MS : ultima
}
