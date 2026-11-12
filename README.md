# Ferro

Mi app personal de gimnasio para Android. Es una app nativa hecha con **Capacitor** sobre una web React local-first: todos los datos viven en el móvil (IndexedDB dentro de la app), no hay backend ni cuentas y funciona sin conexión.

**Ciclo:** detectar que llego al gimnasio → saber qué rutina toca → registrar el entreno en un toque por serie → sugerir el peso de la próxima vez → enseñar el progreso.

## Stack

Vite + React + TypeScript estricto · Tailwind CSS 4 · Capacitor 8 (Android) · Dexie (IndexedDB) · React Router · Recharts · @dnd-kit · three.js y react-three-fiber (cuerpo 3D) · ML Kit (códigos de barras) · SDK de Anthropic (opcional) · Vitest. En desarrollo, sharp para los iconos. La versión web (vite-plugin-pwa) también se publica en Vercel, sin las funciones nativas.

```
catalogo/          fuente de la biblioteca (Free Exercise DB fijada), traducciones y lista de alimentos genéricos
scripts/           generación del catálogo, del mapa muscular y de los iconos (web y Android)
android/           proyecto Android de Capacitor (Gradle); la web compilada se copia dentro con `npx cap sync`
.github/workflows/ APK firmado y publicado en GitHub Releases
src/
├─ domain/     lógica de negocio pura y sus tests (progresión, ciclo, entradas, mapa muscular, migraciones…)
├─ db/         esquema Dexie y migraciones, sincronización del catálogo, plantillas y operaciones de datos
├─ catalogo/   ejercicios.json generado (407 ejercicios) y alimentos.json (109 alimentos genéricos)
├─ animacion/  figura articulada, patrones de movimiento y animación de cada ejercicio
├─ features/   pantallas: hoy, rutinas, ejercicios, entreno, progreso, ajustes…
├─ components/ piezas de interfaz reutilizables (incluido el mapa muscular)
├─ hooks/      wake lock, temporizador, aviso de fin de descanso…
└─ lib/        formato es-ES, ids, vibración, archivos, integración nativa, actualizaciones
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

## Biblioteca de ejercicios

La biblioteca sale de [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (dominio público), fijada a un commit en `catalogo/fuente/`, filtrada a peso libre, poleas y multipower, más los ejercicios de polea de `catalogo/extra.json` y los propios de `catalogo/propios.json`. El listado para revisar está en `catalogo/LISTADO-BIBLIOTECA.md`. Las traducciones se hicieron una sola vez y viven en el repositorio:

- `catalogo/nombres-*.tsv`: nombre en español de cada ejercicio (el inglés queda como alias; las reglas de las animaciones lo usan).
- `catalogo/instrucciones-*.txt`: pasos en español, en bloques `@Id_Del_Ejercicio` + líneas `- paso`.

```bash
npm run catalogo    # regenera src/catalogo/ejercicios.json y el listado
```

Al arrancar, la app compara la versión del catálogo con la guardada y, si cambió, actualiza los ejercicios de la biblioteca sin tocar tus notas ni tus ejercicios propios. El **avatar muscular** nuevo parte de la figura de [Open Muscle Map](https://github.com/PerspicaciousGuy/Open-Muscle-Map) (MIT, fijada en `catalogo/fuente/avatar/`); `node scripts/generar-avatar.mjs` la convierte en `src/components/avatar/trazados.ts`, divide el pectoral en porción superior e inferior y calcula las fibras de cada músculo. El **avatar 3D** (`src/components/avatar3d`) se genera en el móvil a partir de esa misma figura: se rasteriza la silueta, se infla según la distancia a su borde (miembros redondos, tronco más plano), cada músculo sobresale con un surco en su contorno y la espalda lleva los músculos de la vista trasera. Se dibuja con three.js, se gira arrastrando con el dedo y un toque elige el músculo. Vista previa para revisarlo en `/vista-previa/avatar`. Créditos completos en **Ajustes → Créditos y licencias** (`/ajustes/creditos`, con los textos en `/licencias.txt`).

### Cuerpo 3D (ronda 3)

El cuerpo 3D (`public/modelos/cuerpo.glb`) sale de [Z-Anatomy](https://github.com/Z-Anatomy/The-blend) (CC BY-SA 4.0, basado en BodyParts3D) con un script de Blender. Para regenerarlo:

1. Descarga **Blender 4.5 LTS** portable (zip) de https://www.blender.org/download/lts/ y descomprímelo.
2. Descarga `Z-Anatomy.zip` del repositorio Z-Anatomy/The-blend y saca `Z-Anatomy/Startup.blend` (unos 300 MB).
3. Ejecuta (no hace falta abrir Blender; `--disable-autoexec` evita los scripts que trae el .blend):

```bash
blender --background --factory-startup --disable-autoexec Startup.blend --python scripts/blender/generar-cuerpo.py -- public/modelos/cuerpo.glb
```

Tarda unos 8 minutos. Con `FERRO_CACHE=algo.blend` guarda el cuerpo ya simplificado y las siguientes veces solo repite las regiones y la exportación (si cambias el volumen, `INFLAR_REGION`, borra la caché). Para las animaciones añade `FERRO_RIG=public/modelos/cuerpo-rig.glb` (el cuerpo con esqueleto) y `FERRO_PUNTOS=src/animacion3d/superficie.json` (los puntos de la superficie con los que se comprueba que el cuerpo no atraviesa bancos ni cajones). El modelo resultante se distribuye con la misma licencia CC BY-SA 4.0 (créditos en **Ajustes → Créditos y licencias**). El visor está en `src/components/cuerpo3d` (three.js + react-three-fiber) y se revisa en **Ajustes → Vista previa del cuerpo 3D**.

### División muscular (ronda 4)

Los músculos están en `src/domain/tipos.ts` (`MUSCULOS`, 48: el orden es el de las regiones del modelo 3D, así que solo se añaden al final) y su organización —grupo → músculo → porción, nombres, cuáles son profundos y qué tienen encima— en `src/domain/musculos.ts`. Los músculos de cada ejercicio de la biblioteca están en `catalogo/musculos-r4.json`, que `npm run catalogo` aplica al generar el catálogo. Salen de las reglas por tipo de movimiento de `src/domain/reasignacion.ts` (las mismas que convierten los ejercicios propios al actualizar la app y las copias de seguridad antiguas). Para cambiarlos:

1. Retoca las reglas de `reasignacion.ts` (o, para un ejercicio suelto, su entrada en `catalogo/musculos-r4.json` y salta al paso 4).
2. Borra `catalogo/musculos-r4.json` y ejecuta `npm run catalogo` (el catálogo vuelve a las zonas de antes).
3. `GENERAR_REVISION=revision/r4-musculos npx vitest run scripts/musculos/generar-revision.test.ts` vuelve a crear `catalogo/musculos-r4.json` y un listado para revisar (`revision/r4-musculos/ejercicios-musculos.html`).
4. `npm run catalogo` otra vez.

Si se añade un músculo, hay que darle región en `scripts/blender/generar-cuerpo.py` (lista `REGIONES` y diccionario `MUSCULOS`) y regenerar el cuerpo; los tests comprueban que el modelo y la app tienen los mismos músculos, en el mismo orden, y que cada uno tiene superficie.

### Avatar personalizado (ronda 4)

El avatar (`public/modelos/avatar.glb`, `avatar.json` y sus dos texturas) es el cuerpo paramétrico de [MakeHuman/MPFB2](https://github.com/makehumancommunity/mpfb2) (sus datos son CC0) con las regiones musculares y el relieve del cuerpo de Z-Anatomy. Para regenerarlo (después de `cuerpo-rig.glb`, del que toma las regiones y la postura):

1. Descarga `mpfb2-2.0.18.zip` de las *releases* de MPFB2 y descomprímelo (solo se usan los datos de `src/mpfb/data`; no se instala ni se ejecuta MPFB).
2. Ejecuta:

```bash
blender --background --factory-startup --python scripts/blender/generar-avatar.py -- <mpfb2>/src/mpfb/data public/modelos
```

Con `FERRO_CACHE_AVATAR=<carpeta>` guarda los pasos lentos (el ajuste sobre Z-Anatomy, el horneado y la oclusión: unos 10 minutos la primera vez) y las siguientes tarda segundos; borra la carpeta si cambias el cuerpo de Z-Anatomy. `FERRO_ETAPA=esquinas` o `transferencia` (con una tercera ruta como prefijo de capturas) dibuja formas de muestra o las regiones transferidas, para revisarlas. En la app, `src/avatar3d` lee el GLB (`glb.ts`, `modelo.ts`), mezcla las formas y recalcula el esqueleto (`forma.ts`), mide como una cinta (`medidas.ts`) y pasa del perfil corporal a la forma (`resolver.ts`); los datos del perfil están en `src/domain/cuerpo.ts` y la pantalla en `src/features/cuerpo`.

### Animaciones 3D

Todos los ejercicios tienen animación 3D sobre el mismo cuerpo del avatar (con esqueleto: `public/modelos/cuerpo-rig.glb`, que se genera con el mismo comando añadiendo `FERRO_RIG=public/modelos/cuerpo-rig.glb`). Cada ejercicio son datos —poses clave de una repetición con su tempo—, nunca vídeos: los 10 del piloto están hechos a mano en `src/animacion3d/ejercicios.ts` y el resto salen de las poses 2D de cada ejercicio (`src/animacion3d/desde2d.ts`), así que si una animación 2D se corrige en `asignacion.ts` o `patrones.ts`, la 3D se corrige con ella. La cinemática inversa coloca brazos y piernas, y el material de gimnasio está modelado en `src/animacion3d/material.ts`. Bancos, atriles y cajones se colocan solos contra el cuerpo real (que lo que se apoya los toque sin atravesarlos) y el material va siempre en las manos; los tests lo comprueban en toda la biblioteca. Se ven en su ficha (escena en vivo, que se gira) y en las listas (miniatura animada, generada una vez en el móvil y guardada aparte de los datos), y todos en **Ajustes → Animaciones 3D**, agrupados por patrón (`?revision=grande&ver=nombre` enseña fotogramas grandes de los que se quieran mirar de cerca). Sin WebGL se ve la animación 2D.

### Animaciones de los ejercicios

No hay ninguna foto: cada ejercicio se dibuja con un sistema de animación propio (`src/animacion/`), en el mismo gris que el avatar y con los músculos principales en naranja. Una figura vectorial articulada (sin cara) se mueve con cinemática inversa entre poses clave que generan unos patrones reutilizables (press, remo, curl, sentadilla, bisagra, zancada, jalón…), con el material dibujado: barra con discos, mancuernas, polea con su cable, multipower con sus guías, landmine y bancos con su inclinación. Las reglas de `asignacion.ts` eligen el patrón y sus parámetros para cada ejercicio; si un ejercicio sale raro, se corrige ahí o en `patrones.ts`. Todo va en el código (unos 21 kB comprimidos), así que funciona sin conexión.

Para revisarlas todas: **Ajustes → Galería de animaciones** (`/vista-previa/animaciones`), por patrón o por nombre.

## Pasar de la PWA a la app Android (una sola vez)

La app Android guarda los datos en otro sitio que la PWA, así que **no se pasan solos**: se exportan desde la PWA y se importan en la app.

1. En la **PWA** (la Ferro instalada desde Chrome): **Ajustes → Datos y copias de seguridad → Exportar copia (JSON)**. Se guarda en *Descargas* como `ferro-copia-AAAA-MM-DD.json`. Hazlo justo antes de instalar el APK: lo que registres en la PWA después no se pasará.
2. Instala el APK (siguiente apartado) y ábrelo.
3. En la **app**: **Ajustes → Datos y copias de seguridad → Importar copia…**, elige el archivo de *Descargas* y confirma **Restaurar**. Se importan rutinas, entrenos, series, notas, molestias, peso corporal, entradas y ajustes. Las copias antiguas se migran solas al formato actual.
4. Comprueba que están tus rutinas y tu historial. Cuando lo veas todo, puedes desinstalar la PWA (mantén pulsado su icono → Desinstalar).

La web de Vercel (https://ferro-kappa-rosy.vercel.app) se publica con la misma versión que el APK, para verla en el navegador. Ahí no funciona lo que depende del móvil (detección del gimnasio, pasos de Health Connect, aviso de descanso con la pantalla apagada, actualizaciones), pero la exportación de datos sigue estando en Ajustes. Para publicarla: `vercel deploy --prod` (`.vercelignore` deja fuera el proyecto Android).

La web pide **contraseña** (el navegador muestra su ventana de usuario y contraseña; el usuario da igual). No es la protección de pago de Vercel: la pide `middleware.ts` y la contraseña está guardada como variable secreta `FERRO_CLAVE` en el proyecto de Vercel, nunca en el código. Para cambiarla:

```bash
vercel env rm FERRO_CLAVE production
vercel env add FERRO_CLAVE production --sensitive
vercel deploy --prod
```

Si la variable falta, la web no se abre a nadie. La app Android no se ve afectada: lleva la web dentro.

Para que la contraseña se pida siempre, la web de Vercel **no guarda copia sin conexión**: al compilar en Vercel se genera un service worker que borra el antiguo y su caché (`selfDestroying` en `vite.config.ts`), y `/sw.js` es lo único que se sirve sin contraseña. En un navegador o un móvil que ya tenía la web guardada, la primera vez puede abrirse la copia antigua; se borra sola y, al recargar, pide la contraseña.

## Instalar el APK en el Xiaomi (HyperOS)

1. En el móvil, abre la página de **Releases** del repositorio (https://github.com/ARNAIN123/ferro/releases) y descarga `ferro-X.Y.Z.apk` de la última versión (o, ya con Ferro instalada, **Ajustes → Actualizaciones → Buscar actualizaciones**).
2. Toca el archivo descargado. La primera vez Android pide permiso para **instalar apps desconocidas** desde Chrome (o desde *Archivos*): actívalo y vuelve atrás.
3. HyperOS muestra sus avisos de seguridad ("app no verificada", "no viene de Google Play"). Pulsa **Continuar / Instalar de todos modos**. Si aparece el análisis de seguridad de Xiaomi, espera a que termine y acepta. Si HyperOS sigue bloqueándola, desactiva un momento la protección de instalación en **Ajustes → Privacidad y seguridad → Protección** (el nombre exacto cambia entre versiones) y vuelve a activarla después.
4. Abre Ferro y acepta las **notificaciones** (son para el aviso de fin de descanso).

Ferro necesita Android 8 o posterior (lo exige Health Connect).

### Ajustes de HyperOS que necesita Ferro

HyperOS cierra las apps en segundo plano con mucha agresividad. Para que el descanso avise con la pantalla apagada y para detectar la entrada y la salida del gimnasio:

- **Inicio automático**: Ajustes → Aplicaciones → Gestionar aplicaciones → Ferro → **Inicio automático: activado**.
- **Ahorro de batería**: en esa misma pantalla → Ahorro de batería → **Sin restricciones**.
- **Notificaciones**: permitidas, con el canal **"Fin del descanso"** con sonido y vibración.
- **Ubicación**: **Permitir todo el tiempo** (la usa la detección del gimnasio con Ferro cerrada).
- **Health Connect**: en Ferro, **Ajustes → Pasos y calorías → Conectar** y concede **Pasos** y **Peso** (no pide nada más).
- Opcional: en la multitarea, mantén pulsada la tarjeta de Ferro y toca el **candado** para que no se cierre al limpiar.

## Actualizar la app

En **Ajustes → Actualizaciones → Buscar actualizaciones**, Ferro mira la última versión publicada en GitHub. Si hay una nueva, **Descargar APK** la abre en Chrome; al terminar, toca el archivo y pulsa **Actualizar**. Se instala encima y **conserva todos los datos** (la base de datos se migra sola si cambia de versión).

Solo se puede instalar encima un APK firmado con **la misma clave**. Si Android dice que el paquete "entra en conflicto", el APK está firmado con otra clave: no desinstales sin exportar antes una copia, o perderás los datos.

## Publicar una versión (GitHub Actions)

Repositorio: https://github.com/ARNAIN123/ferro (público). Está conectado con Vercel: cada push a `main` publica también la web automáticamente.

El workflow `.github/workflows/apk.yml` compila la web, pasa los tests (web y nativos), genera el APK de release **firmado** y lo publica en **GitHub Releases** con la etiqueta `vX.Y.Z`. Se ejecuta en cada push a `main`, pero solo publica si la versión de `package.json` todavía no tiene release:

```bash
npm version patch --no-git-tag-version   # 0.3.0 → 0.3.1 (o minor/major)
git commit -am "Versión 0.3.1"
git push
```

El `versionCode` de Android se calcula de la versión (`0.3.1` → 301), así que siempre sube.

### Clave de firma (una sola vez)

**Ya está hecho (6 de noviembre de 2026):** la clave está en `android/ferro.jks` y su contraseña en `android/keystore.properties`, solo en este ordenador (la carpeta se sincroniza con OneDrive). Git los ignora, así que nunca se suben. Los cuatro secretos de abajo ya están en GitHub. **Haz una copia de esos dos archivos en otro sitio** (un pendrive o tu gestor de contraseñas): si se pierden, las versiones nuevas no se podrán instalar encima. Lo que sigue explica cómo se hizo, por si alguna vez hay que repetirlo.

Android solo deja instalar una actualización encima si está firmada con la misma clave que la versión instalada. Crea la clave **una vez** y guárdala bien: si la pierdes, la siguiente versión no se podrá instalar encima.

1. Crea el almacén de claves con `keytool` (viene con Java; con Android Studio está en `Android Studio\jbr\bin`):

   ```bash
   keytool -genkeypair -v -keystore ferro.jks -alias ferro -keyalg RSA -keysize 4096 -validity 36500
   ```

   Te pide una contraseña para el almacén y tus datos (puedes dejarlos en blanco). Si te pide otra para la clave, usa la misma.
2. Guarda `ferro.jks` y la contraseña en un sitio seguro (gestor de contraseñas y una copia en la nube). **Nunca** lo subas al repositorio (`.gitignore` ya lo excluye).
3. Conviértelo a base64 para guardarlo como secreto. En Git Bash: `base64 -w0 ferro.jks > ferro.jks.base64`. En PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ferro.jks")) | Set-Content ferro.jks.base64`.
4. En GitHub: repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea estos cuatro:

   | Secreto | Valor |
   |---|---|
   | `FERRO_KEYSTORE_BASE64` | el contenido de `ferro.jks.base64` |
   | `FERRO_KEYSTORE_PASSWORD` | la contraseña del almacén |
   | `FERRO_KEY_ALIAS` | `ferro` |
   | `FERRO_KEY_PASSWORD` | la contraseña de la clave |

