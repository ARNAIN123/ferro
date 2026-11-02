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
  // El mayor chunk es el catálogo de 890 ejercicios (JSON, ~95 kB comprimido), que ya se carga
  // bajo demanda y no se puede trocear más; el resto queda muy por debajo.
  build: { chunkSizeWarningLimit: 600 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,txt}'],
        // Las ~1.750 imágenes de ejercicios no se precachean: se guardan al verlas (cache-first)
        // o todas de golpe desde Ajustes, en la caché "ferro-imagenes".
        globIgnores: ['img/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/img/ejercicios/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ferro-imagenes',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
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
