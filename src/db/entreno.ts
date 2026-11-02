// Operaciones del modo entreno. Cada cambio se escribe al momento en IndexedDB,
// así que cerrar la app o reiniciar el móvil nunca pierde el entreno en curso.
import {
  cierreAutomatico,
  descansoPorTipo,
  descansoTrasSerie,
  destinoTrasSerie,
  prerrellenarSeries,
  propagarCambio,
  serieSiguiente,
} from '../domain/entreno'
import { rutinaQueToca } from '../domain/ciclo'
import { vincularEntrada } from '../domain/checkin'
import type { OrigenEntrada, Serie, Sesion, SesionEjercicio } from '../domain/tipos'
import { leerAjustes } from '../hooks/useAjustes'
import { nuevoId } from '../lib/id'
import { db } from './db'

const TABLAS_SESION = [db.sesiones, db.sesionEjercicios, db.series, db.molestias, db.entradas]

export const sesionEnCurso = () => db.sesiones.where('estado').equals('en_curso').first()

/** Series completadas de la última sesión (terminada) en la que hice este ejercicio. */
export async function ultimasSeriesDe(ejercicioId: string, excluirSesionId?: string): Promise<Serie[]> {
  const series = await db.series
    .where('ejercicioId')
    .equals(ejercicioId)
    .filter((s) => s.completada && s.sesionId !== excluirSesionId)
    .toArray()
  if (series.length === 0) return []
  const masReciente = series.reduce((a, b) => ((b.hora ?? 0) > (a.hora ?? 0) ? b : a))
  return series.filter((s) => s.sesionId === masReciente.sesionId).sort((a, b) => a.orden - b.orden)
}

async function crearSeriesPrerrellenadas(se: SesionEjercicio, cuantas = se.seriesObjetivo, desdeOrden = 0): Promise<void> {
  const ultimas = await ultimasSeriesDe(se.ejercicioId, se.sesionId)
  const nuevas = prerrellenarSeries(cuantas, se.repsMin, ultimas)
  await db.series.bulkAdd(
    nuevas.map((n, i) => ({
      id: nuevoId(),
      sesionId: se.sesionId,
      sesionEjercicioId: se.id,
      ejercicioId: se.ejercicioId,
      orden: desdeOrden + i,
      tipo: n.tipo,
      peso: n.peso,
      reps: n.reps,
      rir: null,
      completada: false,
      hora: null,
    })),
  )
}

/**
 * Empieza un entreno con la rutina indicada (o libre si es null). Si ya hay uno en curso lo devuelve.
 * Se vincula a la entrada al gimnasio reciente; si no la hay, registra una manual ahora.
 */
export async function iniciarSesion(rutinaId: string | null, origen: OrigenEntrada = 'manual'): Promise<string> {
  const ajustes = await leerAjustes()
  return db.transaction('rw', [...TABLAS_SESION, db.rutinas, db.rutinaEjercicios], async () => {
    const enCurso = await sesionEnCurso()
    if (enCurso) return enCurso.id

    const ahora = Date.now()
    const sesionId = nuevoId()
    const recientes = await db.entradas
      .where('hora')
      .above(ahora - ajustes.horasEntreCheckins * 3600_000)
      .toArray()
    const vinculo = vincularEntrada(recientes, ahora, ajustes.horasEntreCheckins)
    let entrada = vinculo.entrada
    if (vinculo.crear) {
      entrada = { id: nuevoId(), hora: ahora, origen }
      await db.entradas.add(entrada)
    }
    if (vinculo.vincular && entrada) await db.entradas.update(entrada.id, { sesionId })
    const llegada = vinculo.vincular && entrada ? entrada.hora : ahora
    const origenEntrada = entrada?.origen ?? origen

    const rutina = rutinaId ? await db.rutinas.get(rutinaId) : undefined
    const plan = rutina ? await db.rutinaEjercicios.where('rutinaId').equals(rutina.id).sortBy('orden') : []
    const ejercicios: SesionEjercicio[] = plan.map((re, orden) => ({
      id: nuevoId(),
      sesionId,
      ejercicioId: re.ejercicioId,
      orden,
      seriesObjetivo: re.series,
      repsMin: re.repsMin,
      repsMax: re.repsMax,
      descansoSeg: re.descansoSeg,
      nota: re.nota,
      superserieConSiguiente: re.superserieConSiguiente,
      estado: 'activo',
      anadido: false,
    }))

    await db.sesiones.add({
      id: sesionId,
      rutinaId: rutina?.id ?? null,
      rutinaNombre: rutina?.nombre ?? 'Entreno libre',
      entrada: llegada,
      salida: null,
      origenEntrada,
      estado: 'en_curso',
      ultimaActividad: ahora,
      descansoFin: null,
      descansoDuracion: null,
      ejercicioActivoId: ejercicios[0]?.id ?? null,
    })
    await db.sesionEjercicios.bulkAdd(ejercicios)
    for (const se of ejercicios) await crearSeriesPrerrellenadas(se)
    return sesionId
  })
}

