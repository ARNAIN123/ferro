// Qué animación tiene cada ejercicio: reglas por nombre (el id de Free Exercise DB en inglés y el
// nombre en español) que eligen un patrón y sus parámetros. Los ejercicios propios que no encajan
// en ninguna regla usan el patrón típico de su músculo principal.
import { zonaDe } from '../domain/musculos'
import type { Ejercicio, Material, Musculo, Zona } from '../domain/tipos'
import {
  abdominal,
  aperturas,
  bisagra,
  caderaPolea,
  cuello,
  curl,
  curlFemoral,
  elevacion,
  encogimiento,
  envion,
  extension,
  gemelos,
  giroTronco,
  jalon,
  jammer,
  muneca,
  olimpico,
  pallof,
  paseo,
  prensaMultipower,
  press,
  puente,
  remo,
  remoMenton,
  rotacion,
  sentadilla,
  volantes,
  vueltasAlMundo,
  zancada,
  type Animacion,
  type Carga,
  type CargaSentadilla,
} from './patrones'

export type EjercicioAnimable = Pick<Ejercicio, 'id' | 'nombre' | 'material' | 'musculosPrincipales'>

const CARGA: Record<Material, Carga> = {
  barra: 'barra',
  barra_z: 'barra_z',
  barra_hexagonal: 'hexagonal',
  landmine: 'landmine',
  mancuernas: 'mancuernas',
  discos: 'disco',
  polea: 'polea',
  multipower: 'multipower',
  kettlebell: 'mancuerna',
  maquina: 'ninguna',
  peso_corporal: 'ninguna',
  bandas: 'ninguna',
  balon_medicinal: 'disco',
  fitball: 'ninguna',
  foam_roller: 'ninguna',
  ninguno: 'ninguna',
  otro: 'ninguna',
}

/** Texto en minúsculas y sin acentos con el id y el nombre, para las reglas. */
const texto = (e: EjercicioAnimable) =>
  `${e.id} ${e.nombre}`
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const unilateral = (t: string) => /\b(one ?arm|one ?legged|single|alternat|una mano|a una mano|alterno)/.test(t)

function cargaSentadilla(e: EjercicioAnimable): CargaSentadilla {
  return e.material === 'multipower' ? 'multipower' : e.material === 'mancuernas' ? 'mancuernas' : e.material === 'landmine' ? 'landmine' : 'espalda'
}

type Regla = [RegExp, (e: EjercicioAnimable, t: string, c: Carga) => Animacion]