5. Borra `ferro.jks.base64`. En **Actions** lanza el workflow **APK de Android** (botón *Run workflow*) o haz un push con una versión nueva.

El repositorio tiene que ser **público**: así la app puede leer las Releases sin contraseñas. En el repositorio solo hay código; tus datos nunca salen del móvil.

## Compilar en local (Android Studio)

1. Instala **Android Studio** (trae el SDK de Android y Java 21).
2. En la carpeta del proyecto:

   ```bash
   npm install
   npm run build        # compila la web en dist/
   npx cap sync android # la copia dentro del proyecto Android
   npx cap open android # abre el proyecto en Android Studio
   ```

3. Con el móvil conectado por USB (y la **depuración USB** activada en Opciones de desarrollador), pulsa **Run ▶**. Eso instala una versión *debug* firmada con otra clave, que no se puede instalar encima de la de GitHub: pruébala en otro móvil o exporta antes tus datos.
4. Para un APK de release firmado en local, crea `android/keystore.properties` (no se versiona):

   ```properties
   storeFile=C:/ruta/a/ferro.jks
   storePassword=…
   keyAlias=ferro
   keyPassword=…
   ```

   y ejecuta `cd android && ./gradlew assembleRelease`. El APK queda en `android/app/build/outputs/apk/release/`.

