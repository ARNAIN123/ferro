# Ferro — mi app personal de gimnasio

Quiero que construyas **Ferro**, mi app personal de gimnasio. Es solo para mí (un único usuario, sin cuentas ni login) y la usaré en mi móvil Android (Xiaomi 15 con HyperOS, navegador Chrome). Tiene que sentirse como cualquier otra app del teléfono: se instala desde Chrome, tiene su icono en la pantalla de inicio, se abre a pantalla completa sin barra del navegador y funciona sin conexión.

Su trabajo es este ciclo: **detectar cuándo entro al gimnasio → saber qué rutina me toca → dejarme registrar el entreno lo más rápido posible → decirme qué peso usar la próxima vez → enseñarme mi progreso.**

---

## Cómo quiero que trabajes

- Antes de escribir código, lee este documento entero, propón la estructura del proyecto y hazme solo las preguntas imprescindibles (por ejemplo, dónde desplegar).
- Construye por fases (ver "Fases" al final). Al acabar cada fase: compila, pasa los tests, haz commit y dime exactamente cómo probarla en el móvil.
- No añadas dependencias innecesarias. TypeScript estricto, componentes pequeños y la lógica de negocio (progresión, ciclo de rutinas, check-in) separada de la interfaz en funciones puras con tests.
- Toda la interfaz en español.
- Si algo de este documento no es técnicamente viable en una PWA, dímelo y propón la mejor alternativa en lugar de saltártelo.

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
- Despliegue gratuito con HTTPS (Vercel o GitHub Pages; pregúntame), necesario para poder instalar la PWA.

---

## Que sea una app de verdad (PWA instalable)

- **Manifest**: `name` "Ferro", `short_name` "Ferro", `display: "standalone"`, `orientation: "portrait"`, `start_url` "/", `theme_color` y `background_color` oscuros, iconos de 192 y 512 px más una versión `maskable`. Diseña tú un icono sencillo y original (SVG exportado a PNG).
- **Accesos directos del manifest** (aparecen al mantener pulsado el icono): "Empezar entreno" y "Registrar peso".
- **Offline total**: el service worker precachea todo. La app tiene que abrir y funcionar al 100 % en modo avión.
- Respeta las safe areas (`env(safe-area-inset-*)`), sin scroll horizontal y sin zoom accidental al tocar campos.
- **Pantalla encendida** durante el entreno con la Wake Lock API (activable en ajustes).
- En el README, instrucciones para instalarla en mi Xiaomi. Incluye este aviso: en HyperOS, Chrome necesita tener activado el permiso "Accesos directos en pantalla de inicio"; si no, la instalación puede fallar sin avisar.

---

## Detección de entrada al gimnasio

No hay backend. La entrada se registra por tres vías, con **deduplicación** (máximo una entrada cada N horas; por defecto 3):

1. **Enlace de check-in**: si la app se abre con `?checkin=auto` (o en la ruta `/checkin`), registra la entrada con la hora actual y abre directamente el entreno del día. Lo usaré desde MacroDroid.
2. **Ubicación al abrir**: en ajustes guardo la ubicación del gimnasio con un botón "Estoy en el gimnasio ahora" que captura las coordenadas, y un radio (por defecto 200 m). Cada vez que la app pasa a primer plano, si estoy dentro del radio y no hay una entrada reciente, la registra sola.
3. **Manual**: botón "He llegado al gimnasio" en la pantalla de inicio.

Cada entrada guarda la hora y el origen (enlace, ubicación o manual). La **hora de salida** es cuando pulso "Terminar entreno". Si no lo pulso, la sesión se cierra sola tras 3 h sin actividad, usando la hora de la última serie registrada.

En el README, explica cómo configurar **MacroDroid**:
- Disparador: "Aplicación cerrada" → la app donde tengo el QR del gimnasio.
- Restricción: conectado a la WiFi del gimnasio, y que la macro no se haya ejecutado en las últimas 3 h.
- Acción: abrir Ferro con el enlace de check-in.
- Alternativa, por si Android abre el enlace en Chrome en vez de en la app instalada: acción "Abrir aplicación" → Ferro, y que la detección por ubicación haga el check-in.

---

## Rutinas en ciclo

- Creo rutinas (por ejemplo "A — Torso", "B — Pierna") y las ordeno en un **ciclo**. La app sabe cuál toca según la última que hice, no según el día de la semana. Siempre puedo elegir otra.
- Cada ejercicio de una rutina tiene: número de series, rango de repeticiones (ej. 8–12), descanso, nota y si va en superserie con el siguiente.
- Reordenar arrastrando, duplicar rutinas y archivarlas.
- Plantillas iniciales opcionales para empezar rápido: Full Body 3 días, Torso/Pierna y Push/Pull/Legs.

---

## Biblioteca de ejercicios

- Incluye unos 80 ejercicios comunes con nombre en español (máquinas, barra, mancuernas, poleas y peso corporal). Cada uno con músculo principal, músculos secundarios, tipo de material y salto de peso por defecto (barra 2,5 kg, mancuernas 2 kg, máquinas 5 kg; editable por ejercicio).
- Puedo crear, editar y archivar ejercicios propios.
- Cada ejercicio guarda mis **notas fijas** (ajustes de la máquina: altura del asiento, agarre…), que se muestran durante el entreno.

---

## Modo entreno (lo más importante: tiene que ser rapidísimo)

