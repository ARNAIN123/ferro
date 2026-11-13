# Ferro — mi app personal de gimnasio

**Ferro** es mi app personal de gimnasio. Es solo para mí (un único usuario, sin cuentas ni login) y la uso en mi móvil Android (Xiaomi 15 con HyperOS). Es una **app Android nativa hecha con Capacitor** sobre la web React de siempre: se instala con un APK, tiene su icono, funciona sin conexión y hace en segundo plano lo que una web no puede (detectar la entrada y la salida del gimnasio, avisar del descanso con la pantalla apagada, leer los pasos de Health Connect).

Su trabajo es este ciclo: **detectar cuándo entro y salgo del gimnasio → saber qué rutina me toca → dejarme registrar el entreno lo más rápido posible → decirme qué peso usar la próxima vez → enseñarme mi progreso, mis músculos de la semana, mis pasos y mi objetivo del mes.**

> Este documento ya incluye las **rondas 1 a 5 de mejoras** y es la única referencia de cómo tiene que ser la app. Lo que está en "Cosas que no deben volver" se quitó a propósito: no lo reintroduzcas.

---

## Cómo quiero que trabajes

- Las mejoras nuevas te las pido **directamente por el chat**; ya no hay documentos de mejoras. Cuando hagas un cambio, actualiza este documento para que quede recogido (y, si quito algo, añádelo a "Cosas que no deben volver").
- Antes de escribir código, lee este documento entero y hazme solo las preguntas imprescindibles.
- Construye por fases (ver "Fases" al final). Al acabar cada fase: compila, pasa los tests, haz commit, **publica una versión nueva del APK** y dime exactamente qué probar en el móvil.
- Si necesito descargar o instalar algo a mano (por ejemplo Blender), dímelo con pasos concretos.
- Si una fase pide algo para revisar (vista previa, listado, galería), genera eso y espera mi visto bueno antes de integrarlo en la app.
- No añadas dependencias innecesarias. TypeScript estricto, componentes pequeños y la lógica de negocio (progresión, ciclo, detección, intensidad muscular, objetivo mensual, calorías, migraciones) separada de la interfaz en funciones puras con tests. La lógica nativa (Kotlin) también tiene tests unitarios.
- Toda la interfaz en español.
- Si algo no es técnicamente viable en Android/Capacitor, dímelo y propón la mejor alternativa en lugar de saltártelo.
- **No rehagas lo que ya funciona.** En cada ronda de mejoras aplica solo lo que se pide y actualiza este documento.

---

## Mis datos son sagrados

Tengo datos reales (rutinas, entrenos, notas, peso). **Cualquier cambio en la base de datos se hace con una nueva versión de Dexie y una migración (`upgrade`) que conserve todo.** Nunca se borra ni se recrea la base de datos. Cada migración es una función pura con tests (`src/domain/migracion.ts`) y se prueba con datos de la versión anterior antes de publicar.

- **De la PWA a la app nativa:** el almacenamiento es distinto y los datos no pasan solos. Se exportan a JSON desde la PWA (Ajustes → Datos) y se importan en la app. La importación no pierde nada (rutinas, entrenos, series, notas, molestias, peso, entradas, ajustes) y **migra las copias antiguas** con las mismas migraciones que la base de datos (la copia guarda su versión de esquema; las que no la traen se reconocen por sus datos).
- Las actualizaciones del APK se instalan **encima** (misma firma) y conservan los datos. El origen de la WebView (`https://localhost`) no cambia nunca, porque IndexedDB va ligada a él.

---

## Stack

- **Vite + React + TypeScript**, **Tailwind CSS**, **React Router**, **Recharts**, **@dnd-kit**, **Vitest**.
- **Capacitor 8** (Android, `appId` `com.ferro.app`, nombre "Ferro", con el icono de siempre). Plugins oficiales: App, Filesystem, Share, Local Notifications. Código nativo propio en **Kotlin** para la detección del gimnasio, con tests JUnit.
- **Dexie.js** (IndexedDB) con `dexie-react-hooks`. Todos los datos en el móvil (local-first, sin backend).
- **Health Connect** con la librería oficial de Google (`androidx.health.connect:connect-client`, Apache 2.0, gratuita) desde un plugin propio en Kotlin que solo lee pasos y peso. Se valoró `@capgo/capacitor-health` (MPL-2.0, gratuito), pero declara unos 50 permisos de salud y la app solo debe pedir dos. Por Health Connect, la app necesita Android 8 (minSdk 26).
- **GitHub Actions** compila el APK de release firmado y lo publica en **GitHub Releases** (repositorio público; solo código).
- Solo en desarrollo: **sharp** y **resvg** (iconos).
- La web sigue compilando con vite-plugin-pwa y se publica en Vercel con la misma versión que el APK, sin las funciones nativas. Está protegida con contraseña (autenticación básica en `middleware.ts`, contraseña en la variable secreta `FERRO_CLAVE` de Vercel; gratis, sin la protección de pago). Por eso la web de Vercel no funciona sin conexión: su service worker se autodestruye para que siempre se pida la contraseña.

---

## App Android nativa

- **Offline total**: todo va dentro del APK. En la app nativa no se registra el service worker de la PWA (y se quita si quedara alguno), para que una actualización nunca sirva código viejo.
- **Compilación:** workflow de GitHub Actions que, cuando cambia la versión de `package.json`, pasa los tests, compila el APK de release **firmado siempre con la misma clave** (guardada como secretos del repositorio) y lo publica en Releases. `versionName` = versión de `package.json`; `versionCode` = mayor·10000 + menor·100 + parche. El README explica cómo crear la clave y guardarla como secretos, y cómo compilar en local con Android Studio.
- **"Buscar actualizaciones"** en Ajustes: consulta la última release de GitHub, la compara con la versión instalada y abre la descarga del APK en Chrome.
- **Temporizador de descanso**: además del contador en pantalla, una **notificación con sonido y vibración** programada con alarma exacta a la hora de fin, que llega aunque la app esté en segundo plano o con la pantalla apagada. Se reprograma con cada cambio (serie nueva, ±15 s, saltar, terminar).
- **Exportar** guarda en `Documentos/Ferro` y **compartir** usa la hoja de compartir de Android; **importar** usa el selector de archivos.
- **Pantalla encendida** durante el entreno (Wake Lock, activable en ajustes).
- Respeta las safe areas, sin scroll horizontal y sin zoom accidental al tocar campos.
- En el README: cómo instalar el APK en HyperOS (instalar apps desconocidas y avisos de seguridad de Xiaomi) y los ajustes que necesita Ferro: inicio automático, ahorro de batería "Sin restricciones", ubicación "Permitir todo el tiempo", permisos de Health Connect y notificaciones.

---

## Detección de entrada y salida del gimnasio

El método es exactamente este: **la entrada se registra cuando abro la app S3 FIT ZONE en el móvil y estoy en la ubicación del gimnasio.** No hay enlace `?checkin=auto`, ni detección por ubicación al abrir Ferro, ni botón manual.

### Entrada

- **MacroDroid solo avisa:** disparador "Aplicación abierta → S3 FIT ZONE" y acción "Enviar intent" de tipo **Broadcast explícito** (paquete `com.ferro.app` y la clase del receptor; Android no entrega broadcasts implícitos a receptores del manifest). Extras: `evento=s3_abierta` y la hora.
- **Ferro decide en Kotlin:** un `BroadcastReceiver` recibe el aviso y pide la ubicación **de forma activa en ese momento** (`getCurrentLocation` de alta precisión, con tiempo máximo y un reintento). Nada de geofencing pasivo.
- Si está dentro del radio (por defecto **150 m**, configurable, teniendo en cuenta la precisión de la lectura), registra la entrada **con la hora en que se abrió S3 FIT ZONE**. Deduplicación: como máximo una entrada cada 3 h.
- Todo en segundo plano: **Ferro no se abre encima** (estoy enseñando el QR). Opcional en Ajustes: notificación discreta "Entrada registrada · 18:04".
- Ajustes: botón "Estoy en el gimnasio ahora" para guardar la ubicación y el radio.
- **Respaldo:** si empiezo un entreno sin entrada reciente, la hora de inicio del entreno cuenta como entrada (origen `entreno`).

### Salida