Sin Android Studio también vale con el SDK de Android, un JDK 21 en `JAVA_HOME` y `android/local.properties` con `sdk.dir=C:/Users/<tú>/AppData/Local/Android/Sdk`. Los tests nativos se pasan con `./gradlew testDebugUnitTest`.

## Entrada y salida del gimnasio

**La entrada se registra cuando abres S3 FIT ZONE en el móvil estando en el gimnasio.** MacroDroid solo avisa a Ferro; Ferro decide con código nativo (Kotlin) y sin abrirse, porque en ese momento estás enseñando el QR en la puerta.

1. MacroDroid ve que se abre S3 FIT ZONE y manda un *broadcast* explícito a Ferro (`evento=s3_abierta`).
2. Ferro pide la ubicación **en ese momento** (alta precisión, hasta 20 s, y un reintento de 15 s si no llega o es mala). Nada de geovallas pasivas, que en HyperOS fallan.
3. Si estás a menos del **radio** (150 m por defecto; se perdona parte del error del GPS, como mucho 50 m), registra la entrada **con la hora en que abriste S3 FIT ZONE**. Nunca más de una cada 3 h.
4. Opcional: notificación discreta "Entrada registrada · 18:04" (Ajustes → Gimnasio y detección).

Abrir S3 FIT ZONE en casa no registra nada (queda en el registro como "fuera del radio").

