// INI-01 · Tarjetas de Inicio que salen solo a veces: semana suave, «¿Voy bien?», pendientes de hoy, tu progreso y el cardio.
import { useEffect, useState, type ReactElement } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarAjustes } from '../../datos/repos'
import { datosSemana, leerMetas, minutosCardio, sesionesHechas } from '../../datos/consultas'
import type { Rutina, TipoCardio } from '../../datos/tipos'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { DIAS, deISO, diaSemana, fechaCorta, hoyISO, lunesDe, semanaDe } from '../../dominio/fechas'
import { nombreCardio, TIPOS_CARDIO } from '../../dominio/cardio'
import { propuestaDescarga } from '../../dominio/descarga'
import { racha } from '../../dominio/semana'
import { resumenSemana } from '../../dominio/resumen'
import { recordsEn, subidas } from '../../dominio/tendencias'
import { kg } from '../../dominio/formato'
import { batidoDe, esBatido } from '../../dominio/comida'
import { Barra, cx, Ico, Seccion, useUnaVez } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, usePerfil } from '../../datos/hooks'
import { pendientesDeHoy } from '../../datos/pendientes'
import { marcarSuplemento } from '../../datos/acciones/comida'
import { capacidades } from '../../plataforma'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

/** Semana suave (descarga): la propone la app cuando toca; en la semana suave, un recordatorio. */
export function SemanaSuave({ rutina }: { rutina: Rutina | null }) {
  const ajustes = useAjustes()
  const aviso = useAviso()
  const hoy = hoyISO()
  const lunes = lunesDe(hoy)
  const enSuave = ajustes.semanaSuave === lunes
  const prop = useLiveQuery(async () => {
    if (!rutina || rutina.calibracion || enSuave) return null
    return propuestaDescarga({
      hoy, sesiones: await sesionesHechas(),
      ejerciciosRutina: rutina.dias.flatMap(d => d.bloques.map(b => b.ejercicio)),
      semanaSuave: ajustes.semanaSuave ?? null, pospuesta: ajustes.suavePospuesta ?? null, nombre: nombreEjercicio,
    })
  }, [rutina?.id, ajustes.semanaSuave, ajustes.suavePospuesta, hoy, enSuave])
  if (enSuave) {
    return (
      <div className="sec">
        <div className="note">
          <Ico n="feather" />
          <span>{tr('<b>Semana suave.</b> Mismos ejercicios, 1 serie menos y −10 % de peso. La semana que viene, vuelta a lo normal.', { b: s => <b>{s}</b> })}{' '}
            <button className="lnk" style={{ display: 'inline', padding: 0, margin: 0 }} onClick={async () => { await guardarAjustes({ semanaSuave: null, suavePospuesta: lunes }); aviso(t('Vuelta a lo normal')) }}>{t('Volver a lo normal')}</button>
          </span>
        </div>
      </div>
    )
  }
  if (!prop) return null
  return (
    <div className="sec">
      <div className="card pd">
        <div className="row">
          <span className="ico big okb"><Ico n="feather" /></span>
          <div className="grow">
            <h3 className="h3">{t('¿Semana suave?')}</h3>
            <p className="small muted">{t('{motivo}. Mismos ejercicios, 1 serie menos y −10 % de peso: el cuerpo asimila y luego subes mejor.', { motivo: prop.motivo })}</p>
          </div>
        </div>
        <div className="btns mt12">
          <button className="btn gry sm" onClick={async () => { await guardarAjustes({ suavePospuesta: lunes }); aviso(t('Vale: lo vemos la semana que viene')) }}>{t('Ahora no')}</button>
          <button className="btn sm" onClick={async () => { await guardarAjustes({ semanaSuave: lunes, suavePospuesta: null }); aviso(t('Semana suave: los entrenos de esta semana van más ligeros')) }}>{t('Sí, esta semana')}</button>
        </div>
      </div>
    </div>
  )
}