const REGLAS: Regla[] = [
  // Cuello
  [/neck resistance/, (_e, t) => cuello({ bocaArriba: /face up/.test(t) })],
  [/^neck press|press al cuello/, (_e, _t, c) => press({ postura: 'banco', carga: c, hasta: 'cuello' })],

  // Halterofilia
  [/snatch balance/, () => envion({ fin: 'equilibrio_arrancada' })],
  [/jerk balance/, () => envion({ fin: 'equilibrio_tijera' })],
  [/jerk dip squat|rack delivery/, () => envion({ fin: 'flexion' })],
  [/split jerk/, () => envion({ fin: 'tijera' })],
  [/squat jerk/, () => envion({ fin: 'sentadilla' })],
  [/power jerk/, () => envion({ fin: 'potencia' })],
  [/clean and jerk/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'cargada', carga: c, despues: 'envion' })],
  [/clean and press/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'cargada', carga: c, despues: 'press' })],
  [/push press/, (_e, t, c) => press({ postura: 'de_pie', carga: c, impulso: true, trasNuca: /behind/.test(t) })],
  [/(snatch|clean) shrug/, (_e, _t, c) => olimpico({ inicio: 'colgante', fin: 'encogimiento', carga: c })],
  [/(snatch|clean) pull/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'tiron', carga: c })],
  [/(snatch|clean) deadlift/, (_e, _t, c) => bisagra({ tipo: 'peso_muerto', carga: c })],
  [/hang snatch below knees/, (_e, _t, c) => olimpico({ inicio: 'bajo_rodillas', fin: 'arrancada', carga: c })],
  [/hang snatch|muscle snatch/, (_e, _t, c) => olimpico({ inicio: 'colgante', fin: 'arrancada', carga: c })],
  [/power snatch from blocks/, (_e, _t, c) => olimpico({ inicio: 'bloques', fin: 'arrancada', carga: c })],
  [/snatch from blocks/, (_e, _t, c) => olimpico({ inicio: 'bloques', fin: 'arrancada_sentadilla', carga: c })],
  [/power snatch/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'arrancada', carga: c })],
  [/split snatch/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'arrancada_tijera', carga: c })],
  [/\bsnatch\b/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'arrancada_sentadilla', carga: c })],
  [/hang clean below/, (_e, _t, c) => olimpico({ inicio: 'bajo_rodillas', fin: 'cargada_sentadilla', carga: c })],
  [/hang power clean/, (_e, _t, c) => olimpico({ inicio: 'colgante', fin: 'cargada', carga: c })],
  [/hang clean/, (_e, _t, c) => olimpico({ inicio: 'colgante', fin: 'cargada_sentadilla', carga: c })],
  [/dumbbell clean/, () => olimpico({ inicio: 'colgante', fin: 'cargada', carga: 'mancuernas' })],
  [/power clean from blocks/, (_e, _t, c) => olimpico({ inicio: 'bloques', fin: 'cargada', carga: c })],
  [/clean from blocks/, (_e, _t, c) => olimpico({ inicio: 'bloques', fin: 'cargada_sentadilla', carga: c })],
  [/power clean/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'cargada', carga: c })],
  [/split clean/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'cargada_tijera', carga: c })],
  [/^clean\b/, (_e, _t, c) => olimpico({ inicio: 'suelo', fin: 'cargada_sentadilla', carga: c })],

  // Bisagra de cadera
  [/good morning/, (_e, t, c) => bisagra({ tipo: /seated/.test(t) ? 'buenos_dias_sentado' : 'buenos_dias', carga: c })],
  [/(one leg|una pierna).*(deadlift|peso muerto)|(deadlift|peso muerto).*(una pierna)/, (_e, _t, c) => bisagra({ tipo: 'una_pierna', carga: c })],
  [/romanian|rumano/, (_e, _t, c) => bisagra({ tipo: 'rumano', carga: c })],
  [/stiff|rigidas/, (_e, _t, c) => bisagra({ tipo: 'rigidas', carga: c })],
  [/deficit deadlift/, (_e, _t, c) => bisagra({ tipo: 'deficit', carga: c })],
  [/sumo deadlift/, (_e, _t, c) => bisagra({ tipo: 'sumo', carga: c })],
  [/rack pull/, (_e, _t, c) => bisagra({ tipo: 'rack', carga: c })],
  [/cable deadlift/, () => bisagra({ tipo: 'polea', carga: 'polea' })],
  [/deadlift|peso muerto/, (_e, _t, c) => bisagra({ tipo: 'peso_muerto', carga: c })],
  [/pull through/, () => bisagra({ tipo: 'pull_through', carga: 'polea' })],

  // Glúteo
  [/hip thrust/, (e, t) => puente({ banco: true, carga: e.material === 'multipower' ? 'multipower' : e.material === 'mancuernas' ? 'mancuernas' : 'barra', unaPierna: /una pierna|one leg/.test(t) })],
  [/glute bridge|puente de gluteo/, (_e, _t, c) => puente({ banco: false, carga: c })],
  [/smith machine hip raise/, () => abdominal({ tipo: 'inverso', carga: 'ninguna' })],
  [/cable kickback|patada de gluteo/, () => caderaPolea({ tipo: 'patada' })],
  [/hip abduction|abduccion/, () => caderaPolea({ tipo: 'abduccion' })],
  [/hip adduction|aduccion/, () => caderaPolea({ tipo: 'aduccion' })],

  // Sentadilla y prensa
  [/leg press|prensa/, () => prensaMultipower()],
  [/pistol/, () => sentadilla({ carga: 'multipower', variante: 'pistol' })],
  [/sissy/, () => sentadilla({ carga: 'goblet', variante: 'sissy' })],
  [/kneeling squat/, () => sentadilla({ carga: 'espalda', variante: 'rodillas' })],
  [/zercher/, () => sentadilla({ carga: 'zercher' })],
  [/overhead squat/, () => sentadilla({ carga: 'overhead', profunda: true })],
  [/jefferson|hack squat/, () => sentadilla({ carga: 'hack' })],
  [/frankenstein/, () => sentadilla({ carga: 'brazos_delante' })],
  [/front .*squat|sentadilla frontal/, (e, t) => sentadilla({ carga: e.material === 'multipower' ? 'multipower_frontal' : 'frontal', caja: /bench|banco/.test(t) })],
  [/goblet/, () => sentadilla({ carga: 'goblet' })],
  [/plie|sumo con mancuerna/, () => sentadilla({ carga: 'colgando' })],
  [/sentadilla landmine/, () => sentadilla({ carga: 'landmine' })],
  [/side split squat|lateral con barra/, () => zancada({ tipo: 'lateral', carga: 'espalda' })],
  [/one leg barbell squat/, () => zancada({ tipo: 'bulgara', carga: 'espalda' })],
  [/split squat|bulgara/, (e) => zancada({ tipo: 'bulgara', carga: e.material === 'barra' ? 'espalda' : cargaSentadilla(e) })],
  [/box squat|to a bench|a banco|al cajon/, (e) => sentadilla({ carga: cargaSentadilla(e), caja: true })],
  [/full squat|olympic squat|profunda/, (e) => sentadilla({ carga: cargaSentadilla(e), profunda: true })],
  [/squat|sentadilla/, (e) => sentadilla({ carga: cargaSentadilla(e) })],

  // Zancadas
  [/step up|subidas? al banco/, (e) => zancada({ tipo: 'subida', carga: e.material === 'mancuernas' ? 'mancuernas' : 'espalda' })],
  [/zancada lateral|side lunge/, (e) => zancada({ tipo: 'lateral', carga: e.material === 'mancuernas' ? 'mancuernas' : 'espalda' })],
  [/elevated back lunge/, (e) => zancada({ tipo: 'elevada', carga: cargaSentadilla(e) })],
  [/rear lunge|zancada atras/, (e) => zancada({ tipo: 'atras', carga: cargaSentadilla(e) })],
  [/lunge|zancada/, (e) => zancada({ tipo: 'estatica', carga: cargaSentadilla(e) })],

  // Gemelos
  [/seated .*calf|calf .*sentado|gemelo sentado/, (_e, _t, c) => gemelos({ postura: 'sentado', carga: c })],
  [/calf raise on a dumbbell/, () => gemelos({ postura: 'escalon', carga: 'mancuernas' })],
  [/calf/, (e, _t, c) => gemelos({ postura: 'de_pie', carga: e.material === 'barra' ? 'espalda' : c })],

  // Isquios
  [/curl femoral|leg curl/, () => curlFemoral()],

  // Agarre y muñecas
  [/farmer|granjero/, () => paseo({ carga: 'mancuernas' })],
  [/plate pinch|hand squeeze/, () => muneca({ postura: 'de_pie', carga: 'disco', flexion: true })],
  [/finger curls/, () => muneca({ postura: 'de_pie', carga: 'barra', flexion: true })],
  [/behind the back wrist curl/, () => muneca({ postura: 'detras', carga: 'barra', flexion: true })],
  [/(cable|pulley) wrist curl|low pulley wrist curl/, () => muneca({ postura: 'polea', carga: 'polea', flexion: true })],
  [/wrist curl.*over a bench/, (_e, t, c) => muneca({ postura: 'banco', carga: c, flexion: /palms up/.test(t), unilateral: unilateral(t) })],
  [/wrist curl/, (_e, t, c) => muneca({ postura: 'sentado', carga: c, flexion: /palms? up/.test(t), unilateral: unilateral(t) })],
  [/wrist rotations|pronation|supination/, (_e, _t, c) => muneca({ postura: 'de_pie', carga: c === 'mancuernas' ? 'mancuerna' : c, flexion: true })],
  [/car drivers/, () => volantes()],
  [/around the worlds/, () => vueltasAlMundo()],

  // Abdominales y oblicuos
  [/rollout/, (_e, t) => abdominal({ tipo: /knees|bench/.test(t) ? 'rollout' : 'rollout_pie', carga: 'barra' })],
  [/press sit up/, () => abdominal({ tipo: 'press_situp', carga: 'barra' })],
  [/reverse crunch/, () => abdominal({ tipo: 'inverso', carga: 'polea' })],
  [/standing rope crunch/, () => abdominal({ tipo: 'crunch_pie', carga: 'polea' })],
  [/seated crunch/, () => abdominal({ tipo: 'crunch_sentado', carga: 'polea' })],
  [/crunch con disco/, () => abdominal({ tipo: 'crunch_suelo', carga: 'disco' })],
  [/crunch/, () => abdominal({ tipo: 'crunch_polea', carga: 'polea' })],
  [/plate twist|barbell twist|russian twist/, (_e, _t, c) => giroTronco({ tipo: 'sentado', carga: c })],
  [/wood chop|judo flip/, () => giroTronco({ tipo: 'lenador', carga: 'polea' })],
  [/cable lift/, () => giroTronco({ tipo: 'lenador_inverso', carga: 'polea' })],
  [/spell caster/, () => giroTronco({ tipo: 'lenador', carga: 'mancuernas' })],
  [/landmine 180/, () => giroTronco({ tipo: 'landmine', carga: 'landmine' })],
  [/side bend/, (_e, _t, c) => giroTronco({ tipo: 'inclinacion', carga: c })],
  [/pallof/, (_e, t) => pallof(/rotation/.test(t))],

  // Hombro
  [/middle back shrug/, (_e, _t, c) => encogimiento({ carga: c, escapular: true })],
  [/shrug/, (_e, t, c) => encogimiento({ carga: c, detras: /behind/.test(t) })],
  [/upright .*row|remo al menton/, (_e, t, c) => remoMenton({ carga: c, unilateral: unilateral(t) })],
  [/face pull|rope rear delt rows/, () => remo({ postura: 'face_pull', carga: 'polea' })],
  [/rear delt row/, (_e, _t, c) => remo({ postura: 'inclinado', carga: c, hasta: 'pecho' })],
  [/cable rear delt fly/, () => elevacion({ tipo: 'posterior_polea', carga: 'polea' })],
  [/reverse fl|rear delt raise|rear lateral|pajaro|bent over .*side lateral/, (_e, t, c) => elevacion({ tipo: /seated/.test(t) ? 'posterior_sentado' : 'posterior', carga: c === 'polea' ? 'ninguna' : c, unilateral: unilateral(t) })],
  [/external rotation/, (_e, _t, c) => rotacion({ externa: true, carga: c })],
  [/internal rotation/, (_e, _t, c) => rotacion({ externa: false, carga: c })],
  [/incline shoulder raise/, (_e, _t, c) => elevacion({ tipo: 'protraccion', carga: c })],
  [/scaption/, (_e, _t, c) => elevacion({ tipo: 'y', carga: c })],
  [/cable iron cross/, () => aperturas({ postura: 'polea_alta', carga: 'polea' })],
  [/iron cross|power partials/, (_e, t, c) => elevacion({ tipo: 'lateral', carga: c, parcial: /partials/.test(t) })],
  [/straight raises on incline bench/, (_e, _t, c) => elevacion({ tipo: 'frontal_prono', carga: c })],
  [/front raise and pullover/, (_e, _t, c) => jalon({ tipo: 'pullover', carga: c })],
  [/(front|frontal).*(over ?head|above head|encima de la cabeza)/, (_e, t, c) => elevacion({ tipo: 'frontal_alta', carga: c, unilateral: unilateral(t) })],
  [/front .*raise|front plate raise|single dumbbell raise|^dumbbell raise|alternating deltoid raise/, (e, t, c) =>
    elevacion({ tipo: 'frontal', carga: /single dumbbell/.test(t) ? 'mancuerna' : c, unilateral: unilateral(t) && e.material !== 'discos' })],
  [/low pulley deltoid raise|cable seated lateral|seated side lateral|side lateral|lateral raise|laterals/, (_e, t, c) =>
    elevacion({
      tipo: /cable|pulley/.test(t) ? (/seated/.test(t) ? 'lateral_sentado' : 'lateral_polea') : /seated/.test(t) ? 'lateral_sentado' : 'lateral',
      carga: /cable|pulley/.test(t) ? 'ninguna' : c,
      unilateral: unilateral(t) || /cable|pulley/.test(t),
    })],
  [/linear jammer/, (_e, t) => jammer({ unilateral: unilateral(t) })],
  [/landmine press|press landmine/, () => press({ postura: 'landmine', carga: 'landmine', unilateral: true })],
  [/svend/, () => press({ postura: 'svend', carga: 'disco' })],
  [/arnold|cuban|bradford|see saw|shoulder press|military press|overhead .*press|press behind neck|anti gravity|press de hombros?|press militar|press tras nuca/, (_e, t, c) =>
    press({ postura: /seated|sentado/.test(t) ? 'sentado' : 'de_pie', carga: c, trasNuca: /behind|tras nuca/.test(t), unilateral: unilateral(t) })],

  // Pecho
  [/low cable crossover/, () => aperturas({ postura: 'polea_baja', carga: 'polea' })],
  [/crossover/, (_e, t) => aperturas({ postura: 'polea_alta', carga: 'polea', unilateral: unilateral(t) })],
  [/cable fly|flat bench cable flyes|incline cable flye/, () => aperturas({ postura: 'polea_banco', carga: 'polea' })],
  [/fly|flye|aperturas?/, (_e, t, c) => aperturas({ postura: /incline/.test(t) ? 'inclinado' : /decline/.test(t) ? 'declinado' : 'banco', carga: c, unilateral: unilateral(t) })],
  [/pullover/, (_e, t, c) => jalon({ tipo: /bent arm/.test(t) ? 'pullover_doblado' : /decline/.test(t) ? 'pullover_declinado' : 'pullover', carga: c })],
  [/skull crusher|skullcrusher/, (_e, t, c) => extension({ postura: /decline/.test(t) ? 'declinado' : 'tumbado', carga: c })],
  [/incline cable chest press/, () => press({ postura: 'polea_inclinado', carga: 'polea' })],
  [/cable chest press/, () => press({ postura: 'polea_pie', carga: 'polea' })],
  [/bench press|press de banca|floor press|board press|pin press|guillotine|jm press|tate press|close grip .*press|incline .*press|decline .*press|press inclinado|press declinado|smith press|chest press/, (_e, t, c) =>
    press({
      postura: /floor|suelo/.test(t) ? 'suelo' : /incline|inclinado/.test(t) ? 'inclinado' : /decline|declinado/.test(t) ? 'declinado' : 'banco',
      carga: c,
      unilateral: unilateral(t),
      parcial: /board|pin press/.test(t),
      hasta: /guillotine|jm press/.test(t) ? 'cuello' : 'pecho',
    })],

  // Tríceps
  [/incline pushdown/, () => jalon({ tipo: 'brazos_rectos', carga: 'polea' })],
  [/pushdown/, (_e, t) => extension({ postura: 'polea_alta', carga: 'polea', unilateral: unilateral(t) })],
  [/cable one arm tricep extension/, () => extension({ postura: 'polea_alta', carga: 'polea', unilateral: true })],
  [/seated bent over .*triceps/, (_e, t, c) => extension({ postura: 'patada_sentado', carga: c, unilateral: unilateral(t) })],
  [/tricep dumbbell kickback/, (_e, _t, c) => extension({ postura: 'patada_banco', carga: c, unilateral: true })],
  [/kickback|bent over .*triceps|patada de triceps/, (_e, t, c) => extension({ postura: 'patada', carga: c, unilateral: unilateral(t) || /polea/.test(t) })],
  [/cable lying triceps/, () => extension({ postura: 'tumbado_polea', carga: 'polea' })],
  [/cable incline triceps|incline barbell triceps/, (_e, _t, c) => extension({ postura: 'inclinado', carga: c })],
  [/decline .*triceps|decline close grip bench to skull/, (_e, _t, c) => extension({ postura: 'declinado', carga: c })],
  [/lying .*triceps|lying .*tricep|press frances|triceps press to chin|pronated .*triceps|supinated .*triceps|tricep extension pronated/, (_e, t, c) =>
    extension({ postura: 'tumbado', carga: c, unilateral: /one arm/.test(t) })],
  [/rope overhead|overhead extension with rope|low cable triceps|low pulley .*triceps|kneeling cable triceps/, () => extension({ postura: 'polea_espalda', carga: 'polea' })],
  [/seated triceps press|seated .*triceps extension/, (_e, t, c) => extension({ postura: 'sobre_cabeza_sentado', carga: c, unilateral: unilateral(t) })],
  [/triceps extension|tricep extension|extension de triceps/, (_e, t, c) => extension({ postura: 'sobre_cabeza', carga: c, unilateral: unilateral(t) })],
  [/reverse triceps bench press/, (_e, _t, c) => press({ postura: 'banco', carga: c })],

  // Bíceps
  [/spider curl|prone incline curl/, (_e, _t, c) => curl({ postura: 'prono', carga: c })],
  [/curl over incline bench|preacher|predicador/, (_e, t, c) => curl({ postura: 'predicador', carga: c, unilateral: unilateral(t) })],
  [/concentration|concentrado/, (_e, t, c) => curl({ postura: 'concentrado', carga: c, unilateral: c !== 'barra' || unilateral(t) })],
  [/curls? lying against an incline|incline .*curl|curl .*inclinado/, (_e, t, c) => curl({ postura: 'inclinado', carga: c, unilateral: unilateral(t) })],
  [/lying cable curl|bar curl on high pulley/, () => curl({ postura: 'tumbado_polea', carga: 'polea' })],
  [/lying supine|lying high bench/, (_e, _t, c) => curl({ postura: 'tumbado', carga: c })],
  [/high cable curl|overhead cable curl/, () => curl({ postura: 'polea_alta', carga: 'polea' })],
  [/bayesian|bayesiano/, () => curl({ postura: 'bayesiano', carga: 'polea', unilateral: true })],
  [/drag curl/, (_e, _t, c) => curl({ postura: 'arrastre', carga: c })],
  [/seated .*curl/, (_e, t, c) => curl({ postura: 'sentado', carga: c, unilateral: unilateral(t) })],
  [/curl/, (_e, t, c) => curl({ postura: 'de_pie', carga: c, unilateral: unilateral(t) })],

  // Espalda
  [/straight arm pulldown|brazos rectos/, () => jalon({ tipo: 'brazos_rectos', carga: 'polea' })],
  [/pulldown behind the neck|tras nuca/, () => jalon({ tipo: 'nuca', carga: 'polea' })],
  [/pulldown|jalon/, (_e, t) => jalon({ tipo: 'pecho', carga: 'polea', unilateral: unilateral(t) })],
  [/row to neck|al cuello/, () => remo({ postura: 'sentado_polea', carga: 'polea', hasta: 'cuello' })],
  [/seated .*cable .*rows?|seated one arm cable|elevated cable rows|polea baja/, (_e, t) => remo({ postura: 'sentado_polea', carga: 'polea', unilateral: unilateral(t), hasta: /ancho/.test(t) ? 'pecho' : 'abdomen' })],
  [/kneeling .*high pulley row/, (_e, t) => remo({ postura: 'polea_alta_rodillas', carga: 'polea', unilateral: unilateral(t) })],
  [/shotgun/, () => remo({ postura: 'polea_pie', carga: 'polea', unilateral: true })],
  [/one arm dumbbell row|remo con mancuerna a una mano/, () => remo({ postura: 'una_mano_banco', carga: 'mancuernas', unilateral: true })],
  [/incline row|incline bench pull|dumbbell incline row/, (_e, _t, c) => remo({ postura: 'pecho_apoyado', carga: c })],
  [/lying cambered|bench mid rows/, (_e, _t, c) => remo({ postura: 'banco_plano', carga: c })],
  [/pendlay/, (_e, _t, c) => remo({ postura: 'pendlay', carga: c })],
  [/t bar|long bar|meadows|landmine/, (_e, t) => remo({ postura: 'inclinado', carga: 'landmine', unilateral: unilateral(t) || /meadows/.test(t) })],
  [/row|remo/, (_e, t, c) => remo({ postura: 'inclinado', carga: c, unilateral: unilateral(t) })],
]

