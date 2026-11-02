import type { Modifier } from '@dnd-kit/core'

/** Solo movimiento vertical al arrastrar (evita instalar @dnd-kit/modifiers por una línea). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })
