// SES-02 · Panel de abajo del entreno: peso, reps y esfuerzo de la serie que toca, o el descanso (SES-03).
import { useEffect, useRef, useState } from 'react'
import { guardarSesion } from '../../datos/acciones/entreno'
import type { EjercicioSesion, Serie, Sesion } from '../../datos/tipos'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { indiceActual, saltar } from '../../dominio/sesion'
import { duracion } from '../../dominio/fechas'
import { kg, textoSerie } from '../../dominio/formato'
import { cx, estilo, Ico, Stepper } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { etiquetaPeso, etiquetaReps } from './Corregir'
import { t, tk } from '../../i18n'

const AYUDA_RPE: Record<number, string> = { 6: tk('6 = te quedaban 4 reps'), 7: tk('7 = te quedaban 3 reps'), 8: tk('8 = te quedaban 2 reps'), 9: tk('9 = te quedaba 1 rep'), 10: tk('10 = no podías ni una más') }

const conPesoDe = (e: EjercicioSesion) => e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'

type Datos = Pick<Serie, 'peso' | 'reps' | 'rpe' | 'segundos'>

export function Panel({ s, idx, e, serie, lista, ultimaHecha, onHecho, resto, total, onSaltar, onMas }: {
  s: Sesion; idx: number; e: EjercicioSesion; serie: Serie; lista: number[]; ultimaHecha?: Serie
  onHecho: (d: Datos) => Promise<void>
  resto: number; total: number; onSaltar: () => void; onMas: () => void
}) {
  const nav = useNav()
  const aviso = useAviso()
  const [peso, setPeso] = useState<number | null>(serie.peso)
  const [reps, setReps] = useState<number>(serie.reps ?? e.repsMin)
  const [seg, setSeg] = useState<number>(serie.segundos ?? e.repsMin)
  // El esfuerzo empieza vacío: solo se guarda si se marca.
  const [rpe, setRpe] = useState<number | null>(serie.calentamiento ? null : serie.rpe ?? null)
  const [crono, setCrono] = useState<number | null>(null)
  const [ahora, setAhora] = useState(Date.now())
  const pulsado = useRef<number | undefined>(undefined)
  // Un panel por serie: una vez enviado «Hecho», los toques siguientes (doble toque) no apuntan otra serie.
  const enviado = useRef(false)
  useEffect(() => { if (crono == null) return; const reloj = setInterval(() => setAhora(Date.now()), 250); return () => clearInterval(reloj) }, [crono])
  useEffect(() => () => clearTimeout(pulsado.current), [])
  const conPeso = conPesoDe(e)
  const datos = () => ({ peso: conPeso ? peso : null, reps: e.registro === 'tiempo' ? null : reps, segundos: e.registro === 'tiempo' ? seg : null, rpe: serie.calentamiento ? null : rpe })
  const enviar = (d: Datos) => {
    if (enviado.current) return
    enviado.current = true
    void onHecho(d).catch(() => { enviado.current = false })
  }
  // Sin peso (primera vez: «? kg») o sin reps, «Hecho» no guarda: la serie quedaría con peso vacío y el volumen en 0.
  // Los asistidos valen con 0 o negativo (solo falta si está vacío); los corporales no llevan peso.
  const [falta, setFalta] = useState<'peso' | 'reps' | null>(null)
  const comprobar = (d: Pick<Serie, 'peso' | 'reps' | 'segundos'>): boolean => {
    if (conPeso && d.peso == null) { setFalta('peso'); aviso(t('Pon el peso con + o −')); return false }
    if (e.registro === 'tiempo' ? !d.segundos || d.segundos <= 0 : d.reps == null || d.reps <= 0) {
      setFalta('reps'); aviso(e.registro === 'tiempo' ? t('Pon los segundos que has aguantado') : e.registro === 'cardio' ? t('Pon los minutos que has hecho') : t('Pon las repeticiones que has hecho'))
      return false
    }
    return true
  }

  if (resto > 0) return <Descanso s={s} e={e} serie={serie} resto={resto} total={total} onSaltar={onSaltar} onMas={onMas} />

  const segundosCrono = crono != null ? Math.round((ahora - crono) / 1000) : 0
  return (
    <div className="panel">
      {e.registro === 'tiempo' ? (
        <div className="pn-row">
          <div className={cx('pn-f w', falta === 'reps' && 'ux-falta')}><span className="lbl ux-pn-lbl">{falta === 'reps' ? t('Pon aquí los segundos') : t('¿Cuántos segundos?')}</span><Stepper className="tall" valor={crono != null ? segundosCrono : seg} paso={5} min={5} onCambio={v => { setSeg(v); setFalta(null) }} etiqueta={t('Segundos')} /></div>
          <div className="pn-f"><span className="lbl ux-pn-lbl">{t('Cronómetro')}</span>
            <button className={cx('btn', crono != null ? 'badf' : 'gry')} style={{ minHeight: 60 }} onClick={() => { if (crono == null) { setCrono(Date.now()); setAhora(Date.now()) } else { setSeg(segundosCrono); setCrono(null) } }}>
              <Ico n={crono != null ? 'pause' : 'play'} b />{crono != null ? t('Parar') : t('Empezar')}
            </button>
          </div>
        </div>
      ) : (
        <div className="pn-row">
          {conPeso && (
            <div className={cx('pn-f w', falta === 'peso' && 'ux-falta')}>
              <span className="lbl ux-pn-lbl">{falta === 'peso' ? t('Pon aquí los kg') : etiquetaPeso(e)}</span>
              <Stepper className="tall" valor={peso} lista={lista} paso={2.5} onCambio={v => { setPeso(v); setFalta(null) }} etiqueta={t('Peso')} />
            </div>
          )}
          <div className={cx('pn-f', !conPeso && 'w', falta === 'reps' && 'ux-falta')}>
            <span className="lbl ux-pn-lbl">{falta === 'reps' ? (e.registro === 'cardio' ? t('Pon los minutos') : t('Pon las que has hecho')) : etiquetaReps(e)}</span>
            <Stepper className="tall" valor={reps} paso={1} min={1} onCambio={v => { setReps(v); setFalta(null) }} etiqueta={e.registro === 'cardio' ? t('Minutos') : t('Repeticiones')} />
          </div>
        </div>
      )}
      {!serie.calentamiento && e.registro !== 'cardio' && (
        <div className="pn-eff">
          <span className="lbl ux-pn-lbl">{t('¿Cuánto te ha costado?')} <span className="hint">{t('· opcional · lo ideal: {n}', { n: e.rpe })}</span></span>
          <div className="effs">
            {[6, 7, 8, 9, 10].map(v => (
              <button key={v} className={cx('eff', rpe === v && 'on')} aria-pressed={rpe === v} onClick={() => setRpe(r => (r === v ? null : v))}
                onPointerDown={() => { pulsado.current = window.setTimeout(() => aviso(t(AYUDA_RPE[v]!)), 450) }}
                onPointerUp={() => clearTimeout(pulsado.current)} onPointerLeave={() => clearTimeout(pulsado.current)}>{v}</button>
            ))}
          </div>
          {/* «fácil» debajo del 6 y «no podía más» debajo del 10, en negro y legibles. */}
          <p className="ux-eff-esc" aria-hidden="true"><span>{t('fácil')}</span><span /><span /><span /><span className="fin">{t('no podía más')}</span></p>
        </div>
      )}
      {/* Nota, calentamiento y añadir o quitar series están en «Más», junto al nombre del ejercicio.
          «Igual que la anterior» solo cuando hay una anterior, y dice qué apunta. */}
      {ultimaHecha && (
        <div className="pn-tools">
          <button className="tb same" onClick={() => enviar({ peso: ultimaHecha.peso, reps: ultimaHecha.reps, segundos: ultimaHecha.segundos ?? null, rpe: serie.calentamiento ? null : ultimaHecha.rpe })}>
            <Ico n="copy" /><span>{t('Igual que la anterior')} <small className="ux-igual-d">{t('· apunta {valor}', { valor: textoSerie(ultimaHecha, e.registro, 'corto') })}</small></span>
          </button>
        </div>
      )}
      <div className="pn-main">
        <button className="btn gry busy" onClick={() => nav.hoja('sheet-ocup', { idx })}><Ico n="hand-palm" b />{t('Ocupado')}</button>
        <button className="btn xl" onClick={() => {
          const d = crono != null ? { ...datos(), segundos: segundosCrono } : datos()
          if (crono != null) { setSeg(segundosCrono); setCrono(null) }
          if (comprobar(d)) enviar(d)
        }}><Ico n="check" b />{t('Hecho')}</button>
      </div>
      {/* Saltar el ejercicio entero, a la vista. Se recupera desde la lista. */}
      <button className="lnk small ux-saltar-ej" onClick={async () => {
        const antes = s
        await guardarSesion(saltar(s, idx))
        aviso(t('Saltado: {ejercicio}. Lo recuperas desde la lista', { ejercicio: nombreEjercicio(e.ejercicio) }), () => void guardarSesion(antes))
      }}><Ico n="skip-forward" />{t('Saltar este ejercicio')}</button>
    </div>
  )
}

