# Ferro — Mejoras, ronda 4

Tres bloques: una **división muscular completa**, un **avatar 3D que se parezca a mí** (y que también usen las animaciones) y **físicas realistas** en todo el material.

## Antes de empezar

1. Lee `SPEC.md`, los `MEJORAS-*.md` anteriores y el código actual.
2. **Actualiza `SPEC.md`** con este documento. Donde contradiga lo anterior, manda este.
3. Trabaja por las fases del final. Al acabar cada una: compila, pasa los tests, publica una versión nueva del APK y dime exactamente qué probar en el móvil.
4. Pregúntame solo lo imprescindible.
5. Ninguna actualización puede hacerme perder datos: ni entrenos, ni nutrición, ni peso, ni el historial semanal de músculos.

---

## 1. División muscular completa

Faltan músculos en la división del cuerpo. Quiero que estén **todos los que se trabajan en el gimnasio**, organizados en grupo → músculo → porción o cabeza.

### Lista mínima

- **Cuello:** esternocleidomastoideo.
- **Hombros:** deltoides anterior, lateral y posterior.
- **Pecho:** pectoral mayor (porción clavicular o superior, esternal o media y costal o inferior) y serrato anterior.
- **Espalda:** trapecio (superior, medio e inferior), romboides, dorsal ancho, redondo mayor, infraespinoso y redondo menor, y erectores espinales (lumbares).
- **Brazos:** bíceps, braquial, braquiorradial, tríceps (cabeza larga, lateral y medial), flexores del antebrazo y extensores del antebrazo.
- **Core:** recto abdominal y oblicuos.
- **Cadera:** glúteo mayor, glúteo medio, glúteo menor, tensor de la fascia lata y flexores de cadera (psoas-ilíaco).
- **Piernas:** cuádriceps (recto femoral, vasto lateral y vasto medial), sartorio, aductores, isquiotibiales (bíceps femoral, semitendinoso y semimembranoso), gemelos (medial y lateral), sóleo, tibial anterior y peroneos.

### Además

- **Auditoría:** revisa todos los ejercicios de la biblioteca y comprueba que cada músculo que trabajan tiene su región en el modelo. Si encuentras alguno que falta en esta lista, añádelo.
- **Músculos profundos** (glúteo menor, psoas-ilíaco…): cuando se resaltan o los toco, los músculos que tienen encima se vuelven semitransparentes, para que se vean.
- **Reasigna los músculos de todos los ejercicios** con esta división más fina (por ejemplo, el remo con barra: dorsal ancho, romboides, trapecio medio, redondo mayor, deltoides posterior, bíceps y braquial). Antes de integrarlo, genera un archivo con el listado de ejercicios y sus músculos para que lo revise.
- **Intensidad semanal:** cada músculo principal de un ejercicio cuenta 1 serie y cada secundario 0,5, como hasta ahora, con los mismos 5 niveles.
- Al tocar un músculo se abre su ficha, con el grupo al que pertenece y las series de la semana.
- **Migración:** convierte las regiones antiguas a las nuevas (por ejemplo, "zona media de la espalda" pasa a romboides + trapecio medio) para que el historial siga siendo coherente.

---

## 2. Avatar 3D personalizado: que se parezca a mí

El muñeco tiene que cambiar según mis datos reales, para que se parezca a la persona que usa la app.

### Base técnica

- El modelo tiene que estar construido sobre el **cuerpo paramétrico de MakeHuman/MPFB** (CC0), con esqueleto, regiones musculares y la definición muscular transferida (mapa de normales y grupos de vértices). Si el avatar actual no está hecho así, este es el momento de hacerlo, porque la personalización depende de ello.
- Exporta los **targets de MakeHuman como morph targets del GLB** y reproduce en la app su interpolación (sexo, edad, peso, musculatura, altura, proporciones y medidas).
- Al cambiar la forma del cuerpo, **recalcula la posición de las articulaciones del esqueleto** (como hace MakeHuman), para que las animaciones encajen con cualquier cuerpo.

### Datos que lo definen (en un "Perfil corporal" en Ajustes)

- Sexo, edad, altura y peso. El peso sale automáticamente del registro de peso.
- **Medidas con cinta métrica (opcionales):** cuello, hombros, pecho, cintura, cadera, brazo, antebrazo, muslo y gemelo. Con fecha, para guardar su evolución.
- **Porcentaje de grasa:** leído de Health Connect si una báscula lo registra; si no, estimado con el método de la Marina de EE. UU. (cintura, cuello y altura), o escrito a mano.
- La grasa corporal también afecta a **lo marcados que se ven los músculos**: con menos grasa, más definición.
- **Ajuste fino visual:** unos pocos deslizadores (anchura de hombros, longitud de piernas y de brazos, cintura) con vista previa en directo, para corregir lo que los datos no capten.
- **Opcional:** unos pocos peinados sencillos en el mismo estilo de arcilla.
- Todo se guarda solo en el móvil.

