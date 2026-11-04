import { useState } from 'react'
import { Avatar3D } from '../../components/avatar3d/Avatar3D'
import { Cabecera } from '../../components/Cabecera'
import { LeyendaMapa } from '../../components/mapa/MapaMuscular'
import { Segmentado, Tarjeta } from '../../components/ui'
import { ESCALA_SEMANA_AVATAR } from '../../domain/avatar'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { nivelesDeEjercicio, nivelesDeTrabajo, rotulosEscala, trabajoMuscular } from '../../domain/mapaMuscular'
import type { Musculo, Tema } from '../../domain/tipos'
import { guardarAjustes, useAjustes } from '../../hooks/useAjustes'
import { fmtKg, plural } from '../../lib/formato'

// Página de revisión del avatar (fase 3 de la ronda 2). No está enlazada desde la app: /vista-previa/avatar.

type Def = { nombre: string; principales: Musculo[]; secundarios: Musculo[] }
const EJERCICIOS: Record<string, Def> = {
  banca: { nombre: 'Press de banca con barra', principales: ['pecho'], secundarios: ['hombros', 'triceps'] },
  inclinado: { nombre: 'Press inclinado con mancuernas', principales: ['pecho'], secundarios: ['hombros', 'triceps'] },
  remo: { nombre: 'Remo con barra', principales: ['espalda_media', 'dorsales'], secundarios: ['biceps', 'hombros'] },
  jalon: { nombre: 'Jalón al pecho', principales: ['dorsales'], secundarios: ['biceps'] },
  militar: { nombre: 'Press militar de pie', principales: ['hombros'], secundarios: ['triceps'] },
  laterales: { nombre: 'Elevaciones laterales', principales: ['hombros'], secundarios: [] },
  curl: { nombre: 'Curl con barra', principales: ['biceps'], secundarios: ['antebrazos'] },
  frances: { nombre: 'Press francés', principales: ['triceps'], secundarios: [] },
  sentadilla: { nombre: 'Sentadilla con barra', principales: ['cuadriceps'], secundarios: ['gluteos', 'aductores', 'lumbares'] },
  rumano: { nombre: 'Peso muerto rumano', principales: ['isquiotibiales'], secundarios: ['gluteos', 'lumbares'] },
  hip: { nombre: 'Hip thrust con barra', principales: ['gluteos'], secundarios: ['isquiotibiales', 'abductores'] },
  gemelos: { nombre: 'Elevación de talones en multipower', principales: ['gemelos'], secundarios: [] },
  encogimientos: { nombre: 'Encogimientos con barra', principales: ['trapecio'], secundarios: ['cuello'] },
  crunch: { nombre: 'Crunch en polea', principales: ['abdomen'], secundarios: [] },
}

type Estado = 'vacia' | 'media' | 'completa' | 'ficha'

const SEMANAS: Record<Exclude<Estado, 'ficha'>, [string, number][]> = {
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
  const trabajo = trabajoDe(estado === 'ficha' ? [] : SEMANAS[estado])
  const niveles = estado === 'ficha' ? nivelesDeEjercicio(fichas.get('banca')!) : nivelesDeTrabajo(trabajo, ESCALA_SEMANA_AVATAR)
  const t = sel ? trabajo.get(sel) : undefined

  return (
    <>
      <Cabecera titulo="Vista previa del avatar" subtitulo="Para revisar antes de usarlo en toda la app" atras="/" />
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
        <p className="mt-0.5 text-sm text-muted">Arrastra en horizontal para girarlo. Toca un músculo para ver sus series.</p>
        <Avatar3D niveles={niveles} seleccionado={sel} onTocar={(m) => setSel(sel === m ? null : m)} className="mt-3" />
        <div className="mt-2">
          <LeyendaMapa rotulos={rotulosEscala(ESCALA_SEMANA_AVATAR)} unidad="series" />
        </div>
        <div className="mt-3 min-h-14 rounded-2xl bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
          {!sel ? (
            <p className="text-muted">Toca un músculo.</p>
          ) : (
            <>
              <p className="flex justify-between gap-2">
                <span className="font-bold">{NOMBRE_MUSCULO[sel]}</span>
                <span className="text-muted">{t ? `${fmtKg(t.series)} ${plural(t.series, 'serie')} esta semana` : 'Sin trabajar esta semana'}</span>
              </p>
              {t && (
                <ul className="mt-1 space-y-0.5">
                  {[...t.porEjercicio].map(([id, n]) => (
                    <li key={id} className="flex justify-between gap-3 text-muted">
                      <span className="truncate">{EJERCICIOS[id]?.nombre}</span>
                      <span className="num shrink-0 text-fg">{fmtKg(n)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Tarjeta>
    </>
  )
}

const TITULOS: Record<Estado, string> = {
  vacia: 'Semana vacía',
  media: 'Semana media: torso el lunes y pierna el miércoles',
  completa: 'Semana completa: cuatro días',
  ficha: 'Ficha del press de banca: principal a tope, secundarios suaves',
}
