// SES-02 · Entreno en curso (con SES-03 descanso, SES-06 hora límite y SES-09 récord)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../datos/db'
import { marcaDe } from '../../datos/repos'
import { historialDe } from '../../datos/consultas'
import type { EjercicioSesion, Serie, Sesion } from '../../datos/tipos'
import { ejercicio, etiqueta, nombreEjercicio } from '../../catalogo/catalogo'
import { ES_MAQUINA, patron } from '../../catalogo/clasificacion'
import { calentamiento as aproximacion, pesosPara } from '../../dominio/pesos'
import { cambiarSerie, hecha, indiceActual, quitarUnaSerie, saltar, serieActual, terminada } from '../../dominio/sesion'
import { estadoHora, propuestaRecorte } from '../../dominio/tiempos'
import { esRecord, TEXTO_PARTIDA } from '../../dominio/progresion'
import { formatoHora } from '../../dominio/fechas'
import { kg } from '../../dominio/calculos'
import { cancelar, ID_AVISO, pantallaEncendida, pitido, programar, puedeVibrar, vibrar } from '../../plataforma'
import { cx, Ico, Pantalla, Th } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasio, useSesionEnCurso } from '../../datos/hooks'
import { conCalentamiento } from './iniciar'
import { FormCorregir } from './Corregir'
import { Panel } from './Panel'
import { t, tc } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'

async function guardar(s: Sesion) { await db.sesiones.put(s) }

export function Entreno() {
  const nav = useNav()
  const sesion = useSesionEnCurso()
  const ajustes = useAjustes()
  useEffect(() => {
    if (!ajustes.pantallaEncendida) return
    void pantallaEncendida(true)
    return () => { void pantallaEncendida(false) }
  }, [ajustes.pantallaEncendida])
  if (sesion === undefined) return <Pantalla full><div className="cargando">{t('Cargando…')}</div></Pantalla>
  if (sesion === null) return (
    <Pantalla full>
      <div className="pg" style={{ paddingTop: 40 }}>
        <div className="card pd empty"><span className="empty-ic"><Ico n="barbell" /></span><h3 className="h3">{t('No hay ningún entreno en curso')}</h3><button className="btn mt12" onClick={() => nav.completa(null)}>{t('Volver')}</button></div>
      </div>
    </Pantalla>
  )
  return <EntrenoEnCurso s={sesion} />
}

