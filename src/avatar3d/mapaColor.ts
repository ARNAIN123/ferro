// Color de la piel del avatar con bordes suaves (ronda 5): en vez de elegir el color de la región
// de cada punto (bordes duros, como recortados), se pinta un mapa de color en el espacio UV con el
// color de cada región y se difumina un poco, solo dentro de las islas del mapa UV (fuera no hay piel
// y se rellena con el color de al lado, para que el filtrado de la tarjeta gráfica no traiga gris de
// fuera en las costuras). Se rehace cuando cambian los niveles, el músculo elegido o el tema.
import * as THREE from 'three'
import type { RGB } from '../domain/cuerpo3d'
import { REGIONES_MODELO, type RegionModelo } from '../domain/musculos'
import type { TexturasAvatar } from './texturas'

/** Lado del mapa de color (texeles). */
export const LADO_COLOR = 512
/** Radio (texeles del mapa de color) y pasadas del difuminado: unos 1,5 cm de transición en el cuerpo. */
const RADIO = 3
const PASADAS = 2

/** Reduce un mapa cuadrado a la mitad (o lo que haga falta) eligiendo un texel de cada bloque. */
export function reducir(datos: Uint8Array, lado: number, nuevo: number): Uint8Array {
  if (lado === nuevo) return datos
  const r = new Uint8Array(nuevo * nuevo)
  const k = lado / nuevo
  for (let y = 0; y < nuevo; y++) {
    const fila = Math.min(lado - 1, Math.floor((y + 0.5) * k)) * lado
    for (let x = 0; x < nuevo; x++) r[y * nuevo + x] = datos[fila + Math.min(lado - 1, Math.floor((x + 0.5) * k))]!
  }
  return r
}

/** Una pasada de caja en un sentido, pesada por la máscara (solo cuentan los texeles con piel). */
function caja(entrada: Float32Array, dentro: Uint8Array, lado: number, radio: number, horizontal: boolean, salida: Float32Array): void {
  const suma = new Float32Array(4)
  for (let a = 0; a < lado; a++) {
    suma.fill(0)
    let peso = 0
    const idx = (b: number) => (horizontal ? a * lado + b : b * lado + a)
    // Ventana inicial [−radio, radio] alrededor de b = 0.
    for (let b = 0; b <= Math.min(lado - 1, radio); b++) {
      const i = idx(b)
      if (!dentro[i]) continue
      for (let c = 0; c < 4; c++) suma[c]! += entrada[i * 4 + c]!
      peso++
    }
    for (let b = 0; b < lado; b++) {
      const i = idx(b)
      if (dentro[i] && peso > 0) for (let c = 0; c < 4; c++) salida[i * 4 + c] = suma[c]! / peso
      else for (let c = 0; c < 4; c++) salida[i * 4 + c] = entrada[i * 4 + c]!
      // Desliza la ventana: sale b − radio y entra b + radio + 1.
      const sale = b - radio
      if (sale >= 0) {
        const j = idx(sale)
        if (dentro[j]) {
          for (let c = 0; c < 4; c++) suma[c]! -= entrada[j * 4 + c]!
          peso--
        }
      }
      const entra = b + radio + 1
      if (entra < lado) {
        const j = idx(entra)
        if (dentro[j]) {
          for (let c = 0; c < 4; c++) suma[c]! += entrada[j * 4 + c]!
          peso++
        }
      }
    }
  }
}

/**
 * Colores de cada texel (rgba, lineales) con los bordes entre regiones difuminados dentro de la piel.
 * `colores` tiene 4 valores por región (la 0 incluida). Los texeles sin piel toman el de su vecino.
 */
export function difuminar(region: Uint8Array, dentro: Uint8Array, lado: number, colores: Float32Array, radio = RADIO, pasadas = PASADAS): Float32Array {
  const a = new Float32Array(lado * lado * 4)
  for (let i = 0; i < lado * lado; i++) {
    const r = region[i]! * 4
    a[i * 4] = colores[r] ?? 0
    a[i * 4 + 1] = colores[r + 1] ?? 0
    a[i * 4 + 2] = colores[r + 2] ?? 0
    a[i * 4 + 3] = colores[r + 3] ?? 0
  }
  return suavizar(a, dentro, lado, radio, pasadas)
}

/** Difumina un mapa rgba dentro de la piel y rellena lo de fuera con el valor de al lado. */
function suavizar(entrada: Float32Array<ArrayBuffer>, dentro: Uint8Array, lado: number, radio: number, pasadas: number): Float32Array<ArrayBuffer> {
  let a = entrada
  let b = new Float32Array(a.length)
  for (let p = 0; p < pasadas; p++) {
    caja(a, dentro, lado, radio, true, b)
    caja(b, dentro, lado, radio, false, a)
  }
  // Fuera de la piel: el color del vecino con piel más cercano (dos anillos bastan para el filtrado).
  let relleno = Uint8Array.from(dentro)
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    b.set(a)
    const siguiente = Uint8Array.from(relleno)
    for (let y = 0; y < lado; y++)
      for (let x = 0; x < lado; x++) {
        const i = y * lado + x
        if (relleno[i]) continue
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= lado || ny >= lado) continue
          const j = ny * lado + nx
          if (!relleno[j]) continue
          for (let c = 0; c < 4; c++) b[i * 4 + c] = a[j * 4 + c]!
          siguiente[i] = 1
          break
        }
      }
    ;[a, b] = [b, a]
    relleno = siguiente
  }
  return a
}

