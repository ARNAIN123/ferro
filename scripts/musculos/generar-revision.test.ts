// Genera el listado de ejercicios con sus músculos (ronda 4) para revisarlo antes de integrarlo
// (revision/…/ejercicios-musculos.html) y catalogo/musculos-r4.json, que `npm run catalogo` aplica.
// Parte de las zonas: si el catálogo ya está en la división completa, borra catalogo/musculos-r4.json,
// ejecuta `npm run catalogo`, después esto y otra vez `npm run catalogo`:
//   GENERAR_REVISION=revision/r4-musculos npx vitest run scripts/musculos/generar-revision.test.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { asignarAnimacion } from '../../src/animacion/asignacion'
import catalogo from '../../src/catalogo/ejercicios.json'
import { NOMBRE_ZONA } from '../../src/domain/etiquetas'
import { GRUPOS, INFO_MUSCULO, MUSCULOS_DE_GRUPO, NOMBRE_GRUPO } from '../../src/domain/musculos'
import { musculosFinos, zonasDe } from '../../src/domain/reasignacion'
import { MUSCULOS, type Material, type Musculo } from '../../src/domain/tipos'

interface Fila {
  id: string
  nombre: string
  material: Material
  principales: string[]
  secundarios: string[]
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

it.skipIf(!process.env.GENERAR_REVISION)('genera el listado de revisión', () => {
  const ejercicios = catalogo.ejercicios as unknown as Fila[]
  const filas = ejercicios.map((e) => {
    const nuevo = musculosFinos({ id: e.id, nombre: e.nombre, material: e.material, musculosPrincipales: e.principales, musculosSecundarios: e.secundarios })
    const patron = asignarAnimacion({ id: e.id, nombre: e.nombre, material: e.material, musculosPrincipales: nuevo.principales }).animacion.patron
    return { e, nuevo, patron, grupo: nuevo.principales[0] ? INFO_MUSCULO[nuevo.principales[0]].grupo : 'core' }
  })
  // Propuesta de catálogo: la biblioteca y los retirados (de estos solo hay el id, que lleva el nombre
  // en inglés: las reglas lo entienden igual). `npm run catalogo` la aplica.
  const salida = process.env.GENERAR_REVISION!
  mkdirSync(salida, { recursive: true })
  const retirados = (catalogo as unknown as { retirados: { id: string; principales: string[]; secundarios: string[] }[] }).retirados.map((r) => {
    const m = musculosFinos({ id: r.id, nombre: r.id, material: 'otro', musculosPrincipales: r.principales, musculosSecundarios: r.secundarios })
    return [r.id, { principales: m.principales, secundarios: m.secundarios }] as const
  })
  const propuesta = Object.fromEntries([...filas.map((f) => [f.e.id, { principales: f.nuevo.principales, secundarios: f.nuevo.secundarios }] as const), ...retirados])
  writeFileSync(new URL('../../catalogo/musculos-r4.json', import.meta.url), `${JSON.stringify(propuesta, null, 1)}\n`)
  // Uso de cada músculo.
  const uso = new Map<Musculo, { p: number; s: number }>(MUSCULOS.map((m) => [m, { p: 0, s: 0 }]))
  for (const f of filas) {
    for (const m of f.nuevo.principales) uso.get(m)!.p++
    for (const m of f.nuevo.secundarios) uso.get(m)!.s++
  }
  const chip = (m: Musculo, papel: 'p' | 's') => `<span class="m ${papel}${INFO_MUSCULO[m].profundo ? ' prof' : ''}">${escapar(INFO_MUSCULO[m].corto)}</span>`
  const antes = (l: string[]) => zonasDe(l).map((z) => NOMBRE_ZONA[z]).join(', ') || '—'
  const secciones = GRUPOS.map((g) => {
    const deGrupo = filas.filter((f) => f.grupo === g).sort((a, b) => a.patron.localeCompare(b.patron, 'es') || a.e.nombre.localeCompare(b.e.nombre, 'es'))
    if (!deGrupo.length) return ''
    const porPatron = new Map<string, typeof deGrupo>()
    for (const f of deGrupo) porPatron.set(f.patron, [...(porPatron.get(f.patron) ?? []), f])
    return `<section><h2>${NOMBRE_GRUPO[g]} <small>${deGrupo.length} ejercicios</small></h2>${[...porPatron]
      .map(
        ([patron, lista]) => `<h3>${escapar(patron)}</h3><ul>${lista
          .map(
            (f) =>
              `<li data-t="${escapar(`${f.e.nombre} ${f.patron} ${[...f.nuevo.principales, ...f.nuevo.secundarios].map((m) => INFO_MUSCULO[m].corto).join(' ')}`.toLowerCase())}"><b>${escapar(f.e.nombre)}</b><div>${f.nuevo.principales.map((m) => chip(m, 'p')).join('')}${f.nuevo.secundarios.map((m) => chip(m, 's')).join('')}</div><p class="antes">Antes: ${escapar(antes(f.e.principales))}${f.e.secundarios.length ? ` · ${escapar(antes(f.e.secundarios))}` : ''}</p></li>`,
          )
          .join('')}</ul>`,
      )
      .join('')}</section>`
  }).join('')
  const tablaUso = GRUPOS.map(
    (g) => `<tr><th colspan="3">${NOMBRE_GRUPO[g]}</th></tr>${MUSCULOS_DE_GRUPO[g]
      .map((m) => {
        const u = uso.get(m)!
        return `<tr class="${u.p + u.s === 0 ? 'cero' : ''}"><td>${escapar(INFO_MUSCULO[m].nombre)}${INFO_MUSCULO[m].profundo ? ' <span class="tag">profundo</span>' : ''}</td><td>${u.p}</td><td>${u.s}</td></tr>`
      })
      .join('')}`,
  ).join('')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ejercicios y músculos</title><style>
:root{--bg:#f6f4f1;--fg:#1d1b19;--muted:#6b665f;--line:#ddd7cf;--acc:#e8641c;--acc2:#f6c9ad;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141312;--fg:#efebe6;--muted:#a19a91;--line:#2f2c29;--acc:#ff7a33;--acc2:#5a3320;--card:#1d1b19}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}main{max-width:820px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}h2{font-size:18px;margin:28px 0 6px;border-bottom:2px solid var(--line);padding-bottom:4px}h2 small{font-weight:400;color:var(--muted);font-size:13px}
h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:16px 0 4px}ul{list-style:none;margin:0;padding:0}
li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:6px 0}li b{display:block;margin-bottom:4px}
.m{display:inline-block;border-radius:999px;padding:2px 9px;margin:2px 4px 2px 0;font-size:13px}.m.p{background:var(--acc);color:#fff}.m.s{background:var(--acc2)}.m.prof{outline:2px dashed var(--fg);outline-offset:-2px}
.antes{margin:4px 0 0;color:var(--muted);font-size:12.5px}input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font-size:15px;position:sticky;top:8px}
table{border-collapse:collapse;width:100%;font-size:13.5px}td,th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left}td:nth-child(n+2){text-align:right;width:70px}th{background:var(--line)}tr.cero td{color:var(--muted);font-style:italic}.tag{font-size:11px;border:1px solid var(--muted);border-radius:6px;padding:0 4px}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin:12px 0}.leyenda .m{font-size:12px}
</style></head><body><main>
<h1>Ejercicios y músculos (ronda 4)</h1>
<p>${filas.length} ejercicios de la biblioteca con la división muscular completa. <span class="leyenda"><span class="m p">principal</span> cuenta 1 serie · <span class="m s">secundario</span> cuenta 0,5 · borde de puntos: músculo profundo.</span> Debajo de cada uno, lo que tenía antes.</p>
<details><summary>Cuántos ejercicios trabajan cada músculo</summary><table><tr><th>Músculo</th><th>Principal</th><th>Secundario</th></tr>${tablaUso}</table></details>
<input id="q" type="search" placeholder="Buscar ejercicio, patrón o músculo…" autocomplete="off">
${secciones}
<script>const q=document.getElementById('q');q.addEventListener('input',()=>{const t=q.value.toLowerCase().trim();document.querySelectorAll('li').forEach(li=>{li.style.display=!t||li.dataset.t.includes(t)?'':'none'})})</script>
</main></body></html>`
  writeFileSync(`${salida}/ejercicios-musculos.html`, html)
})
