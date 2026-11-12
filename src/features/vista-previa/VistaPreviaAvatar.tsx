import { useRef, useState } from 'react'
import { Avatar } from '../../components/avatar/Avatar'
import { Cuerpo3D, type Cuerpo3DControl } from '../../components/cuerpo3d/Cuerpo3D'
import { Cabecera } from '../../components/Cabecera'
import { FichaMusculo } from '../../components/mapa/MapaConDetalle'
import { LeyendaMapa } from '../../components/mapa/MapaMuscular'
import { Segmentado, Tarjeta } from '../../components/ui'
import { ESCALA_SEMANA_AVATAR } from '../../domain/avatar'
import { nivelesDeEjercicio, nivelesDeTrabajo, rotulosEscala, trabajoMuscular } from '../../domain/mapaMuscular'
import { MUSCULOS, type Musculo, type Tema } from '../../domain/tipos'
import { guardarAjustes, useAjustes } from '../../hooks/useAjustes'

// Página de revisión del cuerpo 3D (ronda 3, fase 3): /vista-previa/avatar, enlazada desde Ajustes.

type Def = { nombre: string; principales: Musculo[]; secundarios: Musculo[] }
const EJERCICIOS: Record<string, Def> = {
  banca: { nombre: 'Press de banca con barra', principales: ['pecho'], secundarios: ['hombros', 'triceps'] },
  inclinado: { nombre: 'Press inclinado con mancuernas', principales: ['pecho'], secundarios: ['hombros', 'triceps'] },
  remo: { nombre: 'Remo con barra', principales: ['dorsales', 'espalda_alta'], secundarios: ['biceps', 'hombros', 'lumbares'] },
  jalon: { nombre: 'Jalón al pecho', principales: ['dorsales'], secundarios: ['biceps', 'espalda_alta'] },
  militar: { nombre: 'Press militar de pie', principales: ['hombros'], secundarios: ['triceps', 'trapecio'] },
  laterales: { nombre: 'Elevaciones laterales', principales: ['hombros'], secundarios: ['trapecio'] },
  curl: { nombre: 'Curl con barra', principales: ['biceps'], secundarios: ['antebrazos'] },
  frances: { nombre: 'Press francés', principales: ['triceps'], secundarios: [] },
  sentadilla: { nombre: 'Sentadilla con barra', principales: ['cuadriceps', 'gluteos'], secundarios: ['aductores', 'lumbares'] },
  rumano: { nombre: 'Peso muerto rumano', principales: ['isquiotibiales', 'gluteos'], secundarios: ['lumbares', 'antebrazos'] },
  hip: { nombre: 'Hip thrust con barra', principales: ['gluteos'], secundarios: ['isquiotibiales', 'abductores'] },
  gemelos: { nombre: 'Elevación de talones en multipower', principales: ['gemelos'], secundarios: [] },
  encogimientos: { nombre: 'Encogimientos con barra', principales: ['trapecio'], secundarios: ['cuello', 'antebrazos'] },
  crunch: { nombre: 'Crunch en polea', principales: ['abdominales'], secundarios: ['oblicuos'] },
}

const NOMBRES = new Map(Object.entries(EJERCICIOS).map(([id, d]) => [id, d.nombre]))

type Estado = 'vacia' | 'media' | 'completa' | 'ficha' | 'niveles'
type Angulo = 'frente' | 'tres_cuartos' | 'perfil' | 'espalda'
const ANGULOS: Record<Angulo, number> = { frente: 0, tres_cuartos: -Math.PI / 4, perfil: -Math.PI / 2, espalda: Math.PI }

/** Todos los niveles a la vez: cada músculo con un nivel del 1 al 5, repartidos por el cuerpo. */
const TODOS_LOS_NIVELES = new Map<Musculo, number>(MUSCULOS.map((m, i) => [m, (i % 5) + 1]))

const SEMANAS: Record<Exclude<Estado, 'ficha' | 'niveles'>, [string, number][]> = {
  vacia: [],
  // Lunes torso y miércoles pierna.
  media: [
    ['banca', 4],
    ['remo', 4],
    ['militar', 3],
    ['curl', 2],
    ['sentadilla', 4],
    ['rumano', 3],
  ],
  // Cuatro días: torso, pierna, torso y pierna.
  completa: [
    ['banca', 8],
    ['inclinado', 6],
    ['remo', 8],
    ['jalon', 6],
    ['militar', 6],
    ['laterales', 8],
    ['curl', 8],
    ['frances', 8],
    ['sentadilla', 8],
    ['rumano', 8],
    ['hip', 6],
    ['gemelos', 8],
    ['encogimientos', 6],
    ['crunch', 6],
  ],
}

