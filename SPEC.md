# Ferro — mi app personal de gimnasio

Quiero que construyas **Ferro**, mi app personal de gimnasio. Es solo para mí (un único usuario, sin cuentas ni login) y la usaré en mi móvil Android (Xiaomi 15 con HyperOS, navegador Chrome). Tiene que sentirse como cualquier otra app del teléfono: se instala desde Chrome, tiene su icono en la pantalla de inicio, se abre a pantalla completa sin barra del navegador y funciona sin conexión.

Su trabajo es este ciclo: **detectar cuándo entro al gimnasio → saber qué rutina me toca → dejarme registrar el entreno lo más rápido posible → decirme qué peso usar la próxima vez → enseñarme mi progreso.**

> Este documento ya incluye los cambios de la **ronda 1 de mejoras** (`MEJORAS-1.md`). Lo que está en "Cosas que no deben volver" se quitó a propósito: no lo reintroduzcas en fases futuras.

---

## Cómo quiero que trabajes

- Antes de escribir código, lee este documento entero, propón la estructura del proyecto y hazme solo las preguntas imprescindibles (por ejemplo, dónde desplegar).
- Construye por fases (ver "Fases" al final). Al acabar cada fase: compila, pasa los tests, haz commit y dime exactamente cómo probarla en el móvil.
- No añadas dependencias innecesarias. TypeScript estricto, componentes pequeños y la lógica de negocio (progresión, ciclo de rutinas, check-in, intensidad muscular, migraciones) separada de la interfaz en funciones puras con tests.
- Toda la interfaz en español.
- Si algo de este documento no es técnicamente viable en una PWA, dímelo y propón la mejor alternativa en lugar de saltártelo.
- **No rehagas lo que ya funciona.** En cada ronda de mejoras aplica solo lo que se pide y actualiza este documento.

---

## Mis datos son sagrados

Ya tengo datos reales en el móvil (rutinas, entrenos, notas). **Cualquier cambio en la base de datos se hace con una nueva versión de Dexie y una migración (`upgrade`) que conserve todo.** Nunca se borra ni se recrea la base de datos. Cada migración es una función pura con tests (`src/domain/migracion.ts`) y se prueba con una copia de datos de la versión anterior antes de publicar.

---

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS**
- **vite-plugin-pwa** (manifest + service worker con Workbox)
- **Dexie.js** (IndexedDB) con `dexie-react-hooks`. Todos los datos se guardan en el móvil (local-first, sin backend). Llama a `navigator.storage.persist()` al arrancar para que Android no borre los datos.
- **React Router**
- **Recharts** para las gráficas
- **@dnd-kit** para reordenar
- **Vitest** para los tests
- Solo en desarrollo: **sharp** (convierte las imágenes de ejercicios a WebP al generar el catálogo).
- Despliegue gratuito con HTTPS en **Vercel**, necesario para poder instalar la PWA.

---

## Que sea una app de verdad (PWA instalable)

- **Manifest**: `name` "Ferro", `short_name` "Ferro", `display: "standalone"`, `orientation: "portrait"`, `start_url` "/", `theme_color` y `background_color` oscuros, iconos de 192 y 512 px más una versión `maskable`. Icono propio y original (SVG exportado a PNG).
- **Accesos directos del manifest** (aparecen al mantener pulsado el icono): "Empezar entreno" y "Registrar peso".
- **Offline total**: el service worker precachea toda la app (código, catálogo de ejercicios, mapa muscular). La app tiene que abrir y funcionar al 100 % en modo avión.
- **Imágenes de ejercicios**: no se precachean (son ~24 MB). Se sirven desde la propia app con caché *cache-first*: una imagen ya vista funciona sin conexión. En Ajustes hay un botón para descargarlas todas de una vez (ver "Ajustes y datos").
- Respeta las safe areas (`env(safe-area-inset-*)`), sin scroll horizontal y sin zoom accidental al tocar campos.
- **Pantalla encendida** durante el entreno con la Wake Lock API (activable en ajustes).
- Al publicar una versión nueva, la app avisa ("Hay una versión nueva · Actualizar") en lugar de recargarse sola a mitad de un entreno.
- En el README, instrucciones para instalarla en mi Xiaomi. Incluye este aviso: en HyperOS, Chrome necesita tener activado el permiso "Accesos directos en pantalla de inicio"; si no, la instalación puede fallar sin avisar.

