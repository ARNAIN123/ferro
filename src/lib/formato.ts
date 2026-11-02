const kgFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })
const enteroFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

/** 62.5 → "62,5" */
export const fmtKg = (kg: number): string => kgFmt.format(kg)

/** 12345 → "12.345" */
export const fmtEntero = (n: number): string => enteroFmt.format(Math.round(n))

/** 95 → "1:35" */
export function fmtCrono(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Duración legible: 4500000 ms → "1 h 15 min" */
export function fmtDuracion(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export const fmtHora = (t: number): string =>
  new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

export const fmtFechaCorta = (t: number): string =>
  new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export const fmtFechaLarga = (t: number): string =>
  new Date(t).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/** "hace 3 días", "hoy", "ayer" */
export function fmtHace(t: number, ahora = Date.now()): string {
  const dias = Math.round((inicioDia(ahora) - inicioDia(t)) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  const semanas = Math.round(dias / 7)
  if (dias < 31) return semanas === 1 ? 'hace 1 semana' : `hace ${semanas} semanas`
  return fmtFechaCorta(t)
}

function inicioDia(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Acepta "62,5" o "62.5". Devuelve null si no es un número válido. */
export function parseNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}
