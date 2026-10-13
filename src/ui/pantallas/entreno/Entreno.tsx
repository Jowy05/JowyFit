// SES-02 · Entreno en curso (con SES-03 descanso, SES-06 hora límite y SES-09 récord)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { marcaDe } from '../../../datos/repos'
import { historialDe } from '../../../datos/consultas'
import type { EjercicioSesion, Serie, Sesion } from '../../../datos/tipos'
import { ejercicio, etiqueta, nombreEjercicio } from '../../../catalogo/catalogo'
import { patron } from '../../../catalogo/clasificacion'
import { calentamiento as aproximacion, pesosPara } from '../../../dominio/pesos'
import { anadirCalentamiento, anadirSerie, cambiarSerie, hecha, indiceActual, quitarSerie, quitarUnaSerie, saltar, serieActual, terminada } from '../../../dominio/sesion'
import { estadoHora, propuestaRecorte } from '../../../dominio/tiempos'
import { esRecord } from '../../../dominio/progresion'
import { duracion, formatoHora } from '../../../dominio/fechas'
import { kg } from '../../../dominio/calculos'
import { cancelar, pantallaEncendida, programar, vibrar } from '../../../plataforma'
import { cx, estilo, Ico, Pantalla, Stepper, Th } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, useSesionEnCurso } from '../../datos'

