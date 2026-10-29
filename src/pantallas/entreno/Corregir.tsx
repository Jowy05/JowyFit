// Corregir una serie ya hecha (reps o peso mal apuntados con las prisas). Se usa en el entreno (tocando la serie
// en la lista de series) y en la hoja Lista (series de un ejercicio ya terminado).
import { useMemo, useState } from 'react'
import { corregirHecha } from '../../datos/acciones/entreno'
import type { EjercicioSesion, Sesion } from '../../datos/tipos'
import { ejercicio } from '../../catalogo/catalogo'
import { pesosPara } from '../../dominio/pesos'
import { cx, Ico, Stepper } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { useGimnasio } from '../../datos/hooks'
import { TOPE_SERIE } from '../../dominio/sesion'
import { t } from '../../i18n'

const conPesoReg = (e: EjercicioSesion) => e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'
export const etiquetaPeso = (e: EjercicioSesion) => (e.registro === 'asistido' ? t('Ayuda (kg)') : e.registro === 'mancuerna' ? t('Kg por mancuerna') : t('Peso (kg)'))
export const etiquetaReps = (e: EjercicioSesion) => (e.registro === 'cardio' ? t('¿Cuántos minutos?') : t('¿Cuántas has hecho?'))

/** El formulario: los mismos − y + del panel, con lo que se apuntó; «Cancelar» y «Guardar cambio». */
export function FormCorregir({ s, idx, k, className, onCerrar }: { s: Sesion; idx: number; k: number; className?: string; onCerrar: () => void }) {
  const aviso = useAviso()
  const g = useGimnasio()
  const e = s.ejercicios[idx]!
  const serie = e.series[k]!
  const ej = ejercicio(e.ejercicio)
  const lista = useMemo(() => (ej ? pesosPara(ej.material, e.registro, g) : []), [ej, e.registro, g])
  const conPeso = conPesoReg(e)
  const [peso, setPeso] = useState<number | null>(serie.peso)
  const [reps, setReps] = useState<number>(serie.reps ?? e.repsMin)
  const [seg, setSeg] = useState<number>(serie.segundos ?? serie.reps ?? e.repsMin)
  const [guardando, setGuardando] = useState(false)
  const num = e.series.filter(x => !x.calentamiento).indexOf(serie) + 1
  const guardar = async () => {
    if (guardando) return
    if (conPeso && peso == null) { aviso(t('Pon el peso con + o −')); return }
    setGuardando(true)
    try {
      await corregirHecha(s, idx, k, { peso: conPeso ? peso : null, reps: e.registro === 'tiempo' ? null : reps, segundos: e.registro === 'tiempo' ? seg : null })
      aviso(t('Serie corregida'))
      onCerrar()
    } finally { setGuardando(false) }
  }
  return (
    <div className={cx('ux-corr-f', className)}>
      <p className="ux-corr-t"><Ico n="pencil-simple" b />{serie.calentamiento || num < 1 ? t('Corregir el calentamiento') : t('Corregir la serie {n}', { n: num })}</p>
      <div className="pn-row">
        {e.registro === 'tiempo' ? (
          <div className="pn-f w"><span className="lbl ux-pn-lbl">{t('¿Cuántos segundos?')}</span><Stepper className="tall" valor={seg} paso={5} min={5} max={TOPE_SERIE.segundos} onCambio={setSeg} etiqueta={t('Segundos')} /></div>
        ) : <>
          {conPeso && <div className="pn-f w"><span className="lbl ux-pn-lbl">{etiquetaPeso(e)}</span><Stepper className="tall" valor={peso} lista={lista} paso={2.5} min={-TOPE_SERIE.peso} max={TOPE_SERIE.peso} onCambio={setPeso} etiqueta={t('Peso')} /></div>}
          <div className={cx('pn-f', !conPeso && 'w')}><span className="lbl ux-pn-lbl">{etiquetaReps(e)}</span><Stepper className="tall" valor={reps} paso={1} min={1} max={TOPE_SERIE.reps} onCambio={setReps} etiqueta={e.registro === 'cardio' ? t('Minutos') : t('Repeticiones')} /></div>
        </>}
      </div>
      <div className="pn-main">
        <button className="btn gry" onClick={onCerrar}>{t('Cancelar')}</button>
        <button className="btn xl" onClick={() => void guardar()}><Ico n="check" b />{t('Guardar cambio')}</button>
      </div>
    </div>
  )
}