/**
 * Retoma el entreno en curso o empieza la rutina que toca. Devuelve false si no hay rutinas
 * (entonces no hay nada que empezar).
 */
export async function empezarLoQueToca(origen: OrigenEntrada = 'manual'): Promise<boolean> {
  if (await sesionEnCurso()) return true
  const [rutinas, sesiones] = await Promise.all([db.rutinas.toArray(), db.sesiones.toArray()])
  const toca = rutinaQueToca(rutinas, sesiones)
  if (!toca) return false
  await iniciarSesion(toca.id, origen)
  return true
}

async function tocar(sesionId: string, cambios: Partial<Sesion> = {}): Promise<void> {
  await db.sesiones.update(sesionId, { ultimaActividad: Date.now(), ...cambios })
}

async function ejerciciosDe(sesionId: string): Promise<SesionEjercicio[]> {
  return db.sesionEjercicios.where('sesionId').equals(sesionId).sortBy('orden')
}

/** Un toque: marca (o desmarca) la serie, arranca el descanso y salta al siguiente de la superserie. */
export async function alternarSerie(serieId: string): Promise<boolean> {
  return db.transaction('rw', db.series, db.sesiones, db.sesionEjercicios, async () => {
    const serie = await db.series.get(serieId)
    if (!serie) return false
    const ahora = Date.now()
    const completada = !serie.completada
    await db.series.update(serieId, { completada, hora: completada ? ahora : null })
    if (!completada) {
      await tocar(serie.sesionId)
      return false
    }

    const ejercicios = await ejerciciosDe(serie.sesionId)
    const series = await db.series.where('sesionId').equals(serie.sesionId).toArray()
    const lista = ejercicios.map((e) => ({
      superserieConSiguiente: e.superserieConSiguiente,
      saltado: e.estado === 'saltado',
      descansoSeg: e.descansoSeg,
    }))
    const i = ejercicios.findIndex((e) => e.id === serie.sesionEjercicioId)
    const pendientesDe = (k: number) =>
      series.filter((s) => s.sesionEjercicioId === ejercicios[k]?.id && !s.completada).sort((a, b) => a.orden - b.orden)
    const destino = i >= 0 ? destinoTrasSerie(lista, i, (k) => pendientesDe(k).length > 0) : i
    const siguiente = pendientesDe(i)[0]?.tipo ?? null
    const base = i >= 0 ? descansoTrasSerie(lista, i, destino) : 0
    const descanso = destino === i ? descansoPorTipo(base, serie.tipo, siguiente) : base

    await tocar(serie.sesionId, {
      descansoFin: descanso > 0 ? ahora + descanso * 1000 : null,
      descansoDuracion: descanso > 0 ? descanso : null,
      ejercicioActivoId: ejercicios[destino]?.id ?? serie.sesionEjercicioId,
    })
    return true
  })
}

/**
 * Cambia el peso o las reps leyendo el valor actual dentro de la transacción (los toques rápidos
 * en +/− no se pierden) y lo propaga a las series pendientes siguientes que tenían el mismo valor.
 */
export async function cambiarValorSerie(id: string, campo: 'peso' | 'reps', calcular: (actual: number) => number): Promise<void> {
  await db.transaction('rw', db.series, db.sesiones, async () => {
    const serie = await db.series.get(id)
    if (!serie) return
    const hermanas = await db.series.where('sesionEjercicioId').equals(serie.sesionEjercicioId).toArray()
    const valor = Math.max(0, calcular(serie[campo]))
    for (const c of propagarCambio(hermanas, id, campo, valor)) await db.series.update(c.id, { [campo]: c.valor })
    await tocar(serie.sesionId)
  })
}

export async function actualizarSerie(id: string, cambios: Partial<Pick<Serie, 'rir' | 'tipo'>>) {
  const serie = await db.series.get(id)
  if (!serie) return
  await db.series.update(id, cambios)
  await tocar(serie.sesionId)
}

