// Actualizaciones de la app Android: se publican como APK en las Releases de GitHub.

/** Lo que interesa de la respuesta de la API de GitHub (`/releases/latest`). */
export interface ReleaseGithub {
  tag_name: string
  html_url: string
  body?: string | null
  assets: { name: string; browser_download_url: string }[]
}

export interface Actualizacion {
  version: string
  /** Enlace directo al APK (o a la página de la release si no tiene ninguno). */
  url: string
  notas: string
}

const partes = (v: string) =>
  v
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .slice(0, 3)
    .map((p) => Number.parseInt(p, 10) || 0)

/** Compara "0.3.0" con "v0.10.1": negativo si a es más antigua, 0 si son iguales, positivo si es más nueva. */
export function compararVersiones(a: string, b: string): number {
  const x = partes(a)
  const y = partes(b)
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** Devuelve la actualización si la release es más nueva que la versión instalada. */
export function actualizacionDisponible(instalada: string, release: ReleaseGithub): Actualizacion | null {
  if (compararVersiones(release.tag_name, instalada) <= 0) return null
  const apk = release.assets.find((a) => a.name.toLowerCase().endsWith('.apk'))
  return {
    version: release.tag_name.replace(/^v/i, ''),
    url: apk?.browser_download_url ?? release.html_url,
    notas: (release.body ?? '').trim(),
  }
}
