// Genera los iconos PNG de la PWA y de la app Android a partir de un SVG original.
// Uso: npm run icons   (los PNG resultantes se versionan en /public y en android/app/src/main/res)
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const resDir = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url))

const FONDO = '#11100e'

// Una "F" cuyos brazos son barras con discos: Ferro.
const glifo = `
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="88" x2="0" y2="396">
      <stop offset="0" stop-color="#ff8a3d"/>
      <stop offset="1" stop-color="#ff5414"/>
    </linearGradient>
  </defs>
  <g fill="url(#g)" transform="translate(-14 14)">
    <rect x="170" y="116" width="66" height="280" rx="12"/>
    <rect x="170" y="116" width="170" height="62" rx="12"/>
    <rect x="330" y="88" width="40" height="118" rx="10"/>
    <rect x="170" y="236" width="118" height="56" rx="12"/>
    <rect x="280" y="214" width="34" height="100" rx="9"/>
  </g>`

const svg = ({ redondeado, escala = 1, transparente = false }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${transparente ? '' : `<rect width="512" height="512" rx="${redondeado ? 112 : 0}" fill="${FONDO}"/>`}
  <g transform="translate(256 256) scale(${escala}) translate(-256 -256)">${glifo}</g>
</svg>`

function png(nombre, codigo, tamano, dir = publicDir) {
  const r = new Resvg(codigo, { fitTo: { mode: 'width', value: tamano } })
  mkdirSync(dir + nombre.replace(/[^/]*$/, ''), { recursive: true })
  writeFileSync(dir + nombre, r.render().asPng())
  console.log('✓', nombre)
}

const normal = svg({ redondeado: true })
const completo = svg({ redondeado: false, escala: 0.78 })

writeFileSync(publicDir + 'icon.svg', normal.trim() + '\n')
writeFileSync(publicDir + 'favicon.svg', normal.trim() + '\n')
png('pwa-192.png', normal, 192)
png('pwa-512.png', normal, 512)
png('maskable-512.png', completo, 512)
png('apple-touch-icon.png', svg({ redondeado: false, escala: 0.85 }), 180)

// Iconos de los accesos directos (mantener pulsado el icono de la app).
const atajo = (contenido) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <rect width="96" height="96" rx="48" fill="${FONDO}"/>
  ${contenido}
</svg>`
png('atajo-entreno.png', atajo('<path d="M38 28v40l32-20z" fill="#ff6b1f" stroke="#ff6b1f" stroke-width="6" stroke-linejoin="round"/>'), 96)
png(
  'atajo-peso.png',
  atajo(`<g fill="none" stroke="#ff6b1f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="24" y="24" width="48" height="48" rx="12"/>
    <path d="M36 44a17 17 0 0 1 24 0L48 54"/>
  </g>`),
  96,
)

// App Android: icono clásico, redondo y adaptativo (primer plano transparente sobre el color de fondo).
const redondo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="256" fill="${FONDO}"/>
  <g transform="translate(256 256) scale(0.82) translate(-256 -256)">${glifo}</g>
</svg>`
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, f] of Object.entries(DENSIDADES)) {
  png(`mipmap-${d}/ic_launcher.png`, normal, 48 * f, resDir)
  png(`mipmap-${d}/ic_launcher_round.png`, redondo, 48 * f, resDir)
  // 108 dp con el glifo dentro de la zona segura de 66 dp.
  png(`mipmap-${d}/ic_launcher_foreground.png`, svg({ redondeado: false, escala: 0.6, transparente: true }), 108 * f, resDir)
}
writeFileSync(
  resDir + 'values/ic_launcher_background.xml',
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${FONDO}</color>
</resources>
`,
)
console.log('✓ values/ic_launcher_background.xml')
