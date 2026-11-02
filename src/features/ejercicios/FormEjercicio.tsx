import { useState, type FormEvent } from 'react'
import { Boton, Campo, claseInput } from '../../components/ui'
import type { DatosEjercicio } from '../../db/ejercicios'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO, SALTO_POR_MATERIAL } from '../../domain/etiquetas'
import { MATERIALES, MUSCULOS, type Material, type Musculo } from '../../domain/tipos'
import { parseNumero } from '../../lib/formato'

interface Props {
  inicial?: DatosEjercicio
  textoGuardar: string
  onGuardar: (datos: DatosEjercicio) => void
}

const VACIO: DatosEjercicio = {
  nombre: '',
  musculoPrincipal: 'pecho',
  musculosSecundarios: [],
  material: 'maquina',
  saltoPeso: SALTO_POR_MATERIAL.maquina,
  notasFijas: '',
}

export function FormEjercicio({ inicial = VACIO, textoGuardar, onGuardar }: Props) {
  const [d, setD] = useState(inicial)
  const [salto, setSalto] = useState(String(inicial.saltoPeso).replace('.', ','))
  const saltoNum = parseNumero(salto)
  const valido = d.nombre.trim().length > 0 && saltoNum !== null && saltoNum >= 0

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!valido || saltoNum === null) return
    onGuardar({ ...d, nombre: d.nombre.trim(), saltoPeso: saltoNum })
  }

  const alternarSecundario = (m: Musculo) =>
    setD((x) => ({
      ...x,
      musculosSecundarios: x.musculosSecundarios.includes(m)
        ? x.musculosSecundarios.filter((s) => s !== m)
        : [...x.musculosSecundarios, m],
    }))

  return (
    <form onSubmit={enviar} className="space-y-5">
      <Campo etiqueta="Nombre">
        <input
          className={claseInput}
          value={d.nombre}
          onChange={(e) => setD({ ...d, nombre: e.target.value })}
          placeholder="Ej. Press de pecho Hammer"
          required
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Músculo principal">
          <select
            className={claseInput}
            value={d.musculoPrincipal}
            onChange={(e) => {
              const m = e.target.value as Musculo
              setD({ ...d, musculoPrincipal: m, musculosSecundarios: d.musculosSecundarios.filter((s) => s !== m) })
            }}
          >
            {MUSCULOS.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MUSCULO[m]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Material">
          <select
            className={claseInput}
            value={d.material}
            onChange={(e) => {
              const material = e.target.value as Material
              setD({ ...d, material })
              setSalto(String(SALTO_POR_MATERIAL[material]).replace('.', ','))
            }}
          >
            {MATERIALES.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MATERIAL[m]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-muted">Músculos secundarios</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCULOS.filter((m) => m !== d.musculoPrincipal).map((m) => {
            const activo = d.musculosSecundarios.includes(m)
            return (
              <button
                key={m}
                type="button"
                aria-pressed={activo}
                onClick={() => alternarSecundario(m)}
                className={`min-h-10 rounded-full border px-3 text-sm transition ${
                  activo ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
                }`}
              >
                {NOMBRE_MUSCULO[m]}
              </button>
            )
          })}
        </div>
      </fieldset>

      <Campo etiqueta="Salto de peso (kg)" ayuda="Lo que suman o restan los botones +/− y la progresión.">
        <input
          className={`${claseInput} num`}
          inputMode="decimal"
          value={salto}
          onChange={(e) => setSalto(e.target.value)}
        />
      </Campo>

      <Campo etiqueta="Notas fijas" ayuda="Ajustes de la máquina: altura del asiento, agarre… Se ven durante el entreno.">
        <textarea
          className={`${claseInput} min-h-24 py-3`}
          value={d.notasFijas}
          onChange={(e) => setD({ ...d, notasFijas: e.target.value })}
          placeholder="Asiento en 4, respaldo en 2"
        />
      </Campo>

      <Boton type="submit" variante="primario" className="w-full" disabled={!valido}>
        {textoGuardar}
      </Boton>
    </form>
  )
}
