/** Descarga un archivo generado en el móvil (en Android acaba en la carpeta Descargas). */
export function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Comparte el archivo con otra app (Drive, Telegram, correo…) si el móvil lo permite. */
export async function compartir(nombre: string, contenido: string, tipo: string): Promise<boolean> {
  const archivo = new File([contenido], nombre, { type: tipo })
  if (!navigator.canShare?.({ files: [archivo] })) return false
  try {
    await navigator.share({ files: [archivo], title: nombre })
    return true
  } catch {
    return false
  }
}

export const puedeCompartirArchivos = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof File !== 'undefined' &&
  Boolean(navigator.canShare?.({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }))
