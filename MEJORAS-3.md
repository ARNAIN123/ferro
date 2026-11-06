# Ferro — Mejoras, ronda 3

La app va muy bien. Esta ronda tiene cuatro bloques: un registro de peso corporal mucho más rápido, una sección nueva de **nutrición**, un **avatar 3D de verdad** y unas **animaciones de ejercicios mucho más trabajadas**.

## Antes de empezar

1. Lee `SPEC.md`, `MEJORAS-1.md`, `MEJORAS-2.md` y el código actual.
2. **Actualiza `SPEC.md`** con este documento. Donde contradiga lo anterior, manda este.
3. Trabaja por las fases del final. Al acabar cada una: compila, pasa los tests, publica una versión nueva del APK y dime exactamente qué probar en el móvil.
4. Pregúntame solo lo imprescindible. Si necesitas que descargue o instale algo a mano (por ejemplo Blender), dímelo con pasos concretos.
5. Ninguna actualización puede hacerme perder datos.

---

## 1. Registro de peso corporal más rápido

Ahora funciona, pero solo sube de 0,1 en 0,1 y es lento. Quiero registrarlo en **menos de 3 segundos**:

- Se abre como hoja inferior desde la pantalla principal y desde un **acceso directo del icono de la app** (mantener pulsado → "Registrar peso").
- Aparece **ya colocado en mi último peso**, porque casi siempre cambia muy poco.
- **Regla horizontal deslizable** como control principal: arrastro para cambiar el valor, con un deslizamiento rápido salto varios kilos, se ajusta a 0,1 kg y da una vibración suave en cada 0,1 y más marcada en cada kilo. El número se ve grande en el centro.
- Botones de ±0,1 kg y ±1 kg. Si los mantengo pulsados, aceleran.
- Al tocar el número se abre el teclado numérico con decimales para escribirlo directamente.
- **Guardar con un toque.** La fecha es hoy por defecto, con un chip pequeño para cambiarla si registro un día anterior.
- Si tengo una báscula que escribe en Health Connect, importa el peso automáticamente, sin duplicados.
- Usa este mismo control de regla para las cantidades en gramos de la sección de nutrición.

---

## 2. Nutrición (sección nueva)

No tengo claro cómo la quiero, así que esta es una propuesta. Tiene que ser **rápida de registrar, adaptarse a mí y estar conectada con el entreno y los pasos**, sin volverse obsesiva.

### Sobre mí

Ahora como a diario pollo, carne, huevos, pasta, arroz y lácteos. No como pescado, verdura ni fruta, pero estoy abierto a ir incluyéndolos poco a poco. Mi objetivo por defecto es **perder grasa manteniendo el músculo**.

### Configuración inicial (un asistente de 1 minuto)

- Sexo, edad, altura y peso (estos dos ya están en la app), objetivo (perder grasa manteniendo músculo / mantener / ganar músculo) y ritmo: suave (0,25 % del peso por semana), moderado (0,5 %) o rápido (0,75 %).
- Gasto inicial estimado con la fórmula de Mifflin-St Jeor, más la actividad real que ya calcula la app (pasos y entrenos) y el efecto térmico de los alimentos.
- **Límites de seguridad:** el objetivo diario nunca baja de mi metabolismo basal y el ritmo nunca supera el 1 % del peso por semana.

### Objetivo que se ajusta solo

- Las dos primeras semanas usa la estimación.
- Después, **cada lunes recalcula mi gasto real** a partir de la tendencia del peso (media móvil de 7 días) y de lo que he registrado que como (unas 7.700 kcal por kg). Ajusta el objetivo poco a poco: como máximo ±150 kcal por semana.
- El total semanal se mantiene, pero los días de entreno tienen algo más de carbohidratos y los de descanso algo menos.

### Macros

- **La proteína es la prioridad:** por defecto 2 g por kg de peso, editable entre 1,6 y 2,2.
- Grasa mínima de 0,7 g/kg y el resto en carbohidratos.
- La proteína se ve siempre destacada.

### Registro rápido de comidas

