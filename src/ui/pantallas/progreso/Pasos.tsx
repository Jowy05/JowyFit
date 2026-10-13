// PRO-08 · Actividad (pasos) y la hoja «Trote o carrera»
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { guardarAjustes } from '../../../datos/repos'
import { num } from '../../../dominio/calculos'
import { DIAS_CORTOS, deISO, diaSemana, hoyISO, sumarDias } from '../../../dominio/fechas'
import { pasosEquivalentes, PASOS_POR_KM, PASOS_POR_MINUTO } from '../../../dominio/tendencias'
import { esIPhone, pasosDisponibles, pedirPermisoPasos } from '../../../plataforma'
import { sincronizarPasos } from '../../servicios'
import { Anillo, Cab, Chip, cx, estilo, Hoja, Ico, Pantalla, Stepper } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, usePerfil } from '../../datos'

const miles = (n: number) => (n >= 1000 ? `${num(n / 1000, 1)}k` : String(n))

export function Pasos() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6))
  const registros = useLiveQuery(() => db.pasos.where('fecha').between(dias[0]!, hoy, true, true).toArray(), [hoy]) ?? []
  const [hc, setHc] = useState(false)
  const [conectando, setConectando] = useState(false)
  const iphone = esIPhone()
  useEffect(() => { let vivo = true; void pasosDisponibles().then(v => { if (vivo) setHc(v) }); return () => { vivo = false } }, [])

  const objetivo = perfil.pasosObjetivo || 8000
  const deDia = (f: string) => registros.find(r => r.fecha === f)
  const hoyR = deDia(hoy)
  const pasosHoy = hoyR?.pasos ?? 0
  const valores = dias.map(f => deDia(f)?.pasos ?? 0)
  const conDatos = registros.filter(r => r.pasos > 0)
  const media = conDatos.length ? Math.round(conDatos.reduce((t, r) => t + r.pasos, 0) / conDatos.length) : null
  const cumplidos = valores.filter(v => v >= objetivo).length
  const tope = Math.max(objetivo * 1.25, ...valores) || 1
  const auto = ajustes.fuentePasos === 'auto'

  const conectar = async () => {
    setConectando(true)
    try {
      if (!(await pedirPermisoPasos())) { aviso('Sin permiso para leer los pasos'); return }
      await guardarAjustes({ fuentePasos: 'auto' })
      const ok = await sincronizarPasos()
      aviso(ok ? 'Health Connect conectado' : 'Conectado. Los pasos llegarán en un momento')
    } finally { setConectando(false) }
  }
  const actualizar = async () => {
    setConectando(true)
    try { aviso((await sincronizarPasos()) ? 'Pasos actualizados' : 'No se pudieron leer los pasos') } finally { setConectando(false) }
  }

  const manual = <ApuntarPasos hoy={hoy} destacado={iphone} />

  return (
    <Pantalla>
      <Cab atras crumb="Pasos" titulo="Actividad" />
      <div className="pg">
        <div className="card pd row">
          <Anillo v={pasosHoy} total={objetivo} grande />
          <div className="grow">
            <span className="lbl">Hoy</span>
            <p className="tot-big mono">{num(pasosHoy, 0)}</p>
            <p className="small muted">de {num(objetivo, 0)} · {pasosHoy >= objetivo ? '¡objetivo cumplido!' : `faltan ${num(objetivo - pasosHoy, 0)}`}</p>
            {hoyR?.troteKm ? <p className="small muted">Incluye trote de {num(hoyR.troteKm)} km</p> : null}
          </div>
        </div>

        {iphone && (
          <div className="sec">
            <p className="note plain"><Ico n="device-mobile" /><span>En iPhone los pasos se apuntan a mano: mira los de Salud y escríbelos aquí.</span></p>
            <div className="mt8">{manual}</div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>Últimos 7 días</h2>{media != null && <span className="lbl mono">media {num(media, 0)}</span>}</div>
          <div className="card pd">
            <div className="vbars">
              {dias.map((f, i) => {
                const v = valores[i]!
                return (
                  <div key={f} className={cx(f === hoy ? 'now' : v > 0 && v < objetivo * 0.7 && 'lo')} style={estilo({ '--h': Math.round((v / tope) * 100) })}>
                    <b>{v ? miles(v) : '—'}</b><i /><span>{DIAS_CORTOS[diaSemana(deISO(f))]}</span>
                  </div>
                )
              })}
              <span className="vb-goal" style={estilo({ '--g': Math.round((objetivo / tope) * 100) })} />
            </div>
            <p className="small muted mt8"><span className="gkey" />Objetivo diario: <b className="mono">{num(objetivo, 0)}</b></p>
          </div>
          <div className="spec-box mt8"><div className="spec">
            <p><span>Objetivo diario</span><b className="goc">{num(objetivo, 0)}</b></p>
            <p><span>Días cumplidos</span><b>{cumplidos} de 7</b></p>
            <p><span>Fuente</span><b>{auto ? 'Health Connect' : 'A mano'}</b></p>
          </div></div>
        </div>

        {hc && !auto && (
          <div className="sec">
            <div className="card pd">
              <b>Pasos automáticos</b>
              <p className="small muted mt4">Conecta Health Connect y los pasos llegarán solos cada vez que abras la app.</p>
              <button className={cx('btn sm mt12', conectando && 'off')} onClick={() => void conectar()}><Ico n="heartbeat" b />Conectar Health Connect</button>
            </div>
          </div>
        )}
        {hc && auto && <button className={cx('btn ln sm mt16', conectando && 'off')} onClick={() => void actualizar()}><Ico n="arrows-clockwise" />Actualizar desde Health Connect</button>}

        {!iphone && <div className="sec"><div className="sec-h"><h2>Apuntar a mano</h2></div>{manual}</div>}

        <div className="btns mt16">
          <button className="btn sm" onClick={() => nav.hoja('sheet-trote')}><Ico n="person-simple-run" b />+ Trote / carrera</button>
        </div>
        {auto && <p className="small muted mt8 center">Con Health Connect, al sincronizar se usan sus pasos del día.</p>}
      </div>
    </Pantalla>
  )
}

function ApuntarPasos({ hoy, destacado }: { hoy: string; destacado: boolean }) {
  const aviso = useAviso()
  const ayer = sumarDias(hoy, -1)
  const [fecha, setFecha] = useState(hoy)
  const actual = useLiveQuery(() => db.pasos.get(fecha), [fecha])
  const [pasos, setPasos] = useState<number | null>(null)
  const valor = pasos ?? actual?.pasos ?? 0
  const guardar = async () => {
    const prev = await db.pasos.get(fecha)
    await db.pasos.put({ fecha, pasos: Math.max(0, Math.round(valor)), fuente: 'manual', troteKm: prev?.troteKm })
    setPasos(null)
    aviso(`Pasos guardados · ${fecha === hoy ? 'hoy' : 'ayer'}: ${num(valor, 0)}`)
  }
  return (
    <div className="card pd" style={destacado ? { borderColor: 'var(--go)', boxShadow: '0 0 0 1px var(--go)' } : undefined}>
      <div className="chips eq">
        <Chip on={fecha === hoy} onClick={() => { setFecha(hoy); setPasos(null) }}>Hoy</Chip>
        <Chip on={fecha === ayer} onClick={() => { setFecha(ayer); setPasos(null) }}>Ayer</Chip>
      </div>
      <Stepper className="mt12" valor={valor} onCambio={setPasos} paso={500} min={0} max={100000} decimales={0} sufijo="pasos" etiqueta="Pasos" />
      <p className="small muted mt8 center">Toca el número para escribirlo exacto</p>
      <button className="btn gry sm mt12" onClick={() => void guardar()}><Ico n="pencil-simple" />Guardar pasos</button>
    </div>
  )
}

// ---------- hoja: trote o carrera ----------

export function HojaTrote() {
  const nav = useNav()
  const aviso = useAviso()
  const [modo, setModo] = useState<'km' | 'min'>('km')
  const [km, setKm] = useState(3)
  const [min, setMin] = useState(20)
  const valor = modo === 'km' ? km : min
  const equivalen = pasosEquivalentes(valor, modo)

  const anadir = async () => {
    if (equivalen <= 0) { aviso('Pon cuántos kilómetros o minutos'); return }
    const hoy = hoyISO()
    const prev = await db.pasos.get(hoy)
    const kmTrote = modo === 'km' ? km : Math.round((equivalen / PASOS_POR_KM) * 10) / 10
    await db.pasos.put({ fecha: hoy, pasos: (prev?.pasos ?? 0) + equivalen, fuente: prev?.fuente ?? 'manual', troteKm: Math.round(((prev?.troteKm ?? 0) + kmTrote) * 10) / 10 })
    nav.hoja(null)
    aviso(`Añadido: trote de ${modo === 'km' ? `${num(km)} km` : `${min} min`} (≈ ${num(equivalen, 0)} pasos)`, () => {
      void (async () => {
        if (prev) await db.pasos.put(prev)
        else await db.pasos.delete(hoy)
      })()
    })
  }

  return (
    <Hoja titulo="Trote o carrera" sub="Lo pasamos a pasos equivalentes">
      <div className="chips eq">
        <Chip on={modo === 'km'} onClick={() => setModo('km')}>Kilómetros</Chip>
        <Chip on={modo === 'min'} onClick={() => setModo('min')}>Minutos</Chip>
      </div>
      {modo === 'km'
        ? <Stepper className="big mt12" valor={km} onCambio={setKm} paso={0.5} min={0} max={60} decimales={1} sufijo="km" etiqueta="Kilómetros" />
        : <Stepper className="big mt12" valor={min} onCambio={setMin} paso={5} min={0} max={300} decimales={0} sufijo="min" etiqueta="Minutos" />}
      <div className="spec-box mt12"><div className="spec">
        <p><span>Equivale a</span><b className="goc">≈ {num(equivalen, 0)} pasos</b></p>
        <p><span>Cálculo</span><b>{modo === 'km' ? `1 km ≈ ${PASOS_POR_KM} pasos` : `1 min ≈ ${PASOS_POR_MINUTO} pasos`}</b></p>
      </div></div>
      <button className="btn mt16" onClick={() => void anadir()}>Añadir</button>
    </Hoja>
  )
}
