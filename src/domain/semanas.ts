// Fechas locales y semanas (lunes a domingo).

/** Día local en formato AAAA-MM-DD. */
export function claveDia(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function inicioDia(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Lunes a las 00:00 de la semana de `t`. */
export function inicioSemana(t: number): number {
  const d = new Date(inicioDia(t))
  const desdeLunes = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - desdeLunes)
  return d.getTime()
}

export function sumarDias(t: number, dias: number): number {
  const d = new Date(t)
  d.setDate(d.getDate() + dias)
  return d.getTime()
}

/** Los 7 días (inicio de cada uno) de la semana de `t`. */
export function diasDeSemana(t: number): number[] {
  const lunes = inicioSemana(t)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const mesCorto = (t: number) => new Date(t).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')

/** "Semana del 2 al 8 nov" o, si cruza de mes, "Semana del 30 nov al 6 dic". */
export function etiquetaSemana(t: number): string {
  const lunes = inicioSemana(t)
  const domingo = sumarDias(lunes, 6)
  const dl = new Date(lunes).getDate()
  const dd = new Date(domingo).getDate()
  const mismoMes = new Date(lunes).getMonth() === new Date(domingo).getMonth()
  return mismoMes ? `Semana del ${dl} al ${dd} ${mesCorto(domingo)}` : `Semana del ${dl} ${mesCorto(lunes)} al ${dd} ${mesCorto(domingo)}`
}
