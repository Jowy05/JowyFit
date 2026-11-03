// Corregir una serie ya hecha (reps o peso mal apuntados con las prisas). Se usa en el entreno (tocando la serie
// en la lista de series) y en la hoja Lista (series de un ejercicio ya terminado).
import { useMemo, useState } from 'react'
import { corregirHecha } from '../../datos/acciones/entreno'
import type { Sesion } from '../../datos/tipos'
import { ejercicio } from '../../catalogo/catalogo'
import { pesosPara } from '../../dominio/pesos'
import { cx, Ico, Stepper } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { useGimnasio } from '../../datos/hooks'
import { datosDeCampos, TOPE_SERIE, type CamposSerie as Campos } from '../../dominio/sesion'
import { CamposSerie, camposDe, comoSeApunta } from './CamposSerie'
import { t } from '../../i18n'

/** El formulario: los mismos − y + del panel, con lo que se apuntó; «Cancelar» y «Guardar cambio». */
export function FormCorregir({ s, idx, k, className, onCerrar }: { s: Sesion; idx: number; k: number; className?: string; onCerrar: () => void }) {
  const aviso = useAviso()
  const g = useGimnasio()
  const e = s.ejercicios[idx]!
  const serie = e.series[k]!
  const ej = ejercicio(e.ejercicio)
  const lista = useMemo(() => (ej ? pesosPara(ej.material, e.registro, g) : []), [ej, e.registro, g])
  const como = comoSeApunta(e, ej)
  const [v, setV] = useState<Campos>(() => camposDe(serie, e))
  const cambiar = (c: Partial<Campos>) => setV(x => ({ ...x, ...c }))
  const [guardando, setGuardando] = useState(false)
  const num = e.series.filter(x => !x.calentamiento).indexOf(serie) + 1
  const guardar = async () => {
    if (guardando) return
    if (como.conPeso && v.peso == null) { aviso(t('Pon el peso con + o −')); return }
    setGuardando(true)
    try {
      await corregirHecha(s, idx, k, datosDeCampos(v, como))
      aviso(t('Serie corregida'))
      onCerrar()
    } finally { setGuardando(false) }
  }
  return (
    <div className={cx('ux-corr-f', className)}>
      <p className="ux-corr-t"><Ico n="pencil-simple" b />{serie.calentamiento || num < 1 ? t('Corregir el calentamiento') : t('Corregir la serie {n}', { n: num })}</p>
      {e.registro === 'tiempo' ? (
        <div className="pn-row">
          <div className="pn-f w"><span className="lbl ux-pn-lbl">{t('¿Cuántos segundos?')}</span><Stepper className="tall" valor={v.segundos} paso={5} min={5} max={TOPE_SERIE.segundos} onCambio={segundos => cambiar({ segundos })} etiqueta={t('Segundos')} /></div>
        </div>
      ) : <CamposSerie e={e} como={como} lista={lista} v={v} cambiar={cambiar} />}
      <div className="pn-main">
        <button className="btn gry" onClick={onCerrar}>{t('Cancelar')}</button>
        <button className="btn xl" onClick={() => void guardar()}><Ico n="check" b />{t('Guardar cambio')}</button>
      </div>
    </div>
  )
}
