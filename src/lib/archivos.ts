import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { esNativa } from './plataforma'

/** Carpeta visible en el gestor de archivos del móvil donde la app Android guarda copias y CSV. */
export const CARPETA_NATIVA = 'Documentos/Ferro'

/**
 * Guarda un archivo generado en el móvil. En el navegador lo descarga (carpeta Descargas);
 * en la app Android lo escribe en Documentos/Ferro, porque un WebView no sabe descargar.
 */
export async function guardarArchivo(nombre: string, contenido: string, tipo: string): Promise<void> {
  if (esNativa()) {
    await Filesystem.writeFile({
      path: `Ferro/${nombre}`,
      data: contenido,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    return
  }
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
  try {
    if (esNativa()) {
      const { uri } = await Filesystem.writeFile({ path: nombre, data: contenido, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: nombre, files: [uri] })
      return true
    }
    const archivo = new File([contenido], nombre, { type: tipo })
    if (!navigator.canShare?.({ files: [archivo] })) return false
    await navigator.share({ files: [archivo], title: nombre })
    return true
  } catch {
    return false
  }
}

export const puedeCompartirArchivos = (): boolean =>
  esNativa() ||
  (typeof navigator !== 'undefined' &&
    typeof File !== 'undefined' &&
    Boolean(navigator.canShare?.({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })))
