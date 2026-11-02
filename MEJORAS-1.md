# Ferro — Mejoras, ronda 1

La base de la app está muy bien: **no rehagas lo que ya funciona**. Aplica solo los cambios de este documento.

## Antes de empezar

1. Lee `SPEC.md` y revisa el código actual.
2. **Actualiza `SPEC.md`** con todos estos cambios, para que en fases futuras no vuelvan a aparecer cosas que he pedido quitar.
3. Propón un plan breve con el orden en que vas a hacer los cambios y empieza. Pregúntame solo si algo es realmente ambiguo.
4. Te adjunto una **imagen de referencia** del estilo de figura humana que quiero para el mapa muscular (punto 2).

**Muy importante:** ya tengo datos reales guardados en el móvil (rutinas, entrenos y notas). Cualquier cambio en la base de datos tiene que hacerse con una migración de versión de Dexie que conserve todo. No puedo perder nada.

---

## 1. Quitar el botón de check-in manual

- Elimina de toda la app el botón "He llegado al gimnasio". No era lo que quería: la entrada al gimnasio se registra **solo de forma automática** (enlace desde MacroDroid y ubicación al abrir la app).
- Si empiezo un entreno y no hay ninguna entrada registrada en las últimas horas (porque la detección automática falló), usa la hora de inicio del entreno como hora de entrada, sin preguntarme nada. Guarda su origen como `entreno`.

---

## 2. Mapa muscular con intensidad

Quiero una figura del cuerpo humano que marque los músculos trabajados, **más intensos cuanto más se han trabajado**.

- **Estilo:** silueta anatómica detallada, en gris neutro, como la imagen de referencia adjunta. Nada de un muñeco plano o esquemático. Vista frontal y trasera (una al lado de la otra o con un cambio rápido entre ambas).
- **Color:** los músculos sin trabajar en gris. Los trabajados, con el color de acento de la app en una escala de 4–5 niveles de intensidad, más una leyenda pequeña.
- **Cálculo de la intensidad:** cada serie cuenta 1 para los músculos principales del ejercicio y 0,5 para los secundarios. Haz esto como función pura con tests.
- **Dónde aparece:**
  - En el **resumen al terminar un entreno**: músculos trabajados en esa sesión.
  - En **Progreso**: con selector de periodo (esta semana, últimos 7 días, últimos 30 días).
  - En la **ficha de cada ejercicio**: músculos principales a intensidad máxima y secundarios a intensidad suave.
  - Al **crear o editar una rutina**: vista previa en vivo de los músculos que cubre.
- **Interacción:** al tocar un músculo se muestra su nombre en español, las series que lleva en el periodo y qué ejercicios lo han trabajado.
- **Implementación:** puedes partir de una librería SVG de mapa muscular (por ejemplo `react-body-highlighter` o su fork `body-highlighter`) si el resultado se puede acercar a la imagen de referencia. Si no, dibuja tu propio SVG anatómico con cada músculo como una región independiente. Crea una tabla de correspondencia entre los músculos de la base de datos de ejercicios y las regiones del mapa (por ejemplo, "shoulders" → deltoides frontal y posterior).

---

## 3. Biblioteca completa de ejercicios con imágenes

Quiero que estén **todos** los ejercicios que se hacen en un gimnasio, cada uno con imagen de referencia.

