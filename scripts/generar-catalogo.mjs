// Genera el catálogo de ejercicios en español a partir de Free Exercise DB (dominio público)
// y de las traducciones de /catalogo. Se ejecuta una sola vez (o al cambiar las traducciones):
//
//   npm run catalogo                                  → solo regenera src/catalogo/ejercicios.json
//   npm run catalogo -- --imagenes <ruta>/exercises   → además convierte las imágenes a WebP
//
// Las imágenes se guardan en public/img/ejercicios/<id>/<n>.webp y se sirven desde la propia app.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const dir = (...p) => join(raiz, ...p)

const MUSCULOS = {
  abdominals: 'abdomen',
  abductors: 'abductores',
  adductors: 'aductores',
  biceps: 'biceps',
  calves: 'gemelos',
  chest: 'pecho',
  forearms: 'antebrazos',
  glutes: 'gluteos',
  hamstrings: 'isquiotibiales',
  lats: 'dorsales',
  'lower back': 'lumbares',
  'middle back': 'espalda_media',
  neck: 'cuello',
  quadriceps: 'cuadriceps',
  shoulders: 'hombros',
  traps: 'trapecio',
  triceps: 'triceps',
}
const MATERIALES = {
  barbell: 'barra',
  'e-z curl bar': 'barra_z',
  dumbbell: 'mancuernas',
  kettlebells: 'kettlebell',
  cable: 'polea',
  machine: 'maquina',
  'body only': 'peso_corporal',
  bands: 'bandas',
  'medicine ball': 'balon_medicinal',
  'exercise ball': 'fitball',
  'foam roll': 'foam_roller',
  other: 'otro',
}
const CATEGORIAS = {
  strength: 'fuerza',
  powerlifting: 'fuerza',
  'olympic weightlifting': 'halterofilia',
  strongman: 'strongman',
  plyometrics: 'pliometria',
  cardio: 'cardio',
  stretching: 'estiramientos',
}
const NIVELES = { beginner: 'principiante', intermediate: 'intermedio', expert: 'avanzado' }
const MECANICAS = { compound: 'compuesto', isolation: 'aislamiento' }

function leerTsv(prefijo) {
  const mapa = new Map()
  for (const f of readdirSync(dir('catalogo')).filter((f) => f.startsWith(prefijo) && f.endsWith('.tsv')).sort()) {
    for (const linea of readFileSync(dir('catalogo', f), 'utf8').split(/\r?\n/)) {
      if (!linea.trim() || linea.startsWith('#')) continue
      const [id, texto] = linea.split('\t')
      if (id && texto) mapa.set(id.trim(), texto.trim())
    }
  }
  return mapa
}

/** Formato de los archivos de instrucciones: "@id" y debajo un paso por línea empezando por "- ". */
function leerInstrucciones() {
  const mapa = new Map()
  for (const f of readdirSync(dir('catalogo')).filter((f) => f.startsWith('instrucciones') && f.endsWith('.txt')).sort()) {
    let actual = null
    for (const linea of readFileSync(dir('catalogo', f), 'utf8').split(/\r?\n/)) {
      if (linea.startsWith('@')) {
        actual = linea.slice(1).trim()
        mapa.set(actual, [])
      } else if (actual && linea.startsWith('- ')) mapa.get(actual).push(linea.slice(2).trim())
    }
  }
  return mapa
}

async function convertirImagenes(origen, ejercicios) {
  const { default: sharp } = await import('sharp')
  let hechas = 0
  for (const e of ejercicios) {
    for (const [i, ruta] of e.images.entries()) {
      const destinoDir = dir('public', 'img', 'ejercicios', e.id)
      const destino = join(destinoDir, `${i}.webp`)
      if (existsSync(destino)) continue
      mkdirSync(destinoDir, { recursive: true })
      await sharp(join(origen, ruta)).resize({ width: 560, withoutEnlargement: true }).webp({ quality: 62, effort: 5 }).toFile(destino)
      if (++hechas % 100 === 0) console.log(`  ${hechas} imágenes convertidas…`)
    }
  }
  console.log(`✓ ${hechas} imágenes nuevas en WebP`)
}

