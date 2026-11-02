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
