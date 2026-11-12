import { readFileSync } from 'node:fs'
import { BufferAttribute, BufferGeometry, MeshBasicMaterial, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { DatosCuerpo } from '../domain/cuerpo'
import { REGIONES_MODELO } from '../domain/musculos'
import { aplicarPostura, crearEsqueleto, ponerEnReposo } from './esqueleto'
import { difuminar, fuerzaRelieve, reducir } from './mapaColor'
import { modeloDesdeGlb, PARTES, type InfoAvatar } from './modelo'
import { posturaRelajada, RESPIRACION_S, respirar } from './postura'
import { resolverForma } from './resolver'

const glb = readFileSync('public/modelos/avatar.glb')
const info = JSON.parse(readFileSync('public/modelos/avatar.json', 'utf8')) as InfoAvatar
const modelo = modeloDesdeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, info)

const CUERPOS: DatosCuerpo[] = [
  { sexo: 'hombre', edad: 30, alturaCm: 178, kg: 80 },
  { sexo: 'hombre', edad: 45, alturaCm: 168, kg: 105 },
  { sexo: 'mujer', edad: 28, alturaCm: 162, kg: 56 },
]

/** El avatar con piel en la postura relajada, como lo monta el visor. */
function montar(d: DatosCuerpo) {
  const { forma } = resolverForma(modelo, d)
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(forma.posiciones), 3))
  g.setAttribute('skinIndex', new BufferAttribute(modelo.huesos4, 4))
  g.setAttribute('skinWeight', new BufferAttribute(modelo.pesos4, 4, true))
  const e = crearEsqueleto(modelo)
  const malla = new SkinnedMesh(g, new MeshBasicMaterial())
  malla.add(e.raiz)
  ponerEnReposo(e, modelo, forma.articulaciones)
  malla.bind(e.esqueleto)
  const postura = posturaRelajada(modelo, forma.articulaciones)
  aplicarPostura(e, postura)
  malla.updateMatrixWorld(true)
  e.esqueleto.update()
  const pos = (h: string) => e.porNombre.get(h)!.getWorldPosition(new Vector3())
  /** Vértices de la piel de una parte del cuerpo, ya con la postura. */
  const vertices = (parte: (typeof PARTES)[number], paso = 3) => {
    const k = PARTES.indexOf(parte)
    const r: Vector3[] = []
    for (let i = 0; i < info.vertices_forma; i += paso) if (modelo.parte[i] === k) r.push(malla.getVertexPosition(i, new Vector3()))
    return r
  }
  return { forma, e, postura, malla, pos, vertices }
}

const angulo = (a: Vector3, b: Vector3, c: Vector3) => (a.clone().sub(b).angleTo(c.clone().sub(b)) * 180) / Math.PI

