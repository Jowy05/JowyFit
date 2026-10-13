// COM-01 · Día: proteína y kcal del día, comidas por franja, picoteo, cafeína y suplementos.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { objetivosEnergia, totalesComida } from '../../../datos/consultas'
import type { Comida } from '../../../datos/tipos'
import { FRANJAS, avisoCafeina, datosQuincena, picoteoDeSemana } from '../../../dominio/comida'
import { DIAS, MESES_CORTOS, deISO, diaSemana, horaActual, hoyISO, semanaDe, sumarDias } from '../../../dominio/fechas'
import { Barra, cx, Ico, Pantalla, Seccion } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, usePerfil } from '../../datos'
import { CabComida, Deslizable, Mini } from './comun'

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function DiaComida({ ruta }: { ruta?: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const [fecha, setFecha] = useState<string>(typeof ruta?.d?.fecha === 'string' ? ruta.d.fecha : hoy)
  const comidas = useLiveQuery(() => db.comidas.where('fecha').equals(fecha).toArray(), [fecha]) ?? []
  const energia = useLiveQuery(() => objetivosEnergia(perfil), [perfil])
  const semana = semanaDe(fecha)
  const semanaAnt = semanaDe(sumarDias(semana[0]!, -1))
  const recientes = useLiveQuery(() => db.comidas.where('fecha').between(sumarDias(hoy, -27), hoy, true, true).toArray(), [hoy]) ?? []
  const deSemanas = useLiveQuery(() => db.comidas.where('fecha').between(semanaAnt[0]!, semana[6]!, true, true).toArray(), [fecha]) ?? []
  const mediciones = useLiveQuery(() => db.mediciones.toArray(), []) ?? []
  const supl = useLiveQuery(() => db.suplementos.get(fecha), [fecha])
  const tot = totalesComida(comidas)
  const d = deISO(fecha)
  const esHoy = fecha === hoy
  const ordenadas = [...comidas].sort((a, b) => a.hora.localeCompare(b.hora))
  const pic = picoteoDeSemana(deSemanas, semana)
  const picAnt = picoteoDeSemana(deSemanas, semanaAnt)
  const quincena = energia ? datosQuincena({ hoy, mediciones, comidas: recientes, objetivoProteina: energia.proteina, objetivo: perfil.objetivo }) : null
  const tomados = supl?.tomados ?? []

  const borrar = async (c: Comida) => {
    await db.comidas.delete(c.id!)
    aviso(`Borrado: ${c.nombre}`, () => { void db.comidas.add(c) })
  }
  const alternarSuplemento = async (s: string) => {
    const t = new Set(tomados)
    if (t.has(s)) t.delete(s); else t.add(s)
    await db.suplementos.put({ fecha, tomados: [...t] })
  }
  const verDia = (n: number) => setFecha(f => sumarDias(f, n))
  const faltan = energia ? Math.max(0, energia.proteina - tot.proteina) : 0
  const conCafeina = tot.cafeina > 0 || perfil.bebidas.length > 0
  const caf = avisoCafeina(tot.cafeina, ajustes.cafeinaLimite, ajustes.cafeinaHoraTope, esHoy ? horaActual() : '00:00')

  return (
    <Pantalla>
      <CabComida vista="com" crumb="Lo aproximado vale" />
      <div className="pg">
        <div className="daysel">
          <button className="ib" aria-label="Día anterior" onClick={() => verDia(-1)}><Ico n="caret-left" /></button>
          <div>
            <b>{esHoy ? 'Hoy' : fecha === sumarDias(hoy, -1) ? 'Ayer' : capital(DIAS[diaSemana(d)]!)}</b>
            <small>{capital(DIAS[diaSemana(d)]!)} {d.getDate()} {MESES_CORTOS[d.getMonth()]}</small>
          </div>
          <button className={cx('ib', esHoy && 'dim')} aria-label="Día siguiente" onClick={() => esHoy ? aviso('Mañana aún no ha llegado') : verDia(1)}><Ico n="caret-right" /></button>
        </div>

        <div className="card pd tot">
          <div className="row jb">
            <span className="lbl">Proteína</span>
            <span className={cx('small', faltan ? 'okc' : 'okc')}>{energia ? faltan ? `Faltan ${faltan} g` : '¡Conseguida!' : ''}</span>
          </div>
          <p className="tot-big mono">{Math.round(tot.proteina)}<small> / {energia?.proteina ?? '—'} g</small></p>
          <div className="mt8"><Barra v={tot.proteina} total={energia?.proteina ?? 1} tono="ok" gruesa /></div>
          {ajustes.mostrarKcal && (
            <>
              <div className="hr" />
              <div className="row jb">
                <span className="lbl">Kcal · orientativo</span>
                <span className="mono small">{Math.round(tot.kcal)} / ~{energia?.kcal ?? '—'}</span>
              </div>
              <div className="mt8"><Barra v={tot.kcal} total={energia?.kcal ?? 1} tono={energia && tot.kcal > energia.kcal * 1.1 ? 'warn' : undefined} /></div>
            </>
          )}
        </div>

        <div className="sec">
          {FRANJAS.map((f, i) => {
            const lista = ordenadas.filter(c => c.franja === f.v)
            const t = totalesComida(lista)
            return (
              <details key={f.v} className={cx('fold slot', i > 0 && 'mt8')} open>
                <summary>
                  <Ico n={f.icono} className="blue" />{f.t}
                  <span className="slot-n mono">{Math.round(t.kcal)} kcal · {Math.round(t.proteina)} g</span>
                  <Ico n="caret-down" />
                </summary>
                <div className="in">
                  {lista.map(c => (
                    <Deslizable key={c.id} onBorrar={() => void borrar(c)} onAbrir={() => nav.hoja('sheet-comida', { id: c.id })}>
                      <Mini nombre={c.nombre} tipo={c.tipo} foto={c.foto} />
                      <span className="tx">
                        <b>{c.nombre}</b>
                        <small>{c.hora.replace(/^0/, '')}{c.racion !== 'N' ? ` · ración ${c.racion === 'P' ? 'pequeña' : 'grande'}` : ''}{c.cafeina ? ` · ${c.cafeina} mg cafeína` : ''}{c.foto ? ' · con foto' : ''}</small>
                      </span>
                      <span className="end">{Math.round(c.kcal)}<small> kcal</small><br /><em>{Math.round(c.proteina)} g</em></span>
                    </Deslizable>
                  ))}
                  {!lista.length && (
                    <button className="lnk" onClick={() => nav.hoja('sheet-add', { fecha, franja: f.v })}><Ico n="plus" b /> Añadir</button>
                  )}
                  {lista.length > 0 && i === 0 && ordenadas.length > 0 && <p className="small muted mt4"><Ico n="hand-swipe-left" /> Desliza para borrar · toca para editar</p>}
                </div>
              </details>
            )
          })}
        </div>

        <div className="sec">
          <div className="card pd row snack">
            <span className={cx('ico', pic.dias <= picAnt.dias ? 'okb' : 'warnb')}><Ico n={pic.dias <= picAnt.dias ? 'trend-down' : 'trend-up'} /></span>
            <span className="tx">
              <span className="lbl">Picoteo y bebidas · esta semana</span>
              <b>{pic.dias === 0 ? 'Ningún día con picoteo' : pic.dias === 1 ? '1 día con picoteo' : `${pic.dias} días con picoteo`}</b>
              <small>La anterior: {picAnt.dias}{pic.energeticas ? ` · ${pic.energeticas} energética${pic.energeticas > 1 ? 's' : ''} esta semana` : ''}</small>
            </span>
          </div>
          {conCafeina && (
            <div className="card pd mt8">
              <div className="row jb">
                <span className="lbl"><Ico n="coffee" /> Cafeína {esHoy ? 'de hoy' : 'del día'}</span>
                <span className="mono small">{Math.round(tot.cafeina)} / {ajustes.cafeinaLimite} mg</span>
              </div>
              <div className="mt8"><Barra v={tot.cafeina} total={ajustes.cafeinaLimite} tono={caf.tono === 'ok' ? 'ok' : 'warn'} /></div>
              {esHoy && <p className="small muted mt8"><Ico n="bell-simple" /> {caf.texto}</p>}
            </div>
          )}
        </div>

        {perfil.suplementos.length > 0 && (
          <Seccion titulo={esHoy ? 'Suplementos de hoy' : 'Suplementos'}>
            <div className="list">
              {perfil.suplementos.map(s => {
                const batidoApuntado = /prote|batido/i.test(s) && comidas.some(c => /batido|prote/i.test(c.nombre))
                const hecho = tomados.includes(s) || batidoApuntado
                return (
                  <button key={s} className={cx('it todo', hecho && 'done')} onClick={() => batidoApuntado && !tomados.includes(s) ? aviso('Ya tienes un batido apuntado hoy') : void alternarSuplemento(s)}>
                    <span className="box"><Ico n="check" b /></span>
                    <span className="tx"><b>{s}</b><small>{batidoApuntado ? '1 batido · ya apuntado' : /creatina/i.test(s) ? '3-5 g' : hecho ? 'Tomado' : 'Toca cuando lo tomes'}</small></span>
                    <Ico n={/prote|batido/i.test(s) ? 'drop' : 'pill'} className="car" />
                  </button>
                )
              })}
            </div>
          </Seccion>
        )}

        {quincena && (
          <div className="sec">
            <button className="card pd adj" onClick={() => nav.ir('com-energia')}>
              <span className="row jb">
                <span className="lbl">Ajuste de la quincena</span>
                <span className={cx('tag', quincena.tono === 'ok' ? 'ok' : quincena.tono === 'warn' ? 'warn' : '')}>
                  {quincena.tono === 'ok' && <Ico n="check" b />}{quincena.etiqueta}
                </span>
              </span>
              <b className="adj-t">{quincena.consejo}</b>
              {quincena.picoteoDias > 0 && <span className="small muted">Picoteo en {quincena.picoteoDias} de los últimos 14 días.</span>}
              <span className="lnk mt8">Tu objetivo de energía <Ico n="caret-right" /></span>
            </button>
          </div>
        )}

        <div className="dock">
          <button className="btn xl" onClick={() => nav.hoja('sheet-add', { fecha })}><Ico n="plus" b />Añadir</button>
        </div>
      </div>
    </Pantalla>
  )
}
