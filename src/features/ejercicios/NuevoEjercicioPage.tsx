import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { MapaMuscular } from '../../components/mapa/MapaMuscular'
import { Boton, Campo, Chip, claseInput } from '../../components/ui'
import { crearEjercicio } from '../../db/ejercicios'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { MATERIALES_BIBLIOTECA, type Material, type Musculo } from '../../domain/tipos'
import { nombresDeMusculos } from '../../domain/musculos'
import { EnlacesMusculos } from '../../components/mapa/EnlacesMusculos'
import { PROFUNDOS } from '../../domain/musculos'

type Papel = 'principal' | 'secundario'

/** Ejercicio propio, solo para lo que no exista en la biblioteca. Después de crearlo queda fijo como los demás. */
export function NuevoEjercicioPage() {
  const navegar = useNavigate()
  const [nombre, setNombre] = useState('')
  const [material, setMaterial] = useState<Material>('polea')
  const [musculos, setMusculos] = useState<Map<Musculo, Papel>>(new Map())

  const principales = [...musculos].filter(([, p]) => p === 'principal').map(([m]) => m)
  const secundarios = [...musculos].filter(([, p]) => p === 'secundario').map(([m]) => m)
  const valido = nombre.trim().length > 1 && principales.length > 0

  // Cada toque: sin marcar → principal → secundario → sin marcar.
  const tocar = (m: Musculo) =>
    setMusculos((prev) => {
      const sig = new Map(prev)
      const actual = prev.get(m)
      if (!actual) sig.set(m, 'principal')
      else if (actual === 'principal') sig.set(m, 'secundario')
      else sig.delete(m)
      return sig
    })

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!valido) return
    const id = await crearEjercicio({ nombre: nombre.trim(), material, musculosPrincipales: principales, musculosSecundarios: secundarios })
    navegar(`/rutinas/ejercicios/${encodeURIComponent(id)}`, { replace: true })
  }

  return (
    <>
      <Cabecera titulo="Ejercicio propio" subtitulo="Solo para lo que no esté en la biblioteca" atras />
      <form onSubmit={enviar} className="mt-4 space-y-5">
        <Campo etiqueta="Nombre">
          <input
            className={claseInput}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Press de pecho Hammer declinado"
            required
          />
        </Campo>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-muted">Material</legend>
          <div className="flex flex-wrap gap-2">
            {MATERIALES_BIBLIOTECA.map((m) => (
              <Chip key={m} activo={material === m} onClick={() => setMaterial(m)}>
                {NOMBRE_MATERIAL[m]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-muted">Músculos: toca una vez para principal, dos para secundario y tres para quitarlo</legend>
          <div className="mt-2 rounded-3xl border border-line bg-surface p-3">
            <MapaMuscular
              niveles={new Map([...musculos].map(([m, p]) => [m, p === 'principal' ? 5 : 2]))}
              onTocar={tocar}
              describir={(m) => `${NOMBRE_MUSCULO[m]}: ${musculos.get(m) ?? 'sin marcar'}`}
              className="h-80"
            />
            <EnlacesMusculos
              titulo="Profundos:"
              lista={PROFUNDOS}
              alElegir={tocar}
              activo={(m) => musculos.has(m)}
              detalle={(m) => musculos.get(m) && <span className="ml-1 text-muted">({musculos.get(m)})</span>}
            />
          </div>
          <p className="mt-2 text-sm">
            <span className="text-muted">Principales: </span>
            <span className="font-semibold">{nombresDeMusculos(principales).join(', ') || '—'}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted">Secundarios: </span>
            {nombresDeMusculos(secundarios).join(', ') || '—'}
          </p>
        </fieldset>

        <p className="text-sm text-muted">Una vez creado, sus músculos y su material no se podrán cambiar; tus notas sí.</p>
        <Boton type="submit" variante="primario" className="w-full" disabled={!valido}>
          Crear ejercicio
        </Boton>
      </form>
    </>
  )
}
