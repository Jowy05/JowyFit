// PRO-01 · Semana («¿Voy bien?»)
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { objetivosEnergia, sesionesHechas } from '../../../datos/consultas'
import { nombreEjercicio } from '../../../catalogo/catalogo'
import { num, kg } from '../../../dominio/calculos'
import { deISO, diaSemana, hoyISO, lunesDe, MESES_CORTOS, numeroSemana, semanaDe, sumarDias } from '../../../dominio/fechas'
import { consejoQuincenal, resumenSemana } from '../../../dominio/resumen'
import { datosQuincena, mediasSemanales, pendienteSemanal, puntosSpark, recordsEn, subidas } from '../../../dominio/tendencias'
import { cx, estilo, Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAjustes, usePerfil, useRutina } from '../../datos'
import { CabProgreso, capital } from './comun'

function rango(dias: string[]): string {
  const a = deISO(dias[0]!), b = deISO(dias[6]!)
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}-${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`
    : `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} - ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`
}

const signo = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), d)}`

type Estado = 'ok' | 'warn' | 'bad' | 'nada'
function Icono({ e, trofeo }: { e: Estado; trofeo?: boolean }) {
  if (trofeo) return <Ico n="trophy" b className="goldc" />
  if (e === 'ok') return <Ico n="check-circle" b className="okc" />
  if (e === 'warn') return <Ico n="minus-circle" b className="warnc" />
  if (e === 'bad') return <Ico n="x-circle" b className="badc" />
  return <Ico n="circle-dashed" className="muted" />
}

const COLOR = { verde: 'ok', ambar: 'warn', rojo: 'bad' } as const