function EntrenoEnCurso({ s }: { s: Sesion }) {
  const nav = useNav()
  const aviso = useAviso()
  const ajustes = useAjustes()
  const g = useGimnasio()
  const [ahora, setAhora] = useState(Date.now())
  const [logro, setLogro] = useState<{ texto: string; nombre: string; valor: string } | null>(null)
  const [recorteVisto, setRecorteVisto] = useState<number>(0)
  // Avisos de arriba (semana de prueba, semana suave, entrenas solo) que se han cerrado con la ×.
  const [avisosCerrados, setAvisosCerrados] = useState<string[]>([])
  // Serie ya hecha que se está corrigiendo (se toca en la lista): ejercicio y posición de la serie.
  const [corr, setCorr] = useState<{ uid: string; n: number } | null>(null)
  const finAvisado = useRef<number | null>(null)
  // Fin del descanso en un móvil sin vibración (iPhone): la pantalla destella un momento.
  const [destello, setDestello] = useState(0)
  const tDestello = useRef<number | undefined>(undefined)
  const tLogro = useRef<number | undefined>(undefined)
  useEffect(() => { const reloj = setInterval(() => setAhora(Date.now()), 1000); return () => { clearInterval(reloj); window.clearTimeout(tLogro.current); window.clearTimeout(tDestello.current) } }, [])

  const idx = indiceActual(s)
  const e = idx >= 0 ? s.ejercicios[idx]! : undefined
  const ej = ejercicio(e?.ejercicio)
  const marca = useLiveQuery(() => (ej ? marcaDe(ej.id) : Promise.resolve(undefined)), [ej?.id])
  const hist = useLiveQuery(() => (ej ? historialDe(ej.id, s.id) : Promise.resolve([])), [ej?.id, s.id]) ?? []
  const lista = useMemo(() => (e && ej ? pesosPara(ej.material, e.registro, g) : []), [ej, e?.registro, g])

  // Descanso por marcas de tiempo: sobrevive a bloquear el móvil.
  const resto = s.descansoHasta ? Math.max(0, Math.round((s.descansoHasta - ahora) / 1000)) : 0
  useEffect(() => {
    if (s.descansoHasta && resto === 0 && finAvisado.current !== s.descansoHasta) {
      finAvisado.current = s.descansoHasta
      // Solo vibra si acaba de terminar: al volver a la pantalla (o abrir la app) mucho después, ya avisó la notificación.
      const recien = Date.now() - s.descansoHasta < 5000
      if (ajustes.vibrar && recien) void vibrar('fin')
      if (ajustes.sonido && recien) pitido()
      if (recien && !puedeVibrar()) {
        setDestello(s.descansoHasta)
        window.clearTimeout(tDestello.current)
        tDestello.current = window.setTimeout(() => setDestello(0), 1900)
      }
      void guardar({ ...s, descansoHasta: undefined })
    }
  }, [resto, s, ajustes.vibrar, ajustes.sonido])

  // Fin del entreno: al hacer la última serie se pasa al resumen. Solo en ese momento: si se vuelve desde el
  // resumen (para corregir una serie o añadir otro ejercicio), el entreno se queda abierto.
  const yaTerminada = useRef(s.ejercicios.length > 0 && terminada(s))
  useEffect(() => {
    const ahora = s.ejercicios.length > 0 && terminada(s)
    if (ahora && !yaTerminada.current) nav.completa('ses-fin', { id: s.id })
    yaTerminada.current = ahora
  }, [s, nav])

  const hora = estadoHora(s, ahora)
  const recorte = hora && !hora.aTiempo ? propuestaRecorte(s, hora.minutosTarde, nombreEjercicio) : null
  const verRecorte = recorte && hora && hora.minutosTarde > recorteVisto

  if (!e || !ej) return <SinEjercicio s={s} e={e} idx={idx} ahora={ahora} />

  const n = serieActual(e)
  const actual = e.series[n]
  const ultimaHist = hist[0]?.series.filter(x => !x.calentamiento) ?? null
  const topUltima = ultimaHist?.length ? ultimaHist.reduce((a, b) => ((b.peso ?? 0) > (a.peso ?? 0) ? b : a)) : null
  const trabajo = e.series.filter(x => !x.calentamiento)
  const calent = e.series.filter(x => x.calentamiento)
  const pesoHoy = trabajo.find(x => !x.hecha)?.peso ?? trabajo[0]?.peso ?? null
  const companero = e.superserie ? s.ejercicios.find(o => o.uid === e.superserie) : undefined
  const peligroso = ajustes.avisosSeguridad && ej.material === 'barbell' && ['empuje-h', 'rodilla'].includes(patron(ej))
  // Calentamiento sugerido: lo mismo que se enseña es lo que se añade (con la barra como mínimo).
  const sugeridas = calent.length === 0 && ajustes.calentamiento && n === 0 && e.registro === 'peso' && (pesoHoy ?? 0) >= 30
    ? aproximacion(pesoHoy!, lista, ej.material === 'barbell' ? (g?.barraKg ?? 20) : 0) : []
  // Primera vez con este ejercicio y aún sin ninguna serie hecha: el peso de «Hoy» es uno de partida.
  const primeraVez = !topUltima && !trabajo.some(x => x.hecha)

  // Un solo aviso corto arriba, y solo al empezar: la semana de prueba o suave al principio del entreno,
  // «entrenas solo» en la primera serie del ejercicio que lo pide. Se puede cerrar con la ×.
  const alEmpezar = !s.ejercicios.some(x => x.series.some(y => y.hecha))
  const partes: { ico: string; tono: string; texto: string }[] = []
  if (alEmpezar && s.calibracion) partes.push({ ico: 'gauge', tono: 'var(--blue-t)', texto: t('Semana de prueba: pesos cómodos, que te sobren 3 o 4 repeticiones.') })
  if (alEmpezar && s.suave) partes.push({ ico: 'feather', tono: 'var(--ok-t)', texto: t('Semana suave: 1 serie menos y −10 % de peso.') })
  if (peligroso && !e.series.some(x => x.hecha)) partes.push({ ico: 'first-aid', tono: 'var(--warn-t)', texto: t('Entrenas solo: usa las barras de seguridad y no llegues al límite.') })
  const textoAviso = partes.map(x => x.texto).join(' ')
  const verAviso = partes.length > 0 && !avisosCerrados.includes(textoAviso)
  // Terminar está en un solo sitio: «Lista» → «Terminar entreno».
  const kCorr = corr && corr.uid === e.uid && e.series[corr.n]?.hecha ? corr.n : null

  const hecho = async (datos: Pick<Serie, 'peso' | 'reps' | 'rpe' | 'segundos'>) => {
    if (!actual) return
    const eraCalent = actual.calentamiento
    const previas = [...hist.flatMap(h => h.series), ...e.series.filter(x => x.hecha)]
    const rec = !eraCalent ? esRecord({ ...actual, ...datos, hecha: true }, previas) : null
    const r = hecha(s, idx, datos)
    let nueva = r.sesion
    if (rec) nueva = cambiarSerie(nueva, idx, n, { record: true })
    const descanso = eraCalent ? 45 : r.descanso
    if (descanso > 0 && !terminada(nueva)) {
      nueva.descansoHasta = Date.now() + descanso * 1000
      nueva.descansoTotal = descanso
      void programar([{ id: ID_AVISO.descanso, titulo: t('Descanso terminado'), texto: t('{ejercicio} · siguiente serie', { ejercicio: nombreEjercicio(nueva.ejercicios[indiceActual(nueva)]?.ejercicio) }), cuando: new Date(nueva.descansoHasta) }], [ID_AVISO.descanso])
    } else nueva.descansoHasta = undefined
    await guardar(nueva)
    if (ajustes.vibrar) void vibrar('corta')
    if (rec) {
      setLogro({ texto: rec.tipo === 'peso' ? t('Nuevo récord de peso') : t('Récord de repeticiones'), nombre: ej.nombre, valor: `${kg(datos.peso)} kg × ${datos.reps}` })
      window.clearTimeout(tLogro.current)
      tLogro.current = window.setTimeout(() => setLogro(null), 2200)
    }
  }
  // La ficha está en la pestaña Rutina: hay que minimizar el entreno (sigue en la mini barra) para verla.
  const verFicha = () => { nav.minimizar(); nav.ir('rut-ficha', { id: ej.id }, 'rut') }
  const saltarDescanso = async () => { await guardar({ ...s, descansoHasta: undefined }); void cancelar([ID_AVISO.descanso]) }
  const masTiempo = async () => {
    if (!s.descansoHasta) return
    const hasta = s.descansoHasta + 15000
    await guardar({ ...s, descansoHasta: hasta, descansoTotal: (s.descansoTotal ?? 0) + 15 })
    void programar([{ id: ID_AVISO.descanso, titulo: t('Descanso terminado'), texto: t('Siguiente serie'), cuando: new Date(hasta) }], [ID_AVISO.descanso])
  }
  const aplicarRecorte = async () => {
    if (!recorte || !hora) return
    if (recorte.tipo === 'serie') { await guardar(quitarUnaSerie(s, recorte.uid)); aviso(t('Hecho: 1 serie menos')) }
    else {
      const r = await db.rutinas.get(s.rutinaId ?? -1)
      const dia = r?.dias.find(d => d.letra === s.letra)
      let nueva: Sesion = { ...s, version: 'corta' }
      for (const b of dia?.bloques ?? []) if (b.fueraEnCorta) {
        const i = nueva.ejercicios.findIndex(x => x.uid === b.uid && x.estado === 'pendiente')
        if (i >= 0) nueva = saltar(nueva, i)
      }
      await guardar(nueva)
      aviso(t('Pasado a la versión corta'))
    }
    setRecorteVisto(hora.minutosTarde + 3)
  }

  return (
    <Pantalla full>
      {destello > 0 && <div key={destello} className="destello" role="status" aria-live="assertive"><b><Ico n="bell-ringing" b />{t('Siguiente serie')}</b></div>}
      <div className="float">
        {logro && (
          <div className="ach ach-pop show" role="status">
            <span className="tro"><Ico n="trophy" b /></span>
            <span className="tx"><small className="au">{logro.texto}</small><b>{logro.nombre}</b><small className="mono">{logro.valor}</small></span>
          </div>
        )}
      </div>
      <div className="ses-top" style={{ paddingTop: 6 }}>
        <button className="ux-tbtn" onClick={() => nav.hoja('sheet-lista')} aria-label={t('Lista de la sesión')}><Ico n="list-numbers" /><span>{t('Lista')}</span></button>
        <div className="grow">
          <p className="lbl ux-ses-lbl">{t('Ejercicio {n} de {total}', { n: idx + 1, total: s.ejercicios.length })}</p>
          <div className="ux-ses-p">
            <div className="sprog">{s.ejercicios.map((x, i) => <i key={x.uid} className={cx(i === idx ? 'cur' : (x.estado === 'hecho' || x.estado === 'saltado') && 'on')} />)}</div>
            <span className="clock ux-llevas">{t('llevas {n} min', { n: Math.floor((ahora - s.inicio) / 60000) })}</span>
          </div>
        </div>
        {s.horaLimite && hora && (
          <button className="leave" style={hora.aTiempo ? undefined : { background: 'var(--warn-t)' }} onClick={() => setRecorteVisto(0)} aria-label={t('Te vas a las {hora}', { hora: formatoHora(s.horaLimite) })}>
            <small>{t('Te vas a las {hora}', { hora: formatoHora(s.horaLimite) })}</small>
            <b style={hora.aTiempo ? undefined : { color: 'var(--warn)' }}><Ico n={hora.aTiempo ? 'check' : 'clock-countdown'} b />{hora.aTiempo ? t('a tiempo') : t('{n} min tarde', { n: hora.minutosTarde })}</b>
          </button>
        )}
      </div>

      {verRecorte && recorte && (
        <div className="lateband show">
          <p><Ico n="clock-countdown" b /><span><b>{recorte.texto.split(' → ')[0]}</b> → {recorte.texto.split(' → ')[1]}</span></p>
          <div className="btns">
            <button className="btn sm" onClick={aplicarRecorte}>{t('Aplicar')}</button>
            <button className="btn gry sm" onClick={() => { setRecorteVisto(hora!.minutosTarde + 3); aviso(t('Vale, seguimos igual')) }}>{t('Ignorar')}</button>
          </div>
        </div>
      )}
      {verAviso && (
        <div className="safety ux-aviso" style={{ background: partes.length === 1 ? partes[0]!.tono : undefined }}>
          <Ico n={partes[0]!.ico} b />
          <span className="grow">{textoAviso}</span>
          <button className="ux-aviso-x" aria-label={t('Cerrar aviso')} onClick={() => setAvisosCerrados(c => [...c, textoAviso])}><Ico n="x" b /></button>
        </div>
      )}

      <div className="exb">
        <div className="exb-h">
          {/* Tocar el dibujo enseña cómo se hace sin salir del entreno. */}
          <button onClick={() => nav.hoja('sheet-instr', { id: ej.id })} aria-label={t('Ver cómo se hace')} style={{ display: 'contents' }}><Th ej={ej} size="l" grande /></button>
          <div className="grow">
            <p className="lbl">{etiqueta('body_part', ej.zona)}{companero ? ` · ${t('dos seguidos')}` : ''}</p>
            <h1 className="exname">{ej.nombre}</h1>
            {marca?.ajustes ? <p className="setting"><Ico n="sliders-horizontal" />{marca.ajustes}</p> : ES_MAQUINA(ej) && <button className="setting" onClick={verFicha}><Ico n="sliders-horizontal" />{t('Añadir ajustes de máquina')}</button>}
          </div>
          <button className="ux-tbtn" onClick={() => nav.hoja('sheet-tools', { idx })} aria-label={t('Herramientas')}><Ico n="dots-three" b /><span>{t('Más')}</span></button>
        </div>
        {/* Sin la tira «Series · Reps · Esfuerzo · Descanso»: las series ya se ven en la lista y el descanso sale solo. */}
        <div className="todayw">
          <div className="lastw">
            <p className="lbl">{t('La última vez')}</p>
            {topUltima ? <>
              <p className="mono"><b>{topUltima.peso != null ? `${kg(topUltima.peso)} kg × ${topUltima.reps}` : e.registro === 'tiempo' ? `${topUltima.reps ?? topUltima.segundos} s` : t('{n} reps', { n: String(topUltima.reps ?? topUltima.segundos) })}</b></p>
              <p className="small muted">{topUltima.rpe ? t('esfuerzo {n}', { n: topUltima.rpe }) : ''}</p>
            </> : <p className="small muted mt4">{t('Primera vez con este ejercicio')}</p>}
          </div>
          <div className="hoyw">
            <p className="lbl">{t('Hoy')}</p>
            {pesoHoy != null && e.registro !== 'corporal' && e.registro !== 'tiempo' ? (
              <>
                <p className="hoy-v mono">{kg(pesoHoy)}<small>kg</small>{topUltima?.peso != null && pesoHoy > topUltima.peso && <Ico n="arrow-up" b />}</p>
                {topUltima?.peso != null && pesoHoy !== topUltima.peso && <p className={cx('small', pesoHoy > topUltima.peso ? 'okc' : 'muted')}>{pesoHoy > topUltima.peso ? '+' : ''}{kg(pesoHoy - topUltima.peso)} kg</p>}
                {primeraVez && <p className="small muted">{t(TEXTO_PARTIDA)}</p>}
              </>
            ) : e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'
              ? <><p className="hoy-v mono">?<small>kg</small></p><p className="small muted">{t('Pon el peso abajo con + o −')}</p></>
              : <p className="hoy-v mono">{trabajo.find(x => !x.hecha)?.reps ?? trabajo.find(x => !x.hecha)?.segundos ?? e.repsMin}<small>{e.registro === 'tiempo' ? 's' : t('reps')}</small></p>}
          </div>
        </div>
      </div>

      <div className="sets">
        {calent.length > 0 && (
          <p className="set wu">
            <span className="sn">{tc('calentamiento', 'C')}</span>
            <span className="sv">{calent.map(x => `${kg(x.peso)}×${x.reps}`).join(' · ')}</span>
            <span className="se">{t('calentamiento')}</span>
            {calent.every(x => x.hecha) ? <Ico n="check" b /> : <Ico n="circle" />}
          </p>
        )}
        {sugeridas.length > 0 && (
          <button className="set wu" onClick={() => void guardar(conCalentamiento(s, idx, sugeridas))}>
            <span className="sn">{tc('calentamiento', 'C')}</span><span className="sv">{t('Añadir calentamiento sugerido')}</span><span className="se">{sugeridas.map(c => `${kg(c.peso)}×${c.reps}`).join(' · ')}</span><Ico n="plus" b />
          </button>
        )}
        {trabajo.map((x, k) => {
          const cur = x === actual
          const pos = e.series.indexOf(x)
          const fin = x.record ? <Ico n="trophy" b /> : x.hecha ? <Ico n="check" b /> : cur ? <Ico n="caret-down" b /> : <Ico n="circle" />
          // Una serie ya hecha se toca para corregirla (reps o peso mal apuntados con las prisas).
          if (x.hecha) return (
            <button key={x.n} className={cx('set done ux-tocable', x.record && 'rec', kCorr === pos && 'ux-corr')} onClick={() => setCorr({ uid: e.uid, n: pos })} aria-label={t('Corregir la serie {n}: {valor}', { n: k + 1, valor: textoSerie(x, e, false) })}>
              <span className="sn">{k + 1}</span>
              <span className="sv">{textoSerie(x, e, false)}</span>
              <span className="se"><Ico n="pencil-simple" /></span>
              {fin}
            </button>
          )
          return (
            <p key={x.n} className={cx('set', x.record && 'rec', cur && 'cur')}>
              <span className="sn">{k + 1}</span>
              <span className="sv">{textoSerie(x, e, cur)}</span>
              <span className="se">{cur ? t('ahora') : ''}</span>
              {fin}
            </p>
          )
        })}
      </div>

      {/* La clave cambia con el ejercicio hecho de verdad (sustituido por «ocupado» o «cambiar») y con la serie:
          así el panel arranca con el peso y las reps de la serie que toca, no con los de la anterior. */}
      {kCorr != null ? (
        <FormCorregir key={`${e.uid}-${kCorr}`} s={s} idx={idx} k={kCorr} className="panel" onCerrar={() => setCorr(null)} />
      ) : actual && <Panel key={`${e.uid}-${e.ejercicio}-${n}-${actual.n}`} s={s} idx={idx} e={e} serie={actual} lista={lista} ultimaHecha={[...e.series].reverse().find(x => x.hecha && !x.calentamiento)} onHecho={hecho}
        resto={resto} total={s.descansoTotal ?? e.descanso} onSaltar={saltarDescanso} onMas={masTiempo} />}
    </Pantalla>
  )
}