- Mientras estoy en el gimnasio (entrada sin salida), Ferro comprueba la ubicación de forma activa cada 10–15 minutos, con el mecanismo más fiable en HyperOS (justificado en el código y el README).
- Si el móvil usa la WiFi del gimnasio, una segunda macro "WiFi desconectado → [red del gimnasio]" envía `evento=wifi_desconectada` y Ferro comprueba al momento.
- La salida se confirma con **dos comprobaciones seguidas fuera del radio más un margen** (por defecto 150 m: 300 m con el radio por defecto). **La hora de salida es la primera señal de salida** (la desconexión de la WiFi o la primera comprobación fuera).
- Si había un entreno en curso, se cierra con la hora de salida.
- **Respaldo:** si no se detecta la salida y pasan 3 h sin actividad, la sesión se cierra con la hora de la última serie **más 5 minutos**.

### Diagnóstico

- Ajustes → **"Registro de detección"**: últimos eventos con hora, tipo, distancia, precisión y decisión (entrada registrada, descartada por distancia, imprecisa, duplicada, salida confirmada…).
- En el README, la configuración exacta de las dos macros de MacroDroid.

---

## Rutinas en ciclo

- Creo rutinas (por ejemplo "A — Torso", "B — Pierna") y las ordeno en un **ciclo**. La app sabe cuál toca según la última que hice, no según el día de la semana. Siempre puedo elegir otra.
- Cada ejercicio de una rutina tiene: número de series, rango de repeticiones (ej. 8–12), descanso, nota y si va en superserie con el siguiente.
- Reordenar el ciclo arrastrando, duplicar rutinas y archivarlas. Plantillas iniciales opcionales: Full Body 3 días, Torso/Pierna y Push/Pull/Legs.

### Crear y editar una rutina (una sola pantalla)

- **Flujo:** nombre → añadir ejercicios → ajustar → guardar.
- **Selector de ejercicios por mapa** (ver "Buscar ejercicios") a pantalla completa, con **selección múltiple**.
- Valores por defecto: **3 series, 8–12 repeticiones y 90 s**; **150 s** en los compuestos grandes. Editables en línea con +/−.
- Reordenar arrastrando y **superserie** con un botón entre dos ejercicios.
- Debajo de la lista, el **avatar muscular en vivo** de la rutina y un **aviso suave** si algún grupo grande no se trabaja en ningún día del ciclo.
- Si una rutina contiene un ejercicio que ya no está en la biblioteca, se marca con un aviso y se propone el equivalente más parecido.
- Crear una rutina a partir de un entreno hecho (incluido un entreno libre) y duplicar rutinas.

---

## Biblioteca de ejercicios

- **Solo** ejercicios con: barra (olímpica, EZ, hexagonal, landmine), mancuernas, discos, poleas y multipower. El banco se permite como accesorio.
- **Fuera:** máquinas guiadas, peso corporal, kettlebell, bandas, balones, cardio y estiramientos.
- **Que estén todos** los ejercicios conocidos que cumplan el criterio (Free Exercise DB filtrada + conocimiento propio). Cada variante relevante (inclinación del banco, agarre, unilateral, posición) es un ejercicio propio. Nombres como se dicen en los gimnasios de España, sin duplicados.
- Cada ejercicio con sus grupos musculares principales y secundarios (los 18 de la división simple), material e instrucciones en español. **Todo de solo lectura** salvo mis notas.
- Antes de integrarla, se genera un listado completo agrupado por músculo principal para revisarlo.
- **Migración:** los ejercicios de mi historial que quedan fuera (máquinas, etc.) **no se borran**: siguen en el historial y las estadísticas, pero no aparecen en la biblioteca ni en el selector.
- Ejercicios personalizados: solo para lo que no exista; músculos elegidos en el mapa y material, después fijos.
- Mis **notas fijas** por ejercicio (ajustes de máquina, agarre…) se muestran durante el entreno.

### Imágenes: animaciones en un solo estilo

- **Ninguna foto ni persona real.** No queda ninguna imagen de Free Exercise DB.
- Todos los ejercicios se muestran con **la misma representación: una ilustración animada**, en el estilo del avatar. Primero se busca un conjunto con licencia válida que lo cubra todo en un único estilo; si no existe, **sistema propio**: figura vectorial con esqueleto articulado y sin rostro realista, material dibujado (barra con discos, mancuernas, polea con cable y anclaje, multipower con guías, banco con su inclinación), poses clave de inicio y fin animadas en bucle de 2–3 s, construidas con patrones de movimiento reutilizables y parametrizados (press, remo, curl, extensión, aperturas, elevaciones, sentadilla, bisagra, zancada, jalón, encogimientos…), vista lateral o frontal según convenga y biomecánicamente correcta.
- Los músculos principales se resaltan con el color de acento sobre la figura animada. Ligero y sin conexión.
- Antes de darlo por terminado, se genera una galería con todas las animaciones para revisarla.
- **Cómo está hecho** (no había ningún conjunto libre en un solo estilo que cubriera la biblioteca): `src/animacion/`.
  - `esqueleto.ts`: la pose se describe con un *control* (cadera, inclinación del tronco y a dónde van manos y pies) y se resuelve con cinemática inversa de dos segmentos; así los pies apoyados no resbalan y la barra sigue su recorrido (vertical en el multipower). Vista lateral, frontal, dorsal o cenital (tumbado visto desde arriba, para las aperturas).
  - `patrones.ts`: patrones parametrizados (press, remo, curl, muñeca, extensión, aperturas, elevaciones, rotaciones, encogimientos, sentadilla, bisagra, puente, zancada, jalón y pullover, gemelos, abdominales y giros, halterofilia…) con parámetros como banco, inclinación, agarre, carga o unilateral.
  - `asignacion.ts`: reglas por nombre que dan a cada ejercicio su patrón; los ejercicios propios sin regla usan el patrón típico de su músculo principal. Un test comprueba que ningún ejercicio de la biblioteca usa el genérico.
  - `fotogramas.ts`: 40 fotogramas por bucle de 2,6 s (ida, pausa, vuelta), animados con SVG nativo; las miniaturas usan una sola pose. Con "reducir movimiento" no se anima.
- Galería de revisión en `/vista-previa/animaciones` (enlace al pie de Ajustes).

### Ficha del ejercicio

- Animación grande del ejercicio.
- Músculos principales y secundarios **listados en español y marcados en el avatar** (principales a intensidad máxima, secundarios suave).
- Material, nivel e instrucciones paso a paso en español. Mi historial, mi récord y su gráfica.
- **Mis notas son lo único editable.**

---

## Buscar ejercicios: solo con el mapa

- El **único** método para encontrar ejercicios es el avatar muscular, en toda la app (biblioteca, creación de rutinas, entreno libre y cambio de ejercicio). Sin buscador de texto, chips, categorías ni filtros.
- Flujo: figura frontal o trasera → toco un músculo → lista con dos apartados: **"Principal"** (su músculo principal es ese) y **"También lo trabajan"** (lo tienen como secundario).
- Cada fila: miniatura de la animación, nombre y una etiqueta pequeña con el material. Orden: primero los que más uso, después alfabético.
- Selección múltiple al crear rutinas. Al cambiar un ejercicio durante el entreno, el mapa se abre directamente en el músculo principal del ejercicio actual.

---

## Avatar muscular

- Ilustración anatómica **de calidad profesional**, como la imagen de referencia: silueta limpia y proporcionada, contorno continuo y grosores de línea coherentes; cada músculo con su contorno y sus líneas internas; detalle suficiente (pectoral superior e inferior; deltoides anterior, lateral y posterior; bíceps, braquial, tríceps, antebrazo; trapecio, dorsal ancho, zona media de la espalda, lumbares; recto abdominal, oblicuos; glúteo mayor y medio; cuádriceps, isquiotibiales, aductores, gemelos y sóleo) y sombreado sutil. Vista frontal y trasera.
- La geometría sale de **Open Muscle Map** (MIT, licencia verificada y guardada en `catalogo/fuente/avatar/`): `scripts/generar-avatar.mjs` la convierte en regiones con nombre. Con esas siluetas se construye una **figura 3D** (three.js, MIT) con volumen y relieve muscular que se **gira con el dedo** (frente y espalda); si el móvil no tiene WebGL se muestra la versión plana. Página de vista previa en `/vista-previa/avatar` con semana vacía, media, completa y la ficha de un ejercicio.
- **Misma figura en toda la app:** pantalla principal, ficha del ejercicio, creación de rutinas, resumen del entreno, buscador y animaciones.
- **Intensidad** (función pura con tests): cada serie completada cuenta **1** para los músculos principales y **0,5** para los secundarios. Gris sin trabajar; color de acento cada vez más intenso en 5 niveles, con transiciones suaves y leyenda.
- **Tabla de correspondencia** grupo muscular → regiones del avatar (2D y 3D), con tests.
- Al tocar un músculo se abre una ficha con su nombre en español, sus series en el periodo y los ejercicios que lo han trabajado.

