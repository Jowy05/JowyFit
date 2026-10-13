// PRO-04 · Cuerpo
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Medicion, OrigenMedicion } from '../../../datos/tipos'
import { cinturaAltura, num } from '../../../dominio/calculos'
import { fechaCorta } from '../../../dominio/fechas'
import { grasaPorMedidas, mediasSemanales, pendienteSemanal, serieMedida, ultimoValor, type PuntoFecha } from '../../../dominio/tendencias'
import { Linea } from '../../graficas'
import { Chip, Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { usePerfil } from '../../datos'
import { CabProgreso, capital, fechaPunto, ICONO_ORIGEN, NOMBRE_ORIGEN, PERIMETROS } from './comun'

type Vista = 'ratio' | 'grasa' | 'peso'
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
  const [vista, setVista] = useState<Vista>('ratio')
  const [cuantas, setCuantas] = useState(15)
  const cab = <CabProgreso actual="pro-cuerpo" crumb="Tendencias" />

  if (!ms) return <Pantalla>{cab}</Pantalla>
  if (!ms.length) return (
    <Pantalla>
      {cab}
      <div className="pg"><div className="sec">
        <Vacio icono="ruler" titulo="Aún no hay medidas" texto="Pésate y mide la cintura una o dos veces por semana. La cintura dice más que la báscula."
          accion={<><Ico n="plus" b />Registrar medidas</>} onAccion={() => nav.ir('pro-reg')} />
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

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        <div className="card pd">
          <div className="row jb">
            <div><span className="lbl">Cintura</span><p className="tot-big mono">{cUlt ? num(cUlt.valor) : '—'}<small> cm</small></p></div>
            {cUlt && cPrimera && cintura.length > 1 && (
              <div className="right">
                <span className={`tag ${cUlt.valor <= cPrimera.valor ? 'ok' : 'warn'}`}>{signo(cUlt.valor - cPrimera.valor)} cm</span>
                <p className="small muted mt4">desde el {fechaCorta(cPrimera.fecha)}</p>
              </div>
            )}
          </div>
          <div className="mt8">
            {cintura.length
              ? <Linea puntos={aPuntos(cintura)} objetivo={metaCintura?.objetivo} etiquetaObjetivo={metaCintura ? `objetivo ${num(metaCintura.objetivo)}` : undefined} />
              : <p className="small muted">Mide la cintura a la altura del ombligo para ver su tendencia.</p>}
          </div>
          {!metaCintura && cintura.length > 0 && <button className="lnk mt8" onClick={() => nav.hoja('sheet-meta', { tipo: 'cintura' })}><Ico n="flag" /> Ponerte un objetivo de cintura</button>}
        </div>

        <div className="card pd mt12">
          <div className="chips eq">
            <Chip on={vista === 'ratio'} onClick={() => setVista('ratio')}>Cint./altura</Chip>
            <Chip on={vista === 'grasa'} onClick={() => setVista('grasa')}>% grasa</Chip>
            <Chip on={vista === 'peso'} onClick={() => setVista('peso')}>Peso</Chip>
          </div>
          {vista === 'ratio' && (
            <>
              <div className="row jb mt12">
                <p className="tot-big mono">{rUlt ? num(rUlt.valor, 3) : '—'}</p>
                <span className={`tag ${rUlt && rUlt.valor < 0.5 ? 'ok' : 'warn'}`}>Meta &lt; 0,5</span>
              </div>
              <div className="mt8">{ratio.length ? <Linea puntos={aPuntos(ratio)} objetivo={0.5} etiquetaObjetivo="0,5" decimales={3} /> : <p className="small muted">Necesita la cintura y tu altura del perfil.</p>}</div>
              <p className="small muted">Cintura entre altura. Por debajo de 0,5 es lo saludable.</p>
            </>
          )}
          {vista === 'grasa' && (
            <>
              <div className="row jb mt12">
                <p className="tot-big mono">{marina.length ? num(marina[marina.length - 1]!.valor) : bascula.length ? num(bascula[bascula.length - 1]!.valor) : '—'}<small> %</small></p>
                <span className="small muted">{marina.length ? 'por medidas' : bascula.length ? 'báscula' : ''}</span>
              </div>
              {marina.length > 0 && <div className="mt8"><p className="lbl"><i className="lgl" /> Por medidas (cintura y cuello)</p><Linea puntos={aPuntos(marina)} /></div>}
              {bascula.length > 0 && <div className="mt8"><p className="lbl"><i className="lgl d" /> {NOMBRE_ORIGEN[origenBascula!]}</p><Linea puntos={aPuntos(bascula)} /></div>}
              {!marina.length && !bascula.length && <p className="small muted mt8">Apunta cintura y cuello{perfil.sexo === 'mujer' ? ' (y cadera)' : ''}, o el % de la báscula.</p>}
              <p className="small muted">Compara siempre con la misma báscula: cada una mide distinto.</p>
            </>
          )}
          {vista === 'peso' && (
            <>
              <div className="row jb mt12">
                <p className="tot-big mono">{pesoUlt ? num(pesoUlt.valor) : '—'}<small> kg</small></p>
                {pendiente != null && <span className="tag">{signo(pendiente)} kg/sem</span>}
              </div>
              <div className="mt8">{pesoSem.length ? <Linea puntos={aPuntos(pesoSem)} /> : <p className="small muted">Aún no hay pesajes.</p>}</div>
              <p className="small muted">Media de cada semana: el peso de un día suelto engaña.</p>
            </>
          )}
        </div>

        {otras.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Otras medidas</h2>{fechaOtras && <span className="lbl">{fechaCorta(fechaOtras)}</span>}</div>
            <div className="spec-box"><div className="spec c2">
              {otras.map(p => <p key={p.k}><span>{p.t}</span><b>{num(p.u!.valor)} cm</b></p>)}
            </div></div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>Historial</h2><button className="lnk" onClick={() => nav.ir('pro-reg')}><Ico n="plus" b /> Registrar</button></div>
          <div className="list">
            {historial.slice(0, cuantas).map(m => (
              <div key={m.id} className="it">
                <span className="code">{fechaCorta(m.fecha)}</span>
                <span className="tx"><b className="mono">{textoMedicion(m)}</b><small><Ico n={ICONO_ORIGEN[m.origen]} /> {NOMBRE_ORIGEN[m.origen]}</small></span>
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
