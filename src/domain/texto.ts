/** Minúsculas y sin tildes, para búsquedas tolerantes ("jalon" encuentra "Jalón"). */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function coincide(texto: string, busqueda: string): boolean {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean)
  const objetivo = normalizar(texto)
  return palabras.every((p) => objetivo.includes(p))
}

const RELLENO = new Set(['de', 'del', 'con', 'en', 'al', 'a', 'la', 'el', 'las', 'los', 'sobre', 'y', 'una', 'un'])

/** Nombre corto para chips: "Press de banca con barra" → "Press banca". */
export function nombreCorto(nombre: string, palabras = 2): string {
  const utiles = nombre.split(/\s+/).filter((p) => !RELLENO.has(p.toLowerCase()))
  return utiles.slice(0, palabras).join(' ') || nombre
}
