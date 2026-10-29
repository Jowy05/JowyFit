// PRO-08 · Pasos (y la hoja «Trote o carrera»). Lo principal: apuntar los pasos de hoy.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { pasosDelDia, pasosEntre } from '../../datos/consultas'
import { guardarPasos, sumarTrote } from '../../datos/acciones/cuerpo'
import { guardarAjustes, guardarPerfil } from '../../datos/repos'
import { num } from '../../dominio/formato'
import { DIAS_CORTOS, deISO, diaSemana, hoyISO, sumarDias } from '../../dominio/fechas'
import { pasosEquivalentes, PASOS_POR_KM, PASOS_POR_MINUTO } from '../../dominio/tendencias'
import { hayPasos } from '../../dominio/cardio'
import { capacidades, pasosDisponibles, pedirPermisoPasos } from '../../plataforma'
import { sincronizarPasos } from '../../app/servicios'
import { Anillo, Cab, Chip, cx, estilo, Hoja, Ico, Pantalla, Stepper, useUnaVez } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, usePerfil } from '../../datos/hooks'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

const miles = (n: number) => (n >= 1000 ? `${num(n / 1000, 1)}k` : String(n))

export function Pasos() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6))
  const registros = useLiveQuery(async () => (await pasosEntre(dias[0]!, hoy)).filter(hayPasos), [hoy]) ?? []
  const [hc, setHc] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [editaObjetivo, setEditaObjetivo] = useState(false)
  const cap = capacidades()
  useEffect(() => { let vivo = true; void pasosDisponibles().then(v => { if (vivo) setHc(v) }); return () => { vivo = false } }, [])

  const objetivo = perfil.pasosObjetivo || 8000
  const deDia = (f: string) => registros.find(r => r.fecha === f)
  const hoyR = deDia(hoy)
  const pasosHoy = hoyR?.pasos ?? 0
  const valores = dias.map(f => deDia(f)?.pasos ?? 0)
  const conDatos = registros.filter(r => r.pasos > 0)
  const media = conDatos.length ? Math.round(conDatos.reduce((suma, r) => suma + r.pasos, 0) / conDatos.length) : null
  const cumplidos = valores.filter(v => v >= objetivo).length
  const tope = Math.max(objetivo * 1.25, ...valores) || 1
  // Solo en Android llegan solos: una copia traída de Android a un iPhone no deja los pasos sin poder apuntarlos.
  const auto = ajustes.fuentePasos === 'auto' && cap.salud

  const conectar = async () => {
    setConectando(true)
    try {
      if (!(await pedirPermisoPasos())) { aviso(t('Sin permiso para leer los pasos')); return }
      await guardarAjustes({ fuentePasos: 'auto' })
      const ok = await sincronizarPasos()
      aviso(ok ? t('Health Connect conectado') : t('Conectado. Los pasos llegarán en un momento'))
    } finally { setConectando(false) }
  }
  const actualizar = async () => {
    setConectando(true)
    try { aviso((await sincronizarPasos()) ? t('Pasos actualizados') : t('No se pudieron leer los pasos')) } finally { setConectando(false) }
  }

  const manual = <ApuntarPasos hoy={hoy} />

  // El objetivo diario se cambia aquí mismo.
  const objetivoEditable = (
    <div className="card pd mt8">
      <button type="button" className="row jb w100 pasos-obj" onClick={() => setEditaObjetivo(v => !v)} aria-expanded={editaObjetivo}>
        <span className="tx"><span className="lbl">{t('Objetivo diario')}</span><b className="mono goc"> {t('{n} pasos', { n: num(objetivo, 0) })}</b></span>
        <span className="lnk">{editaObjetivo ? t('Listo') : <><Ico n="pencil-simple" />{t('Cambiar')}</>}</span>
      </button>
      {editaObjetivo && (
        <>
          <Stepper className="mt12" valor={objetivo} paso={500} min={2000} max={20000} decimales={0} sufijo={t('pasos')} etiqueta={t('Objetivo de pasos')}
            onCambio={v => { void guardarPerfil({ pasosObjetivo: v }) }} />
          <p className="small muted mt8 center">{t('8000 es un buen objetivo para casi todo el mundo.')}</p>
        </>
      )}
      <p className="small muted mt8">{tr('Días cumplidos esta semana: {dias} · {como}', { dias: <b>{t('{n} de 7', { n: cumplidos })}</b>, como: auto ? t('llegan solos de Health Connect') : t('los apuntas tú') })}</p>
    </div>
  )

  return (
    <Pantalla>
      <Cab atras crumb={t('Actividad')} titulo={t('Pasos')} />
      <div className="pg">
        <div className="card pd row">
          <Anillo v={pasosHoy} total={objetivo} grande />
          <div className="grow">
            <span className="lbl">{t('Hoy')}</span>
            <p className="tot-big mono">{num(pasosHoy, 0)}</p>
            <p className="small muted">{t('de {n}', { n: num(objetivo, 0) })} · {pasosHoy >= objetivo ? t('¡objetivo cumplido!') : t('faltan {n}', { n: num(objetivo - pasosHoy, 0) })}</p>
            {hoyR?.troteKm ? <p className="small muted">{t('Incluye trote de {n} km', { n: num(hoyR.troteKm) })}</p> : null}
          </div>
        </div>

        {cap.pasosAMano && <p className="note plain mt12"><Ico n="device-mobile" /><span>{cap.aparatoApple === 'ipad' ? t('En iPad los pasos se apuntan a mano: mira los de Salud y escríbelos aquí.') : t('En iPhone los pasos se apuntan a mano: mira los de Salud y escríbelos aquí.')}</span></p>}

        {hc && auto && <button className={cx('btn mt16', conectando && 'off')} disabled={conectando} onClick={() => void actualizar()}><Ico n="arrows-clockwise" b />{t('Actualizar desde Health Connect')}</button>}

        {/* Lo que viene a hacer casi todo el mundo: apuntar los pasos de hoy. */}
        {!auto && <div className="sec">{manual}</div>}

        <div className="btns mt12">
          <button className="btn gry sm" onClick={() => nav.hoja('hoja-trote')}><Ico n="person-simple-run" b />{t('+ Trote / carrera')}</button>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>{t('Últimos 7 días')}</h2>{media != null && <span className="lbl mono">{t('media {n}', { n: num(media, 0) })}</span>}</div>
          {/* Con menos de 2 días apuntados, una frase: un recuadro casi vacío no dice nada. */}
          {conDatos.length < 2 ? (
            <p className="small muted chart-vacia"><Ico n="chart-bar" className="blue" /> {t('Apunta tus pasos unos días y verás aquí las barras.')}</p>
          ) : (
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
              <p className="small muted mt8"><span className="gkey" />{t('La raya es tu objetivo diario')}</p>
            </div>
          )}
          {objetivoEditable}
        </div>

        {hc && !auto && (
          <div className="sec">
            <div className="card pd">
              <b>{t('Pasos automáticos')}</b>
              <p className="small muted mt4">{t('Conecta Health Connect y los pasos llegarán solos cada vez que abras la app.')}</p>
              <button className={cx('btn gry sm mt12', conectando && 'off')} disabled={conectando} onClick={() => void conectar()}><Ico n="heartbeat" b />{t('Conectar Health Connect')}</button>
            </div>
          </div>
        )}

        {auto && (
          <details className="fold mt16">
            <summary><Ico n="pencil-simple" className="blue" />{t('Apuntar a mano')} <Ico n="caret-down" /></summary>
            <div className="in">
              {manual}
              <p className="small muted mt8 center">{t('Con Health Connect, al sincronizar se usan sus pasos del día.')}</p>
            </div>
          </details>
        )}
      </div>
    </Pantalla>
  )
}

