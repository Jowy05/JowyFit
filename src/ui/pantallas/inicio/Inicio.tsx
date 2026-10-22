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
import { DIAS, DIAS_ABREV, DIAS_CORTOS, deISO, diaMes, diaSemana, diasEntre, fechaCorta, formatoHora, hoyISO, lunesDe, numeroSemana, saludo, semanaDe, sumarDias } from '../../../dominio/fechas'
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
import { idioma, t, tc } from '../../../i18n'
import { tr } from '../../../i18n/jsx'
import { nombreEntreno } from '../../../dominio/nombres'

/** La palabra que da el movimiento: «Curl» de «Curl de Bíceps…»; en inglés va al final («Dumbbell Bicep Curl»). */
const palabraClave = (nombre?: string) => String(idioma() === 'en' ? nombre?.split(' ').at(-1) : nombre?.split(' ')[0])

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
      case 'hecho': return t('{dia} · hecho: {nombre}', { dia: nom, nombre: e.sesion ? nombreEntreno(e.sesion) : '' })
      case 'plan': return `${nom} · ${e.dia ? nombreEntreno(e.dia) : ''} · ${formatoHora(perfil.horaEntreno)}`
      case 'perdido': return t('{dia} · perdido: {nombre}', { dia: nom, nombre: e.dia ? nombreEntreno(e.dia) : '' })
      case 'movido': return t('{dia} · pasado a otro día', { dia: nom })
      case 'opcional': return t('{dia} · opcional: {nombre}', { dia: nom, nombre: e.dia ? nombreEntreno(e.dia) : '' })
      default: return t('{dia} · descanso', { dia: nom })
    }
  }

  return (
    <Pantalla>
      <Cab
        crumb={t('{dia} {fecha} · semana {n}', { dia: capital(DIAS_ABREV[diaSemana(d)]!), fecha: diaMes(d.getDate(), d.getMonth()), n: nSemana })}
        titulo={`${saludo()}${perfil.nombre ? `, ${perfil.nombre}` : ''}`}
        derecha={<button className="ib" aria-label={t('Ajustes')} onClick={() => nav.ir('aju')}><Ico n="gear" /></button>}
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
          <span><Ico n="check" b className="okc" />{t('Hecho')}</span>
          <span><Ico n="circle" b className="blue" />{t('Plan')}</span>
          <span><Ico n="circle-dashed" />{t('Opcional')}</span>
          <span><Ico n="x" b className="badc" />{t('Perdido')}</span>
          <span><Ico n="minus" b />{t('Descanso')}</span>
        </p>
      </Cab>

      <div className="pg">
        <SemanaSuave rutina={rutina ?? null} />

        <Seccion tour="hoy" titulo={t('Hoy te toca')} accion={tarjeta.tipo === 'hoy' ? t('Ver día') : undefined} onAccion={() => tarjeta.tipo === 'hoy' && nav.ir('rut-dia', { letra: tarjeta.dia.letra }, 'rut')}>
          <TarjetaHoy tar={tarjeta} rutina={rutina ?? null} enCurso={enCurso ?? null} gym={gym?.nombre == null ? undefined : recortar(gym.nombre, LARGO.nombre)} />
        </Seccion>

        {/* El domingo, «¿Voy bien?» justo debajo de «Hoy te toca» (antes salía al final y no se llegaba). */}
        {diaSemana(d) === 6 && <VoyBien rutina={rutina ?? null} />}

        {/* Los accesos rápidos, a mano: antes había que bajar tres pantallas para llegar a «+ Comer o beber». */}
        <div className="sec">
          {/* Comida y picoteo abrían la misma hoja: un solo botón (no hay que decidir si un café es comida o picoteo). */}
          <div className="qa-row ux-qa3" data-tour="atajos">
            <button className="qa" onClick={() => nav.hoja('sheet-add', { fecha: hoy })}><Ico n="fork-knife" /><span>{t('+ Comer o beber')}</span></button>
            <button className="qa" onClick={() => nav.ir('com-scan', undefined, 'com')}><Ico n="barcode" /><span>{t('Escanear')}</span></button>
            <button className="qa" onClick={() => nav.hoja('sheet-peso')}><Ico n="scales" /><span>{t('+ Peso')}</span></button>
          </div>
        </div>

        {guia && <PrimerosPasos g={guia} />}

        <Seccion tour="numeros" titulo={t('Hoy en números')} accion={t('Comida')} onAccion={() => nav.pestana('com')}>
          <div className="grid2">
            <div className="card kpi span2">
              <div className="row jb">
                <span className="lbl">{t('Proteína')}</span>
                {energia && <span className="small muted">{tot.proteina >= energia.proteina ? t('Objetivo cumplido') : t('Faltan {n} g', { n: Math.round(energia.proteina - tot.proteina) })}</span>}
              </div>
              <p className="k">{Math.round(tot.proteina)}<small>/ {energia?.proteina ?? '—'} g</small></p>
              <div className="mt8"><Barra v={tot.proteina} total={energia?.proteina ?? 1} tono="ok" gruesa /></div>
            </div>
            {ajustes.mostrarKcal && (
              <div className="card kpi">
                <span className="lbl">{t('Calorías')}</span>
                <p className="k">{num(tot.kcal, 0)}<small>/ ~{energia ? num(energia.kcal, 0) : '—'}</small></p>
                <div className="mt8"><Barra v={tot.kcal} total={energia?.kcal ?? 1} /></div>
                <p className="d">{t('kcal · orientativo')}</p>
              </div>
            )}
            {(
              <button className={cx('card kpi steps', !ajustes.mostrarKcal && 'span2')} onClick={() => nav.ir('pro-pasos', undefined, 'pro')}>
                <Anillo v={pasos?.pasos ?? 0} total={perfil.pasosObjetivo} />
                <div className="grow">
                  <span className="lbl">{t('Pasos')}</span>
                  <p className="k sm">{num(pasos?.pasos ?? 0, 0)}</p>
                  <p className="d">{t('de {n}', { n: num(perfil.pasosObjetivo, 0) })}</p>
                </div>
              </button>
            )}
            {ajustes.mostrarKcal && gasto && (
              <>
                <button className="card kpi" onClick={() => aviso(gasto.formula === 'katch'
                  ? t('Lo que gasta tu cuerpo sin moverte, con tu peso ({peso} kg) y tu grasa ({grasa} %). Aproximado.', { peso: num(gasto.peso), grasa: num(gasto.grasa) })
                  : t('Lo que gasta tu cuerpo sin moverte, con tu peso ({peso} kg), tu altura, tu edad y tu sexo. Con tu % de grasa saldría más fino. Aproximado.', { peso: num(gasto.peso) }))}>
                  <span className="lbl">{t('En reposo')}</span>
                  <p className="k">{num(gasto.basal, 0)}<small>kcal</small></p>
                  <p className="d">{t('al día sin moverte · llevas ~{n}', { n: num(basalHastaAhora(gasto.basal, new Date().getHours() * 60 + new Date().getMinutes()), 0) })}</p>
                </button>
                <button className="card kpi" onClick={() => aviso(t('Pasos: unas {kcal} kcal por kilo y kilómetro (con tu zancada). Entreno: según cada ejercicio y las series que has hecho. Sin contar el reposo. Aproximado.', { kcal: num(0.5) }))}>
                  <span className="lbl">{tc('gasto', 'Por ejercicio')}</span>
                  <p className="k">{num(gasto.pasos + gasto.entreno.hecho, 0)}<small>kcal</small></p>
                  <p className="d">{gasto.hayEntreno ? t('pasos ~{pasos} · entreno ~{entreno}', { pasos: num(gasto.pasos, 0), entreno: num(gasto.entreno.hecho, 0) }) : t('pasos ~{pasos}', { pasos: num(gasto.pasos, 0) })}</p>
                  {gasto.entreno.saltado > 0 && <p className="d warnc">{t('−{n} por lo saltado', { n: num(gasto.entreno.saltado, 0) })}</p>}
                </button>
              </>
            )}
            {tot.cafeina > 0 && (
              <div className="card kpi span2 row">
                <span className="ico"><Ico n="coffee" /></span>
                <div className="grow">
                  <div className="row jb"><span className="lbl">{t('Cafeína')}</span><span className="mono small">{tot.cafeina} / {ajustes.cafeinaLimite} mg</span></div>
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
              <span>{tr('<b>Haz una copia de seguridad.</b> Tus datos solo están en este móvil.', { b: s => <b>{s}</b> })}</span>
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
    const pesoTxt = (x?: Sugerencia) => (!x ? '' : nuevo(x) ? (todosNuevos ? '' : t('nuevo')) : x.peso != null ? kg(x.peso) : x.reps != null ? (b.registro === 'tiempo' ? `${x.reps} s` : t('{n} reps', { n: x.reps })) : '')
    filas.push(
      <div key={b.uid} className={cx('exr', s?.accion === 'subir' && 'hot')}>
        {comp ? <span className="th xs c-br"><Ico n="link" b /></span> : <Th ej={e} size="xs" />}
        <span className="tx ellip">{comp ? t('Dos seguidos: {a} + {b}', { a: palabraClave(e?.nombre), b: palabraClave(ejercicio(comp.ejercicio)?.nombre) }) : e?.nombre}</span>
        <span className="sr">{b.series} × {b.repsMin}-{b.repsMax}</span>
        <b className={cx('kg', (comp ? nuevo(s) && nuevo(s2) : nuevo(s)) && 'ux-nuevo')}>
          {comp ? (nuevo(s) && nuevo(s2) ? (todosNuevos ? '' : t('nuevo')) : `${pesoTxt(s)} · ${pesoTxt(s2)}`) : s && !nuevo(s) && s.peso != null ? <>{kg(s.peso)} kg {s.accion === 'subir' && <Ico n="arrow-up" b />}</> : pesoTxt(s)}
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

function TarjetaHoy({ tar, rutina, enCurso, gym }: { tar: ReturnType<typeof tarjetaHoy>; rutina: Rutina | null; enCurso: Sesion | null; gym?: string }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const dia = tar.tipo === 'hoy' || tar.tipo === 'opcional' ? tar.dia : null
  const sug = useLiveQuery(() => (dia ? sugerenciasDia(dia, g) : Promise.resolve(undefined)), [dia, g])
  const empezar = (version: 'normal' | 'corta') => dia && nav.hoja('sheet-ses1', { letra: dia.letra, version })

  if (tar.tipo === 'curso' && enCurso) {
    const idx = indiceActual(enCurso)
    return (
      <div className="card today">
        <div className="today-hero live">
          <div className="row"><span className="tag go"><Ico n="record" b />{t('En curso')}</span></div>
          <h3>{nombreEntreno(enCurso)}</h3>
          <p className="today-meta"><span>{idx >= 0 ? t('Ejercicio {n} de {total} · {nombre}', { n: idx + 1, total: enCurso.ejercicios.length, nombre: nombreEjercicio(enCurso.ejercicios[idx]?.ejercicio) }) : enCurso.ejercicios.length ? t('Todo hecho: falta terminarlo') : t('Aún sin ejercicios')}</span></p>
        </div>
        {/* «Restaurar» no hace nada si la app se cerró a mitad del entreno: abrirEntreno lo abre igualmente. */}
        <div className="pd"><button className="btn xl" onClick={() => abrirEntreno(nav)}><Ico n="play" b />{t('Continuar')}</button></div>
      </div>
    )
  }
  if (tar.tipo === 'sin') {
    return (
      <div className="card today"><div className="pd empty">
        <span className="empty-ic"><Ico n="clipboard-text" /></span>
        <h3 className="h3">{t('Aún no tienes rutina')}</h3>
        <p className="muted">{t('La creamos con tus días, tu tiempo y tu gimnasio. Tarda 10 segundos.')}</p>
        <button className="btn mt12" onClick={() => nav.ir('rut-gen', undefined, 'rut')}><Ico n="magic-wand" b />{t('Crear mi rutina')}</button>
      </div></div>
    )
  }
  if (tar.tipo === 'hoy') {
    const d = tar.dia
    return (
      <div className="card today">
        {/* La explicación de la semana de prueba sale dentro del entreno; aquí basta la etiqueta. Sin «Día A»: la letra no dice nada. */}
        <div className="today-hero">
          <Ico n="barbell" className="today-bg" />
          <div className="row">{rutina?.calibracion && <span className="tag blue">{t('Semana de prueba')}</span>}<span className="tag">{capital(DIAS[diaSemana(new Date())]!)} · {formatoHora(perfil.horaEntreno)}</span></div>
          <h3>{nombreEntreno(d)}</h3>
          <p className="today-meta">
            <span><Ico n="clock" />~{Math.round(duracionDia(d.bloques) / 60)} min</span>
            {gym && <span><Ico n="map-pin" />{gym}</span>}
          </p>
        </div>
        <FilasDia dia={d} sug={sug} />
        <div className="pd today-act">
          {/* La versión corta se elige en la hoja «Empezar» (antes también estaba aquí: la misma pregunta dos veces). */}
          <button className="btn xl" onClick={() => empezar('normal')}><Ico n="play" b />{t('Empezar rutina')}</button>
        </div>
      </div>
    )
  }
  if (tar.tipo === 'opcional') {
    return (
      <div className="card today">
        <div className="today-hero opt">
          <div className="row"><span className="tag blue">{t('Opcional')}</span><span className="tag">{capital(DIAS[diaSemana(new Date())]!)}</span></div>
          <h3>{t('¿Sesión extra?')}</h3>
          <p className="today-meta"><span>{nombreEntreno(tar.dia)} · ~{Math.round(duracionDia(tar.dia.bloques) / 60)} min</span></p>
        </div>
        <FilasDia dia={tar.dia} sug={sug} />
        <div className="pd btns">
          <button className="btn gry sm" onClick={() => aviso(t('Vale, hoy no. Buen día'))}>{t('Hoy no')}</button>
          <button className="btn sm" onClick={() => empezar('normal')}>{t('Empezar')}</button>
        </div>
      </div>
    )
  }
  if (tar.tipo === 'perdida') {
    const dd = deISO(tar.perdido.fecha)
    const destino = deISO(tar.destino)
    return (
      <div className="card today"><div className="pd">
        <div className="row">
          <span className="ico big warnb"><Ico n="calendar-x" /></span>
          <div className="grow"><h3 className="h3">{t('El {dia} no entrenaste.', { dia: DIAS[diaSemana(dd)]! })}</h3><p className="muted">{t('¿La pasamos al {dia}?', { dia: DIAS[diaSemana(destino)]! })}</p></div>
        </div>
        <div className="spec mt12">
          <p><span>{t('Sesión')}</span><b>{tar.perdido.dia ? nombreEntreno(tar.perdido.dia) : ''}</b></p>
          <p><span>{t('Nuevo día')}</span><b>{capital(DIAS[diaSemana(destino)]!)} {destino.getDate()}</b></p>
        </div>
        <div className="btns mt12">
          <button className="btn gry sm" onClick={async () => { await guardarAjustes({ recolocadas: [...(await db.ajustes.get('app'))!.recolocadas ?? [], { fecha: '0000-00-00', letra: tar.perdido.dia!.letra, desde: tar.perdido.fecha }] }); aviso(t('Sin problema: la saltamos esta semana')) }}>{t('No')}</button>
          <button className="btn sm" onClick={async () => { const a = (await db.ajustes.get('app'))!; await guardarAjustes({ recolocadas: [...(a.recolocadas ?? []), { fecha: tar.destino, letra: tar.perdido.dia!.letra, desde: tar.perdido.fecha }] }); aviso(t('Hecho: el {dia} entrenas {nombre}', { dia: DIAS[diaSemana(destino)]!, nombre: tar.perdido.dia ? nombreEntreno(tar.perdido.dia) : '' })) }}>{t('Sí, al {dia}', { dia: DIAS[diaSemana(destino)]! })}</button>
        </div>
      </div></div>
    )
  }
  if (tar.tipo === 'hecho') {
    return (
      <div className="card today"><div className="pd">
        <div className="row">
          <span className="ico big okb"><Ico n="check-circle" /></span>
          <div className="grow"><h3 className="h3">{t('Entreno de hoy hecho.')}</h3><p className="muted">{t('{nombre} · {n} ejercicios', { nombre: tar.sesion.nombre, n: tar.sesion.ejercicios.filter(e => e.estado === 'hecho').length })}</p></div>
        </div>
        {tar.proximo?.dia && <div className="spec mt12"><p><span>{t('Próximo')}</span><b>{capital(DIAS[diaSemana(deISO(tar.proximo.fecha))]!)} · {nombreEntreno(tar.proximo.dia)}</b></p></div>}
        <button className="btn gry sm mt12" onClick={() => nav.ir('pro-entreno', { id: tar.sesion.id }, 'pro')}>{t('Ver el entreno')}</button>
      </div></div>
    )
  }
  const prox = tar.tipo === 'descanso' ? tar.proximo : undefined
  return (
    <div className="card today"><div className="pd">
      <div className="row">
        <span className="ico big"><Ico n="moon" /></span>
        <div className="grow"><h3 className="h3">{t('Hoy descansas.')}</h3>{prox?.dia && <p className="muted">{t('Próximo: {dia} a las {hora}', { dia: DIAS[diaSemana(deISO(prox.fecha))]!, hora: formatoHora(perfil.horaEntreno) })}</p>}</div>
      </div>
      {prox?.dia && (
        <div className="spec mt12">
          <p><span>{capital(DIAS[diaSemana(deISO(prox.fecha))]!)} {fechaCorta(prox.fecha)}</span><b>{nombreEntreno(prox.dia)}</b></p>
          <p><span>{t('Duración')}</span><b>~{Math.round(duracionDia(prox.dia.bloques) / 60)} min</b></p>
        </div>
      )}
      <button className="btn gry sm mt12" onClick={() => nav.pestana('rut')}>{t('Ver mi plan')}</button>
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
    if (esBatido(s)) aviso(t('Apuntado: {nombre} · {n} g proteína', { nombre: s, n: batidoDe(perfil.batido).proteina }), () => { deshacer(); setOcultos(o => o.filter(x => x !== s)) })
    setTimeout(() => setOcultos(o => [...o, s]), 700)
  })
  const visibles = lista.filter(p => !ocultos.includes(p.id))
  if (!visibles.length) return null
  return (
    <Seccion tour="pendientes" titulo={t('Pendientes de hoy')} extra={<span className="lbl">{visibles.length}</span>}>
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
        <span className="lbl">{t('Próximo objetivo')}</span>
        <p className="rot-big">{datos.meta.titulo}</p>
        {datos.meta.fecha && <p className="small muted mt4">{t('Para el {fecha}', { fecha: fechaCorta(datos.meta.fecha) })}</p>}
      </div>) },
    datos?.logro && { k: 'logro', ir: () => nav.ir('pro-fuerza', undefined, 'pro'), el: (
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
    <Seccion titulo={t('Tu progreso')} accion={t('Ver todo')} onAccion={() => nav.ir('pro-fuerza', undefined, 'pro')}>
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
function usePrimerosPasos(tar: ReturnType<typeof tarjetaHoy>): Guia | null | undefined {
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
  const dia = tar.tipo === 'hoy' || tar.tipo === 'opcional' ? tar.dia : null
  // Día de descanso: se dice qué día toca («Haz tu primer entreno (martes)») y se abre ese día de la rutina.
  const prox = tar.tipo === 'descanso' && tar.proximo?.dia ? tar.proximo : null
  const cuando = dia ? null : prox ? DIAS[diaSemana(deISO(prox.fecha))]! : tar.tipo === 'perdida' ? DIAS[diaSemana(deISO(tar.destino))]! : null
  const pasos: Paso[] = [
    { id: 'entreno', titulo: cuando ? t('Haz tu primer entreno ({dia})', { dia: cuando }) : t('Haz tu primer entreno'), hecho: hechos.entreno, ir: () => (dia ? nav.hoja('sheet-ses1', { letra: dia.letra, version: 'normal' }) : prox?.dia ? nav.ir('rut-dia', { letra: prox.dia.letra }, 'rut') : nav.pestana('rut')) },
    { id: 'peso', titulo: t('Apunta tu peso'), hecho: hechos.peso, ir: () => nav.hoja('sheet-peso') },
    { id: 'comida', titulo: t('Apunta una comida'), hecho: hechos.comida, ir: () => nav.hoja('sheet-add', { fecha: hoy }) },
    { id: 'progreso', titulo: t('Mira tu semana en Progreso'), hecho: !!estado.progreso, ir: () => { cambiar({ ...estado, progreso: true }); nav.pestana('pro') } },
  ]
  const n = pasos.filter(p => p.hecho).length
  if (n === pasos.length) return null
  return { pasos, n, cerrar: () => cambiar({ ...estado, cerrado: true }) }
}

function PrimerosPasos({ g }: { g: Guia }) {
  const { pasos, n } = g
  return (
    <Seccion titulo={t('Primeros pasos')} extra={<button className="lnk" onClick={g.cerrar}>{t('Ya lo sé')}</button>}>
      <div className="list">
        {pasos.map(p => (
          <button key={p.id} className={cx('it todo', p.hecho && 'done')} onClick={p.ir}>
            <span className="box"><Ico n="check" b /></span>
            <span className="tx"><b>{p.titulo}</b></span>
            <Ico n="caret-right" className="car" />
          </button>
        ))}
      </div>
      <p className="small muted mt8">{t('{n} de {total} hechos', { n, total: pasos.length })}</p>
    </Seccion>
  )
}
