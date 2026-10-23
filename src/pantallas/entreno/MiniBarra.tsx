// SES-11 · Mini barra de entreno en curso
import { useEffect, useState } from 'react'
import type { Sesion } from '../../datos/tipos'
import { duracion } from '../../dominio/fechas'
import { Ico } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { t } from '../../i18n'

export function MiniBarra({ sesion }: { sesion: Sesion }) {
  const nav = useNav()
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => { const reloj = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(reloj) }, [])
  const resto = sesion.descansoHasta ? Math.max(0, Math.round((sesion.descansoHasta - ahora) / 1000)) : 0
  return (
    <button className="minibar" aria-label={t('Volver al entreno')} onClick={() => nav.abrirEntreno()}>
      <Ico n="barbell" b />
      <span>{t('Entrenando')} · <span className="mono">{duracion((ahora - sesion.inicio) / 1000)}</span>{resto > 0 && <> · {t('descanso')} <span className="mono">{duracion(resto)}</span></>}</span>
      <Ico n="caret-right" className="car" />
    </button>
  )
}