function ApuntarPasos({ hoy }: { hoy: string }) {
  const aviso = useAviso()
  const ayer = sumarDias(hoy, -1)
  const [fecha, setFecha] = useState(hoy)
  const actual = useLiveQuery(() => pasosDelDia(fecha), [fecha])
  const [pasos, setPasos] = useState<number | null>(null)
  const valor = pasos ?? actual?.pasos ?? 0
  const guardar = async () => {
    await guardarPasos(fecha, valor)
    setPasos(null)
    aviso(fecha === hoy ? t('Pasos guardados · hoy: {n}', { n: num(valor, 0) }) : t('Pasos guardados · ayer: {n}', { n: num(valor, 0) }))
  }
  return (
    <div className="card pd">
      <p className="lbl">{t('Apuntar pasos')}</p>
      <div className="chips eq mt8">
        <Chip on={fecha === hoy} onClick={() => { setFecha(hoy); setPasos(null) }}>{t('Hoy')}</Chip>
        <Chip on={fecha === ayer} onClick={() => { setFecha(ayer); setPasos(null) }}>{t('Ayer')}</Chip>
      </div>
      <Stepper className="mt12" valor={valor} onCambio={setPasos} paso={500} min={0} max={100000} decimales={0} sufijo={t('pasos')} etiqueta={t('Pasos')} />
      <p className="small muted mt8 center">{t('Toca el número para escribirlo exacto')}</p>
      <button className="btn mt12" onClick={() => void guardar()}><Ico n="check" b />{t('Guardar pasos')}</button>
    </div>
  )
}

