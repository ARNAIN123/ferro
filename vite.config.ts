/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const FONDO = '#11100e'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Los chunks grandes se cargan bajo demanda y no se pueden trocear más: el catálogo de ejercicios
  // (JSON, ~95 kB comprimido) y three.js con el avatar 3D (~175 kB comprimido).
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // La web de Vercel pide contraseña: el manifiesto también tiene que pedirse con ella.
      useCredentials: true,
      // En Vercel no se guarda copia sin conexión: si no, el navegador abriría la copia guardada y
      // no pediría la contraseña. Este service worker borra el antiguo y su caché. (VERCEL=1 solo
      // al compilar en Vercel; la app Android lleva la web dentro y no usa service worker.)
      selfDestroying: process.env.VERCEL === '1',
      manifest: {
        id: '/',
        name: 'Ferro',
        short_name: 'Ferro',
        description: 'Tu registro de gimnasio: rutinas en ciclo, entreno en un toque y progreso.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: FONDO,
        background_color: FONDO,
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Accesos directos al mantener pulsado el icono.
        shortcuts: [
          {
            name: 'Empezar entreno',
            short_name: 'Entrenar',
            description: 'Retoma el entreno en curso o empieza la rutina que toca',
            url: '/empezar',
            icons: [{ src: '/atajo-entreno.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Registrar peso',
            short_name: 'Peso',
            description: 'Apunta tu peso corporal de hoy',
            url: '/peso',
            icons: [{ src: '/atajo-peso.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Sin fotos: las animaciones de los ejercicios se dibujan en el propio código (SVG).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,txt}'],
        navigateFallback: '/index.html',
        // /licencias.txt se abre como texto, no como la app.
        navigateFallbackDenylist: [/\.txt$/],
        cleanupOutdatedCaches: true,
        // Controla la página desde la primera visita (para que funcione offline sin recargar).
        // Las versiones nuevas siguen esperando a que pulses "Actualizar".
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
