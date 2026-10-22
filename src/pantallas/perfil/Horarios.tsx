// Horario de entreno: el sencillo del alta (HorariosAlta) y el completo de Perfil → Horario (Horarios).
import type { Dia, Perfil } from '../../datos/tipos'
import { perfilPorDefecto } from '../../datos/repos'
import { DIAS, DIAS_ABREV, DIAS_CORTOS, formatoHora, minutosDe } from '../../dominio/fechas'
import { capital } from '../../dominio/formato'
import { cx, FilaInterruptor, Ico, Stepper } from '../../ui/componentes'
import { t, tc, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Props = { p: Perfil; cambia: (c: Partial<Perfil>) => void }

/** «Lun», «Dl», «Mon» (sin el punto del catalán: en un botón pequeño sobra). */
const diaTres = (d: number) => capital(DIAS_ABREV[d]!).replace(/\.$/, '')

// Horas del desplegable del alta, cada media hora, agrupadas por parte del día. Los nombres llevan contexto:
// «Mañana» y «Tarde» también son tiempo («mañana», «llegas tarde»).
const PARTES_DEL_DIA: { nombre: () => string; desde: number; hasta: number }[] = [
  { nombre: () => tc('parte del día', 'Mañana'), desde: 5, hasta: 12 },
  { nombre: () => tc('parte del día', 'Mediodía'), desde: 12, hasta: 16 },
  { nombre: () => tc('parte del día', 'Tarde'), desde: 16, hasta: 20 },
  { nombre: () => tc('parte del día', 'Noche'), desde: 20, hasta: 23 },
]
const horasDe = (desde: number, hasta: number) => Array.from({ length: (hasta - desde) * 2 }, (_, i) => `${String(desde + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** Hora a la que irse del gimnasio: la de entrenar + los minutos + 15 de margen. */
function limites(hora: string, minutos: number): Perfil['horaLimite'] {
  const m = (minutosDe(hora) + minutos + 15) % 1440
  const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return { coche: hhmm, andando: hhmm }
}

/**
 * Horario sencillo del alta: días (un toque = entrenas o no), un día extra opcional aparte,
 * la hora y los minutos. Días y hora empiezan sin marcar y hay que elegirlos; el día extra empieza en «Ninguno».
 * Coche/andando, hora de salida, hora de acostarse y «si pierdes una sesión»
 * se quedan con su valor por defecto y se cambian en Perfil → Horario (`Horarios`, abajo).
 */
export function HorariosAlta({ p, cambia, faltaDias, faltaHora }: Props & { faltaDias: boolean; faltaHora: boolean }) {
  const conmutar = (d: Dia) => {
    if (p.diasFijos.includes(d)) cambia({ diasFijos: p.diasFijos.filter(x => x !== d) })
    else cambia({ diasFijos: [...p.diasFijos, d].sort((a, b) => a - b), diasOpcionales: p.diasOpcionales.filter(x => x !== d) })
  }
  const extra = p.diasOpcionales.find(d => !p.diasFijos.includes(d)) ?? null
  const libres = ([0, 1, 2, 3, 4, 5, 6] as Dia[]).filter(d => !p.diasFijos.includes(d))
  const n = p.diasFijos.length
  // Una copia importada puede traer una hora que no está en la lista (7:15): se añade para que se vea.
  const enLaLista = PARTES_DEL_DIA.some(x => horasDe(x.desde, x.hasta).includes(p.horaEntreno))
  // La hora de irse del gimnasio (para la versión corta) se recalcula con la hora y los minutos elegidos.
  const ponHora = (h: string) => { if (h) cambia({ horaEntreno: h, horaLimite: limites(h, p.minutosNormal) }) }
  const ponMinutos = (v: number) => cambia({ minutosNormal: v, minutosCorta: Math.min(perfilPorDefecto().minutosCorta, v - 5), ...(p.horaEntreno ? { horaLimite: limites(p.horaEntreno, v) } : {}) })
  return (
    <>
      <div className={cx(faltaDias && 'alta-falta')}>
        <p className="lbl fl mt16">{t('¿Qué días vas a entrenar?')}</p>
        <div className="days alta-dias">
          {DIAS.map((nombre, i) => (
            <button key={i} className={cx('chip day', p.diasFijos.includes(i as Dia) && 'fix on')} aria-pressed={p.diasFijos.includes(i as Dia)} aria-label={nombre} onClick={() => conmutar(i as Dia)}>{diaTres(i)}</button>
          ))}
        </div>
        <p className="small muted mt8">{n === 0 ? t('Toca los días que vas a ir. Con 3 días a la semana va muy bien.')
          : n === 3 ? t('Toca un día para marcarlo o quitarlo · {n} días a la semana (va muy bien)', { n })
            : tn(n, 'Toca un día para marcarlo o quitarlo · 1 día a la semana', 'Toca un día para marcarlo o quitarlo · {n} días a la semana')}</p>
      </div>
      {/* El día extra solo aparece con algún día elegido: dos filas de días iguales desde el principio confunden. */}
      {n > 0 && (
        <>
          <p className="lbl fl mt20">{t('Día extra si puedes')} <span className="hint">{t('(opcional)')}</span></p>
          <div className="chips">
            <button className={cx('chip', extra == null && 'on')} aria-pressed={extra == null} onClick={() => cambia({ diasOpcionales: [] })}>{t('Ninguno')}</button>
            {libres.map(d => <button key={d} className={cx('chip', extra === d && 'on')} aria-pressed={extra === d} aria-label={t('Extra el {dia}', { dia: DIAS[d] })} onClick={() => cambia({ diasOpcionales: [d] })}>{diaTres(d)}</button>)}
          </div>
          <p className="small muted mt4">{t('Una sesión corta de brazos y hombros, solo si te apetece.')}</p>
        </>
      )}
      <div className={cx('alta-hora', faltaHora && 'alta-falta')}>
        <p className="lbl fl mt16">{t('¿A qué hora entrenas?')}</p>
        <select className="inp" aria-label={t('Hora de entreno')} data-vacio={p.horaEntreno ? undefined : ''} value={p.horaEntreno} onChange={e => ponHora(e.target.value)}>
          <option value="" disabled>{t('Elige la hora')}</option>
          {!enLaLista && p.horaEntreno && <option value={p.horaEntreno}>{formatoHora(p.horaEntreno)}</option>}
          {PARTES_DEL_DIA.map(x => (
            <optgroup key={x.desde} label={x.nombre()}>{horasDe(x.desde, x.hasta).map(h => <option key={h} value={h}>{formatoHora(h)}</option>)}</optgroup>
          ))}
        </select>
      </div>
      <p className="lbl fl mt16">{t('¿Cuánto tiempo tienes cada día?')}</p>
      <Stepper valor={p.minutosNormal} paso={5} min={30} max={120} sufijo="min" etiqueta={t('Minutos por sesión')} onCambio={ponMinutos} />
      <p className="small muted mt4">{t('Si un día vas con prisa, la app te ofrece una versión más corta.')}</p>
      <p className="note plain mt16"><Ico n="gear" /><span>{tr('Coche o andando, hora de salir y hora de acostarte: en <b>Perfil → Horario</b>.', { b: x => <b>{x}</b> })}</span></p>
    </>
  )
}

/** Horario completo (Perfil → Horario). */
export function Horarios({ p, cambia }: Props) {
  const ciclo = (d: Dia) => {
    if (p.diasFijos.includes(d)) cambia({ diasFijos: p.diasFijos.filter(x => x !== d), diasOpcionales: [...p.diasOpcionales, d].sort() })
    else if (p.diasOpcionales.includes(d)) cambia({ diasOpcionales: p.diasOpcionales.filter(x => x !== d) })
    else cambia({ diasFijos: [...p.diasFijos, d].sort() })
  }
  const horas = ['05:00', '05:30', '06:00', '07:00', '18:00', '19:00']
  return (
    <>
      <div className="days mt16">
        {DIAS_CORTOS.map((d, i) => (
          <button key={i} className={cx('chip day', p.diasFijos.includes(i as Dia) && 'fix on', p.diasOpcionales.includes(i as Dia) && 'opt on')} onClick={() => ciclo(i as Dia)}>{d}</button>
        ))}
      </div>
      <p className="legend mt8"><span><i className="lg fix" />{t('Fijo')}</span><span><i className="lg opt" />{t('Opcional')}</span><span><i className="lg" />{t('Libre')}</span></p>
      <p className="lbl fl mt16">{t('¿A qué hora entrenas?')}</p>
      <div className="chips">
        {horas.map(h => <button key={h} className={cx('chip', p.horaEntreno === h && 'on')} onClick={() => cambia({ horaEntreno: h })}>{h.replace(/^0/, '')}</button>)}
        {/* Al borrar un campo de hora llega '': solo se guarda una hora válida (si no, sale «NaN:undefined»). */}
        <input className="inp" type="time" value={p.horaEntreno} onChange={e => { if (e.target.value) cambia({ horaEntreno: e.target.value }) }} style={{ width: 120, minHeight: 40 }} aria-label={t('Otra hora')} />
      </div>
      <p className="lbl fl mt16">{t('¿Cómo vas al gimnasio?')}</p>
      <div className="chips eq">
        <button className={cx('chip big', p.transporte === 'coche' && 'on')} onClick={() => cambia({ transporte: 'coche' })}><Ico n="car" />{t('Coche')}</button>
        <button className={cx('chip big', p.transporte === 'andando' && 'on')} onClick={() => cambia({ transporte: 'andando' })}><Ico n="person-simple-walk" />{t('Andando')}</button>
      </div>
      <div className="grid2 mt16">
        <label><span className="lbl fl">{t('Me voy (coche)')}</span><input className="inp" type="time" value={p.horaLimite.coche} onChange={e => { if (e.target.value) cambia({ horaLimite: { ...p.horaLimite, coche: e.target.value } }) }} /></label>
        <label><span className="lbl fl">{t('Me voy (andando)')}</span><input className="inp" type="time" value={p.horaLimite.andando} onChange={e => { if (e.target.value) cambia({ horaLimite: { ...p.horaLimite, andando: e.target.value } }) }} /></label>
      </div>
      <p className="lbl fl mt16">{t('Tiempo por sesión')}</p>
      <div className="grid2">
        <div><span className="lbl fl">{t('Normal')}</span><Stepper className="sm" valor={p.minutosNormal} paso={5} min={30} max={120} sufijo="min" onCambio={v => cambia({ minutosNormal: v, minutosCorta: Math.min(p.minutosCorta, v - 5) })} /></div>
        <div><span className="lbl fl">{t('Corto')}</span><Stepper className="sm" valor={p.minutosCorta} paso={5} min={20} max={p.minutosNormal - 5} sufijo="min" onCambio={v => cambia({ minutosCorta: v })} /></div>
      </div>
      <div className="list mt16">
        <div className="it">
          <span className="ico"><Ico n="moon" /></span>
          <span className="tx"><b>{t('Hora de acostarte')}</b><small>{t('Para avisarte 1 h antes')}</small></span>
          <input className="inp" type="time" value={p.horaDormir} onChange={e => { if (e.target.value) cambia({ horaDormir: e.target.value }) }} style={{ width: 110 }} aria-label={t('Hora de acostarte')} />
        </div>
        <FilaInterruptor ico="calendar-x" titulo={t('Si pierdes una sesión')} d={p.sesionPerdida === 'sabado' ? t('Te propongo pasarla al día opcional') : t('Se salta sin más')}
          on={p.sesionPerdida === 'sabado'} onCambio={v => cambia({ sesionPerdida: v ? 'sabado' : 'saltar' })} etiqueta={t('Recolocar sesión perdida')} />
      </div>
    </>
  )
}
