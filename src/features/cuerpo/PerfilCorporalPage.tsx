import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useFormaResuelta } from '../../avatar3d/useFormaResuelta'
import { Cabecera } from '../../components/Cabecera'
import { Boton, Segmentado, Tarjeta } from '../../components/ui'
import { AJUSTE_NEUTRO, type AjusteFino, type DatoQueFalta } from '../../domain/cuerpo'
import type { Sexo } from '../../domain/nutricion'
import type { Musculo } from '../../domain/tipos'
import { guardarAjustes, useAjustes } from '../../hooks/useAjustes'
import { useCuerpo } from '../../hooks/useCuerpo'
import { fmtKg } from '../../lib/formato'
import { CampoNumero } from '../ajustes/SeccionCuerpo'
import { AntesAhora } from './AntesAhora'
import { SeccionGrasa } from './SeccionGrasa'
import { SeccionMedidas } from './SeccionMedidas'

// El visor 3D (three.js) se carga aparte, como en el resto de la app.
const Cuerpo3D = lazy(() => import('../../components/cuerpo3d/Cuerpo3D').then((m) => ({ default: m.Cuerpo3D })))

const SIN_NIVELES: ReadonlyMap<Musculo, number> = new Map()
const NOMBRE_FALTA: Record<DatoQueFalta, string> = { sexo: 'el sexo', edad: 'la edad', altura: 'la altura', peso: 'el peso' }
/** «a», «a y b», «a, b y c». */
const enumerar = (l: string[]) => (l.length < 2 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} y ${l.at(-1)}`)
const DESLIZADORES: { clave: keyof AjusteFino; nombre: string; menos: string; mas: string }[] = [
  { clave: 'hombros', nombre: 'Anchura de hombros', menos: 'Estrechos', mas: 'Anchos' },
  { clave: 'cintura', nombre: 'Cintura', menos: 'Fina', mas: 'Ancha' },
  { clave: 'piernas', nombre: 'Longitud de piernas', menos: 'Cortas', mas: 'Largas' },
  { clave: 'brazos', nombre: 'Longitud de brazos', menos: 'Cortos', mas: 'Largos' },
]

/**
 * Perfil corporal (Ajustes): los datos que dan forma a mi avatar. Sexo, edad, altura y peso; medidas
 * con cinta y grasa corporal (opcionales), un ajuste fino a ojo y la comparación Antes / Ahora.
 * Todo se guarda solo en el móvil.
 */
export function PerfilCorporalPage() {
  const a = useAjustes()
  const cuerpo = useCuerpo()

  // Ajuste fino: se ve en directo mientras se mueve el deslizador y se guarda un momento después.
  const [enDirecto, setEnDirecto] = useState<AjusteFino | null>(null)
  const ajuste = useMemo(() => enDirecto ?? { ...AJUSTE_NEUTRO, ...a.ajusteAvatar }, [enDirecto, a.ajusteAvatar])
  const pendiente = useRef<AjusteFino | null>(null)
  useEffect(() => {
    if (!enDirecto) return
    pendiente.current = enDirecto
    const t = window.setTimeout(() => {
      pendiente.current = null
      void guardarAjustes({ ajusteAvatar: enDirecto })
    }, 400)
    return () => window.clearTimeout(t)
  }, [enDirecto])
  // Al salir de la pantalla, lo que quedara por guardar.
  useEffect(
    () => () => {
      if (pendiente.current) void guardarAjustes({ ajusteAvatar: pendiente.current })
    },
    [],
  )

  const datos = useMemo(() => (cuerpo ? { ...cuerpo.datos, ajuste } : null), [cuerpo, ajuste])
  const cuerpos = useMemo(() => (datos ? [datos] : []), [datos])
  const resuelta = useFormaResuelta(datos)
  const sexo = a.sexo ?? (cuerpo && !cuerpo.faltan.includes('sexo') ? cuerpo.datos.sexo : null)
  const movido = DESLIZADORES.some((d) => ajuste[d.clave] !== 0)

  return (
    <>
      <Cabecera titulo="Perfil corporal" subtitulo="Tu avatar se parece a ti: cambia con tu peso y tus medidas" atras="/ajustes" />
      <div className="mt-2 space-y-4">
        <Tarjeta>
          <Suspense fallback={<div className="h-80 w-full" aria-hidden />}>
            <Cuerpo3D niveles={SIN_NIVELES} cuerpos={cuerpos} className="h-80" />
          </Suspense>
          {cuerpo && (
            <p className="mt-2 text-center text-sm text-muted">
              <span className="num text-fg">{cuerpo.datos.alturaCm}</span> cm · <span className="num text-fg">{fmtKg(cuerpo.datos.kg)}</span> kg
              {cuerpo.kg !== null && ' (tendencia)'}
              {resuelta && (
                <>
                  {' · '}
                  <span className="num text-fg">{fmtKg(resuelta.grasa)} %</span> de grasa{!resuelta.grasaConocida && ' (estimada)'}
                </>
              )}
            </p>
          )}
          {cuerpo && cuerpo.faltan.length > 0 && (
            <p className="mt-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
              Falta {enumerar(cuerpo.faltan.map((f) => NOMBRE_FALTA[f]))}: mientras tanto, el avatar usa valores corrientes.
            </p>
          )}

          <details className="mt-3 border-t border-line pt-2" open={movido}>
            <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold">
              Ajuste fino
              <span className="text-xs font-normal text-muted">Para corregir a ojo lo que los datos no captan</span>
            </summary>
            <div className="space-y-3 pb-1">
              {DESLIZADORES.map((d) => (
                <label key={d.clave} className="block">
                  <span className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{d.nombre}</span>
                    <span className="num text-xs text-muted">{ajuste[d.clave] === 0 ? 'Según los datos' : `${ajuste[d.clave] > 0 ? '+' : '−'}${Math.round(Math.abs(ajuste[d.clave]) * 100)} %`}</span>
                  </span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={ajuste[d.clave]}
                    onChange={(e) => setEnDirecto({ ...ajuste, [d.clave]: Number(e.target.value) })}
                    className="mt-1 h-11 w-full accent-[var(--accent)]"
                    aria-valuetext={`${d.nombre}: ${Math.round(ajuste[d.clave] * 100)} %`}
                  />
                  <span className="flex justify-between text-[11px] text-muted" aria-hidden>
                    <span>{d.menos}</span>
                    <span>{d.mas}</span>
                  </span>
                </label>
              ))}
              {movido && (
                <Boton variante="fantasma" onClick={() => setEnDirecto({ ...AJUSTE_NEUTRO })}>
                  Volver a lo que dicen los datos
                </Boton>
              )}
            </div>
          </details>
        </Tarjeta>

        <Tarjeta>
          <h2 className="mb-3 font-bold">Datos</h2>
          <Segmentado<Sexo | 'sin'>
            etiqueta="Sexo"
            valor={sexo ?? 'sin'}
            onCambio={(v) => v !== 'sin' && guardarAjustes({ sexo: v })}
            opciones={[
              { valor: 'hombre', texto: 'Hombre' },
              { valor: 'mujer', texto: 'Mujer' },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <CampoNumero etiqueta="Edad" valor={a.edad} min={10} max={110} onGuardar={(v) => guardarAjustes({ edad: v })} />
            <CampoNumero etiqueta="Altura (cm)" valor={a.alturaCm} min={100} max={250} onGuardar={(v) => guardarAjustes({ alturaCm: v })} />
          </div>
          <p className="mt-3 flex min-h-12 items-center justify-between gap-2 text-sm">
            <span>
              Peso:{' '}
              {cuerpo?.kg != null ? (
                <>
                  <span className="num font-semibold">{fmtKg(cuerpo.kg)} kg</span> <span className="text-muted">(media de la semana)</span>
                </>
              ) : (
                <span className="text-muted">sin registros</span>
              )}
            </span>
            <Link to="/peso" className="flex min-h-11 items-center px-2 font-semibold text-accent">
              Registrar peso
            </Link>
          </p>
          <p className="text-xs text-muted">El peso sale de tu registro: el avatar usa la tendencia (la media de la semana), no el dato de un día.</p>
        </Tarjeta>

        <SeccionGrasa sexo={cuerpo?.datos.sexo ?? 'hombre'} vigente={cuerpo?.grasa ?? null} estimada={resuelta && !resuelta.grasaConocida ? resuelta.grasa : null} />

        <SeccionMedidas delAvatar={resuelta?.medidas ?? null} />

        <AntesAhora />

        <p className="px-2 pb-2 text-center text-xs text-muted">Todo esto se guarda solo en tu móvil (y en tus copias de seguridad).</p>
      </div>
    </>
  )
}