### División muscular simple (ronda 5)

Manda sobre la división completa de la ronda 4, que era demasiado fina: los músculos son **18 grupos grandes**, como se dicen en el gimnasio (`src/domain/musculos.ts`):

**Cuello, Trapecio, Hombros, Pecho, Bíceps, Tríceps, Antebrazos, Espalda alta, Dorsales, Lumbares, Abdominales, Oblicuos, Glúteos, Abductores, Aductores, Cuádriceps, Isquiotibiales y Gemelos.**

- **Sin porciones, cabezas ni músculos profundos** en ninguna parte de la interfaz: ni en el mapa, ni en las fichas, ni en las listas.
- Los modelos 3D conservan sus **48 regiones** (las de la ronda 4, `REGIONES_MODELO`) y cada una pertenece a un grupo (`GRUPO_DE_REGION`): todas las regiones de un grupo se pintan y se eligen juntas. Reparto: cuello (esternocleidomastoideo y esplenio), trapecio (el superior), hombros (los tres deltoides, supraespinoso y subescapular), pecho (las tres porciones del pectoral y el serrato), bíceps (con el braquial), tríceps, antebrazos (con el braquiorradial), espalda alta (trapecio medio e inferior, romboides, infraespinoso y redondo menor), dorsales (dorsal ancho y redondo mayor), lumbares, abdominales (con el psoas-ilíaco, que solo aparecía en ejercicios de abdominales), oblicuos, glúteos (el mayor), abductores (glúteo medio y menor y tensor de la fascia lata), aductores, cuádriceps (con el sartorio), isquiotibiales y gemelos (con el sóleo, el tibial anterior y los peroneos).
- **Ejercicios**: los de la biblioteca toman sus grupos de `catalogo/musculos.json` (la división de la ronda 4, revisada, agrupada). Un grupo que sale como principal no se repite en secundarios.
- **Intensidad semanal:** igual que antes: cada grupo principal cuenta 1 serie y cada secundario 0,5, con los mismos 5 niveles.
- **Ficha del músculo:** al tocar un grupo se abre su ficha con sus series del periodo y los ejercicios que lo han trabajado.
- **Migración:** los músculos de cualquier versión (los nombres de la v1, las zonas de las rondas 2–3 y los 48 de la ronda 4) se convierten a su grupo con una tabla directa (en todas las versiones, un mismo nombre significa lo mismo), en los ejercicios propios y retirados y en las copias de seguridad antiguas; el historial semanal se calcula a partir de las series, así que sigue siendo coherente.
- El mapa 2D (sin WebGL) y las animaciones 2D usan **zonas** (las 23 regiones de la ronda 2): cada grupo pinta una o varias.

### Avatar de la semana (pantalla principal)

- Pinta lo trabajado **esta semana, de lunes a domingo**; se actualiza con cada serie y el lunes empieza de cero. Encima, una etiqueta pequeña: "Semana del 2 al 8 nov".
- Niveles fijos por series de la semana: **1–3, 4–6, 7–10, 11–15 y 16 o más**.

---

## Modo entreno (lo más importante: tiene que ser rapidísimo)

- Pantalla completa, una tarjeta por ejercicio y botones grandes (mínimo 48 px), usable con una mano.
- Cada serie aparece **prerrellenada** con el peso y las repeticiones de la última vez. Completar una serie es **un solo toque**.
- **+/− del peso** según el material: barra 2,5 kg, mancuernas 2 kg, poleas y multipower 5 kg (resto 2,5 kg). No es configurable. **Mantener pulsado** el valor abre el teclado numérico.
- **Temporizador de descanso** calculado desde una hora de fin, con notificación nativa (ver "App Android nativa").
- Tipos de serie: calentamiento, normal y drop set. RIR opcional.
- Cambiar un ejercicio por otro (el mapa se abre en su músculo principal), añadir ejercicios sobre la marcha o saltarlo.
- Marcar "molestia" con nota opcional, visible en el historial.
- El entreno en curso se guarda tras cada cambio y se retoma exactamente donde estaba.
- Al terminar: resumen con duración, series, volumen, **avatar con los músculos trabajados**, récords, comparación con la última vez y **"Guardar como rutina"**.

### Entreno libre

- Botón **"Entreno libre"** junto al de empezar la rutina que toca. Empieza vacío; añado ejercicios con el mismo selector. Funciona igual que un entreno normal. Al terminar, **"Guardar como rutina"**. **No avanza el ciclo**.

---

## Progresión automática

Funciones puras con tests:

- **Doble progresión**: si en la última sesión completé todas las series en el máximo del rango, sugiere subir el peso con el incremento de su material y volver al mínimo de repeticiones. Si no, mantener el peso e intentar subir repeticiones.
- Si registré RIR y fue 0 en la mayoría de las series, no sugerir subir peso.
- **Estancamiento**: 3 sesiones seguidas sin mejorar → aviso con dos opciones: bajar un 10 % y reconstruir, o cambiar de ejercicio.
- Etiqueta discreta junto al ejercicio ("↑ 2,5 kg", "+1 rep"); se aplica solo si la toco.

---

## Pantalla principal ("Hoy"), en este orden

1. **Objetivo mensual.**
2. **Avatar muscular de la semana.**
3. **Anillo de pasos y calorías**, uno al lado del otro.
4. Botones **"Empezar [rutina que toca]"** y **"Entreno libre"** (y "Elegir otra rutina"). Si hay un entreno en curso, botón para retomarlo.

Además, cuando toca: "En el gimnasio desde las 18:05", resumen del último entreno y recordatorio discreto de copia de seguridad.

### Objetivo mensual (sustituye a la racha)

- Sin racha semanal ni objetivo semanal en ninguna parte.
- **Objetivo mensual:** por defecto **16 días al mes**, editable.
- Un día cuenta si hay una entrada registrada o un entreno terminado (como máximo una vez por día).
- Tarjeta: "9 / 16 días · noviembre", con barra de progreso y uno de estos mensajes:
  - Aún posible: "Puedes saltarte X días más y seguir cumpliéndolo". X = días que quedan en el mes en los que todavía puedo ir − días que me faltan. Hoy cuenta como disponible si todavía no he ido.
  - X = 0: "No puedes saltarte ningún día más".
  - Imposible: "Este mes ya no es posible: te faltan N días y quedan M".
  - Conseguido: "Objetivo cumplido", más los días extra.
- Función pura con tests: principio y final de mes, hoy entrenado o no, cumplido, imposible y meses de 28, 30 y 31 días.

### Pasos y calorías

- **Pasos de hoy desde Health Connect**, con la **agregación** de Health Connect (no la suma de muestras, para no contar dos veces). Permisos solo de pasos y peso. Se actualiza al abrir o volver a la app y cada pocos minutos mientras está abierta.
- **Anillo de pasos** frente a un objetivo editable (por defecto 10.000).
- **Calorías estimadas de hoy** ("≈ X kcal") con desglose de pasos y entreno, siempre como estimación; al tocarlo se abre el desglose y cómo se calcula:
  - Datos: peso (el último de la app o de Health Connect), altura y edad, editables en Ajustes.
  - Pasos: ecuación del ACSM para caminar en llano sin el término de reposo: 0,1 ml O₂/kg/m ≈ **0,5 kcal por kg y km**. Distancia = pasos × longitud del paso, estimada como **0,414 × altura**.
  - Entreno: MET de fuerza (Compendium of Physical Activities) entre **3,5 y 6** según la densidad real de la sesión: series por minuto (0,2 → 0,6), tiempo entre series (4 min → 75 s) y kilos movidos por minuto respecto al peso corporal (0,5 → 5 veces). Duración de la entrada a la salida, o de la primera a la última serie. Netas = **(MET − 1) × peso × horas**.
  - La edad se guarda en Ajustes, pero estas fórmulas dan calorías netas (por encima del reposo) y no dependen de ella.
  - Los pasos dados dentro del gimnasio durante la sesión no se cuentan dos veces: se piden a Health Connect los pasos de cada entreno y se restan de los del día.
  - Cálculos como funciones puras con tests.
