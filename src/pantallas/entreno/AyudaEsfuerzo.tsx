// Ayuda del esfuerzo en el entreno (AJU-01): qué significa cada número de «¿Cuánto te ha costado?».
// Se quita en Ajustes → Más ajustes → Entreno. En pantalla nunca se dice «RPE» sin explicarlo.
import { useState } from 'react'
import { HojaSuelta, Ico } from '../../ui/componentes'
import { t, tk } from '../../i18n'

/** Lo que significa cada número, en corto (también al mantener pulsado). */
export const AYUDA_RPE: Record<number, string> = { 6: tk('6 = te quedaban 4 reps'), 7: tk('7 = te quedaban 3 reps'), 8: tk('8 = te quedaban 2 reps'), 9: tk('9 = te quedaba 1 rep'), 10: tk('10 = no podías ni una más') }

/** Debajo de los números: qué significa el elegido (o cómo elegir) y «¿Qué es esto?» con la explicación entera. */
export function AyudaEsfuerzo({ rpe, ideal }: { rpe: number | null; ideal: number }) {
  const [abierta, setAbierta] = useState(false)
  const texto = AYUDA_RPE[rpe ?? -1]
  return (
    <>
      <p className="small muted mt8">
        {texto ? t(texto) : t('Piensa cuántas repeticiones más te quedaban.')}{' '}
        <button type="button" className="lnk" onClick={() => setAbierta(true)}><Ico n="question" />{t('¿Qué es esto?')}</button>
      </p>
      {abierta && (
        <HojaSuelta titulo={t('El esfuerzo')} sub={t('Lo que te ha costado la serie')} onCerrar={() => setAbierta(false)}>
          <p>{t('Al acabar la serie, piensa cuántas repeticiones más podrías haber hecho bien. Esa es la nota del esfuerzo (en los gimnasios lo llaman RPE).')}</p>
          <div className="spec-box mt12"><div className="spec">
            {[6, 7, 8, 9, 10].map(v => <p key={v}><b>{t(AYUDA_RPE[v]!)}</b></p>)}
          </div></div>
          <p className="small mt12">{t('Lo ideal en este ejercicio: un {n}.', { n: ideal })}</p>
          <p className="small muted mt4">{t('Es opcional: si no lo marcas, no pasa nada.')}</p>
          <button className="btn mt16" onClick={() => setAbierta(false)}>{t('Entendido')}</button>
        </HojaSuelta>
      )}
    </>
  )
}
