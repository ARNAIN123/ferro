import type { Material, Musculo, OrigenEntrada, TipoSerie } from './tipos'

export const NOMBRE_MUSCULO: Record<Musculo, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  trapecio: 'Trapecio',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  abdomen: 'Abdomen',
  lumbares: 'Lumbares',
  gluteos: 'Glúteos',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  aductores: 'Aductores',
  gemelos: 'Gemelos',
}

export const NOMBRE_MATERIAL: Record<Material, string> = {
  barra: 'Barra',
  mancuernas: 'Mancuernas',
  maquina: 'Máquina',
  polea: 'Polea',
  peso_corporal: 'Peso corporal',
  otro: 'Otro',
}

/** Salto de peso por defecto según el material (editable por ejercicio). */
export const SALTO_POR_MATERIAL: Record<Material, number> = {
  barra: 2.5,
  mancuernas: 2,
  maquina: 5,
  polea: 2.5,
  peso_corporal: 2.5,
  otro: 2.5,
}

export const NOMBRE_ORIGEN: Record<OrigenEntrada, string> = {
  enlace: 'Enlace',
  ubicacion: 'Ubicación',
  manual: 'Manual',
}

export const NOMBRE_TIPO_SERIE: Record<TipoSerie, string> = {
  calentamiento: 'Calentamiento',
  normal: 'Normal',
  drop: 'Drop set',
}