describe('postura relajada del avatar', () => {
  it('los pies siguen apoyados en el suelo, a la par', () => {
    for (const d of CUERPOS) {
      const { forma, pos } = montar(d)
      for (const lado of ['L', 'R']) expect(Math.abs(pos(`pie.${lado}`).y - forma.articulaciones[`pie.${lado}`]![1]), `${d.kg} kg, ${lado}`).toBeLessThan(0.01)
      expect(Math.abs(pos('pie.L').z - pos('pie.R').z)).toBeLessThan(0.005)
    }
  })

  it('codos y rodillas un poco doblados, sin bloquear', () => {
    for (const d of CUERPOS) {
      const { pos } = montar(d)
      for (const lado of ['L', 'R']) {
        const codo = 180 - angulo(pos(`brazo.${lado}`), pos(`antebrazo.${lado}`), pos(`mano.${lado}`))
        expect(codo, `codo ${lado}`).toBeGreaterThan(8)
        expect(codo, `codo ${lado}`).toBeLessThan(35)
        const rodilla = 180 - angulo(pos(`muslo.${lado}`), pos(`pierna.${lado}`), pos(`pie.${lado}`))
        expect(rodilla, `rodilla ${lado}`).toBeLessThan(15)
      }
    }
  })

  it('es simétrica (sin cargar el peso en una pierna) y con los brazos algo abiertos', () => {
    for (const d of CUERPOS) {
      const { pos } = montar(d)
      expect(Math.abs(pos('muslo.L').y - pos('muslo.R').y)).toBeLessThan(0.002)
      expect(Math.abs(pos('mano.L').y - pos('mano.R').y)).toBeLessThan(0.002)
      expect(Math.abs(pos('mano.L').x + pos('mano.R').x)).toBeLessThan(0.004)
      expect(Math.abs(pos('cabeza').x)).toBeLessThan(0.005)
      for (const [lado, s] of [['L', 1], ['R', -1]] as const) {
        // Brazo abierto: del hombro a la muñeca, más de 12° respecto a la vertical, hacia fuera.
        const brazo = pos(`mano.${lado}`).sub(pos(`brazo.${lado}`))
        const apertura = (Math.atan2(brazo.x * s, -brazo.y) * 180) / Math.PI
        expect(apertura, `${d.kg} kg, ${lado}`).toBeGreaterThan(12)
        expect(apertura, `${d.kg} kg, ${lado}`).toBeLessThan(32)
      }
    }
  })

  it('las palmas miran hacia dentro, hacia los muslos', () => {
    for (const d of CUERPOS) {
      const { e } = montar(d)
      for (const [lado, s] of [['L', 1], ['R', -1]] as const) {
        // En reposo la palma mira al frente (+Z): con la postura, hacia el centro del cuerpo.
        const palma = new Vector3(0, 0, 1).applyQuaternion(e.porNombre.get(`mano.${lado}`)!.getWorldQuaternion(new Quaternion()))
        expect(palma.x * -s, `${d.kg} kg, ${lado}`).toBeGreaterThan(0.85)
      }
    }
  })

  it('puños cerrados que apuntan hacia dentro, con el pulgar por fuera', () => {
    for (const d of CUERPOS) {
      const { e, forma, pos } = montar(d)
      for (const [lado, s] of [['L', 1], ['R', -1]] as const) {
        const largo = new Vector3(...forma.articulaciones[`mano.${lado}`]!).distanceTo(new Vector3(...forma.articulaciones[`dedos3.${lado}`]!))
        // La última falange vuelve hacia la muñeca: mucho más cerca que con la mano abierta.
        expect(pos(`dedos3.${lado}`).distanceTo(pos(`mano.${lado}`)), `${d.kg} kg, ${lado}`).toBeLessThan(largo * 0.6)
        // De la muñeca a los nudillos, hacia abajo y hacia el cuerpo.
        const mano = pos(`dedos.${lado}`).sub(pos(`mano.${lado}`))
        expect(mano.y).toBeLessThan(0)
        expect(mano.x * s, `${d.kg} kg, ${lado}`).toBeLessThan(0)
        // El pulgar, delante de los dedos cerrados (del lado de la palma) y no metido en ellos.
        const pulgar = e.porNombre.get(`pulgar.${lado}`)!
        const punta = pulgar.localToWorld(new Vector3(...forma.articulaciones[`yema_pulgar.${lado}`]!).sub(new Vector3(...forma.articulaciones[`pulgar.${lado}`]!)))
        expect(punta.distanceTo(pos(`dedos3.${lado}`)), `${d.kg} kg, pulgar ${lado}`).toBeLessThan(0.05)
      }
    }
  })

  it('pecho fuera y hombros atrás', () => {
    const { pos, forma } = montar(CUERPOS[0]!)
    // Los hombros, más atrás que en reposo.
    for (const lado of ['L', 'R']) expect(pos(`brazo.${lado}`).z).toBeLessThan(forma.articulaciones[`brazo.${lado}`]![2] - 0.005)
  })

  it('los brazos cuelgan junto al cuerpo sin meterse en él', () => {
    for (const d of CUERPOS) {
      const { pos, vertices } = montar(d)
      const tronco = vertices('tronco', 2)
      for (const [lado, s] of [['L', 1], ['R', -1]] as const) {
        const muneca = pos(`mano.${lado}`)
        // La muñeca, por debajo de la pelvis y por fuera del muslo.
        expect(muneca.y).toBeLessThan(pos('cadera').y)
        expect(muneca.x * s).toBeGreaterThan(pos(`muslo.${lado}`).x * s)
        // Ni el codo ni la muñeca tocan el tronco ni la pierna de su lado.
        const pierna = vertices(lado === 'L' ? 'pierna.L' : 'pierna.R', 2)
        for (const [nombre, p] of [['codo', pos(`antebrazo.${lado}`)], ['muñeca', muneca]] as const) {
          const cerca = Math.min(...[...tronco, ...pierna].map((v) => v.distanceTo(p)))
          expect(cerca, `${d.kg} kg, ${nombre} ${lado}`).toBeGreaterThan(0.025)
        }
      }
    }
  })

  it('la respiración mueve el pecho muy poco y vuelve a la postura', () => {
    const { e, postura, pos } = montar(CUERPOS[0]!)
    respirar(e, postura, 0)
    e.raiz.updateMatrixWorld(true)
    const cuello0 = pos('cuello')
    const hombro0 = pos('brazo.L')
    respirar(e, postura, RESPIRACION_S * 0.42)
    e.raiz.updateMatrixWorld(true)
    const sube = pos('brazo.L').y - hombro0.y
    expect(sube).toBeGreaterThan(0.001)
    expect(sube).toBeLessThan(0.012)
    expect(pos('cuello').distanceTo(cuello0)).toBeLessThan(0.012)
    respirar(e, postura, RESPIRACION_S)
    e.raiz.updateMatrixWorld(true)
    expect(pos('brazo.L').distanceTo(hombro0)).toBeLessThan(1e-4)
  })
})

