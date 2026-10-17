// Botón atrás del móvil en pleno entreno: antes salía sin decir nada (y el entreno seguía abierto abajo).
// Ahora pregunta: «Acabar» (al resumen para guardarlo; si no se hizo ninguna serie, se cierra sin guardar) o «Continuar».
import { db } from '../../../datos/db'
import { cancelar } from '../../../plataforma'
import { Hoja, Ico, useUnaVez } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useSesionEnCurso } from '../../datos'

export function HojaSalirEntreno() {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const unaVez = useUnaVez()
  if (s === undefined) return <Hoja titulo="Entreno"><p className="muted">Cargando…</p></Hoja>
  if (!s) return <Hoja titulo="Entreno"><p className="muted">No hay entreno en curso.</p></Hoja>

  const libre = s.letra === 'L'
  const hayAlgo = s.ejercicios.some(e => e.series.some(x => x.hecha))
  const acabar = unaVez(async () => {
    if (hayAlgo) { nav.hoja(null); nav.completa('ses-fin', { id: s.id }); return }
    // Nada hecho: no hay nada que guardar. Se cierra y se sale.
    await db.sesiones.delete(s.id!)
    void cancelar([9001])
    nav.hoja(null)
    nav.completa(null)
    aviso(libre ? 'Entreno libre cerrado' : 'Entreno cerrado sin guardar: no habías hecho ninguna serie')
  })

  return (
    <Hoja titulo={libre ? 'Estás en un entreno libre' : 'Estás entrenando'} sub="¿Quieres acabarlo?">
      <p className="muted">{hayAlgo ? 'Al acabar verás el resumen y se guarda lo que has hecho.' : 'Aún no has hecho ninguna serie: al acabar no se guarda nada.'}</p>
      <div className="btns mt16">
        <button className="btn gry" onClick={() => void acabar()}><Ico n="flag-checkered" b />Acabar</button>
        <button className="btn" onClick={() => nav.hoja(null)}><Ico n="play" b />Continuar</button>
      </div>
    </Hoja>
  )
}