**Salida.** Mientras hay una entrada abierta, Ferro comprueba la ubicación cada 12 minutos (4 minutos después de una primera lectura fuera). La salida se confirma con **dos comprobaciones seguidas a más de radio + margen** (150 + 150 = 300 m por defecto) y su hora es la **primera señal**: la desconexión de la WiFi del gimnasio (si tienes la segunda macro) o la primera comprobación fuera. Si había un entreno a medias, se cierra con esa hora. Si no se detecta la salida, el entreno se cierra tras 3 h sin actividad con la hora de la última serie más 5 minutos.

Por qué alarmas exactas y no WorkManager ni un servicio en primer plano: WorkManager no baja de 15 min y HyperOS lo retrasa; un servicio en primer plano lleva una notificación fija y Android no deja arrancarlo desde segundo plano (justo cuando llega el aviso de MacroDroid). Las alarmas exactas se programan desde segundo plano, suenan a su hora incluso en reposo y cada una solo enciende el GPS unos segundos.

**Si empiezas a entrenar sin entrada** (la detección falló), la hora de inicio del entreno cuenta como entrada. Si el aviso llega tarde, la entrada se corrige con la hora real de S3 FIT ZONE.

### Ponerlo en marcha

1. En el gimnasio: **Ajustes → Gimnasio y detección → Estoy en el gimnasio ahora**.
2. En esa misma sección, toca **Activar** en cada permiso que falte: ubicación **"Permitir todo el tiempo"**, notificaciones, alarmas exactas y batería sin restricciones (más los ajustes de HyperOS del apartado de instalación).
3. Crea las macros de MacroDroid (abajo). En Ajustes → Gimnasio y detección → **Datos para MacroDroid** puedes copiar el paquete, la clase y la acción.
4. Prueba con **"Probar: como si abriera S3 FIT ZONE"** y mira el resultado en **Registro de detección**: hora, evento, distancia, precisión y decisión (registrada, fuera del radio, imprecisa, duplicada, salida confirmada…). Sirve para ajustar el radio.