/** «¿Voy bien?» del domingo, con el semáforo de la semana. */
export function VoyBien({ rutina }: { rutina: Rutina | null }) {
  const nav = useNav()
  const perfil = usePerfil()
  const hoy = hoyISO()
  const r = useLiveQuery(async () => {
    const dias = semanaDe(hoy)
    const domingo = dias[6]!
    const { sesiones, mediciones, comidas, pasos, energia } = await datosSemana(dias[0]!, perfil)
    const hayDatos = sesiones.some(s => dias.includes(s.fecha)) || mediciones.some(m => dias.includes(m.fecha.slice(0, 10)))
      || comidas.some(c => dias.includes(c.fecha)) || pasos.some(p => dias.includes(p.fecha))
    if (!hayDatos) return null
    return resumenSemana({
      hoy, sesiones, mediciones: mediciones.filter(m => m.fecha.slice(0, 10) <= domingo), comidas, pasos,
      fijos: rutina ? rutina.dias.filter(x => !x.opcional).length : perfil.diasFijos.length,
      objetivoProteina: energia.proteina, objetivoPasos: perfil.pasosObjetivo,
      recordsSemana: recordsEn(sesiones, dias),
      subidasSemana: new Set(subidas(sesiones).filter(x => dias.includes(x.fecha)).map(x => x.ejercicio)).size,
      esperados: perfil.diasFijos.filter(x => x <= diaSemana(deISO(hoy))).length,
    })
  }, [hoy, rutina, perfil])
  if (r === undefined) return null
  const tono = !r ? 'ux-nada' : r.semaforo === 'verde' ? 'ok' : r.semaforo === 'ambar' ? 'ux-warn' : 'ux-bad'
  const icono = !r ? 'chart-line-up' : r.semaforo === 'verde' ? 'check' : r.semaforo === 'ambar' ? 'minus' : 'x'
  return (
    <Seccion titulo={t('¿Voy bien?')} extra={<span className="lbl">{t('Revisión del domingo')}</span>}>
      <button className="card pd sem-card" onClick={() => nav.pestana('pro')}>
        <span className={cx('lamp', tono)}><Ico n={icono} b /></span>
        <span className="tx">
          <b>{r ? r.titulo : t('Tu semana aún está vacía')}</b>
          <small>{r ? r.frase : t('Entrena, pésate o apunta comidas y aquí verás si vas bien')}</small>
        </span>
        <Ico n="caret-right" className="car" />
      </button>
    </Seccion>
  )
}

export function Pendientes() {
  const nav = useNav()
  const perfil = usePerfil()
  const hoy = hoyISO()
  // iPhone y iPad: sin pasos automáticos ni recordatorios, por la tarde se recuerda apuntar los pasos.
  const pasosAMano = capacidades().pasosAMano
  const tarde = new Date().getHours() >= 18
  const lista = useLiveQuery(() => pendientesDeHoy(perfil, hoy, { pasosAMano, tarde }), [perfil, hoy, pasosAMano, tarde]) ?? []
  const aviso = useAviso()
  const [ocultos, setOcultos] = useState<string[]>([])
  // Igual que en Comida: el batido se apunta con su proteína y suma al día.
  const unaVez = useUnaVez()
  const marcar = unaVez(async (s: string) => {
    // Doble toque: marcarSuplemento no lo marca (ni apunta el batido) dos veces y devuelve null.
    const deshacer = await marcarSuplemento(perfil, hoy, s)
    if (deshacer && esBatido(s)) aviso(t('Apuntado: {nombre} · {n} g proteína', { nombre: t(s), n: batidoDe(perfil.batido).proteina }), () => { deshacer(); setOcultos(o => o.filter(x => x !== s)) })
    setTimeout(() => setOcultos(o => [...o, s]), 700)
  })
  const visibles = lista.filter(p => !ocultos.includes(p.id))
  if (!visibles.length) return null
  return (
    <Seccion tour="pendientes" titulo={t('Pendientes de hoy')} extra={<span className="lbl">{visibles.length}</span>}>
      <div className="list">
        {visibles.map(p => (
          <button key={p.id} className={cx('it todo', p.hecho && 'done')} onClick={() => {
            if (p.accion === 'peso') nav.hoja('hoja-peso')
            else if (p.accion === 'medir') nav.ir('registrar', undefined, 'pro')
            else if (p.accion === 'foto') nav.ir('fotos', undefined, 'pro')
            else if (p.accion === 'pasos') nav.ir('pasos', undefined, 'pro')
            else void marcar(p.id)
          }}>
            <span className="box"><Ico n="check" b /></span>
            <span className="tx"><b>{p.titulo}</b><small>{p.detalle}</small></span>
            <Ico n={p.icono} className="car" />
          </button>
        ))}
      </div>
    </Seccion>
  )
}