export async function anadirSerie(sesionEjercicioId: string): Promise<string | null> {
  const se = await db.sesionEjercicios.get(sesionEjercicioId)
  if (!se) return null
  const series = await db.series.where('sesionEjercicioId').equals(se.id).toArray()
  const n = serieSiguiente(series, se.repsMin)
  const id = nuevoId()
  await db.series.add({
    id,
    sesionId: se.sesionId,
    sesionEjercicioId: se.id,
    ejercicioId: se.ejercicioId,
    orden: series.length ? Math.max(...series.map((s) => s.orden)) + 1 : 0,
    ...n,
    rir: null,
    completada: false,
    hora: null,
  })
  await tocar(se.sesionId)
  return id
}

export async function eliminarSerie(id: string): Promise<void> {
  const serie = await db.series.get(id)
  if (!serie) return
  await db.series.delete(id)
  await tocar(serie.sesionId)
}

/** Aplica pesos y reps a varias series de una vez (p. ej. al tocar una sugerencia de progresión). */
export async function aplicarValores(cambios: { id: string; peso: number; reps: number }[]): Promise<void> {
  await db.transaction('rw', db.series, db.sesiones, async () => {
    let sesionId: string | null = null
    for (const c of cambios) {
      const s = await db.series.get(c.id)
      if (!s || s.completada) continue
      sesionId = s.sesionId
      await db.series.update(c.id, { peso: c.peso, reps: c.reps })
    }
    if (sesionId) await tocar(sesionId)
  })
}

export async function irAEjercicio(sesionId: string, sesionEjercicioId: string): Promise<void> {
  await db.sesiones.update(sesionId, { ejercicioActivoId: sesionEjercicioId })
}

export async function ajustarDescanso(sesionId: string, deltaSeg: number): Promise<void> {
  const s = await db.sesiones.get(sesionId)
  if (!s?.descansoFin) return
  const ahora = Date.now()
  const fin = s.descansoFin + deltaSeg * 1000
  await db.sesiones.update(sesionId, {
    descansoFin: fin > ahora ? fin : null,
    descansoDuracion: Math.max(0, (s.descansoDuracion ?? 0) + deltaSeg),
  })
}

export async function terminarDescanso(sesionId: string): Promise<void> {
  await db.sesiones.update(sesionId, { descansoFin: null })
}

export async function saltarEjercicio(sesionEjercicioId: string, saltar: boolean): Promise<void> {
  const se = await db.sesionEjercicios.get(sesionEjercicioId)
  if (!se) return
  await db.sesionEjercicios.update(se.id, { estado: saltar ? 'saltado' : 'activo' })
  await tocar(se.sesionId)
}

/** Añade un ejercicio sobre la marcha justo después del que estás haciendo. */
export async function anadirEjercicioASesion(sesionId: string, ejercicioId: string): Promise<string> {
  const { descansoDefecto } = await leerAjustes()
  return db.transaction('rw', db.sesionEjercicios, db.series, db.sesiones, async () => {
    const sesion = await db.sesiones.get(sesionId)
    const lista = await ejerciciosDe(sesionId)
    const activo = lista.findIndex((e) => e.id === sesion?.ejercicioActivoId)
    const posicion = activo >= 0 ? activo + 1 : lista.length
    const se: SesionEjercicio = {
      id: nuevoId(),
      sesionId,
      ejercicioId,
      orden: posicion,
      seriesObjetivo: 3,
      repsMin: 8,
      repsMax: 12,
      descansoSeg: descansoDefecto,
      nota: '',
      superserieConSiguiente: false,
      estado: 'activo',
      anadido: true,
    }
    await Promise.all(lista.slice(posicion).map((e, k) => db.sesionEjercicios.update(e.id, { orden: posicion + 1 + k })))
    await db.sesionEjercicios.add(se)
    await crearSeriesPrerrellenadas(se)
    await tocar(sesionId, { ejercicioActivoId: se.id })
    return se.id
  })
}

/**
 * Cambia un ejercicio por una alternativa (máquina ocupada). Si ya hiciste series,
 * se conservan con el ejercicio original y las pendientes pasan al nuevo.
 */
