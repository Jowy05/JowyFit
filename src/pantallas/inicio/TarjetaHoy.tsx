// INI-01 · «Hoy te toca»: la tarjeta del día (en curso, sin rutina, entreno, opcional, perdido, hecho o descanso).
import type { ReactElement } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { recolocarSesion, SIN_DIA } from '../../datos/acciones/rutina'
import { sugerenciasDia } from '../../datos/consultas'
import type { DiaRutina, Guardado, Perfil, Rutina, Sesion } from '../../datos/tipos'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { indiceActual } from '../../dominio/sesion'
import { DIAS, deISO, diaSemana, fechaCorta, formatoHora } from '../../dominio/fechas'
import { duracionDia } from '../../dominio/generador'
import type { Tarjeta } from '../../dominio/semana'
import type { Cola } from '../../dominio/cola'
import { nombreCardio } from '../../dominio/cardio'
import { rutinaBloqueada } from '../../dominio/salud'
import { capital, kg } from '../../dominio/formato'
import type { Sugerencia } from '../../dominio/progresion'
import { nombreEntreno } from '../../dominio/nombres'
import { cx, Ico, Th } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useGimnasio, usePerfil } from '../../datos/hooks'
import { idioma, t } from '../../i18n'
import { tr } from '../../i18n/jsx'

/** La palabra que da el movimiento: «Curl» de «Curl de Bíceps…»; en inglés va al final («Dumbbell Bicep Curl»). */
const palabraClave = (nombre?: string) => String(idioma() === 'en' ? nombre?.split(' ').at(-1) : nombre?.split(' ')[0])

