# Ferro — Mejoras, ronda 2

Esta ronda incluye un cambio grande: **Ferro pasa de ser una PWA a una app Android nativa (con Capacitor)**. Es la única forma de leer mis pasos (Health Connect solo es accesible desde apps nativas, y las APIs de Google Fit dejan de funcionar a finales de 2026) y de detectar la entrada y la salida del gimnasio en segundo plano sin abrir la app.

## Antes de empezar

1. Lee `SPEC.md`, `MEJORAS-1.md` y el código actual.
2. **Actualiza `SPEC.md`** con este documento. Donde contradiga a `SPEC.md` o a `MEJORAS-1.md`, manda este.
3. Trabaja por las fases del final. Al acabar cada una: compila, pasa los tests, haz commit y dime exactamente cómo probarla en el móvil.
4. Pregúntame solo lo imprescindible.
5. Te vuelvo a adjuntar la imagen de referencia del estilo de figura humana.

**Mis datos:** ya tengo datos reales en la PWA instalada. Al pasar a app nativa **no se transfieren solos**, porque el almacenamiento es distinto. Antes de cambiar nada, comprueba que la exportación a JSON de la versión actual funciona y dime cómo exportar. La app nueva tiene que importar ese archivo sin perder nada: rutinas, entrenos, series, notas y peso corporal.

---

## 1. De PWA a app Android nativa

- Envuelve la app React actual con **Capacitor**, reutilizando todo el código posible. `appId`: `com.ferro.app`, nombre "Ferro", con el icono actual.
- Los datos siguen en Dexie dentro de la app. Añade la importación del JSON exportado desde la PWA.
- **Compilación:** crea un workflow de GitHub Actions que compile un APK de release firmado y lo publique en GitHub Releases. Explícame paso a paso cómo crear la clave de firma y guardarla como secreto. Tiene que ser siempre la misma clave, para poder instalar actualizaciones encima sin perder datos. Documenta también cómo compilar en local con Android Studio.
- En Ajustes, un botón **"Buscar actualizaciones"** que compruebe la última release y abra la descarga del APK.
- Aprovecha que ahora es nativa: el **temporizador de descanso** debe avisar con notificación y vibración aunque la app esté en segundo plano o con la pantalla apagada.
- En el README: cómo instalar el APK en un Xiaomi con HyperOS (permitir la instalación de apps desconocidas y los avisos de seguridad de Xiaomi) y qué ajustes de HyperOS necesita Ferro para funcionar bien: inicio automático, ahorro de batería "Sin restricciones", ubicación "Permitir todo el tiempo", permisos de Health Connect y notificaciones.

---

## 2. Detección de entrada y salida del gimnasio

El método tiene que ser exactamente este: **la entrada se registra cuando abro la app S3 FIT ZONE en el móvil y estoy en la ubicación del gimnasio.** Elimina el enlace `?checkin=auto` y la detección por ubicación al abrir Ferro. Mantén la regla de `MEJORAS-1.md`: si empiezo un entreno sin entrada registrada, la hora de inicio del entreno cuenta como entrada.

### Entrada

- **MacroDroid** solo avisa: disparador "Aplicación abierta → S3 FIT ZONE" y acción "Enviar intent" de tipo Broadcast, **explícito** (con el paquete `com.ferro.app` y la clase del receptor; Android no entrega broadcasts implícitos a receptores declarados en el manifest). Extras: `evento=s3_abierta` y la hora del momento.
- **Ferro decide** con código nativo (Kotlin): un `BroadcastReceiver` recibe el aviso y pide la ubicación **de forma activa en ese momento** (`getCurrentLocation` de alta precisión, con un tiempo máximo de espera y un reintento). No uses geofencing pasivo para la entrada, porque en HyperOS es poco fiable.
- Si la distancia al gimnasio está dentro del radio (por defecto 150 m, configurable, teniendo en cuenta la precisión de la lectura), registra la entrada **con la hora en que se abrió S3 FIT ZONE**. Deduplicación: como máximo una entrada cada 3 h.
- Todo ocurre en segundo plano: **Ferro no puede abrirse encima**, porque en ese momento estoy enseñando el QR en la puerta. Como opción en Ajustes, una notificación discreta tipo "Entrada registrada · 18:04".
- En Ajustes guardo la ubicación del gimnasio con un botón "Estoy en el gimnasio ahora" y ajusto el radio.