export async function cambiarEjercicio(sesionEjercicioId: string, nuevoEjercicioId: string): Promise<void> {
  await db.transaction('rw', db.sesionEjercicios, db.series, db.sesiones, async () => {
    const se = await db.sesionEjercicios.get(sesionEjercicioId)
    if (!se || se.ejercicioId === nuevoEjercicioId) return
    const series = await db.series.where('sesionEjercicioId').equals(se.id).toArray()
    const hechas = series.filter((s) => s.completada)
    const pendientes = series.filter((s) => !s.completada && s.tipo !== 'calentamiento')
    await db.series.bulkDelete(series.filter((s) => !s.completada).map((s) => s.id))

    if (hechas.length === 0) {
      const actualizado = { ...se, ejercicioId: nuevoEjercicioId, sustituyeA: se.sustituyeA ?? se.ejercicioId }
      await db.sesionEjercicios.put(actualizado)
      await crearSeriesPrerrellenadas(actualizado)
      await tocar(se.sesionId, { ejercicioActivoId: se.id })
      return
    }

    // Parte del ejercicio ya está hecho: el resto va en una tarjeta nueva justo después.
    const lista = await ejerciciosDe(se.sesionId)
    const posicion = lista.findIndex((e) => e.id === se.id) + 1
    await Promise.all(lista.slice(posicion).map((e, k) => db.sesionEjercicios.update(e.id, { orden: posicion + 1 + k })))
    const restantes = Math.max(1, pendientes.length)
    await db.sesionEjercicios.update(se.id, { seriesObjetivo: hechas.filter((s) => s.tipo !== 'calentamiento').length })
    const nuevo: SesionEjercicio = {
      ...se,
      id: nuevoId(),
      ejercicioId: nuevoEjercicioId,
      orden: posicion,
      seriesObjetivo: restantes,
      sustituyeA: se.ejercicioId,
      estado: 'activo',
      superserieConSiguiente: se.superserieConSiguiente,
    }
    await db.sesionEjercicios.update(se.id, { superserieConSiguiente: false })
    await db.sesionEjercicios.add(nuevo)
    await crearSeriesPrerrellenadas(nuevo)
    await tocar(se.sesionId, { ejercicioActivoId: nuevo.id })
  })
}

export async function guardarMolestia(sesionId: string, ejercicioId: string, nota: string): Promise<void> {
  const existente = await db.molestias.where('sesionId').equals(sesionId).filter((m) => m.ejercicioId === ejercicioId).first()
  if (existente) await db.molestias.update(existente.id, { nota })
  else await db.molestias.add({ id: nuevoId(), sesionId, ejercicioId, nota, hora: Date.now() })
}

export async function quitarMolestia(id: string): Promise<void> {
  await db.molestias.delete(id)
}

/**
 * Cierra la sesión: borra las series que quedaron sin hacer. Si no se hizo ninguna,
 * el entreno se descarta (la entrada al gimnasio se conserva). Devuelve si se guardó.
 */
async function cerrar(sesionId: string, salida: number, automatico: boolean): Promise<boolean> {
  return db.transaction('rw', TABLAS_SESION, async () => {
    const sesion = await db.sesiones.get(sesionId)
    if (!sesion || sesion.estado === 'terminada') return Boolean(sesion)
    const series = await db.series.where('sesionId').equals(sesionId).toArray()
    await db.series.bulkDelete(series.filter((s) => !s.completada).map((s) => s.id))
    if (!series.some((s) => s.completada)) {
      await borrarSesion(sesionId)
      return false
    }
    const conSeries = new Set(series.filter((s) => s.completada).map((s) => s.sesionEjercicioId))
    const vacios = await db.sesionEjercicios
      .where('sesionId')
      .equals(sesionId)
      .filter((e) => !conSeries.has(e.id) && e.estado !== 'saltado')
      .primaryKeys()
    await db.sesionEjercicios.bulkDelete(vacios)
    await db.sesiones.update(sesionId, {
      estado: 'terminada',
      salida,
      descansoFin: null,
      descansoDuracion: null,
      cierreAutomatico: automatico || undefined,
    })
    return true
  })
}

export const terminarSesion = (sesionId: string) => cerrar(sesionId, Date.now(), false)

/** Borra una sesión y todo lo suyo; la entrada al gimnasio queda como asistencia. */
export async function borrarSesion(sesionId: string): Promise<void> {
  await db.transaction('rw', TABLAS_SESION, async () => {
    await db.series.where('sesionId').equals(sesionId).delete()
    await db.sesionEjercicios.where('sesionId').equals(sesionId).delete()
    await db.molestias.where('sesionId').equals(sesionId).delete()
    const entradas = await db.entradas.filter((e) => e.sesionId === sesionId).toArray()
    for (const e of entradas) await db.entradas.update(e.id, { sesionId: undefined })
    await db.sesiones.delete(sesionId)
  })
}

/** Cierra el entreno en curso si lleva 3 h sin actividad, con la hora de la última serie como salida. */
export async function cerrarSesionCaducada(ahora = Date.now()): Promise<void> {
  const sesion = await sesionEnCurso()
  if (!sesion) return
  const series = await db.series.where('sesionId').equals(sesion.id).filter((s) => s.completada).toArray()
  const ultimaSerie = series.length ? Math.max(...series.map((s) => s.hora ?? 0)) : null
  const salida = cierreAutomatico(sesion, ultimaSerie, ahora)
  if (salida !== null) await cerrar(sesion.id, salida, true)
}
