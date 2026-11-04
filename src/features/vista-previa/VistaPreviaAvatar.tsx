import { useState } from 'react'
import { Avatar } from '../../components/avatar/Avatar'
import { Cabecera } from '../../components/Cabecera'
import { LeyendaMapa, MapaMuscular } from '../../components/mapa/MapaMuscular'
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

const SEMANAS: Record<'vacia' | 'media' | 'completa', [string, number][]> = {
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
  return (
    <>
      <Cabecera titulo="Vista previa del avatar" subtitulo="Para revisar antes de usarlo en toda la app" atras="/" />
      <Tarjeta className="mt-2">
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
      <Semana titulo="Semana vacía" texto="Lunes por la mañana: todo en gris." series={SEMANAS.vacia} />
      <Semana titulo="Semana media" texto="Torso el lunes y pierna el miércoles." series={SEMANAS.media} />
      <Semana titulo="Semana completa" texto="Cuatro días: torso, pierna, torso y pierna." series={SEMANAS.completa} />
      <Tarjeta className="mt-4">
        <h2 className="font-bold">Ficha de un ejercicio</h2>
        <p className="mt-0.5 text-sm text-muted">Press de banca: principal a tope, secundarios suaves.</p>
        <Avatar niveles={nivelesDeEjercicio(fichas.get('banca')!)} className="mt-3" />
      </Tarjeta>
      <Tarjeta className="mt-4">
        <h2 className="font-bold">Antes (figura actual)</h2>
        <p className="mt-0.5 text-sm text-muted">La misma semana media con el mapa que usa hoy la app.</p>
        <MapaMuscular niveles={nivelesDeTrabajo(trabajoDe(SEMANAS.media), ESCALA_SEMANA_AVATAR)} className="mt-3 h-72" />
      </Tarjeta>
    </>
  )
}

function Semana({ titulo, texto, series }: { titulo: string; texto: string; series: [string, number][] }) {
  const [sel, setSel] = useState<Musculo | null>(null)
  const trabajo = trabajoDe(series)
  const t = sel ? trabajo.get(sel) : undefined
  return (
    <Tarjeta className="mt-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Semana del 2 al 8 nov</p>
      <h2 className="font-bold">{titulo}</h2>
      <p className="mt-0.5 text-sm text-muted">{texto}</p>
      <Avatar
        niveles={nivelesDeTrabajo(trabajo, ESCALA_SEMANA_AVATAR)}
        seleccionado={sel}
        onTocar={(m) => setSel(sel === m ? null : m)}
        className="mt-3"
      />
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
  )
}