- Comidas del día: desayuno, comida, merienda y cena. En los días de entreno aparecen también "Antes de entrenar" y "Después de entrenar".
- Al añadir un alimento salen primero **mis recientes y frecuentes** para esa comida y esa hora. Debajo, un buscador por texto. Aquí sí hay buscador, porque la regla de buscar solo con el mapa es únicamente para los ejercicios.
- **Escáner de códigos de barras** con la cámara (un plugin de Capacitor con ML Kit), que busca en **Open Food Facts** (gratuita y con muchos productos de supermercados españoles).
- **Base de alimentos genéricos en español** con licencia libre: por ejemplo USDA FoodData Central (dominio público) traducida, o una base española si su licencia lo permite (verifícalo). Con raciones habituales ("1 huevo", "1 vaso de leche", "1 plato de pasta"), y dejando **muy claro si el peso es en crudo o cocido** (pasta, arroz, carne).
- Cantidad con el control de regla del punto 1 o con raciones predefinidas.
- **"Mis platos":** guardo una vez una combinación (por ejemplo, "pasta con pollo") y la añado con un toque.
- **"Repetir"**: copiar una comida de ayer o de otro día.
- **Opcional:** si añado una API key de Anthropic en Ajustes, puedo escribir "200 g de pollo con 80 g de arroz" y la app lo interpreta y lo añade. Sin API key, todo lo demás funciona igual.

### Pantalla del día

- Anillo con las **calorías que me quedan**, barras de proteína, carbohidratos y grasa, la lista de comidas y el agua (botón +250 ml).
- **"Cerrar el día"**: con lo que me queda (por ejemplo 45 g de proteína y 500 kcal), propone combinaciones **de mis alimentos habituales** que encajan. Algoritmo simple, sin IA.

### Incluir fruta y verdura poco a poco (opcional, desactivable)

- Un **reto semanal suave**: una fruta o verdura para probar esa semana, con una forma fácil de tomarla con lo que ya como (por ejemplo, plátano en un batido con leche o tomate triturado en la salsa de la pasta).
- Marco "probado", "me gusta" o "no me gusta". Los que me gustan se añaden a mis alimentos y los que no, no vuelven a salir.
- Sin presión, sin rachas y sin mensajes de culpa.

### Revisión semanal

- Cada lunes, una pantalla de resumen: media de calorías y proteína frente al objetivo, tendencia del peso, gasto recalculado y el ajuste para la semana que empieza.

### Tono y seguridad

- Nada de rojo de "fracaso", rachas de dieta ni alimentos "prohibidos".
- Si como muy por debajo del objetivo varios días seguidos (menos del 70 %), un mensaje amable que recomiende comer más, nunca uno que lo celebre.

### Integración con el resto de la app

- Una pestaña nueva **Nutrición** en la navegación inferior.
- En la pantalla principal, una tarjeta compacta debajo de pasos y calorías: "Te quedan 640 kcal · 52 g de proteína".
- Opcional: escribir las comidas en Health Connect.
- Funciones de cálculo puras con tests: gasto inicial, recalibración semanal, reparto de macros, límites de seguridad y sugerencias de "Cerrar el día".

---

## 3. Avatar 3D de verdad

El avatar actual se puede girar, pero **parece un papel**: no tiene volumen. Quiero un modelo 3D real, con volumen y con los músculos definidos y marcados, como la imagen de referencia.

- **Modelo:** un cuerpo atlético en estilo "arcilla" gris mate, como la referencia, con los músculos superficiales bien definidos y cada región muscular como malla (o región) independiente para poder colorearla.
- **Fuentes con licencia libre** (verifica las licencias y añade una pantalla de Créditos en Ajustes):
  - **Z-Anatomy** (CC BY-SA 4.0, basada en BodyParts3D): músculos anatómicos individuales para dar la definición y separar las regiones.
  - **MakeHuman / MPFB** (los modelos exportados son CC0): cuerpo humano con esqueleto (rig), útil sobre todo para las animaciones del punto 4.
  - Propuesta de flujo: usar Blender en modo script (sin interfaz) para unir los músculos de Z-Anatomy en las regiones del avatar, simplificar las mallas y exportar a GLB comprimido. Si es viable, transfiere la definición muscular y las regiones al cuerpo con esqueleto (mapa de normales horneado y grupos de vértices), para usar **el mismo modelo en el avatar y en las animaciones**. Si no es viable, propón la mejor alternativa y explícame por qué.