### Evolución

- El avatar se **actualiza solo** cuando cambian mi peso o mis medidas (usa la tendencia del peso, no el dato de un día).
- Comparación **"Antes / Ahora"**: mi avatar de hace 1, 3 o 6 meses al lado del actual, girando a la vez.
- **Nutrición:** si hay porcentaje de grasa, usa la fórmula de Katch-McArdle para el metabolismo basal.

---

## 3. Los ejercicios usan mi avatar

- Todas las animaciones usan **mi avatar personalizado**, no un modelo genérico.
- Las animaciones se adaptan a mis proporciones: anchura del agarre, posición en el banco, altura de la barra en el rack, distancia a la polea y posición de los pies. Usa cinemática inversa sobre el esqueleto recalculado.
- Las miniaturas animadas de las listas se **regeneran en el móvil** (en segundo plano) cuando cambia mi perfil corporal, y se guardan en caché.

---

## 4. Físicas realistas en todo el material

Hay ejercicios en los que **el cable de la polea atraviesa a la persona**. Eso no puede pasar en ninguno.

### Motor y cuerpo

- Usa un motor de físicas para web (por ejemplo Rapier con `@react-three/rapier`) con paso de tiempo fijo.
- **Cuerpo:** colisionadores (cápsulas) en cada hueso, con el tamaño de mi avatar personalizado, que siguen la animación. Ningún objeto puede atravesarlos.

### Comportamiento del material

- **Barra:** cuerpo rígido con su masa; los discos encajados en las mangas; apoyo real en los soportes del rack y del banco.
- **Mancuernas:** cuerpos rígidos sujetos a las manos.
- **Polea:**
  - El **cable se simula como una cuerda inextensible** (segmentos con restricciones, tipo XPBD) que pasa por las ruedas de la polea.
  - La pila de discos se mueve por sus guías (articulación prismática) y **su recorrido corresponde exactamente al cable que se tira**.
  - El cable colisiona con el cuerpo y con el banco, y los agarres (cuerda, barra, triángulo, estribo) cuelgan y se mueven con su peso.
- **Multipower:** la barra solo se mueve a lo largo de las guías, con sus ganchos.
- **Banco y suelo:** estáticos. El cuerpo no los atraviesa.

### Que sea correcto de verdad

- La colisión es una red de seguridad, pero **la solución principal es colocar bien la escena de cada ejercicio**: altura de la polea, lado del cuerpo y posición del cable, tal como se hace en un gimnasio real (por ejemplo, en la extensión de tríceps con cuerda el cable baja por delante del cuerpo).
- **Test automático de penetraciones:** reproduce cada ejercicio con tres cuerpos distintos (uno pequeño, el mío y uno grande) y comprueba que ningún cable, barra, mancuerna ni disco atraviesa el cuerpo, el banco o el suelo en ningún momento. El test tiene que fallar si hay alguna penetración, y genera un informe con los ejercicios corregidos.
- **Rendimiento:** la física solo se ejecuta mientras la animación está en pantalla, y tiene que mantener 60 fps en el móvil.

---

## Fases

1. **División muscular:** lista completa, auditoría, músculos profundos, reasignación de ejercicios (con el listado para revisión) y migración.
2. **Avatar personalizado:** base MakeHuman con morph targets, esqueleto recalculado, perfil corporal, medidas, grasa corporal, ajuste fino, evolución y "Antes / Ahora".
3. **Ejercicios con mi avatar:** adaptación de las animaciones a mis proporciones y regeneración de miniaturas.
4. **Físicas:** motor, cable de polea, pila de discos, multipower, colisiones y test automático de penetraciones con su informe.

---

## Criterios de terminado

- Todos los músculos de la lista tienen su región, los profundos se ven al resaltarlos y cada ejercicio tiene sus músculos reasignados.
- Al cambiar mi peso, altura, edad, medidas o grasa corporal, el avatar cambia de forma creíble y se parece más a mí.
- Las animaciones usan mi avatar y encajan bien con mis proporciones.
- Ningún cable ni objeto atraviesa el cuerpo en ningún ejercicio: el test de penetraciones pasa con los tres tamaños de cuerpo.
- La pila de discos de la polea sube y baja de acuerdo con el cable.
- 60 fps en el móvil con física activa.
- Mis datos siguen intactos.
- `SPEC.md` y README actualizados.
