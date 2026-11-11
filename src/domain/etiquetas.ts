import { INFO_MUSCULO } from './musculos'
import { MUSCULOS, type Categoria, type Material, type Mecanica, type Musculo, type Nivel, type OrigenEntrada, type TipoSerie, type Zona } from './tipos'

/** Nombre corto de cada músculo (chips, mapas, listas). El completo está en INFO_MUSCULO. */
export const NOMBRE_MUSCULO: Record<Musculo, string> = Object.fromEntries(MUSCULOS.map((m) => [m, INFO_MUSCULO[m].corto])) as Record<Musculo, string>

/** Nombre de cada zona 2D (para las animaciones 2D, que resaltan zonas). */
export const NOMBRE_ZONA: Record<Zona, string> = {
  pectoral_superior: 'Pectoral superior',
  pectoral_inferior: 'Pectoral inferior',
  deltoides_anterior: 'Deltoides anterior',
  deltoides_lateral: 'Deltoides lateral',
  deltoides_posterior: 'Deltoides posterior',
  biceps: 'Bíceps',
  braquial: 'Braquial',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  trapecio: 'Trapecio',
  espalda_media: 'Espalda media',
  dorsales: 'Dorsales',
  lumbares: 'Lumbares',
  abdomen: 'Abdomen',
  oblicuos: 'Oblicuos',
  gluteo_mayor: 'Glúteo mayor',
  gluteo_medio: 'Glúteo medio',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  aductores: 'Aductores',
  gemelos: 'Gemelos',
  soleo: 'Sóleo',
  cuello: 'Cuello',
}

export const NOMBRE_MATERIAL: Record<Material, string> = {
  barra: 'Barra',
  barra_z: 'Barra Z',
  barra_hexagonal: 'Barra hexagonal',
  landmine: 'Landmine',
  mancuernas: 'Mancuernas',
  discos: 'Discos',
  multipower: 'Multipower',
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
 * depende solo del material (barras, landmine y discos 2,5 kg, mancuernas 2 kg, kettlebell 4 kg,
 * poleas, multipower y máquinas 5 kg).
 */
export const SALTO_POR_MATERIAL: Record<Material, number> = {
  barra: 2.5,
  barra_z: 2.5,
  barra_hexagonal: 2.5,
  landmine: 2.5,
  discos: 2.5,
  multipower: 5,
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