/** Próximo objetivo, último récord y racha, uno detrás de otro. */
export function TuProgreso({ rutina }: { rutina: Rutina | null }) {
  const nav = useNav()
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const metas = (await leerMetas()).filter(m => !m.hecha)
    const sesiones = await sesionesHechas()
    let logro = null as { nombre: string; peso: number; reps: number; fecha: string } | null
    for (const s of sesiones) {
      for (const e of s.ejercicios) for (const x of e.series) if (x.record && x.peso != null && x.reps != null) { logro = { nombre: nombreEjercicio(e.ejercicio), peso: x.peso, reps: x.reps, fecha: s.fecha }; break }
      if (logro) break
    }
    return { meta: metas[0], logro, racha: racha(rutina, sesiones, hoy) }
  }, [rutina, hoy])
  const items = [
    datos?.meta && { k: 'meta', ir: () => nav.ir('objetivos', undefined, 'pro'), el: (
      <div className="pd">
        <span className="lbl">{t('Próximo objetivo')}</span>
        <p className="rot-big">{datos.meta.titulo}</p>
        {datos.meta.fecha && <p className="small muted mt4">{t('Para el {fecha}', { fecha: fechaCorta(datos.meta.fecha) })}</p>}
      </div>) },
    datos?.logro && { k: 'logro', ir: () => nav.ir('fuerza', undefined, 'pro'), el: (
      <div className="ach" style={{ border: 0, borderRadius: 10 }}>
        <span className="tro"><Ico n="trophy" b /></span>
        <span className="tx"><small className="au">{t('Último logro · {fecha}', { fecha: fechaCorta(datos.logro.fecha) })}</small><b>{t('Récord en {nombre}', { nombre: datos.logro.nombre.toLowerCase() })}</b><small className="mono">{kg(datos.logro.peso)} kg × {datos.logro.reps}</small></span>
      </div>) },
    datos && datos.racha > 0 && { k: 'racha', ir: () => nav.pestana('pro'), el: (
      <div className="pd">
        <span className="lbl">{t('Racha')}</span>
        <p className="rot-big">{datos.racha === 1
          ? tr('{n} semana cumplida', { n: <span className="mono">{datos.racha}</span> })
          : tr('{n} semanas cumplidas', { n: <span className="mono">{datos.racha}</span> })}</p>
        <div className="streak mt8">{Array.from({ length: Math.min(8, datos.racha) }, (_, i) => <i key={i} className="on" />)}<i className="cur" /></div>
      </div>) },
  ].filter(Boolean) as { k: string; ir: () => void; el: ReactElement }[]
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const reloj = setInterval(() => setI(x => (x + 1) % items.length), 3200)
    return () => clearInterval(reloj)
  }, [items.length])
  if (!items.length) return null
  const it = items[i % items.length]!
  return (
    <Seccion titulo={t('Tu progreso')} accion={t('Ver todo')} onAccion={() => nav.ir('fuerza', undefined, 'pro')}>
      <div className="rot">
        <button className="card rot-it on" key={it.k} onClick={it.ir} style={{ textAlign: 'left' }}>{it.el}</button>
      </div>
    </Seccion>
  )
}

/** «Cardio esta semana» en «Hoy en números»: minutos de lunes a hoy (gimnasio y fuera) frente a la meta. Toca para apuntar. */
export function CardioSemana({ meta }: { meta: number }) {
  const nav = useNav()
  const hoy = hoyISO()
  const hechos = useLiveQuery(() => minutosCardio(lunesDe(hoy), hoy), [hoy]) ?? []
  const total = hechos.reduce((a, x) => a + x.min, 0)
  const nombre = (tipo: string) => (TIPOS_CARDIO.some(c => c.v === tipo) ? nombreCardio(tipo as TipoCardio) : nombreEjercicio(tipo))
  const lista = hechos.slice(0, 3).map(x => t('{tipo} el {dia} ({n})', { tipo: nombre(x.tipo), dia: DIAS[diaSemana(deISO(x.fecha))]!, n: x.min }))
  return (
    <button className="card kpi span2" onClick={() => nav.hoja('hoja-cardio', { fecha: hoy })}>
      <div className="row jb"><span className="lbl">{t('Cardio esta semana')}</span><span className="small muted">{total >= meta ? t('Hecho') : t('faltan {n} min', { n: meta - total })}</span></div>
      <p className="k">{total}<small>/ {meta} min</small></p>
      <div className="mt8"><Barra v={total} total={meta} tono="go" gruesa /></div>
      <p className="d">{lista.length ? lista.join(' · ') : t('Toca para apuntar el que hagas fuera del gimnasio.')}</p>
    </button>
  )
}