const ID_AVISO_DESCANSO = 9001
const AYUDA_RPE: Record<number, string> = { 6: '6 = te quedaban 4 reps', 7: '7 = te quedaban 3 reps', 8: '8 = te quedaban 2 reps', 9: '9 = te quedaba 1 rep', 10: '10 = no podías ni una más' }

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
  if (sesion === undefined) return <Pantalla full><div className="cargando">Cargando…</div></Pantalla>
  if (sesion === null) return (
    <Pantalla full>
      <div className="pg" style={{ paddingTop: 40 }}>
        <div className="card pd empty"><span className="empty-ic"><Ico n="barbell" /></span><h3 className="h3">No hay ningún entreno en curso</h3><button className="btn mt12" onClick={() => nav.completa(null)}>Volver</button></div>
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
  const finAvisado = useRef<number | null>(null)
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t) }, [])

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
      if (ajustes.vibrar) void vibrar('fin')
      void guardar({ ...s, descansoHasta: undefined })
    }
  }, [resto, s, ajustes.vibrar])

  // Fin del entreno
  useEffect(() => {
    if (s.ejercicios.length && terminada(s)) nav.completa('ses-fin', { id: s.id })
  }, [s, nav])

  const hora = estadoHora(s, ahora)
  const recorte = hora && !hora.aTiempo ? propuestaRecorte(s, hora.minutosTarde, nombreEjercicio) : null
  const verRecorte = recorte && hora && hora.minutosTarde > recorteVisto

  if (!e || !ej) return (
    <Pantalla full>
      <div className="ses-top" style={{ paddingTop: 8 }}>
        <button className="ib sm" onClick={() => nav.hoja('sheet-lista')} aria-label="Lista de la sesión"><Ico n="list-numbers" /></button>
        <div className="grow"><p className="lbl">{s.nombre}</p></div>
        <span className="clock mono">{duracion((ahora - s.inicio) / 1000)}</span>
      </div>
      <div className="pg">
        <div className="card pd empty">
          <span className="empty-ic"><Ico n="lightning" /></span>
          <h3 className="h3">Entreno libre</h3>
          <p className="muted">Añade el primer ejercicio y empieza.</p>
          <button className="btn mt12" onClick={() => nav.hoja('sheet-elegir', { modo: 'sesion-anadir' })}><Ico n="plus" b />Añadir ejercicio</button>
          {s.ejercicios.length > 0 && <button className="btn gry sm mt8" onClick={() => nav.completa('ses-fin', { id: s.id })}>Terminar entreno</button>}
        </div>
      </div>
    </Pantalla>
  )

  const n = serieActual(e)
  const actual = e.series[n]
  const ultimaHist = hist[0]?.series.filter(x => !x.calentamiento) ?? null
  const topUltima = ultimaHist?.length ? ultimaHist.reduce((a, b) => ((b.peso ?? 0) > (a.peso ?? 0) ? b : a)) : null
  const trabajo = e.series.filter(x => !x.calentamiento)
  const calent = e.series.filter(x => x.calentamiento)
  const pesoHoy = trabajo.find(x => !x.hecha)?.peso ?? trabajo[0]?.peso ?? null
  const companero = e.superserie ? s.ejercicios.find(o => o.uid === e.superserie) : undefined
  const peligroso = ajustes.avisosSeguridad && ej.material === 'barbell' && ['empuje-h', 'rodilla'].includes(patron(ej))
  const diaTxt = s.letra === 'L' ? 'libre' : `día ${s.letra}`

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
      void programar([{ id: ID_AVISO_DESCANSO, titulo: 'Descanso terminado', texto: `${nombreEjercicio(nueva.ejercicios[indiceActual(nueva)]?.ejercicio)} · siguiente serie`, cuando: new Date(nueva.descansoHasta) }], [ID_AVISO_DESCANSO])
    } else nueva.descansoHasta = undefined
    await guardar(nueva)
    if (ajustes.vibrar) void vibrar('corta')
    if (rec) {
      setLogro({ texto: rec.tipo === 'peso' ? 'Nuevo récord de peso' : 'Récord de repeticiones', nombre: ej.nombre, valor: `${kg(datos.peso)} kg × ${datos.reps}` })
      setTimeout(() => setLogro(null), 2200)
    }
  }
  const saltarDescanso = async () => { await guardar({ ...s, descansoHasta: undefined }); void cancelar([ID_AVISO_DESCANSO]) }
  const masTiempo = async () => {
    if (!s.descansoHasta) return
    const hasta = s.descansoHasta + 15000
    await guardar({ ...s, descansoHasta: hasta, descansoTotal: (s.descansoTotal ?? 0) + 15 })
    void programar([{ id: ID_AVISO_DESCANSO, titulo: 'Descanso terminado', texto: 'Siguiente serie', cuando: new Date(hasta) }], [ID_AVISO_DESCANSO])
  }
  const aplicarRecorte = async () => {
    if (!recorte || !hora) return
    if (recorte.tipo === 'serie') { await guardar(quitarUnaSerie(s, recorte.uid)); aviso('Hecho: 1 serie menos') }
    else {
      const r = await db.rutinas.get(s.rutinaId ?? -1)
      const dia = r?.dias.find(d => d.letra === s.letra)
      let nueva: Sesion = { ...s, version: 'corta' }
      for (const b of dia?.bloques ?? []) if (b.fueraEnCorta) {
        const i = nueva.ejercicios.findIndex(x => x.uid === b.uid && x.estado === 'pendiente')
        if (i >= 0) nueva = saltar(nueva, i)
      }
      await guardar(nueva)
      aviso('Pasado a la versión corta')
    }
    setRecorteVisto(hora.minutosTarde + 3)
  }

  return (
    <Pantalla full>
      <div className="float">
        {logro && (
          <div className="ach ach-pop show" role="status">
            <span className="tro"><Ico n="trophy" b /></span>
            <span className="tx"><small className="au">{logro.texto}</small><b>{logro.nombre}</b><small className="mono">{logro.valor}</small></span>
          </div>
        )}
      </div>
      <div className="ses-top" style={{ paddingTop: 6 }}>
        <button className="ib sm" onClick={() => nav.hoja('sheet-lista')} aria-label="Lista de la sesión"><Ico n="list-numbers" /></button>
        <div className="grow">
          <p className="lbl">Ejercicio {idx + 1} de {s.ejercicios.length}</p>
          <div className="sprog">{s.ejercicios.map((x, i) => <i key={x.uid} className={cx(i === idx ? 'cur' : (x.estado === 'hecho' || x.estado === 'saltado') && 'on')} />)}</div>
        </div>
        <span className="clock mono">{duracion((ahora - s.inicio) / 1000)}</span>
        {s.horaLimite && hora && (
          <button className="leave" style={hora.aTiempo ? undefined : { background: 'var(--warn-t)' }} onClick={() => setRecorteVisto(0)} aria-label={`Te vas a las ${formatoHora(s.horaLimite)}`}>
            <small>Te vas a las {formatoHora(s.horaLimite)}</small>
            <b style={hora.aTiempo ? undefined : { color: 'var(--warn)' }}><Ico n={hora.aTiempo ? 'check' : 'clock-countdown'} b />{hora.aTiempo ? 'a tiempo' : `${hora.minutosTarde} min tarde`}</b>
          </button>
        )}
        <button className="ib sm" onClick={() => nav.hoja('sheet-lista')} aria-label="Menú"><Ico n="dots-three-vertical" b /></button>
      </div>

      {verRecorte && recorte && (
        <div className="lateband show">
          <p><Ico n="clock-countdown" b /><span><b>{recorte.texto.split(' → ')[0]}</b> → {recorte.texto.split(' → ')[1]}</span></p>
          <div className="btns">
            <button className="btn sm" onClick={aplicarRecorte}>Aplicar</button>
            <button className="btn gry sm" onClick={() => { setRecorteVisto(hora!.minutosTarde + 3); aviso('Vale, seguimos igual') }}>Ignorar</button>
          </div>
        </div>
      )}
      {peligroso && <p className="safety"><Ico n="first-aid" b />Entrenas solo: no vayas al fallo, usa las barras de seguridad.</p>}
      {s.calibracion && <p className="safety" style={{ background: 'var(--blue-t)', marginTop: 6 }}><Ico n="gauge" b className="blue" />Calibración: pesos cómodos (esfuerzo 6-7). Estamos midiendo tus tiempos.</p>}

      <div className="exb">
        <div className="exb-h">
          <button onClick={() => nav.ir('rut-ficha', { id: ej.id }, 'rut')} aria-label="Ver ficha" style={{ display: 'contents' }}><Th ej={ej} size="l" grande /></button>
          <div className="grow">
            <p className="lbl">{etiqueta('body_part', ej.zona)} · {diaTxt}{companero ? ' · superserie' : ''}</p>
            <h1 className="exname">{ej.nombre}</h1>
            {marca?.ajustes ? <p className="setting"><Ico n="sliders-horizontal" />{marca.ajustes}</p> : <button className="setting" onClick={() => nav.ir('rut-ficha', { id: ej.id }, 'rut')}><Ico n="sliders-horizontal" />Añadir ajustes de máquina</button>}
          </div>
          <button className="ib" onClick={() => nav.hoja('sheet-tools', { idx })} aria-label="Herramientas"><Ico n="dots-three" b /></button>
        </div>
        <div className="strip">
          <p><span className="lbl">Series</span><b>{trabajo.length}</b></p>
          <p><span className="lbl">{e.registro === 'tiempo' ? 'Segundos' : e.registro === 'cardio' ? 'Minutos' : 'Reps'}</span><b>{e.repsMin}-{e.repsMax}</b></p>
          <p><span className="lbl">Esfuerzo</span><b>{e.rpe}</b></p>
          <p><span className="lbl">Descanso</span><b>{duracion(e.descanso)}</b></p>
        </div>
        <div className="todayw">
          <div className="lastw">
            <p className="lbl">La última vez</p>
            {topUltima ? <>
              <p className="mono"><b>{topUltima.peso != null ? `${kg(topUltima.peso)} kg × ${topUltima.reps}` : `${topUltima.reps ?? topUltima.segundos}${e.registro === 'tiempo' ? ' s' : ' reps'}`}</b></p>
              <p className="small muted">{topUltima.rpe ? `esfuerzo ${topUltima.rpe}` : ''}</p>
            </> : <p className="small muted mt4">Primera vez: elige un peso cómodo (esfuerzo 6-7)</p>}
          </div>
          <div className="hoyw">
            <p className="lbl">Hoy</p>
            {pesoHoy != null && e.registro !== 'corporal' && e.registro !== 'tiempo' ? (
              <>
                <p className="hoy-v mono">{kg(pesoHoy)}<small>kg</small>{topUltima?.peso != null && pesoHoy > topUltima.peso && <Ico n="arrow-up" b />}</p>
                {topUltima?.peso != null && pesoHoy !== topUltima.peso && <p className={cx('small', pesoHoy > topUltima.peso ? 'okc' : 'muted')}>{pesoHoy > topUltima.peso ? '+' : ''}{kg(pesoHoy - topUltima.peso)} kg</p>}
              </>
            ) : e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'
              ? <><p className="hoy-v mono">?<small>kg</small></p><p className="small muted">elige uno cómodo</p></>
              : <p className="hoy-v mono">{trabajo.find(x => !x.hecha)?.reps ?? trabajo.find(x => !x.hecha)?.segundos ?? e.repsMin}<small>{e.registro === 'tiempo' ? 's' : 'reps'}</small></p>}
          </div>
        </div>
      </div>

      <div className="sets">
        {calent.length > 0 && (
          <p className="set wu">
            <span className="sn">C</span>
            <span className="sv">{calent.map(x => `${kg(x.peso)}×${x.reps}`).join(' · ')}</span>
            <span className="se">calentamiento</span>
            {calent.every(x => x.hecha) ? <Ico n="check" b /> : <Ico n="circle" />}
          </p>
        )}
        {calent.length === 0 && ajustes.calentamiento && n === 0 && (e.registro === 'peso') && (pesoHoy ?? 0) >= 30 && (
          <button className="set wu" onClick={() => void guardar(anadirCalentamiento(s, idx, aproximacion(pesoHoy!, lista, ej.material === 'barbell' ? (g?.barraKg ?? 20) : 0)))}>
            <span className="sn">C</span><span className="sv">Añadir calentamiento sugerido</span><span className="se">{aproximacion(pesoHoy!, lista).map(c => `${kg(c.peso)}×${c.reps}`).join(' · ')}</span><Ico n="plus" b />
          </button>
        )}
        {trabajo.map(x => {
          const cur = x === actual
          return (
            <p key={x.n} className={cx('set', x.hecha && 'done', x.record && 'rec', cur && 'cur')}>
              <span className="sn">{x.n - calent.length}</span>
              <span className="sv">{textoSerie(x, e, cur)}</span>
              <span className="se">{cur ? 'ahora' : x.hecha ? (x.rpe ? `esf. ${x.rpe}` : '') : `esf. ${e.rpe}`}</span>
              {x.record ? <Ico n="trophy" b /> : x.hecha ? <Ico n="check" b /> : cur ? <Ico n="caret-down" b /> : <Ico n="circle" />}
            </p>
          )
        })}
      </div>

      {actual && <Panel key={`${e.uid}-${n}`} s={s} idx={idx} e={e} serie={actual} lista={lista} ultimaHecha={[...e.series].reverse().find(x => x.hecha && !x.calentamiento)} onHecho={hecho}
        resto={resto} total={s.descansoTotal ?? e.descanso} onSaltar={saltarDescanso} onMas={masTiempo} />}
    </Pantalla>
  )
}