- Pantalla completa, una tarjeta por ejercicio y botones grandes (mínimo 48 px), usable con una mano y el pulgar.
- Cada serie aparece **prerrellenada** con el peso y las repeticiones de la última vez. Completar una serie es **un solo toque**. Para ajustar, botones +/− que usan el salto de peso del ejercicio.
- Al completar una serie arranca solo el **temporizador de descanso**. Calcúlalo a partir de una hora de fin (no acumulando con `setInterval`), para que siga siendo correcto si salgo de la app y vuelvo. Vibración al terminar si la app está abierta.
- Tipos de serie: calentamiento, normal y drop set. Campo opcional de RIR (repeticiones en reserva).
- Cambiar un ejercicio por una alternativa del mismo músculo principal (por si la máquina está ocupada), añadir un ejercicio sobre la marcha o saltarlo.
- Marcar "molestia" en un ejercicio, con nota opcional, y que quede visible en su historial.
- El entreno en curso se guarda en IndexedDB tras cada cambio: si cierro la app o se reinicia el móvil, al abrirla lo retomo exactamente donde estaba.
- Vibración breve (`navigator.vibrate`) al completar una serie.
- Al terminar: resumen con duración, series, volumen total, récords conseguidos y comparación con la última vez que hice esa rutina.

---

## Progresión automática

Implementa todo esto como funciones puras con tests:

- **Doble progresión**: si en la última sesión completé todas las series en el máximo del rango, sugiere subir el peso con el salto del ejercicio y volver al mínimo de repeticiones. Si no, sugiere mantener el peso e intentar subir repeticiones.
- Si registré RIR y fue 0 en la mayoría de las series, no sugerir subir peso aunque llegara al máximo del rango.
- **Estancamiento**: 3 sesiones seguidas sin mejorar en un ejercicio (ni peso ni repeticiones) → aviso con dos opciones: bajar un 10 % y reconstruir, o cambiar de ejercicio.
- La sugerencia se muestra como una etiqueta discreta junto al ejercicio ("↑ 2,5 kg", "+1 rep"). Al tocarla se aplica a las series; nunca cambia valores sin que yo la toque.

---

## Pantalla de inicio ("Hoy")

- Si no he entrenado hoy: "Hoy toca: B — Pierna" con un botón grande "Empezar".
- Si hay un entreno en curso: botón para retomarlo.
- Semana actual: días entrenados frente a mi objetivo semanal (por defecto 4, configurable) y racha de **semanas** seguidas cumpliéndolo. Nada de rachas diarias: descansar no debe romper nada.
- Resumen del último entreno.

---

## Progreso y estadísticas

- Calendario de asistencia tipo mapa de calor (estilo GitHub), asistencia por semana y duración media de las sesiones.
- Por ejercicio: gráfica del 1RM estimado (fórmula de Epley), mejor serie, volumen e historial completo.
- Series por grupo muscular y semana (el músculo principal cuenta 1 y cada secundario 0,5), con una franja de referencia de 10–20 series.
- Lista de récords personales.
- Peso corporal (opcional): registro rápido y gráfica con media móvil de 7 días.

---

## Ajustes y datos

- Objetivo semanal, descanso por defecto, horas mínimas entre check-ins, ubicación y radio del gimnasio, tema (oscuro por defecto / claro / sistema) y pantalla encendida durante el entreno.
- **Copias de seguridad**: exportar e importar todo en JSON y exportar las series en CSV. Si llevo más de 2 semanas sin hacer copia, mostrar un recordatorio discreto en "Hoy".

---

## Diseño

- Interfaz cuidada y con personalidad, no una plantilla genérica: oscura por defecto, un color de acento fuerte y números grandes y legibles (`tabular-nums`) para pesos y repeticiones.
- Navegación inferior con 4 pestañas: **Hoy, Rutinas, Progreso, Ajustes**. El modo entreno ocupa toda la pantalla, sin barra inferior.
- Animaciones cortas y sutiles que respeten `prefers-reduced-motion`.

---

## Modelo de datos (orientativo; mejóralo si lo ves necesario)

```
Ejercicio        id, nombre, musculoPrincipal, musculosSecundarios[], material, saltoPeso, notasFijas, personalizado, archivado
Rutina           id, nombre, posicionCiclo, archivada
RutinaEjercicio  id, rutinaId, ejercicioId, orden, series, repsMin, repsMax, descansoSeg, nota, superserieConSiguiente
Sesion           id, rutinaId, entrada, salida, origenEntrada (enlace|ubicacion|manual), estado (en_curso|terminada)
Serie            id, sesionId, ejercicioId, orden, tipo (calentamiento|normal|drop), peso, reps, rir?, completada, hora
Molestia         id, sesionId, ejercicioId, nota
PesoCorporal     id, fecha, kg
Ajustes          objetivoSemanal, descansoDefecto, horasEntreCheckins, gimnasioLat, gimnasioLng, radioM, tema, wakeLock, ultimaCopia
```

---

## Fases

1. **Base instalable**: proyecto, PWA instalable y offline, navegación, base de datos, biblioteca de ejercicios y despliegue. Al acabar esta fase quiero poder instalarla ya en el móvil.
2. **Rutinas y entreno**: rutinas en ciclo, modo entreno completo con prerrellenado, temporizador, recuperación del entreno en curso e historial.
3. **Check-in**: las tres vías de detección, la pantalla "Hoy" y el README con la configuración de MacroDroid.
4. **Progresión y estadísticas**: motor de progresión con tests, gráficas, récords y peso corporal.
5. **Pulido**: copias de seguridad, accesos directos, ajustes y revisión de rendimiento y accesibilidad (Lighthouse).

---

## Criterios de terminado

- `npm run build` sin errores ni avisos de TypeScript, y tests pasando para la progresión, el ciclo de rutinas y la deduplicación del check-in.
- La app se instala desde Chrome en Android, se abre sin barra del navegador y funciona en modo avión.
- Registrar una serie lleva un solo toque.
- README con: cómo ejecutarla en local, cómo desplegarla, cómo instalarla en el Xiaomi y cómo configurar MacroDroid.
