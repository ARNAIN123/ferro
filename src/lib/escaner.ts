// Escáner de códigos de barras con el lector de Google (ML Kit). Usa la interfaz de Google Play
// Services: no hace falta dar permiso de cámara a Ferro. En el navegador no hay escáner.
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { esNativa } from './plataforma'

export const hayEscaner = esNativa

/**
 * Abre el lector y devuelve el código leído (null si se cancela). La primera vez Google puede tener
 * que descargar el lector: entonces avisa y hay que volver a intentarlo en unos segundos.
 */
export async function escanearCodigo(): Promise<string | null> {
  if (!esNativa()) return null
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
  if (!available) {
    await BarcodeScanner.installGoogleBarcodeScannerModule()
    throw new Error('Se está descargando el lector de códigos de Google. Prueba otra vez en unos segundos.')
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE] })
    return barcodes[0]?.rawValue ?? null
  } catch (e) {
    // Cancelar el lector no es un error.
    if (e instanceof Error && /cancel/i.test(e.message)) return null
    throw e
  }
}
