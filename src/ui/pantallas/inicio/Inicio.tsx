// INI-01 · Inicio
import { useEffect, useState, type ReactElement } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { guardarAjustes } from '../../../datos/repos'
import { objetivosEnergia, sugerenciasDia, totalesComida } from '../../../datos/consultas'
import type { DiaRutina, Rutina, Sesion } from '../../../datos/tipos'
import { ejercicio, nombreEjercicio } from '../../../catalogo/catalogo'
import { indiceActual } from '../../../dominio/sesion'
import { DIAS, DIAS_CORTOS, deISO, diaSemana, fechaCorta, formatoHora, hoyISO, lunesDe, numeroSemana, saludo, semanaDe, sumarDias, MESES_CORTOS } from '../../../dominio/fechas'
import { propuestaDescarga } from '../../../dominio/descarga'
import { duracionDia } from '../../../dominio/generador'
import { estadoSemana, racha, tarjetaHoy, type EstadoDia } from '../../../dominio/semana'
import { kg, num } from '../../../dominio/calculos'
import type { Sugerencia } from '../../../dominio/progresion'
import { Anillo, Barra, Cab, cx, Ico, Pantalla, Seccion, Th } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, usePerfil, useRutina, useSesionEnCurso } from '../../datos'
import { pendientesDeHoy } from './pendientes'
import { abrirEntreno } from '../entreno/iniciar'

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Inicio() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const rutina = useRutina()
  const gym = useGimnasio()
  const enCurso = useSesionEnCurso()
  const hoy = hoyISO()
  const dias = semanaDe(hoy)
  const sesiones = useLiveQuery(() => db.sesiones.where('fecha').between(sumarDias(dias[0]!, -7), dias[6]!, true, true).toArray(), [hoy]) ?? []
  const comidas = useLiveQuery(() => db.comidas.where('fecha').equals(hoy).toArray(), [hoy]) ?? []
  const pasos = useLiveQuery(() => db.pasos.get(hoy), [hoy])
  const energia = useLiveQuery(() => objetivosEnergia(perfil), [perfil])
  const semana = estadoSemana(rutina, sesiones, hoy, ajustes.recolocadas)
  const proxSemana = estadoSemana(rutina, sesiones, sumarDias(dias[6]!, 1), ajustes.recolocadas).find(d => d.estado === 'plan')
  const tarjeta = tarjetaHoy(rutina, semana, hoy, !!enCurso, perfil.sesionPerdida === 'sabado', proxSemana)
  const tot = totalesComida(comidas)
  const d = deISO(hoy)
  const nSemana = ajustes.inicio ? numeroSemana(ajustes.inicio, hoy) : 1

  const describe = (e: EstadoDia) => {
    const nom = `${capital(DIAS[diaSemana(deISO(e.fecha))]!)} ${deISO(e.fecha).getDate()}`
    switch (e.estado) {
      case 'hecho': return `${nom} · hecho: ${e.sesion?.nombre}`
      case 'plan': return `${nom} · ${e.dia?.nombre} · ${formatoHora(perfil.horaEntreno)}`
      case 'perdido': return `${nom} · perdido: ${e.dia?.nombre}`
      case 'movido': return `${nom} · pasado a otro día`
      case 'opcional': return `${nom} · opcional: ${e.dia?.nombre}`
      default: return `${nom} · descanso`
    }
  }

  return (
    <Pantalla>
      <Cab
        crumb={`${capital(DIAS[diaSemana(d)]!).slice(0, 3)} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} · semana ${nSemana}`}
        titulo={`${saludo()}${perfil.nombre ? `, ${perfil.nombre}` : ''}`}
        derecha={<button className="ib" aria-label="Ajustes" onClick={() => nav.ir('aju')}><Ico n="gear" /></button>}
      >
        <div className="week mt12" role="list">
          {semana.map((e, i) => (
            <button key={e.fecha} role="listitem" className={cx('wd', e.hoy ? 'today' : e.estado === 'plan' ? 'plan' : e.estado === 'opcional' ? 'opt' : 'off')} onClick={() => aviso(describe(e))}>
              <span>{DIAS_CORTOS[i]}</span>
              <b>{deISO(e.fecha).getDate()}</b>
              <i className={{
                hecho: 'ph-bold ph-check okc', plan: 'ph-bold ph-circle', perdido: 'ph-bold ph-x badc', movido: 'ph-bold ph-arrow-right',
                opcional: 'ph ph-circle-dashed', descanso: 'ph-bold ph-minus',
              }[e.estado].replace(e.hoy && e.estado === 'plan' ? 'ph-circle' : '#', 'ph-barbell')} />
            </button>
          ))}
        </div>
        <p className="legend mt8">
          <span><Ico n="check" b className="okc" />Hecho</span>
          <span><Ico n="circle" b className="blue" />Plan</span>
          <span><Ico n="circle-dashed" />Opcional</span>
          <span><Ico n="x" b className="badc" />Perdido</span>
        </p>
      </Cab>

      <div className="pg">
        <SemanaSuave rutina={rutina ?? null} />

        <Seccion titulo="Hoy te toca" accion={tarjeta.tipo === 'hoy' ? 'Ver día' : undefined} onAccion={() => tarjeta.tipo === 'hoy' && nav.ir('rut-dia', { letra: tarjeta.dia.letra }, 'rut')}>
          <TarjetaHoy t={tarjeta} rutina={rutina ?? null} enCurso={enCurso ?? null} gym={gym?.nombre} />
        </Seccion>

        <Seccion titulo="Hoy en números" accion="Comida" onAccion={() => nav.pestana('com')}>
          <div className="grid2">
            <div className="card kpi span2">
              <div className="row jb">
                <span className="lbl">Proteína</span>
                {energia && <span className="small muted">{tot.proteina >= energia.proteina ? 'Objetivo cumplido' : `Faltan ${Math.round(energia.proteina - tot.proteina)} g`}</span>}
              </div>
              <p className="k">{Math.round(tot.proteina)}<small>/ {energia?.proteina ?? '—'} g</small></p>
              <div className="mt8"><Barra v={tot.proteina} total={energia?.proteina ?? 1} tono="ok" gruesa /></div>
            </div>
            {ajustes.mostrarKcal && (
              <div className="card kpi">
                <span className="lbl">Kcal</span>
                <p className="k">{Math.round(tot.kcal)}<small>/ ~{energia?.kcal ?? '—'}</small></p>
                <div className="mt8"><Barra v={tot.kcal} total={energia?.kcal ?? 1} /></div>
                <p className="d">orientativo</p>
              </div>
            )}
            <button className={cx('card kpi steps', !ajustes.mostrarKcal && 'span2')} onClick={() => nav.ir('pro-pasos', undefined, 'pro')}>
              <Anillo v={pasos?.pasos ?? 0} total={perfil.pasosObjetivo} />
              <div className="grow">
                <span className="lbl">Pasos</span>
                <p className="k sm">{num(pasos?.pasos ?? 0, 0)}</p>
                <p className="d">de {num(perfil.pasosObjetivo, 0)}</p>
              </div>
            </button>
            {tot.cafeina > 0 && (
              <div className="card kpi span2 row">
                <span className="ico"><Ico n="coffee" /></span>
                <div className="grow">
                  <div className="row jb"><span className="lbl">Cafeína</span><span className="mono small">{tot.cafeina} / {ajustes.cafeinaLimite} mg</span></div>
                  <div className="mt8"><Barra v={tot.cafeina} total={ajustes.cafeinaLimite} tono={tot.cafeina > ajustes.cafeinaLimite ? 'go' : 'warn'} /></div>
                </div>
              </div>
            )}
          </div>
        </Seccion>

        <Pendientes />

        <div className="sec">
          <div className="grid4 qa-row">
            <button className="qa" onClick={() => nav.hoja('sheet-add', { fecha: hoy })}><Ico n="fork-knife" /><span>+ Comida</span></button>
            <button className="qa" onClick={() => nav.hoja('sheet-add', { fecha: hoy, modo: 'picoteo' })}><Ico n="cookie" /><span>+ Picoteo / bebida</span></button>
            <button className="qa" onClick={() => nav.ir('com-scan', undefined, 'com')}><Ico n="barcode" /><span>Escanear</span></button>
            <button className="qa" onClick={() => nav.hoja('sheet-peso')}><Ico n="scales" /><span>+ Peso</span></button>
          </div>
        </div>

        <TuProgreso rutina={rutina ?? null} />

        {diaSemana(d) === 6 && (
          <Seccion titulo="¿Voy bien?" extra={<span className="lbl">Revisión del domingo</span>}>
            <button className="card pd sem-card" onClick={() => nav.pestana('pro')}>
              <span className="lamp ok"><Ico n="check" b /></span>
              <span className="tx"><b>Tu semana, en 10 segundos</b><small>Cintura, fuerza, entrenos y proteína</small></span>
              <Ico n="caret-right" className="car" />
            </button>
          </Seccion>
        )}
        {ajustes.ultimaCopia == null || Date.now() - new Date(ajustes.ultimaCopia).getTime() > 8 * 86400000 ? (
          <div className="sec">
            <button className="note warn w100" style={{ textAlign: 'left' }} onClick={() => nav.ir('aju', { seccion: 'datos' })}>
              <Ico n="download-simple" />
              <span><b>Haz una copia de seguridad.</b> Tus datos solo están en este móvil.</span>
            </button>
          </div>
        ) : null}
      </div>
    </Pantalla>
  )
}