/** Sin ejercicio que hacer: el actual ya no está en el catálogo, todo está hecho o es un entreno libre vacío. */
function SinEjercicio({ s, e, idx, ahora }: { s: Sesion; e?: EjercicioSesion; idx: number; ahora: number }) {
  const nav = useNav()
  return (
    <Pantalla full>
      <div className="ses-top" style={{ paddingTop: 8 }}>
        <button className="ux-tbtn" onClick={() => nav.hoja('sheet-lista')} aria-label={t('Lista de la sesión')}><Ico n="list-numbers" /><span>{t('Lista')}</span></button>
        <div className="grow"><p className="lbl">{nombreEntreno(s)}</p></div>
        <span className="clock ux-llevas">{t('llevas {n} min', { n: Math.floor((ahora - s.inicio) / 60000) })}</span>
      </div>
      <div className="pg">
        {e ? (
          // Ejercicio que ya no está en el catálogo: sin esto la pantalla se quedaría atascada.
          <div className="card pd empty">
            <span className="empty-ic bad"><Ico n="warning" /></span>
            <h3 className="h3">{t('Este ejercicio ya no está en el catálogo')}</h3>
            <p className="muted">{t('Cámbialo por otro o sáltalo para seguir.')}</p>
            <button className="btn mt12" onClick={() => nav.hoja('sheet-elegir', { modo: 'sesion-cambiar', idx })}><Ico n="swap" b />{t('Cambiar ejercicio')}</button>
            <button className="btn gry sm mt8" onClick={() => void guardar(saltar(s, idx))}>{t('Saltarlo')}</button>
          </div>
        ) : s.ejercicios.length > 0 && terminada(s) ? (
          // Todo hecho y vuelto desde el resumen: se puede corregir en la Lista, añadir otro ejercicio o terminar.
          <div className="card pd empty">
            <span className="empty-ic"><Ico n="check" /></span>
            <h3 className="h3">{t('Has hecho todos los ejercicios')}</h3>
            <p className="muted">{t('Para corregir una serie, toca «Lista». Si quieres, añade otro ejercicio.')}</p>
            <button className="btn mt12" onClick={() => nav.completa('ses-fin', { id: s.id })}><Ico n="flag-checkered" b />{t('Terminar entreno')}</button>
            <button className="btn gry sm mt8" onClick={() => nav.hoja('sheet-elegir', { modo: 'sesion-anadir' })}><Ico n="plus" b />{t('Añadir ejercicio')}</button>
          </div>
        ) : (
          <div className="card pd empty">
            <span className="empty-ic"><Ico n="lightning" /></span>
            <h3 className="h3">{t('Entreno libre')}</h3>
            <p className="muted">{t('Añade el primer ejercicio y empieza.')}</p>
            <button className="btn mt12" onClick={() => nav.hoja('sheet-elegir', { modo: 'sesion-anadir' })}><Ico n="plus" b />{t('Añadir ejercicio')}</button>
            {s.ejercicios.length > 0 && <button className="btn gry sm mt8" onClick={() => nav.completa('ses-fin', { id: s.id })}>{t('Terminar entreno')}</button>}
          </div>
        )}
      </div>
    </Pantalla>
  )
}

function textoSerie(x: Serie, e: EjercicioSesion, cur: boolean): string {
  if (e.registro === 'tiempo') return x.hecha ? `${x.segundos ?? x.reps} s` : `${e.repsMin}-${e.repsMax} s`
  if (e.registro === 'corporal' || x.peso == null) return x.hecha ? t('{n} reps', { n: String(x.reps) }) : t('{n} reps', { n: `${e.repsMin}-${e.repsMax}` })
  const p = e.registro === 'asistido' ? t('asist. {n} kg', { n: kg(Math.abs(x.peso)) }) : `${kg(x.peso)} kg`
  return x.hecha ? `${p} × ${x.reps}` : `${p} × ${cur ? `${e.repsMin}-${e.repsMax}` : `${e.repsMin}-${e.repsMax}`}`
}
