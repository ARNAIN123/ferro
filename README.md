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

La URL de producción actual es **https://ferro-kappa-rosy.vercel.app** (la imprime el comando). Si conectas el repositorio a Vercel desde su web, cada `git push` desplegará solo.

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

## Entrada al gimnasio (check-in)

Ferro registra la llegada por tres vías y **nunca guarda más de una entrada cada N horas** (3 por defecto; se cambia en Ajustes → Gimnasio y check-in):

1. **Enlace de check-in**: abrir `https://ferro-kappa-rosy.vercel.app/checkin` (o cualquier ruta con `?checkin=auto`) registra la entrada y abre directamente el entreno que toca. Si ya hay uno en curso, lo retoma.
2. **Ubicación al abrir**: en Ajustes pulsa **"Estoy en el gimnasio ahora"** estando en el gimnasio (guarda las coordenadas) y ajusta el radio (200 m por defecto). Cada vez que Ferro pasa a primer plano dentro del radio, sin una entrada reciente, la registra sola y te ofrece "Empezar".
3. **Manual**: botón **"He llegado al gimnasio"** en Hoy.

Cada entrada guarda la hora y el origen. La salida es cuando pulsas **Terminar entreno**; si no lo haces, la sesión se cierra sola tras 3 h sin actividad, con la hora de la última serie como salida.

**Límites de una PWA** (no hay forma de saltárselos sin una app nativa):

- La ubicación solo se comprueba al abrir o volver a la app; Android no deja a una web vigilarla en segundo plano. Por eso existe el enlace para MacroDroid.
- Ferro solo usa el GPS si ya le diste permiso al guardar la ubicación del gimnasio; nunca lo pide al abrir.
- El cierre automático tras 3 h se aplica la próxima vez que abras la app (el resultado es el mismo: la salida queda en la hora de la última serie).

## MacroDroid: check-in automático al entrar

La idea: al cerrar la app donde enseñas el QR del torno, si estás en la WiFi del gimnasio, MacroDroid abre Ferro con el enlace de check-in.

Crea una macro nueva:

1. **Disparador** → Aplicaciones → **Aplicación iniciada/cerrada** → *Cerrada* → elige la app donde tienes el QR del gimnasio.
2. **Restricciones** (las dos):
   - Conectividad → **Estado de WiFi** → *Conectado a* → la red WiFi del gimnasio (SSID).
   - MacroDroid → **Última ejecución de la macro** → *No se ha ejecutado en los últimos* 3 horas.
     (En inglés: *Macro Last Run Time*.)
3. **Acción** → Aplicaciones → **Abrir sitio web** → `https://ferro-kappa-rosy.vercel.app/checkin`
   (copia el enlace exacto desde Ferro → Ajustes → Gimnasio y check-in).
4. Ponle nombre ("Ferro check-in") y guárdala.

Si la PWA está instalada desde Chrome, Android abre ese enlace directamente en Ferro (sin barra del navegador). Pruébalo una vez a mano con el botón ▶ de la macro.

**Alternativa, si Android abre el enlace en Chrome en vez de en la app instalada:** cambia la acción por Aplicaciones → **Abrir aplicación** → *Ferro*, y deja que la **detección por ubicación** haga el check-in al abrirse (necesitas haber guardado la ubicación del gimnasio y tener el permiso de ubicación concedido para el sitio en Chrome).

## Accesos directos

Mantén pulsado el icono de Ferro en la pantalla de inicio:

- **Empezar entreno**: retoma el entreno en curso o empieza la rutina que toca.
- **Registrar peso**: abre directamente el registro de peso corporal de hoy.

(Si instalaste la app antes de que existieran, desinstálala y vuelve a instalarla para que Android los lea del manifest.)

## Copias de seguridad

Los datos viven solo en el móvil, así que conviene sacar copias. En **Ajustes → Datos y copias de seguridad**:

- **Exportar copia (JSON)**: todo (ejercicios, rutinas, entrenos, series, entradas, peso y ajustes). Se guarda en *Descargas*. Si el móvil lo permite, también puedes **enviarla** a Drive, Telegram, correo…
- **Exportar series (CSV)**: una fila por serie (fecha, rutina, ejercicio, músculo, tipo, peso, reps, RIR, molestia), separado por punto y coma y con coma decimal para abrirlo en Excel o Google Sheets.
- **Importar copia**: valida el archivo y te pide confirmación antes de **sustituir** todos los datos del móvil.

Si llevas más de 2 semanas sin hacer copia, Hoy muestra un recordatorio discreto.

## Calidad

- `npm run build`: comprobación de tipos estricta + build sin avisos.
- `npm test`: 96 tests de la lógica pura (progresión, ciclo de rutinas, deduplicación y geovalla del check-in, semanas y rachas, estadísticas, récords, prerrellenado, superseries, copias de seguridad).
- Lighthouse (móvil, CPU ralentizada): accesibilidad 100, buenas prácticas 100 y SEO 100 en todas las pantallas; rendimiento entre 73 y 93 según la pantalla y la pasada (cada pasada empieza con la base de datos vacía y la tiene que sembrar). Recharts y las pantallas secundarias se cargan bajo demanda; Hoy y el modo entreno van en el arranque.