## MacroDroid

En las dos macros la acción es **Aplicaciones → Enviar intent** (*Send Intent*) con estos datos:

| Campo | Valor |
|---|---|
| Destino (*Target*) | **Broadcast** |
| Acción (*Action*) | `com.ferro.app.AVISO` |
| Paquete (*Package*) | `com.ferro.app` |
| Clase (*Class*) | `com.ferro.app.deteccion.AvisoReceiver` |
| Extra 1 | `evento` = el de cada macro |
| Extra 2 (opcional) | `hora` = `{system_time}` (milisegundos o segundos; si falta, vale la hora a la que llega) |

El paquete y la clase son obligatorios: Android 8+ no entrega *broadcasts* implícitos a apps cerradas, así que el intent tiene que ser **explícito**.

**Macro 1 · "Ferro: entrada"**

- **Disparador** → Aplicaciones → **Aplicación iniciada/cerrada** → *Iniciada* → **S3 FIT ZONE**.
- **Acción** → Enviar intent (tabla de arriba) con `evento` = `s3_abierta`.
- Sin restricciones: Ferro ya descarta duplicados y aperturas fuera del gimnasio.

**Macro 2 · "Ferro: salida por WiFi"** (opcional, si tu móvil usa la WiFi del gimnasio)

- **Disparador** → Conectividad → **Cambio de estado WiFi** → *Desconectado de la red* → la red del gimnasio (SSID).
- **Acción** → Enviar intent con `evento` = `wifi_desconectada`.

