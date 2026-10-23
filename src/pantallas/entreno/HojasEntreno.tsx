// SES-02 herramientas · SES-07 discos · SES-08 calentamiento · instrucciones · nota de serie
import { useState, type ReactElement } from 'react'
import { guardarSesion } from '../../datos/acciones/entreno'
import { ejercicio, imagen } from '../../catalogo/catalogo'
import { BARRAS, calentamiento, discosPorLado, pesosBarra, pesosPara } from '../../dominio/pesos'
import { anadirSerie, cambiarSerie, conCalentamiento, quitarSerie, saltar, serieActual } from '../../dominio/sesion'
import type { Serie, Sesion } from '../../datos/tipos'
import { conUnidad, kg, num } from '../../dominio/formato'
import { Chip, cx, Hoja, Ico, Interruptor, Stepper, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useGimnasio, useSesionEnCurso } from '../../datos/hooks'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

export function HojaHerramientas({ ruta }: { ruta: Ruta<'hoja-herramientas'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const idx = ruta.d.idx
  const e = s?.ejercicios[idx]
  const ej = ejercicio(e?.ejercicio)
  if (s === undefined) return <Hoja titulo={t('Más')}><p className="muted">{t('Cargando…')}</p></Hoja>
  if (!s || !e || !ej) return <Hoja titulo={t('Más')}><p className="muted">{t('No hay entreno en curso.')}</p></Hoja>
  const conBarra = !!ej.material && ej.material in BARRAS
  // Se abre con el botón «Más»: se titula igual. A la vista, lo de todos los días; lo raro, plegado en «Otras opciones».
  const n = serieActual(e)
  const serie = n >= 0 ? e.series[n] : undefined
  const guardar = (x: Sesion) => guardarSesion(x)
  const numSerie = serie && !serie.calentamiento ? e.series.filter(x => !x.calentamiento).indexOf(serie) + 1 : 0
  const conCalent = e.registro === 'peso' || e.registro === 'mancuerna'
  return (
    <Hoja titulo={t('Más')} sub={ej.nombre} className="tall">
      <div className="list">
        <button className="it" onClick={() => nav.hoja('hoja-instrucciones', { id: ej.id })}><span className="ico"><Ico n="book-open" /></span><span className="tx"><b>{t('Cómo se hace')}</b><small>{t('Dibujos y pasos')}</small></span><Ico n="caret-right" className="car" /></button>
        {serie && <button className="it" onClick={() => nav.hoja('hoja-nota-serie', { idx, n })}><span className="ico"><Ico n="note-pencil" /></span><span className="tx"><b>{t('Apuntar una nota')}</b><small>{serie.nota ? serie.nota : serie.calentamiento ? t('En el calentamiento: una molestia, un mal agarre…') : t('En la serie {n}: una molestia, un mal agarre…', { n: numSerie })}</small></span><Ico n="caret-right" className="car" /></button>}
        <button className="it" onClick={() => nav.hoja('hoja-elegir-ejercicio', { modo: 'sesion-cambiar', idx, id: e.ejercicio })}><span className="ico"><Ico n="swap" /></span><span className="tx"><b>{t('Cambiar ejercicio')}</b><small>{t('Por otro parecido')}</small></span><Ico n="caret-right" className="car" /></button>
        {serie && <button className="it" onClick={async () => { await guardar(anadirSerie(s, idx)); nav.hoja(null); aviso(t('Serie añadida')) }}><span className="ico"><Ico n="plus-square" /></span><span className="tx"><b>{t('Añadir una serie')}</b></span></button>}
        {serie && <button className="it" onClick={async () => {
          const antes = s
          const nueva = quitarSerie(s, idx)
          // Con una sola serie de trabajo no se quita nada.
          if (nueva.ejercicios[idx]!.series.length === e.series.length) { aviso(t('Queda una sola serie: no se puede quitar')); return }
          await guardar(nueva); nav.hoja(null); aviso(t('Serie quitada'), () => void guardar(antes))
        }}><span className="ico"><Ico n="minus-square" /></span><span className="tx"><b>{t('Quitar una serie')}</b></span></button>}
        <button className="it" onClick={async () => { const antes = s; await guardarSesion(saltar(s, idx)); nav.hoja(null); aviso(t('Saltado: lo verás en la lista'), () => void guardarSesion(antes)) }}><span className="ico"><Ico n="skip-forward" /></span><span className="tx"><b>{t('Saltar este ejercicio')}</b><small>{t('Puedes recuperarlo desde la lista')}</small></span></button>
      </div>
      <details className="fold mt16">
        <summary><Ico n="dots-three-circle" className="blue" />{t('Otras opciones')}<Ico n="caret-down" /></summary>
        <div className="in">
          <div className="list">
            {conCalent && <button className="it" onClick={() => nav.hoja('hoja-calentamiento', { idx })}><span className="ico"><Ico n="fire" /></span><span className="tx"><b>{t('Calentamiento sugerido')}</b><small>{t('Series ligeras antes de empezar')}</small></span><Ico n="caret-right" className="car" /></button>}
            {serie && (
              <div className="it">
                <span className="ico"><Ico n="thermometer-simple" /></span>
                <span className="tx"><b>{serie.calentamiento ? t('Esta serie es de calentamiento') : t('La serie {n} es de calentamiento', { n: numSerie })}</b><small>{t('Más ligera; no cuenta para tu progreso')}</small></span>
                <Interruptor on={serie.calentamiento} etiqueta={t('Es de calentamiento')} onCambio={async v => { await guardar(cambiarSerie(s, idx, n, { calentamiento: v })); aviso(v ? t('Marcada como calentamiento') : t('Ya no es calentamiento')) }} />
              </div>
            )}
            {conBarra && <button className="it" onClick={() => nav.hoja('hoja-discos', { idx })}><span className="ico"><Ico n="calculator" /></span><span className="tx"><b>{t('Calculadora de discos')}</b><small>{t('Qué discos poner en la barra')}</small></span><Ico n="caret-right" className="car" /></button>}
            <button className="it" onClick={() => { nav.minimizar(); nav.ir('ficha', { id: ej.id }, 'rut') }}><span className="ico"><Ico n="clock-counter-clockwise" /></span><span className="tx"><b>{t('Historial del ejercicio')}</b><small>{t('Abre la ficha (el entreno sigue)')}</small></span><Ico n="caret-right" className="car" /></button>
          </div>
        </div>
      </details>
    </Hoja>
  )
}

const ALTO: Record<string, number> = { '25': 96, '20': 90, '15': 82, '10': 72, '5': 58, '2.5': 46, '1.25': 38, '1': 34, '0.5': 28 }
const clase = (d: number) => (d >= 15 ? 'p25' : d >= 5 ? 'p10' : 'p125')
const ancho = (d: number) => (d >= 10 ? 15 : d >= 5 ? 12 : 9)

export function HojaDiscos({ ruta }: { ruta: Ruta<'hoja-discos'> }) {
  const s = useSesionEnCurso()
  const g = useGimnasio()
  const e = s?.ejercicios[ruta.d.idx]
  const ej = ejercicio(e?.ejercicio)
  const barraPorDefecto = ej?.material === 'barbell' || !ej?.material ? (g?.barraKg ?? 20) : (BARRAS[ej.material] ?? 20)
  // La sesión y el gimnasio llegan un instante después de abrir la hoja: mientras no se toque,
  // se usa lo de la serie actual (si se guardara en el estado inicial, saldría siempre «barra + 20»).
  const [barraElegida, setBarra] = useState<number | null>(null)
  const barra = barraElegida ?? barraPorDefecto
  const discos = g?.discos?.length ? g.discos : [1.25, 2.5, 5, 10, 15, 20]
  const lista = pesosBarra(barra, discos)
  const actualPeso = e?.series.find(x => !x.hecha)?.peso ?? barra + 20
  const [pesoElegido, setPeso] = useState<number | null>(null)
  const peso = pesoElegido ?? Math.max(barra, actualPeso)
  const lado = discosPorLado(peso, barra, discos)
  let xi = 103, xd = 237
  const izq: ReactElement[] = [], der: ReactElement[] = []
  ;(lado ?? []).forEach((d, i) => {
    const w = ancho(d), h = ALTO[String(d)] ?? 40
    izq.push(<g key={`i${i}`}><rect className={clase(d)} x={xi - w} y={60 - h / 2} width={w} height={h} rx="2" /><text className="pt" x={xi - w / 2} y={i % 2 ? 10 : 122} textAnchor="middle">{num(d, 2)}</text></g>)
    der.push(<g key={`d${i}`}><rect className={clase(d)} x={xd} y={60 - h / 2} width={w} height={h} rx="2" /><text className="pt" x={xd + w / 2} y={i % 2 ? 10 : 122} textAnchor="middle">{num(d, 2)}</text></g>)
    xi -= w + 1; xd += w + 1
  })
  return (
    <Hoja titulo={t('Calculadora de discos')} sub={t('Solo con los discos de tu gimnasio')}>
      <span className="lbl fl">{t('Peso objetivo')}</span>
      <Stepper valor={peso} lista={lista} sufijo="kg" onCambio={setPeso} />
      <div className="card plates mt12">
        <svg viewBox="0 0 340 130" aria-label={t('Barra con {discos} kg por lado', { discos: (lado ?? []).join(', ') })}>
          <rect className="bar-r" x="14" y="57" width="312" height="6" rx="3" />
          <rect className="bar-g" x="120" y="55" width="100" height="10" rx="2" />
          <rect className="coll" x="104" y="48" width="6" height="24" rx="1" />
          <rect className="coll" x="230" y="48" width="6" height="24" rx="1" />
          {izq}{der}
          <text className="pt m" x="170" y="88" textAnchor="middle">{t('barra {n}', { n: num(barra) })}</text>
        </svg>
      </div>
      <div className="spec-box mt12"><div className="spec">
        <p><span>{t('Barra')}</span><b>{num(barra)} kg</b></p>
        <p><span>{t('Por lado')}</span><b>{lado ? (lado.length ? lado.map(d => num(d, 2)).join(' + ') : t('nada')) : t('no se puede exacto')}</b></p>
        <p><span>{t('Total')}</span><b className="goc">{kg(peso)} kg</b></p>
      </div></div>
      <p className="lbl fl mt12">{t('Barra')}</p>
      <div className="chips">
        {[20, 15, 10].map(b => <Chip key={b} on={barra === b} onClick={() => setBarra(b)}>{b} kg</Chip>)}
      </div>
    </Hoja>
  )
}

export function HojaCalentamiento({ ruta }: { ruta: Ruta<'hoja-calentamiento'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const g = useGimnasio()
  const idx = ruta.d.idx
  const e = s?.ejercicios[idx]
  const ej = ejercicio(e?.ejercicio)
  if (s === undefined) return <Hoja titulo={t('Calentamiento')}><p className="muted">{t('Cargando…')}</p></Hoja>
  if (!s || !e || !ej) return <Hoja titulo={t('Calentamiento')}><p className="muted">{t('No hay entreno en curso.')}</p></Hoja>
  const trabajo = e.series.find(x => !x.calentamiento)?.peso ?? 0
  const lista = pesosPara(ej.material, e.registro, g)
  const series = calentamiento(trabajo, lista, ej.material === 'barbell' ? (g?.barraKg ?? 20) : 0)
  const ya = e.series.some(x => x.calentamiento)
  // Con series ya hechas, el calentamiento se metería delante y pasaría a ser «la serie que toca».
  const empezado = e.series.some(x => x.hecha)
  return (
    <Hoja titulo={t('Calentamiento sugerido')} sub={tr('Para trabajar con {peso}', { peso: <b className="mono">{kg(trabajo)} kg</b> })}>
      {series.length ? (
        <div className="list">
          {series.map(c => (
            <div key={c.peso} className="it">
              <span className="tx"><b className="mono">{kg(c.peso)} kg × {c.reps}</b>{ej.material === 'barbell' && <small>{c.peso <= (g?.barraKg ?? 20) ? t('Solo la barra') : t('{n} por lado', { n: kg((c.peso - (g?.barraKg ?? 20)) / 2) })}</small>}</span>
              <span className="end muted">{conUnidad(String(Math.round((c.peso / trabajo) * 100)), '%')}</span>
            </div>
          ))}
        </div>
      ) : trabajo > 0
        // Con un peso ligero (p. ej. la barra vacía) no hay nada más ligero con que calentar: no hace falta.
        ? <p className="muted">{t('Con {n} kg no hace falta calentar con menos peso: haz unas repeticiones suaves con este mismo y empieza.', { n: kg(trabajo) })}</p>
        : <p className="muted">{t('Pon antes el peso de trabajo.')}</p>}
      <p className="small muted mt8">{t('Descansa lo justo entre ellas: 45-60 s.')}</p>
      <button className={cx('btn mt16', (ya || empezado || !series.length) && 'off')} disabled={ya || empezado || !series.length}
        onClick={async () => { await guardarSesion(conCalentamiento(s, idx, series)); nav.hoja(null); aviso(t('Calentamiento añadido')) }}>
        {ya ? t('Ya está añadido') : empezado ? t('Ya has empezado este ejercicio') : !series.length && trabajo > 0 ? t('No hace falta') : t('Añadir a la lista')}
      </button>
    </Hoja>
  )
}

export function HojaInstrucciones({ ruta }: { ruta: Ruta<'hoja-instrucciones'> }) {
  const ej = ejercicio(ruta.d.id)
  if (!ej) return <Hoja titulo={t('Instrucciones')}><p className="muted">{t('No encontrado.')}</p></Hoja>
  return (
    <Hoja titulo={t('Instrucciones')} sub={ej.nombre} className="tall">
      <div className="grid2">
        {ej.poses.map(p => <img key={p} src={imagen(ej, p)} alt="" style={{ width: '100%', borderRadius: 10, background: '#d9f0fc' }} />)}
      </div>
      <ol className="steps mt16">{ej.instrucciones.map((paso, i) => <li key={i}>{paso}</li>)}</ol>
      {ej.consejos.length > 0 && <div className="why mt16"><p className="lbl">{t('Consejos')}</p>{ej.consejos.map((consejo, i) => <p key={i}><Ico n="check-circle" /><span>{consejo}</span></p>)}</div>}
      <p className="credit">Exercise data by RepDB (repdb.co)</p>
    </Hoja>
  )
}

export function HojaNotaSerie({ ruta }: { ruta: Ruta<'hoja-nota-serie'> }) {
  const s = useSesionEnCurso()
  const { idx, n } = ruta.d
  const serie = s?.ejercicios[idx]?.series[n]
  if (s === undefined) return <Hoja titulo={t('Nota')}><p className="muted">{t('Cargando…')}</p></Hoja>
  if (!s || !serie) return <Hoja titulo={t('Nota')}><p className="muted">{t('No hay serie.')}</p></Hoja>
  // El formulario se monta cuando ya hay sesión: si no, la nota que ya tenía la serie no aparecería.
  return <FormNotaSerie s={s} idx={idx} n={n} serie={serie} />
}

function FormNotaSerie({ s, idx, n, serie }: { s: Sesion; idx: number; n: number; serie: Serie }) {
  const nav = useNav()
  const aviso = useAviso()
  const [texto, setTexto] = useState(serie.nota ?? '')
  const e = s.ejercicios[idx]!
  const titulo = serie.calentamiento ? t('Calentamiento') : t('Serie {n}', { n: e.series.filter(x => !x.calentamiento).indexOf(serie) + 1 })
  return (
    <Hoja titulo={t('Nota de la serie')} sub={titulo}>
      <textarea className="inp" autoFocus aria-label={t('Nota de la serie')} maxLength={LARGO.nota} value={texto} onChange={e => setTexto(e.target.value)} placeholder={t('Molestia en el hombro, agarre falló…')} />
      <div className="chips mt8">{[t('Molestia'), t('Me ha costado'), t('Muy fácil'), t('Mal agarre')].map(x => <Chip key={x} onClick={() => setTexto(v => (v ? `${v}. ${x}` : x))}>{x}</Chip>)}</div>
      <button className="btn mt16" onClick={async () => { const x = structuredClone(s); x.ejercicios[idx]!.series[n]!.nota = texto; await guardarSesion(x); nav.hoja(null); aviso(t('Nota guardada')) }}>{t('Guardar')}</button>
    </Hoja>
  )
}
