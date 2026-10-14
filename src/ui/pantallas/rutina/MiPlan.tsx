// RUT-01 · Mi plan
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { ejercicio } from '../../../catalogo/catalogo'
import { DIAS_CORTOS, deISO, diaSemana, diasEntre, hoyISO, numeroSemana } from '../../../dominio/fechas'
import { cx, estilo, Ico, Pantalla, useUnaVez, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAjustes, useRutina, useSesionEnCurso } from '../../datos'
import { useAviso } from '../../aviso'
import { CabRutina, filas, minutos, nombreDia, seriesPorGrupo, seriesTxt } from './comun'
import { abrirEntreno, iniciarEntreno } from '../entreno/iniciar'

export function MiPlan() {
  const nav = useNav()
  const aviso = useAviso()
  const r = useRutina()
  const a = useAjustes()
  const enCurso = useSesionEnCurso()
  const hoy = hoyISO()
  const ds = diaSemana(deISO(hoy))
  const crumb = a.inicio ? `Semana ${numeroSemana(a.inicio, hoy)}` : undefined
  // Entrenos de calibración que cuentan: los de esta rutina y no libres (igual que en el fin del entreno).
  const sesiones = useLiveQuery(async () => (r?.id == null ? 0 : (await db.sesiones.where('estado').equals('hecha').toArray()).filter(s => s.rutinaId === r.id && s.letra !== 'L').length), [r?.id]) ?? 0
  const unaVez = useUnaVez()

  if (r === undefined) return <Pantalla><CabRutina actual="rut" crumb={crumb} /></Pantalla>
  if (r === null) return (
    <Pantalla>
      <CabRutina actual="rut" crumb={crumb} />
      <div className="pg"><div className="sec">
        <Vacio icono="clipboard-text" titulo="Aún no tienes rutina" texto="La creamos con tus días, tu tiempo y tu gimnasio. Tarda 10 segundos." accion={<><Ico n="magic-wand" b />Crear mi rutina</>} onAccion={() => nav.ir('rut-gen')} />
      </div></div>
    </Pantalla>
  )

  const fijos = r.dias.filter(d => !d.opcional)
  const opc = r.dias.filter(d => d.opcional)
  const grupos = seriesPorGrupo(r)
  const semanas = Math.max(1, Math.ceil(diasEntre(r.creada.slice(0, 10), hoy) / 7))
  // Doble toque: dos entrenos libres en curso. Y «restaurar» no abría nada si la app se había cerrado a mitad.
  const libre = unaVez(async () => {
    if (enCurso) { aviso('Ya tienes un entreno en curso'); abrirEntreno(nav); return }
    await iniciarEntreno({ libre: true })
    nav.completa('entreno')
  })
  const faltan = Math.max(0, fijos.length - sesiones)

  return (
    <Pantalla>
      <CabRutina actual="rut" crumb={crumb} />
      <div className="pg">
        <div className="sec">
          <div className="spec-box">
            <div className="spec-h mt8">
              <h2 className="h3">{r.estructura}</h2>
              {r.calibracion ? <span className="tag warn"><Ico n="gauge" b />Calibración</span> : <span className="tag ok"><Ico n="check" b />Definitiva</span>}
            </div>
            <div className="spec c2">
              <p><span>Días</span><b>{fijos.map(d => (d.dia != null ? DIAS_CORTOS[d.dia] : '?')).join(' · ')}</b></p>
              <p><span>Extra</span><b>{opc[0]?.dia != null ? `${DIAS_CORTOS[opc[0].dia]} (opc.)` : '—'}</b></p>
              <p><span>Duración</span><b>~{fijos[0] ? Math.max(...fijos.map(d => minutos(d))) : 0} min</b></p>
              <p><span>Corta</span><b>~{fijos[0] ? Math.max(...fijos.map(d => minutos(d, true))) : 0} min</b></p>
              <p><span>Series</span><b>{fijos.reduce((t, d) => t + d.bloques.reduce((a2, b) => a2 + b.series, 0), 0)}/sem</b></p>
              <p><span>En uso</span><b>{semanas} semana{semanas === 1 ? '' : 's'}</b></p>
            </div>
          </div>
          {r.calibracion && <p className="note warn mt8"><Ico n="gauge" /><span><b>Semana de calibración:</b> pesos cómodos. {faltan > 0 ? <>Después de {faltan} entreno{faltan === 1 ? '' : 's'} más te propongo</> : <>Al guardar el próximo entreno te propongo</>} la rutina definitiva con tus tiempos reales.</span></p>}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Días</h2><span className="lbl">Toca uno para verlo</span></div>
          {r.dias.map((d, i) => {
            const esHoy = d.dia === ds
            if (esHoy && !d.opcional) return (
              <div key={d.letra} className={cx('dayc card hot', i && 'mt8')}>
                <button className="dayc-h" onClick={() => nav.ir('rut-dia', { letra: d.letra })}>
                  <span className="dl">{d.letra}</span>
                  <span className="tx"><b>{d.nombre}</b><small>{nombreDia(d)} · ~{minutos(d)} min · corta ~{minutos(d, true)}</small></span>
                  <span className="tag go">Hoy</span>
                </button>
                <div className="pl-list">
                  {filas(d.bloques).map(f => Array.isArray(f) ? (
                    <div key={f[0].uid} className="ssb">
                      <span className="ss-l">Superserie</span>
                      {f.map((b, k) => <p key={b.uid} className={cx('pl', b.fueraEnCorta && 'cut')}><span>{d.letra}{k + 1} {ejercicio(b.ejercicio)?.nombre}</span><b>{seriesTxt(b)}</b></p>)}
                    </div>
                  ) : <p key={f.uid} className={cx('pl', f.fueraEnCorta && 'cut')}><span>{ejercicio(f.ejercicio)?.nombre}</span><b>{seriesTxt(f)}</b></p>)}
                </div>
                <div className="pd"><button className="btn" onClick={() => nav.hoja('sheet-ses1', { letra: d.letra })}><Ico n="play" b />Empezar rutina</button></div>
              </div>
            )
            return (
              <button key={d.letra} className={cx('dayc card', i && 'mt8', d.opcional && 'optd')} onClick={() => nav.ir('rut-dia', { letra: d.letra })}>
                <span className="dayc-h">
                  <span className="dl">{d.letra}</span>
                  <span className="tx"><b>{d.opcional ? `${nombreDia(d)} · opcional` : d.nombre}</b><small>{d.opcional ? `${d.nombre} · ~${minutos(d)} min` : `${nombreDia(d)} · ~${minutos(d)} min · corta ~${minutos(d, true)}`}</small></span>
                  <Ico n="caret-right" className="car" />
                </span>
                {!d.opcional && (
                  <span className="pl-sum">
                    {filas(d.bloques).map((f, k) => (
                      <span key={k}>{k > 0 && ' · '}{Array.isArray(f) ? <><em>Superserie</em> {ejercicio(f[0].ejercicio)?.nombre} + {ejercicio(f[1].ejercicio)?.nombre}</> : ejercicio(f.ejercicio)?.nombre}</span>
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="sec">
          <div className="list">
            <div className="it">
              <span className="ico"><Ico n="calendar-blank" /></span>
              <span className="tx"><b>Empezar otro día</b></span>
              <span className="chips mini">{r.dias.map(d => <button key={d.letra} className="chip" onClick={() => nav.hoja('sheet-ses1', { letra: d.letra })}>{d.letra}</button>)}</span>
            </div>
            <button className="it" onClick={() => void libre()}><span className="ico"><Ico n="lightning" /></span><span className="tx"><b>Entreno libre</b><small>Sin plan, añadiendo sobre la marcha</small></span><Ico n="caret-right" className="car" /></button>
            <button className="it" onClick={() => nav.ir('rut-gen')}><span className="ico"><Ico n="magic-wand" /></span><span className="tx"><b>Generar rutina</b><small>Con tus días, tiempo y gimnasio</small></span><Ico n="caret-right" className="car" /></button>
            <button className="it" onClick={() => nav.ir('rut-edit')}><span className="ico"><Ico n="pencil-simple" /></span><span className="tx"><b>Editar plan</b><small>Orden, series, alternativas, versión corta</small></span><Ico n="caret-right" className="car" /></button>
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Series por grupo muscular</h2><span className="lbl">a la semana</span></div>
          <div className="card pd">
            <div className="hbars">
              {grupos.map(g => (
                <div key={g.n}>
                  <span>{g.n}</span>
                  <span className="bar zone" style={estilo({ '--z1': '50%', '--z2': '80%' })}><i style={estilo({ '--w': `${Math.min(100, (g.v / 20) * 100)}%` })} /></span>
                  <b>{g.v}</b>
                </div>
              ))}
            </div>
            <p className="small muted mt12"><span className="zkey" /> Zona recomendada: 10-16 series por semana</p>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