- En el README: de dónde salen los pasos (Google Health, Mi Fitness o el propio móvil escribiendo en Health Connect) y cómo comprobar que llegan.

---

## Progreso y estadísticas

- Calendario de asistencia tipo mapa de calor, **historial mensual** con los meses cumplidos y no cumplidos, y duración media de las sesiones.
- **Músculos trabajados**: avatar con selector de periodo (esta semana, últimos 7 días, últimos 30 días) y series por grupo muscular con franja de referencia de 10–20 series por semana.
- Por ejercicio: 1RM estimado (Epley), mejor serie, volumen e historial completo. Récords personales.
- Peso corporal: registro rápido (ver abajo) y gráfica con media móvil de 7 días.

### Registro de peso corporal (menos de 3 segundos)

- **Hoja inferior** que se abre desde Hoy ("Registrar peso", con el último peso), desde Progreso → Peso y desde el **acceso directo del icono** de la app (mantener pulsado → "Registrar peso"; abre `ferro://app/?peso=1`).
- Se abre **ya colocada en el último peso** (o en el de ese día si ya existe). Guardar es un toque.
- **Regla horizontal deslizable** (`src/components/Regla.tsx`): se arrastra, un lanzamiento rápido sigue por inercia y salta varios kilos, siempre acaba ajustada a 0,1 kg; vibración suave en cada 0,1 y más marcada en cada kilo (`@capacitor/haptics`). Número grande en el centro; al tocarlo se escribe con el teclado decimal.
- Botones ±0,1 y ±1 kg que **aceleran al mantenerlos pulsados**.
- Fecha hoy por defecto, con un chip para cambiarla. Un registro por día: guardar otro ese día lo sustituye.
- **Báscula vía Health Connect**: al abrir o volver a la app (como mucho cada 10 min) se traen los pesos de los últimos 30 días, uno por día (la última medición), **sin duplicados y sin pisar nunca lo que apunté a mano** (campo `origen`). Lógica pura con tests en `src/domain/pesoSalud.ts`.
- La misma regla se usa para los gramos de la sección de nutrición.

---

## Nutrición

Pestaña propia en la navegación. Como pollo, carne, huevos, pasta, arroz y lácteos; no como pescado, verdura ni fruta (dispuesto a ir probando). Objetivo por defecto: **perder grasa manteniendo el músculo**. Cálculos puros con tests en `src/domain/nutricion.ts`.

### Asistente (1 minuto)

- Sexo, edad, altura y peso (los tres últimos ya los tiene la app), objetivo (perder / mantener / ganar) y ritmo: suave 0,25 %, moderado 0,5 %, rápido 0,75 % del peso por semana.
- **Gasto**: metabolismo basal de **Mifflin-St Jeor** + actividad real (pasos medios de 7 días de Health Connect —5.000 supuestos si no hay— y entrenos de las últimas 4 semanas) + efecto térmico de los alimentos (10 %).
- **Seguridad**: ningún objetivo diario baja nunca del metabolismo basal (tampoco los días de descanso ni al redondear) y el ritmo nunca pasa del 1 % del peso por semana. Rehacer el cálculo conserva retos e historial.

### Objetivo adaptativo

- Las **2 primeras semanas** se usa la estimación.
- Después, **cada lunes** (al abrir Nutrición): gasto real = ingesta media registrada − cambio de la tendencia del peso (media móvil de 7 días, 7.700 kcal por kg), con al menos 10 días registrados de los últimos 14 y 3 pesos por semana; si faltan datos, se mantiene el objetivo y se explica por qué. El objetivo se mueve **como mucho ±150 kcal por semana** y nunca por debajo del basal.
- **Días de entreno y descanso**: el total semanal se mantiene, pero los días de entreno llevan un 8 % más (en hidratos) y los de descanso lo compensan, sin bajar del basal. Un día es de entreno si entrené o se detectó la entrada al gimnasio; se puede marcar a mano.
- **Macros**: proteína primero, 2 g/kg por defecto (editable 1,6–2,2), grasa al menos 0,7 g/kg (o el 25 % de las kcal), el resto hidratos. La proteína siempre destacada.

### Registro rápido

- Comidas: desayuno, comida, merienda y cena; los días de entreno, también **Antes de entrenar** y **Después de entrenar**.
- Al añadir: primero **mis recientes y frecuentes** para esa comida y esa hora (con "+" se añade igual que la última vez), **Mis platos** y "Repetir … de ayer"; después, búsqueda por texto (aquí sí se permite).
- **Escáner de códigos de barras** (`@capacitor-mlkit/barcode-scanning`, escáner de Google sin permiso de cámara) → **Open Food Facts**. Si no está, se crea con los valores de la etiqueta.
- **Base genérica en español**: 109 alimentos de USDA FoodData Central SR Legacy (dominio público), con nombres en español, raciones habituales y **crudo o cocinado** bien indicado (`catalogo/alimentos`, `scripts/generar-alimentos.mjs`).
- Cantidad con la **regla** o con raciones predefinidas. **Mis platos**: guardar una comida entera y añadirla con un toque. **Repetir**: copiar una comida de otro día.
- **IA opcional**: con mi clave de la API de Anthropic (Ajustes; solo en el dispositivo y fuera de las copias) escribo «200 g de pollo con 80 g de arroz» y la app propone los alimentos, que reviso antes de guardar. Modelo `claude-opus-5-5` con salida estructurada y respaldo automático del servidor si el modelo no está disponible. Sin clave, todo lo demás funciona igual.

### Pantalla del día

- Anillo de **calorías que me quedan**, barras de proteína (destacada), hidratos y grasa, lista de comidas, agua (+250 ml) y día de entreno o descanso.
- **"Cerrar el día"**: combinaciones de uno o dos de mis alimentos habituales que encajan con lo que me queda (p. ej. 45 g de proteína y 500 kcal). Algoritmo simple, sin IA.
- **Reto de fruta y verdura** (opcional, desactivable): una propuesta suave a la semana con una forma fácil de tomarla; marco "lo he probado", "me gusta" o "no me gusta". Lo que me gusta queda a mano al añadir comida; lo que no, no vuelve a salir. Sin presión, rachas ni culpa.
- **Revisión de los lunes**: media de kcal y proteína frente al objetivo, tendencia del peso, gasto recalculado y ajuste aplicado. Historial en "Tu objetivo".
- **Tono**: nada de rojo de "fracaso", rachas de dieta ni alimentos "prohibidos". Si llevo varios días por debajo del 70 % del objetivo, un mensaje amable recomendando comer más (nunca se celebra).
- En **Hoy**, debajo de pasos y calorías: «Te quedan 640 kcal · 52 g de proteína».
- Escribir las comidas en Health Connect: no se hace por ahora (era opcional).

---

## Cuerpo 3D (ronda 3, fase 3)

