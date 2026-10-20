// COM-01 · Día: la proteína del día (lo principal), kcal orientativas, comidas por momento, cafeína, suplementos y cómo vas.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { objetivosEnergia, totalesComida } from '../../../datos/consultas'
import type { Comida } from '../../../datos/tipos'
import { FRANJAS, avisoCafeina, batidoDe, datosQuincena, dosisDe, esBatido, picoteoDeSemana, textoRacion } from '../../../dominio/comida'
import { DIAS, MESES_CORTOS, deISO, diaSemana, horaActual, hoyISO, semanaDe, sumarDias } from '../../../dominio/fechas'
import { Barra, cx, Ico, Pantalla, Seccion, useUnaVez, recortar } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, usePerfil } from '../../datos'
import { CabComida, Deslizable, Mini } from './comun'
import { batidoAMano, desmarcarSuplemento, marcarSuplemento } from './suplementos'

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
  // La ayuda «desliza para borrar» va bajo el primer momento del día que tiene algo.
  const primera = FRANJAS.find(f => ordenadas.some(c => c.franja === f.v))?.v
  const pic = picoteoDeSemana(deSemanas, semana)
  const picAnt = picoteoDeSemana(deSemanas, semanaAnt)
  const quincena = energia ? datosQuincena({ hoy, mediciones, comidas: recientes, objetivoProteina: energia.proteina, objetivo: perfil.objetivo }) : null
  const tomados = supl?.tomados ?? []

  const borrar = async (c: Comida) => {
    await db.comidas.delete(c.id!)
    aviso(`Borrado: ${c.nombre}`, () => { void db.comidas.add(c) })
  }
  // El batido, al marcarlo, se apunta con su proteína (suma al día); al desmarcarlo, se quita.
  // Con un doble toque metía dos batidos o lo marcaba y desmarcaba: una vez, y leyendo lo tomado de la base de datos.
  const unaVez = useUnaVez()
  const alternarSuplemento = unaVez(async (s: string) => {
    const yaTomado = ((await db.suplementos.get(fecha))?.tomados ?? []).includes(s)
    if (yaTomado) { await desmarcarSuplemento(fecha, s); return }
    const deshacer = await marcarSuplemento(perfil, fecha, s)
    if (esBatido(s)) aviso(`Apuntado: ${s} · ${batidoDe(perfil.batido).proteina} g proteína`, deshacer)
  })
  const verDia = (n: number) => setFecha(f => sumarDias(f, n))
  // Redondeado: las raciones P/G dejan decimales y salía «Faltan 112.6 g».
  const faltan = energia ? Math.max(0, Math.round(energia.proteina - tot.proteina)) : 0
  // La cafeína se enseña si hoy hay o si se ha tomado en las últimas semanas.
  const conCafeina = tot.cafeina > 0 || recientes.some(c => (c.cafeina ?? 0) > 0)
  const caf = avisoCafeina(tot.cafeina, ajustes.cafeinaLimite, ajustes.cafeinaHoraTope, esHoy ? horaActual() : '00:00')

  return (
    <Pantalla>
      <CabComida vista="com" crumb="Lo aproximado vale" fecha={fecha} />
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
            <span className="lbl">Proteína {esHoy ? 'de hoy' : 'del día'}</span>
            <span className="small okc">{energia ? faltan ? `Faltan ${faltan} g` : '¡Conseguida!' : ''}</span>
          </div>
          <p className="tot-big mono">{Math.round(tot.proteina)}<small> / {energia?.proteina ?? '—'} g</small></p>
          <div className="mt8"><Barra v={tot.proteina} total={energia?.proteina ?? 1} tono="ok" gruesa /></div>
          {ajustes.mostrarKcal && (
            <div className="ux-com-kcal mt12">
              <div className="row jb">
                <span className="small muted">Calorías (orientativo)</span>
                <span className="mono small muted">{Math.round(tot.kcal)} / ~{energia?.kcal ?? '—'} kcal</span>
              </div>
              <div className="mt4"><Barra v={tot.kcal} total={energia?.kcal ?? 1} tono={energia && tot.kcal > energia.kcal * 1.1 ? 'warn' : undefined} /></div>
            </div>
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
                  <span className="slot-n mono">{Math.round(t.proteina)} g prot. · {Math.round(t.kcal)} kcal</span>
                  <Ico n="caret-down" />
                </summary>
                <div className="in">
                  {lista.map(c => (
                    <Deslizable key={c.id} onBorrar={() => void borrar(c)} onAbrir={() => nav.hoja('sheet-comida', { id: c.id })}>
                      <Mini nombre={c.nombre} tipo={c.tipo} foto={c.foto} />
                      <span className="tx">
                        <b>{recortar(c.nombre)}</b>
                        <small>{c.hora.replace(/^0/, '')}{c.racion !== 'N' ? ` · ${textoRacion(c.racion)}` : ''}{c.cafeina ? ` · ${c.cafeina} mg cafeína` : ''}{c.foto ? ' · con foto' : ''}</small>
                      </span>
                      <span className="end ux-com-end"><em>{Math.round(c.proteina)} g</em><small> prot.</small><br /><small>{Math.round(c.kcal)} kcal</small></span>
                    </Deslizable>
                  ))}
                  {!lista.length && (
                    <button className="lnk" onClick={() => nav.hoja('sheet-add', { fecha, franja: f.v })}><Ico n="plus" b /> Añadir</button>
                  )}
                  {lista.length > 0 && f.v === primera && <p className="small muted mt4"><Ico n="hand-swipe-left" /> Desliza para borrar · toca para editar</p>}
                </div>
              </details>
            )
          })}
        </div>

        {conCafeina && (
          <div className="sec">
            <div className="card pd">
              <div className="row jb">
                <span className="lbl"><Ico n="coffee" /> Cafeína {esHoy ? 'de hoy' : 'del día'}</span>
                <span className="mono small">{Math.round(tot.cafeina)} / {ajustes.cafeinaLimite} mg</span>
              </div>
              <div className="mt8"><Barra v={tot.cafeina} total={ajustes.cafeinaLimite} tono={caf.tono === 'ok' ? 'ok' : 'warn'} /></div>
              {esHoy && <p className="small muted mt8"><Ico n="bell-simple" /> {caf.texto}</p>}
            </div>
          </div>
        )}

        {perfil.suplementos.length > 0 && (
          <Seccion titulo={esHoy ? 'Suplementos de hoy' : 'Suplementos'}>
            <div className="list">
              {perfil.suplementos.map(s => {
                const batido = esBatido(s)
                // Un batido apuntado a mano (desde Añadir) también cuenta como tomado, sin apuntarlo dos veces.
                const aMano = batido && !tomados.includes(s) && batidoAMano(comidas)
                const hecho = tomados.includes(s) || aMano
                const dosis = dosisDe(perfil.dosisSuplementos, s)
                const detalle = [dosis, batido ? `${batidoDe(perfil.batido).proteina} g proteína${hecho && !aMano ? ' · sumada al día' : ''}` : '', aMano ? 'ya apuntado' : ''].filter(Boolean).join(' · ')
                return (
                  <div key={s} className="it tpl ux-com-fila">
                    <button className={cx('tpl-m todo', hecho && 'done')} onClick={() => aMano ? aviso('Ya tienes un batido apuntado hoy') : void alternarSuplemento(s)}>
                      <span className="box"><Ico n="check" b /></span>
                      <span className="tx"><b>{s}</b><small>{detalle || (hecho ? 'Tomado' : 'Toca cuando lo tomes')}</small></span>
                    </button>
                    <button className="ib ux-com-lapiz" aria-label={`Cambiar cantidad de ${s}`} onClick={() => nav.hoja('sheet-supl', { nombre: s })}><Ico n="pencil-simple" /></button>
                  </div>
                )
              })}
            </div>
          </Seccion>
        )}

        {/* Una sola tarjeta: el consejo de la quincena y el picoteo de la semana (antes eran dos seguidas). */}
        <div className="sec">
          <button className="card pd adj" onClick={() => nav.ir('com-energia')}>
            <span className="row jb">
              <span className="lbl">Cómo vas · últimas 2 semanas</span>
              {quincena && (
                <span className={cx('tag', quincena.tono === 'ok' ? 'ok' : quincena.tono === 'warn' ? 'warn' : '')}>
                  {quincena.tono === 'ok' && <Ico n="check" b />}{quincena.etiqueta}
                </span>
              )}
            </span>
            {quincena && <b className="adj-t">{quincena.consejo}</b>}
            <span className="row ux-com-pic mt8">
              <span className={cx('ico', pic.dias <= picAnt.dias ? 'okb' : 'warnb')}><Ico n={pic.dias <= picAnt.dias ? 'trend-down' : 'trend-up'} /></span>
              <span className="tx">
                <b>{pic.dias === 0 ? 'Ningún día con picoteo' : pic.dias === 1 ? '1 día con picoteo' : `${pic.dias} días con picoteo`} esta semana</b>
                <small>La anterior: {picAnt.dias}{pic.energeticas ? ` · ${pic.energeticas} energética${pic.energeticas > 1 ? 's' : ''} esta semana` : ''}</small>
              </span>
            </span>
            <span className="lnk mt8">Tu objetivo de energía <Ico n="caret-right" /></span>
          </button>
        </div>

        <div className="dock">
          <button className="btn xl" onClick={() => nav.hoja('sheet-add', { fecha })}><Ico n="plus" b />Añadir</button>
        </div>
      </div>
    </Pantalla>
  )
}
