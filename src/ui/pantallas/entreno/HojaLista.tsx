// SES-05 · Lista de la sesión
import { db } from '../../../datos/db'
import type { Sesion } from '../../../datos/tipos'
import { nombreEjercicio } from '../../../catalogo/catalogo'
import { irA, mover, serieActual } from '../../../dominio/sesion'
import { kg } from '../../../dominio/calculos'
import { cx, Hoja, Ico } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useSesionEnCurso } from '../../datos'

export function HojaLista() {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  if (s === undefined) return <Hoja titulo="Lista de la sesión"><p className="muted">Cargando…</p></Hoja>
  if (!s) return <Hoja titulo="Lista de la sesión"><p className="muted">No hay entreno en curso.</p></Hoja>
  const guardar = (x: Sesion) => db.sesiones.put(x)
  return (
    <Hoja titulo="Lista de la sesión" sub="Toca para ir · flechas para reordenar" className="tall">
      <div className="list">
        {s.ejercicios.map((e, i) => {
          const nombre = nombreEjercicio(e.ejercicio)
          const hechas = e.series.filter(x => x.hecha && !x.calentamiento)
          const total = e.series.filter(x => !x.calentamiento).length
          const sust = e.ejercicio !== e.planificado
          const estado = e.estado === 'hecho' ? 'done' : e.estado === 'curso' ? 'cur' : e.estado === 'saltado' ? 'skip' : ''
          return (
            <div key={e.uid} className={cx('it sl', estado)}>
              {e.estado === 'pendiente' ? (
                <span className="grip" style={{ flexDirection: 'column', display: 'flex' }}>
                  <button aria-label="Subir" onClick={() => i > 0 && void guardar(mover(s, i, i - 1))}><Ico n="caret-up" b /></button>
                  <button aria-label="Bajar" onClick={() => i < s.ejercicios.length - 1 && void guardar(mover(s, i, i + 1))}><Ico n="caret-down" b /></button>
                </span>
              ) : <span className="grip" />}
              <span className={cx('st', sust && e.estado !== 'hecho' && 'sub')}><Ico n={e.estado === 'hecho' ? 'check' : e.estado === 'curso' ? 'play' : e.estado === 'saltado' ? 'skip-forward' : sust ? 'swap' : 'circle'} b={e.estado !== 'pendiente'} /></span>
              <button className="tx" style={{ textAlign: 'left' }} onClick={async () => {
                if (e.estado === 'saltado') { const x = structuredClone(s); x.ejercicios[i]!.estado = 'pendiente'; await guardar(x); aviso('Recuperado'); return }
                if (e.estado === 'pendiente') await guardar(irA(s, i))
                nav.hoja(null)
              }}>
                <b>{e.superserie ? `${nombre} (superserie)` : nombre}</b>
                <small className="mono">
                  {e.estado === 'saltado' ? 'Toca para recuperarlo' : sust ? `Sustituye a ${nombreEjercicio(e.planificado)}`: e.estado === 'hecho' ? `${hechas.length}/${total}${hechas[0]?.peso != null ? ` · ${kg(hechas[0].peso)} kg × ${hechas[0].reps}` : ''}` : e.estado === 'curso' ? `Serie ${Math.max(1, serieActual(e) + 1 - e.series.filter(x => x.calentamiento).length)} de ${total}` : `${total} × ${e.repsMin}-${e.repsMax}`}
                </small>
              </button>
              <span className={cx('tag', e.estado === 'hecho' && 'ok', e.estado === 'curso' && 'go', sust && e.estado === 'pendiente' && 'blue')}>
                {{ hecho: 'Hecho', curso: 'En curso', saltado: 'Saltado', pendiente: sust ? 'Sustituido' : 'Pendiente' }[e.estado]}
              </span>
            </div>
          )
        })}
      </div>
      <div className="list mt12">
        <button className="it" onClick={() => nav.hoja('sheet-elegir', { modo: 'sesion-anadir' })}><span className="ico"><Ico n="plus" /></span><span className="tx"><b>Añadir ejercicio</b></span></button>
        <button className="it" onClick={() => { nav.hoja(null); nav.minimizar() }}><span className="ico"><Ico n="sign-out" /></span><span className="tx"><b>Salir sin terminar</b><small>Sigue en la mini barra</small></span></button>
        <button className="it danger" onClick={() => nav.hoja('sheet-confirmar', { titulo: '¿Descartar este entreno?', texto: 'Se borra lo apuntado hoy.', si: 'Descartar', peligro: true, accion: 'cancelar-entreno', id: s.id })}><span className="ico"><Ico n="trash" /></span><span className="tx"><b>Descartar entreno</b></span></button>
      </div>
      <button className="btn xl mt16" onClick={() => { nav.hoja(null); nav.completa('ses-fin', { id: s.id }) }}><Ico n="flag-checkered" b />Terminar entreno</button>
    </Hoja>
  )
}
