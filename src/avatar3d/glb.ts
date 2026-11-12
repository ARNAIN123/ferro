// Lector mínimo de GLB (glTF binario) para public/modelos/avatar.glb: da los accesores como matrices
// con tipo, también los dispersos (los deformadores del avatar solo guardan los vértices que mueven).
// No depende de three.js, así que la forma del avatar se puede calcular y probar sin WebGL.

type Tipada = Float32Array | Uint32Array | Uint16Array | Int16Array | Uint8Array | Int8Array

interface Accesor {
  bufferView?: number
  byteOffset?: number
  componentType: number
  count: number
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4'
  normalized?: boolean
  sparse?: { count: number; indices: { bufferView: number; byteOffset?: number; componentType: number }; values: { bufferView: number; byteOffset?: number } }
}

interface Vista {
  byteOffset?: number
  byteLength: number
  byteStride?: number
}

export interface GltfJson {
  accessors: Accesor[]
  bufferViews: Vista[]
  meshes: {
    primitives: { attributes: Record<string, number>; indices: number; targets?: Record<string, number>[] }[]
    extras?: Record<string, unknown>
  }[]
}

export interface Glb {
  json: GltfJson
  bin: ArrayBuffer
}

const COMPONENTES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 } as const
const TIPOS: Record<number, { new (b: ArrayBuffer, o: number, n: number): Tipada }> = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
}

export function leerGlb(datos: ArrayBuffer): Glb {
  const v = new DataView(datos)
  if (datos.byteLength < 20 || v.getUint32(0, true) !== 0x46546c67) throw new Error('El archivo no es un GLB')
  let json: GltfJson | null = null
  let bin: ArrayBuffer | null = null
  for (let p = 12; p + 8 <= datos.byteLength; ) {
    const largo = v.getUint32(p, true)
    const tipo = v.getUint32(p + 4, true)
    if (tipo === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(datos, p + 8, largo))) as GltfJson
    // Una copia: así los datos empiezan en 0 y cada vista queda alineada.
    else if (tipo === 0x004e4942) bin = datos.slice(p + 8, p + 8 + largo)
    p += 8 + largo
  }
  if (!json || !bin) throw new Error('GLB incompleto')
  return { json, bin }
}

function trozo(glb: Glb, vista: number, desplazamiento: number, tipo: number, n: number): Tipada {
  const b = glb.json.bufferViews[vista]
  const Tipo = TIPOS[tipo]
  if (!b || !Tipo) throw new Error('GLB: vista o tipo desconocido')
  if (b.byteStride) throw new Error('GLB: no se admiten vistas intercaladas')
  return new Tipo(glb.bin, (b.byteOffset ?? 0) + desplazamiento, n)
}

/** Datos de un accesor denso, tal como están guardados (sin normalizar). */
export function accesor(glb: Glb, i: number): Tipada {
  const a = glb.json.accessors[i]
  if (!a || a.bufferView === undefined) throw new Error(`GLB: el accesor ${i} no es denso`)
  return trozo(glb, a.bufferView, a.byteOffset ?? 0, a.componentType, a.count * COMPONENTES[a.type])
}

/** Un accesor disperso: las filas que tienen valor y sus valores (el resto son ceros). */
export function disperso(glb: Glb, i: number): { filas: Uint16Array | Uint32Array; valores: Tipada } {
  const a = glb.json.accessors[i]
  const s = a?.sparse
  if (!a || !s) throw new Error(`GLB: el accesor ${i} no es disperso`)
  const filas = trozo(glb, s.indices.bufferView, s.indices.byteOffset ?? 0, s.indices.componentType, s.count) as Uint16Array | Uint32Array
  return { filas, valores: trozo(glb, s.values.bufferView, s.values.byteOffset ?? 0, a.componentType, s.count * COMPONENTES[a.type]) }
}
