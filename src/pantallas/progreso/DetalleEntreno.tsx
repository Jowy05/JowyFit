// PRO-03 · Detalle de un entreno pasado. Una serie mal apuntada se corrige tocándola (la progresión parte de ella).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerGimnasio, leerSesion } from '../../datos/consultas'
import type { EjercicioSesion, Sesion } from '../../datos/tipos'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { num, capital, textoSerie } from '../../dominio/formato'
import { fechaLarga, horaDe } from '../../dominio/fechas'
import { resumen } from '../../dominio/sesion'
import { Cab, cx, Ico, Pantalla, Th, Vacio } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { FormCorregir } from '../entreno/Corregir'
import { t, tc, tk } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'

const DESCANSOS = { cortos: tk('Cortos'), bien: tk('Bien'), largos: tk('Largos') } as const

export function DetalleEntreno({ ruta }: { ruta: Ruta<'detalle-entreno'> }) {
  const nav = useNav()
  const { id } = ruta.d
  const s = useLiveQuery(async () => (await leerSesion(id)) ?? null, [id])
  const gym = useLiveQuery(async () => (s?.gimnasioId != null ? (await leerGimnasio(s.gimnasioId)) ?? null : null), [s?.gimnasioId])
  // Serie que se está corrigiendo: ejercicio (posición) y serie (posición en sus series).
  const [corr, setCorr] = useState<{ idx: number; k: number } | null>(null)

  if (s === undefined) return <Pantalla><Cab atras crumb={t('Historial')} /><div className="cargando">…</div></Pantalla>
  if (s === null) return (
    <Pantalla>
      <Cab atras crumb={t('Historial')} titulo={t('Entreno')} />
      <div className="pg"><Vacio icono="barbell" titulo={t('Este entreno ya no existe')} accion={t('Volver')} onAccion={nav.atras} /></div>
    </Pantalla>
  )

  const r = resumen(s)
  const recs = s.ejercicios.reduce((suma, e) => suma + e.series.filter(x => x.record && x.hecha).length, 0)
  const resp = s.respuestas
  const notasSeries = s.ejercicios.flatMap(e => e.series.filter(x => x.nota).map(x => ({ e, x })))
  const borrar = () => nav.hoja('hoja-confirmar', {
    titulo: t('¿Borrar este entreno?'), texto: t('{nombre} del {fecha}. Se perderán sus series y récords.', { nombre: nombreEntreno(s), fecha: fechaLarga(s.fecha) }),
    si: t('Borrar'), peligro: true, accion: 'borrar-sesion', id: s.id,
  })

  return (
    <Pantalla>
      <Cab atras crumb={t('Historial')} titulo={capital(fechaLarga(s.fecha))} sub={`${nombreEntreno(s)}${gym ? ` · ${gym.nombre}` : ''}`}
        derecha={<button className="ib" aria-label={t('Borrar entreno')} onClick={borrar}><Ico n="trash" /></button>} />
      <div className="pg">
        <div className="spec-box"><div className="spec c2">
          <p><span>{t('Duración')}</span><b>{resp?.minutosReales ?? Math.round(r.segundos / 60)} min</b></p>
          <p><span>{t('Horario')}</span><b>{horaDe(s.inicio)}{s.fin ? ` → ${horaDe(s.fin)}` : ''}</b></p>
          <p><span>{t('Series')}</span><b>{r.series}</b></p>
          <p><span>{t('Kilos movidos')}</span><b>{num(r.volumen, 0)} kg</b></p>
          {s.version === 'corta' && <p><span>{t('Versión')}</span><b>{t('Corta')}</b></p>}
          {recs > 0 && <p><span>{t('Récords')}</span><b className="goldc">{recs}</b></p>}
        </div></div>

        {s.ejercicios.some(e => e.series.some(x => x.hecha)) && <p className="small muted mt8"><Ico n="pencil-simple" /> {t('Toca una serie para corregirla.')}</p>}
        {s.ejercicios.map((e, i) => <Ejercicio key={`${e.uid}-${i}`} s={s} idx={i} e={e} primero={i === 0} companero={e.superserie ? s.ejercicios.find(o => o.uid === e.superserie) : undefined}
          corrigiendo={corr?.idx === i ? corr.k : null} onCorregir={k => setCorr(k == null ? null : { idx: i, k })} />)}

        {notasSeries.map(({ e, x }, i) => (
          <p key={i} className="mynote"><Ico n="note-pencil" />«{x.nota}» · {t('{ejercicio}, serie {n}', { ejercicio: nombreEjercicio(e.ejercicio), n: x.n })}</p>
        ))}
        {resp?.nota && <p className="mynote mt12"><Ico n="note-pencil" />«{resp.nota}»</p>}

        {resp && (resp.descansos || resp.molestia || resp.ocupado) && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Al terminar')}</h2></div>
            <div className="spec-box"><div className="spec">
              {resp.descansos && <p><span>{t('Descansos')}</span><b>{t(DESCANSOS[resp.descansos])}</b></p>}
              {resp.molestia && <p><span>{t('Molestia')}</span><b className="warnc">{resp.molestia}</b></p>}
              {resp.ocupado && <p><span>{tc('máquina', 'Ocupado')}</span><b>{resp.ocupado}</b></p>}
            </div></div>
          </div>
        )}

        <div className="btns mt16">
          <button className="btn bad sm" onClick={borrar}><Ico n="trash" />{t('Borrar entreno')}</button>
        </div>
      </div>
    </Pantalla>
  )
}

