// SES-01 · Antes de empezar
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarPerfil } from '../../datos/repos'
import type { DiaRutina, Perfil, Sesion } from '../../datos/tipos'
import { DIAS, horaActual, minutosDe } from '../../dominio/fechas'
import { duracionDia } from '../../dominio/generador'
import { rutinaBloqueada } from '../../dominio/salud'
import { BloqueoUrgencia } from '../perfil/SaludDolor'
import { diaMinimo } from '../../dominio/cola'
import { capacidades, permisoNotificaciones } from '../../plataforma'
import { cx, Elegir, FilaInterruptor, Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasios, useMarcas, usePerfilCargado, useRutina, useSesionEnCurso } from '../../datos/hooks'
import { bloquesDeVersion } from '../../dominio/sesion'
import { calentarAntes, cambiosEnGimnasio, iniciarEntreno } from '../../datos/acciones/entreno'
import { loQueFalta } from '../../datos/consultas'
import { useCatalogo } from '../../catalogo/catalogo'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'
import { nombreEntreno } from '../../dominio/nombres'

export function HojaEmpezar({ ruta }: { ruta: Ruta<'hoja-empezar'> }) {
  const nav = useNav()
  const r = useRutina()
  const perfil = usePerfilCargado()
  const enCurso = useSesionEnCurso()
  const cat = useCatalogo()
  const dia = r?.dias.find(d => d.letra === ruta.d.letra) ?? r?.dias[0]
  // El día opcional se arma con lo que falta de la semana: aquí sale el mismo que en Inicio y el que se creará al
  // empezar (los minutos y el «no te da tiempo» se cuentan con ese).
  const calculado = useLiveQuery(async () => {
    if (!dia?.opcional || !r || !cat) return null
    return { letra: dia.letra, rutinaId: r.id, falta: await loQueFalta(dia, r) }
  }, [dia, r, cat])
  const falta = calculado?.falta
  // Esperar a tener perfil, rutina y sesión: si no, la hora límite y el transporte salen los de por defecto
  // y durante un instante se ve «Sin rutina».
  if (r === undefined || !perfil || enCurso === undefined || (dia?.opcional && (!cat || !calculado || calculado.letra !== dia.letra || calculado.rutinaId !== r?.id))) return <Hoja titulo={t('Empezar')}><p className="muted">{t('Cargando…')}</p></Hoja>
  if (enCurso) return (
    <Hoja titulo={t('Ya estás entrenando')}>
      <p className="muted">{t('Tienes «{nombre}» en curso.', { nombre: nombreEntreno(enCurso) })}</p>
      <button className="btn xl mt16" onClick={() => nav.abrirEntreno()}><Ico n="play" b />{t('Continuar')}</button>
    </Hoja>
  )
  // Con una señal de «Antes de entrenar» no se empieza, se entre por donde se entre (Inicio, Mi plan, la guía…).
  if (rutinaBloqueada(perfil)) return (
    <Hoja cerrar={false} className="tall" etiqueta={t('Hoy no entrenes')}>
      <BloqueoUrgencia onEquivocado={() => void guardarPerfil({ urgencias: [] })} onVale={() => nav.hoja(null)} />
    </Hoja>
  )
  if (!dia) return (
    <Hoja titulo={t('Sin rutina')}>
      <p className="muted">{t('Aún no tienes rutina. La creamos con tus días, tu tiempo y tu gimnasio.')}</p>
      <button className="btn mt16" onClick={() => { nav.hoja(null); nav.ir('generar-rutina', undefined, 'rut') }}>{t('Crear mi rutina')}</button>
    </Hoja>
  )
  return <FormEmpezar dia={falta?.dia ?? dia} perfil={perfil} version={ruta.d.version ?? 'normal'} />
}