describe('colores con bordes suaves', () => {
  // Dos regiones (1 a la izquierda y 2 a la derecha) dentro de una isla, y fuera nada.
  const lado = 32
  const region = new Uint8Array(lado * lado)
  const dentro = new Uint8Array(lado * lado)
  for (let y = 4; y < 28; y++)
    for (let x = 4; x < 28; x++) {
      dentro[y * lado + x] = 1
      region[y * lado + x] = x < 16 ? 1 : 2
    }
  // rgba por región: 0 gris (fuera), 1 negro, 2 blanco con brillo.
  const colores = Float32Array.from([0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 1, 1, 1, 1])
  const r = difuminar(region, dentro, lado, colores, 3, 2)
  const en = (x: number, y: number) => r[(y * lado + x) * 4]!

  it('el borde entre dos regiones pasa poco a poco de un color al otro', () => {
    expect(en(6, 16)).toBeCloseTo(0, 5)
    expect(en(26, 16)).toBeCloseTo(1, 5)
    expect(en(15, 16)).toBeGreaterThan(0.2)
    expect(en(15, 16)).toBeLessThan(0.5)
    expect(en(16, 16)).toBeGreaterThan(0.5)
    expect(en(16, 16)).toBeLessThan(0.8)
    for (let x = 5; x < 27; x++) expect(en(x + 1, 16)).toBeGreaterThanOrEqual(en(x, 16) - 1e-6)
  })

  it('lo de fuera de la isla no tiñe el borde y se rellena con el color de al lado', () => {
    // El borde de la izquierda sigue negro (el gris de fuera no entra) y fuera, pegado, también.
    expect(en(4, 16)).toBeCloseTo(0, 5)
    expect(en(3, 16)).toBeCloseTo(0, 5)
    expect(en(27, 16)).toBeCloseTo(1, 5)
    expect(en(28, 16)).toBeCloseTo(1, 5)
  })

  it('el relieve del pecho casi no se usa; el de los demás músculos, entero', () => {
    const pecho = REGIONES_MODELO.indexOf('pectoral_esternal') + 1
    const muslo = REGIONES_MODELO.indexOf('vasto_lateral') + 1
    const r2 = new Uint8Array(lado * lado)
    for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) r2[y * lado + x] = x < 16 ? pecho : muslo
    const f = fuerzaRelieve(r2, dentro, lado)
    expect(f[16 * lado + 5]!).toBeLessThan(0.25)
    expect(f[16 * lado + 26]!).toBeGreaterThan(0.9)
  })

  it('reduce un mapa eligiendo un texel por bloque', () => {
    const m = Uint8Array.from([1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 4, 4])
    expect([...reducir(m, 4, 2)]).toEqual([1, 2, 3, 4])
    expect(reducir(m, 4, 4)).toBe(m)
  })
})