export function TarjetaHoy({ tar, cola, rutina, enCurso, gym }: { tar: Tarjeta<Guardado<Sesion>>; cola: Cola | null; rutina: Rutina | null; enCurso: Sesion | null; gym?: string }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const dia = tar.tipo === 'hoy' || tar.tipo === 'opcional' ? tar.dia : null
  const sug = useLiveQuery(() => (dia ? sugerenciasDia(dia, g) : Promise.resolve(undefined)), [dia, g])
  const empezar = (version: 'normal' | 'minima') => dia && nav.hoja('hoja-empezar', { letra: dia.letra, version })
  const cardio = cardioAlAcabar(perfil, rutina)

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
        <div className="pd"><button className="btn xl" onClick={() => nav.abrirEntreno()}><Ico n="play" b />{t('Continuar')}</button></div>
      </div>
    )
  }
  // Con una señal de «Antes de entrenar» marcada no se propone entreno (Generar tampoco hace rutina).
  if (rutinaBloqueada(perfil) && (tar.tipo === 'hoy' || tar.tipo === 'opcional' || tar.tipo === 'sin')) {
    return (
      <div className="card today"><div className="pd empty">
        <span className="empty-ic bad"><Ico n="first-aid" /></span>
        <h3 className="h3">{t('Hoy no entrenes')}</h3>
        <p className="muted">{t('Marcaste una señal de «Antes de entrenar». Desmárcala en Perfil → Salud cuando tu médico te dé el visto bueno.')}</p>
        <button className="btn gry sm mt12" onClick={() => nav.ir('seccion-perfil', { s: 'salud' }, 'per')}>{t('Ir a Salud')}</button>
      </div></div>
    )
  }
  if (tar.tipo === 'sin') {
    return (
      <div className="card today"><div className="pd empty">
        <span className="empty-ic"><Ico n="clipboard-text" /></span>
        <h3 className="h3">{t('Aún no tienes rutina')}</h3>
        <p className="muted">{t('La creamos con tus días, tu tiempo y tu gimnasio. Tarda 10 segundos.')}</p>
        <button className="btn mt12" onClick={() => nav.ir('generar-rutina', undefined, 'rut')}><Ico n="magic-wand" b />{t('Crear mi rutina')}</button>
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
          <div className="row">
            {rutina?.calibracion && <span className="tag blue">{t('Semana de prueba')}</span>}
            {cola
              ? <span className="tag blue"><Ico n="queue" b />{t('{n}.ª de {total} esta semana', { n: cola.hechasSemana + 1, total: cola.porSemana })}</span>
              : <span className="tag">{capital(DIAS[diaSemana(new Date())]!)} · {formatoHora(perfil.horaEntreno)}</span>}
          </div>
          <h3>{nombreEntreno(d)}</h3>
          <p className="today-meta">
            <span><Ico n="clock" />~{Math.round(duracionDia(d.bloques) / 60)} min</span>
            {gym && <span><Ico n="map-pin" />{gym}</span>}
          </p>
          {cola && <EnCola cola={cola} />}
        </div>
        <FilasDia dia={d} sug={sug} equilibrio={rutina?.equilibrio} cardio={cardio} />
        <div className="pd today-act">
          {/* La versión corta se elige en la hoja «Empezar»; la mínima, también aquí para quien va justo. */}
          <button className="btn xl" onClick={() => empezar('normal')}><Ico n="play" b />{t('Empezar rutina')}</button>
          {cola && <div className="g2-min"><button className="lnk" onClick={() => empezar('minima')}>{t('¿Poco tiempo? Sesión mínima de 15 min')}</button></div>}
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
          <button className="btn gry sm" onClick={async () => { await recolocarSesion({ fecha: SIN_DIA, letra: tar.perdido.dia!.letra, desde: tar.perdido.fecha }); aviso(t('Sin problema: la saltamos esta semana')) }}>{t('No')}</button>
          <button className="btn sm" onClick={async () => { await recolocarSesion({ fecha: tar.destino, letra: tar.perdido.dia!.letra, desde: tar.perdido.fecha }); aviso(t('Hecho: el {dia} entrenas {nombre}', { dia: DIAS[diaSemana(destino)]!, nombre: tar.perdido.dia ? nombreEntreno(tar.perdido.dia) : '' })) }}>{t('Sí, al {dia}', { dia: DIAS[diaSemana(destino)]! })}</button>
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
        {cola
          ? <div className="spec mt12"><p><span>{t('Próximo')}</span><b>{nombreEntreno(cola.siguiente)}</b></p></div>
          : tar.proximo?.dia && <div className="spec mt12"><p><span>{t('Próximo')}</span><b>{capital(DIAS[diaSemana(deISO(tar.proximo.fecha))]!)} · {nombreEntreno(tar.proximo.dia)}</b></p></div>}
        <button className="btn gry sm mt12" onClick={() => nav.ir('detalle-entreno', { id: tar.sesion.id }, 'pro')}>{t('Ver el entreno')}</button>
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

/** «La última: B, el miércoles. Después: A.» */
function EnCola({ cola }: { cola: Cola }) {
  const { ultima, despues } = cola
  if (!ultima?.dia && !despues[0]) return null
  return (
    <p className="g2-last">
      {ultima?.dia && tr('La última: <b>{nombre}</b>, el {dia}.', { nombre: nombreEntreno(ultima.dia), dia: DIAS[diaSemana(deISO(ultima.fecha))]!, b: x => <b>{x}</b> })}
      {ultima?.dia && despues[0] && ' '}
      {despues[0] && tr('Después: <b>{nombre}</b>.', { nombre: nombreEntreno(despues[0]), b: x => <b>{x}</b> })}
    </p>
  )
}

/** «Y al acabar: 20 min de bici o caminar», si el cardio va después de las pesas (lo de la semana entre los entrenos). */
function cardioAlAcabar(p: Perfil, r: Rutina | null): string | null {
  const entrenos = r?.dias.filter(d => !d.opcional).length ?? 0
  if (p.cardioCuando !== 'despues' || !p.cardioMin || !entrenos) return null
  const min = Math.max(5, Math.round(p.cardioMin / entrenos / 5) * 5)
  const tipos = (p.cardioTipos?.length ? p.cardioTipos : ['caminar' as const]).slice(0, 2).map(x => nombreCardio(x).toLowerCase())
  return t('{n} min de {tipos}', { n: min, tipos: tipos.join(t(' o ')) })
}

/** Hasta 4 ejercicios del día con el peso que toca; el resto, en una línea. */
function FilasDia({ dia, sug, equilibrio, cardio }: { dia: DiaRutina; sug?: Map<string, Sugerencia>; equilibrio?: number; cardio?: string | null }) {
  const filas: ReactElement[] = []
  const vistos = new Set<string>()
  const bloques = dia.bloques
  // Sin peso todavía (o con el de partida que propone la app): «nuevo» en gris, en vez de un «—» que parece un error.
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
        <span className="tx">{comp ? t('Dos seguidos: {a} + {b}', { a: palabraClave(e?.nombre), b: palabraClave(ejercicio(comp.ejercicio)?.nombre) }) : e?.nombre}</span>
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
      {equilibrio != null && <p className="exmore">{t('+ Equilibrio junto a la pared · {n} min', { n: equilibrio })}</p>}
      {cardio && <p className="g2-cardio"><Ico n="bicycle" /><span>{tr('Y al acabar: <b>{que}</b>', { que: cardio, b: x => <b>{x}</b> })}</span></p>}
    </div>
  )
}