- **Render:** three.js con react-three-fiber. Iluminación de estudio (entorno suave, luz principal y luz de contorno que marquen los relieves), oclusión ambiental y sombra de contacto en el suelo.
- **Colores:** los músculos sin trabajar en gris arcilla. Los trabajados se tiñen con el color de acento según los 5 niveles de intensidad semanales que ya existen, con un brillo muy sutil en los niveles altos.
- **Interacción:** girar 360° con el dedo con inercia, zoom limitado con dos dedos, doble toque para volver a la vista frontal y botones rápidos de frente y espalda. Al tocar un músculo se abre su ficha, como ahora.
- **Rendimiento en el móvil:** modelo de menos de 10 MB (Draco o meshopt y texturas comprimidas), 60 fps al girar y renderizado solo cuando hay movimiento, para no gastar batería.
- Sustituye con este modelo **todas** las vistas del mapa muscular: pantalla principal, buscador de ejercicios por mapa, ficha del ejercicio, creación de rutinas y resumen del entreno.
- **Antes de seguir**, genera una vista previa (capturas desde varios ángulos y con varios niveles de intensidad) para que la revise.

---

## 4. Animaciones de ejercicios mucho más trabajadas

Las animaciones actuales se quedan cortas. Quiero que parezcan una **demostración profesional**:

- **En 3D**, con la misma figura de arcilla del avatar y los músculos principales del ejercicio en el color de acento. Durante la fase de esfuerzo (concéntrica), esos músculos se iluminan un poco más.
- **Material modelado en 3D y bien hecho:** barra con discos, mancuernas, banco ajustable con su inclinación real, polea con la pila de discos que sube y baja, el cable siempre tenso y los agarres correctos (cuerda, barra recta, triángulo, estribo), y multipower con sus guías y ganchos.
- **Movimiento realista:**
  - Al menos 4–6 poses clave por repetición, con curvas de aceleración suaves.
  - Ritmo real: bajar en unos 2 s, subir en 1 s y una pausa breve.
  - Cinemática inversa (IK) para que las manos sigan pegadas a la barra o al agarre y los pies no se deslicen.
  - Trayectoria correcta de la barra y límites articulares, para que no haya posturas imposibles.
  - Sin atravesar el banco, el suelo ni el material.
  - Pequeño movimiento secundario (respiración, estabilización) para que no parezca un robot.
- **Cámara:** el mejor ángulo para cada ejercicio (normalmente 3/4), con la posibilidad de girar con el dedo y botones de vista lateral y frontal. Se repiten 2–3 repeticiones y una pausa, en bucle.
- **Rendimiento:** las animaciones son datos (poses clave) sobre el modelo compartido, no vídeos. Para las listas, miniaturas animadas pre-renderizadas y ligeras. En la ficha del ejercicio, la escena 3D en directo.
- **Primero un piloto con 10 ejercicios representativos:** press de banca con barra, sentadilla con barra, peso muerto, remo con barra, press militar con barra, curl con mancuernas, extensión de tríceps en polea con cuerda, jalón al pecho en polea, elevaciones laterales con mancuernas y hip thrust con barra. Genera una galería para que la revise. **Solo cuando la apruebe**, hazlo para todos los ejercicios de la biblioteca.

---

## Fases

1. **Registro de peso rápido** y acceso directo del icono.
2. **Nutrición:** asistente, objetivos adaptativos, registro rápido, escáner, Open Food Facts, base genérica, mis platos, "Cerrar el día", reto de fruta y verdura, revisión semanal y tarjeta en la pantalla principal.
3. **Modelo 3D y avatar:** flujo con Blender, vista previa para revisión y sustitución de todas las vistas del mapa.
4. **Animaciones:** piloto de 10 ejercicios con galería; después, el resto de la biblioteca.

---

## Criterios de terminado

- Registrar el peso corporal lleva menos de 3 segundos desde la pantalla principal.
- Puedo registrar un día normal de comidas en pocos toques usando recientes, platos guardados y el escáner.
- El objetivo de nutrición se recalcula cada lunes y nunca baja de los límites de seguridad.
- El avatar tiene volumen real, músculos definidos y se mueve fluido en el móvil.
- Las animaciones del piloto parecen una demostración profesional y han sido aprobadas antes de extenderlas.
- Tests pasando para los cálculos de nutrición y para todo lo anterior.
- `SPEC.md` y README actualizados, con la pantalla de Créditos y las licencias de los modelos 3D.
