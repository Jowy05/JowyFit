// Secciones nuevas del perfil (generador v2): pasos y cardio, calorías al día, sueño, deportes y experiencia previa,
// y la tarjeta «Completa tu ficha». Todo opcional: cada opción dice qué cambia en la rutina.
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { mediaPasos, objetivosEnergia } from '../../datos/consultas'
import { guardarAjustes } from '../../datos/repos'
import type { Dia, Perfil, TipoCardio } from '../../datos/tipos'
import { CARDIO_INICIO, CARDIO_RECOMENDADO, cardioSinImpacto, metaPasosEdad, pasosDePartida, TIPOS_CARDIO } from '../../dominio/cardio'
import { NOMBRE_OBJETIVO } from '../../dominio/objetivos'
import { DIAS_CORTOS, edad, hoyISO, lunesDe } from '../../dominio/fechas'
import { capital, num } from '../../dominio/formato'
import { Chip, cx, Elegir, Ico, Stepper } from '../../ui/componentes'
import { useNav, type ClaveSeccion } from '../../app/nav'
import { useAjustes } from '../../datos/hooks'
import { t, tk } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Props = { p: Perfil; guardar: (c: Partial<Perfil>) => void }

// PER · Pasos y cardio (6a)
export function Movimiento({ p, guardar }: Props) {
  const anos = edad(p.nacimiento)
  const [bajo, alto] = metaPasosEdad(anos)
  const media = useLiveQuery(() => mediaPasos(14), [])
  const peso = useLiveQuery(async () => (await objetivosEnergia(p)).peso, [p])
  const sinImpacto = cardioSinImpacto(p, peso ?? null)
  const tipos = p.cardioTipos ?? ['caminar']
  const cardio = p.cardioMin ?? CARDIO_INICIO
  // La primera vez que se toca algo, empieza a contar la subida poco a poco.
  const cambia = (c: Partial<Perfil>) => guardar({ ...c, progresoMovimiento: p.progresoMovimiento ?? lunesDe(hoyISO()) })
  const alternar = (v: TipoCardio) => cambia({ cardioTipos: tipos.includes(v) ? tipos.filter(x => x !== v) : [...tipos, v] })
  return (
    <>
      <p className="small muted mt8">{t('Moverte fuera de las pesas. Sube poco a poco.')}</p>
      <div className="card pd mt12">
        <span className="lbl">{t('Pasos al día')}</span>
        <div className="mt8"><Stepper valor={p.pasosObjetivo} paso={500} min={2000} max={20_000} decimales={0} sufijo={t('pasos')} etiqueta={t('Pasos al día')} onCambio={v => cambia({ pasosObjetivo: v })} /></div>
        <p className="small muted mt8">{t('A tu edad, lo bueno es {bajo}-{alto}.', { bajo: num(bajo, 0), alto: num(alto, 0) })} {media ? t('Empiezas cerca de lo que ya haces (unos {n}) y sube 1.000 cada 2 semanas.', { n: num(Math.round(media / 100) * 100, 0) }) : t('Sube 1.000 cada 2 semanas.')}</p>
        {media != null && p.pasosObjetivo !== pasosDePartida(media, anos) && <button className="lnk mt4" onClick={() => cambia({ pasosObjetivo: pasosDePartida(media, anos) })}>{t('Empezar por {n}', { n: num(pasosDePartida(media, anos), 0) })}</button>}
      </div>
      <div className="card pd mt12">
        <span className="lbl">{t('Cardio a la semana')}</span>
        <div className="mt8"><Stepper valor={cardio} paso={15} min={0} max={600} decimales={0} sufijo="min" etiqueta={t('Cardio a la semana')} onCambio={v => cambia({ cardioMin: v })} /></div>
        <p className="small muted mt8">{t('Lo recomendado son {n} min. Subimos 15 minutos cada 2 semanas si no te molesta nada.', { n: CARDIO_RECOMENDADO })}</p>
      </div>
      <div className="sec">
        <div className="sec-h"><h2>{t('¿Qué cardio te va?')}</h2></div>
        <div className="chips">{TIPOS_CARDIO.map(c => <Chip key={c.v} ck on={tipos.includes(c.v)} onClick={() => alternar(c.v)}><Ico n={c.ico} />{t(c.t)}</Chip>)}</div>
        {sinImpacto && tipos.includes('correr') && <p className="note warn mt8"><Ico n="warning" /><span>{tr('Por tu rodilla, mejor <b>sin correr ni saltos</b>. Si lo dejas, alternaremos 1 minuto corriendo y 2 andando.', { b: x => <b>{x}</b> })}</span></p>}
      </div>
      <div className="sec">
        <div className="sec-h"><h2>{t('¿Cuándo?')}</h2></div>
        <Elegir eq opciones={[{ v: 'despues', t: t('Al acabar las pesas') }, { v: 'otro', t: t('Otro día') }]} valor={p.cardioCuando ?? 'despues'} onCambio={v => cambia({ cardioCuando: v })} />
        <p className="small muted mt8">{t('Primero pesas y luego cardio: así la fuerza no se resiente.')}</p>
      </div>
    </>
  )
}