function FilasDia({ dia, sug }: { dia: DiaRutina; sug?: Map<string, Sugerencia> }) {
  const filas: ReactElement[] = []
  const vistos = new Set<string>()
  const bloques = dia.bloques
  for (const b of bloques) {
    if (vistos.has(b.uid) || filas.length >= 4) continue
    vistos.add(b.uid)
    const comp = b.superserie ? bloques.find(o => o.uid === b.superserie) : undefined
    if (comp) vistos.add(comp.uid)
    const e = ejercicio(b.ejercicio)
    const s = sug?.get(b.ejercicio)
    const s2 = comp ? sug?.get(comp.ejercicio) : undefined
    const pesoTxt = (x?: Sugerencia) => (x?.peso != null ? kg(x.peso) : '—')
    filas.push(
      <div key={b.uid} className={cx('exr', s?.accion === 'subir' && 'hot')}>
        {comp ? <span className="th xs c-br"><Ico n="link" b /></span> : <Th ej={e} size="xs" />}
        <span className="tx ellip">{comp ? `Superserie: ${e?.nombre.split(' ')[0]} + ${ejercicio(comp.ejercicio)?.nombre.split(' ')[0]}` : e?.nombre}</span>
        <span className="sr">{b.series} × {b.repsMin}-{b.repsMax}</span>
        <b className="kg">{comp ? `${pesoTxt(s)} · ${pesoTxt(s2)}` : s?.peso != null ? <>{kg(s.peso)} kg {s.accion === 'subir' && <Ico n="arrow-up" b />}</> : '—'}</b>
      </div>,
    )
  }
  const resto = bloques.filter(b => !vistos.has(b.uid))
  return (
    <div className="exl">
      {filas}
      {resto.length > 0 && <p className="exmore">+ {resto.map(b => `${ejercicio(b.ejercicio)?.nombre} · ${b.series} × ${b.repsMin}-${b.repsMax}`).join(' · ')}</p>}
    </div>
  )
}

