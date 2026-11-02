import { SALTO_POR_MATERIAL } from '../domain/etiquetas'
import type { Ejercicio, Material, Musculo } from '../domain/tipos'

type Fila = [id: string, nombre: string, principal: Musculo, secundarios: Musculo[], material: Material]

// Biblioteca inicial. Los id son estables para que las plantillas y las copias de seguridad los referencien.
const FILAS: Fila[] = [
  // Pecho
  ['press-banca', 'Press de banca con barra', 'pecho', ['triceps', 'hombros'], 'barra'],
  ['press-banca-inclinado', 'Press inclinado con barra', 'pecho', ['hombros', 'triceps'], 'barra'],
  ['press-banca-declinado', 'Press declinado con barra', 'pecho', ['triceps'], 'barra'],
  ['press-mancuernas', 'Press de banca con mancuernas', 'pecho', ['triceps', 'hombros'], 'mancuernas'],
  ['press-inclinado-mancuernas', 'Press inclinado con mancuernas', 'pecho', ['hombros', 'triceps'], 'mancuernas'],
  ['aperturas-mancuernas', 'Aperturas con mancuernas', 'pecho', ['hombros'], 'mancuernas'],
  ['press-pecho-maquina', 'Press de pecho en máquina', 'pecho', ['triceps', 'hombros'], 'maquina'],
  ['press-inclinado-maquina', 'Press inclinado en máquina', 'pecho', ['hombros', 'triceps'], 'maquina'],
  ['contractora', 'Contractora (pec deck)', 'pecho', ['hombros'], 'maquina'],
  ['cruce-poleas', 'Cruce de poleas', 'pecho', ['hombros'], 'polea'],
  ['fondos-paralelas', 'Fondos en paralelas', 'pecho', ['triceps', 'hombros'], 'peso_corporal'],
  ['flexiones', 'Flexiones', 'pecho', ['triceps', 'hombros'], 'peso_corporal'],
  // Espalda
  ['dominadas', 'Dominadas', 'espalda', ['biceps'], 'peso_corporal'],
  ['dominadas-supinas', 'Dominadas supinas', 'espalda', ['biceps'], 'peso_corporal'],
  ['dominadas-asistidas', 'Dominadas asistidas en máquina', 'espalda', ['biceps'], 'maquina'],
  ['jalon-pecho', 'Jalón al pecho', 'espalda', ['biceps'], 'polea'],
  ['jalon-estrecho', 'Jalón con agarre estrecho', 'espalda', ['biceps'], 'polea'],
  ['remo-barra', 'Remo con barra', 'espalda', ['biceps', 'lumbares'], 'barra'],
  ['remo-t', 'Remo en T', 'espalda', ['biceps', 'lumbares'], 'barra'],
  ['remo-mancuerna', 'Remo con mancuerna a una mano', 'espalda', ['biceps'], 'mancuernas'],
  ['remo-polea-baja', 'Remo en polea baja', 'espalda', ['biceps'], 'polea'],
  ['remo-maquina', 'Remo en máquina', 'espalda', ['biceps'], 'maquina'],
  ['remo-invertido', 'Remo invertido', 'espalda', ['biceps'], 'peso_corporal'],
  ['pullover-polea', 'Pullover en polea alta', 'espalda', [], 'polea'],
  ['peso-muerto', 'Peso muerto', 'espalda', ['gluteos', 'isquiotibiales', 'lumbares', 'trapecio'], 'barra'],
  ['hiperextensiones', 'Hiperextensiones', 'lumbares', ['gluteos', 'isquiotibiales'], 'peso_corporal'],
  // Hombros
  ['press-militar', 'Press militar con barra', 'hombros', ['triceps'], 'barra'],
  ['press-hombro-mancuernas', 'Press de hombros con mancuernas', 'hombros', ['triceps'], 'mancuernas'],
  ['press-hombro-maquina', 'Press de hombros en máquina', 'hombros', ['triceps'], 'maquina'],
  ['press-arnold', 'Press Arnold', 'hombros', ['triceps'], 'mancuernas'],
  ['elevaciones-laterales', 'Elevaciones laterales con mancuernas', 'hombros', [], 'mancuernas'],
  ['elevaciones-laterales-polea', 'Elevaciones laterales en polea', 'hombros', [], 'polea'],
  ['elevaciones-laterales-maquina', 'Elevaciones laterales en máquina', 'hombros', [], 'maquina'],
  ['elevaciones-frontales', 'Elevaciones frontales', 'hombros', [], 'mancuernas'],
  ['pajaros', 'Pájaros con mancuernas', 'hombros', ['trapecio', 'espalda'], 'mancuernas'],
  ['contractora-inversa', 'Contractora inversa', 'hombros', ['trapecio', 'espalda'], 'maquina'],
  ['face-pull', 'Face pull', 'hombros', ['trapecio', 'espalda'], 'polea'],
  // Trapecio
  ['encogimientos-barra', 'Encogimientos con barra', 'trapecio', ['antebrazos'], 'barra'],
  ['encogimientos-mancuernas', 'Encogimientos con mancuernas', 'trapecio', ['antebrazos'], 'mancuernas'],
  // Bíceps
  ['curl-barra', 'Curl con barra', 'biceps', ['antebrazos'], 'barra'],
  ['curl-barra-z', 'Curl con barra Z', 'biceps', ['antebrazos'], 'barra'],
  ['curl-mancuernas', 'Curl con mancuernas', 'biceps', ['antebrazos'], 'mancuernas'],
  ['curl-martillo', 'Curl martillo', 'biceps', ['antebrazos'], 'mancuernas'],
  ['curl-inclinado', 'Curl inclinado con mancuernas', 'biceps', [], 'mancuernas'],
  ['curl-concentrado', 'Curl concentrado', 'biceps', [], 'mancuernas'],
  ['curl-polea', 'Curl en polea', 'biceps', ['antebrazos'], 'polea'],
  ['curl-predicador-maquina', 'Curl predicador en máquina', 'biceps', [], 'maquina'],
  // Tríceps
  ['extension-triceps-polea', 'Extensión de tríceps en polea', 'triceps', [], 'polea'],
  ['extension-triceps-cuerda', 'Extensión de tríceps con cuerda', 'triceps', [], 'polea'],
  ['extension-triceps-cabeza-polea', 'Extensión de tríceps sobre la cabeza en polea', 'triceps', [], 'polea'],
  ['extension-triceps-mancuerna', 'Extensión de tríceps con mancuerna sobre la cabeza', 'triceps', [], 'mancuernas'],
  ['press-frances', 'Press francés con barra Z', 'triceps', [], 'barra'],
  ['press-banca-cerrado', 'Press de banca con agarre cerrado', 'triceps', ['pecho', 'hombros'], 'barra'],
  ['patada-triceps', 'Patada de tríceps', 'triceps', [], 'mancuernas'],
  ['fondos-banco', 'Fondos en banco', 'triceps', ['pecho', 'hombros'], 'peso_corporal'],
  ['fondos-maquina', 'Fondos en máquina', 'triceps', ['pecho', 'hombros'], 'maquina'],
  // Antebrazos
  ['curl-muneca', 'Curl de muñeca', 'antebrazos', [], 'mancuernas'],
  // Cuádriceps
  ['sentadilla', 'Sentadilla con barra', 'cuadriceps', ['gluteos', 'aductores', 'lumbares'], 'barra'],
  ['sentadilla-frontal', 'Sentadilla frontal', 'cuadriceps', ['gluteos'], 'barra'],
  ['sentadilla-multipower', 'Sentadilla en multipower', 'cuadriceps', ['gluteos'], 'maquina'],
  ['sentadilla-hack', 'Sentadilla hack', 'cuadriceps', ['gluteos'], 'maquina'],
  ['sentadilla-pendulo', 'Sentadilla péndulo', 'cuadriceps', ['gluteos'], 'maquina'],
  ['prensa', 'Prensa de piernas', 'cuadriceps', ['gluteos', 'aductores'], 'maquina'],
  ['extension-cuadriceps', 'Extensión de cuádriceps', 'cuadriceps', [], 'maquina'],
  ['sentadilla-goblet', 'Sentadilla goblet', 'cuadriceps', ['gluteos'], 'mancuernas'],
  ['sentadilla-bulgara', 'Sentadilla búlgara', 'cuadriceps', ['gluteos'], 'mancuernas'],
  ['zancadas', 'Zancadas con mancuernas', 'cuadriceps', ['gluteos'], 'mancuernas'],
  ['subidas-banco', 'Subidas al banco con mancuernas', 'cuadriceps', ['gluteos'], 'mancuernas'],
  // Isquiotibiales
  ['peso-muerto-rumano', 'Peso muerto rumano', 'isquiotibiales', ['gluteos', 'lumbares'], 'barra'],
  ['peso-muerto-rumano-mancuernas', 'Peso muerto rumano con mancuernas', 'isquiotibiales', ['gluteos', 'lumbares'], 'mancuernas'],
  ['buenos-dias', 'Buenos días', 'isquiotibiales', ['lumbares', 'gluteos'], 'barra'],
  ['curl-femoral-tumbado', 'Curl femoral tumbado', 'isquiotibiales', [], 'maquina'],
  ['curl-femoral-sentado', 'Curl femoral sentado', 'isquiotibiales', [], 'maquina'],
  // Glúteos
  ['hip-thrust', 'Hip thrust con barra', 'gluteos', ['isquiotibiales'], 'barra'],
  ['hip-thrust-maquina', 'Hip thrust en máquina', 'gluteos', ['isquiotibiales'], 'maquina'],
  ['puente-gluteo', 'Puente de glúteo', 'gluteos', ['isquiotibiales'], 'peso_corporal'],
  ['patada-gluteo-polea', 'Patada de glúteo en polea', 'gluteos', [], 'polea'],
  ['abductores-maquina', 'Abductores en máquina', 'gluteos', [], 'maquina'],
  // Aductores
  ['aductores-maquina', 'Aductores en máquina', 'aductores', [], 'maquina'],
  // Gemelos
  ['talones-de-pie', 'Elevación de talones de pie', 'gemelos', [], 'maquina'],
  ['talones-sentado', 'Elevación de talones sentado', 'gemelos', [], 'maquina'],
  ['gemelos-prensa', 'Gemelos en prensa', 'gemelos', [], 'maquina'],
  // Abdomen
  ['crunch-polea', 'Crunch en polea', 'abdomen', [], 'polea'],
  ['crunch-maquina', 'Crunch en máquina', 'abdomen', [], 'maquina'],
  ['crunch', 'Crunch abdominal', 'abdomen', [], 'peso_corporal'],
  ['elevacion-piernas-colgado', 'Elevación de piernas colgado', 'abdomen', [], 'peso_corporal'],
  ['rueda-abdominal', 'Rueda abdominal', 'abdomen', [], 'peso_corporal'],
  ['press-pallof', 'Press Pallof', 'abdomen', [], 'polea'],
]

export const EJERCICIOS_SEMILLA: Ejercicio[] = FILAS.map(([id, nombre, musculoPrincipal, musculosSecundarios, material]) => ({
  id,
  nombre,
  musculoPrincipal,
  musculosSecundarios,
  material,
  saltoPeso: SALTO_POR_MATERIAL[material],
  notasFijas: '',
  personalizado: false,
  archivado: false,
}))