- **Modelo**: `public/modelos/cuerpo.glb` (≈ 0,34 MB, 110.000 triángulos, Draco), generado con Blender 4.5 LTS sin ventana por `scripts/blender/generar-cuerpo.py` a partir de **Z-Anatomy** (CC BY-SA 4.0, basado en BodyParts3D, CC BY-SA 2.1 JP): piel de las regiones del cuerpo (sin pelo ni genitales) hundida sobre los músculos superficiales donde los hay, unida a ellos —inflados según la región, para que tenga volumen y no parezca un modelo anatómico sin grasa (0,9–1,5 cm en hombros, pecho, brazos, glúteos y piernas; menos en abdomen, antebrazos y gemelos)— con un remallado por vóxeles, cierre morfológico, suavizado, simplificación y corrección de triángulos dados la vuelta. Cabeza, manos, pies y rodillas conservan la piel original.
- **Regiones**: cada cara pertenece a una de las regiones de Ferro (mismo orden que `REGIONES_MODELO`: 23 en la ronda 3 y, desde la ronda 4, las 48 de la división completa, que desde la ronda 5 se agrupan en los 18 grupos) o a ninguna; se elige con un rayo hacia dentro (el primer músculo que se encuentra), con ventajas para los músculos bajo aponeurosis (recto abdominal, lumbares) y límites de altura (lumbares). En Z-Anatomy las piezas del trapecio «Ascending» y «Descending» están intercambiadas respecto a su posición: se asignan por posición. `COLOR_0.r` = id/255 y `COLOR_0.g` = oclusión ambiental horneada (Cycles). Licencia del modelo resultante: CC BY-SA 4.0, con créditos en Ajustes → Créditos.
- **Visor** (`src/components/cuerpo3d/Cuerpo3D.tsx`, three.js + react-three-fiber): arcilla mate (`--cuerpo-arcilla`), luces de estudio (principal, relleno y dos de contorno) y entorno suave generado en el momento, oclusión ambiental horneada y sombra de contacto. Los músculos trabajados se tiñen del acento según los 5 niveles (`src/domain/cuerpo3d.ts`) con un brillo sutil en los niveles altos. Gira 360° con inercia, zoom con pellizco (1–2,4×; con zoom, arrastrar en vertical recorre el cuerpo), doble toque para volver de frente, botones Frente/Espalda y toque en un músculo para elegirlo. Solo dibuja cuando algo se mueve. Si no hay WebGL, el mapa 2D.
- **Rig**: la misma malla (soldada, antes de exportar) acepta pesos automáticos con un esqueleto colocado sobre ella (probado: todos los huesos con pesos y ningún vértice sin peso), así que las animaciones de la fase 4 usarán este mismo cuerpo.
- **En toda la app** (aprobado el 7 de noviembre de 2026): `MapaMuscular` muestra el cuerpo 3D en Hoy, el buscador por mapa (y el selector de ejercicios), la ficha del ejercicio, la creación de ejercicios y de rutinas, el resumen del entreno y Progreso. Se carga aparte (las pantallas aparecen al momento) y sin WebGL se ve el mapa 2D. La vista previa sigue en Ajustes → Vista previa del cuerpo 3D.

---

## Animaciones 3D (ronda 3, fase 4)

- **División completa** (ronda 4, fase 1): el mismo script asigna las 48 regiones (las tres porciones del pectoral, las tres del trapecio, romboides, redondos, infraespinoso, las tres cabezas del tríceps, braquiorradial, flexores y extensores del antebrazo, vastos y recto femoral, sartorio, los tres isquiotibiales, gemelo medial y lateral, tibial anterior, peroneos…). Los músculos pequeños o tapados (romboides bajo el trapecio, redondos bajo el borde del deltoides) tienen ventaja al elegir región y no se borran al limpiar islas pequeñas. Los **músculos profundos** (supraespinoso, subescapular, glúteo menor y psoas-ilíaco) van dentro del cuerpo como piezas propias (unos 2.400 triángulos cada una, con los pesos del esqueleto de la piel más cercana); desde la ronda 5 ya no se enseñan (la piel es siempre opaca) y solo cuentan para su grupo. Unos triángulos degenerados de la simplificación hacían fallar los pesos automáticos: se disuelven antes de asignar regiones, y el script se para si los pesos fallan.
- **Volumen** (8 de noviembre de 2026, v0.9.1): perímetros de unos 33 cm de brazo, 60 de muslo, 40 de gemelo, 105 de pecho y 78 de cintura (1,71 m).
- **Mismo cuerpo**: `public/modelos/cuerpo-rig.glb` (0,54 MB) es el cuerpo del avatar con esqueleto (24 huesos: pelvis, lumbar, dorsal, pecho, cuello, cabeza, y por lado clavícula, brazo, antebrazo, mano, dedos, muslo, pierna, pie y punta), con las articulaciones colocadas en los huesos de Z-Anatomy (cabeza del fémur, cóndilos, astrágalo, cabeza del húmero, radio y cúbito, vértebras L5…C1) y pesos automáticos. Lo genera el mismo script de Blender con `FERRO_RIG=public/modelos/cuerpo-rig.glb` (y `cuerpo-rig.json` con las articulaciones). Con `FERRO_PUNTOS=src/animacion3d/superficie.json` guarda además unos 2.900 puntos de la superficie (uno cada 3 cm), cada uno con el hueso que lo mueve: con ellos se comprueba en cada pose que el cuerpo no atraviesa nada.
- **Sin atravesar el material** (v0.9.1): antes de montar la escena (`preparar`), cada banco, atril y cajón del dibujo se ata a la articulación más cercana del cuerpo 3D y se coloca para que lo que se apoya en él (la espalda, los glúteos, la rodilla, el pie de atrás de una búlgara, los brazos en el predicador) lo toque sin atravesarlo en ninguna pose; se acorta por los extremos si algo cuelga (las piernas en un banco declinado, el pie en un remo a una mano) y, si solo se apoya una pierna, va bajo esa pierna, al lado de la otra. Los cajones se ajustan a la planta de los pies (el pie que sube desde el suelo primero se levanta y luego avanza); los bloques de las cargadas y arrancadas van bajo los discos. Tumbado o sentado en el suelo, el tronco se sube lo justo para no hundirse. El material va siempre donde quedan de verdad las manos (la barra se inclina si una mano queda más alta); con dos poleas, cada cable a la mano de su lado; a una mano, el cable a la que se mueve; y en un leñador o unos giros rusos, las dos manos juntas en el agarre.
- **Toda la biblioteca** (piloto aprobado el 8 de noviembre de 2026): los 407 ejercicios tienen animación 3D. Los 10 del piloto están hechos a mano; el resto sale de las poses 2D que ya tenía cada ejercicio (`desde2d.ts`): cada pose del dibujo se lleva al cuerpo 3D (altura y profundidad en la vista lateral, anchura en la frontal; lo que falta se reconstruye: la anchura del agarre y de los pies según la carga y el ejercicio, y la profundidad por el escorzo de cada segmento), con brazos y piernas por cinemática inversa para que siempre midan lo que miden. El tempo sale solo: la fase que sube la carga (o aleja las manos de la polea) dura 1 s y la otra unos 2 s. El material del dibujo se convierte en el 3D (barra o hexagonal, mancuernas, disco, multipower, landmine, cajón, rueda, bancos con su inclinación, torres de polea —también dobles— con cuerda, barra, triángulo, estribo o tobillera). `biblioteca.ts` elige la de cada ejercicio (piloto o desde el 2D).
- **Motor** (`src/animacion3d/`): `ik.ts` (cinemática inversa de dos huesos con polo, giros entre bases, interpolación cúbica monótona entre poses), `rig.ts` (tronco primero —pelvis, columna repartida, cabeza, clavículas y una respiración sutil— y después brazos y piernas hacia manos y pies, con el antebrazo repartiendo la pronación), `ejercicios.ts` (los datos: poses clave por repetición, nunca vídeos), `material.ts` (barra olímpica con discos bumper y cierres, mancuernas, banco ajustable con inclinación real, torre de polea con pila de discos que sube lo que se alarga el cable, cuerda, barra recta, triángulo, estribo, máquina de jalón y multipower con guías y ganchos), `escena.ts` (escena en three.js puro: cuerpo, material, colores por región en la GPU) y `miniaturas.ts`.
- **Movimiento**: 7–9 poses clave por repetición, tempo real (bajada ~2 s, subida 1 s, pausas cortas), trayectorias de barra (J en el press de banca, vertical sobre el medio del pie en sentadilla y peso muerto, la cabeza que se aparta en el press militar), 3 repeticiones y una pausa en bucle. Los músculos principales del ejercicio en acento, más vivos y con brillo en la fase concéntrica; los secundarios, suaves.
- **Visor** (`Animacion3D`): escena 3D en vivo con las mismas luces, sombra de contacto, cámara de ¾ que se gira arrastrando (con inercia) y botones ¾ / Lado / Frente. Solo se anima mientras se ve.
- **Listas**: miniaturas animadas (16 fotogramas en una tira WebP generada una vez en el móvil con un renderizador sin pantalla y animada con CSS). Se guardan en una base aparte (`ferro-miniaturas`, IndexedDB) que no toca los datos: si se borra, se vuelven a generar. Mientras se genera una (o si el móvil no tiene WebGL) se ve la animación 2D.
- **Piloto** (hecho a mano): press de banca, sentadilla, peso muerto, remo con barra, press militar, curl con mancuernas, tríceps con cuerda en polea, jalón al pecho, elevaciones laterales e hip thrust.
- **Galería**: Ajustes → Animaciones 3D (`/vista-previa/animaciones-3d`), agrupada por patrón de movimiento; `?revision=patrones` enseña un ejercicio de cada patrón con el principio, la mitad y el final (`&solo=curl,remo` filtra patrones y los enseña más grandes).
- Tests: cinemática inversa, interpolación, rig con las articulaciones reales; con los puntos de la superficie, que en toda la biblioteca el cuerpo se apoya en bancos, atriles y cajones sin atravesarlos ni hundirse en el suelo (como mucho 1,5 cm), que en el piloto no se mete en los bancos ni en la máquina de jalón, y que cada cable y cada mancuerna van a su mano; para los 10 del piloto, que en cada instante manos y pies llegan a su sitio con codos y rodillas en ángulos posibles y sobre el suelo; y para toda la biblioteca, que cada ejercicio tiene animación 3D con tempo real, sin valores no válidos, con los tobillos sobre el suelo y las manos en su sitio en más del 85 % de los instantes.

