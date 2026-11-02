// Avisos breves (toasts) que cualquier parte de la app puede lanzar.

export interface Aviso {
  id: number
  texto: string
  accion?: { texto: string; ruta: string }
}

type Oyente = (avisos: Aviso[]) => void

let avisos: Aviso[] = []
let siguienteId = 1
const oyentes = new Set<Oyente>()

const emitir = () => oyentes.forEach((o) => o(avisos))

export function avisar(texto: string, accion?: Aviso['accion'], duracionMs = 4500): void {
  const aviso = { id: siguienteId++, texto, accion }
  avisos = [...avisos, aviso]
  emitir()
  setTimeout(() => cerrarAviso(aviso.id), duracionMs)
}

export function cerrarAviso(id: number): void {
  avisos = avisos.filter((a) => a.id !== id)
  emitir()
}

export function suscribirAvisos(oyente: Oyente): () => void {
  oyentes.add(oyente)
  oyente(avisos)
  return () => oyentes.delete(oyente)
}