// PER · Calorías al día (7a). Ningún consejo de qué comer: solo el número, cómo sale y cambiarlo.
export function Calorias({ p }: Props) {
  const a = useAjustes()
  const e = useLiveQuery(() => objetivosEnergia(p), [p, a.kcalManual])
  if (!e) return <div className="cargando">{t('Cargando…')}</div>
  const objetivo = t(NOMBRE_OBJETIVO[p.objetivo]).toLowerCase()
  const fila = (nombre: ReactNode, valor: number, signo = true) => <p><span>{nombre}</span><b className="mono">{signo && valor > 0 ? '+' : ''}{num(valor, 0)}</b></p>
  return (
    <>
      <div className="card pd mt12 g2-kc">
        <span className="tag">{e.manual ? t('Lo has puesto tú') : t('Recomendado para ti')}</span>
        <p className="k mono">{num(e.kcal, 0)}<small> kcal</small></p>
        <p className="how">{e.ajuste
          ? tr('Gastas unas {gasto} al día por tu edad, tu peso y lo que te mueves; {ajuste} para {objetivo}.', { gasto: <b>{num(e.gasto, 0)}</b>, ajuste: <b>{e.ajuste > 0 ? '+' : '−'}{num(Math.abs(e.ajuste), 0)}</b>, objetivo })
          : tr('Gastas unas {gasto} al día por tu edad, tu peso y lo que te mueves.', { gasto: <b>{num(e.gasto, 0)}</b> })}</p>
      </div>
      <details className="fold mt12">
        <summary><Ico n="calculator" className="blue" />{t('Cómo se calcula')}<Ico n="caret-down" /></summary>
        <div className="in"><div className="spec">
          {fila(<>{t('En reposo')} <small className="muted">{t('(edad, peso, altura)')}</small></>, e.desglose.basal, false)}
          {fila(<>{t('Tu día a día')} <small className="muted">({p.trabajo === 'sentado' ? t('sentado') : p.trabajo === 'depie' ? t('de pie') : t('físico')})</small></>, e.desglose.diaADia)}
          {e.desglose.pasos > 0 && fila(<>{t('Pasos')} <small className="muted">({num(p.pasosObjetivo, 0)})</small></>, e.desglose.pasos)}
          {fila(<>{t('Entreno')} <small className="muted">({t('{n} a la semana', { n: p.diasFijos.length })})</small></>, e.desglose.entreno)}
          {fila(<b>{t('Lo que gastas')}</b>, e.gasto, false)}
          {e.ajuste !== 0 && fila(capital(objetivo), e.ajuste)}
        </div>
        <p className="small muted mt8">{t('Nunca te proponemos menos de lo que gastas en reposo.')}</p></div>
      </details>
      <div className="sec">
        <div className="sec-h"><h2>{t('¿Lo quieres cambiar?')}</h2></div>
        <Stepper valor={e.kcal} paso={50} min={Math.ceil(e.basal / 50) * 50} max={6000} decimales={0} sufijo="kcal" etiqueta={t('Calorías al día')} onCambio={v => void guardarAjustes({ kcalManual: v })} />
        {e.manual && <button className="btn ln sm mt12" onClick={() => void guardarAjustes({ kcalManual: null })}>{t('Volver al recomendado')} ({num(e.recomendado, 0)})</button>}
      </div>
      <p className="note plain mt16"><Ico n="info" /><span>{t('Es un número orientativo. JowyFit no te dice qué comer.')}</span></p>
    </>
  )
}

const SUENO = [{ v: 'poco', t: tk('Menos de 6') }, { v: 'normal', t: tk('6 o 7') }, { v: 'mucho', t: tk('8 o más') }] as const

