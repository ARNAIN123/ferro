// Genera los iconos PNG de la PWA a partir de un SVG original.
// Uso: npm run icons   (los PNG resultantes se versionan en /public)
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

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

function png(nombre, codigo, tamano) {
  const r = new Resvg(codigo, { fitTo: { mode: 'width', value: tamano } })
  writeFileSync(publicDir + nombre, r.render().asPng())
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
