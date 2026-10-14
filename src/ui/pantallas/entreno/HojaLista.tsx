// SES-05 · Lista de la sesión
// Solo se mira: sin «Pendiente» repetido, las flechas de orden detrás de «Cambiar orden», y «Terminar entreno»
// siempre a la vista abajo (es el único sitio para terminar), con «Salir sin terminar» y «Descartar» en pequeño.
import { Fragment, useState } from 'react'
import { db } from '../../../datos/db'
import type { Sesion } from '../../../datos/tipos'
import { nombreEjercicio } from '../../../catalogo/catalogo'
import { irA, mover, serieActual } from '../../../dominio/sesion'
import { kg } from '../../../dominio/calculos'
import { cx, Hoja, Ico } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useSesionEnCurso } from '../../datos'
import { FormCorregir, valorSerie } from './Corregir'

export function HojaLista() {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const [ordenar, setOrdenar] = useState(false)
  // Un ejercicio ya terminado se abre para ver sus series y corregir una mal apuntada.
  const [abierto, setAbierto] = useState<string | null>(null)
  const [corr, setCorr] = useState<{ uid: string; k: number } | null>(null)
  if (s === undefined) return <Hoja titulo="Lista de la sesión"><p className="muted">Cargando…</p></Hoja>
  if (!s) return <Hoja titulo="Lista de la sesión"><p className="muted">No hay entreno en curso.</p></Hoja>
  const guardar = (x: Sesion) => db.sesiones.put(x)
  const pendientes = s.ejercicios.filter(e => e.estado === 'pendiente').length
  return (
    <Hoja titulo="Lista de la sesión" sub={ordenar ? 'Sube o baja con las flechas' : 'Toca un ejercicio para ir a él'} className="tall">
      {pendientes > 1 && (
        <div className="ux-lista-orden">
          <button className="lnk" onClick={() => setOrdenar(o => !o)}>{ordenar ? <><Ico n="check" b />Listo</> : <><Ico n="arrows-down-up" />Cambiar orden</>}</button>
        </div>
      )}
      <div className="list">
        {s.ejercicios.map((e, i) => {
          const nombre = nombreEjercicio(e.ejercicio)
          const hechas = e.series.filter(x => x.hecha && !x.calentamiento)
          const total = e.series.filter(x => !x.calentamiento).length
          const sust = e.ejercicio !== e.planificado
          const estado = e.estado === 'hecho' ? 'done' : e.estado === 'curso' ? 'cur' : e.estado === 'saltado' ? 'skip' : ''
          // Solo se marca lo que no es «lo normal»: en curso, hecho o saltado. «Pendiente» sobraba (salía en casi todas).
          const tag = { hecho: 'Hecho', curso: 'En curso', saltado: 'Saltado', pendiente: '' }[e.estado]
          const verSeries = e.estado === 'hecho' && abierto === e.uid
          return (
            <Fragment key={e.uid}>
            <div className={cx('it sl', estado)}>
              {ordenar && (e.estado === 'pendiente' ? (
                <span className="grip" style={{ flexDirection: 'column', display: 'flex' }}>
                  <button aria-label="Subir" onClick={() => i > 0 && void guardar(mover(s, i, i - 1))}><Ico n="caret-up" b /></button>
                  <button aria-label="Bajar" onClick={() => i < s.ejercicios.length - 1 && void guardar(mover(s, i, i + 1))}><Ico n="caret-down" b /></button>
                </span>
              ) : <span className="grip" />)}
              <span className={cx('st', sust && e.estado !== 'hecho' && 'sub')}><Ico n={e.estado === 'hecho' ? 'check' : e.estado === 'curso' ? 'play' : e.estado === 'saltado' ? 'skip-forward' : sust ? 'swap' : 'circle'} b={e.estado !== 'pendiente'} /></span>
              <button className="tx" style={{ textAlign: 'left' }} onClick={async () => {
                if (e.estado === 'saltado') { const x = structuredClone(s); x.ejercicios[i]!.estado = 'pendiente'; await guardar(x); aviso('Recuperado'); return }
                if (e.estado === 'hecho') { setAbierto(verSeries ? null : e.uid); setCorr(null); return }
                if (e.estado === 'pendiente') await guardar(irA(s, i))
                nav.hoja(null)
              }}>
                <b>{e.superserie ? `${nombre} (dos seguidos)` : nombre}</b>
                <small className="mono">
                  {e.estado === 'saltado' ? 'Toca para recuperarlo' : sust ? `En vez de ${nombreEjercicio(e.planificado)}` : e.estado === 'hecho' ? `${hechas.length}/${total}${hechas[0]?.peso != null ? ` · ${kg(hechas[0].peso)} kg × ${hechas[0].reps}` : ''}` : e.estado === 'curso' ? `Serie ${Math.max(1, serieActual(e) + 1 - e.series.filter(x => x.calentamiento).length)} de ${total}` : `${total} × ${e.repsMin}-${e.repsMax}`}
                </small>
              </button>
              {tag && <span className={cx('tag', e.estado === 'hecho' && 'ok', e.estado === 'curso' && 'go')}>{tag}</span>}
              {e.estado === 'hecho' && <Ico n={verSeries ? 'caret-up' : 'caret-down'} className="car" />}
            </div>
            {verSeries && (
              <div className="ux-lista-series">
                {corr?.uid === e.uid && e.series[corr.k]?.hecha
                  ? <FormCorregir key={corr.k} s={s} idx={i} k={corr.k} onCerrar={() => setCorr(null)} />
                  : <>
                    <p className="small muted">Toca una serie para corregirla</p>
                    {e.series.map((x, k) => x.hecha && (
                      <button key={k} className="set done ux-tocable" onClick={() => setCorr({ uid: e.uid, k })} aria-label={`Corregir ${x.calentamiento ? 'el calentamiento' : `la serie ${e.series.filter(y => !y.calentamiento).indexOf(x) + 1}`}: ${valorSerie(x, e)}`}>
                        <span className="sn">{x.calentamiento ? 'C' : e.series.filter(y => !y.calentamiento).indexOf(x) + 1}</span>
                        <span className="sv">{valorSerie(x, e)}</span>
                        <span className="se"><Ico n="pencil-simple" /></span>
                        {x.record ? <Ico n="trophy" b /> : <Ico n="check" b />}
                      </button>
                    ))}
                  </>}
              </div>
            )}
            </Fragment>
          )
        })}
      </div>
      <button className="lnk ux-lista-anadir" onClick={() => nav.hoja('sheet-elegir', { modo: 'sesion-anadir' })}><Ico n="plus" b />Añadir ejercicio</button>
      <div className="ux-lista-pie">
        <button className="btn xl" onClick={() => { nav.hoja(null); nav.completa('ses-fin', { id: s.id }) }}><Ico n="flag-checkered" b />Terminar entreno</button>
        <p className="ux-lista-otras">
          <button className="lnk" onClick={() => { nav.hoja(null); nav.minimizar(); aviso('Sigue abierto: vuelves desde la barra de abajo') }}>Salir sin terminar</button>
          <span aria-hidden="true">·</span>
          <button className="lnk ux-peligro" onClick={() => nav.hoja('sheet-confirmar', { titulo: '¿Descartar este entreno?', texto: 'Se borra lo apuntado hoy.', si: 'Descartar', peligro: true, accion: 'cancelar-entreno', id: s.id })}>Descartar entreno</button>
        </p>
      </div>
    </Hoja>
  )
}