const fuente = JSON.parse(readFileSync(dir('catalogo', 'fuente', 'free-exercise-db.json'), 'utf8'))
const nombres = leerTsv('nombres')
const sinonimos = leerTsv('sinonimos')
const instrucciones = leerInstrucciones()
const extra = JSON.parse(readFileSync(dir('catalogo', 'extra.json'), 'utf8')).ejercicios

const iImg = process.argv.indexOf('--imagenes')
if (iImg > 0) await convertirImagenes(process.argv[iImg + 1], fuente)

const faltan = { nombre: [], instrucciones: [], imagen: [] }
const bytesDe = (id, n) => {
  const f = dir('public', 'img', 'ejercicios', id, `${n}.webp`)
  return existsSync(f) ? statSync(f).size : 0
}
let bytesImagenes = 0
let totalImagenes = 0

const ejercicios = fuente.map((e) => {
  const nombre = nombres.get(e.id)
  if (!nombre) faltan.nombre.push(e.id)
  const pasos = instrucciones.get(e.id) ?? []
  if (pasos.length === 0) faltan.instrucciones.push(e.id)
  let imagenes = 0
  for (let n = 0; n < e.images.length; n++) {
    const b = bytesDe(e.id, n)
    if (!b) break
    imagenes++
    bytesImagenes += b
  }
  totalImagenes += imagenes
  if (imagenes === 0) faltan.imagen.push(e.id)
  const material = e.equipment ? MATERIALES[e.equipment] : 'ninguno'
  if (!material) throw new Error(`Material desconocido: ${e.equipment}`)
  const mus = (lista) => lista.map((m) => MUSCULOS[m] ?? (() => { throw new Error(`Músculo desconocido: ${m}`) })())
  const principales = mus(e.primaryMuscles)
  return {
    id: e.id,
    nombre: nombre ?? e.name,
    alias: [e.name, sinonimos.get(e.id)].filter(Boolean).join(', '),
    principales,
    secundarios: mus(e.secondaryMuscles).filter((m) => !principales.includes(m)),
    material,
    categoria: CATEGORIAS[e.category],
    nivel: NIVELES[e.level] ?? null,
    mecanica: MECANICAS[e.mechanic] ?? null,
    instrucciones: pasos,
    imagenes,
  }
})

for (const x of extra) {
  ejercicios.push({
    id: x.id,
    nombre: x.nombre,
    alias: [x.alias, sinonimos.get(x.id)].filter(Boolean).join(', '),
    principales: x.principales,
    secundarios: x.secundarios,
    material: x.material,
    categoria: 'fuerza',
    nivel: x.nivel,
    mecanica: x.mecanica,
    instrucciones: x.instrucciones,
    imagenes: 0,
  })
}

ejercicios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
const cuerpo = JSON.stringify(ejercicios)
const version = createHash('sha1').update(cuerpo).digest('hex').slice(0, 12)
mkdirSync(dir('src', 'catalogo'), { recursive: true })
writeFileSync(
  dir('src', 'catalogo', 'ejercicios.json'),
  JSON.stringify({ version, totalImagenes, bytesImagenes, ejercicios }) + '\n',
)

// Módulo diminuto con la versión: la app solo descarga el catálogo completo si cambia.
writeFileSync(
  dir('src', 'catalogo', 'version.ts'),
  `// Generado por scripts/generar-catalogo.mjs. No editar a mano.
export const VERSION_CATALOGO = '${version}'
export const TOTAL_IMAGENES = ${totalImagenes}
export const BYTES_IMAGENES = ${bytesImagenes}
`,
)

console.log(`✓ ${ejercicios.length} ejercicios (versión ${version}), ${totalImagenes} imágenes, ${(bytesImagenes / 1048576).toFixed(1)} MB`)
for (const [k, v] of Object.entries(faltan)) if (v.length) console.log(`  · sin ${k}: ${v.length}${v.length < 8 ? ' → ' + v.join(', ') : ''}`)