### Salida

- Mientras haya una sesión abierta, Ferro comprueba su ubicación de forma activa cada 10–15 minutos. Elige el mecanismo más fiable en HyperOS (WorkManager o un servicio en primer plano ligero solo durante la sesión) y justifica la elección.
- Si el gimnasio tiene WiFi y el móvil se conecta: una segunda macro "WiFi desconectado → [red del gimnasio]" envía otro broadcast (`evento=wifi_desconectada`) y Ferro comprueba la ubicación al momento.
- La salida se confirma con **dos comprobaciones seguidas fuera del radio más un margen** (por ejemplo 300 m). La hora de salida es la primera señal de salida: la desconexión de la WiFi o la primera comprobación fuera.
- Respaldo: si no se detecta la salida en 3 h sin actividad, cierra la sesión con la hora de la última serie más 5 minutos.

### Diagnóstico

- En Ajustes, una pantalla **"Registro de detección"** con los últimos eventos: hora, tipo de evento, distancia, precisión y decisión tomada (entrada registrada, descartada por distancia, duplicada…). La necesito para ajustar el radio y entender fallos.
- En el README, la configuración exacta de las dos macros de MacroDroid.

---

## 3. Avatar muscular en la pantalla principal

El mapa muscular pasa a ser **mi avatar**: aparece en la pantalla principal y pinta los músculos según lo que los he trabajado **esta semana**.

- **Periodo:** semana de lunes a domingo. Se actualiza con cada serie que registro y día a día; el lunes empieza de cero. Encima, una etiqueta pequeña con la semana ("Semana del 2 al 8 nov").
- **Intensidad:** series de la semana por músculo (el principal cuenta 1 y cada secundario 0,5), en 5 niveles fijos: 1–3, 4–6, 7–10, 11–15 y 16 o más series. Gris para los músculos sin trabajar y el color de acento cada vez más intenso, con transiciones suaves.
- **Interacción:** al tocar un músculo se abre una ficha con su nombre, las series de la semana y los ejercicios que lo han trabajado. Vista frontal y trasera.
- **Tiene que verse mucho más profesional:** una ilustración anatómica de calidad, como la imagen de referencia, no un muñeco esquemático:
  - Silueta limpia y proporcionada, con contorno continuo y grosores de línea coherentes.
  - Cada músculo con su propio contorno y sus líneas internas anatómicas.
  - Músculos con detalle suficiente: pectoral (porción superior e inferior), deltoides (anterior, lateral y posterior), bíceps, braquial, tríceps, antebrazo, trapecio, dorsal ancho, zona media de la espalda, lumbares, recto abdominal, oblicuos, glúteo mayor y medio, cuádriceps, isquiotibiales, aductores, gemelos y sóleo.
  - Sombreado sutil para dar volumen, sin perder claridad.
- **Implementación:** busca primero un SVG anatómico de calidad con licencia libre (MIT, CC0 o CC BY; verifica la licencia). Por ejemplo, puedes adaptar a web los trazados de `react-native-body-highlighter` v3 (MIT) y enriquecerlos. Si nada llega al nivel de la referencia, dibuja tu propio SVG.
- **Antes de seguir con el resto**, genera una página de vista previa con el avatar en varios estados (semana vacía, semana media, semana completa) para que lo revise.
- Usa **esta misma figura en toda la app**: ficha del ejercicio, creación de rutinas, resumen del entreno y buscador de ejercicios.

---

## 4. Biblioteca: solo peso libre, poleas y multipower