---

## Detección de entrada al gimnasio

No hay backend. La entrada se registra **solo de forma automática**, con **deduplicación** (máximo una entrada cada N horas; por defecto 3):

1. **Enlace de check-in**: si la app se abre con `?checkin=auto` (o en la ruta `/checkin`), registra la entrada con la hora actual y abre directamente el entreno del día. Lo uso desde MacroDroid.
2. **Ubicación al abrir**: en ajustes guardo la ubicación del gimnasio con un botón "Estoy en el gimnasio ahora" que captura las coordenadas, y un radio (por defecto 200 m). Cada vez que la app pasa a primer plano, si estoy dentro del radio y no hay una entrada reciente, la registra sola.
3. **Respaldo al empezar un entreno**: si empiezo un entreno (de rutina o libre) y no hay ninguna entrada en las últimas N horas porque la detección automática falló, se usa la hora de inicio del entreno como hora de entrada, sin preguntar. Su origen se guarda como `entreno`.

**No hay botón manual de check-in** en ninguna pantalla.

Cada entrada guarda la hora y el origen (`enlace`, `ubicacion` o `entreno`; `manual` solo existe en datos antiguos). La **hora de salida** es cuando pulso "Terminar entreno". Si no lo pulso, la sesión se cierra sola tras 3 h sin actividad, usando la hora de la última serie registrada.

En el README, explica cómo configurar **MacroDroid**:
- Disparador: "Aplicación cerrada" → la app donde tengo el QR del gimnasio.
- Restricción: conectado a la WiFi del gimnasio, y que la macro no se haya ejecutado en las últimas 3 h.
- Acción: abrir Ferro con el enlace de check-in.
- Alternativa, por si Android abre el enlace en Chrome en vez de en la app instalada: acción "Abrir aplicación" → Ferro, y que la detección por ubicación haga el check-in.

---

## Rutinas en ciclo

- Creo rutinas (por ejemplo "A — Torso", "B — Pierna") y las ordeno en un **ciclo**. La app sabe cuál toca según la última que hice, no según el día de la semana. Siempre puedo elegir otra.
- Cada ejercicio de una rutina tiene: número de series, rango de repeticiones (ej. 8–12), descanso, nota y si va en superserie con el siguiente.
- Reordenar el ciclo arrastrando, duplicar rutinas y archivarlas.
- Plantillas iniciales opcionales para empezar rápido: Full Body 3 días, Torso/Pierna y Push/Pull/Legs.

### Crear y editar una rutina (una sola pantalla)

- **Flujo:** nombre → añadir ejercicios → ajustar → guardar. Sin formularios ni pantallas intermedias.
- **Selector de ejercicios** a pantalla completa: buscador (español o inglés), filtros por categoría, músculo (chips o tocando el mapa) y material, miniatura de la imagen en cada fila y **selección múltiple** para añadir varios de golpe. Es el mismo selector que se usa en el entreno.
- Cada ejercicio entra con valores por defecto: **3 series, 8–12 repeticiones y 90 s de descanso**; **150 s** en los compuestos grandes (compuesto, con barra/mancuernas/máquina/kettlebell y un músculo principal grande). Todo editable en línea con botones +/−.
- Reordenar arrastrando y agrupar en **superserie** con un botón entre dos ejercicios.
- Debajo de la lista, **mapa muscular en vivo** de la rutina y un **aviso suave** si algún grupo muscular grande (pecho, espalda, hombros, cuádriceps, isquiotibiales, glúteos) no se trabaja en ningún día del ciclo.
- **Crear una rutina a partir de un entreno hecho** (incluido un entreno libre): desde el resumen ("Guardar como rutina") o desde el detalle del historial ("Crear rutina a partir de este entreno"), se abre el editor ya relleno con sus ejercicios.
- **Duplicar** una rutina desde la lista.

---

## Biblioteca de ejercicios

