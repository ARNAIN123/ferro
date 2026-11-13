// Contornos de los grupos alisados, horneados en el canal azul de public/modelos/avatar-regiones.png
// (ronda 5). Calcularlos al cargar costaba casi medio segundo (más en el móvil); así no cuesta nada.
// Este test comprueba que lo horneado está al día con GRUPO_DE_REGION y RADIO_CONTORNO; si cambian:
//   ALISAR=1 npx vitest run scripts/alisar-regiones.test.ts
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { alisarContornos, RADIO_CONTORNO } from '../src/avatar3d/mapaColor'

const REGIONES = 'public/modelos/avatar-regiones.png'
const RELIEVE = 'public/modelos/avatar-relieve.png'

it('los contornos alisados del mapa de regiones están horneados y al día', async () => {
  const ids = await sharp(REGIONES).raw().toBuffer({ resolveWithObject: true })
  const relieve = await sharp(RELIEVE).raw().toBuffer({ resolveWithObject: true })
  const grande = ids.info.width
  const lado = relieve.info.width
  const k = grande / lado
  // Como en la app (texturas.ts): las regiones a la resolución del relieve, eligiendo un texel de cada
  // bloque, y hay piel donde hay región o donde la oclusión horneada no es 0.
  const region = new Uint8Array(lado * lado)
  const dentro = new Uint8Array(lado * lado)
  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      const i = y * lado + x
      region[i] = ids.data[((y * k) * grande + x * k) * ids.info.channels]!
      dentro[i] = region[i]! > 0 || relieve.data[i * relieve.info.channels + 2]! > 0 ? 1 : 0
    }
  // El radio está pensado para el mapa de color (512): a esta resolución, en proporción.
  const alisado = alisarContornos(region, dentro, lado, Math.round((RADIO_CONTORNO * lado) / 512))
  const datos = Buffer.from(ids.data)
  let distintos = 0
  for (let y = 0; y < grande; y++)
    for (let x = 0; x < grande; x++) {
      const j = (y * grande + x) * ids.info.channels + 2
      const v = alisado[Math.floor(y / k) * lado + Math.floor(x / k)]!
      if (datos[j] !== v) distintos++
      datos[j] = v
    }
  if (process.env.ALISAR) {
    await sharp(datos, { raw: { width: grande, height: grande, channels: ids.info.channels } }).png({ compressionLevel: 9 }).toFile(REGIONES)
    return
  }
  expect(distintos, 'vuelve a hornear con ALISAR=1').toBe(0)
}, 60000)
