// Lógica de la regla deslizable (peso corporal y gramos): ajuste al paso, inercia del lanzamiento,
// qué marcas se cruzan (para vibrar) y aceleración de los botones al mantenerlos pulsados.

/** Redondea al paso (0,1 kg, 5 g…) sin errores de coma flotante y dentro de los límites. */
export function ajustar(valor: number, paso: number, min: number, max: number): number {
  const decimales = Math.max(0, -Math.floor(Math.log10(paso) + 1e-9))
  const v = Math.round(Math.round(valor / paso) * paso * 10 ** decimales) / 10 ** decimales
  return Math.min(max, Math.max(min, v))
}

/** Valor tras arrastrar `dx` píxeles: el dedo hacia la izquierda sube el valor, como una regla. */
export const valorTrasArrastre = (inicio: number, dx: number, pasoPx: number, paso: number): number => inicio - (dx / pasoPx) * paso

/** Constante de tiempo de la inercia (ms): como el desplazamiento de las listas en el móvil. */
export const TAU_INERCIA = 325
/** Por debajo de esta velocidad (px/ms) el lanzamiento se para y se ajusta al paso. */
export const VELOCIDAD_MINIMA = 0.02

/**
 * Inercia tras soltar: con velocidad inicial `v0` (px/ms), cuánto se ha desplazado a los `t` ms y
 * con qué velocidad sigue. La velocidad decae exponencialmente.
 */
export function inercia(v0: number, t: number): { dx: number; v: number } {
  const k = Math.exp(-t / TAU_INERCIA)
  return { dx: v0 * TAU_INERCIA * (1 - k), v: v0 * k }
}

/** Desplazamiento total de un lanzamiento hasta pararse (para saber dónde caerá). */
export const recorridoInercia = (v0: number): number => v0 * TAU_INERCIA

/**
 * Marcas cruzadas al pasar de `a` a `b`: cuántos pasos pequeños y cuántas marcas grandes (cada kilo,
 * cada 10 g…). Sirve para vibrar suave en cada paso y más fuerte en cada marca grande.
 */
export function marcasCruzadas(a: number, b: number, paso: number, marcaGrande: number): { pasos: number; grandes: number } {
  // Se cuenta sobre el valor que se ve (redondeado al paso).
  const n = (v: number) => Math.round(v / paso)
  const g = (v: number) => Math.floor((n(v) * paso) / marcaGrande + 1e-9)
  return { pasos: Math.abs(n(b) - n(a)), grandes: Math.abs(g(b) - g(a)) }
}

/**
 * Intervalo entre repeticiones al mantener pulsado un botón ±: primero una pausa, luego cada vez
 * más rápido. `t` son los ms desde que se pulsó.
 */
export function intervaloRepeticion(t: number): number {
  if (t < 450) return 450
  if (t < 1200) return 160
  if (t < 2400) return 90
  return 45
}
