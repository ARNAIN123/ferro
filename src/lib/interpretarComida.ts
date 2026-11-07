// Interpretación opcional de "200 g de pollo con 80 g de arroz" con la API de Anthropic.
// Solo se usa si he puesto mi clave en Ajustes; sin clave, todo lo demás funciona igual.
import Anthropic from '@anthropic-ai/sdk'
import { ESQUEMA_INTERPRETACION, instruccionesInterpretacion, limpiarInterpretacion, type EntradaCatalogo, type ItemInterpretado } from '../domain/interpretacion'

const MODELO = 'claude-opus-5-5'

export async function interpretarComida(texto: string, clave: string, catalogo: readonly EntradaCatalogo[], senal?: AbortSignal): Promise<ItemInterpretado[]> {
  // La clave es mía y solo está en mi móvil: por eso se permite llamar a la API desde la app.
  const cliente = new Anthropic({ apiKey: clave, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 })
  let respuesta
  try {
    respuesta = await cliente.beta.messages.create(
      {
        model: MODELO,
        max_tokens: 8000,
        // Si el modelo principal no está disponible, la API usa automáticamente otro equivalente.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_INTERPRETACION } },
        system: instruccionesInterpretacion(catalogo),
        messages: [{ role: 'user', content: texto }],
      },
      { signal: senal },
    )
  } catch (e) {
    throw new Error(mensajeDeError(e))
  }
  if (respuesta.stop_reason === 'refusal') throw new Error('La IA no ha querido interpretar ese texto. Añádelo a mano.')
  if (respuesta.stop_reason === 'max_tokens') throw new Error('La descripción es demasiado larga. Prueba con menos alimentos.')
  const bloque = respuesta.content.find((b) => b.type === 'text')
  if (!bloque || bloque.type !== 'text') throw new Error('Respuesta vacía. Inténtalo de nuevo.')
  let datos: unknown
  try {
    datos = JSON.parse(bloque.text)
  } catch {
    throw new Error('No se entendió la respuesta. Inténtalo de nuevo.')
  }
  return limpiarInterpretacion(datos, catalogo)
}

function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'La clave de Anthropic no es válida. Revísala en Ajustes.'
  if (e instanceof Anthropic.PermissionDeniedError) return 'Tu clave no tiene permiso para usar este modelo.'
  if (e instanceof Anthropic.RateLimitError) return 'Demasiadas peticiones o sin saldo en tu cuenta de Anthropic. Prueba en un rato.'
  if (e instanceof Anthropic.APIUserAbortError) return 'Cancelado.'
  if (e instanceof Anthropic.APIConnectionError) return 'Sin conexión con Anthropic. Revisa internet.'
  if (e instanceof Anthropic.APIError) return `Error de la API de Anthropic (${e.status ?? '?'}).`
  return e instanceof Error ? e.message : 'No se pudo interpretar.'
}