const fichas = new Map(Object.entries(EJERCICIOS).map(([id, e]) => [id, { musculosPrincipales: e.principales, musculosSecundarios: e.secundarios }]))
const trabajoDe = (s: [string, number][]) => trabajoMuscular(s.map(([ejercicioId, cantidad]) => ({ ejercicioId, cantidad })), fichas)

export function VistaPreviaAvatar() {
  const ajustes = useAjustes()
  const [estado, setEstado] = useState<Estado>('media')
  const [sel, setSel] = useState<Musculo | null>(null)
  const [angulo, setAngulo] = useState<Angulo>('frente')
  const cuerpo = useRef<Cuerpo3DControl>(null)
  const trabajo = trabajoDe(estado === 'ficha' || estado === 'niveles' ? [] : SEMANAS[estado])
  const niveles =
    estado === 'ficha' ? nivelesDeEjercicio(fichas.get('banca')!) : estado === 'niveles' ? TODOS_LOS_NIVELES : nivelesDeTrabajo(trabajo, ESCALA_SEMANA_AVATAR)

  return (
    <>
      <Cabecera titulo="Vista previa del cuerpo 3D" subtitulo="Para revisar antes de usarlo en toda la app" atras="/ajustes" />
      <Tarjeta className="mt-2 space-y-3">
        <Segmentado<Estado>
          etiqueta="Ejemplo"
          valor={estado}
          onCambio={setEstado}
          opciones={[
            { valor: 'vacia', texto: 'Vacía' },
            { valor: 'media', texto: 'Media' },
            { valor: 'completa', texto: 'Completa' },
            { valor: 'ficha', texto: 'Ficha' },
            { valor: 'niveles', texto: 'Niveles' },
          ]}
        />
        <Segmentado<Angulo>
          etiqueta="Ángulo"
          valor={angulo}
          onCambio={(a) => {
            setAngulo(a)
            cuerpo.current?.girarA(ANGULOS[a], false)
          }}
          opciones={[
            { valor: 'frente', texto: 'Frente' },
            { valor: 'tres_cuartos', texto: '¾' },
            { valor: 'perfil', texto: 'Perfil' },
            { valor: 'espalda', texto: 'Espalda' },
          ]}
        />
        <Segmentado<Tema>
          etiqueta="Tema"
          valor={ajustes.tema}
          onCambio={(tema) => guardarAjustes({ tema })}
          opciones={[
            { valor: 'oscuro', texto: 'Oscuro' },
            { valor: 'claro', texto: 'Claro' },
          ]}
        />
      </Tarjeta>

      <Tarjeta className="mt-4">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Semana del 2 al 8 nov</p>
        <h2 className="font-bold">{TITULOS[estado]}</h2>
        <p className="mt-0.5 text-sm text-muted">Arrastra para girarlo, pellizca para acercarlo y toca dos veces para volver de frente. Toca un músculo para ver sus series.</p>
        <Cuerpo3D
          ref={cuerpo}
          niveles={niveles}
          seleccionado={sel}
          onTocar={(m) => setSel(sel === m ? null : m)}
          className="mt-3"
          sinWebgl={<Avatar niveles={niveles} seleccionado={sel} onTocar={(m) => setSel(sel === m ? null : m)} />}
        />
        <div className="mt-2">
          <LeyendaMapa rotulos={rotulosEscala(ESCALA_SEMANA_AVATAR)} unidad="series" />
        </div>
        <FichaMusculo sel={sel} trabajo={trabajo} nombres={NOMBRES} periodo="esta semana" alElegir={setSel} />
      </Tarjeta>
    </>
  )
}

const TITULOS: Record<Estado, string> = {
  vacia: 'Semana vacía',
  media: 'Semana media: torso el lunes y pierna el miércoles',
  completa: 'Semana completa: cuatro días',
  ficha: 'Ficha del press de banca: principal a tope, secundarios suaves',
  niveles: 'Los cinco niveles a la vez (del 1 al 5 repartidos por el cuerpo)',
}
