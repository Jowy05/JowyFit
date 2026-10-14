// Corregir una serie ya hecha (reps o peso mal apuntados con las prisas). Se usa en el entreno (tocando la serie
// en la lista de series) y en la hoja Lista (series de un ejercicio ya terminado).
import { useMemo, useState } from 'react'
import { db } from '../../../datos/db'
import { historialDe } from '../../../datos/consultas'
import type { EjercicioSesion, Serie, Sesion } from '../../../datos/tipos'
import { ejercicio } from '../../../catalogo/catalogo'
import { pesosPara } from '../../../dominio/pesos'
import { corregirSerie } from '../../../dominio/sesion'
import { esRecord } from '../../../dominio/progresion'
import { kg } from '../../../dominio/calculos'
import { cx, Ico, Stepper } from '../../comp'
import { useAviso } from '../../aviso'
import { useGimnasio } from '../../datos'

type Datos = Pick<Serie, 'peso' | 'reps' | 'segundos'>

export const conPesoReg = (e: EjercicioSesion) => e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'
export const etiquetaPeso = (e: EjercicioSesion) => (e.registro === 'asistido' ? 'Ayuda (kg)' : e.registro === 'mancuerna' ? 'Kg por mancuerna' : 'Peso (kg)')
export const etiquetaReps = (e: EjercicioSesion) => (e.registro === 'cardio' ? '¿Cuántos minutos?' : '¿Cuántas has hecho?')

/** Lo apuntado en una serie hecha, en corto: «20 kg × 8», «8 reps», «30 s». */
export function valorSerie(x: Serie, e: EjercicioSesion): string {
  if (e.registro === 'tiempo') return `${x.segundos ?? x.reps} s`
  if (e.registro === 'cardio') return `${x.reps} min`
  if (e.registro === 'corporal' || x.peso == null) return `${x.reps} reps`
  return `${e.registro === 'asistido' ? `ayuda ${kg(Math.abs(x.peso))}` : kg(x.peso)} kg × ${x.reps}`
}

/** Guarda la corrección y vuelve a mirar si la serie es récord frente a lo anterior. */
export async function guardarCorreccion(s: Sesion, idx: number, k: number, d: Datos): Promise<void> {
  const e = s.ejercicios[idx]
  const x = e?.series[k]
  if (!e || !x || !x.hecha) return
  const hist = await historialDe(e.ejercicio, s.id)
  const previas = [...hist.flatMap(h => h.series), ...e.series.filter((y, j) => y.hecha && j < k)]
  const rec = !x.calentamiento ? esRecord({ ...x, ...d, hecha: true }, previas) : null
  await db.sesiones.put(corregirSerie(s, idx, k, { ...d, record: !!rec }))
}

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
    if (conPeso && peso == null) { aviso('Pon el peso con + o −'); return }
    setGuardando(true)
    try {
      await guardarCorreccion(s, idx, k, { peso: conPeso ? peso : null, reps: e.registro === 'tiempo' ? null : reps, segundos: e.registro === 'tiempo' ? seg : null })
      aviso('Serie corregida')
      onCerrar()
    } finally { setGuardando(false) }
  }
  return (
    <div className={cx('ux-corr-f', className)}>
      <p className="ux-corr-t"><Ico n="pencil-simple" b />Corregir {serie.calentamiento || num < 1 ? 'el calentamiento' : `la serie ${num}`}</p>
      <div className="pn-row">
        {e.registro === 'tiempo' ? (
          <div className="pn-f w"><span className="lbl ux-pn-lbl">¿Cuántos segundos?</span><Stepper className="tall" valor={seg} paso={5} min={5} onCambio={setSeg} etiqueta="Segundos" /></div>
        ) : <>
          {conPeso && <div className="pn-f w"><span className="lbl ux-pn-lbl">{etiquetaPeso(e)}</span><Stepper className="tall" valor={peso} lista={lista} paso={2.5} onCambio={setPeso} etiqueta="Peso" /></div>}
          <div className={cx('pn-f', !conPeso && 'w')}><span className="lbl ux-pn-lbl">{etiquetaReps(e)}</span><Stepper className="tall" valor={reps} paso={1} min={1} onCambio={setReps} etiqueta={e.registro === 'cardio' ? 'Minutos' : 'Repeticiones'} /></div>
        </>}
      </div>
      <div className="pn-main">
        <button className="btn gry" onClick={onCerrar}>Cancelar</button>
        <button className="btn xl" onClick={() => void guardar()}><Ico n="check" b />Guardar cambio</button>
      </div>
    </div>
  )
}