Pruébalas con el botón ▶ de cada macro estando en el gimnasio (o fuera, para ver el "fuera del radio") y revisa el Registro de detección.

## Rutinas, entreno libre y mapa muscular

- **Crear una rutina**: Rutinas → **+**. Nombre → **Añadir ejercicios**: toca un músculo en la figura y marca los ejercicios que quieras (selección múltiple; arriba los de **Principal**, debajo **También lo trabajan**) → ajusta series, repeticiones y descanso con +/− → **Guardar rutina**. Debajo se ve en vivo el mapa de músculos que cubre y un aviso si a tu ciclo le falta algún grupo grande.
- **Entreno libre**: en Hoy, junto a "Empezar". Añades ejercicios sobre la marcha; al terminar puedes **Guardar como rutina**. No cambia la rutina que te toca.
- **Peso exacto**: mantén pulsado el número del peso para escribirlo con el teclado. Los botones +/− suben según el material: barras y discos 2,5 kg, mancuernas 2 kg, poleas y multipower 5 kg.
- **Fin del descanso**: en la app Android, al terminar el descanso llega una notificación con sonido y vibración aunque Ferro esté en segundo plano o con la pantalla apagada (usa una alarma exacta de Android).
- **Mapa muscular**: en el resumen de cada entreno, en Progreso (esta semana, 7 días, 30 días), en la ficha de cada ejercicio y en el editor de rutinas. Toca un músculo para ver sus series y qué ejercicios lo han trabajado.

