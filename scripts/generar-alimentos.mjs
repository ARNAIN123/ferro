// Genera la base de alimentos genéricos en español (src/catalogo/alimentos.json) a partir de
// catalogo/alimentos/lista.json y de USDA FoodData Central "SR Legacy" (dominio público, CC0).
//
//   1. Descarga https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip
//   2. Descomprímelo y ejecuta:  node scripts/generar-alimentos.mjs <ruta>/FoodData_Central_sr_legacy_food_json_2018-04.json
//
// Cada alimento de la lista toma los valores por 100 g del alimento de USDA cuya descripción contiene
// todas sus frases de "usda" (sin distinguir mayúsculas). Si hay varios, gana la descripción igual a la
// primera frase, después la que empieza por ella y después la más corta. Si no hay ninguno, falla.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node scripts/generar-alimentos.mjs <ruta al JSON de SR Legacy>')
  process.exit(1)
}

const usda = JSON.parse(readFileSync(ruta, 'utf8'))
const alimentosUsda = (usda.SRLegacyFoods ?? usda).map((x) => {
  const n = {}
  for (const fn of x.foodNutrients ?? []) n[String(fn.nutrient?.number ?? '')] = fn.amount
  return { id: x.fdcId, d: x.description, dl: x.description.toLowerCase(), n }
})

const lista = JSON.parse(readFileSync(join(raiz, 'catalogo', 'alimentos', 'lista.json'), 'utf8')).alimentos
const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const r1 = (v) => Math.round((v ?? 0) * 10) / 10

const faltan = []
const salida = []
const ids = new Set()
for (const a of lista) {
  const frases = a.usda.map((f) => f.toLowerCase())
  const rango = (x) => (x.dl === frases[0] ? 0 : x.dl.startsWith(frases[0]) ? 1 : 2)
  const u = alimentosUsda
    .filter((x) => frases.every((f) => x.dl.includes(f)))
    .sort((a, b) => rango(a) - rango(b) || a.dl.length - b.dl.length)[0]
  if (!u) {
    faltan.push(a.nombre)
    continue
  }
  const id = `g-${slug(a.nombre)}`
  if (ids.has(id)) throw new Error(`Nombre repetido: ${a.nombre}`)
  ids.add(id)
  // Energía: 208 (kcal). Proteína 203, grasa 204, hidratos 205, fibra 291.
  const kcal = u.n['208']
  if (kcal === undefined) throw new Error(`${a.nombre}: USDA ${u.id} sin energía`)
  salida.push({
    id,
    nombre: a.nombre,
    estado: a.estado,
    categoria: a.cat,
    por100: { kcal: Math.round(kcal), proteina: r1(u.n['203']), carbohidratos: r1(u.n['205']), grasa: r1(u.n['204']), fibra: r1(u.n['291']) },
    raciones: a.raciones.map(([nombre, gramos]) => ({ nombre, gramos })),
    fuente: `USDA FDC ${u.id}`,
    descripcionFuente: u.d,
  })
}

if (faltan.length) {
  console.error(`✗ Sin equivalente en USDA: ${faltan.join(', ')}`)
  process.exit(1)
}
salida.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
writeFileSync(join(raiz, 'src', 'catalogo', 'alimentos.json'), JSON.stringify({ fuente: 'USDA FoodData Central, SR Legacy (abril 2018), dominio público', alimentos: salida }) + '\n')

let md = `# Alimentos genéricos de Ferro (${salida.length})\n\nValores por 100 g de USDA FoodData Central (SR Legacy, dominio público). Generado por \`node scripts/generar-alimentos.mjs\`.\n\n| Alimento | Estado | kcal | Proteína | Hidratos | Grasa | Raciones | USDA |\n|---|---|---|---|---|---|---|---|\n`
for (const a of salida)
  md += `| ${a.nombre} | ${a.estado ?? '—'} | ${a.por100.kcal} | ${a.por100.proteina} | ${a.por100.carbohidratos} | ${a.por100.grasa} | ${a.raciones.map((r) => `${r.nombre} (${r.gramos} g)`).join(', ')} | ${a.descripcionFuente} |\n`
writeFileSync(join(raiz, 'catalogo', 'alimentos', 'LISTADO-ALIMENTOS.md'), md)
console.log(`✓ ${salida.length} alimentos genéricos`)
