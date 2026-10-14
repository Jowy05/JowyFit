// PRO-02 · Fuerza
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { sesionesHechas } from '../../../datos/consultas'
import { ejercicio, nombreEjercicio } from '../../../catalogo/catalogo'
import { patron } from '../../../catalogo/clasificacion'
import { kg, num } from '../../../dominio/calculos'
import { fechaCorta, hoyISO, MESES, semanaDe, sumarDias } from '../../../dominio/fechas'
import { resumen } from '../../../dominio/sesion'
import { cambioDesdeInicio, ejerciciosHechos, evolucion, logros, pesoMaximo, progresoMeta, seriesDe, seriesPorGrupo, subidas } from '../../../dominio/tendencias'
import { Barras, Linea } from '../../graficas'
import { Chip, cx, estilo, Ico, Pantalla, pct, Th, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { CabProgreso, fechaPunto } from './comun'

export function Fuerza() {
  const nav = useNav()
  const sesiones = useLiveQuery(() => sesionesHechas(), [])
  const metas = useLiveQuery(() => db.metas.where('tipo').equals('ejercicio').toArray(), []) ?? []
  const [elegido, setElegido] = useState<string | null>(null)
  const [cuantos, setCuantos] = useState(12)
  const hoy = hoyISO()
  const cab = <CabProgreso actual="pro-fuerza" crumb="Lo que más motiva" />

  if (!sesiones) return <Pantalla>{cab}</Pantalla>
  if (!sesiones.length) return (
    <Pantalla>
      {cab}
      <div className="pg"><div className="sec">
        <Vacio icono="barbell" titulo="Aún no hay entrenos" texto="Cuando termines tu primer entreno verás aquí tus récords, tus subidas de peso y el historial."
          accion={<><Ico n="clipboard-text" b />Ver mi rutina</>} onAccion={() => nav.pestana('rut')} />
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
  const frase = !cambio ? null
    : evoPeso.length < 2 ? `${nombre}: ${kg(cambio.ahora)} kg la primera vez. Repítelo y verás si subes.`
      : cambio.delta > 0 ? `${nombre}: ${kg(cambio.ahora)} kg, +${kg(cambio.delta)} kg desde el inicio.`
        : cambio.delta < 0 ? `${nombre}: ${kg(cambio.ahora)} kg, ${kg(Math.abs(cambio.delta))} kg menos que al inicio.`
          : `${nombre}: ${kg(cambio.ahora)} kg, igual que al inicio.`

  const grupos = seriesPorGrupo(sesiones, semanaDe(hoy), x => { const e = ejercicio(x); return e ? patron(e) : undefined })
  const escala = Math.max(24, ...grupos.map(g => g.v))
  const totalSemana = grupos.reduce((t, g) => t + g.v, 0)

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        <div className="sec">
          <div className="sec-h"><h2>Récords recientes</h2>{delMes.length > 0 && <span className="lbl mono">{delMes.length} en {MESES[Number(hoy.slice(5, 7)) - 1]}</span>}</div>
          {recientes.length === 0 && bloqueadas.length === 0 ? (
            <p className="note plain"><Ico n="trophy" /><span>{sesiones.length < 2 ? 'Aún pronto: los récords llegan cuando repites ejercicios.' : 'Aún no hay récords. Llegan solos cuando subes peso o repeticiones.'}</span></p>
          ) : (
            <div className="achs">
              {recientes.map(l => (
                <button key={`${l.sesionId}-${l.ejercicio}`} className="ach" style={{ width: '100%', textAlign: 'left' }} onClick={() => l.sesionId != null && nav.ir('pro-entreno', { id: l.sesionId })}>
                  <span className="tro"><Ico n={l.tipo === 'reps' ? 'medal' : 'trophy'} b /></span>
                  <span className="tx">
                    <small className="au">{fechaCorta(l.fecha)} · {l.tipo === 'reps' ? 'récord de reps' : 'récord'}</small>
                    <b>{nombreEjercicio(l.ejercicio)}</b>
                    <small className="mono">{kg(l.peso)} kg × {l.reps}</small>
                  </span>
                  {l.mejora > 0 && <span className="end up">{l.tipo === 'reps' ? `+${l.mejora} rep${l.mejora === 1 ? '' : 's'}` : `+${kg(l.mejora)} kg`}</span>}
                </button>
              ))}
              {bloqueadas.map(({ m, actual }) => (
                <button key={m.id} className="ach locked" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav.hoja('sheet-meta', { id: m.id })}>
                  <span className="tro lock"><Ico n="lock-simple" b /></span>
                  <span className="tx">
                    <b>{m.titulo}</b>
                    <small>{actual != null ? `Te faltan ${kg(m.objetivo - actual)} ${m.unidad || 'kg'}` : 'Aún sin datos'}</small>
                    <span className="bar gold mt4"><i style={estilo({ '--w': pct(progresoMeta(m.inicio, actual, m.objetivo), 1) })} /></span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {subidasMes.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Subidas del mes</h2><span className="lbl">últimos 30 días</span></div>
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
          <div className="sec-h"><h2>Por ejercicio</h2></div>
          <div className="card pd">
            <div className="chips scroll">
              {ids.map(x => <Chip key={x} on={x === id} onClick={() => setElegido(x)}>{nombreEjercicio(x)}</Chip>)}
            </div>
            {frase && <p className="fza-frase mt12">{frase}</p>}
            <p className="lbl mt12">Peso máx. <span className="muted">· lo más pesado de cada día</span></p>
            <div className="mt8">
              {puntos.length === 0
                ? <p className="small muted">Este ejercicio no lleva peso o aún no tiene series: mira sus repeticiones en el historial.</p>
                : <Linea puntos={puntos} decimales={2} vacia="Con 2 entrenos de este ejercicio verás aquí la línea." />}
            </div>
            {puntos.length > 1 && (
              <details className="fold mt12">
                <summary><Ico n="chart-bar" className="blue" />Más gráficas <Ico n="caret-down" /></summary>
                <div className="in">
                  <p className="lbl">1RM est. <span className="muted">· lo que podrías levantar 1 vez</span></p>
                  <div className="mt8"><Linea puntos={puntos1RM} decimales={1} vacia="Aún no hay datos para calcularlo." /></div>
                  <p className="lbl mt12">Volumen <span className="muted">· kilos movidos en total (peso × repeticiones)</span></p>
                  <div className="mt8"><Barras puntos={puntosVol} vacia="Aún no hay datos para calcularlo." /></div>
                </div>
              </details>
            )}
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Series por grupo</h2><span className="lbl">esta semana</span></div>
          <div className="card pd">
            <div className="hbars">
              {grupos.map(g => (
                <div key={g.n}>
                  <span>{g.n}</span>
                  <span className={cx('bar zone', g.v > g.zona[1] && 'go')} style={estilo({ '--z1': pct(g.zona[0], escala), '--z2': pct(g.zona[1], escala) })}>
                    <i style={estilo({ '--w': pct(g.v, escala) })} />
                  </span>
                  <b>{g.v}</b>
                </div>
              ))}
            </div>
            <p className="small muted mt8">{totalSemana ? 'Las rayas marcan la zona recomendada de series a la semana.' : 'Esta semana aún no has entrenado.'}</p>
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Historial</h2><span className="lbl">{sesiones.length} entreno{sesiones.length === 1 ? '' : 's'}</span></div>
          <div className="list">
            {sesiones.slice(0, cuantos).map(s => {
              const r = resumen(s)
              const recs = s.ejercicios.reduce((t, e) => t + e.series.filter(x => x.record && x.hecha).length, 0)
              return (
                <button key={s.id} className="it" onClick={() => nav.ir('pro-entreno', { id: s.id })}>
                  <span className="code">{fechaCorta(s.fecha)}</span>
                  <span className="tx">
                    <b>{s.nombre}</b>
                    <small className="mono">{Math.round(r.segundos / 60)} min · {r.series} series{r.volumen ? ` · ${num(r.volumen, 0)} kg movidos` : ''}</small>
                  </span>
                  {recs > 0 && <span className="tag gold"><Ico n="trophy" b />{recs}</span>}
                  <Ico n="caret-right" className="car" />
                </button>
              )
            })}
          </div>
          {sesiones.length > cuantos && <button className="btn ln sm mt8" onClick={() => setCuantos(c => c + 20)}>Ver más entrenos</button>}
        </div>
      </div>
    </Pantalla>
  )
}
