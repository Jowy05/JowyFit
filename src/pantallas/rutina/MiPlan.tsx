// RUT-01 · Mi plan
import { useLiveQuery } from 'dexie-react-hooks'
import { letrasHechasDeRutina, sesionDeHoy } from '../../datos/consultas'
import { deISO, diaSemana, hoyISO, numeroSemana } from '../../dominio/fechas'
import { cx, Ico, Pantalla, useUnaVez, Vacio } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAjustes, useCola, usePerfil, useRutina, useSesionEnCurso } from '../../datos/hooks'
import { useAviso } from '../../ui/aviso'
import { abrevDia, listaDias, nombreDia, seriesTxt, tituloDia } from './comun'
import { CabRutina } from './CabRutina'
import { ListaCola, ModoRutina } from './Cola'
import { duracionPlan, filas, minutosDia } from '../../dominio/rutina'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { capital } from '../../dominio/formato'
import { nombreEntreno, nombreEstructura } from '../../dominio/nombres'
import { iniciarEntreno } from '../../datos/acciones/entreno'
import { t, tn } from '../../i18n'

/** Lo que añade el CSS tras las series de lo que se quita con prisa (va en data-cut para poder traducirlo). */
const cut = () => t('se quita si vas con prisa')

export function MiPlan() {
  const nav = useNav()
  const aviso = useAviso()
  const r = useRutina()
  const a = useAjustes()
  const p = usePerfil()
  const enCurso = useSesionEnCurso()
  const hoy = hoyISO()
  const cola = useCola(hoy)
  const ds = diaSemana(deISO(hoy))
  const crumb = a.inicio ? t('Semana {n}', { n: Math.max(1, numeroSemana(a.inicio, hoy)) }) : undefined
  // Entrenos de calibración que cuentan: los de esta rutina y no libres (igual que en el fin del entreno).
  const letrasHechas = useLiveQuery(async () => (r ? letrasHechasDeRutina(r.id) : new Set<string>()), [r?.id]) ?? new Set<string>()
  const unaVez = useUnaVez()

  // Si hoy ya se entrenó, la tarjeta de hoy lo dice: con «Empezar rutina» parecería que no se guardó.
  // Va antes de los return: los hooks siempre en el mismo orden.
  const hechoHoy = useLiveQuery(sesionDeHoy, [])
  if (r === undefined) return <Pantalla><CabRutina actual="mi-plan" crumb={crumb} /></Pantalla>
  if (r === null) return (
    <Pantalla>
      <CabRutina actual="mi-plan" crumb={crumb} />
      <div className="pg"><div className="sec">
        <Vacio icono="clipboard-text" titulo={t('Aún no tienes rutina')} texto={t('La creamos con tus días, tu tiempo y tu gimnasio. Tarda 10 segundos.')} accion={<><Ico n="magic-wand" b />{t('Crear mi rutina')}</>} onAccion={() => nav.ir('generar-rutina')} />
      </div></div>
    </Pantalla>
  )

  const fijos = r.dias.filter(d => !d.opcional)
  const opc = r.dias.filter(d => d.opcional)
  // Un doble toque no abre dos entrenos libres; abrirEntreno sirve aunque la app se cerrara a mitad.
  const libre = unaVez(async () => {
    if (enCurso) { aviso(t('Ya tienes un entreno en curso')); nav.abrirEntreno(); return }
    await iniciarEntreno({ libre: true })
    nav.completa('entreno')
  })
  const faltan = fijos.filter(d => !letrasHechas.has(d.letra)).length
  const conDia = fijos.filter(d => d.dia != null).map(d => d.dia!)
  // «Dos seguidos» (superserie) se explica la primera vez que sale en la pantalla.
  let ssVista = false
  const ss = () => { const x = ssVista ? '' : ` · ${t('sin descanso entre los dos')}`; ssVista = true; return x }

  return (
    <Pantalla>
      <CabRutina actual="mi-plan" crumb={crumb} />
      <div className="pg">
        <div className="sec">
          <div className="spec-box" data-tour="rutina">
            <div className="spec-h mt8">
              <h2 className="h3">{nombreEstructura(r.estructura)}</h2>
              {r.calibracion ? <span className="tag warn"><Ico n="gauge" b />{t('Semana de prueba')}</span> : <span className="tag ok"><Ico n="check" b />{t('Definitiva')}</span>}
            </div>
            <div className="spec">
              <p><span>{t('Días')}</span><b className="ux-rut-wrap">{conDia.length ? capital(listaDias(conDia)) : t('{n} a la semana', { n: fijos.length })}</b></p>
              {opc[0]?.dia != null && <p><span>{t('Día extra')}</span><b className="ux-rut-wrap">{t('{dia}, si te apetece · ~{min} min', { dia: nombreDia(opc[0]), min: minutosDia(opc[0]) })}</b></p>}
              {/* Mismo rango que al crear la rutina («48-55 min»). */}
              <p><span>{t('Duración')}</span><b>{duracionPlan(r)}</b></p>
            </div>
          </div>
          <ModoRutina />
          {r.calibracion && <p className="note warn mt8"><Ico n="gauge" /><span><b>{t('Esta semana, pesos cómodos.')}</b> {faltan > 0 ? tn(faltan, 'Después de {n} entreno más te propongo la rutina definitiva con tus tiempos reales.', 'Después de {n} entrenos más te propongo la rutina definitiva con tus tiempos reales.') : t('Al guardar el próximo entreno te propongo la rutina definitiva con tus tiempos reales.')}</span></p>}
        </div>

        {cola && <ListaCola cola={cola} r={r} p={p} />}
        {cola === null && <div className="sec">
          <div className="sec-h"><h2>{t('Días')}</h2><span className="lbl">{t('Toca uno para verlo')}</span></div>
          {r.dias.map((d, i) => {
            const esHoy = d.dia === ds
            if (esHoy && !d.opcional) return (
              <div key={d.letra} className={cx('dayc card hot', i && 'mt8')}>
                <button className="dayc-h" onClick={() => nav.ir('detalle-dia', { letra: d.letra })}>
                  <span className={cx('dl', d.dia != null && 'ux-rut-dl')}>{abrevDia(d)}</span>
                  <span className="tx"><b>{tituloDia(d)}</b><small>{t('{nombre} · ~{min} min · con prisa ~{corta}', { nombre: nombreEntreno(d), min: minutosDia(d), corta: minutosDia(d, true) })}</small></span>
                  {hechoHoy ? <span className="tag ok"><Ico n="check" b />{t('Hecho')}</span> : <span className="tag go">{t('Hoy')}</span>}
                </button>
                <div className="pl-list">
                  {filas(d.bloques).map(f => Array.isArray(f) ? (
                    <div key={f[0].uid} className="ssb">
                      <span className="ss-l">{t('Dos seguidos')}{ss()}</span>
                      {f.map(b => <p key={b.uid} className={cx('pl', b.fueraEnCorta && 'cut')}><span>{nombreEjercicio(b.ejercicio)}</span><b data-cut={b.fueraEnCorta ? cut() : undefined}>{seriesTxt(b)}</b></p>)}
                    </div>
                  ) : <p key={f.uid} className={cx('pl', f.fueraEnCorta && 'cut')}><span>{nombreEjercicio(f.ejercicio)}</span><b data-cut={f.fueraEnCorta ? cut() : undefined}>{seriesTxt(f)}</b></p>)}
                  <p className="small muted ux-rut-leyenda">{t('«3 × 6-10» = 3 series de 6 a 10 repeticiones.')}</p>
                </div>
                <div className="pd">
                  {hechoHoy
                    ? <button className="btn gry" onClick={() => nav.ir('detalle-entreno', { id: hechoHoy.id }, 'pro')}><Ico n="check" b />{t('Entreno de hoy hecho · verlo')}</button>
                    : <button className="btn" onClick={() => nav.hoja('hoja-empezar', { letra: d.letra })}><Ico n="play" b />{t('Empezar rutina')}</button>}
                </div>
              </div>
            )
            // Los días que no son hoy, plegados: solo cuántos ejercicios; la lista, al tocarlo.
            const nEj = d.bloques.length
            return (
              <button key={d.letra} className={cx('dayc card', i && 'mt8', d.opcional && 'optd')} onClick={() => nav.ir('detalle-dia', { letra: d.letra })}>
                <span className="dayc-h">
                  <span className={cx('dl', d.dia != null && 'ux-rut-dl')}>{abrevDia(d)}</span>
                  <span className="tx"><b>{d.opcional ? t('{dia} · opcional', { dia: tituloDia(d) }) : tituloDia(d)}</b><small>{d.dia != null ? nombreEntreno(d) : t('Día {letra}', { letra: d.letra })} · {tn(nEj, '{n} ejercicio', '{n} ejercicios')} · ~{minutosDia(d)} min</small></span>
                  <Ico n="caret-right" className="car" />
                </span>
              </button>
            )
          })}
        </div>}

        <div className="sec">
          <div className="list">
            <button className="it" onClick={() => nav.ir('editar-plan')}><span className="ico"><Ico n="pencil-simple" /></span><span className="tx"><b>{t('Editar plan')}</b><small>{t('Cambiar ejercicios o series, o rehacer la rutina')}</small></span><Ico n="caret-right" className="car" /></button>
          </div>
          {/* Lo que casi nunca hace falta, plegado: otro día de la rutina o un entreno sin plan. */}
          <details className="fold mt12">
            <summary>{t('Otras formas de entrenar')}<Ico n="caret-down" /></summary>
            <div className="in">
              <div className="list">
                <div className="it">
                  <span className="ico"><Ico n="calendar-blank" /></span>
                  <span className="tx">
                    <b>{t('Empezar otro día')}</b>
                    <small>{t('Si hoy prefieres hacer otro entreno')}</small>
                    <span className="chips ux-rut-otro">{r.dias.map(d => <button key={d.letra} className="chip" onClick={() => nav.hoja('hoja-empezar', { letra: d.letra })}>{tituloDia(d)}</button>)}</span>
                  </span>
                </div>
                <button className="it" onClick={() => void libre()}><span className="ico"><Ico n="lightning" /></span><span className="tx"><b>{t('Entreno libre')}</b><small>{t('Sin plan: añades ejercicios sobre la marcha')}</small></span><Ico n="caret-right" className="car" /></button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </Pantalla>
  )
}