function TarjetaHoy({ t, rutina, enCurso, gym }: { t: ReturnType<typeof tarjetaHoy>; rutina: Rutina | null; enCurso: Sesion | null; gym?: string }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const dia = t.tipo === 'hoy' || t.tipo === 'opcional' ? t.dia : null
  const sug = useLiveQuery(() => (dia ? sugerenciasDia(dia, g) : Promise.resolve(undefined)), [dia, g])
  const empezar = (version: 'normal' | 'corta') => dia && nav.hoja('sheet-ses1', { letra: dia.letra, version })

  if (t.tipo === 'curso' && enCurso) {
    const idx = indiceActual(enCurso)
    return (
      <div className="card today">
        <div className="today-hero live">
          <div className="row"><span className="tag go"><Ico n="record" b />En curso</span></div>
          <h3>{enCurso.nombre}</h3>
          <p className="today-meta"><span>{idx >= 0 ? `Ejercicio ${idx + 1} de ${enCurso.ejercicios.length} · ${nombreEjercicio(enCurso.ejercicios[idx]?.ejercicio)}` : enCurso.ejercicios.length ? 'Todo hecho: falta terminarlo' : 'Aún sin ejercicios'}</span></p>
        </div>
        {/* «Restaurar» no hace nada si la app se cerró a mitad del entreno: abrirEntreno lo abre igualmente. */}
        <div className="pd"><button className="btn xl" onClick={() => abrirEntreno(nav)}><Ico n="play" b />Continuar</button></div>
      </div>
    )
  }
  if (t.tipo === 'sin') {
    return (
      <div className="card today"><div className="pd empty">
        <span className="empty-ic"><Ico n="clipboard-text" /></span>
        <h3 className="h3">Aún no tienes rutina</h3>
        <p className="muted">La creamos con tus días, tu tiempo y tu gimnasio. Tarda 10 segundos.</p>
        <button className="btn mt12" onClick={() => nav.ir('rut-gen', undefined, 'rut')}><Ico n="magic-wand" b />Crear mi rutina</button>
      </div></div>
    )
  }
  if (t.tipo === 'hoy') {
    const d = t.dia
    return (
      <div className="card today">
        {rutina?.calibracion && <div className="calib"><Ico n="gauge" /><span><b>Semana de calibración.</b> Pesos cómodos: estamos midiendo tus tiempos.</span></div>}
        <div className="today-hero">
          <Ico n="barbell" className="today-bg" />
          <div className="row"><span className="tag go">Día {d.letra}</span><span className="tag">{capital(DIAS[diaSemana(new Date())]!)} · {formatoHora(perfil.horaEntreno)}</span></div>
          <h3>{d.nombre}</h3>
          <p className="today-meta">
            <span><Ico n="clock" />~{Math.round(duracionDia(d.bloques) / 60)} min · corta ~{Math.round(duracionDia(d.bloques, true) / 60)}</span>
            {gym && <span><Ico n="map-pin" />{gym}</span>}
          </p>
        </div>
        <FilasDia dia={d} sug={sug} />
        <div className="pd today-act">
          <button className="btn xl" onClick={() => empezar('normal')}><Ico n="play" b />Empezar rutina</button>
          <button className="btn gry sm" onClick={() => empezar('corta')}>Versión corta · ~{Math.round(duracionDia(d.bloques, true) / 60)} min</button>
        </div>
      </div>
    )
  }
  if (t.tipo === 'opcional') {
    return (
      <div className="card today">
        <div className="today-hero opt">
          <div className="row"><span className="tag blue">Opcional</span><span className="tag">{capital(DIAS[diaSemana(new Date())]!)}</span></div>
          <h3>¿Sesión extra?</h3>
          <p className="today-meta"><span>{t.dia.nombre} · ~{Math.round(duracionDia(t.dia.bloques) / 60)} min</span></p>
        </div>
        <FilasDia dia={t.dia} sug={sug} />
        <div className="pd btns">
          <button className="btn gry sm" onClick={() => aviso('Vale, hoy no. Buen día')}>Hoy no</button>
          <button className="btn sm" onClick={() => empezar('normal')}>Empezar</button>
        </div>
      </div>
    )
  }
  if (t.tipo === 'perdida') {
    const dd = deISO(t.perdido.fecha)
    const destino = deISO(t.destino)
    return (
      <div className="card today"><div className="pd">
        <div className="row">
          <span className="ico big warnb"><Ico n="calendar-x" /></span>
          <div className="grow"><h3 className="h3">El {DIAS[diaSemana(dd)]} no entrenaste.</h3><p className="muted">¿La pasamos al {DIAS[diaSemana(destino)]}?</p></div>
        </div>
        <div className="spec mt12">
          <p><span>Sesión</span><b>{t.perdido.dia?.nombre}</b></p>
          <p><span>Nuevo día</span><b>{capital(DIAS[diaSemana(destino)]!)} {destino.getDate()}</b></p>
        </div>
        <div className="btns mt12">
          <button className="btn gry sm" onClick={async () => { await guardarAjustes({ recolocadas: [...(await db.ajustes.get('app'))!.recolocadas ?? [], { fecha: '0000-00-00', letra: t.perdido.dia!.letra, desde: t.perdido.fecha }] }); aviso('Sin problema: la saltamos esta semana') }}>No</button>
          <button className="btn sm" onClick={async () => { const a = (await db.ajustes.get('app'))!; await guardarAjustes({ recolocadas: [...(a.recolocadas ?? []), { fecha: t.destino, letra: t.perdido.dia!.letra, desde: t.perdido.fecha }] }); aviso(`Hecho: el ${DIAS[diaSemana(destino)]} entrenas ${t.perdido.dia?.nombre}`) }}>Sí, al {DIAS[diaSemana(destino)]}</button>
        </div>
      </div></div>
    )
  }
  if (t.tipo === 'hecho') {
    return (
      <div className="card today"><div className="pd">
        <div className="row">
          <span className="ico big okb"><Ico n="check-circle" /></span>
          <div className="grow"><h3 className="h3">Entreno de hoy hecho.</h3><p className="muted">{t.sesion.nombre} · {t.sesion.ejercicios.filter(e => e.estado === 'hecho').length} ejercicios</p></div>
        </div>
        {t.proximo?.dia && <div className="spec mt12"><p><span>Próximo</span><b>{capital(DIAS[diaSemana(deISO(t.proximo.fecha))]!)} · {t.proximo.dia.nombre}</b></p></div>}
        <button className="btn gry sm mt12" onClick={() => nav.ir('pro-entreno', { id: t.sesion.id }, 'pro')}>Ver el entreno</button>
      </div></div>
    )
  }
  const prox = t.tipo === 'descanso' ? t.proximo : undefined
  return (
    <div className="card today"><div className="pd">
      <div className="row">
        <span className="ico big"><Ico n="moon" /></span>
        <div className="grow"><h3 className="h3">Hoy descansas.</h3>{prox?.dia && <p className="muted">Próximo: {DIAS[diaSemana(deISO(prox.fecha))]} a las {formatoHora(perfil.horaEntreno)}</p>}</div>
      </div>
      {prox?.dia && (
        <div className="spec mt12">
          <p><span>{capital(DIAS[diaSemana(deISO(prox.fecha))]!)} {fechaCorta(prox.fecha)}</span><b>{prox.dia.nombre}</b></p>
          <p><span>Duración</span><b>~{Math.round(duracionDia(prox.dia.bloques) / 60)} min · corta ~{Math.round(duracionDia(prox.dia.bloques, true) / 60)}</b></p>
        </div>
      )}
      <button className="btn gry sm mt12" onClick={() => nav.pestana('rut')}>Ver mi plan</button>
    </div></div>
  )
}

