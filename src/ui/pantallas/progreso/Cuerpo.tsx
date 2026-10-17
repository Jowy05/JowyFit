// PRO-04 · Cuerpo
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Medicion, OrigenMedicion } from '../../../datos/tipos'
import { cinturaAltura, num } from '../../../dominio/calculos'
import { fechaCorta } from '../../../dominio/fechas'
import { grasaPorMedidas, mediasSemanales, pendienteSemanal, serieMedida, ultimoValor, veredictoCinturaAltura, veredictoGrasa, type PuntoFecha } from '../../../dominio/tendencias'
import { Linea } from '../../graficas'
import { Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAjustes, usePerfil } from '../../datos'
import { useAviso } from '../../aviso'
import { guardarAjustes } from '../../../datos/repos'
import { nombreFuente } from '../../../dominio/bascula'
import { pasosDisponibles } from '../../../plataforma'
import { activarBascula } from '../../servicios'
import { CabProgreso, capital, fechaPunto, ICONO_ORIGEN, NOMBRE_ORIGEN, PERIMETROS } from './comun'

const signo = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), d)}`
const aPuntos = (ps: PuntoFecha[], n = 12) => ps.slice(-n).map(p => ({ x: fechaPunto(p.fecha), y: p.valor }))

/** Resumen de una medición para el historial: «79,6 kg · 24,8 %» o «Cintura 94,5 · cuello 39». */
function textoMedicion(m: Medicion, max = 3): string {
  const partes: string[] = []
  if (m.pesoKg != null) partes.push(`${num(m.pesoKg)} kg`)
  if (m.bascula?.grasaPct != null) partes.push(`${num(m.bascula.grasaPct)} %`)
  partes.push(...PERIMETROS.filter(p => m.perimetros?.[p.k] != null).map(p => `${p.corto.toLowerCase()} ${num(m.perimetros![p.k])}`))
  if (!partes.length && m.bascula) partes.push('datos de báscula')
  const mas = partes.length - max
  return capital(partes.slice(0, max).join(' · ')) + (mas > 0 ? ` +${mas}` : '')
}

export function Cuerpo() {
  const nav = useNav()
  const perfil = usePerfil()
  const ms = useLiveQuery(() => db.mediciones.orderBy('fecha').toArray(), [])
  const metaCintura = useLiveQuery(async () => (await db.metas.where('tipo').equals('cintura').toArray()).find(m => !m.hecha) ?? null, [])
  const [cuantas, setCuantas] = useState(15)
  const ajustes = useAjustes()
  const aviso = useAviso()
  // En Android con Health Connect, se ofrece traer el peso y la grasa de la báscula (una vez: «Ahora no» lo esconde).
  const [hayHC, setHayHC] = useState(false)
  useEffect(() => { let vivo = true; void pasosDisponibles().then(v => { if (vivo) setHayHC(v) }); return () => { vivo = false } }, [])
  const ofrecerBascula = hayHC && ajustes.fuenteBascula == null
  const tarjetaBascula = ofrecerBascula && (
    <div className="card pd mt12">
      <p className="row"><span className="ico okb"><Ico n="scales" /></span><span className="tx"><b>¿Tu báscula apunta en Health Connect?</b><small>Si su app (Fitdays, Garmin, Mi Fitness…) escribe allí, el peso y la grasa llegan solos.</small></span></p>
      <div className="btns mt12">
        <button className="btn gry sm" onClick={() => void guardarAjustes({ fuenteBascula: 'manual' })}>Ahora no</button>
        <button className="btn sm" onClick={() => void activarBascula().then(t => aviso(t))}>Conectar</button>
      </div>
    </div>
  )
  const cab = <CabProgreso actual="pro-cuerpo" crumb="Tendencias" />

  if (!ms) return <Pantalla>{cab}</Pantalla>
  if (!ms.length) return (
    <Pantalla>
      {cab}
      <div className="pg"><div className="sec">
        <Vacio icono="ruler" titulo="Aún no hay medidas" texto="Pésate y mide la cintura una o dos veces por semana. La cintura dice más que la báscula."
          accion={<><Ico n="plus" b />Registrar medidas</>} onAccion={() => nav.ir('pro-reg')} />
        {tarjetaBascula}
      </div></div>
    </Pantalla>
  )

  const cintura = serieMedida(ms, m => m.perimetros?.cintura)
  const cUlt = cintura[cintura.length - 1]
  const cPrimera = cintura[0]
  const ratio = cintura.map(p => ({ fecha: p.fecha, valor: Math.round(cinturaAltura(p.valor, perfil.alturaCm) * 1000) / 1000 }))
  const rUlt = ratio[ratio.length - 1]
  const marina = grasaPorMedidas(ms, perfil.sexo, perfil.alturaCm)
  // Báscula: se compara siempre con la misma (la que más datos tenga).
  const conGrasa = ms.filter(m => m.bascula?.grasaPct != null)
  const cuenta = new Map<OrigenMedicion, number>()
  for (const m of conGrasa) cuenta.set(m.origen, (cuenta.get(m.origen) ?? 0) + 1)
  const origenBascula = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const bascula = serieMedida(conGrasa.filter(m => m.origen === origenBascula), m => m.bascula?.grasaPct)
  const pesoSem = mediasSemanales(ms, m => m.pesoKg)
  const pesoUlt = ultimoValor(ms, m => m.pesoKg)
  const pendiente = pendienteSemanal(pesoSem.slice(-8))
  const otras = PERIMETROS.filter(p => p.k !== 'cintura').map(p => ({ ...p, u: ultimoValor(ms, m => m.perimetros?.[p.k]) })).filter(p => p.u)
  const fechaOtras = otras.map(p => p.u!.fecha).sort().pop()
  const historial = [...ms].reverse()
  const vRatio = rUlt ? veredictoCinturaAltura(rUlt.valor) : null
  const grasaUlt = marina.length ? marina[marina.length - 1]!.valor : bascula.length ? bascula[bascula.length - 1]!.valor : null
  const vGrasa = grasaUlt != null ? veredictoGrasa(grasaUlt, perfil.sexo) : null
  const kgGrasa = grasaUlt != null && pesoUlt ? (pesoUlt.valor * grasaUlt) / 100 : null
  // Bajar de peso es lo buscado salvo si el objetivo es ganar fuerza.
  const tonoPeso = pendiente == null || Math.abs(pendiente) < 0.05 ? '' : (pendiente < 0) === (perfil.objetivo !== 'fuerza') ? 'ok' : 'warn'

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        {/* 1 · Peso: lo primero que busca casi todo el mundo. */}
        <div className="card pd">
          <div className="row jb">
            <div><span className="lbl">Peso</span><p className="tot-big mono">{pesoUlt ? num(pesoUlt.valor) : '—'}<small> kg</small></p></div>
            {pendiente != null && (
              <div className="right">
                <span className={`tag ${tonoPeso}`}>{signo(pendiente)} kg/semana</span>
                <p className="small muted mt4">{Math.abs(pendiente) < 0.05 ? 'estable' : pendiente < 0 ? 'bajando' : 'subiendo'}</p>
              </div>
            )}
          </div>
          <div className="mt8">
            {pesoSem.length
              ? <Linea puntos={aPuntos(pesoSem)} vacia="Pésate otra semana y verás aquí la línea." />
              : <p className="small muted">Aún no hay pesajes.</p>}
          </div>
          <p className="small muted">Media de cada semana: el peso de un día suelto engaña.</p>
        </div>

        {/* 2 · Cintura, con su veredicto en palabras. */}
        <div className="card pd mt12">
          <div className="row jb">
            <div><span className="lbl">Cintura</span><p className="tot-big mono">{cUlt ? num(cUlt.valor) : '—'}<small> cm</small></p></div>
            {cUlt && cPrimera && cintura.length > 1 && (
              <div className="right">
                <span className={`tag ${cUlt.valor <= cPrimera.valor ? 'ok' : 'warn'}`}>{signo(cUlt.valor - cPrimera.valor)} cm</span>
                <p className="small muted mt4">desde el {fechaCorta(cPrimera.fecha)}</p>
              </div>
            )}
          </div>
          {rUlt && vRatio && (
            <p className="cuerpo-ver mt8">
              <span className={`tag frase ${vRatio.tono}`}>{capital(vRatio.palabra)}</span>
              <span className="small muted">Cintura/altura {num(rUlt.valor, 2)} · lo saludable, menos de 0,5</span>
            </p>
          )}
          <div className="mt8">
            {cintura.length
              ? <Linea puntos={aPuntos(cintura)} objetivo={metaCintura?.objetivo} etiquetaObjetivo={metaCintura ? `objetivo ${num(metaCintura.objetivo)}` : undefined} vacia="Con 2 mediciones verás aquí la línea." />
              : <p className="small muted">Mide la cintura a la altura del ombligo para ver su tendencia.</p>}
          </div>
          {!metaCintura && cintura.length > 0 && <button className="lnk mt8" onClick={() => nav.hoja('sheet-meta', { tipo: 'cintura' })}><Ico n="flag" /> Ponerte un objetivo de cintura</button>}
        </div>

        {/* 3 · % de grasa, explicado en palabras. */}
        {grasaUlt != null && (
          <div className="card pd mt12">
            <div className="row jb">
              <div><span className="lbl">% de grasa</span><p className="tot-big mono">{num(grasaUlt)}<small> %</small></p></div>
              {vGrasa && <span className={`tag frase ${vGrasa.tono}`}>{capital(vGrasa.palabra)}</span>}
            </div>
            <p className="small mt8">
              {kgGrasa != null ? <>Unos <b>{num(kgGrasa, 0)} kg</b> de tu peso son grasa. </> : null}
              {marina.length ? 'Calculado con tu cintura, tu cuello y tu altura.' : `Lo da tu ${NOMBRE_ORIGEN[origenBascula!].toLowerCase()}.`}
            </p>
          </div>
        )}

        {/* Gráficas que no hacen falta para saber si vas bien, plegadas. */}
        {(ratio.length > 1 || marina.length > 1 || bascula.length > 1) && (
          <details className="fold mt12">
            <summary><Ico n="chart-line-up" className="blue" />Más gráficas <Ico n="caret-down" /></summary>
            <div className="in">
              {ratio.length > 1 && (
                <>
                  <p className="lbl">Cintura/altura <span className="muted">· lo saludable, menos de 0,5</span></p>
                  <div className="mt8"><Linea puntos={aPuntos(ratio)} objetivo={0.5} etiquetaObjetivo="0,5" decimales={2} /></div>
                </>
              )}
              {marina.length > 1 && <div className="mt8"><p className="lbl"><i className="lgl" /> % de grasa por medidas (cintura y cuello)</p><Linea puntos={aPuntos(marina)} /></div>}
              {bascula.length > 1 && <div className="mt8"><p className="lbl"><i className="lgl d" /> % de grasa · {NOMBRE_ORIGEN[origenBascula!]}</p><Linea puntos={aPuntos(bascula)} /></div>}
              {bascula.length > 1 && <p className="small muted">Compara siempre con la misma báscula: cada una mide distinto.</p>}
            </div>
          </details>
        )}

        {otras.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Otras medidas</h2>{fechaOtras && <span className="lbl">{fechaCorta(fechaOtras)}</span>}</div>
            <div className="spec-box"><div className="spec c2">
              {otras.map(p => <p key={p.k}><span>{p.t}</span><b>{num(p.u!.valor)} cm</b></p>)}
            </div></div>
          </div>
        )}

        <div className="sec">
          {tarjetaBascula}
          <div className="sec-h mt12"><h2>Historial</h2><button className="lnk" onClick={() => nav.ir('pro-reg')}><Ico n="plus" b /> Registrar</button></div>
          <div className="list">
            {historial.slice(0, cuantas).map(m => (
              <div key={m.id} className="it">
                <span className="code">{fechaCorta(m.fecha)}</span>
                <span className="tx"><b className="mono">{textoMedicion(m)}</b><small><Ico n={ICONO_ORIGEN[m.origen]} /> {m.hc?.length ? `${nombreFuente(m.fuente)} · Health Connect` : NOMBRE_ORIGEN[m.origen]}</small></span>
                <button className="ib" aria-label="Borrar medición" onClick={() => nav.hoja('sheet-confirmar', {
                  titulo: '¿Borrar esta medición?', texto: `${textoMedicion(m, 9)} · ${fechaCorta(m.fecha)}`, si: 'Borrar', peligro: true, accion: 'borrar-medicion', id: m.id,
                })}><Ico n="trash" /></button>
              </div>
            ))}
          </div>
          {historial.length > cuantas && <button className="btn ln sm mt8" onClick={() => setCuantas(c => c + 30)}>Ver más</button>}
        </div>

        <div className="dock"><button className="btn" onClick={() => nav.ir('pro-reg')}><Ico n="plus" b />Registrar</button></div>
      </div>
    </Pantalla>
  )
}