/** Patrón típico del músculo principal (de su zona), para ejercicios propios sin regla. */
function generico(e: EjercicioAnimable, c: Carga): Animacion {
  const principal: Musculo | undefined = e.musculosPrincipales[0]
  const m: Zona = principal ? zonaDe(principal) : 'pectoral_inferior'
  const sc = cargaSentadilla(e)
  switch (m) {
    case 'pectoral_superior':
      return press({ postura: c === 'polea' ? 'polea_inclinado' : 'inclinado', carga: c })
    case 'pectoral_inferior':
      return press({ postura: c === 'polea' ? 'polea_pie' : 'banco', carga: c })
    case 'deltoides_anterior':
      return press({ postura: 'de_pie', carga: c })
    case 'deltoides_lateral':
      return elevacion({ tipo: c === 'polea' ? 'lateral_polea' : 'lateral', carga: c === 'polea' ? 'ninguna' : c, unilateral: c === 'polea' })
    case 'deltoides_posterior':
      return elevacion({ tipo: 'posterior', carga: c === 'polea' ? 'ninguna' : c })
    case 'biceps':
    case 'braquial':
      return curl({ postura: 'de_pie', carga: c })
    case 'triceps':
      return extension({ postura: c === 'polea' ? 'polea_alta' : 'sobre_cabeza', carga: c })
    case 'antebrazos':
      return muneca({ postura: 'sentado', carga: c, flexion: true })
    case 'trapecio':
      return encogimiento({ carga: c })
    case 'espalda_media':
      return remo({ postura: c === 'polea' ? 'sentado_polea' : 'inclinado', carga: c })
    case 'dorsales':
      return c === 'polea' ? jalon({ tipo: 'pecho', carga: c }) : remo({ postura: 'inclinado', carga: c })
    case 'lumbares':
    case 'isquiotibiales':
      return bisagra({ tipo: 'rumano', carga: c })
    case 'abdomen':
      return abdominal({ tipo: c === 'polea' ? 'crunch_polea' : 'crunch_suelo', carga: c })
    case 'oblicuos':
      return giroTronco({ tipo: 'inclinacion', carga: c })
    case 'gluteo_mayor':
      return puente({ banco: true, carga: c === 'mancuernas' ? 'mancuernas' : c })
    case 'gluteo_medio':
      return caderaPolea({ tipo: 'abduccion' })
    case 'aductores':
      return caderaPolea({ tipo: 'aduccion' })
    case 'cuadriceps':
      return sentadilla({ carga: sc })
    case 'gemelos':
      return gemelos({ postura: 'de_pie', carga: c === 'barra' ? 'espalda' : c })
    case 'soleo':
      return gemelos({ postura: 'sentado', carga: c })
    case 'cuello':
      return cuello({ bocaArriba: true })
  }
}

export interface Asignacion {
  animacion: Animacion
  /** Regla que la eligió ("genérica" si ninguna encajó). */
  regla: string
}

export function asignarAnimacion(e: EjercicioAnimable): Asignacion {
  const t = texto(e)
  const c = CARGA[e.material]
  for (const [re, crear] of REGLAS) if (re.test(t)) return { animacion: crear(e, t, c), regla: re.source }
  return { animacion: generico(e, c), regla: 'genérica' }
}
