import { useState } from 'react'
import { Link } from 'react-router'
import { Boton, Campo, claseInput, Tarjeta } from '../../components/ui'
import { avisar } from '../../lib/avisos'
import { guardarClaveIA, useClaveIA } from '../../lib/claveIA'

/** Nutrición en Ajustes: el objetivo y la clave opcional de Anthropic para escribir comidas en texto. */
export function SeccionNutricion() {
  const clave = useClaveIA()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  return (
    <Tarjeta>
      <h2 className="mb-1 font-bold">Nutrición</h2>
      <Link to="/nutricion/perfil" className="flex min-h-12 items-center font-semibold text-accent">
        Objetivo, proteína y reto de fruta y verdura
      </Link>
      <div className="mt-2 border-t border-line pt-3">
        <p className="font-medium">Describir comidas con IA (opcional)</p>
        <p className="text-sm text-muted">
          Con tu clave de la API de Anthropic puedes escribir «200 g de pollo con 80 g de arroz» y la app lo convierte en alimentos. Sin clave, todo lo demás funciona igual. La clave se queda
          solo en este dispositivo y no entra en las copias de seguridad.
        </p>
        {clave && !editando ? (
          <div className="mt-2 flex items-center gap-2">
            <p className="num flex-1 truncate text-sm">Clave guardada: ••••{clave.slice(-4)}</p>
            <Boton
              onClick={() => {
                guardarClaveIA('')
                avisar('Clave borrada')
              }}
            >
              Borrar
            </Boton>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <Campo etiqueta="Clave de la API">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className={claseInput}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="sk-ant-…"
              />
            </Campo>
            <Boton
              variante="primario"
              className="w-full"
              disabled={!texto.trim().startsWith('sk-')}
              onClick={() => {
                guardarClaveIA(texto)
                setTexto('')
                setEditando(false)
                avisar('Clave guardada')
              }}
            >
              Guardar clave
            </Boton>
            <p className="text-xs text-muted">La consigues en console.anthropic.com → API Keys. Cada uso lo cobra Anthropic en tu cuenta.</p>
          </div>
        )}
      </div>
    </Tarjeta>
  )
}
