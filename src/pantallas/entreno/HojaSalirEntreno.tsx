// Botón atrás del móvil en pleno entreno: antes salía sin decir nada (y el entreno seguía abierto abajo).
// Ahora pregunta: «Acabar» (al resumen para guardarlo; si no se hizo ninguna serie, se cierra sin guardar) o «Continuar».
import { db } from '../../datos/db'
import { cancelar, ID_AVISO } from '../../plataforma'
import { Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useSesionEnCurso } from '../../datos/hooks'
import { t } from '../../i18n'

export function HojaSalirEntreno() {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const unaVez = useUnaVez()
  if (s === undefined) return <Hoja titulo={t('Entreno')}><p className="muted">{t('Cargando…')}</p></Hoja>
  if (!s) return <Hoja titulo={t('Entreno')}><p className="muted">{t('No hay entreno en curso.')}</p></Hoja>

  const libre = s.letra === 'L'
  const hayAlgo = s.ejercicios.some(e => e.series.some(x => x.hecha))
  const acabar = unaVez(async () => {
    if (hayAlgo) { nav.hoja(null); nav.completa('ses-fin', { id: s.id }); return }
    // Nada hecho: no hay nada que guardar. Se cierra y se sale.
    await db.sesiones.delete(s.id!)
    void cancelar([ID_AVISO.descanso])
    nav.hoja(null)
    nav.completa(null)
    aviso(libre ? t('Entreno libre cerrado') : t('Entreno cerrado sin guardar: no habías hecho ninguna serie'))
  })

  return (
    <Hoja titulo={libre ? t('Estás en un entreno libre') : t('Estás entrenando')} sub={t('¿Quieres acabarlo?')}>
      <p className="muted">{hayAlgo ? t('Al acabar verás el resumen y se guarda lo que has hecho.') : t('Aún no has hecho ninguna serie: al acabar no se guarda nada.')}</p>
      <div className="btns mt16">
        <button className="btn gry" onClick={() => void acabar()}><Ico n="flag-checkered" b />{t('Acabar')}</button>
        <button className="btn" onClick={() => nav.hoja(null)}><Ico n="play" b />{t('Continuar')}</button>
      </div>
    </Hoja>
  )
}
