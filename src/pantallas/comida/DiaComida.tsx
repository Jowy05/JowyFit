// COM-01 · Día: la proteína del día (lo principal), kcal orientativas, comidas por momento, cafeína, suplementos y cómo vas.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { comidasDe, comidasEntre, objetivosEnergia, suplementosDelDia } from '../../datos/consultas'
import type { Comida, Guardado } from '../../datos/tipos'
import { FRANJAS, avisoCafeina, batidoDe, datosQuincena, dosisDe, esBatido, nombreFranja, picoteoDeSemana, textoRacion, totalesComida, batidoAMano } from '../../dominio/comida'
import { DIAS, deISO, diaMes, diaSemana, horaActual, hoyISO, semanaDe, sumarDias } from '../../dominio/fechas'
import { capital, num } from '../../dominio/formato'
import { t, tn } from '../../i18n'
import { Barra, cx, Ico, Pantalla, Seccion, useUnaVez, recortar } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useMediciones, usePerfil } from '../../datos/hooks'
import { CabComida, Deslizable, Mini } from './comun'
import { alternarSuplemento, borrarComida } from '../../datos/acciones/comida'


export function DiaComida() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const [fecha, setFecha] = useState(hoy)
  const comidas = useLiveQuery(() => comidasDe(fecha), [fecha]) ?? []
  const energia = useLiveQuery(() => objetivosEnergia(perfil), [perfil])
  const semana = semanaDe(fecha)
  const semanaAnt = semanaDe(sumarDias(semana[0]!, -1))
  const recientes = useLiveQuery(() => comidasEntre(sumarDias(hoy, -27), hoy), [hoy]) ?? []
  const deSemanas = useLiveQuery(() => comidasEntre(semanaAnt[0]!, semana[6]!), [fecha]) ?? []
  const mediciones = useMediciones() ?? []
  const supl = useLiveQuery(() => suplementosDelDia(fecha), [fecha])
  const tot = totalesComida(comidas)
  const d = deISO(fecha)
  const esHoy = fecha === hoy
  const ordenadas = [...comidas].sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
  // La ayuda «desliza para borrar» va bajo el primer momento del día que tiene algo.
  const primera = FRANJAS.find(f => ordenadas.some(c => c.franja === f.v))?.v
  const pic = picoteoDeSemana(deSemanas, semana)
  const picAnt = picoteoDeSemana(deSemanas, semanaAnt)
  const quincena = energia ? datosQuincena({ hoy, mediciones, comidas: recientes, objetivoProteina: energia.proteina, objetivo: perfil.objetivo }) : null
  const tomados = supl?.tomados ?? []

  const borrar = async (c: Guardado<Comida>) => {
    aviso(t('Borrado: {nombre}', { nombre: t(c.nombre) }), await borrarComida(c))
  }
  // El batido, al marcarlo, se apunta con su proteína (suma al día); al desmarcarlo, se quita.
  // Un doble toque no mete dos batidos ni lo desmarca: una sola vez, y lo tomado se mira dentro de la transacción.
  const unaVez = useUnaVez()
  const tocarSuplemento = unaVez(async (s: string) => {
    const deshacer = await alternarSuplemento(perfil, fecha, s)
    if (deshacer && esBatido(s)) aviso(t('Apuntado: {nombre} · {n} g proteína', { nombre: t(s), n: batidoDe(perfil.batido).proteina }), deshacer)
  })
  const verDia = (n: number) => setFecha(f => sumarDias(f, n))
  // Redondeado: las raciones P/G dejan decimales («Faltan 112.6 g»).
  const faltan = energia ? Math.max(0, Math.round(energia.proteina - tot.proteina)) : 0
  // La cafeína se enseña si hoy hay o si se ha tomado en las últimas semanas.
  const conCafeina = tot.cafeina > 0 || recientes.some(c => (c.cafeina ?? 0) > 0)
  const caf = avisoCafeina(tot.cafeina, ajustes.cafeinaLimite, ajustes.cafeinaHoraTope, esHoy ? horaActual() : '00:00')

  return (
    <Pantalla>
      <CabComida vista="dia-comida" crumb={t('Lo aproximado vale')} fecha={fecha} />
      <div className="pg">
        <div className="daysel">
          <button className="ib" aria-label={t('Día anterior')} onClick={() => verDia(-1)}><Ico n="caret-left" /></button>
          <div>
            <b>{esHoy ? t('Hoy') : fecha === sumarDias(hoy, -1) ? t('Ayer') : capital(DIAS[diaSemana(d)]!)}</b>
            <small>{capital(DIAS[diaSemana(d)]!)} {diaMes(d.getDate(), d.getMonth())}</small>
          </div>
          <button className={cx('ib', esHoy && 'dim')} aria-label={t('Día siguiente')} onClick={() => esHoy ? aviso(t('Mañana aún no ha llegado')) : verDia(1)}><Ico n="caret-right" /></button>
        </div>

        <div className="card pd tot" data-tour="proteina">
          <div className="row jb">
            <span className="lbl">{esHoy ? t('Proteína de hoy') : t('Proteína del día')}</span>
            <span className="small okc">{energia ? faltan ? t('Faltan {n} g', { n: faltan }) : t('¡Conseguida!') : ''}</span>
          </div>
          <p className="tot-big mono">{Math.round(tot.proteina)}<small> / {energia?.proteina ?? '—'} g</small></p>
          <div className="mt8"><Barra v={tot.proteina} total={energia?.proteina ?? 1} tono="ok" gruesa /></div>
          {ajustes.mostrarKcal && (
            <div className="ux-com-kcal mt12">
              <div className="row jb">
                <span className="small muted">{t('Calorías (orientativo)')}</span>
                <span className="mono small muted">{num(tot.kcal, 0)} / ~{energia ? num(energia.kcal, 0) : '—'} kcal</span>
              </div>
              <div className="mt4"><Barra v={tot.kcal} total={energia?.kcal ?? 1} tono={energia && tot.kcal > energia.kcal * 1.1 ? 'warn' : undefined} /></div>
            </div>
          )}
        </div>

        <div className="sec">
          {FRANJAS.map((f, i) => {
            const lista = ordenadas.filter(c => c.franja === f.v)
            const tf = totalesComida(lista)
            return (
              <details key={f.v} className={cx('fold slot', i > 0 && 'mt8')} open>
                <summary>
                  <Ico n={f.icono} className="blue" />{nombreFranja(f.v)}
                  <span className="slot-n mono">{t('{g} g prot. · {kcal} kcal', { g: Math.round(tf.proteina), kcal: Math.round(tf.kcal) })}</span>
                  <Ico n="caret-down" />
                </summary>
                <div className="in">
                  {lista.map(c => (
                    <Deslizable key={c.id} onBorrar={() => void borrar(c)} onAbrir={() => nav.hoja('hoja-comida', { id: c.id })}>
                      <Mini nombre={c.nombre} tipo={c.tipo} foto={c.foto} />
                      <span className="tx">
                        <b>{recortar(t(c.nombre))}</b>
                        <small>{c.hora.replace(/^0/, '')}{c.racion !== 'N' ? ` · ${textoRacion(c.racion)}` : ''}{c.cafeina ? ` · ${t('{n} mg cafeína', { n: c.cafeina })}` : ''}{c.foto ? ` · ${t('con foto')}` : ''}</small>
                      </span>
                      <span className="end"><em>{Math.round(c.proteina)} g</em><small> {t('prot.')}</small><br /><small>{Math.round(c.kcal)} kcal</small></span>
                    </Deslizable>
                  ))}
                  {!lista.length && (
                    <button className="lnk" onClick={() => nav.hoja('hoja-anadir', { fecha, franja: f.v })}><Ico n="plus" b /> {t('Añadir')}</button>
                  )}
                  {lista.length > 0 && f.v === primera && <p className="small muted mt4"><Ico n="hand-swipe-left" /> {t('Desliza para borrar · toca para editar')}</p>}
                </div>
              </details>
            )
          })}
        </div>

        {conCafeina && (
          <div className="sec">
            <div className="card pd">
              <div className="row jb">
                <span className="lbl"><Ico n="coffee" /> {esHoy ? t('Cafeína de hoy') : t('Cafeína del día')}</span>
                <span className="mono small">{Math.round(tot.cafeina)} / {ajustes.cafeinaLimite} mg</span>
              </div>
              <div className="mt8"><Barra v={tot.cafeina} total={ajustes.cafeinaLimite} tono={caf.tono === 'ok' ? 'ok' : 'warn'} /></div>
              {esHoy && <p className="small muted mt8"><Ico n="bell-simple" /> {caf.texto}</p>}
            </div>
          </div>
        )}

        {perfil.suplementos.length > 0 && (
          <Seccion titulo={esHoy ? t('Suplementos de hoy') : t('Suplementos')}>
            <div className="list">
              {perfil.suplementos.map(s => {
                const batido = esBatido(s)
                // Un batido apuntado a mano (desde Añadir) también cuenta como tomado, sin apuntarlo dos veces.
                const aMano = batido && !tomados.includes(s) && batidoAMano(comidas)
                const hecho = tomados.includes(s) || aMano
                const dosis = dosisDe(perfil.dosisSuplementos, s)
                const detalle = [dosis, batido ? `${t('{n} g proteína', { n: batidoDe(perfil.batido).proteina })}${hecho && !aMano ? ` · ${t('sumada al día')}` : ''}` : '', aMano ? t('ya apuntado') : ''].filter(Boolean).join(' · ')
                return (
                  <div key={s} className="it tpl">
                    <button className={cx('tpl-m todo', hecho && 'done')} onClick={() => aMano ? aviso(t('Ya tienes un batido apuntado hoy')) : void tocarSuplemento(s)}>
                      <span className="box"><Ico n="check" b /></span>
                      <span className="tx"><b>{t(s)}</b><small>{detalle || (hecho ? t('Tomado') : t('Toca cuando lo tomes'))}</small></span>
                    </button>
                    <button className="ib ux-com-lapiz" aria-label={t('Cambiar cantidad de {nombre}', { nombre: t(s) })} onClick={() => nav.hoja('hoja-suplemento', { nombre: s })}><Ico n="pencil-simple" /></button>
                  </div>
                )
              })}
            </div>
          </Seccion>
        )}

        {/* Una sola tarjeta: el consejo de la quincena y el picoteo de la semana. */}
        <div className="sec">
          <button className="card pd adj" onClick={() => nav.ir('energia')}>
            <span className="row jb">
              <span className="lbl">{t('Cómo vas · últimas 2 semanas')}</span>
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
                <b>{pic.dias === 0 ? t('Ningún día con picoteo esta semana') : tn(pic.dias, '{n} día con picoteo esta semana', '{n} días con picoteo esta semana')}</b>
                <small>{t('La anterior: {n}', { n: picAnt.dias })}{pic.energeticas ? ` · ${tn(pic.energeticas, '{n} energética esta semana', '{n} energéticas esta semana')}` : ''}</small>
              </span>
            </span>
            <span className="lnk mt8">{t('Tu objetivo de energía')} <Ico n="caret-right" /></span>
          </button>
        </div>

        <div className="dock">
          <button className="btn xl" data-tour="comida-anadir" onClick={() => nav.hoja('hoja-anadir', { fecha })}><Ico n="plus" b />{t('Añadir')}</button>
        </div>
      </div>
    </Pantalla>
  )
}