---

## Avatar personalizado (ronda 4, fase 2)

- **Modelo**: `public/modelos/avatar.glb` (≈ 5 MB; 19.500 vértices y 36.600 triángulos) con `avatar.json`, `avatar-regiones.png` y `avatar-relieve.png`, generados con Blender 4.5 LTS sin ventana por `scripts/blender/generar-avatar.py` a partir del **cuerpo paramétrico de MakeHuman/MPFB2** (malla base hm08, deformadores y esqueleto: CC0). Solo se leen sus archivos de datos; no se ejecuta código de MPFB.
- **Forma como en MakeHuman**: cada combinación sexo × edad (joven/mayor) × músculo × peso (mínimo, medio, máximo) es una «esquina» con la media de las tres etnias de MakeHuman; el GLB lleva un *morph target* por esquina (35 más la de referencia, hombre joven medio) y 22 de medidas (cuello, hombros, pecho, cintura, cadera, brazo, antebrazo, muslo, gemelo, largo de piernas y de brazos, cada uno con su «+» y su «−»). La app reparte los pesos entre esquinas con las mismas funciones que MakeHuman (`src/avatar3d/forma.ts`) y mezcla las posiciones en la CPU (la forma cambia pocas veces).
- **Esqueleto recalculado**: el de Ferro (los mismos 24 huesos que las animaciones y, desde la ronda 5, en cada mano las tres falanges de cada dedo —las del corazón son «dedos», «dedos2» y «dedos3»— y dos del pulgar: 50 en total; además, las puntas —yemas, coronilla, uñas— como huesos sin peso, para saber hacia dónde apunta cada uno) sale de los cubos de articulación de MakeHuman, que se mueven con la malla; `avatar.json` guarda cuánto mueve cada articulación cada deformador, así que al cambiar la forma se recalculan todas las articulaciones (como hace MakeHuman). Los pesos de los vértices son los de MakeHuman agrupados en los 24 huesos.
- **Postura de reposo**: la anatómica del cuerpo de Z-Anatomy (brazos abajo, palmas al frente), a la que se lleva cada esquina con su propio esqueleto. Hasta la v0.12.2 el script tomaba el dorso de la mano por la palma y las palmas quedaban hacia atrás (y las manos, al girarlas, al revés); desde la ronda 5 miran al frente de verdad. Si un cuerpo es tan ancho que los brazos o los muslos se meterían en el tronco, se abren lo justo (se comprueba en el script con la malla).
- **Regiones y relieve transferidos**: el cuerpo de MakeHuman se ajusta hueso a hueso al de Z-Anatomy y luego se pega a su piel; con esa correspondencia se hornean en el mapa UV de MakeHuman la región muscular (canal rojo), la marca de músculo profundo (verde) y un mapa de normales con el relieve de los músculos (lo que se aparta la piel de Z-Anatomy de su versión suavizada), con la oclusión ambiental en el canal azul. La cabeza, las manos y los pies se quedan con la forma de MakeHuman. Los músculos profundos son las piezas de Z-Anatomy, que se mueven con la piel que tienen más cerca. El visor elige el color de cada punto en la textura (no en los vértices), así que los bordes entre músculos son limpios con cualquier forma.
- **Del perfil a la forma** (`src/avatar3d/resolver.ts`, ronda 5): el avatar es **una persona musculada de mi peso y mi altura, ni gorda ni flaca**. Se buscan el músculo y el peso de MakeHuman que dan mi peso real (volumen de la malla × densidad del cuerpo según su grasa, Siri) con la grasa dentro de una **franja atlética** (hombre 8–14 %, mujer 17–24 %) y, entre los que lo dan, el de más músculo. Si nadie tan musculado pesa tanto, el avatar se queda en el más musculado posible (más ligero que yo) antes que engordarlo; si peso muy poco, sale fibroso. Encima lleva **volumen muscular de más** (v0.12.2): los deformadores de hombros, pecho, brazos, antebrazos, muslos, gemelos y cuello (nunca cintura ni cadera) le dan unos 2–4 cm más de perímetro donde hay músculo (en una mujer, el 70 %). **Mi porcentaje de grasa no cambia el avatar** (sigue sirviendo para Nutrición). La edad va de 25 a 90 años y la altura escala el cuerpo entero. Si hay medidas con cinta, cada deformador de medida se mueve hasta que el avatar mida lo mismo: se mide como una cinta (`medidas.ts`: perímetro de la envolvente convexa del corte del cuerpo por donde se mide a una persona). La definición muscular sale de esa composición (siempre marcada), y el relieve horneado se usa a un 45 % para que los surcos entre músculos no parezcan cortes.
- **Perfil corporal** (Ajustes → Pasos y calorías → Perfil corporal, `/ajustes/cuerpo`): el avatar en grande, con la altura y el peso (sin porcentaje de grasa: no es el del avatar); sexo (si no se ha puesto, el del asistente de nutrición), edad y altura; el peso sale del registro y se usa la **tendencia** (media de los 7 días hasta la fecha), no el dato de un día; **medidas con cinta** opcionales con fecha (cuello, hombros, pecho, cintura, cadera, brazo, antebrazo, muslo y gemelo; con «Cómo medir», lo que mide ahora el avatar en gris y la evolución); **grasa corporal** de Health Connect si una báscula la registra (permiso de lectura de grasa corporal), con el método de la Marina de EE. UU. (cuello, cintura y altura; en mujeres, también la cadera) o escrita a mano. Manda la báscula si su dato es de los últimos 3 meses; si no, lo más reciente. Las medidas y la grasa de hace más de 4 meses dejan de dar forma al avatar. **Ajuste fino** con cuatro deslizadores (anchura de hombros, cintura, largo de piernas y de brazos) que se ven en directo y no cambian la altura. Los peinados (opcionales) no se han hecho.
- **Evolución**: el avatar se calcula con los datos de cada día, así que cambia solo cuando cambian el peso (su tendencia), las medidas o la grasa. **Antes / Ahora**: mi avatar de hace 1, 3 o 6 meses al lado del de hoy, girando a la vez, con el cambio de peso, grasa y medidas.
- **Nutrición**: si hay porcentaje de grasa, el metabolismo basal se calcula con **Katch-McArdle** (370 + 21,6 × masa magra); si no, con Mifflin-St Jeor. Se pone al día al guardar grasa o medidas y en la revisión de cada lunes; el objetivo nunca baja del basal.
- **Natural, no un muñeco rígido** (ronda 5): el visor dibuja el avatar con piel (SkinnedMesh con los 24 huesos de las animaciones, `src/avatar3d/esqueleto.ts`) en una **postura de gimnasio** (`postura.ts`, con el mismo rig e IK que las animaciones), recta y **simétrica** (sin cargar el peso en una pierna ni ladear la cabeza: lo pedí el 12 de noviembre): pecho fuera y hombros atrás, piernas a la anchura de las caderas con las puntas algo abiertas y las rodillas sin bloquear, brazos colgando cerca del cuerpo sin tocarlo (3° más cerrados que el reposo, que ya se abre lo justo; v0.12.4) con los codos doblados unos 18°, y **puños cerrados** (cada falange se lleva a la dirección que tiene en un puño respecto a la mano —nudillos a 80°, segunda falange a 170° y tercera a 210° desde la dirección de la mano—, cada dedo sobre sus propias articulaciones y por el camino más corto, así ninguno atraviesa la palma ni sale por el dorso, y el meñique no se tuerce; el pulgar cruzado por fuera de los dedos índice y corazón; v0.12.4) con las palmas hacia los muslos y la mano apuntando hacia dentro aunque el antebrazo vaya abierto (v0.12.3). **Respira**: el pecho y los hombros suben y bajan muy poco (unas 14 veces por minuto), solo mientras se ve en pantalla y no con «reducir movimiento» (a 24 fotogramas por segundo; si no, solo se dibuja al moverlo). Los músculos se pintan con **bordes suaves**: un mapa de color en el espacio UV con el de cada grupo, difuminado unos 1,5 cm solo dentro de la piel (`mapaColor.ts`). En el **pecho** el relieve horneado (de Z-Anatomy) no encaja con el pectoral musculado de MakeHuman y dibujaba un surco raro de la axila al esternón: ahí se usa un 15 % (serrato 35 %, deltoides anterior 60 %), con el cambio difuminado.
- **En toda la app**: el visor `Cuerpo3D` (mapa muscular de Hoy, buscador por mapa, fichas, progreso…) dibuja mi avatar con los niveles de cada músculo. Si el 3D falla en el móvil (el modelo no carga o el sombreador no compila en su tarjeta gráfica), se ve el mapa 2D con el motivo debajo (v0.11.1); un fallo de carga se recuerda hasta reabrir la app, para no pedir el modelo sin parar. La app entera tiene además un límite de errores: una pantalla que falla muestra «Algo ha fallado» con el motivo, nunca una pantalla vacía. Las animaciones de los ejercicios siguen con el cuerpo de la ronda 3 hasta la fase 3 de la ronda 5.
- Tests (`src/avatar3d/avatar.test.ts`, `src/domain/cuerpo.test.ts`): el modelo tiene las mismas 48 regiones que la app y todas con superficie; los pesos de las esquinas suman 1; el avatar está en el suelo y mide lo pedido; las articulaciones se recalculan (piernas largas suben la cadera, el cuerpo grueso abre los brazos); el volumen coincide con la tabla; las medidas del cuerpo medio son las de una persona y crecen con el peso; con un peso corriente el avatar pesa lo que la persona (±4 %) con grasa de gimnasio y mucho músculo, y nunca sale gordo ni flaco; mi grasa no lo cambia; ajusta las medidas de cinta (±1,5 cm); el volumen de más agranda hombros, pecho, brazos y piernas sin tocar la cintura; la postura de gimnasio es simétrica, con los brazos cerca del cuerpo sin meterse en él, las palmas hacia dentro y los puños cerrados (la última falange vuelve hacia la muñeca, ninguna yema queda por detrás de los nudillos, los dedos van paralelos, la mano apunta hacia el cuerpo y el pulgar queda junto a los dedos), el relieve del pecho casi no se usa, deja los pies en el suelo, codos y rodillas algo doblados, los brazos abiertos sin meterse en el cuerpo y los hombros atrás, y la respiración vuelve a la postura; los bordes de color se difuminan dentro de la piel; Marina, Katch-McArdle, tendencia del peso, qué grasa vale cada día y el cuerpo de hace N meses.

