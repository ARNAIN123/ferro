# Ferro — mi app personal de gimnasio

**Ferro** es mi app personal de gimnasio. Es solo para mí (un único usuario, sin cuentas ni login) y la uso en mi móvil Android (Xiaomi 15 con HyperOS). Es una **app Android nativa hecha con Capacitor** sobre la web React de siempre: se instala con un APK, tiene su icono, funciona sin conexión y hace en segundo plano lo que una web no puede (detectar la entrada y la salida del gimnasio, avisar del descanso con la pantalla apagada, leer los pasos de Health Connect).

Su trabajo es este ciclo: **detectar cuándo entro y salgo del gimnasio → saber qué rutina me toca → dejarme registrar el entreno lo más rápido posible → decirme qué peso usar la próxima vez → enseñarme mi progreso, mis músculos de la semana, mis pasos y mi objetivo del mes.**

> Este documento ya incluye las **rondas 1, 2 y 3 de mejoras** (`MEJORAS-1.md`, `MEJORAS-2.md`, `MEJORAS-3.md`). Donde se contradicen, manda la más reciente. Lo que está en "Cosas que no deben volver" se quitó a propósito: no lo reintroduzcas.

---

## Cómo quiero que trabajes

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
- Cada ejercicio con músculos principales y secundarios en las mismas regiones del avatar, material e instrucciones en español. **Todo de solo lectura** salvo mis notas.
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
- **Tabla de correspondencia** músculo de la base de datos → regiones del avatar, con tests.
- Al tocar un músculo se abre una ficha con su nombre en español, sus series en el periodo y los ejercicios que lo han trabajado.

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

## Ajustes y datos

- Objetivo mensual, objetivo de pasos, altura y edad, descanso por defecto, horas mínimas entre entradas, ubicación y radio del gimnasio, margen de salida, notificación de entrada, **registro de detección**, tema (oscuro por defecto / claro / sistema), pantalla encendida y vibración.
- **Actualizaciones**: versión instalada y "Buscar actualizaciones".
- **Copias de seguridad**: exportar e importar todo en JSON (con migración de copias antiguas) y exportar las series en CSV. Recordatorio discreto en Hoy si llevo más de 2 semanas sin copia.

---

## Diseño

- Interfaz cuidada y con personalidad: oscura por defecto, un color de acento fuerte y números grandes (`tabular-nums`).
- Navegación inferior con 4 pestañas: **Hoy, Rutinas, Progreso, Ajustes**. La biblioteca está dentro de Rutinas. El modo entreno ocupa toda la pantalla.
- Animaciones cortas y sutiles que respeten `prefers-reduced-motion`.

---

## Modelo de datos (Dexie)

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
```

- **v1 → v2** (ronda 1): los ejercicios pasan a los id de Free Exercise DB; se cambian todas sus referencias y se conservan notas y ejercicios propios.
- Los cambios de la ronda 2 (biblioteca nueva, objetivo mensual, salida) llegan con nuevas versiones y sus migraciones. Los ejercicios que salen de la biblioteca se conservan para el historial, ocultos en la biblioteca y el selector.
- La detección nativa guarda su configuración, su estado y su registro en el almacenamiento de Android, y pasa a la base de datos las entradas y salidas cuando la app se abre.

---

## Cosas que no deben volver

- Cualquier check-in manual, el enlace `?checkin=auto` o `/checkin`, y la detección por ubicación al abrir Ferro.
- Racha semanal u objetivo semanal.
- Campo "salto de peso" en la interfaz.
- Controles para editar músculos o material de un ejercicio.
- Fotos o personas reales en los ejercicios, o mezclar estilos de ilustración.
- Buscador por texto, chips, categorías o filtros para encontrar ejercicios.
- Máquinas guiadas, peso corporal, kettlebell, bandas, balones, cardio o estiramientos en la biblioteca.
- Imágenes o datos cargados de servidores externos en tiempo de ejecución.
- Cambios de base de datos sin migración que conserve los datos, o cambiar el origen de la WebView.
- Un APK firmado con otra clave.

---

## Fases

Hechas: 1–5 (base, rutinas y entreno, check-in, progresión y estadísticas, pulido) y la ronda 1 de mejoras.

**Ronda 2:** hecha (app Android, detección, avatar, biblioteca y buscador por mapa, pantalla principal, animaciones).

**Ronda 3** (`MEJORAS-3.md`):

1. **Registro de peso rápido** y acceso directo del icono.
2. **Nutrición:** asistente, objetivos adaptativos, registro rápido, escáner, Open Food Facts, base genérica, mis platos, "Cerrar el día", reto de fruta y verdura, revisión semanal y tarjeta en Hoy.
3. **Modelo 3D y avatar:** flujo con Blender, vista previa para revisión y sustitución de todas las vistas del mapa.
4. **Animaciones 3D:** piloto de 10 ejercicios con galería; el resto de la biblioteca solo tras aprobarlo.

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
- `SPEC.md` y README actualizados.