## Hoy: objetivo del mes, pasos y calorías

La pantalla principal tiene, por este orden: el **objetivo del mes**, tu **semana** en el avatar, los **pasos y las calorías** y los botones para empezar.

- **Objetivo mensual** (por defecto 16 días; se cambia en Ajustes → Entreno). Cuenta un día si hay una entrada registrada o un entreno terminado. La tarjeta te dice cuántos días te puedes saltar y seguir cumpliéndolo. En **Progreso** está el historial de meses cumplidos y no cumplidos.
- **Avatar de la semana**: de lunes a domingo, con niveles de 1–3, 4–6, 7–10, 11–15 y 16+ series. Gíralo con el dedo para ver la espalda y toca un músculo para ver sus series y ejercicios.
- **Pasos**: los lee de **Health Connect**, el almacén de salud de Android. Ferro no cuenta pasos por sí misma: los escribe en Health Connect otra app. En el Xiaomi puede ser **Mi Fitness** (con o sin pulsera), **Google Health / Fit** o el propio podómetro del móvil. Para comprobar que llegan:
  1. Abre **Health Connect** (Ajustes de Android → Privacidad → Health Connect, o desde Ferro: Ajustes → Pasos y calorías → Abrir Health Connect).
  2. En **Permisos de apps**, comprueba que Mi Fitness (o la app que uses) tiene permiso para **escribir** pasos y que Ferro tiene permiso para **leer** pasos y peso.
  3. En **Datos y acceso → Actividad → Pasos** deberías ver los pasos de hoy. Si salen ahí, Ferro los verá (se actualizan al abrir la app, al volver a ella y cada 5 minutos).
  4. Si tienes varias apps escribiendo pasos, en **Prioridad de las apps** pon primero la más fiable: Health Connect junta las fuentes sin contar dos veces el mismo paso, y Ferro pide ese total.
- **Calorías** (≈, siempre una estimación de lo gastado por encima del reposo). Necesitan tu **peso** (el último que apuntes en Ferro o, si no hay, el de Health Connect) y tu **altura** (Ajustes → Pasos y calorías). Al tocarlas se ve el desglose y cómo se calcula:
  - **Caminar**: distancia = pasos × 0,414 × altura; coste = 0,5 kcal por kg y km (ecuación del ACSM para caminar en llano, sin el gasto de reposo).
  - **Entreno**: MET del entrenamiento de fuerza entre 3,5 y 6 (Compendium of Physical Activities) según lo densa que fue la sesión (series por minuto, tiempo entre series y kilos por minuto); calorías = (MET − 1) × peso × horas, de la entrada a la salida.
  - Los pasos que das durante el entreno se restan de los del día para no contarlos dos veces.
- **Registrar peso** (Hoy, Progreso → Peso o mantener pulsado el icono de Ferro → *Registrar peso*): se abre ya en tu último peso; arrastra la regla (un lanzamiento rápido salta varios kilos), usa ±0,1/±1 (mantén pulsado para ir más rápido) o toca el número para escribirlo, y **Guardar**. El chip de la fecha sirve para apuntar un día anterior.
- **Báscula**: si tu báscula (por ejemplo con Mi Fitness o Zepp Life) escribe el peso en Health Connect y Ferro tiene permiso de **Peso**, al abrir la app se importan solas las mediciones de los últimos 30 días, una por día. Lo que apuntes a mano nunca se sobrescribe; en el historial lo importado lleva la etiqueta *Báscula*.
- En la web (navegador) no hay Health Connect: el anillo de pasos sale vacío y las calorías solo cuentan el entreno.

## Nutrición

Pestaña **Nutrición**. La primera vez, un asistente de un minuto (sexo, edad, altura, peso, objetivo y ritmo) calcula tu gasto con **Mifflin-St Jeor + tus pasos y entrenos reales + la digestión** y te da un objetivo de calorías y macros (proteína 2 g/kg por defecto, editable entre 1,6 y 2,2). Nunca baja de tu metabolismo basal y el ritmo nunca pasa del 1 % del peso por semana.