---

## Ajustes y datos

- Objetivo mensual, objetivo de pasos, altura y edad (y el **perfil corporal** del avatar), descanso por defecto, horas mínimas entre entradas, ubicación y radio del gimnasio, margen de salida, notificación de entrada, **registro de detección**, tema (oscuro por defecto / claro / sistema), pantalla encendida y vibración.
- **Actualizaciones**: versión instalada y "Buscar actualizaciones".
- **Copias de seguridad**: exportar e importar todo en JSON (con migración de copias antiguas) y exportar las series en CSV. Recordatorio discreto en Hoy si llevo más de 2 semanas sin copia.
- **Nutrición**: enlace a "Tu objetivo" y clave opcional de Anthropic.
- **Créditos**: pantalla con cada fuente de datos, modelo o librería y su licencia (`/ajustes/creditos`), y los textos completos en `licencias.txt`.

---

## Diseño

- Interfaz cuidada y con personalidad: oscura por defecto, un color de acento fuerte y números grandes (`tabular-nums`).
- Navegación inferior con 5 pestañas: **Hoy, Rutinas, Nutrición, Progreso, Ajustes**. La biblioteca está dentro de Rutinas. El modo entreno ocupa toda la pantalla.
- Animaciones cortas y sutiles que respeten `prefers-reduced-motion`.

---

## Modelo de datos (Dexie)

Versión 5 (ronda 4): los músculos de `Ejercicio` son los 48 de la división completa; la migración de la 4 a la 5 convierte los de los ejercicios propios y retirados (los de la biblioteca llegan con el catálogo) y no toca nada más.

Versión 7 (ronda 5): los músculos de `Ejercicio` son los 18 grupos de la división simple; la migración de la 6 a la 7 convierte los de los ejercicios propios y retirados (los de la biblioteca llegan con el catálogo, que se vuelve a sincronizar) y no toca nada más. Las copias de seguridad llevan el esquema 7; las antiguas se convierten al importarlas.

Versión 6 (ronda 4, avatar): dos tablas nuevas y vacías, `medidas` (`id, &fecha`: una fila por día con las medidas de cinta tomadas, en cm) y `grasas` (`id, fecha`: `{fecha, pct, origen: 'manual' | 'salud'}`); el sexo y el ajuste fino del avatar van en `Ajustes` (`sexo?`, `ajusteAvatar?`). La migración de la 5 a la 6 no toca nada de lo que había. Las copias de seguridad llevan el esquema 6 con las dos tablas nuevas; las antiguas se importan con ellas vacías.

```
Ejercicio        id, nombre, alias, musculosPrincipales[], musculosSecundarios[], material, categoria,
                 nivel, mecanica, instrucciones[], notasFijas, personalizado, archivado, reinicioProgresion?
Rutina           id, nombre, posicionCiclo, archivada, creada
RutinaEjercicio  id, rutinaId, ejercicioId, orden, series, repsMin, repsMax, descansoSeg, nota, superserieConSiguiente
Entrada          id, hora, origen (deteccion|entreno; enlace|ubicacion|manual solo en datos antiguos), sesionId?, salida?
Sesion           id, rutinaId (null = entreno libre), rutinaNombre, entrada, salida, origenEntrada, estado,
                 ultimaActividad, cierreAutomatico?, descansoFin, descansoDuracion, ejercicioActivoId
SesionEjercicio  id, sesionId, ejercicioId, orden, seriesObjetivo, repsMin, repsMax, descansoSeg, nota,
                 superserieConSiguiente, estado (activo|saltado), sustituyeA?, anadido
Serie            id, sesionId, sesionEjercicioId, ejercicioId, orden, tipo, peso, reps, rir?, completada, hora
Molestia         id, sesionId, ejercicioId, nota, hora
PesoCorporal     id, fecha, kg, origen? (manual|salud)
Ajustes          objetivoMensual, objetivoPasos, alturaCm, edad, descansoDefecto, horasEntreCheckins, gimnasioLat,
                 gimnasioLng, radioM, margenSalidaM, notificarEntrada, tema, wakeLock, vibracion, ultimaCopia, versionCatalogo?
Alimento         id, nombre, marca?, codigo?, origen (off|propio|ia), estado (crudo|cocinado|null), por100, raciones[], creado
RegistroComida   id, fecha, comida, alimentoId, nombre, gramos, racion, valores (copia), hora
Plato            id, nombre, items[{alimentoId, nombre, gramos}], creado, usos
AguaDia          id (fecha), ml
PerfilNutricion  id 'perfil', sexo, objetivo, ritmo, proteinaGkg, inicio, basal, gastoInicial, objetivoKcal,
                 ajustes[], retoActivo, retos[], revisionVista?, entrenoManual?
```

