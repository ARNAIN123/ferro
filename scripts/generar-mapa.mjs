// Genera src/components/mapa/trazados.ts a partir de los trazados SVG de
// react-native-body-highlighter (MIT, © 2022 ELABBASSI Hicham), leídos como TEXTO.
// Uso (una sola vez): node scripts/generar-mapa.mjs <ruta al paquete descomprimido>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const paquete = process.argv[2]
if (!paquete) throw new Error('Indica la ruta del paquete descomprimido')
const raiz = fileURLToPath(new URL('..', import.meta.url))

function partes(archivo) {
  const txt = readFileSync(join(paquete, 'dist', 'assets', archivo), 'utf8')
  return txt
    .split(/\{\s*slug:\s*"/)
    .slice(1)
    .map((b) => {
      const slug = b.slice(0, b.indexOf('"'))
      const lista = []
      for (const lado of ['common', 'left', 'right']) {
        const m = b.match(new RegExp(lado + ':\\s*\\[([\\s\\S]*?)\\]'))
        if (m) for (const x of m[1].matchAll(/"([^"]+)"/g)) if (/^[Mm][\d\s.,\-a-zA-Z]+$/.test(x[1])) lista.push(x[1])
      }
      return { slug, lista }
    })
}

function silueta(lado) {
  const txt = readFileSync(join(paquete, 'dist', 'components', 'SvgMaleWrapper.js'), 'utf8')
  const i = txt.indexOf(`male-body-outline-${lado}`)
  const tramo = txt.slice(0, i)
  const inicio = tramo.lastIndexOf('d="')
  return tramo.slice(inicio + 3, tramo.indexOf('"', inicio + 3)).replace(/\s+/g, ' ').trim()
}

// Región del mapa para cada parte. En la espalda algunas partes se reparten por índice
// (orden izquierda → derecha del paquete): dorsales frente a redondo/infraespinoso, glúteo mayor frente a medio.
const FRENTE = {
  chest: 'pecho', obliques: 'oblicuos', abs: 'abdominales', biceps: 'biceps', triceps: 'triceps', neck: 'cuello',
  trapezius: 'trapecio', deltoids: 'deltoides', adductors: 'aductores', quadriceps: 'cuadriceps', knees: 'rodillas',
  tibialis: 'tibial', calves: 'gemelos', forearm: 'antebrazos', hands: 'manos', ankles: 'tobillos', feet: 'pies',
  head: 'cabeza', hair: 'pelo',
}
const ESPALDA = {
  neck: 'cuello', trapezius: 'trapecio', deltoids: 'deltoides', triceps: 'triceps', 'lower-back': 'lumbares',
  forearm: 'antebrazos', adductors: 'aductores', hamstring: 'isquiotibiales', calves: 'gemelos', ankles: 'tobillos',
  feet: 'pies', hands: 'manos', head: 'cabeza', hair: 'pelo',
  'upper-back': ['espalda_media', 'dorsales', 'espalda_media', 'espalda_media', 'espalda_media', 'dorsales'],
  gluteal: ['abductores', 'gluteos', 'abductores', 'gluteos'],
}

function agrupar(lista, tabla) {
  const grupos = new Map()
  for (const { slug, lista: trazados } of lista) {
    const regla = tabla[slug]
    if (!regla) throw new Error(`Parte sin región: ${slug}`)
    trazados.forEach((d, i) => {
      const region = Array.isArray(regla) ? regla[i] : regla
      grupos.set(region, [...(grupos.get(region) ?? []), d])
    })
  }
  return [...grupos].map(([region, d]) => ({ region, d }))
}

const salida = `// Generado por scripts/generar-mapa.mjs. No editar a mano.
// Trazados anatómicos de react-native-body-highlighter (MIT License, Copyright (c) 2022 ELABBASSI Hicham).
import type { RegionMapa } from '../../domain/mapaMuscular'

export interface ParteMapa {
  region: RegionMapa
  d: string[]
}

export const FRENTE: ParteMapa[] = ${JSON.stringify(agrupar(partes('bodyFront.js'), FRENTE))}

export const ESPALDA: ParteMapa[] = ${JSON.stringify(agrupar(partes('bodyBack.js'), ESPALDA))}

export const SILUETA_FRENTE = ${JSON.stringify(silueta('front'))}

export const SILUETA_ESPALDA = ${JSON.stringify(silueta('back'))}
`
writeFileSync(join(raiz, 'src', 'components', 'mapa', 'trazados.ts'), salida)
console.log('✓ trazados.ts', (salida.length / 1024).toFixed(0), 'KB')