const aSrgb = (c: number) => {
  const v = Math.min(1, Math.max(0, c))
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
}

export interface MapaColor {
  /** rgb: color (sRGB, la tarjeta lo pasa a lineal al filtrar); a: brillo propio. */
  textura: THREE.DataTexture
  pintar: (porRegion: readonly { color: RGB; brillo: number }[]) => void
  liberar: () => void
}

export function crearMapaColor(texturas: TexturasAvatar): MapaColor {
  const region = reducir(texturas.region, texturas.lado, LADO_COLOR)
  const dentro = reducir(texturas.dentro, texturas.lado, LADO_COLOR)
  const datos = new Uint8Array(LADO_COLOR * LADO_COLOR * 4)
  const textura = new THREE.DataTexture(datos, LADO_COLOR, LADO_COLOR, THREE.RGBAFormat, THREE.UnsignedByteType)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.magFilter = textura.minFilter = THREE.LinearFilter
  textura.generateMipmaps = false
  textura.flipY = false
  return {
    textura,
    pintar(porRegion) {
      const colores = new Float32Array(porRegion.length * 4)
      porRegion.forEach((a, i) => colores.set([a.color[0], a.color[1], a.color[2], a.brillo], i * 4))
      const lineal = difuminar(region, dentro, LADO_COLOR, colores)
      for (let i = 0; i < LADO_COLOR * LADO_COLOR; i++) {
        datos[i * 4] = aSrgb(lineal[i * 4]!)
        datos[i * 4 + 1] = aSrgb(lineal[i * 4 + 1]!)
        datos[i * 4 + 2] = aSrgb(lineal[i * 4 + 2]!)
        datos[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, lineal[i * 4 + 3]!)) * 255)
      }
      textura.needsUpdate = true
    },
    liberar: () => textura.dispose(),
  }
}

/**
 * Cuánto relieve horneado se usa en cada región (1 = todo). En el pecho, el relieve de Z-Anatomy no
 * coincide con el pectoral musculado de MakeHuman y dibuja un surco raro bajo el pectoral, de la axila
 * al esternón: ahí no se usa nada (la forma del pectoral ya la da la malla).
 */
export const RELIEVE_REGION: Partial<Record<RegionModelo, number>> = {
  pectoral_clavicular: 0,
  pectoral_esternal: 0,
  pectoral_costal: 0,
  serrato_anterior: 0.2,
  deltoides_anterior: 0.5,
}

/** Lo que se extiende (texeles del mapa de 512) la falta de relieve más allá de su región: unos 3 cm. */
const EXTENDER_RELIEVE = 9

/** Mínimo en una ventana (en un sentido) entre los texeles con piel: extiende las zonas de valor bajo. */
function minimo(campo: Float32Array, dentro: Uint8Array, lado: number, radio: number, horizontal: boolean): Float32Array<ArrayBuffer> {
  const r = Float32Array.from(campo)
  for (let a = 0; a < lado; a++)
    for (let b = 0; b < lado; b++) {
      const i = horizontal ? a * lado + b : b * lado + a
      if (!dentro[i]) continue
      let m = campo[i]!
      for (let k = Math.max(0, b - radio); k <= Math.min(lado - 1, b + radio); k++) {
        const j = horizontal ? a * lado + k : k * lado + a
        if (dentro[j] && campo[j]! < m) m = campo[j]!
      }
      r[i] = m
    }
  return r
}

/** Fuerza del relieve de cada punto del mapa UV (de 0 a 1), con los cambios entre regiones difuminados. */
export function fuerzaRelieve(region: Uint8Array, dentro: Uint8Array, lado: number): Float32Array {
  const factores = new Float32Array((REGIONES_MODELO.length + 1) * 4).fill(1)
  REGIONES_MODELO.forEach((r, i) => factores.fill(RELIEVE_REGION[r] ?? 1, (i + 1) * 4, (i + 2) * 4))
  // Primero la zona sin relieve se extiende un poco por las regiones de al lado (el surco cae justo en
  // la frontera) y después el cambio se difumina.
  let campo: Float32Array = new Float32Array(lado * lado)
  for (let i = 0; i < lado * lado; i++) campo[i] = factores[region[i]! * 4]!
  campo = minimo(minimo(campo, dentro, lado, EXTENDER_RELIEVE, true), dentro, lado, EXTENDER_RELIEVE, false)
  const a = new Float32Array(lado * lado * 4)
  for (let i = 0; i < lado * lado; i++) a[i * 4] = campo[i]!
  const f = suavizar(a, dentro, lado, 6, 2)
  const r = new Float32Array(lado * lado)
  for (let i = 0; i < lado * lado; i++) r[i] = f[i * 4]!
  return r
}

/** Textura con la fuerza del relieve (canal rojo). */
export function crearMapaRelieve(texturas: TexturasAvatar): THREE.DataTexture {
  const f = fuerzaRelieve(reducir(texturas.region, texturas.lado, LADO_COLOR), reducir(texturas.dentro, texturas.lado, LADO_COLOR), LADO_COLOR)
  const datos = new Uint8Array(LADO_COLOR * LADO_COLOR * 4)
  for (let i = 0; i < LADO_COLOR * LADO_COLOR; i++) datos[i * 4] = Math.round(Math.min(1, Math.max(0, f[i]!)) * 255)
  const t = new THREE.DataTexture(datos, LADO_COLOR, LADO_COLOR, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.magFilter = t.minFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}
