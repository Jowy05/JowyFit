// INI-01 · Inicio
import { useEffect, useState, type ReactElement } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { guardarAjustes } from '../../../datos/repos'
import { gastoDelDia, objetivosEnergia, sesionesHechas, sugerenciasDia, totalesComida } from '../../../datos/consultas'
import { basalHastaAhora } from '../../../dominio/energia'
import type { DiaRutina, Rutina, Sesion } from '../../../datos/tipos'
import { ejercicio, nombreEjercicio } from '../../../catalogo/catalogo'
import { indiceActual } from '../../../dominio/sesion'
import { DIAS, DIAS_CORTOS, deISO, diaSemana, diasEntre, fechaCorta, formatoHora, hoyISO, lunesDe, numeroSemana, saludo, semanaDe, sumarDias, MESES_CORTOS } from '../../../dominio/fechas'
import { propuestaDescarga } from '../../../dominio/descarga'
import { duracionDia } from '../../../dominio/generador'
import { estadoSemana, racha, tarjetaHoy, type EstadoDia } from '../../../dominio/semana'
import { resumenSemana } from '../../../dominio/resumen'
import { recordsEn, subidas } from '../../../dominio/tendencias'
import { kg, num } from '../../../dominio/calculos'
import type { Sugerencia } from '../../../dominio/progresion'
import { Anillo, Barra, Cab, cx, Ico, Pantalla, Seccion, Th, useUnaVez, LARGO, recortar } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, usePerfil, useRutina, useSesionEnCurso } from '../../datos'
import { pendientesDeHoy } from './pendientes'
import { marcarSuplemento } from '../comida/suplementos'
import { batidoDe, esBatido } from '../../../dominio/comida'
import { abrirEntreno } from '../entreno/iniciar'
import { dispositivoApple } from '../../../plataforma'

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
  const yaEntreno = useLiveQuery(async () => !!(await db.sesiones.where('estado').equals('hecha').first()), []) ?? false
  const energia = useLiveQuery(() => objetivosEnergia(perfil), [perfil])
  // Lo que gastas hoy: en reposo y por ejercicio (pasos + entreno). Se recalcula al cambiar pasos, entrenos o medidas.
  const gasto = useLiveQuery(() => gastoDelDia(perfil, hoy), [perfil, hoy])
  const semana = estadoSemana(rutina, sesiones, hoy, ajustes.recolocadas)
  const proxSemana = estadoSemana(rutina, sesiones, sumarDias(dias[6]!, 1), ajustes.recolocadas).find(d => d.estado === 'plan')
  const tarjeta = tarjetaHoy(rutina, semana, hoy, !!enCurso, perfil.sesionPerdida === 'sabado', proxSemana)
  const tot = totalesComida(comidas)
  const d = deISO(hoy)
  const nSemana = ajustes.inicio ? numeroSemana(ajustes.inicio, hoy) : 1
  // Mientras se ve la guía «Primeros pasos» no salen «Pendientes de hoy» ni la tarjeta de pasos:
  // eran dos listas de casillas casi iguales y una meta de pasos que nadie había pedido.
  const guia = usePrimerosPasos(tarjeta)
  const conGuia = guia !== null

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
        <div className="week mt12" role="list" data-tour="semana">
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
          <span><Ico n="minus" b />Descanso</span>
        </p>
      </Cab>

      <div className="pg">
        <SemanaSuave rutina={rutina ?? null} />

        <Seccion tour="hoy" titulo="Hoy te toca" accion={tarjeta.tipo === 'hoy' ? 'Ver día' : undefined} onAccion={() => tarjeta.tipo === 'hoy' && nav.ir('rut-dia', { letra: tarjeta.dia.letra }, 'rut')}>
          <TarjetaHoy t={tarjeta} rutina={rutina ?? null} enCurso={enCurso ?? null} gym={gym?.nombre == null ? undefined : recortar(gym.nombre, LARGO.nombre)} />
        </Seccion>

        {/* El domingo, «¿Voy bien?» justo debajo de «Hoy te toca» (antes salía al final y no se llegaba). */}
        {diaSemana(d) === 6 && <VoyBien rutina={rutina ?? null} />}

        {/* Los accesos rápidos, a mano: antes había que bajar tres pantallas para llegar a «+ Comer o beber». */}
        <div className="sec">
          {/* Comida y picoteo abrían la misma hoja: un solo botón (no hay que decidir si un café es comida o picoteo). */}
          <div className="qa-row ux-qa3" data-tour="atajos">
            <button className="qa" onClick={() => nav.hoja('sheet-add', { fecha: hoy })}><Ico n="fork-knife" /><span>+ Comer o beber</span></button>
            <button className="qa" onClick={() => nav.ir('com-scan', undefined, 'com')}><Ico n="barcode" /><span>Escanear</span></button>
            <button className="qa" onClick={() => nav.hoja('sheet-peso')}><Ico n="scales" /><span>+ Peso</span></button>
          </div>
        </div>

        {guia && <PrimerosPasos g={guia} />}

        <Seccion tour="numeros" titulo="Hoy en números" accion="Comida" onAccion={() => nav.pestana('com')}>
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
                <span className="lbl">Calorías</span>
                <p className="k">{Math.round(tot.kcal)}<small>/ ~{energia?.kcal ?? '—'}</small></p>
                <div className="mt8"><Barra v={tot.kcal} total={energia?.kcal ?? 1} /></div>
                <p className="d">kcal · orientativo</p>
              </div>
            )}
            {(
              <button className={cx('card kpi steps', !ajustes.mostrarKcal && 'span2')} onClick={() => nav.ir('pro-pasos', undefined, 'pro')}>
                <Anillo v={pasos?.pasos ?? 0} total={perfil.pasosObjetivo} />
                <div className="grow">
                  <span className="lbl">Pasos</span>
                  <p className="k sm">{num(pasos?.pasos ?? 0, 0)}</p>
                  <p className="d">de {num(perfil.pasosObjetivo, 0)}</p>
                </div>
              </button>
            )}
            {ajustes.mostrarKcal && gasto && (
              <>
                <button className="card kpi" onClick={() => aviso(gasto.formula === 'katch'
                  ? `Lo que gasta tu cuerpo sin moverte, con tu peso (${num(gasto.peso)} kg) y tu grasa (${num(gasto.grasa)} %). Aproximado.`
                  : `Lo que gasta tu cuerpo sin moverte, con tu peso (${num(gasto.peso)} kg), tu altura, tu edad y tu sexo. Con tu % de grasa saldría más fino. Aproximado.`)}>
                  <span className="lbl">En reposo</span>
                  <p className="k">{num(gasto.basal, 0)}<small>kcal</small></p>
                  <p className="d">al día sin moverte · llevas ~{num(basalHastaAhora(gasto.basal, new Date().getHours() * 60 + new Date().getMinutes()), 0)}</p>
                </button>
                <button className="card kpi" onClick={() => aviso('Pasos: unas 0,5 kcal por kilo y kilómetro (con tu zancada). Entreno: según cada ejercicio y las series que has hecho. Sin contar el reposo. Aproximado.')}>
                  <span className="lbl">Por ejercicio</span>
                  <p className="k">{num(gasto.pasos + gasto.entreno.hecho, 0)}<small>kcal</small></p>
                  <p className="d">pasos ~{num(gasto.pasos, 0)}{gasto.hayEntreno ? ` · entreno ~${num(gasto.entreno.hecho, 0)}` : ''}</p>
                  {gasto.entreno.saltado > 0 && <p className="d warnc">−{num(gasto.entreno.saltado, 0)} por lo saltado</p>}
                </button>
              </>
            )}
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

        {!conGuia && <Pendientes />}

        <TuProgreso rutina={rutina ?? null} />

        {/* El aviso de copia no sale a quien acaba de llegar: espera a que haya algo que guardar (un entreno). */}
        {yaEntreno && (ajustes.ultimaCopia == null || Date.now() - new Date(ajustes.ultimaCopia).getTime() > 8 * 86400000) ? (
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
  // Sin peso todavía (o con el de partida que propone la app): «nuevo» en gris, en vez de un «—» que parecía un error.
  // Si todos son nuevos (el primer día), no se pone nada: cuatro «NUEVO» seguidos no dicen nada.
  const nuevo = (x?: Sugerencia) => !!x && (x.partida === true || (x.accion === 'primera' && x.peso == null))
  const todosNuevos = !!sug && bloques.every(b => nuevo(sug.get(b.ejercicio)))
  for (const b of bloques) {
    if (vistos.has(b.uid) || filas.length >= 4) continue
    vistos.add(b.uid)
    const comp = b.superserie ? bloques.find(o => o.uid === b.superserie) : undefined
    if (comp) vistos.add(comp.uid)
    const e = ejercicio(b.ejercicio)
    const s = sug?.get(b.ejercicio)
    const s2 = comp ? sug?.get(comp.ejercicio) : undefined
    const pesoTxt = (x?: Sugerencia) => (!x ? '' : nuevo(x) ? (todosNuevos ? '' : 'nuevo') : x.peso != null ? kg(x.peso) : x.reps != null ? `${x.reps}${b.registro === 'tiempo' ? ' s' : ' reps'}` : '')
    filas.push(
      <div key={b.uid} className={cx('exr', s?.accion === 'subir' && 'hot')}>
        {comp ? <span className="th xs c-br"><Ico n="link" b /></span> : <Th ej={e} size="xs" />}
        <span className="tx ellip">{comp ? `Dos seguidos: ${e?.nombre.split(' ')[0]} + ${ejercicio(comp.ejercicio)?.nombre.split(' ')[0]}` : e?.nombre}</span>
        <span className="sr">{b.series} × {b.repsMin}-{b.repsMax}</span>
        <b className={cx('kg', (comp ? nuevo(s) && nuevo(s2) : nuevo(s)) && 'ux-nuevo')}>
          {comp ? (nuevo(s) && nuevo(s2) ? (todosNuevos ? '' : 'nuevo') : `${pesoTxt(s)} · ${pesoTxt(s2)}`) : s && !nuevo(s) && s.peso != null ? <>{kg(s.peso)} kg {s.accion === 'subir' && <Ico n="arrow-up" b />}</> : pesoTxt(s)}
        </b>
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
        {/* La explicación de la semana de prueba sale dentro del entreno; aquí basta la etiqueta. Sin «Día A»: la letra no dice nada. */}
        <div className="today-hero">
          <Ico n="barbell" className="today-bg" />
          <div className="row">{rutina?.calibracion && <span className="tag blue">Semana de prueba</span>}<span className="tag">{capital(DIAS[diaSemana(new Date())]!)} · {formatoHora(perfil.horaEntreno)}</span></div>
          <h3>{d.nombre}</h3>
          <p className="today-meta">
            <span><Ico n="clock" />~{Math.round(duracionDia(d.bloques) / 60)} min</span>
            {gym && <span><Ico n="map-pin" />{gym}</span>}
          </p>
        </div>
        <FilasDia dia={d} sug={sug} />
        <div className="pd today-act">
          {/* La versión corta se elige en la hoja «Empezar» (antes también estaba aquí: la misma pregunta dos veces). */}
          <button className="btn xl" onClick={() => empezar('normal')}><Ico n="play" b />Empezar rutina</button>
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
          <p><span>Duración</span><b>~{Math.round(duracionDia(prox.dia.bloques) / 60)} min</b></p>
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
  // iPhone: sin pasos automáticos ni recordatorios, por la tarde se recuerda apuntar los pasos.
  const pasosAMano = dispositivoApple() === 'iphone'
  const tarde = new Date().getHours() >= 18
  const lista = useLiveQuery(() => pendientesDeHoy(perfil, hoy, { pasosAMano, tarde }), [perfil, hoy, pasosAMano, tarde]) ?? []
  const aviso = useAviso()
  const [ocultos, setOcultos] = useState<string[]>([])
  // Igual que en Comida: el batido se apunta con su proteína y suma al día.
  const unaVez = useUnaVez()
  const marcar = unaVez(async (s: string) => {
    // Doble toque: no se marca (ni se apunta el batido) dos veces.
    if (((await db.suplementos.get(hoy))?.tomados ?? []).includes(s)) return
    const deshacer = await marcarSuplemento(perfil, hoy, s)
    if (esBatido(s)) aviso(`Apuntado: ${s} · ${batidoDe(perfil.batido).proteina} g proteína`, () => { deshacer(); setOcultos(o => o.filter(x => x !== s)) })
    setTimeout(() => setOcultos(o => [...o, s]), 700)
  })
  const visibles = lista.filter(p => !ocultos.includes(p.id))
  if (!visibles.length) return null
  return (
    <Seccion tour="pendientes" titulo="Pendientes de hoy" extra={<span className="lbl">{visibles.length}</span>}>
      <div className="list">
        {visibles.map(p => (
          <button key={p.id} className={cx('it todo', p.hecho && 'done')} onClick={() => {
            if (p.accion === 'peso') nav.hoja('sheet-peso')
            else if (p.accion === 'medir') nav.ir('pro-reg', undefined, 'pro')
            else if (p.accion === 'foto') nav.ir('pro-fotos', undefined, 'pro')
            else if (p.accion === 'pasos') nav.ir('pro-pasos', undefined, 'pro')
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

/** «¿Voy bien?» del domingo con el semáforo de verdad (antes salía siempre un check verde). */
function VoyBien({ rutina }: { rutina: Rutina | null }) {
  const nav = useNav()
  const perfil = usePerfil()
  const hoy = hoyISO()
  const r = useLiveQuery(async () => {
    const dias = semanaDe(hoy)
    const domingo = dias[6]!
    const [sesiones, mediciones, comidas, pasos, energia] = await Promise.all([
      sesionesHechas(),
      db.mediciones.toArray(),
      db.comidas.where('fecha').between(sumarDias(dias[0]!, -21), domingo, true, true).toArray(),
      db.pasos.where('fecha').between(sumarDias(dias[0]!, -7), domingo, true, true).toArray(),
      objetivosEnergia(perfil),
    ])
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
    <Seccion titulo="¿Voy bien?" extra={<span className="lbl">Revisión del domingo</span>}>
      <button className="card pd sem-card" onClick={() => nav.pestana('pro')}>
        <span className={cx('lamp', tono)}><Ico n={icono} b /></span>
        <span className="tx">
          <b>{r ? r.titulo : 'Tu semana aún está vacía'}</b>
          <small>{r ? r.frase : 'Entrena, pésate o apunta comidas y aquí verás si vas bien'}</small>
        </span>
        <Ico n="caret-right" className="car" />
      </button>
    </Seccion>
  )
}

// ---------- Primeros pasos (para quien acaba de llegar; sin tutorial) ----------

const CLAVE_PASOS = 'jf-primeros-pasos'
type EstadoPasos = { cerrado?: boolean; progreso?: boolean }
function leerPasos(): EstadoPasos {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_PASOS) ?? '{}') as unknown
    return v && typeof v === 'object' ? (v as EstadoPasos) : {}
  } catch { return {} }
}
function guardarPasos(e: EstadoPasos) {
  try { localStorage.setItem(CLAVE_PASOS, JSON.stringify(e)) } catch { /* sin almacenamiento: vale solo para esta visita */ }
}

type Paso = { id: string; titulo: string; hecho: boolean; ir: () => void }
type Guia = { pasos: Paso[]; n: number; cerrar: () => void }

/**
 * 4 pasos que se marcan solos al hacerlos. Desaparece al completarlos o con «Ya lo sé». Solo las primeras semanas.
 * Devuelve null si no se ve, y undefined mientras carga (cuenta como «se ve» para no enseñar y quitar los pendientes).
 */
function usePrimerosPasos(t: ReturnType<typeof tarjetaHoy>): Guia | null | undefined {
  const nav = useNav()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const [estado, setEstado] = useState<EstadoPasos>(leerPasos)
  const hechos = useLiveQuery(async () => {
    const [entrenos, mediciones, comidas] = await Promise.all([db.sesiones.where('estado').equals('hecha').count(), db.mediciones.toArray(), db.comidas.count()])
    // El peso del alta se guarda como «manual»: el paso se marca al apuntarlo otra vez.
    const pesos = mediciones.filter(m => m.pesoKg != null)
    return { entreno: entrenos > 0, peso: pesos.length >= 2 || pesos.some(m => m.origen !== 'manual'), comida: comidas > 0 }
  }, [])
  const cambiar = (e: EstadoPasos) => { guardarPasos(e); setEstado(e) }
  // Solo para quien acaba de llegar: quien ya lleva tiempo con la app no lo ve.
  const reciente = !ajustes.inicio || diasEntre(ajustes.inicio, hoy) <= 28
  if (estado.cerrado || !reciente) return null
  if (!hechos) return undefined
  const dia = t.tipo === 'hoy' || t.tipo === 'opcional' ? t.dia : null
  // Día de descanso: se dice qué día toca («Haz tu primer entreno (martes)») y se abre ese día de la rutina.
  const prox = t.tipo === 'descanso' && t.proximo?.dia ? t.proximo : null
  const cuando = dia ? '' : prox ? ` (${DIAS[diaSemana(deISO(prox.fecha))]})` : t.tipo === 'perdida' ? ` (${DIAS[diaSemana(deISO(t.destino))]})` : ''
  const pasos: Paso[] = [
    { id: 'entreno', titulo: `Haz tu primer entreno${cuando}`, hecho: hechos.entreno, ir: () => (dia ? nav.hoja('sheet-ses1', { letra: dia.letra, version: 'normal' }) : prox?.dia ? nav.ir('rut-dia', { letra: prox.dia.letra }, 'rut') : nav.pestana('rut')) },
    { id: 'peso', titulo: 'Apunta tu peso', hecho: hechos.peso, ir: () => nav.hoja('sheet-peso') },
    { id: 'comida', titulo: 'Apunta una comida', hecho: hechos.comida, ir: () => nav.hoja('sheet-add', { fecha: hoy }) },
    { id: 'progreso', titulo: 'Mira tu semana en Progreso', hecho: !!estado.progreso, ir: () => { cambiar({ ...estado, progreso: true }); nav.pestana('pro') } },
  ]
  const n = pasos.filter(p => p.hecho).length
  if (n === pasos.length) return null
  return { pasos, n, cerrar: () => cambiar({ ...estado, cerrado: true }) }
}

function PrimerosPasos({ g }: { g: Guia }) {
  const { pasos, n } = g
  return (
    <Seccion titulo="Primeros pasos" extra={<button className="lnk" onClick={g.cerrar}>Ya lo sé</button>}>
      <div className="list">
        {pasos.map(p => (
          <button key={p.id} className={cx('it todo', p.hecho && 'done')} onClick={p.ir}>
            <span className="box"><Ico n="check" b /></span>
            <span className="tx"><b>{p.titulo}</b></span>
            <Ico n="caret-right" className="car" />
          </button>
        ))}
      </div>
      <p className="small muted mt8">{n} de {pasos.length} hechos</p>
    </Seccion>
  )
}
