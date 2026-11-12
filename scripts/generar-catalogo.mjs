// Genera la biblioteca de ejercicios en español. Solo peso libre (barra olímpica, Z, hexagonal, landmine,
// mancuernas y discos), poleas y multipower: de Free Exercise DB (dominio público, filtrada) más los
// ejercicios propios de catalogo/propios.json. Los demás (máquinas, peso corporal, kettlebell, bandas,
// cardio, estiramientos…) salen como "retirados": no están en la biblioteca, pero los que ya están en el
// historial conservan sus músculos.
//
//   npm run catalogo   → regenera src/catalogo/ejercicios.json y el listado
//
// Ya no se usa ninguna foto: cada ejercicio se dibuja con las animaciones propias (src/animacion).
//
// Los músculos son las regiones del avatar (ver src/domain/tipos.ts → MUSCULOS).
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const dir = (...p) => join(raiz, ...p)

const NOMBRE_MUSCULO = {
  pectoral_superior: 'Pectoral superior',
  pectoral_inferior: 'Pectoral inferior',
  deltoides_anterior: 'Deltoides anterior',
  deltoides_lateral: 'Deltoides lateral',
  deltoides_posterior: 'Deltoides posterior',
  biceps: 'Bíceps',
  braquial: 'Braquial',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  trapecio: 'Trapecio',
  espalda_media: 'Espalda media',
  dorsales: 'Dorsales',
  lumbares: 'Lumbares',
  abdomen: 'Abdomen',
  oblicuos: 'Oblicuos',
  gluteo_mayor: 'Glúteo mayor',
  gluteo_medio: 'Glúteo medio',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  aductores: 'Aductores',
  gemelos: 'Gemelos',
  soleo: 'Sóleo',
  cuello: 'Cuello',
}
const NOMBRE_MATERIAL = {
  barra: 'Barra',
  barra_z: 'Barra Z',
  barra_hexagonal: 'Barra hexagonal',
  landmine: 'Landmine',
  mancuernas: 'Mancuernas',
  discos: 'Discos',
  polea: 'Polea',
  multipower: 'Multipower',
}
// Músculos antiguos (biblioteca de la ronda 1) → regiones nuevas, para los ejercicios máquina de extra.json.
const MUSCULOS_ANTIGUOS = {
  pecho: ['pectoral_inferior', 'pectoral_superior'],
  hombros: ['deltoides_anterior', 'deltoides_lateral'],
  gluteos: ['gluteo_mayor'],
  abductores: ['gluteo_medio'],
}
const antiguos = (l) => [...new Set(l.flatMap((m) => MUSCULOS_ANTIGUOS[m] ?? [m]))]
const MATERIALES_ANTIGUOS = {
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
const NIVELES = { beginner: 'principiante', intermediate: 'intermedio', expert: 'avanzado' }
const MECANICAS = { compound: 'compuesto', isolation: 'aislamiento' }

// Fuera aunque su material encaje: en realidad son de peso corporal, pliométricos o necesitan otro aparato.
const EXCLUIDOS = new Set([
  'Crunch en polea sobre bosu con inclinaciones',
  'Aperturas con peso corporal',
  'Elevación de tibiales en multipower',
  'Salto desde rodillas con barra',
  'Sentadilla con salto con barra',
  'Sentadilla con traslado de discos',
])
// Correcciones de músculos donde la fuente se equivoca.
const CORRECCIONES = {
  'Aducción de cadera en polea': { principales: ['aductores'], secundarios: [] },
  'Elevación lateral en polea baja': { principales: ['deltoides_lateral'], secundarios: ['trapecio'] },
  'Elevaciones de deltoides alternas': { principales: ['deltoides_anterior', 'deltoides_lateral'], secundarios: [] },
  'Remo en polea baja al cuello': { principales: ['deltoides_posterior'], secundarios: ['espalda_media', 'trapecio', 'biceps'] },
  'Press balancín alterno': { principales: ['deltoides_anterior'], secundarios: ['deltoides_lateral', 'triceps', 'oblicuos'] },
  'Remo al mentón con mancuernas': { principales: ['deltoides_lateral', 'trapecio'], secundarios: ['biceps'] },
}

/** Material dentro de la biblioteca, o null si el ejercicio no entra. */
function materialDe(e, nombre) {
  if (/band|chain/i.test(e.name)) return null
  if (/landmine/i.test(e.name) || /landmine/i.test(nombre) || /linear jammer/i.test(e.name)) return 'landmine'
  if (/trap bar/i.test(e.name)) return 'barra_hexagonal'
  if (/multipower/i.test(nombre) || /smith/i.test(e.name)) return e.equipment === 'machine' || e.equipment === 'barbell' ? 'multipower' : null
  if (/barra Z/.test(nombre) && ['barbell', 'e-z curl bar'].includes(e.equipment)) return 'barra_z'
  if (e.equipment === 'barbell') return 'barra'
  if (e.equipment === 'e-z curl bar') return 'barra_z'
  if (e.equipment === 'dumbbell') return 'mancuernas'
  if (e.equipment === 'cable') return 'polea'
  if (e.equipment === 'other' && /plate/i.test(e.name)) return 'discos'
  return null
}

/** Músculos de un ejercicio de Free Exercise DB en las regiones del avatar, según su nombre. */
function musculosDe(e) {
  const n = e.name.toLowerCase()
  const has = (re) => re.test(n)
  const principales = []
  const secundarios = []
  const de = (m, lista) => {
    switch (m) {
      case 'chest':
        if (has(/incline|from below|low.?to.?high|upward/)) return lista.push('pectoral_superior')
        if (has(/decline|dip|high.?to.?low|downward/)) return lista.push('pectoral_inferior')
        if (lista === secundarios && has(/front|overhead|raise/)) return lista.push('pectoral_superior')
        return lista.push('pectoral_inferior')
      case 'shoulders':
        if (lista === secundarios) {
          if (e.primaryMuscles.some((p) => ['lats', 'middle back', 'traps'].includes(p))) return lista.push('deltoides_posterior')
          if (has(/lateral|side/)) return
          return lista.push('deltoides_anterior')
        }
        if (has(/external rotation/)) return lista.push('deltoides_posterior')
        if (has(/internal rotation/)) return lista.push('deltoides_anterior')
        if (has(/rear|reverse fl|face pull|posterior|bent.?over.*(raise|lateral|fly)|seated bent/)) return lista.push('deltoides_posterior')
        if (has(/upright.*row/)) return lista.push('deltoides_lateral')
        if (has(/iron cross|lateral|side|scaption|\by raise/)) return lista.push('deltoides_lateral')
        if (has(/front|raise/)) return lista.push('deltoides_anterior')
        return lista.push('deltoides_anterior')
      case 'calves':
        return lista.push(has(/seated/) ? 'soleo' : 'gemelos')
      case 'abdominals':
        return lista.push(has(/twist|side bend|oblique|wood|chop|judo|russian|pallof|landmine 180|spell/) ? 'oblicuos' : 'abdomen')
      case 'biceps':
        if (lista === principales && has(/hammer/)) return lista.push('braquial')
        if (lista === principales && has(/reverse/)) return lista.push('braquial', 'antebrazos')
        if (lista === principales && has(/zottman/)) return lista.push('biceps', 'braquial')
        return lista.push('biceps')
      case 'traps':
        if (lista === principales && has(/upright.*row/)) return lista.push('deltoides_lateral', 'trapecio')
        return lista.push('trapecio')
      case 'glutes':
        return lista.push('gluteo_mayor')
      case 'abductors':
        return lista.push('gluteo_medio')
      case 'adductors':
        return lista.push('aductores')
      case 'forearms':
        return lista.push('antebrazos')
      case 'hamstrings':
        return lista.push('isquiotibiales')
      case 'lats':
        return lista.push('dorsales')
      case 'lower back':
        return lista.push('lumbares')
      case 'middle back':
        return lista.push('espalda_media')
      case 'neck':
        return lista.push('cuello')
      case 'quadriceps':
        return lista.push('cuadriceps')
      case 'triceps':
        return lista.push('triceps')
      default:
        throw new Error(`Músculo desconocido: ${m}`)
    }
  }
  for (const m of e.primaryMuscles) de(m, principales)
  for (const m of e.secondaryMuscles) de(m, secundarios)
  // Complementos según el tipo de ejercicio.
  if (principales.includes('pectoral_inferior') && !has(/decline|dip/)) secundarios.push('pectoral_superior')
  if (principales.includes('pectoral_superior')) secundarios.push('pectoral_inferior')
  if (principales.includes('deltoides_anterior') && has(/press|jerk|push/)) secundarios.push('deltoides_lateral')
  if (principales.includes('gemelos')) secundarios.push('soleo')
  if (principales.includes('soleo')) secundarios.push('gemelos')
  if (principales.includes('biceps') && !principales.includes('braquial')) secundarios.push('braquial')
  if (principales.includes('braquial') && !principales.includes('biceps')) secundarios.push('biceps')
  const p = [...new Set(principales)]
  return { principales: p, secundarios: [...new Set(secundarios)].filter((m) => !p.includes(m)) }
}

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

const fuente = JSON.parse(readFileSync(dir('catalogo', 'fuente', 'free-exercise-db.json'), 'utf8'))
const nombres = leerTsv('nombres')
const instrucciones = leerInstrucciones()
const extra = JSON.parse(readFileSync(dir('catalogo', 'extra.json'), 'utf8')).ejercicios
const propios = JSON.parse(readFileSync(dir('catalogo', 'propios.json'), 'utf8')).ejercicios

const faltan = { nombre: [], instrucciones: [] }

const ejercicios = []
const retirados = []
for (const e of fuente) {
  const nombre = nombres.get(e.id) ?? e.name
  const material = ['stretching', 'cardio', 'plyometrics'].includes(e.category) || EXCLUIDOS.has(nombre) ? null : materialDe(e, nombre)
  const musculos = CORRECCIONES[nombre] ?? musculosDe(e)
  if (!material) {
    retirados.push({ id: e.id, ...musculos })
    continue
  }
  if (!nombres.has(e.id)) faltan.nombre.push(e.id)
  const pasos = instrucciones.get(e.id) ?? []
  if (pasos.length === 0) faltan.instrucciones.push(e.id)
  ejercicios.push({
    id: e.id,
    nombre,
    alias: e.name,
    ...musculos,
    material,
    categoria: e.category === 'olympic weightlifting' ? 'halterofilia' : 'fuerza',
    nivel: NIVELES[e.level] ?? null,
    mecanica: MECANICAS[e.mechanic] ?? null,
    instrucciones: pasos,
  })
}

// Los de extra.json: los de polea entran; las máquinas quedan retiradas (con sus músculos al día).
for (const x of extra) {
  const musculos = { principales: antiguos(x.principales), secundarios: antiguos(x.secundarios) }
  if (x.material !== 'polea') {
    retirados.push({ id: x.id, ...musculos })
    continue
  }
  ejercicios.push({ id: x.id, nombre: x.nombre, alias: x.alias, ...musculos, material: 'polea', categoria: 'fuerza', nivel: x.nivel, mecanica: x.mecanica, instrucciones: x.instrucciones })
}
for (const x of propios) {
  for (const m of [...x.principales, ...x.secundarios]) if (!NOMBRE_MUSCULO[m]) throw new Error(`${x.id}: músculo desconocido ${m}`)
  if (!NOMBRE_MATERIAL[x.material]) throw new Error(`${x.id}: material fuera de la biblioteca ${x.material}`)
  ejercicios.push({ ...x, categoria: 'fuerza' })
}

const repetidos = ejercicios.map((e) => e.nombre).filter((n, i, a) => a.indexOf(n) !== i)
if (repetidos.length) throw new Error(`Nombres repetidos: ${repetidos.join(', ')}`)

ejercicios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
retirados.sort((a, b) => a.id.localeCompare(b.id))

// Ronda 5: los grupos musculares de cada ejercicio (catalogo/musculos.json, que salió de la división
// completa de la ronda 4, revisada, agrupada en los 18 grupos). Sustituye a las zonas en la
// biblioteca y los retirados. Para cambiar los músculos de un ejercicio, se edita ese archivo.
const GRUPOS = new Set(['cuello', 'trapecio', 'hombros', 'pecho', 'biceps', 'triceps', 'antebrazos', 'espalda_alta', 'dorsales', 'lumbares', 'abdominales', 'oblicuos', 'gluteos', 'abductores', 'aductores', 'cuadriceps', 'isquiotibiales', 'gemelos'])
const R5 = JSON.parse(readFileSync(dir('catalogo', 'musculos.json'), 'utf8'))
for (const lista of [ejercicios, retirados])
  for (const e of lista) {
    const r = R5[e.id]
    if (!r) throw new Error(`${e.id}: falta en catalogo/musculos.json`)
    for (const m of [...r.principales, ...r.secundarios]) if (!GRUPOS.has(m)) throw new Error(`${e.id}: grupo muscular desconocido ${m}`)
    e.principales = r.principales
    e.secundarios = r.secundarios
  }
const cuerpo = JSON.stringify({ ejercicios, retirados })
const version = createHash('sha1').update(cuerpo).digest('hex').slice(0, 12)
mkdirSync(dir('src', 'catalogo'), { recursive: true })
writeFileSync(dir('src', 'catalogo', 'ejercicios.json'), JSON.stringify({ version, ejercicios, retirados }) + '\n')

// Módulo diminuto con la versión: la app solo descarga el catálogo completo si cambia.
writeFileSync(
  dir('src', 'catalogo', 'version.ts'),
  `// Generado por scripts/generar-catalogo.mjs. No editar a mano.
export const VERSION_CATALOGO = '${version}'
`,
)

// Listado para revisar, agrupado por grupo muscular principal (el primero).
const NOMBRE_GRUPO = { cuello: 'Cuello', trapecio: 'Trapecio', hombros: 'Hombros', pecho: 'Pecho', biceps: 'Bíceps', triceps: 'Tríceps', antebrazos: 'Antebrazos', espalda_alta: 'Espalda alta', dorsales: 'Dorsales', lumbares: 'Lumbares', abdominales: 'Abdominales', oblicuos: 'Oblicuos', gluteos: 'Glúteos', abductores: 'Abductores', aductores: 'Aductores', cuadriceps: 'Cuádriceps', isquiotibiales: 'Isquiotibiales', gemelos: 'Gemelos' }
const grupos = new Map([...GRUPOS].map((m) => [m, []]))
for (const e of ejercicios) grupos.get(e.principales[0]).push(e)
let md = `# Biblioteca de Ferro (${ejercicios.length} ejercicios)

Solo peso libre (barra, barra Z, barra hexagonal, landmine, mancuernas y discos), poleas y multipower. Agrupados por su primer grupo muscular principal. Generado por \`npm run catalogo\`.
`
for (const [m, lista] of grupos) {
  if (!lista.length) continue
  md += `
## ${NOMBRE_GRUPO[m]} (${lista.length})

| Ejercicio | Material | Principales | Secundarios |
|---|---|---|---|
`
  for (const e of lista) {
    const n = (l) => l.map((x) => NOMBRE_GRUPO[x]).join(', ') || '—'
    md += `| ${e.nombre} | ${NOMBRE_MATERIAL[e.material]} | ${n(e.principales)} | ${n(e.secundarios)} |
`
  }
}
writeFileSync(dir('catalogo', 'LISTADO-BIBLIOTECA.md'), md)

console.log(`✓ ${ejercicios.length} ejercicios en la biblioteca (versión ${version}), ${retirados.length} retirados`)
for (const [k, v] of Object.entries(faltan)) if (v.length) console.log(`  · sin ${k}: ${v.length}${v.length < 8 ? ' → ' + v.join(', ') : ''}`)