// PER · Sueño (8b)
export function Sueno({ p, guardar }: Props) {
  return (
    <>
      <p className="lbl fl mt16">{t('¿Cuántas horas duermes normalmente?')}</p>
      <Elegir eq opciones={SUENO.map(x => ({ v: x.v, t: t(x.t) }))} valor={p.sueno ?? ([] as NonNullable<Perfil['sueno']>[])} onCambio={v => guardar({ sueno: v })} />
      <p className="small muted mt8">{tr('Si duermes poco varias noches, esa semana la rutina sale <b>más suave</b>.', { b: x => <b>{x}</b> })}</p>
    </>
  )
}

const DEPORTES = [tk('Fútbol'), tk('Pádel'), tk('Correr'), tk('Ciclismo'), tk('Natación'), tk('Baloncesto'), tk('Otro')]

// PER · Deportes (8a)
export function Deportes({ p, guardar }: Props) {
  const lista = p.deportes ?? []
  return (
    <>
      <p className="lbl fl mt16">{t('¿Haces algún deporte?')}</p>
      <div className="chips">{DEPORTES.map(d => <Chip key={d} ck on={lista.includes(d)} onClick={() => guardar({ deportes: lista.includes(d) ? lista.filter(x => x !== d) : [...lista, d] })}>{t(d)}</Chip>)}</div>
      {lista.length > 0 && (
        <>
          <p className="lbl fl mt16">{t('¿Qué día es tu partido o tu salida fuerte?')}</p>
          <div className="chips">
            {DIAS_CORTOS.map((d, i) => <Chip key={i} on={p.diaDeporte === i} onClick={() => guardar({ diaDeporte: p.diaDeporte === i ? null : (i as Dia) })}>{d}</Chip>)}
          </div>
          <p className="small muted mt8">{t('Para no cargar las piernas el día antes de tu partido.')}</p>
        </>
      )}
      {!p.deportes && <button className="btn ln sm mt12" onClick={() => guardar({ deportes: [] })}>{t('No hago ninguno')}</button>}
    </>
  )
}

const EXPERIENCIA = [{ v: 'nunca', t: tk('Nunca he entrenado') }, { v: 'hace-anos', t: tk('Hace años') }, { v: 'hace-meses', t: tk('Hace unos meses') }, { v: 'ahora', t: tk('Entreno ahora') }] as const

/** ¿Has entrenado antes y cuándo? (dentro de «Tu nivel»). */
export function ExperienciaPrevia({ p, guardar }: Props) {
  return (
    <div className="sec">
      <div className="sec-h"><h2>{t('¿Has entrenado antes?')}</h2><span className="lbl">{t('opcional')}</span></div>
      <div className="opts">
        {EXPERIENCIA.map(x => (
          <button key={x.v} className={cx('opt-c', p.experienciaPrevia === x.v && 'on')} aria-pressed={p.experienciaPrevia === x.v} onClick={() => guardar({ experienciaPrevia: x.v })}>
            <span className="rad" /><span className="tx"><b>{t(x.t)}</b></span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Las 7 cosas de «Completa tu ficha» y si ya están contestadas. */
export function fichaCompleta(p: Perfil): { s: ClaveSeccion; t: string; hecha: boolean }[] {
  return [
    { s: 'objetivos', t: tk('Objetivo'), hecha: true },
    { s: 'salud', t: tk('Salud y molestias'), hecha: p.dolores !== undefined || p.condicionesSalud !== undefined },
    { s: 'movimiento', t: tk('Pasos y cardio'), hecha: p.cardioMin !== undefined },
    { s: 'sueno', t: tk('Sueño'), hecha: p.sueno !== undefined },
    { s: 'vida', t: tk('Trabajo'), hecha: true },
    { s: 'deportes', t: tk('Deportes que haces'), hecha: p.deportes !== undefined },
    { s: 'experiencia', t: tk('Experiencia'), hecha: p.experienciaPrevia !== undefined },
  ]
}

/** «Completa tu ficha · 3 de 7»: solo mientras falte algo. */
export function CompletaFicha({ p }: { p: Perfil }) {
  const nav = useNav()
  const items = fichaCompleta(p)
  const hechas = items.filter(x => x.hecha).length
  if (hechas === items.length) return null
  const siguiente = items.find(x => !x.hecha)!
  return (
    <button className="card g2-fill mt12" onClick={() => nav.ir('seccion-perfil', { s: siguiente.s })}>
      <span className="row jb"><b>{t('Completa tu ficha')}</b><b className="mono">{t('{n} de {total}', { n: hechas, total: items.length })}</b></span>
      <span className="bar mt8"><i style={{ width: `${Math.round((hechas / items.length) * 100)}%` }} /></span>
      <p className="small muted mt8">{t('Opcional. Afina tu rutina. Cada semana te preguntamos una cosa, si quieres.')}</p>
    </button>
  )
}
