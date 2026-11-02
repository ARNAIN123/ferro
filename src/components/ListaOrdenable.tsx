import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from './restricciones'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { mover } from '../domain/ciclo'
import { Icono } from './Icono'

interface Props<T extends { id: string }> {
  items: T[]
  onOrdenar: (items: T[]) => void
  children: (item: T, asa: ReactNode) => ReactNode
  className?: string
}

/** Lista que se reordena arrastrando el asa (⋮⋮). También funciona con teclado. */
export function ListaOrdenable<T extends { id: string }>({ items, onOrdenar, children, className }: Props<T>) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const desde = items.findIndex((i) => i.id === active.id)
    const hasta = items.findIndex((i) => i.id === over.id)
    if (desde >= 0 && hasta >= 0) onOrdenar(mover(items, desde, hasta))
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={alSoltar}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Pulsa espacio para coger el elemento, muévelo con las flechas y pulsa espacio para soltarlo.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <Elemento key={item.id} id={item.id}>
              {(asa) => children(item, asa)}
            </Elemento>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Elemento({ id, children }: { id: string; children: (asa: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const asa = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Arrastrar para reordenar"
      className="grid size-12 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted active:cursor-grabbing"
    >
      <Icono nombre="arrastre" tamano={20} />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 opacity-90 shadow-2xl' : ''}`}
    >
      {children(asa)}
    </li>
  )
}