- **Incluir solo** ejercicios con: barra (olímpica, EZ, hexagonal, landmine), mancuernas, discos, poleas y multipower. El banco se permite como accesorio.
- **Excluir todo lo demás:** máquinas guiadas, peso corporal, kettlebell, bandas, balones, cardio y estiramientos.
- **Que estén TODOS** los ejercicios conocidos que cumplan este criterio. Combina Free Exercise DB (filtrada) con tu propio conocimiento. Cada variante relevante (inclinación del banco, tipo de agarre, unilateral, posición) es un ejercicio propio. Nombres en español tal como se dicen en los gimnasios de España, sin duplicados.
- Cada ejercicio con músculos principales y secundarios usando las mismas regiones del avatar, material e instrucciones en español. Todo de solo lectura, como ya está.
- **Antes de integrarlos**, genera un archivo con el listado completo agrupado por músculo principal para que lo revise.
- **Migración:** los ejercicios que ya tengo en mi historial y quedan fuera (máquinas, etc.) no se borran. Siguen en el historial y las estadísticas, pero desaparecen de la biblioteca y del selector. Si una rutina contiene alguno, márcalo con un aviso y propón el equivalente más parecido de la biblioteca nueva.

---

## 5. Imágenes: animaciones, todas en el mismo estilo

- **Ninguna foto ni persona real.** Quita de la app todas las imágenes de Free Exercise DB.
- Todos los ejercicios con **la misma representación: una ilustración animada**, en el mismo estilo visual que el avatar.
- Primero busca si existe un conjunto de animaciones de ejercicios con licencia que permita usarlo, en un único estilo y que cubra todos los ejercicios. Verifica la licencia. No mezcles estilos de fuentes distintas.
- Si no existe, **crea tu propio sistema de animación**:
  - Una figura vectorial estilizada con esqueleto articulado, sin rostro realista.
  - Material dibujado: barra con discos, mancuernas, polea con cable y anclaje, multipower con sus guías y banco con su inclinación.
  - Cada ejercicio se define con poses clave (inicio y fin) y se anima en bucle de 2–3 s.
  - Construye las poses a partir de patrones de movimiento reutilizables y parametrizados (press, remo, curl, extensión, aperturas, elevaciones, sentadilla, bisagra de cadera, zancada, jalón, encogimientos…), con parámetros como inclinación del banco, agarre o unilateral.
  - Vista lateral o frontal según lo que mejor muestre el movimiento, y biomecánicamente correcto.
- Los músculos principales del ejercicio se resaltan con el color de acento sobre la figura animada.
- Ligero y disponible sin conexión.
- **Antes de darlo por terminado**, genera una galería con todas las animaciones para que las revise.

---

## 6. Buscar ejercicios solo con el mapa

- El **único** método para encontrar ejercicios es el mapa muscular. Elimina el buscador por texto, los chips, las categorías y cualquier otro filtro en toda la app: biblioteca, creación de rutinas, entreno libre y cambio de ejercicio.
- Flujo: figura frontal o trasera → toco un músculo → lista con dos apartados: **"Principal"** (ejercicios cuyo músculo principal es ese) y **"También lo trabajan"** (lo tienen como secundario).
- Cada fila: miniatura de la animación, nombre y una etiqueta pequeña con el material. Orden: primero los que más uso, después alfabético.
- Se mantiene la selección múltiple al crear rutinas.
- Al cambiar un ejercicio durante el entreno, el mapa se abre directamente en el músculo principal del ejercicio actual.

---

## 7. Objetivo mensual en lugar de racha

- Elimina la racha semanal y el objetivo semanal de toda la app.
- **Objetivo mensual:** por defecto 16 días al mes, editable.
- Un día cuenta si hay una entrada registrada o un entreno terminado (como máximo una vez por día).
- **Tarjeta en la pantalla principal:** "9 / 16 días · noviembre", con barra de progreso y uno de estos mensajes:
  - Aún posible: "Puedes saltarte X días más y seguir cumpliéndolo". X = días que quedan en el mes en los que todavía puedo ir − días que me faltan. Hoy cuenta como disponible si todavía no he ido.
  - X = 0: "No puedes saltarte ningún día más".
  - Ya imposible: "Este mes ya no es posible: te faltan N días y quedan M".
  - Conseguido: "Objetivo cumplido", más los días extra que lleve.
- Implementa el cálculo como función pura con tests: principio y final de mes, hoy ya entrenado o no, objetivo cumplido, imposible y meses de 28, 30 y 31 días.
- En Progreso, historial mensual con los meses cumplidos y no cumplidos.

---

## 8. Pasos y calorías en la pantalla principal

- **Pasos desde Health Connect** con un plugin de Capacitor gratuito y mantenido (por ejemplo `@capgo/capacitor-health` o el oficial `@capacitor/health-fitness`; comprueba licencia y coste). Pide solo los permisos necesarios: pasos y peso. Usa la agregación de Health Connect para el total del día, no la suma de muestras sueltas, para no contar pasos dos veces.
- En el README, explica de dónde salen los pasos (la app Google Health, Mi Fitness o el propio móvil escribiendo en Health Connect) y cómo comprobar que llegan.
- **Anillo de pasos:** pasos de hoy frente a un objetivo editable (por defecto 10.000). Se actualiza al abrir o volver a la app y cada pocos minutos mientras está abierta.
- **Al lado, las calorías estimadas de hoy:** "≈ X kcal", con el desglose de pasos y entreno.
  - Datos necesarios: peso (el último del registro de la app o de Health Connect), altura y edad, editables en Ajustes.
  - Pasos: calorías netas de caminar según el peso y la longitud de zancada estimada a partir de la altura. Usa una fórmula estándar y documenta su origen.
  - Entreno: MET de entrenamiento de fuerza (Compendium of Physical Activities) entre aproximadamente 3,5 y 6, elegido según la densidad real de la sesión: duración real (de la entrada a la salida, o de la primera a la última serie), volumen (kg × repeticiones), series por minuto y descansos. Calorías netas = (MET − 1) × peso × horas.
  - No cuentes dos veces los pasos dados dentro del gimnasio durante la sesión.
  - Muéstralo siempre como estimación. Al tocarlo, se abre el desglose y cómo se calcula.
  - Implementa los cálculos como funciones puras con tests.

---

## Pantalla principal (orden)

1. Objetivo mensual.
2. Avatar muscular de la semana.
3. Anillo de pasos y calorías, uno al lado del otro.
4. Botones "Empezar [rutina que toca]" y "Entreno libre".

---

## Fases

1. **App Android:** Capacitor, importación de datos, APK firmado con GitHub Actions, instalación y actualizaciones.
2. **Detección:** entrada y salida, registro de detección y README de MacroDroid.
3. **Avatar profesional:** con vista previa para que lo revise.
4. **Biblioteca nueva y buscador por mapa:** con el listado para revisión y la migración de ejercicios.
5. **Pantalla principal:** objetivo mensual, pasos y calorías.
6. **Animaciones:** con galería para revisión.

---

## Criterios de terminado

- El APK se instala y se actualiza encima sin perder datos, y mis datos de la PWA se han importado.
- Abrir S3 FIT ZONE en el gimnasio registra la entrada sin que Ferro se abra; abrirla en casa no registra nada.
- La salida se detecta al irme del gimnasio.
- El avatar y todas las animaciones tienen el mismo estilo, y no queda ninguna foto real.
- La biblioteca solo tiene ejercicios de peso libre, poleas y multipower, y solo se buscan con el mapa.
- No queda ninguna racha ni objetivo semanal.
- Tests pasando para: objetivo mensual, calorías, intensidad muscular y decisión de entrada y salida (distancia, precisión y deduplicación).
- `SPEC.md` y README actualizados.