function Pendientes() {
  const nav = useNav()
  const perfil = usePerfil()
  const hoy = hoyISO()
  const lista = useLiveQuery(() => pendientesDeHoy(perfil, hoy), [perfil, hoy]) ?? []
  const supl = useLiveQuery(() => db.suplementos.get(hoy), [hoy])
  const [ocultos, setOcultos] = useState<string[]>([])
  const marcar = async (s: string) => {
    const tomados = new Set(supl?.tomados ?? [])
    tomados.add(s)
    await db.suplementos.put({ fecha: hoy, tomados: [...tomados] })
    setTimeout(() => setOcultos(o => [...o, s]), 700)
  }
  const visibles = lista.filter(p => !ocultos.includes(p.id))
  if (!visibles.length) return null
  return (
    <Seccion titulo="Pendientes de hoy" extra={<span className="lbl">{visibles.length}</span>}>
      <div className="list">
        {visibles.map(p => (
          <button key={p.id} className={cx('it todo', p.hecho && 'done')} onClick={() => {
            if (p.accion === 'peso') nav.hoja('sheet-peso')
            else if (p.accion === 'medir') nav.ir('pro-reg', undefined, 'pro')
            else if (p.accion === 'foto') nav.ir('pro-fotos', undefined, 'pro')
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

/** Semana suave (descarga): la propone la app cuando toca; en la semana suave, un recordatorio. */
function SemanaSuave({ rutina }: { rutina: Rutina | null }) {
  const ajustes = useAjustes()
  const aviso = useAviso()
  const hoy = hoyISO()
  const lunes = lunesDe(hoy)
  const enSuave = ajustes.semanaSuave === lunes
  const prop = useLiveQuery(async () => {
    if (!rutina || rutina.calibracion || enSuave) return null
    return propuestaDescarga({
      hoy, sesiones: await db.sesiones.where('estado').equals('hecha').toArray(),
      ejerciciosRutina: rutina.dias.flatMap(d => d.bloques.map(b => b.ejercicio)),
      semanaSuave: ajustes.semanaSuave ?? null, pospuesta: ajustes.suavePospuesta ?? null, nombre: nombreEjercicio,
    })
  }, [rutina?.id, ajustes.semanaSuave, ajustes.suavePospuesta, hoy, enSuave])
  if (enSuave) {
    return (
      <div className="sec">
        <div className="note">
          <Ico n="feather" />
          <span><b>Semana suave.</b> Mismos ejercicios, 1 serie menos y −10 % de peso. La semana que viene, vuelta a lo normal.{' '}
            <button className="lnk" style={{ display: 'inline', padding: 0, margin: 0 }} onClick={async () => { await guardarAjustes({ semanaSuave: null, suavePospuesta: lunes }); aviso('Vuelta a lo normal') }}>Volver a lo normal</button>
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
            <h3 className="h3">¿Semana suave?</h3>
            <p className="small muted">{prop.motivo}. Mismos ejercicios, 1 serie menos y −10 % de peso: el cuerpo asimila y luego subes mejor.</p>
          </div>
        </div>
        <div className="btns mt12">
          <button className="btn gry sm" onClick={async () => { await guardarAjustes({ suavePospuesta: lunes }); aviso('Vale: lo vemos la semana que viene') }}>Ahora no</button>
          <button className="btn sm" onClick={async () => { await guardarAjustes({ semanaSuave: lunes, suavePospuesta: null }); aviso('Semana suave: los entrenos de esta semana van más ligeros') }}>Sí, esta semana</button>
        </div>
      </div>
    </div>
  )
}

function TuProgreso({ rutina }: { rutina: Rutina | null }) {
  const nav = useNav()
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const metas = (await db.metas.toArray()).filter(m => !m.hecha)
    const sesiones = await db.sesiones.where('estado').equals('hecha').toArray()
    sesiones.sort((a, b) => b.inicio - a.inicio)
    let logro = null as { nombre: string; peso: number; reps: number; fecha: string } | null
    for (const s of sesiones) {
      for (const e of s.ejercicios) for (const x of e.series) if (x.record && x.peso != null && x.reps != null) { logro = { nombre: ejercicio(e.ejercicio)?.nombre ?? '', peso: x.peso, reps: x.reps, fecha: s.fecha }; break }
      if (logro) break
    }
    return { meta: metas[0], logro, racha: racha(rutina, sesiones, hoy) }
  }, [rutina, hoy])
  const items = [
    datos?.meta && { k: 'meta', ir: () => nav.ir('pro-obj', undefined, 'pro'), el: (
      <div className="pd">
        <span className="lbl">Próximo objetivo</span>
        <p className="rot-big">{datos.meta.titulo}</p>
        {datos.meta.fecha && <p className="small muted mt4">Para el {fechaCorta(datos.meta.fecha)}</p>}
      </div>) },
    datos?.logro && { k: 'logro', ir: () => nav.ir('pro-fuerza', undefined, 'pro'), el: (
      <div className="ach" style={{ border: 0, borderRadius: 10 }}>
        <span className="tro"><Ico n="trophy" b /></span>
        <span className="tx"><small className="au">Último logro · {fechaCorta(datos.logro.fecha)}</small><b>Récord en {datos.logro.nombre.toLowerCase()}</b><small className="mono">{kg(datos.logro.peso)} kg × {datos.logro.reps}</small></span>
      </div>) },
    datos && datos.racha > 0 && { k: 'racha', ir: () => nav.pestana('pro'), el: (
      <div className="pd">
        <span className="lbl">Racha</span>
        <p className="rot-big"><span className="mono">{datos.racha}</span> semana{datos.racha === 1 ? '' : 's'} cumplida{datos.racha === 1 ? '' : 's'}</p>
        <div className="streak mt8">{Array.from({ length: Math.min(8, datos.racha) }, (_, i) => <i key={i} className="on" />)}<i className="cur" /></div>
      </div>) },
  ].filter(Boolean) as { k: string; ir: () => void; el: ReactElement }[]
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const t = setInterval(() => setI(x => (x + 1) % items.length), 3200)
    return () => clearInterval(t)
  }, [items.length])
  if (!items.length) return null
  const it = items[i % items.length]!
  return (
    <Seccion titulo="Tu progreso" accion="Ver todo" onAccion={() => nav.ir('pro-fuerza', undefined, 'pro')}>
      <div className="rot">
        <button className="card rot-it on" key={it.k} onClick={it.ir} style={{ textAlign: 'left' }}>{it.el}</button>
      </div>
    </Seccion>
  )
}