export function HojaTrote() {
  const nav = useNav()
  const aviso = useAviso()
  const [modo, setModo] = useState<'km' | 'min'>('km')
  const [km, setKm] = useState(3)
  const [min, setMin] = useState(20)
  const unaVez = useUnaVez()
  const valor = modo === 'km' ? km : min
  const equivalen = pasosEquivalentes(valor, modo)

  // Un doble toque no suma el trote dos veces a los pasos del día.
  const anadir = unaVez(async () => {
    if (equivalen <= 0) { aviso(t('Pon cuántos kilómetros o minutos')); return }
    const kmTrote = modo === 'km' ? km : Math.round((equivalen / PASOS_POR_KM) * 10) / 10
    const deshacer = await sumarTrote(hoyISO(), equivalen, kmTrote)
    nav.hoja(null)
    aviso(t('Añadido: trote de {cuanto} (≈ {n} pasos)', { cuanto: modo === 'km' ? `${num(km)} km` : `${min} min`, n: num(equivalen, 0) }), deshacer)
  })

  return (
    <Hoja titulo={t('Trote o carrera')} sub={t('Lo pasamos a pasos equivalentes')}>
      <div className="chips eq">
        <Chip on={modo === 'km'} onClick={() => setModo('km')}>{t('Kilómetros')}</Chip>
        <Chip on={modo === 'min'} onClick={() => setModo('min')}>{t('Minutos')}</Chip>
      </div>
      {modo === 'km'
        ? <Stepper className="big mt12" valor={km} onCambio={setKm} paso={0.5} min={0} max={60} decimales={1} sufijo="km" etiqueta={t('Kilómetros')} />
        : <Stepper className="big mt12" valor={min} onCambio={setMin} paso={5} min={0} max={300} decimales={0} sufijo="min" etiqueta={t('Minutos')} />}
      <div className="spec-box mt12"><div className="spec">
        <p><span>{t('Equivale a')}</span><b className="goc">{t('≈ {n} pasos', { n: num(equivalen, 0) })}</b></p>
        <p><span>{t('Cálculo')}</span><b>{modo === 'km' ? t('1 km ≈ {n} pasos', { n: num(PASOS_POR_KM, 0) }) : t('1 min ≈ {n} pasos', { n: num(PASOS_POR_MINUTO, 0) })}</b></p>
      </div></div>
      <button className="btn mt16" onClick={() => void anadir()}>{t('Añadir')}</button>
    </Hoja>
  )
}
