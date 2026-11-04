import type { Categoria, Material, Mecanica, Musculo, Nivel, OrigenEntrada, TipoSerie } from './tipos'

export const NOMBRE_MUSCULO: Record<Musculo, string> = {
  pecho: 'Pecho',
  dorsales: 'Dorsales',
  espalda_media: 'Espalda media',
  lumbares: 'Lumbares',
  trapecio: 'Trapecio',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  abdomen: 'Abdomen',
  gluteos: 'Glúteos',
  abductores: 'Abductores',
  aductores: 'Aductores',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  gemelos: 'Gemelos',
  cuello: 'Cuello',
}

export const NOMBRE_MATERIAL: Record<Material, string> = {
  barra: 'Barra',
  barra_z: 'Barra Z',
  mancuernas: 'Mancuernas',
  kettlebell: 'Kettlebell',
  maquina: 'Máquina',
  polea: 'Polea',
  peso_corporal: 'Peso corporal',
  bandas: 'Bandas',
  balon_medicinal: 'Balón medicinal',
  fitball: 'Fitball',
  foam_roller: 'Foam roller',
  otro: 'Otro',
  ninguno: 'Sin material',
}

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  fuerza: 'Fuerza',
  halterofilia: 'Halterofilia',
  strongman: 'Strongman',
  pliometria: 'Pliometría',
  cardio: 'Cardio',
  estiramientos: 'Estiramientos',
}

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export const NOMBRE_MECANICA: Record<Mecanica, string> = {
  compuesto: 'Compuesto',
  aislamiento: 'Aislamiento',
}

/**
 * Incremento de peso de los botones +/− y de la progresión. No se configura:
 * depende solo del material (barra 2,5 kg, mancuernas 2 kg, kettlebell 4 kg, máquinas y poleas 5 kg).
 */
export const SALTO_POR_MATERIAL: Record<Material, number> = {
  barra: 2.5,
  barra_z: 2.5,
  mancuernas: 2,
  kettlebell: 4,
  maquina: 5,
  polea: 5,
  peso_corporal: 2.5,
  bandas: 1,
  balon_medicinal: 1,
  fitball: 1,
  foam_roller: 1,
  otro: 2.5,
  ninguno: 2.5,
}

export const saltoDe = (material: Material): number => SALTO_POR_MATERIAL[material] ?? 2.5

export const NOMBRE_ORIGEN: Record<OrigenEntrada, string> = {
  deteccion: 'S3 FIT ZONE',
  enlace: 'Enlace',
  ubicacion: 'Ubicación',
  entreno: 'Inicio del entreno',
  manual: 'Manual',
}

export const NOMBRE_TIPO_SERIE: Record<TipoSerie, string> = {
  calentamiento: 'Calentamiento',
  normal: 'Normal',
  drop: 'Drop set',
}
