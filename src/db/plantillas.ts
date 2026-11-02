import { idMigrado } from '../domain/migracion'
import { nuevoId } from '../lib/id'
import { db } from './db'

// [ejercicioId, series, repsMin, repsMax, descansoSeg, superserieConSiguiente?]
type Linea = [string, number, number, number, number, boolean?]

interface PlantillaRutina {
  nombre: string
  ejercicios: Linea[]
}

export interface Plantilla {
  clave: string
  nombre: string
  descripcion: string
  rutinas: PlantillaRutina[]
}

export const PLANTILLAS: Plantilla[] = [
  {
    clave: 'full-body',
    nombre: 'Full Body 3 días',
    descripcion: 'Tres rutinas de cuerpo completo. Ideal si entrenas 3 días por semana.',
    rutinas: [
      {
        nombre: 'A — Full Body',
        ejercicios: [
          ['sentadilla', 3, 6, 8, 180],
          ['press-banca', 3, 6, 8, 150],
          ['remo-barra', 3, 8, 10, 120],
          ['press-hombro-mancuernas', 2, 10, 12, 90],
          ['curl-femoral-tumbado', 2, 10, 12, 90],
          ['curl-mancuernas', 2, 10, 12, 60],
        ],
      },
      {
        nombre: 'B — Full Body',
        ejercicios: [
          ['peso-muerto-rumano', 3, 8, 10, 150],
          ['press-inclinado-mancuernas', 3, 8, 10, 120],
          ['jalon-pecho', 3, 8, 12, 120],
          ['prensa', 2, 10, 12, 120],
          ['elevaciones-laterales', 3, 12, 15, 60],
          ['extension-triceps-cuerda', 2, 10, 12, 60],
        ],
      },
      {
        nombre: 'C — Full Body',
        ejercicios: [
          ['sentadilla-bulgara', 3, 8, 10, 120],
          ['press-militar', 3, 6, 8, 150],
          ['remo-polea-baja', 3, 10, 12, 90],
          ['hip-thrust', 3, 8, 10, 120],
          ['contractora', 2, 12, 15, 60],
          ['crunch-polea', 3, 10, 15, 60],
        ],
      },
    ],
  },
  {
    clave: 'torso-pierna',
    nombre: 'Torso / Pierna',
    descripcion: 'Cuatro rutinas alternando torso y pierna. Pensada para 4 días por semana.',
    rutinas: [
      {
        nombre: 'A — Torso',
        ejercicios: [
          ['press-banca', 4, 6, 8, 150],
          ['remo-barra', 4, 6, 8, 150],
          ['press-militar', 3, 8, 10, 120],
          ['jalon-pecho', 3, 10, 12, 90],
          ['curl-barra-z', 2, 10, 12, 60, true],
          ['press-frances', 2, 10, 12, 60],
        ],
      },
      {
        nombre: 'B — Pierna',
        ejercicios: [
          ['sentadilla', 4, 6, 8, 180],
          ['peso-muerto-rumano', 3, 8, 10, 150],
          ['prensa', 3, 10, 12, 120],
          ['curl-femoral-sentado', 3, 10, 12, 90],
          ['talones-de-pie', 4, 10, 15, 60],
        ],
      },
      {
        nombre: 'C — Torso',
        ejercicios: [
          ['press-inclinado-mancuernas', 3, 8, 10, 120],
          ['dominadas', 3, 6, 10, 150],
          ['press-pecho-maquina', 3, 10, 12, 90],
          ['remo-polea-baja', 3, 10, 12, 90],
          ['elevaciones-laterales', 3, 12, 15, 60],
          ['curl-martillo', 2, 10, 12, 60, true],
          ['extension-triceps-cuerda', 2, 10, 12, 60],
        ],
      },
      {
        nombre: 'D — Pierna',
        ejercicios: [
          ['peso-muerto', 3, 4, 6, 180],
          ['sentadilla-hack', 3, 8, 10, 150],
          ['hip-thrust', 3, 8, 10, 120],
          ['extension-cuadriceps', 3, 12, 15, 60],
          ['curl-femoral-tumbado', 3, 10, 12, 90],
          ['talones-sentado', 3, 12, 15, 60],
        ],
      },
    ],
  },
  {
    clave: 'ppl',
    nombre: 'Push / Pull / Legs',
    descripcion: 'Empuje, tirón y pierna. Se adapta a 3 o 6 días por semana.',
    rutinas: [
      {
        nombre: 'A — Push',
        ejercicios: [
          ['press-banca', 4, 6, 8, 150],
          ['press-hombro-mancuernas', 3, 8, 10, 120],
          ['press-inclinado-mancuernas', 3, 8, 12, 120],
          ['elevaciones-laterales', 3, 12, 15, 60],
          ['extension-triceps-cuerda', 3, 10, 12, 60],
          ['cruce-poleas', 2, 12, 15, 60],
        ],
      },
      {
        nombre: 'B — Pull',
        ejercicios: [
          ['dominadas', 3, 6, 10, 150],
          ['remo-barra', 3, 6, 8, 150],
          ['remo-polea-baja', 3, 10, 12, 90],
          ['face-pull', 3, 12, 15, 60],
          ['curl-barra-z', 3, 8, 10, 90],
          ['curl-martillo', 2, 10, 12, 60],
        ],
      },
      {
        nombre: 'C — Pierna',
        ejercicios: [
          ['sentadilla', 4, 6, 8, 180],
          ['peso-muerto-rumano', 3, 8, 10, 150],
          ['prensa', 3, 10, 12, 120],
          ['curl-femoral-sentado', 3, 10, 12, 90],
          ['talones-de-pie', 4, 10, 15, 60],
        ],
      },
    ],
  },
]

/** Crea las rutinas de la plantilla al final del ciclo actual. */
export async function aplicarPlantilla(clave: string): Promise<void> {
  const plantilla = PLANTILLAS.find((p) => p.clave === clave)
  if (!plantilla) return
  await db.transaction('rw', db.rutinas, db.rutinaEjercicios, async () => {
    const ultima = await db.rutinas.orderBy('posicionCiclo').filter((r) => !r.archivada).last()
    let posicion = ultima ? ultima.posicionCiclo + 1 : 0
    for (const r of plantilla.rutinas) {
      const rutinaId = nuevoId()
      await db.rutinas.add({ id: rutinaId, nombre: r.nombre, posicionCiclo: posicion++, archivada: false, creada: Date.now() })
      await db.rutinaEjercicios.bulkAdd(
        r.ejercicios.map(([ejercicioId, series, repsMin, repsMax, descansoSeg, superserie], orden) => ({
          id: nuevoId(),
          rutinaId,
          ejercicioId: idMigrado(ejercicioId),
          orden,
          series,
          repsMin,
          repsMax,
          descansoSeg,
          nota: '',
          superserieConSiguiente: superserie ?? false,
        })),
      )
    }
  })
}