- **Fuente:** [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (dominio público, Unlicense), fijada a un commit concreto en `catalogo/fuente/`. ~876 ejercicios más unos 14 añadidos a mano (máquinas habituales que faltan: hip thrust en máquina, sentadilla péndulo, press en máquina convergente, remo en máquina T…). Total: 890.
- **Traducción hecha una sola vez**, no en tiempo de ejecución: nombres con los que se conocen en los gimnasios de España (`catalogo/nombres-*.tsv`), instrucciones (`catalogo/instrucciones-*.txt`), músculos, material y categoría. El nombre original en inglés se guarda como **alias**, para que la búsqueda funcione en los dos idiomas.
- `npm run catalogo` genera `src/catalogo/ejercicios.json` y su versión. Con `-- --imagenes <ruta>` además convierte las imágenes a WebP (`public/img/ejercicios/<id>/<n>.webp`, posición inicial y final).
- **Imágenes servidas por la propia app**, nunca enlazadas a GitHub. Si un ejercicio no tiene imagen libre, se muestra su mapa muscular en su lugar.
- Al arrancar, el catálogo se sincroniza con la base de datos si su versión ha cambiado, sin tocar mis notas ni mis ejercicios propios.
- **Filtros:** texto (nombre en español o alias en inglés, sin tildes; primero las coincidencias exactas), categoría (fuerza, halterofilia, strongman, pliometría, cardio, estiramientos; **por defecto, fuerza**), músculo (chips o mapa) y material.
- **Ejercicios propios**, solo para lo que no exista: al crearlo elijo nombre, material y músculos tocando el mapa (un toque principal, dos secundario, tres quitar). Después sus músculos y material quedan fijos como los demás. Se pueden archivar.
- Cada ejercicio guarda mis **notas fijas** (ajustes de la máquina: altura del asiento, agarre…), que se muestran durante el entreno.

### Ficha del ejercicio

- Imagen grande que **alterna posición inicial y final**.
- Músculos principales y secundarios **listados en español y marcados en el mapa** (principales a intensidad máxima, secundarios suave).
- Material, nivel, mecánica e instrucciones paso a paso en español.
- Mi historial, mi récord (1RM estimado, mejor serie, peso máximo) y su gráfica.
- **Mis notas son lo único editable.** Músculos y material son de solo lectura.

---

## Mapa muscular

- Figura anatómica **detallada en gris neutro** (no un muñeco plano), vista frontal y trasera una al lado de la otra, en tema oscuro y claro. Trazados de `react-native-body-highlighter` (MIT) extraídos como datos a `src/components/mapa/trazados.ts` con `scripts/generar-mapa.mjs`; el sombreado es propio.
- Músculos sin trabajar en gris; trabajados con el **color de acento en 5 niveles** de intensidad, con leyenda pequeña.
- **Intensidad** (función pura con tests, `src/domain/mapaMuscular.ts`): cada serie completada cuenta **1** para los músculos principales del ejercicio y **0,5** para los secundarios. Los niveles se calculan con una escala por contexto: sesión o rutina (1 · 2–3 · 4–5 · 6–8 · 9+ series) o semana (1–3 · 4–7 · 8–11 · 12–15 · 16+ series; en periodos de más de una semana, media semanal).
- **Tabla de correspondencia** músculo de la base de datos → regiones del mapa (por ejemplo `hombros` → deltoides, `abdomen` → abdominales y oblicuos), también con tests.
- **Al tocar un músculo**: su nombre en español, las series que lleva en el periodo y qué ejercicios lo han trabajado.
- **Dónde aparece:** resumen al terminar un entreno (esa sesión), Progreso (esta semana / últimos 7 días / últimos 30 días), ficha del ejercicio, editor de rutinas (vista previa en vivo), filtro de la biblioteca y selector, y creación de ejercicios propios.

---

## Modo entreno (lo más importante: tiene que ser rapidísimo)

- Pantalla completa, una tarjeta por ejercicio y botones grandes (mínimo 48 px), usable con una mano y el pulgar.
- Cada serie aparece **prerrellenada** con el peso y las repeticiones de la última vez. Completar una serie es **un solo toque**.
- **Botones +/− del peso**: el incremento lo decide solo el material del ejercicio — barra y barra Z 2,5 kg, mancuernas 2 kg, kettlebell 4 kg, máquinas y poleas 5 kg (resto 2,5 kg). No es configurable.
- **Mantener pulsado el valor** del peso (o de las repeticiones) abre el teclado numérico para escribir cualquier valor exacto. Un toque corto no abre el teclado.
- Al completar una serie arranca solo el **temporizador de descanso**. Se calcula a partir de una hora de fin (no acumulando con `setInterval`), para que siga siendo correcto si salgo de la app y vuelvo. Vibración al terminar si la app está abierta.
- Tipos de serie: calentamiento, normal y drop set. Campo opcional de RIR (repeticiones en reserva).
- Cambiar un ejercicio por una alternativa del mismo músculo principal (por si la máquina está ocupada), añadir ejercicios sobre la marcha con el selector múltiple o saltarlo.
- Marcar "molestia" en un ejercicio, con nota opcional, y que quede visible en su historial.
- El entreno en curso se guarda en IndexedDB tras cada cambio: si cierro la app o se reinicia el móvil, al abrirla lo retomo exactamente donde estaba.
- Vibración breve (`navigator.vibrate`) al completar una serie.
- Al terminar: resumen con duración, series, volumen total, **mapa de músculos trabajados**, récords conseguidos, comparación con la última vez que hice esa rutina y botón **"Guardar como rutina"**.

### Entreno libre

- Botón **"Entreno libre"** en Hoy, junto al de empezar la rutina que toca.
- Empieza vacío y añado ejercicios con el mismo selector de las rutinas.
- Funciona igual que un entreno normal: prerrellenado con la última vez, descanso y sugerencias de progresión.
- Al terminar, opción **"Guardar como rutina"**.
- **No avanza el ciclo**: después sigue tocando la misma rutina que antes.

---

## Progresión automática

Implementa todo esto como funciones puras con tests:

- **Doble progresión**: si en la última sesión completé todas las series en el máximo del rango, sugiere subir el peso con el incremento de su material y volver al mínimo de repeticiones. Si no, sugiere mantener el peso e intentar subir repeticiones.
- Si registré RIR y fue 0 en la mayoría de las series, no sugerir subir peso aunque llegara al máximo del rango.
- **Estancamiento**: 3 sesiones seguidas sin mejorar en un ejercicio (ni peso ni repeticiones) → aviso con dos opciones: bajar un 10 % y reconstruir, o cambiar de ejercicio.
- La sugerencia se muestra como una etiqueta discreta junto al ejercicio ("↑ 2,5 kg", "+1 rep"). Al tocarla se aplica a las series; nunca cambia valores sin que yo la toque.

---

## Pantalla de inicio ("Hoy")

- Si no he entrenado hoy: "Hoy toca: B — Pierna" con un botón grande "Empezar" y, a su lado, **"Entreno libre"**. Debajo, "Elegir otra rutina".
- Si hay una entrada reciente: "En el gimnasio desde las 18:05 · enlace/ubicación/inicio del entreno". Sin botón para registrarla a mano.
- Si hay un entreno en curso: botón para retomarlo.
- Semana actual: días entrenados frente a mi objetivo semanal (por defecto 4, configurable) y racha de **semanas** seguidas cumpliéndolo. Nada de rachas diarias: descansar no debe romper nada.
- Resumen del último entreno.

---

## Progreso y estadísticas

- Calendario de asistencia tipo mapa de calor (estilo GitHub), asistencia por semana y duración media de las sesiones.
- **Músculos trabajados**: mapa muscular con selector de periodo (esta semana, últimos 7 días, últimos 30 días) y, debajo, las series por grupo muscular (el principal cuenta 1 y cada secundario 0,5) con una franja de referencia de 10–20 series por semana.
- Por ejercicio: gráfica del 1RM estimado (fórmula de Epley), mejor serie, volumen e historial completo.
- Lista de récords personales.
- Peso corporal (opcional): registro rápido y gráfica con media móvil de 7 días.

---

## Ajustes y datos

- Objetivo semanal, descanso por defecto, horas mínimas entre check-ins, ubicación y radio del gimnasio, enlace de check-in para MacroDroid, tema (oscuro por defecto / claro / sistema), pantalla encendida y vibración durante el entreno.
- **Imágenes de los ejercicios**: botón "Descargar todas las imágenes para usar sin conexión", con barra de progreso, cuántas hay guardadas y el tamaño total.
- **Copias de seguridad**: exportar e importar todo en JSON y exportar las series en CSV. Si llevo más de 2 semanas sin hacer copia, mostrar un recordatorio discreto en "Hoy".

---

## Diseño

- Interfaz cuidada y con personalidad, no una plantilla genérica: oscura por defecto, un color de acento fuerte y números grandes y legibles (`tabular-nums`) para pesos y repeticiones.
- Navegación inferior con 4 pestañas: **Hoy, Rutinas, Progreso, Ajustes**. La biblioteca de ejercicios está dentro de Rutinas. El modo entreno ocupa toda la pantalla, sin barra inferior.
- Animaciones cortas y sutiles que respeten `prefers-reduced-motion`.

---

## Modelo de datos (Dexie, versión 2)

```
Ejercicio        id, nombre, alias, musculosPrincipales[], musculosSecundarios[], material, categoria,
                 nivel, mecanica, instrucciones[], imagenes (0–2), notasFijas, personalizado, archivado,
                 reinicioProgresion?
Rutina           id, nombre, posicionCiclo, archivada, creada
RutinaEjercicio  id, rutinaId, ejercicioId, orden, series, repsMin, repsMax, descansoSeg, nota, superserieConSiguiente
Entrada          id, hora, origen (enlace|ubicacion|entreno|manual antiguo), sesionId?
Sesion           id, rutinaId (null = entreno libre), rutinaNombre, entrada, salida, origenEntrada, estado (en_curso|terminada),
                 ultimaActividad, cierreAutomatico?, descansoFin, descansoDuracion, ejercicioActivoId
SesionEjercicio  id, sesionId, ejercicioId, orden, seriesObjetivo, repsMin, repsMax, descansoSeg, nota,
                 superserieConSiguiente, estado (activo|saltado), sustituyeA?, anadido
Serie            id, sesionId, sesionEjercicioId, ejercicioId, orden, tipo (calentamiento|normal|drop), peso, reps, rir?, completada, hora
Molestia         id, sesionId, ejercicioId, nota, hora
PesoCorporal     id, fecha, kg
Ajustes          objetivoSemanal, descansoDefecto, horasEntreCheckins, gimnasioLat, gimnasioLng, radioM, tema, wakeLock,
                 vibracion, ultimaCopia, versionCatalogo?
```

- **Versión 1 → 2**: los ejercicios pasan a los id de Free Exercise DB. La migración cambia el id en rutinas, entrenos, series y molestias, conserva las notas fijas en el ejercicio nuevo y mantiene los ejercicios propios (con sus músculos traducidos a la nueva lista). Ya no existe `saltoPeso` ni `musculoPrincipal` único.

---

## Cosas que no deben volver

- Botón manual "He llegado al gimnasio" (o cualquier check-in manual).
- Campo "salto de peso" en cualquier parte de la interfaz.
- Controles para editar músculos o material de un ejercicio (también de los propios, una vez creados).
- Biblioteca pequeña escrita a mano, o imágenes enlazadas a servidores externos en tiempo de ejecución.
- Cambios de base de datos sin migración que conserve los datos.

---

## Fases

1. **Base instalable**: proyecto, PWA instalable y offline, navegación, base de datos, biblioteca de ejercicios y despliegue. Al acabar esta fase quiero poder instalarla ya en el móvil.
2. **Rutinas y entreno**: rutinas en ciclo, modo entreno completo con prerrellenado, temporizador, recuperación del entreno en curso e historial.
3. **Check-in**: detección automática, la pantalla "Hoy" y el README con la configuración de MacroDroid.
4. **Progresión y estadísticas**: motor de progresión con tests, gráficas, récords y peso corporal.
5. **Pulido**: copias de seguridad, accesos directos, ajustes y revisión de rendimiento y accesibilidad (Lighthouse).
6. **Mejoras, ronda 1** (`MEJORAS-1.md`): sin check-in manual, mapa muscular con intensidad, biblioteca Free Exercise DB traducida con imágenes, ficha de solo lectura, incremento por material, editor de rutinas en una pantalla y entreno libre.

---

## Criterios de terminado

- `npm run build` sin errores ni avisos de TypeScript, y tests pasando para la progresión, el ciclo de rutinas, la deduplicación del check-in, la intensidad muscular, la correspondencia de músculos con el mapa y las migraciones de datos.
- Mis datos siguen ahí después de cada actualización.
- La app se instala desde Chrome en Android, se abre sin barra del navegador y funciona en modo avión.
- Registrar una serie lleva un solo toque.
- Todos los ejercicios de la biblioteca tienen imagen (o su mapa muscular como sustituto) y sus músculos en español.
- README con: cómo ejecutarla en local, cómo desplegarla, cómo instalarla y actualizarla en el Xiaomi, cómo configurar MacroDroid y cómo regenerar el catálogo.
