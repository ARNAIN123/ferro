// Imágenes de los ejercicios sin conexión. El service worker las guarda al verlas (cache-first)
// en esta misma caché; desde Ajustes se pueden descargar todas de golpe.
export const CACHE_IMAGENES = 'ferro-imagenes'

const absoluta = (url: string) => new URL(url, location.origin).href

export async function contarGuardadas(urls: readonly string[]): Promise<number> {
  if (!('caches' in window)) return 0
  const cache = await caches.open(CACHE_IMAGENES)
  const guardadas = new Set((await cache.keys()).map((r) => r.url))
  return urls.filter((u) => guardadas.has(absoluta(u))).length
}

/** Descarga las que falten, de 6 en 6, avisando del progreso. Se puede cancelar. */
export async function descargarImagenes(
  urls: readonly string[],
  alAvanzar: (hechas: number, total: number) => void,
  senal: AbortSignal,
): Promise<{ hechas: number; fallos: number }> {
  const cache = await caches.open(CACHE_IMAGENES)
  const guardadas = new Set((await cache.keys()).map((r) => r.url))
  const pendientes = urls.filter((u) => !guardadas.has(absoluta(u)))
  let hechas = urls.length - pendientes.length
  let fallos = 0
  alAvanzar(hechas, urls.length)
  let i = 0
  const trabajador = async () => {
    while (i < pendientes.length && !senal.aborted) {
      const url = pendientes[i++]!
      try {
        const r = await fetch(url, { signal: senal })
        if (r.ok) await cache.put(absoluta(url), r)
        else fallos++
      } catch {
        if (senal.aborted) return
        fallos++
      }
      alAvanzar(++hechas, urls.length)
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabajador))
  return { hechas, fallos }
}
