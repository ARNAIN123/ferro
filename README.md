# Ferro

Mi app personal de gimnasio. Es una PWA local-first: todos los datos viven en el móvil (IndexedDB), no hay backend ni cuentas y funciona sin conexión.

**Ciclo:** detectar que llego al gimnasio → saber qué rutina toca → registrar el entreno en un toque por serie → sugerir el peso de la próxima vez → enseñar el progreso.

## Stack

Vite + React + TypeScript estricto · Tailwind CSS 4 · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) · React Router · Recharts · @dnd-kit · Vitest.

```
src/
├─ domain/     lógica de negocio pura y sus tests (progresión, ciclo, check-in, estadísticas…)
├─ db/         esquema Dexie, biblioteca de ejercicios, plantillas y operaciones de datos
├─ features/   pantallas: hoy, rutinas, ejercicios, entreno, progreso, ajustes…
├─ components/ piezas de interfaz reutilizables
├─ hooks/      wake lock, temporizador, check-in al volver a primer plano…
└─ lib/        formato es-ES, ids, vibración, copias de seguridad
```

## Ejecutar en local

Necesitas Node 20 o superior.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la lógica de negocio
npm run build      # comprobación de tipos + build de producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173 (con service worker)
```

Para probar en el móvil antes de desplegar: `npm run dev -- --host` y abre la IP del ordenador desde el móvil (misma WiFi). Sin HTTPS no se puede instalar ni funciona la ubicación, así que para todo lo demás usa la versión desplegada.

Los iconos se generan desde un SVG con `npm run icons` (los PNG ya están en `public/`).

## Desplegar (Vercel)

La app se despliega como sitio estático en Vercel (gratis y con HTTPS, imprescindible para instalar la PWA). `vercel.json` ya incluye la reescritura para que rutas como `/checkin` sirvan la app.

```bash
npx vercel login        # solo la primera vez
npx vercel --prod       # build + despliegue a producción
```

La URL de producción es la que imprime el comando (del tipo `https://ferro-xxxx.vercel.app`). Si conectas el repositorio a Vercel desde su web, cada `git push` desplegará solo.

## Instalarla en el Xiaomi (HyperOS + Chrome)

> **Aviso importante:** en HyperOS, Chrome necesita tener activado el permiso **"Accesos directos en pantalla de inicio"**. Si no, la instalación puede fallar sin avisar (Chrome dice que la ha instalado pero el icono nunca aparece).
>
> Actívalo en **Ajustes → Aplicaciones → Gestionar aplicaciones → Chrome → Otros permisos → Accesos directos en pantalla de inicio → Permitir**.

1. Abre la URL de producción en **Chrome**.
2. Menú ⋮ → **Instalar aplicación** (o "Añadir a pantalla de inicio" → **Instalar**).
3. Confirma. Aparece el icono de Ferro en la pantalla de inicio; al abrirlo va a pantalla completa, sin barra del navegador.
4. Abre la app una vez con conexión para que se descargue todo; a partir de ahí funciona en modo avión.
5. Recomendado: en **Ajustes → Batería → Chrome**, pon "Sin restricciones" para que HyperOS no cierre la app en mitad del entreno.

Cuando haya una versión nueva, la app muestra un aviso "Hay una versión nueva de Ferro · Actualizar". Nunca se actualiza sola en mitad de un entreno.