export function Semana() {
  const nav = useNav()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const rutina = useRutina()
  const hoy = hoyISO()
  const [atras, setAtras] = useState(0) // semanas hacia atrás
  const lunes = sumarDias(lunesDe(hoy), -7 * atras)
  const dias = semanaDe(lunes)
  const domingo = dias[6]!
  const inicio = ajustes.inicio ?? perfil.creado.slice(0, 10)
  const nSemana = numeroSemana(inicio, lunes)

  const datos = useLiveQuery(async () => {
    const [sesiones, mediciones, comidas, pasos, energia] = await Promise.all([
      sesionesHechas(),
      db.mediciones.toArray(),
      db.comidas.where('fecha').between(sumarDias(lunes, -21), domingo, true, true).toArray(),
      db.pasos.where('fecha').between(sumarDias(lunes, -7), domingo, true, true).toArray(),
      objetivosEnergia(perfil),
    ])
    return { sesiones, mediciones: mediciones.filter(m => m.fecha.slice(0, 10) <= domingo), comidas, pasos, energia }
  }, [lunes, domingo, perfil])

  const cab = (
    <CabProgreso actual="pro-sem" crumb={atras === 0 ? 'Revisión del domingo' : 'Semanas anteriores'} />
  )
  const selector = (
    <div className="daysel">
      <button className={cx('ib', nSemana <= 1 && 'dim')} aria-label="Semana anterior" disabled={nSemana <= 1} onClick={() => setAtras(a => a + 1)}><Ico n="caret-left" /></button>
      <div><b>Semana {Math.max(1, nSemana)}</b><small>{atras === 0 ? `Esta semana · ${rango(dias)}` : rango(dias)}</small></div>
      <button className={cx('ib', atras === 0 && 'dim')} aria-label="Semana siguiente" disabled={atras === 0} onClick={() => setAtras(a => Math.max(0, a - 1))}><Ico n="caret-right" /></button>
    </div>
  )

  if (!datos) return <Pantalla>{cab}<div className="pg">{selector}</div></Pantalla>

  const { sesiones, mediciones, comidas, pasos, energia } = datos
  const fijos = rutina ? rutina.dias.filter(d => !d.opcional).length : perfil.diasFijos.length
  const subidasSemana = subidas(sesiones).filter(s => dias.includes(s.fecha))
  const r = resumenSemana({
    hoy: atras === 0 ? hoy : domingo,
    sesiones, fijos, mediciones, comidas, pasos,
    objetivoProteina: energia.proteina,
    objetivoPasos: perfil.pasosObjetivo,
    recordsSemana: recordsEn(sesiones, dias),
    subidasSemana: new Set(subidasSemana.map(s => s.ejercicio)).size,
    esperados: atras === 0 ? perfil.diasFijos.filter(d => d <= diaSemana(deISO(hoy))).length : undefined,
  })
  const hayDatos = sesiones.some(s => dias.includes(s.fecha)) || mediciones.some(m => dias.includes(m.fecha.slice(0, 10)))
    || comidas.some(c => dias.includes(c.fecha)) || pasos.some(p => dias.includes(p.fecha))

  if (!hayDatos) return (
    <Pantalla>
      {cab}
      <div className="pg">
        {selector}
        <Vacio icono="chart-line-up" titulo={atras === 0 ? 'Tu semana aún está vacía' : 'Sin datos esa semana'}
          texto="Cuando entrenes, te peses o apuntes comidas, aquí verás en 10 segundos si vas bien."
          accion={<><Ico n="ruler" b />Registrar medidas</>} onAccion={() => nav.ir('pro-reg')} />
      </div>
    </Pantalla>
  )

  // Tendencia de peso: medias semanales de las últimas 6 semanas.
  const medias = mediasSemanales(mediciones, m => m.pesoKg).filter(p => p.fecha <= lunes).slice(-6)
  const pendiente = pendienteSemanal(medias)
  const spark = puntosSpark(medias.map(p => p.valor))
  const ultSpark = spark[spark.length - 1]

  const q = datosQuincena({ domingo, mediciones, comidas })
  const consejo = consejoQuincenal({ ...q, objetivoProteina: energia.proteina, objetivo: perfil.objetivo })
  const corte = consejo.search(/[:.] /)
  const consejoT = corte > 0 ? consejo.slice(0, corte) + '.' : consejo
  const consejoD = corte > 0 ? capital(consejo.slice(corte + 2)) : ''

  const color = COLOR[r.semaforo]
  const estiloSem = r.semaforo === 'verde' ? undefined : estilo({ borderColor: `var(--${color})`, background: `linear-gradient(90deg,var(--${color}-t),transparent 85%),var(--surface)` })
  const mejorSubida = subidasSemana.reduce<(typeof subidasSemana)[number] | null>((a, b) => (!a || b.ahora - b.antes > a.ahora - a.antes ? b : a), null)

  const midio = mediciones.some(m => m.perimetros?.cintura != null && dias.includes(m.fecha.slice(0, 10)))
  const eCintura: Estado = r.cintura.delta == null || !midio ? 'nada' : r.cintura.delta <= 0 ? 'ok' : 'warn'
  const eEntrenos: Estado = r.entrenos >= r.fijos ? 'ok' : r.entrenos >= r.fijos - 1 ? 'warn' : 'bad'
  const eProteina: Estado = r.proteina.media == null ? 'nada' : r.proteina.media >= r.proteina.objetivo * 0.9 ? 'ok' : r.proteina.media >= r.proteina.objetivo * 0.75 ? 'warn' : 'bad'
  const ePasos: Estado = r.pasos.media == null ? 'nada' : r.pasos.diasCumplidos >= 5 ? 'ok' : r.pasos.diasCumplidos >= 3 ? 'warn' : 'bad'
  const ePicoteo: Estado = r.picoteo.dias <= 1 ? 'ok' : r.picoteo.dias <= r.picoteo.anterior ? 'warn' : 'bad'

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        {selector}

        <div className="sem card" style={estiloSem}>
          <div className="lights" aria-hidden="true">
            <i className={cx('r', r.semaforo === 'rojo' && 'on')} style={r.semaforo === 'rojo' ? { boxShadow: '0 0 12px #E5534B' } : undefined} />
            <i className={cx('a', r.semaforo === 'ambar' && 'on')} style={r.semaforo === 'ambar' ? { boxShadow: '0 0 12px #F2B233' } : undefined} />
            <i className={cx('g', r.semaforo === 'verde' && 'on')} />
          </div>
          <div className="grow">
            <p className="sem-t" style={r.semaforo === 'verde' ? undefined : { color: `var(--${color})` }}>
              <Ico n={r.semaforo === 'verde' ? 'check-circle' : r.semaforo === 'ambar' ? 'minus-circle' : 'x-circle'} b />{r.titulo}
            </p>
            <p className="sem-d">{r.frase}</p>
          </div>
        </div>
        {atras === 0 && hoy < domingo && <p className="small muted mt8"><Ico n="clock" /> Semana en curso: el resumen definitivo, el domingo.</p>}

        <div className="grid2 mt12">
          <button className="card kpi st" onClick={() => nav.reemplazar('pro-cuerpo')}>
            <span className="row jb"><span className="lbl">Cintura</span><Icono e={eCintura} /></span>
            <p className="k">{r.cintura.actual != null ? num(r.cintura.actual) : '—'}<small>cm</small></p>
            <p className="d">{!midio ? (r.cintura.actual != null ? 'sin medir esta semana' : 'mídete la cintura') : r.cintura.delta != null ? <><b className={cx(r.cintura.delta <= 0 && 'up')}>{signo(r.cintura.delta)}</b> esta semana</> : r.cintura.actual != null ? 'sin cambios medidos' : 'mídete la cintura'}</p>
          </button>
          <button className="card kpi st" onClick={() => nav.reemplazar('pro-fuerza')}>
            <span className="row jb"><span className="lbl">Fuerza</span><Icono e={r.records > 0 || r.subidas > 0 ? 'ok' : 'nada'} trofeo={r.records > 0} /></span>
            <p className="k">{r.records}<small>récord{r.records === 1 ? '' : 's'}</small></p>
            <p className="d">{mejorSubida ? `+${kg(mejorSubida.ahora - mejorSubida.antes)} kg en ${nombreEjercicio(mejorSubida.ejercicio).toLowerCase()}` : r.subidas ? `${r.subidas} subidas` : 'sin subidas de peso'}</p>
          </button>
          <div className="card kpi st">
            <span className="row jb"><span className="lbl">Entrenos</span><Icono e={eEntrenos} /></span>
            <p className="k">{r.entrenos}/{r.fijos}{r.extra > 0 && <small>+ {r.extra} extra</small>}</p>
            <div className="pips mt8">
              {Array.from({ length: r.fijos }, (_, i) => <i key={i} className={cx(i < r.entrenos && 'on')} />)}
              {Array.from({ length: r.extra }, (_, i) => <i key={`x${i}`} className="ex" />)}
            </div>
          </div>
          <button className="card kpi st" onClick={() => nav.pestana('com')}>
            <span className="row jb"><span className="lbl">Proteína</span><Icono e={eProteina} /></span>
            <p className="k">{r.proteina.media != null ? Math.round(r.proteina.media) : '—'}<small>g/día</small></p>
            <p className="d">{r.proteina.media != null ? `objetivo ${r.proteina.objetivo} g` : 'apunta tus comidas'}</p>
          </button>
          <button className="card kpi st" onClick={() => nav.ir('pro-pasos')}>
            <span className="row jb"><span className="lbl">Pasos</span><Icono e={ePasos} /></span>
            <p className="k">{r.pasos.media != null ? num(r.pasos.media, 0) : '—'}<small>media</small></p>
            <p className="d">{r.pasos.media != null ? `${r.pasos.diasCumplidos} de 7 días` : 'apunta tus pasos'}</p>
          </button>
          <button className="card kpi st" onClick={() => nav.pestana('com')}>
            <span className="row jb"><span className="lbl">Picoteo</span><Icono e={ePicoteo} /></span>
            <p className="k">{r.picoteo.dias}<small>día{r.picoteo.dias === 1 ? '' : 's'}</small></p>
            <p className="d">la anterior: {r.picoteo.anterior}</p>
          </button>
          <button className="card kpi st span2 row" onClick={() => nav.reemplazar('pro-cuerpo')}>
            <span className="grow">
              <span className="lbl">Peso · tendencia</span>
              <p className="d">
                {medias.length >= 2
                  ? <>{num(medias[0]!.valor)} → <b className="mono">{num(medias[medias.length - 1]!.valor)} kg</b>{pendiente != null && ` · ${signo(pendiente)} kg/semana`}</>
                  : medias.length === 1 ? <><b className="mono">{num(medias[0]!.valor)} kg</b> · pésate más semanas para ver la tendencia</> : 'Aún no hay pesajes'}
              </p>
            </span>
            {spark.length >= 2 && ultSpark && (
              <svg className="spark" viewBox="0 0 120 40" aria-hidden="true">
                <polyline points={spark.map(p => `${p.x},${p.y}`).join(' ')} className="sp-l" />
                <circle cx={ultSpark.x} cy={ultSpark.y} r="3.5" className="sp-d" />
              </svg>
            )}
          </button>
        </div>

        <div className="sec">
          <div className="card pd advice">
            <span className="row jb"><span className="lbl">Consejo de la quincena</span><span className="tag blue">Cada 2 semanas</span></span>
            <b className="adj-t">{consejoT}</b>
            {consejoD && <p className="small muted">{consejoD}</p>}
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