- **v3 → v4** (ronda 3): solo se añaden las tablas de nutrición; todo lo anterior se conserva (test en `src/db/actualizacion.test.ts`). Las copias JSON incluyen la nutrición y las copias antiguas se importan con la nutrición vacía.

- **v1 → v2** (ronda 1): los ejercicios pasan a los id de Free Exercise DB; se cambian todas sus referencias y se conservan notas y ejercicios propios.
- Los cambios de la ronda 2 (biblioteca nueva, objetivo mensual, salida) llegan con nuevas versiones y sus migraciones. Los ejercicios que salen de la biblioteca se conservan para el historial, ocultos en la biblioteca y el selector.
- La detección nativa guarda su configuración, su estado y su registro en el almacenamiento de Android, y pasa a la base de datos las entradas y salidas cuando la app se abre.

---

## Cosas que no deben volver

- Un avatar que cargue el peso en una pierna o ladee la cabeza: la postura es recta y simétrica.
- Cualquier check-in manual, el enlace `?checkin=auto` o `/checkin`, y la detección por ubicación al abrir Ferro.
- Racha semanal u objetivo semanal.
- Campo "salto de peso" en la interfaz.
- Controles para editar músculos o material de un ejercicio.
- Fotos o personas reales en los ejercicios, o mezclar estilos de ilustración.
- Buscador por texto, chips, categorías o filtros para encontrar ejercicios.
- Máquinas guiadas, peso corporal, kettlebell, bandas, balones, cardio o estiramientos en la biblioteca.
- Imágenes o datos cargados de servidores externos en tiempo de ejecución. Únicas excepciones: Open Food Facts al escanear o buscar un producto, y la API de Anthropic solo si pongo mi clave.
- Cambios de base de datos sin migración que conserve los datos, o cambiar el origen de la WebView.
- Un APK firmado con otra clave.
- La división muscular fina en la interfaz: porciones, cabezas o músculos profundos (y la piel translúcida para verlos).

---

## Fases

Hechas: 1–5 (base, rutinas y entreno, check-in, progresión y estadísticas, pulido) y la ronda 1 de mejoras.

**Ronda 2:** hecha (app Android, detección, avatar, biblioteca y buscador por mapa, pantalla principal, animaciones).

**Ronda 3:**

1. **Registro de peso rápido** y acceso directo del icono. *(Hecha, v0.5.0.)*
2. *(Hecha, v0.6.0.)* **Nutrición:** asistente, objetivos adaptativos, registro rápido, escáner, Open Food Facts, base genérica, mis platos, "Cerrar el día", reto de fruta y verdura, revisión semanal y tarjeta en Hoy.
3. *(Hecha, v0.7.0.)* **Modelo 3D y avatar:** flujo con Blender, vista previa para revisión y sustitución de todas las vistas del mapa.
4. *(Hecha, v0.9.0.)* **Animaciones 3D:** piloto de 10 ejercicios (v0.8.0, aprobado) y después toda la biblioteca, en la ficha (escena en vivo) y en las listas (miniaturas animadas). En v0.9.1, cuerpo con más volumen y animaciones que no atraviesan bancos ni cajones, con el material bien agarrado.

**Ronda 4:**

1. *(Hecha, v0.10.0.)* **División muscular completa:** lista completa, auditoría, músculos profundos, reasignación de ejercicios (con el listado para revisión) y migración.
2. *(Hecha, v0.11.0.)* **Avatar personalizado:** base MakeHuman/MPFB (CC0) con morph targets, esqueleto recalculado, perfil corporal (sexo, edad, altura, peso del registro, medidas con fecha, grasa corporal de Health Connect, de la fórmula de la Marina de EE. UU. o a mano), definición muscular según la grasa, ajuste fino con deslizadores, peinados opcionales, evolución con la tendencia del peso, "Antes / Ahora" y Katch-McArdle en nutrición si hay porcentaje de grasa.
3. *(Pasa a la ronda 5, fase 3.)* **Ejercicios con mi avatar:** las animaciones usan mi avatar y se adaptan a mis proporciones (agarre, banco, rack, polea, pies) con cinemática inversa sobre el esqueleto recalculado; las miniaturas se regeneran en segundo plano al cambiar el perfil.
4. *(Pasa a la ronda 5, fase 4.)* **Físicas:** motor de físicas con paso fijo, cápsulas en cada hueso del avatar, barra y mancuernas como cuerpos rígidos, cable de polea como cuerda inextensible que pasa por las ruedas y colisiona con el cuerpo y el banco, agarres (cuerda, barra, triángulo, estribo) que cuelgan con su peso, pila de discos en su guía con el recorrido exacto del cable, multipower con guías y ganchos, banco y suelo estáticos; escenas colocadas como en un gimnasio real (p. ej. en la extensión de tríceps con cuerda el cable baja por delante del cuerpo); test automático de penetraciones con tres tamaños de cuerpo y su informe; física solo en pantalla y 60 fps.

**Ronda 5** (pedida por el chat el 12 de noviembre de 2026; sustituye a las fases 3 y 4 pendientes de la ronda 4):

1. *(Hecha, v0.12.0.)* **División muscular simple:** 18 grupos, mapa y fichas por grupo, catálogo agrupado y migración (base de datos v7 y copias de seguridad).
2. *(Hecha, v0.12.0; pendiente de mi visto bueno antes de la fase 3.)* **Avatar musculado y natural:** la forma de una persona musculada con mi peso y mi altura (ni gorda ni flaca), postura de gimnasio simétrica en vez de la anatómica (v0.12.1), respiración y músculos pintados con bordes suaves.
3. **Ejercicios con mi avatar:** las animaciones usan mi avatar y se adaptan a mis proporciones; las miniaturas se regeneran al cambiar el perfil.
4. **Físicas:** nada choca con nada ni lo atraviesa (cables, barras, mancuernas, discos, bancos, suelo y cuerpo) y todo se agarra bien; test automático de penetraciones con tres tamaños de cuerpo.

**Ronda 2 (detalle):**

1. **App Android:** Capacitor, importación de datos, APK firmado con GitHub Actions, instalación y actualizaciones, aviso nativo de fin de descanso.
2. **Detección:** entrada y salida, registro de detección y README de MacroDroid.
3. **Avatar profesional:** con vista previa para revisarlo.
4. **Biblioteca nueva y buscador por mapa:** con el listado para revisión y la migración de ejercicios.
5. **Pantalla principal:** objetivo mensual, pasos y calorías.
6. **Animaciones:** con galería para revisión.

---

## Criterios de terminado

- `npm run build` sin errores ni avisos de TypeScript; tests pasando (web y nativos) para: progresión, ciclo, objetivo mensual, calorías, intensidad muscular y correspondencia con el avatar, migraciones e importación, y decisión de entrada y salida (distancia, precisión y deduplicación).
- El APK se instala y se actualiza encima sin perder datos, y mis datos de la PWA se han importado.
- Abrir S3 FIT ZONE en el gimnasio registra la entrada sin que Ferro se abra; abrirla en casa no registra nada. La salida se detecta al irme.
- El avatar y todas las animaciones tienen el mismo estilo; no queda ninguna foto real.
- La biblioteca solo tiene peso libre, poleas y multipower, y solo se busca con el mapa.
- No queda ninguna racha ni objetivo semanal.
- Registrar una serie lleva un solo toque.
- Nutrición: tests de gasto inicial, recalibración semanal (también contra la base de datos), reparto de macros, límites de seguridad (basal y 1 %/semana), sugerencias de "Cerrar el día", registro de comidas y validación de lo que devuelve la IA.
- Ronda 4 y 5: cada región del modelo pertenece a uno de los 18 grupos y cada grupo tiene superficie; cada ejercicio tiene sus grupos; el avatar cambia de forma creíble con peso, altura, edad, medidas y grasa; las animaciones usan mi avatar y encajan con mis proporciones; ningún cable ni objeto atraviesa el cuerpo (el test de penetraciones pasa con los tres tamaños de cuerpo); la pila de discos sube y baja de acuerdo con el cable; 60 fps con física; mis datos intactos (entrenos, nutrición, peso e historial semanal de músculos).
- `SPEC.md` y README actualizados.
