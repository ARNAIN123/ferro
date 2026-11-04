# Ferro

Mi app personal de gimnasio para Android. Es una app nativa hecha con **Capacitor** sobre una web React local-first: todos los datos viven en el móvil (IndexedDB dentro de la app), no hay backend ni cuentas y funciona sin conexión.

**Ciclo:** detectar que llego al gimnasio → saber qué rutina toca → registrar el entreno en un toque por serie → sugerir el peso de la próxima vez → enseñar el progreso.

## Stack

Vite + React + TypeScript estricto · Tailwind CSS 4 · Capacitor 8 (Android) · Dexie (IndexedDB) · React Router · Recharts · @dnd-kit · Vitest. En desarrollo, sharp para convertir imágenes. La versión web (vite-plugin-pwa) sigue compilando, pero solo se usa para desarrollar y para exportar los datos de la antigua PWA.

```
catalogo/          fuente de la biblioteca (Free Exercise DB fijada) y traducciones al español
scripts/           generación del catálogo, del mapa muscular y de los iconos (web y Android)
public/img/        imágenes WebP de los ejercicios (posición inicial y final)
android/           proyecto Android de Capacitor (Gradle); la web compilada se copia dentro con `npx cap sync`
.github/workflows/ APK firmado y publicado en GitHub Releases
src/
├─ domain/     lógica de negocio pura y sus tests (progresión, ciclo, entradas, mapa muscular, migraciones…)
├─ db/         esquema Dexie y migraciones, sincronización del catálogo, plantillas y operaciones de datos
├─ catalogo/   ejercicios.json generado (890 ejercicios) y su versión
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

La biblioteca sale de [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (dominio público), fijada a un commit en `catalogo/fuente/`, más 14 máquinas que faltaban (`catalogo/extra.json`). Las traducciones se hicieron una sola vez y viven en el repositorio:

- `catalogo/nombres-*.tsv`: nombre en español de cada ejercicio (el inglés queda como alias para buscar).
- `catalogo/instrucciones-*.txt`: pasos en español, en bloques `@Id_Del_Ejercicio` + líneas `- paso`.

```bash
npm run catalogo                                   # regenera src/catalogo/ejercicios.json
npm run catalogo -- --imagenes <ruta>/exercises    # además convierte las imágenes a WebP en public/img/
```

Al arrancar, la app compara la versión del catálogo con la guardada y, si cambió, actualiza los ejercicios de la biblioteca sin tocar tus notas ni tus ejercicios propios. Los trazados del mapa muscular vienen de react-native-body-highlighter (MIT) y se regeneran con `node scripts/generar-mapa.mjs`. Créditos completos en `/licencias.txt` (enlazado al pie de Ajustes).

## Pasar de la PWA a la app Android (una sola vez)

La app Android guarda los datos en otro sitio que la PWA, así que **no se pasan solos**: se exportan desde la PWA y se importan en la app.

1. En la **PWA** (la Ferro instalada desde Chrome): **Ajustes → Datos y copias de seguridad → Exportar copia (JSON)**. Se guarda en *Descargas* como `ferro-copia-AAAA-MM-DD.json`. Hazlo justo antes de instalar el APK: lo que registres en la PWA después no se pasará.
2. Instala el APK (siguiente apartado) y ábrelo.
3. En la **app**: **Ajustes → Datos y copias de seguridad → Importar copia…**, elige el archivo de *Descargas* y confirma **Restaurar**. Se importan rutinas, entrenos, series, notas, molestias, peso corporal, entradas y ajustes. Las copias antiguas se migran solas al formato actual.
4. Comprueba que están tus rutinas y tu historial. Cuando lo veas todo, puedes desinstalar la PWA (mantén pulsado su icono → Desinstalar).

La web de Vercel (https://ferro-kappa-rosy.vercel.app) se queda en la versión 0.2.0 solo para poder hacer esa exportación; ya no se actualiza.

## Instalar el APK en el Xiaomi (HyperOS)

1. En el móvil, abre la página de **Releases** del repositorio en GitHub y descarga `ferro-X.Y.Z.apk` de la última versión (o, ya con Ferro instalada, **Ajustes → Actualizaciones → Buscar actualizaciones**).
2. Toca el archivo descargado. La primera vez Android pide permiso para **instalar apps desconocidas** desde Chrome (o desde *Archivos*): actívalo y vuelve atrás.
3. HyperOS muestra sus avisos de seguridad ("app no verificada", "no viene de Google Play"). Pulsa **Continuar / Instalar de todos modos**. Si aparece el análisis de seguridad de Xiaomi, espera a que termine y acepta. Si HyperOS sigue bloqueándola, desactiva un momento la protección de instalación en **Ajustes → Privacidad y seguridad → Protección** (el nombre exacto cambia entre versiones) y vuelve a activarla después.
4. Abre Ferro y acepta las **notificaciones** (son para el aviso de fin de descanso).

### Ajustes de HyperOS que necesita Ferro

HyperOS cierra las apps en segundo plano con mucha agresividad. Para que el descanso avise con la pantalla apagada y para detectar la entrada y la salida del gimnasio:

- **Inicio automático**: Ajustes → Aplicaciones → Gestionar aplicaciones → Ferro → **Inicio automático: activado**.
- **Ahorro de batería**: en esa misma pantalla → Ahorro de batería → **Sin restricciones**.
- **Notificaciones**: permitidas, con el canal **"Fin del descanso"** con sonido y vibración.
- **Ubicación**: **Permitir todo el tiempo** (la usa la detección del gimnasio con Ferro cerrada).
- **Health Connect**: permisos de pasos y peso (fase 5).
- Opcional: en la multitarea, mantén pulsada la tarjeta de Ferro y toca el **candado** para que no se cierre al limpiar.

## Actualizar la app

En **Ajustes → Actualizaciones → Buscar actualizaciones**, Ferro mira la última versión publicada en GitHub. Si hay una nueva, **Descargar APK** la abre en Chrome; al terminar, toca el archivo y pulsa **Actualizar**. Se instala encima y **conserva todos los datos** (la base de datos se migra sola si cambia de versión).

Solo se puede instalar encima un APK firmado con **la misma clave**. Si Android dice que el paquete "entra en conflicto", el APK está firmado con otra clave: no desinstales sin exportar antes una copia, o perderás los datos.

## Publicar una versión (GitHub Actions)

El workflow `.github/workflows/apk.yml` compila la web, pasa los tests (web y nativos), genera el APK de release **firmado** y lo publica en **GitHub Releases** con la etiqueta `vX.Y.Z`. Se ejecuta en cada push a `main`, pero solo publica si la versión de `package.json` todavía no tiene release:

```bash
npm version patch --no-git-tag-version   # 0.3.0 → 0.3.1 (o minor/major)
git commit -am "Versión 0.3.1"
git push
```

El `versionCode` de Android se calcula de la versión (`0.3.1` → 301), así que siempre sube.

### Clave de firma (una sola vez)

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

- **Crear una rutina**: Rutinas → **+**. Nombre → **Añadir ejercicios** (selector a pantalla completa, con búsqueda en español o inglés, filtros y selección múltiple) → ajusta series, repeticiones y descanso con +/− → **Guardar rutina**. Debajo se ve en vivo el mapa de músculos que cubre y un aviso si a tu ciclo le falta algún grupo grande.
- **Entreno libre**: en Hoy, junto a "Empezar". Añades ejercicios sobre la marcha; al terminar puedes **Guardar como rutina**. No cambia la rutina que te toca.
- **Peso exacto**: mantén pulsado el número del peso para escribirlo con el teclado. Los botones +/− suben según el material: barra 2,5 kg, mancuernas 2 kg, kettlebell 4 kg, máquinas y poleas 5 kg.
- **Fin del descanso**: en la app Android, al terminar el descanso llega una notificación con sonido y vibración aunque Ferro esté en segundo plano o con la pantalla apagada (usa una alarma exacta de Android).
- **Mapa muscular**: en el resumen de cada entreno, en Progreso (esta semana, 7 días, 30 días), en la ficha de cada ejercicio y en el editor de rutinas. Toca un músculo para ver sus series y qué ejercicios lo han trabajado.

## Copias de seguridad

Los datos viven solo en el móvil, así que conviene sacar copias. En **Ajustes → Datos y copias de seguridad**:

- **Exportar copia (JSON)**: todo (ejercicios, rutinas, entrenos, series, entradas, peso y ajustes). En la app Android se guarda en **Documentos/Ferro** (en la PWA, en *Descargas*). Con **Enviar copia a Drive, correo…** la mandas a otra app.
- **Exportar series (CSV)**: una fila por serie (fecha, rutina, ejercicio, músculo, tipo, peso, reps, RIR, molestia), separado por punto y coma y con coma decimal para abrirlo en Excel o Google Sheets.
- **Importar copia**: valida el archivo y te pide confirmación antes de **sustituir** todos los datos del móvil. Las copias de versiones anteriores se migran al formato actual al importarlas.
- Desinstalar la app borra sus datos; actualizarla con un APK nuevo, no.

Si llevas más de 2 semanas sin hacer copia, Hoy muestra un recordatorio discreto.

## Calidad

- `npm run build`: comprobación de tipos estricta + build sin avisos.
- `npm test`: tests de la lógica pura de la web (progresión, ciclo de rutinas, entradas y eventos de la detección, cierre automático, semanas, estadísticas, récords, prerrellenado, superseries, copias de seguridad e importación con migración, actualizaciones, intensidad y mapa muscular, biblioteca y migraciones de la base de datos).
- `cd android && ./gradlew testDebugUnitTest`: tests nativos de la decisión de entrada y salida (distancia, precisión, deduplicación, confirmación de la salida y hora del aviso). GitHub Actions los pasa antes de publicar cada APK.
