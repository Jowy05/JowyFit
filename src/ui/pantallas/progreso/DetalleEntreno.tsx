// PRO-03 · Detalle de un entreno pasado
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { EjercicioSesion } from '../../../datos/tipos'
import { ejercicio, nombreEjercicio } from '../../../catalogo/catalogo'
import { num } from '../../../dominio/calculos'
import { fechaLarga, horaDe } from '../../../dominio/fechas'
import { resumen } from '../../../dominio/sesion'
import { Cab, cx, Ico, Pantalla, Th, Vacio } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { capital, textoSerie } from './comun'

const DESCANSOS = { cortos: 'Cortos', bien: 'Bien', largos: 'Largos' } as const

export function DetalleEntreno({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const id = Number(ruta.d?.id)
  const s = useLiveQuery(async () => (await db.sesiones.get(id)) ?? null, [id])
  const gym = useLiveQuery(async () => (s?.gimnasioId != null ? (await db.gimnasios.get(s.gimnasioId)) ?? null : null), [s?.gimnasioId])

  if (s === undefined) return <Pantalla><Cab atras crumb="Historial" /><div className="cargando">…</div></Pantalla>
  if (s === null) return (
    <Pantalla>
      <Cab atras crumb="Historial" titulo="Entreno" />
      <div className="pg"><Vacio icono="barbell" titulo="Este entreno ya no existe" accion="Volver" onAccion={nav.atras} /></div>
    </Pantalla>
  )

  const r = resumen(s)
  const recs = s.ejercicios.reduce((t, e) => t + e.series.filter(x => x.record && x.hecha).length, 0)
  const resp = s.respuestas
  const notasSeries = s.ejercicios.flatMap(e => e.series.filter(x => x.nota).map(x => ({ e, x })))
  const borrar = () => nav.hoja('sheet-confirmar', {
    titulo: '¿Borrar este entreno?', texto: `${s.nombre} del ${fechaLarga(s.fecha)}. Se perderán sus series y récords.`,
    si: 'Borrar', peligro: true, accion: 'borrar-sesion', id: s.id,
  })

  return (
    <Pantalla>
      <Cab atras crumb="Historial" titulo={capital(fechaLarga(s.fecha))} sub={`${s.nombre}${gym ? ` · ${gym.nombre}` : ''}`}
        derecha={<button className="ib" aria-label="Borrar entreno" onClick={borrar}><Ico n="trash" /></button>} />
      <div className="pg">
        <div className="spec-box"><div className="spec c2">
          <p><span>Duración</span><b>{resp?.minutosReales ?? Math.round(r.segundos / 60)} min</b></p>
          <p><span>Horario</span><b>{horaDe(s.inicio)}{s.fin ? ` → ${horaDe(s.fin)}` : ''}</b></p>
          <p><span>Series</span><b>{r.series}</b></p>
          <p><span>Kilos movidos</span><b>{num(r.volumen, 0)} kg</b></p>
          {s.version === 'corta' && <p><span>Versión</span><b>Corta</b></p>}
          {recs > 0 && <p><span>Récords</span><b className="goldc">{recs}</b></p>}
        </div></div>

        {s.ejercicios.map((e, i) => <Ejercicio key={`${e.uid}-${i}`} e={e} primero={i === 0} companero={e.superserie ? s.ejercicios.find(o => o.uid === e.superserie) : undefined} />)}

        {notasSeries.map(({ e, x }, i) => (
          <p key={i} className="mynote"><Ico n="note-pencil" />«{x.nota}» · {nombreEjercicio(e.ejercicio)}, serie {x.n}</p>
        ))}
        {resp?.nota && <p className="mynote mt12"><Ico n="note-pencil" />«{resp.nota}»</p>}

        {resp && (resp.descansos || resp.molestia || resp.ocupado) && (
          <div className="sec">
            <div className="sec-h"><h2>Al terminar</h2></div>
            <div className="spec-box"><div className="spec">
              {resp.descansos && <p><span>Descansos</span><b>{DESCANSOS[resp.descansos]}</b></p>}
              {resp.molestia && <p><span>Molestia</span><b className="warnc">{resp.molestia}</b></p>}
              {resp.ocupado && <p><span>Ocupado</span><b>{resp.ocupado}</b></p>}
            </div></div>
          </div>
        )}

        <div className="btns mt16">
          <button className="btn bad sm" onClick={borrar}><Ico n="trash" />Borrar entreno</button>
        </div>
      </div>
    </Pantalla>
  )
}

function Ejercicio({ e, primero, companero }: { e: EjercicioSesion; primero: boolean; companero?: EjercicioSesion }) {
  const hechas = e.series.filter(x => x.hecha)
  const record = hechas.some(x => x.record)
  const sustituido = e.ejercicio !== e.planificado
  let trabajo = 0
  return (
    <div className={cx('xd card', primero ? 'mt12' : 'mt8')}>
      <div className="xd-h">
        <Th ej={ejercicio(e.ejercicio)} size="s" />
        <b>{nombreEjercicio(e.ejercicio)}</b>
        {record && <span className="tag gold"><Ico n="trophy" b />Récord</span>}
        {sustituido && <span className="tag blue"><Ico n="swap" b />Cambio</span>}
        {e.estado === 'saltado' && !hechas.length && <span className="tag warn">Saltado</span>}
      </div>
      {sustituido && <p className="small muted xd-n">Sustituye a {nombreEjercicio(e.planificado)}{e.motivo === 'ocupado' ? ' · estaba ocupado' : ''}</p>}
      {companero && <p className="small muted xd-n"><Ico n="link" /> Dos seguidos, con {nombreEjercicio(companero.ejercicio)}</p>}
      {hechas.length > 0 ? (
        <table className="tbl">
          <thead><tr><th>Serie</th><th>{e.registro === 'tiempo' ? 'Tiempo' : e.registro === 'corporal' ? 'Reps' : 'kg × reps'}</th><th>Esfuerzo</th></tr></thead>
          <tbody>
            {hechas.map((x, k) => {
              if (!x.calentamiento) trabajo++
              return (
                <tr key={k} className={x.calentamiento ? 'muted' : undefined}>
                  <td>{x.calentamiento ? 'Calent.' : trabajo}</td>
                  <td>{textoSerie(x, e.registro)}{x.record && <> <Ico n="trophy" b className="goldc" /></>}</td>
                  <td>{x.rpe ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : <p className="small muted xd-n">{e.estado === 'saltado' ? 'No se hizo.' : 'Sin series apuntadas.'}</p>}
    </div>
  )
}