- **Fuente:** sustituye la biblioteca actual por **Free Exercise DB** (https://github.com/yuhonas/free-exercise-db). Es de dominio público (Unlicense) y tiene unos 870 ejercicios con imágenes de demostración (posición inicial y final), músculos principales y secundarios, material, nivel e instrucciones.
- **Traducción al español:** traduce nombres, instrucciones, músculos y material en un archivo de traducciones generado una sola vez (no en tiempo de ejecución). Usa los nombres con los que se conocen los ejercicios en los gimnasios de España (por ejemplo "Press de banca", "Jalón al pecho", "Peso muerto rumano"). Guarda el nombre original en inglés como alias, para que la búsqueda funcione en los dos idiomas.
- **Imágenes:** descárgalas al proyecto (no las enlaces a GitHub en tiempo de ejecución), conviértelas a WebP optimizado y sírvelas desde la propia app. Usa caché "cache-first" para que una imagen ya vista funcione sin conexión. En Ajustes, añade un botón "Descargar todas las imágenes para usar sin conexión" que muestre el progreso y el tamaño total.
- **Ejercicios que falten:** revisa si faltan ejercicios habituales de un gimnasio moderno, sobre todo máquinas (hip thrust en máquina, sentadilla péndulo, sentadilla hack, prensa inclinada, press en máquina convergente, remo en máquina T, curl femoral sentado, etc.). Añádelos con sus músculos y material bien informados. Si no hay imagen libre para alguno, muestra en su lugar el mapa muscular del ejercicio.
- **Migración:** relaciona los ejercicios que ya uso con los nuevos para no perder mi historial ni mis notas. Si alguno no tiene un equivalente claro, pregúntame.
- **Filtros:** búsqueda por nombre, por músculo (con chips o tocando el mapa muscular), por material y por categoría (fuerza, estiramientos, cardio, pliometría…). Por defecto, mostrar los de fuerza.

---

## 4. Ficha del ejercicio: bien informada y sin campos editables

- Imagen de referencia grande, alternando posición inicial y final.
- Músculos principales y secundarios listados en español **y** marcados en el mapa muscular.
- Material, nivel e instrucciones paso a paso en español.
- Mi historial y mi récord en ese ejercicio.
- **Mis notas: es lo único editable** y quiero mantenerlo tal como está ahora.
- **Músculos principales, músculos secundarios y material son de solo lectura.** Quita cualquier control para editarlos.
- Ejercicios personalizados (solo para lo que no exista en la biblioteca): al crearlo elijo sus músculos tocando el mapa y su material. Después quedan fijos igual que los demás.

---

## 5. Quitar el "salto de peso"

- Elimina el campo "salto de peso" de toda la interfaz. No quiero configurarlo.
- Internamente, el incremento de los botones +/− y de las sugerencias de progresión se decide solo según el material: barra 2,5 kg, mancuernas 2 kg, kettlebell 4 kg, máquinas y poleas 5 kg.
- Si mantengo pulsado el valor del peso, se abre el teclado numérico para escribir cualquier valor exacto.

---

## 6. Mejor forma de crear rutinas

Quiero crear una rutina rápido y en una sola pantalla:

- **Flujo:** nombre → añadir ejercicios → ajustar → guardar.
- **Selector de ejercicios** a pantalla completa, con buscador, filtros por músculo (chips o tocando el mapa), miniatura de la imagen en cada fila y **selección múltiple** para añadir varios ejercicios de golpe.
- Cada ejercicio entra con valores por defecto razonables (3 series, 8–12 repeticiones, 90 s de descanso; 2–3 min en los ejercicios compuestos grandes), editables en línea con botones +/−, sin formularios.
- Reordenar arrastrando y agrupar en superserie con un botón.
- Mientras la creo: **mapa muscular en vivo** de la rutina y un aviso suave si algún grupo muscular grande no se trabaja en ningún día del ciclo.
- Poder crear una rutina a partir de un entreno ya hecho (incluido un entreno libre) y duplicar rutinas.

---

## 7. Entreno libre

- Botón visible **"Entreno libre"** en la pantalla Hoy, junto al botón de empezar la rutina que toca.
- Empiezo con el entreno vacío y añado ejercicios sobre la marcha con el mismo selector del punto 6.
- Funciona igual que un entreno normal: valores de la última vez prerrellenados, temporizador de descanso y sugerencias de progresión.
- Al terminar, opción **"Guardar como rutina"**.
- Un entreno libre **no avanza el ciclo** de rutinas: después sigue tocando la misma rutina que antes.

---

## Criterios de terminado

- `npm run build` sin errores y todos los tests pasando, incluidos tests nuevos para: el cálculo de intensidad muscular, la correspondencia de músculos con el mapa y la migración de datos.
- Mis datos actuales siguen ahí después de actualizar la app.
- No queda ningún botón de check-in manual en ninguna pantalla.
- Todos los ejercicios de la biblioteca tienen imagen (o el mapa muscular como sustituto) y sus músculos en español.
- `SPEC.md` actualizado.
- Al terminar, dime cómo actualizar la app que ya tengo instalada en el móvil.