function Ejercicio({ s, idx, e, primero, companero, corrigiendo, onCorregir }: { s: Sesion; idx: number; e: EjercicioSesion; primero: boolean; companero?: EjercicioSesion; corrigiendo: number | null; onCorregir: (k: number | null) => void }) {
  const hechas = e.series.filter(x => x.hecha)
  const record = hechas.some(x => x.record)
  const sustituido = e.ejercicio !== e.planificado
  let trabajo = 0
  return (
    <div className={cx('xd card', primero ? 'mt12' : 'mt8')}>
      <div className="xd-h">
        <Th ej={ejercicio(e.ejercicio)} size="s" />
        <b>{nombreEjercicio(e.ejercicio)}</b>
        {record && <span className="tag gold"><Ico n="trophy" b />{t('Récord')}</span>}
        {sustituido && <span className="tag blue"><Ico n="swap" b />{t('Cambio')}</span>}
        {e.estado === 'saltado' && !hechas.length && <span className="tag warn">{t('Saltado')}</span>}
      </div>
      {sustituido && <p className="small muted xd-n">{t('Sustituye a {ejercicio}', { ejercicio: nombreEjercicio(e.planificado) })}{e.motivo === 'ocupado' ? ` · ${t('estaba ocupado')}` : ''}</p>}
      {companero && <p className="small muted xd-n"><Ico n="link" /> {t('Dos seguidos, con {ejercicio}', { ejercicio: nombreEjercicio(companero.ejercicio) })}</p>}
      {hechas.length > 0 ? (
        <table className="tbl">
          <thead><tr><th>{t('Serie')}</th><th>{e.registro === 'tiempo' ? t('Tiempo') : e.registro === 'corporal' ? t('Reps') : t('kg × reps')}</th><th>{t('Esfuerzo')}</th></tr></thead>
          <tbody>
            {hechas.map((x, k) => {
              if (!x.calentamiento) trabajo++
              const pos = e.series.indexOf(x)
              return (
                <tr key={k} className={cx(x.calentamiento && 'muted', 'ux-det-serie')} role="button" tabIndex={0} aria-label={x.calentamiento ? t('Corregir serie de calentamiento') : t('Corregir serie {n}', { n: trabajo })}
                  onClick={() => onCorregir(corrigiendo === pos ? null : pos)}>
                  <td>{x.calentamiento ? t('Calent.') : trabajo}</td>
                  <td>{textoSerie(x, e.registro, 'tabla')}{x.record && <> <Ico n="trophy" b className="goldc" /></>}</td>
                  <td>{x.rpe ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : <p className="small muted xd-n">{e.estado === 'saltado' ? t('No se hizo.') : t('Sin series apuntadas.')}</p>}
      {corrigiendo != null && <FormCorregir s={s} idx={idx} k={corrigiendo} className="mt8" onCerrar={() => onCorregir(null)} />}
    </div>
  )
}