function textoSerie(x: Serie, e: EjercicioSesion, cur: boolean): string {
  if (e.registro === 'tiempo') return x.hecha ? `${x.segundos ?? x.reps} s` : `${e.repsMin}-${e.repsMax} s`
  if (e.registro === 'corporal' || x.peso == null) return x.hecha ? `${x.reps} reps` : `${e.repsMin}-${e.repsMax} reps`
  const p = e.registro === 'asistido' ? `asist. ${kg(Math.abs(x.peso))} kg` : `${kg(x.peso)} kg`
  return x.hecha ? `${p} × ${x.reps}` : `${p} × ${cur ? `${e.repsMin}-${e.repsMax}` : `${e.repsMin}-${e.repsMax}`}`
}

function Panel({ s, idx, e, serie, lista, ultimaHecha, onHecho, resto, total, onSaltar, onMas }: {
  s: Sesion; idx: number; e: EjercicioSesion; serie: Serie; lista: number[]; ultimaHecha?: Serie
  onHecho: (d: Pick<Serie, 'peso' | 'reps' | 'rpe' | 'segundos'>) => Promise<void>
  resto: number; total: number; onSaltar: () => void; onMas: () => void
}) {
  const nav = useNav()
  const aviso = useAviso()
  const [peso, setPeso] = useState<number | null>(serie.peso)
  const [reps, setReps] = useState<number>(serie.reps ?? e.repsMin)
  const [seg, setSeg] = useState<number>(serie.segundos ?? e.repsMin)
  const [rpe, setRpe] = useState<number | null>(serie.calentamiento ? null : e.rpe)
  const [crono, setCrono] = useState<number | null>(null)
  const [ahora, setAhora] = useState(Date.now())
  const pulsado = useRef<number | undefined>(undefined)
  useEffect(() => { if (crono == null) return; const t = setInterval(() => setAhora(Date.now()), 250); return () => clearInterval(t) }, [crono])
  const conPeso = e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'
  const datos = () => ({ peso: conPeso ? peso : null, reps: e.registro === 'tiempo' ? null : reps, segundos: e.registro === 'tiempo' ? seg : null, rpe })
  const proxima = s.ejercicios[indiceActual(s)]

  if (resto > 0) return (
    <div className="panel">
      <div className="rest flex" style={{ display: 'flex', position: 'relative', inset: 'auto', animation: 'none', padding: 0 }}>
        <div className="rest-top">
          <div className={cx('ring', resto <= 0 && 'ended')} style={estilo({ '--pct': `${Math.max(0, Math.min(100, (resto / Math.max(1, total)) * 100))}%` })}>
            <div><span className="lbl">Descanso</span><b className="mono">{duracion(resto)}</b><small className="muted">de {duracion(total)}</small></div>
          </div>
          <div className="rest-r">
            <p className="lbl">Próxima</p>
            <p className="rest-n">{proxima && proxima.uid !== e.uid ? nombreEjercicio(proxima.ejercicio) : `Serie ${serie.n - e.series.filter(x => x.calentamiento).length}`}</p>
            <p className="mono rest-w">{conPeso && serie.peso != null ? `${kg(e.registro === 'asistido' ? Math.abs(serie.peso) : serie.peso)} kg × ${e.repsMin}-${e.repsMax}` : `${e.repsMin}-${e.repsMax} ${e.registro === 'tiempo' ? 's' : 'reps'}`}</p>
            <p className="small muted mt8">Mientras, puedes mirar el ejercicio o apuntar una nota.</p>
          </div>
        </div>
        <div className="rest-btns mt12">
          <button className="btn gry busy big56" onClick={() => nav.hoja('sheet-ocup', { idx: indiceActual(s) })}><Ico n="hand-palm" b />Ocupado</button>
          <button className="btn gry big56" onClick={onMas}>+15 s</button>
          <button className="btn big56" onClick={onSaltar}><Ico n="skip-forward" b />Saltar</button>
        </div>
      </div>
    </div>
  )

  const segundosCrono = crono != null ? Math.round((ahora - crono) / 1000) : 0
  return (
    <div className="panel">
      {e.registro === 'tiempo' ? (
        <div className="pn-row">
          <div className="pn-f w"><span className="lbl">Segundos</span><Stepper className="tall" valor={crono != null ? segundosCrono : seg} paso={5} min={5} onCambio={setSeg} /></div>
          <div className="pn-f"><span className="lbl">Cronómetro</span>
            <button className={cx('btn', crono != null ? 'badf' : 'gry')} style={{ minHeight: 60 }} onClick={() => { if (crono == null) { setCrono(Date.now()); setAhora(Date.now()) } else { setSeg(segundosCrono); setCrono(null) } }}>
              <Ico n={crono != null ? 'pause' : 'play'} b />{crono != null ? 'Parar' : 'Empezar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="pn-row">
          {conPeso && (
            <div className="pn-f w">
              <span className="lbl">{e.registro === 'asistido' ? 'Asistencia · kg' : e.registro === 'mancuerna' ? 'Kg por mancuerna' : 'Peso · kg'}</span>
              <Stepper className="tall" valor={peso} lista={lista} paso={2.5} onCambio={setPeso} etiqueta="Peso" />
            </div>
          )}
          <div className={cx('pn-f', !conPeso && 'w')}>
            <span className="lbl">{e.registro === 'cardio' ? 'Minutos' : 'Reps'}</span>
            <Stepper className="tall" valor={reps} paso={1} min={1} onCambio={setReps} etiqueta="Repeticiones" />
          </div>
        </div>
      )}
      {!serie.calentamiento && e.registro !== 'cardio' && (
        <div className="pn-eff">
          <span className="lbl">Esfuerzo <span className="hint">· mantén pulsado para ayuda</span></span>
          <div className="effs">
            {[6, 7, 8, 9, 10].map(v => (
              <button key={v} className={cx('eff', rpe === v && 'on')} onClick={() => setRpe(v)}
                onPointerDown={() => { pulsado.current = window.setTimeout(() => aviso(AYUDA_RPE[v]!), 450) }}
                onPointerUp={() => clearTimeout(pulsado.current)} onPointerLeave={() => clearTimeout(pulsado.current)}>{v}</button>
            ))}
          </div>
        </div>
      )}
      <div className="pn-tools">
        <button className="tb" aria-label="Nota" onClick={() => nav.hoja('sheet-nota-serie', { idx, n: serie.n - 1 })}><Ico n="note-pencil" /></button>
        <button className={cx('tb', serie.calentamiento && 'on')} aria-label="Marcar calentamiento" style={serie.calentamiento ? { color: 'var(--warn)' } : undefined}
          onClick={async () => { await guardar(cambiarSerie(s, idx, serie.n - 1, { calentamiento: !serie.calentamiento })); aviso(serie.calentamiento ? 'Ya no es calentamiento' : 'Marcada como calentamiento') }}><Ico n="thermometer-simple" /></button>
        <button className="tb" aria-label="Añadir serie" onClick={async () => { await guardar(anadirSerie(s, idx)); aviso('Serie añadida') }}><Ico n="plus-square" /></button>
        <button className="tb" aria-label="Quitar serie" onClick={async () => { const antes = s; await guardar(quitarSerie(s, idx)); aviso('Serie quitada', () => void guardar(antes)) }}><Ico n="minus-square" /></button>
        <button className="tb same" disabled={!ultimaHecha} onClick={() => ultimaHecha && void onHecho({ peso: ultimaHecha.peso, reps: ultimaHecha.reps, segundos: ultimaHecha.segundos ?? null, rpe: ultimaHecha.rpe })}><Ico n="copy" />Igual que la anterior</button>
      </div>
      <div className="pn-main">
        <button className="btn gry busy" onClick={() => nav.hoja('sheet-ocup', { idx })}><Ico n="hand-palm" b />Ocupado</button>
        <button className="btn xl" onClick={() => { if (crono != null) { setSeg(segundosCrono); setCrono(null) } void onHecho(crono != null ? { ...datos(), segundos: segundosCrono } : datos()) }}><Ico n="check" b />Hecho</button>
      </div>
    </div>
  )
}
