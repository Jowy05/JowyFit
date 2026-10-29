// «Me encuentro mal» durante el entreno: las mismas señales de «Antes de entrenar». Con alguna, el entreno se para
// (se guarda lo hecho) y sale «Hoy no entrenes»; no hay rutina hasta que se desmarque en Perfil → Salud.
import { useState } from 'react'
import { guardarPerfil } from '../../datos/repos'
import { descartarEntreno, terminarEntreno } from '../../datos/acciones/entreno'
import type { Urgencia } from '../../datos/tipos'
import { Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useSesionEnCurso } from '../../datos/hooks'
import { BloqueoUrgencia, Urgencias } from '../perfil/SaludDolor'
import { t } from '../../i18n'

export function HojaMeEncuentroMal() {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const unaVez = useUnaVez()
  const [marcadas, setMarcadas] = useState<Urgencia[]>([])
  const parar = unaVez(async () => {
    await guardarPerfil({ urgencias: marcadas })
    const guardado = !!s?.ejercicios.some(e => e.series.some(x => x.hecha))
    if (s && guardado) await terminarEntreno(s, Date.now(), { ...s.respuestas, nota: t('Parado: me encontraba mal') })
    else if (s) await descartarEntreno(s.id)
    nav.completa(null)
    nav.hoja('hoja-urgencia', { guardado })
  })
  const seguir = () => {
    nav.hoja(null)
    aviso(t('Vale. Si no se te pasa, para y descansa'))
  }
  return (
    <Hoja titulo={t('¿Te pasa algo de esto?')} sub={t('Ahora, o al hacer esfuerzo.')} className="tall">
      <Urgencias valor={marcadas} onCambio={setMarcadas} />
      {marcadas.length
        ? <button className="btn badf mt16" onClick={() => void parar()}><Ico n="hand-palm" b />{t('Parar el entreno')}</button>
        : <button className="btn mt16" onClick={seguir}>{t('No, ninguna')}</button>}
    </Hoja>
  )
}

/** «Hoy no entrenes», tras parar el entreno. «Me he equivocado» quita las señales (lo hecho, si había, ya se guardó). */
export function HojaUrgencia({ ruta }: { ruta: Ruta<'hoja-urgencia'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const equivocado = async () => {
    await guardarPerfil({ urgencias: [] })
    nav.hoja(null)
    aviso(ruta.d.guardado ? t('Desmarcado. Lo que hiciste está guardado') : t('Desmarcado'))
  }
  return (
    <Hoja cerrar={false} className="tall" etiqueta={t('Hoy no entrenes')}>
      <BloqueoUrgencia onEquivocado={() => void equivocado()} onVale={() => nav.hoja(null)} />
    </Hoja>
  )
}
