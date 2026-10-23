// PRO-02 · Fuerza
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { metasDeTipo } from '../../datos/consultas'
import { sesionesHechas } from '../../datos/consultas'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { patron } from '../../catalogo/clasificacion'
import { kg, num } from '../../dominio/formato'
import { fechaCorta, hoyISO, MESES, semanaDe, sumarDias } from '../../dominio/fechas'
import { resumen } from '../../dominio/sesion'
import { cambioDesdeInicio, ejerciciosHechos, evolucion, logros, nivelSeries, pesoMaximo, progresoMeta, seriesDe, seriesPorGrupo, subidas } from '../../dominio/tendencias'
import { Barras, Linea } from '../../ui/graficas'
import { Chip, cx, estilo, Ico, Pantalla, pct, Th, Vacio } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { CabProgreso, fechaPunto } from './comun'
import { t, tk, tn, type Vars } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'

/** Ejercicios que se ven a la vez en «Por ejercicio»; el resto, con «Ver N más». */
const MAX_CHIPS = 6

/** Palabra de cada nivel de series (nivelSeries da la clave). */
const NIVEL = { poco: tk('poco'), bien: tk('bien'), mucho: tk('mucho') } as const

export function Fuerza() {
  const nav = useNav()
  const sesiones = useLiveQuery(() => sesionesHechas(), [])
  const metas = useLiveQuery(() => metasDeTipo('ejercicio'), []) ?? []
  const [elegido, setElegido] = useState<string | null>(null)
  const [cuantos, setCuantos] = useState(12)
  const [todosEj, setTodosEj] = useState(false)
  const hoy = hoyISO()
  const cab = <CabProgreso actual="pro-fuerza" crumb={t('Lo que más motiva')} />

  if (!sesiones) return <Pantalla>{cab}</Pantalla>
  if (!sesiones.length) return (
    <Pantalla>
      {cab}
      <div className="pg"><div className="sec">
        <Vacio icono="barbell" titulo={t('Aún no hay entrenos')} texto={t('Cuando termines tu primer entreno verás aquí tus récords, tus subidas de peso y el historial.')}
          accion={<><Ico n="clipboard-text" b />{t('Ver mi rutina')}</>} onAccion={() => nav.pestana('rut')} />
      </div></div>
    </Pantalla>
  )

  const mesIni = `${hoy.slice(0, 7)}-01`
  const todos = logros(sesiones)
  const delMes = todos.filter(l => l.fecha >= mesIni)
  const recientes = todos.slice(0, 5)

  // Subidas de los últimos 30 días, una por ejercicio (del primer «antes» al último «ahora»).
  const desde = sumarDias(hoy, -30)
  const porEj = new Map<string, { id: string; antes: number; ahora: number; fecha: string }>()
  for (const s of subidas(sesiones).filter(x => x.fecha >= desde)) {
    const p = porEj.get(s.ejercicio)
    if (!p) porEj.set(s.ejercicio, { id: s.ejercicio, antes: s.antes, ahora: s.ahora, fecha: s.fecha })
    else p.antes = Math.min(p.antes, s.antes)
  }
  const subidasMes = [...porEj.values()]

  // Metas de ejercicio aún sin alcanzar: se muestran como logros por desbloquear.
  const bloqueadas = metas.filter(m => !m.hecha && m.ejercicio).map(m => {
    const pesos = sesiones.map(s => pesoMaximo(seriesDe(s, m.ejercicio!))).filter((v): v is number => v != null)
    const actual = pesos.length ? Math.max(...pesos) : null
    return { m, actual }
  }).filter(x => x.actual == null || x.actual < x.m.objetivo)

  const ids = ejerciciosHechos(sesiones).slice(0, 10)
  const id = elegido && ids.includes(elegido) ? elegido : ids[0]
  const aPuntos = (ps: { fecha: string; valor: number }[]) => ps.slice(-12).map(p => ({ x: fechaPunto(p.fecha), y: p.valor }))
  const evoPeso = id ? evolucion(sesiones, id, 'peso') : []
  const puntos = aPuntos(evoPeso)
  const puntos1RM = id ? aPuntos(evolucion(sesiones, id, 'e1rm')) : []
  const puntosVol = id ? aPuntos(evolucion(sesiones, id, 'volumen')) : []
  const cambio = cambioDesdeInicio(evoPeso)
  const nombre = id ? nombreEjercicio(id) : ''
  // Frase que contesta «¿levanto más que al empezar?».
  const vf: Vars = cambio ? { ejercicio: nombre, kg: kg(cambio.ahora), cambio: kg(Math.abs(cambio.delta)) } : {}
  const frase = !cambio ? null
    : evoPeso.length < 2 ? t('{ejercicio}: {kg} kg la primera vez. Repítelo y verás si subes.', vf)
      : cambio.delta > 0 ? t('{ejercicio}: {kg} kg, +{cambio} kg desde el inicio.', vf)
        : cambio.delta < 0 ? t('{ejercicio}: {kg} kg, {cambio} kg menos que al inicio.', vf)
          : t('{ejercicio}: {kg} kg, igual que al inicio.', vf)

  const grupos = seriesPorGrupo(sesiones, semanaDe(hoy), x => { const e = ejercicio(x); return e ? patron(e) : undefined })
  const escala = Math.max(24, ...grupos.map(g => g.v))
  const totalSemana = grupos.reduce((suma, g) => suma + g.v, 0)

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        <div className="sec">
          <div className="sec-h"><h2>{t('Récords recientes')}</h2>{delMes.length > 0 && <span className="lbl mono">{t('{n} en {mes}', { n: delMes.length, mes: MESES[Number(hoy.slice(5, 7)) - 1]! })}</span>}</div>
          {recientes.length === 0 && bloqueadas.length === 0 ? (
            <p className="note plain"><Ico n="trophy" /><span>{sesiones.length < 2 ? t('Aún pronto: los récords llegan cuando repites ejercicios.') : t('Aún no hay récords. Llegan solos cuando subes peso o repeticiones.')}</span></p>
          ) : (
            <div className="achs">
              {recientes.map(l => (
                <button key={`${l.sesionId}-${l.ejercicio}`} className="ach" style={{ width: '100%', textAlign: 'left' }} onClick={() => l.sesionId != null && nav.ir('pro-entreno', { id: l.sesionId })}>
                  <span className="tro"><Ico n={l.tipo === 'reps' ? 'medal' : 'trophy'} b /></span>
                  <span className="tx">
                    <small className="au">{fechaCorta(l.fecha)} · {l.tipo === 'reps' ? t('récord de reps') : t('récord')}</small>
                    <b>{nombreEjercicio(l.ejercicio)}</b>
                    <small className="mono">{kg(l.peso)} kg × {l.reps}</small>
                  </span>
                  {l.mejora > 0 && <span className="end up">{l.tipo === 'reps' ? tn(l.mejora, '+{n} rep', '+{n} reps') : `+${kg(l.mejora)} kg`}</span>}
                </button>
              ))}
              {bloqueadas.map(({ m, actual }) => (
                <button key={m.id} className="ach locked" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.hoja('sheet-meta', { id: m.id })}>
                  <span className="tro lock"><Ico n="lock-simple" b /></span>
                  <span className="tx">
                    <b>{m.titulo}</b>
                    <small>{actual != null ? t('Te faltan {cantidad} {unidad}', { cantidad: kg(m.objetivo - actual), unidad: m.unidad || 'kg' }) : t('Aún sin datos')}</small>
                    <span className="bar gold mt4"><i style={estilo({ '--w': pct(progresoMeta(m.inicio, actual, m.objetivo), 1) })} /></span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {subidasMes.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Subidas del mes')}</h2><span className="lbl">{t('últimos 30 días')}</span></div>
            <div className="list">
              {subidasMes.map(u => (
                <div key={u.id} className="it">
                  <Th ej={ejercicio(u.id)} size="s" />
                  <span className="tx"><b>{nombreEjercicio(u.id)}</b><small className="mono">{kg(u.antes)} → {kg(u.ahora)} kg</small></span>
                  <span className="end up">+{kg(u.ahora - u.antes)} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>{t('Por ejercicio')}</h2></div>
          <div className="card pd">
            {/* En varias filas: en una sola tira, que se sale de la pantalla, no se ve que hay más. */}
            <div className="chips fza-chips">
              {(todosEj ? ids : ids.slice(0, MAX_CHIPS).concat(id && ids.indexOf(id) >= MAX_CHIPS ? [id] : [])).map(x => (
                <Chip key={x} on={x === id} onClick={() => setElegido(x)}>{nombreEjercicio(x)}</Chip>
              ))}
              {!todosEj && ids.length > MAX_CHIPS && <button type="button" className="lnk small" onClick={() => setTodosEj(true)}>{t('Ver {n} más', { n: ids.length - MAX_CHIPS })}</button>}
            </div>
            {frase && <p className="fza-frase mt12">{frase}</p>}
            <p className="lbl mt12">{t('Peso máx.')} <span className="muted">{t('· lo más pesado de cada día')}</span></p>
            <div className="mt8">
              {puntos.length === 0
                ? <p className="small muted">{t('Este ejercicio no lleva peso o aún no tiene series: mira sus repeticiones en el historial.')}</p>
                : <Linea puntos={puntos} decimales={2} vacia={t('Con 2 entrenos de este ejercicio verás aquí la línea.')} />}
            </div>
            {puntos.length > 1 && (
              <details className="fold mt12">
                <summary><Ico n="chart-bar" className="blue" />{t('Más gráficas')} <Ico n="caret-down" /></summary>
                <div className="in">
                  <p className="lbl">{t('1RM est.')} <span className="muted">{t('· lo que podrías levantar 1 vez')}</span></p>
                  <div className="mt8"><Linea puntos={puntos1RM} decimales={1} vacia={t('Aún no hay datos para calcularlo.')} /></div>
                  <p className="lbl mt12">{t('Volumen')} <span className="muted">{t('· kilos movidos en total (peso × repeticiones)')}</span></p>
                  <div className="mt8"><Barras puntos={puntosVol} vacia={t('Aún no hay datos para calcularlo.')} /></div>
                </div>
              </details>
            )}
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>{t('Series por grupo')}</h2><span className="lbl">{t('esta semana')}</span></div>
          <div className="card pd">
            <div className="hbars fza-grupos">
              {grupos.map(g => {
                const nivel = nivelSeries(g.v, g.zona)
                return (
                  <div key={g.n}>
                    <span>{t(g.n)}</span>
                    <span className={cx('bar zone', g.v > g.zona[1] && 'go')} style={estilo({ '--z1': pct(g.zona[0], escala), '--z2': pct(g.zona[1], escala) })}>
                      <i style={estilo({ '--w': pct(g.v, escala) })} />
                    </span>
                    <b>{g.v}</b>
                    {totalSemana ? <span className={cx('tag', nivel === 'bien' && 'ok', nivel === 'mucho' && 'warn')}>{t(NIVEL[nivel])}</span> : <span />}
                  </div>
                )
              })}
            </div>
            <p className="small muted mt8">{totalSemana ? t('Series hechas esta semana. «Poco» es normal mientras te queden entrenos.') : t('Esta semana aún no has entrenado.')}</p>
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>{t('Historial')}</h2><span className="lbl">{tn(sesiones.length, '{n} entreno', '{n} entrenos')}</span></div>
          <div className="list">
            {sesiones.slice(0, cuantos).map(s => {
              const r = resumen(s)
              const recs = s.ejercicios.reduce((suma, e) => suma + e.series.filter(x => x.record && x.hecha).length, 0)
              return (
                <button key={s.id} className="it" onClick={() => nav.ir('pro-entreno', { id: s.id })}>
                  <span className="code">{fechaCorta(s.fecha)}</span>
                  <span className="tx">
                    <b>{nombreEntreno(s)}</b>
                    <small className="mono">{tn(r.series, '{min} min · {n} serie', '{min} min · {n} series', { min: Math.round(r.segundos / 60) })}{r.volumen ? ` · ${t('{n} kg movidos', { n: num(r.volumen, 0) })}` : ''}</small>
                  </span>
                  {recs > 0 && <span className="tag gold"><Ico n="trophy" b />{recs}</span>}
                  <Ico n="caret-right" className="car" />
                </button>
              )
            })}
          </div>
          {sesiones.length > cuantos && <button className="btn ln sm mt8" onClick={() => setCuantos(c => c + 20)}>{t('Ver más entrenos')}</button>}
        </div>
      </div>
    </Pantalla>
  )
}
