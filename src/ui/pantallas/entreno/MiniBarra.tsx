// SES-11 · Mini barra de entreno en curso
import { useEffect, useState } from 'react'
import type { Sesion } from '../../../datos/tipos'
import { duracion } from '../../../dominio/fechas'
import { Ico } from '../../comp'
import { useNav } from '../../nav'

export function MiniBarra({ sesion }: { sesion: Sesion }) {
  const nav = useNav()
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const resto = sesion.descansoHasta ? Math.max(0, Math.round((sesion.descansoHasta - ahora) / 1000)) : 0
  return (
    <button className="minibar" aria-label="Volver al entreno" onClick={() => (nav.estado.minimizada ? nav.restaurar() : nav.completa('entreno'))}>
      <Ico n="barbell" b />
      <span>Entrenando · <span className="mono">{duracion((ahora - sesion.inicio) / 1000)}</span>{resto > 0 && <> · descanso <span className="mono">{duracion(resto)}</span></>}</span>
      <Ico n="caret-right" className="car" />
    </button>
  )
}
