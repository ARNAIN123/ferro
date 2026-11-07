import { useEffect, useState } from 'react'
import { Boton, Tarjeta } from '../../components/ui'
import { actualizarPerfil, alimentosGenericos } from '../../db/nutricion'
import { retoDeLaSemana } from '../../domain/registroComidas'
import type { EstadoReto, PerfilNutricion } from '../../domain/tiposNutricion'

/** Reto suave y opcional de fruta o verdura: sin rachas ni presión. */
export function TarjetaReto({ perfil, lunes }: { perfil: PerfilNutricion; lunes: string }) {
  const reto = retoDeLaSemana(lunes, perfil.retos)
  const [nombre, setNombre] = useState<string | null>(null)
  useEffect(() => {
    if (!reto) return
    void alimentosGenericos().then((l) => setNombre(l.find((a) => a.id === reto.alimentoId)?.nombre ?? null))
  }, [reto?.alimentoId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!perfil.retoActivo || !reto || !nombre) return null
  const marcar = (estado: EstadoReto) =>
    actualizarPerfil({ retos: [...perfil.retos.filter((r) => r.semana !== lunes), { alimentoId: reto.alimentoId, semana: lunes, estado }] })

  return (
    <Tarjeta>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Para probar esta semana, si te apetece</p>
      <p className="mt-1 text-lg font-bold">{nombre}</p>
      <p className="text-sm text-muted">{reto.como}</p>
      {reto.estado === 'propuesto' && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Boton onClick={() => marcar('probado')}>Lo he probado</Boton>
          <Boton onClick={() => actualizarPerfil({ retoActivo: false })} className="text-sm">
            Quitar retos
          </Boton>
        </div>
      )}
      {reto.estado === 'probado' && (
        <>
          <p className="mt-3 text-sm font-semibold">¿Qué tal?</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <Boton onClick={() => marcar('gusta')}>Me gusta</Boton>
            <Boton onClick={() => marcar('no_gusta')}>No me gusta</Boton>
          </div>
        </>
      )}
      {reto.estado === 'gusta' && <p className="mt-3 text-sm">Anotado: lo tendrás a mano al añadir comida.</p>}
      {reto.estado === 'no_gusta' && <p className="mt-3 text-sm">Anotado: no te lo volveremos a proponer.</p>}
    </Tarjeta>
  )
}