function FormEmpezar({ dia, perfil, version }: { dia: DiaRutina; perfil: Perfil; version: Sesion['version'] }) {
  const nav = useNav()
  const unaVez = useUnaVez()
  const aviso = useAviso()
  // «Normal» marcada por defecto: con la hora de salida marcada parece un entreno más largo.
  const [modo, setModo] = useState<Sesion['version']>(version)
  // La hora de salida es la del perfil (coche o andando, según lo que tenga elegido); aquí solo se ve y se cambia.
  const horaPerfil = perfil.horaLimite[perfil.transporte]
  const [hora, setHora] = useState(horaPerfil)
  const [calentar, setCalentar] = useState(false)
  // La hora de salida es una línea de texto («Sales a las 06:45 · cambiar»): no parece una opción más para marcar.
  const [cambiarHora, setCambiarHora] = useState(false)
  // Con más de un gimnasio se elige dónde se entrena hoy (por defecto, el activo); la sesión usa su material.
  const gimnasios = useGimnasios()
  const activo = useAjustes().gimnasioActivo
  const [gymElegido, setGymElegido] = useState<number | null>(null)
  const gymId = gymElegido ?? (gimnasios.some(g => g.id === activo) ? activo : gimnasios[0]?.id ?? null)
  const gym = gimnasios.find(g => g.id === gymId)
  const marcas = useMarcas()
  // Los que no se pueden hacer allí y sí tienen otro parecido: los mismos cambios que hará el entreno al empezar.
  const cambios = useMemo(() => (gym ? cambiosEnGimnasio(bloquesDeVersion(dia, modo), gym, perfil, marcas).size : 0), [dia, modo, gym, perfil, marcas])
  const normal = Math.round(duracionDia(dia.bloques) / 60)
  const corta = Math.round(duracionDia(dia.bloques, true) / 60)
  const minimo = diaMinimo(dia)
  const minima = Math.round(duracionDia(minimo.bloques) / 60)
  const series = dia.bloques.reduce((t, b) => t + b.series, 0)
  const disponibles = Math.max(0, minutosDe(hora) - minutosDe(horaActual()))
  const quitados = dia.bloques.filter(b => b.fueraEnCorta).length
  const noDa = disponibles > 0 && modo === 'normal' && disponibles < normal - 3 && corta < normal
  // Un doble toque en «Empezar» crearía dos entrenos en curso.
  const empezar = unaVez(async () => {
    // Sin permiso de notificaciones no llega el aviso de fin de descanso (ni al reloj): se pide al empezar.
    if (capacidades().recordatorios && !(await permisoNotificaciones(true))) aviso(t('Sin permiso de notificaciones: no te avisaremos al acabar el descanso (actívalo en Ajustes)'))
    if (hora !== horaPerfil) await guardarPerfil({ horaLimite: { ...perfil.horaLimite, [perfil.transporte]: hora } })
    const id = await iniciarEntreno({ letra: dia.letra, version: modo, horaLimite: hora, gimnasioId: gymId })
    if (calentar) await calentarAntes(id)
    nav.hoja(null)
    nav.completa('entreno')
  })
  return (
    <Hoja titulo={nombreEntreno(dia)} sub={t('{n} ejercicios · {series} series', { n: dia.bloques.length, series })}>
      {dia.dia != null && <span className="lbl" style={{ display: 'block', marginTop: -10, marginBottom: 12 }}>{DIAS[dia.dia]}</span>}
      {((gimnasios.length > 1 && gymId != null) || cambios > 0) && (
        <div className="ux-gym-hoy">
          {gimnasios.length > 1 && gymId != null && <>
            <p className="lbl fl">{t('¿Dónde entrenas hoy?')}</p>
            <Elegir opciones={gimnasios.map(g => ({ v: g.id, t: g.nombre }))} valor={gymId} onCambio={setGymElegido} />
          </>}
          {cambios > 0 && <p className={cx('note', gimnasios.length > 1 && 'mt8')}><Ico n="swap" /><span>{tn(cambios, 'Aquí no hay con qué hacer {n} ejercicio: harás otro parecido.', 'Aquí no hay con qué hacer {n} ejercicios: harás otros parecidos.')}</span></p>}
        </div>
      )}
      <p className="lbl fl">{t('¿Cuánto tiempo tienes?')}</p>
      <div className="opts" role="radiogroup" aria-label={t('¿Cuánto tiempo tienes?')}>
        <button role="radio" aria-checked={modo === 'normal'} className={cx('opt-c', modo === 'normal' && 'on')} onClick={() => setModo('normal')}><span className="rad" /><span className="tx"><b>{t('Normal')}</b><small>{t('Las {n} series', { n: series })}</small></span><span className="end">~{normal} min</span></button>
        <button role="radio" aria-checked={modo === 'corta'} className={cx('opt-c', modo === 'corta' && 'on')} onClick={() => setModo('corta')}><span className="rad" /><span className="tx"><b>{t('Corta')}</b><small>{quitados ? tn(quitados, 'Sin {n} ejercicio del final', 'Sin {n} ejercicios del final') : t('Igual que la normal')}</small></span><span className="end">~{corta} min</span></button>
        <button role="radio" aria-checked={modo === 'minima'} className={cx('opt-c', modo === 'minima' && 'on')} onClick={() => setModo('minima')}><span className="rad" /><span className="tx"><b>{t('Mínima')}</b><small>{tn(minimo.bloques.length, 'El primer ejercicio, a 2 series', 'Los {n} primeros, a 2 series')}</small></span><span className="end">~{minima} min</span></button>
      </div>
      <div className="ux-sales mt12">
        <p>
          <Ico n="clock" />
          {cambiarHora
            ? tr('Sales a las {hora}', { hora: <input className="mono ux-hora-in" type="time" autoFocus value={hora} onChange={e => { if (e.target.value) setHora(e.target.value) }} aria-label={t('Hora límite')} /> })
            : <>{tr('Sales a las {hora}', { hora: <b className="mono">{hora}</b> })}<span aria-hidden="true">·</span><button className="lnk" onClick={() => setCambiarHora(true)}>{t('cambiar')}</button></>}
        </p>
        <small>{disponibles ? t('Te quedan {n} min · te avisamos si vas tarde', { n: disponibles }) : t('Esa hora ya ha pasado: cámbiala si hoy es otra')}</small>
      </div>
      {noDa && <p className="note warn mt8"><Ico n="clock-countdown" /><span>{t('Con {n} min no te da para la normal: elige la corta.', { n: disponibles })}</span></p>}
      <div className="list mt12">
        <FilaInterruptor ico="timer" titulo={t('Calentamiento general')} d={t('Temporizador de 5 min · opcional')} on={calentar} onCambio={setCalentar} />
      </div>
      <button className="btn xl mt16" onClick={() => void empezar()}><Ico n="play" b />{t('Empezar')}</button>
    </Hoja>
  )
}