/** El descanso entre series: cuenta atrás, qué viene después, «Ocupado», +15 s y «Saltar». */
function Descanso({ s, e, serie, resto, total, onSaltar, onMas }: {
  s: Sesion; e: EjercicioSesion; serie: Serie; resto: number; total: number; onSaltar: () => void; onMas: () => void
}) {
  const nav = useNav()
  const proxima = s.ejercicios[indiceActual(s)]
  const numTrabajo = e.series.filter(x => !x.calentamiento).indexOf(serie) + 1
  return (
    <div className="panel">
      <div className="rest flex" style={{ display: 'flex', position: 'relative', inset: 'auto', animation: 'none', padding: 0 }}>
        <div className="rest-top">
          <div className={cx('ring', resto <= 0 && 'ended')} style={estilo({ '--pct': `${Math.max(0, Math.min(100, (resto / Math.max(1, total)) * 100))}%` })}>
            <div><span className="lbl">{t('Descanso')}</span><b className="mono">{duracion(resto)}</b><small className="muted">{t('de {total}', { total: duracion(total) })}</small></div>
          </div>
          <div className="rest-r">
            <p className="lbl">{t('Próxima')}</p>
            <p className="rest-n">{proxima && proxima.uid !== e.uid ? nombreEjercicio(proxima.ejercicio) : serie.calentamiento ? t('Calentamiento') : t('Serie {n}', { n: numTrabajo })}</p>
            <p className="mono rest-w">{conPesoDe(e) && serie.peso != null ? `${kg(e.registro === 'asistido' ? Math.abs(serie.peso) : serie.peso)} kg × ${e.repsMin}-${e.repsMax}` : e.registro === 'tiempo' ? `${e.repsMin}-${e.repsMax} s` : t('{n} reps', { n: `${e.repsMin}-${e.repsMax}` })}</p>
            <p className="small muted mt8">{t('¿Te has equivocado? Toca la serie en la lista para corregirla.')}</p>
          </div>
        </div>
        <div className="rest-btns mt12">
          <button className="btn gry busy big56" onClick={() => nav.hoja('sheet-ocup', { idx: indiceActual(s) })}><Ico n="hand-palm" b />{t('Ocupado')}</button>
          <button className="btn gry big56" onClick={onMas}>+15 s</button>
          <button className="btn big56" onClick={onSaltar}><Ico n="skip-forward" b />{t('Saltar')}</button>
        </div>
      </div>
    </div>
  )
}
