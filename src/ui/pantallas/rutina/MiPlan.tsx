// RUT-01 · Mi plan
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { ejercicio } from '../../../catalogo/catalogo'
import { deISO, diaSemana, hoyISO, numeroSemana } from '../../../dominio/fechas'
import { cx, Ico, Pantalla, useUnaVez, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAjustes, useRutina, useSesionEnCurso } from '../../datos'
import { useAviso } from '../../aviso'
import { abrevDia, CabRutina, capital, filas, listaDias, minutos, nombreDia, SS_EXPLICA, seriesTxt, tituloDia } from './comun'
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
  // Doble toque: dos entrenos libres en curso. Y «restaurar» no abría nada si la app se había cerrado a mitad.
  const libre = unaVez(async () => {
    if (enCurso) { aviso('Ya tienes un entreno en curso'); abrirEntreno(nav); return }
    await iniciarEntreno({ libre: true })
    nav.completa('entreno')
  })
  const faltan = Math.max(0, fijos.length - sesiones)
  const conDia = fijos.filter(d => d.dia != null).map(d => d.dia!)
  // «Superserie» se explica la primera vez que sale en la pantalla.
  let ssVista = false
  const ss = () => { const t = ssVista ? '' : ` · ${SS_EXPLICA}`; ssVista = true; return t }

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
            <div className="spec">
              <p><span>Días</span><b className="ux-rut-wrap">{conDia.length ? capital(listaDias(conDia)) : `${fijos.length} a la semana`}</b></p>
              {opc[0]?.dia != null && <p><span>Día extra</span><b>{nombreDia(opc[0])}, si te apetece</b></p>}
              <p><span>Duración</span><b>~{fijos[0] ? Math.max(...fijos.map(d => minutos(d))) : 0} min</b></p>
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
                  <span className={cx('dl', d.dia != null && 'ux-rut-dl')}>{abrevDia(d)}</span>
                  <span className="tx"><b>{tituloDia(d)}</b><small>{d.nombre} · ~{minutos(d)} min · con prisa ~{minutos(d, true)}</small></span>
                  <span className="tag go">Hoy</span>
                </button>
                <div className="pl-list">
                  {filas(d.bloques).map(f => Array.isArray(f) ? (
                    <div key={f[0].uid} className="ssb">
                      <span className="ss-l">Superserie{ss()}</span>
                      {f.map(b => <p key={b.uid} className={cx('pl', b.fueraEnCorta && 'cut')}><span>{ejercicio(b.ejercicio)?.nombre}</span><b>{seriesTxt(b)}</b></p>)}
                    </div>
                  ) : <p key={f.uid} className={cx('pl', f.fueraEnCorta && 'cut')}><span>{ejercicio(f.ejercicio)?.nombre}</span><b>{seriesTxt(f)}</b></p>)}
                  <p className="small muted ux-rut-leyenda">«3 × 6-10» = 3 series de 6 a 10 repeticiones.</p>
                </div>
                <div className="pd"><button className="btn" onClick={() => nav.hoja('sheet-ses1', { letra: d.letra })}><Ico n="play" b />Empezar rutina</button></div>
              </div>
            )
            return (
              <button key={d.letra} className={cx('dayc card', i && 'mt8', d.opcional && 'optd')} onClick={() => nav.ir('rut-dia', { letra: d.letra })}>
                <span className="dayc-h">
                  <span className={cx('dl', d.dia != null && 'ux-rut-dl')}>{abrevDia(d)}</span>
                  <span className="tx"><b>{d.opcional ? `${tituloDia(d)} · opcional` : tituloDia(d)}</b><small>{d.opcional ? `${d.nombre} · ~${minutos(d)} min` : `${d.dia != null ? `${d.nombre} · ` : `Día ${d.letra} · `}~${minutos(d)} min · con prisa ~${minutos(d, true)}`}</small></span>
                  <Ico n="caret-right" className="car" />
                </span>
                {!d.opcional && (
                  <span className="pl-sum">
                    {filas(d.bloques).map((f, k) => (
                      <span key={k}>{k > 0 && ' · '}{Array.isArray(f) ? <><em>Superserie{ss()}</em> {ejercicio(f[0].ejercicio)?.nombre} + {ejercicio(f[1].ejercicio)?.nombre}</> : ejercicio(f.ejercicio)?.nombre}</span>
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
              <span className="tx">
                <b>Empezar otro día</b>
                <small>Si hoy prefieres hacer otro entreno</small>
                <span className="chips ux-rut-otro">{r.dias.map(d => <button key={d.letra} className="chip" onClick={() => nav.hoja('sheet-ses1', { letra: d.letra })}>{tituloDia(d)}</button>)}</span>
              </span>
            </div>
            <button className="it" onClick={() => void libre()}><span className="ico"><Ico n="lightning" /></span><span className="tx"><b>Entreno libre</b><small>Sin plan: añades ejercicios sobre la marcha</small></span><Ico n="caret-right" className="car" /></button>
            <button className="it" onClick={() => nav.ir('rut-edit')}><span className="ico"><Ico n="pencil-simple" /></span><span className="tx"><b>Editar plan</b><small>Cambiar ejercicios o series, o rehacer la rutina</small></span><Ico n="caret-right" className="car" /></button>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