- **Cada lunes** se recalcula solo: con lo que registraste y la tendencia de tu peso (media de 7 días) calcula tu gasto real y mueve el objetivo como mucho 150 kcal. Las dos primeras semanas se usa la estimación. Para que funcione hacen falta al menos 10 días con comidas registradas de los últimos 14 y unos 3 pesos por semana. La revisión sale arriba en Nutrición y el historial en **Tu objetivo** (icono de ajustes).
- **Días de entreno**: algo más de hidratos y algo menos los de descanso (la semana suma lo mismo). Cuenta como día de entreno si entrenaste o se detectó tu entrada al gimnasio; si no, toca el chip *Día de descanso* para cambiarlo.
- **Añadir comida**: toca **+** en la comida. Arriba salen tus recientes para esa comida y esa hora (el **+** de la derecha la añade igual que la última vez), *Repetir … de ayer* y **Mis platos**. Si no está, busca por texto (base genérica en español, con **crudo** o **cocinado** indicado) o pulsa el icono del **código de barras** para escanearlo (Open Food Facts; la primera vez Android descarga el escáner de Google). Ajusta los gramos con la regla o con las raciones.
- Los **tres puntos** de cada comida: guardarla como plato o copiarla de otro día.
- **Cerrar el día**: combinaciones de tus alimentos habituales que encajan con lo que te queda.
- **Reto de fruta y verdura** (desactivable en Tu objetivo): una propuesta a la semana con una forma fácil de tomarla. "Me gusta" la deja a mano al añadir comida; "No me gusta" no vuelve a salir.
- **IA opcional**: en Ajustes → Nutrición puedes poner tu clave de la API de Anthropic (console.anthropic.com → API Keys; cada uso lo cobra Anthropic). Entonces aparece el botón ✦ al añadir comida: escribe «200 g de pollo con 80 g de arroz», revisa lo que propone y añádelo. La clave solo se guarda en el móvil y no va en las copias de seguridad. Usa el modelo Claude Opus 5.5 con respaldo automático del servidor (si ese modelo no estuviera disponible, la API responde con otro equivalente).
- En **Hoy** verás «Te quedan … kcal · … g de proteína».

Los alimentos genéricos salen de USDA FoodData Central (dominio público): la lista con nombres, estado y raciones está en `catalogo/alimentos/lista.json` y se regenera con `node scripts/generar-alimentos.mjs <ruta al JSON de SR Legacy>` (el listado para revisar queda en `catalogo/alimentos/LISTADO-ALIMENTOS.md`). Créditos y licencias de todo en **Ajustes → Créditos y licencias**.

## Copias de seguridad

Los datos viven solo en el móvil, así que conviene sacar copias. En **Ajustes → Datos y copias de seguridad**:

- **Exportar copia (JSON)**: todo (ejercicios, rutinas, entrenos, series, entradas, peso, ajustes y nutrición: alimentos, comidas, platos, agua y objetivo). En la app Android se guarda en **Documentos/Ferro** (en la PWA, en *Descargas*). Con **Enviar copia a Drive, correo…** la mandas a otra app.
- **Exportar series (CSV)**: una fila por serie (fecha, rutina, ejercicio, músculo, tipo, peso, reps, RIR, molestia), separado por punto y coma y con coma decimal para abrirlo en Excel o Google Sheets.
- **Importar copia**: valida el archivo y te pide confirmación antes de **sustituir** todos los datos del móvil. Las copias de versiones anteriores se migran al formato actual al importarlas.
- Desinstalar la app borra sus datos; actualizarla con un APK nuevo, no.

Si llevas más de 2 semanas sin hacer copia, Hoy muestra un recordatorio discreto.

## Calidad

- `npm run build`: comprobación de tipos estricta + build sin avisos.
- `npm test`: tests de la lógica pura de la web (progresión, ciclo de rutinas, entradas y eventos de la detección, cierre automático, semanas, **objetivo mensual**, **calorías**, **animaciones** (cinemática, todos los ejercicios con su patrón y escenas válidas), estadísticas, récords, prerrellenado, superseries, copias de seguridad e importación con migración, actualizaciones, intensidad y mapa muscular, biblioteca y migraciones de la base de datos, **nutrición**: gasto inicial, recalibración semanal, macros, límites de seguridad, "Cerrar el día", registro de comidas y validación de la IA).
- `cd android && ./gradlew testDebugUnitTest`: tests nativos de la decisión de entrada y salida (distancia, precisión, deduplicación, confirmación de la salida y hora del aviso). GitHub Actions los pasa antes de publicar cada APK.
