// INI-01 · Resumen de un día de la semana (al tocarlo en Inicio): lo que se entrenó o lo que toca, la comida y los pasos.
import { useLiveQuery } from 'dexie-react-hooks'
import { comidasDe, objetivosEnergia, pasosDelDia, sesionesEntre } from '../../datos/consultas'
import { useAjustes, useCola, usePerfil, useRutina } from '../../datos/hooks'
import { fechaLarga, formatoHora, hoyISO, semanaDe } from '../../dominio/fechas'
import { capital, num } from '../../dominio/formato'
import { estadoSemana, semanaEnCola, type EstadoDia } from '../../dominio/semana'
import { resumenDia, type ResumenDia } from '../../dominio/resumenDia'
import { Barra, Hoja, Ico } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { t, tn } from '../../i18n'

export function HojaDia({ ruta }: { ruta: Ruta<'hoja-dia'> }) {
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const rutina = useRutina()
  const hoy = hoyISO()
  const cola = useCola(hoy)
  const { fecha } = ruta.d
  const datos = useLiveQuery(async () => {
    // Las sesiones de toda la semana: el estado del día se calcula igual que en la tira de Inicio.
    const dias = semanaDe(hoy)
    const [sesiones, comidas, pasos, energia] = await Promise.all([sesionesEntre(dias[0]!, dias[6]!), comidasDe(fecha), pasosDelDia(fecha), objetivosEnergia(perfil)])
    return { sesiones, comidas, pasos, energia }
  }, [fecha, hoy, perfil])
  const titulo = capital(fechaLarga(fecha))
  if (!datos || rutina === undefined || cola === undefined) return <Hoja titulo={titulo}><div className="cargando">…</div></Hoja>

  const semana = estadoSemana(rutina, datos.sesiones, hoy, ajustes.recolocadas)
  // Si la hoja sigue abierta al cambiar de semana (pasada la medianoche del domingo), el día ya no está: descanso.
  const dia: EstadoDia = (cola ? semanaEnCola(semana) : semana).find(e => e.fecha === fecha) ?? { fecha, estado: 'descanso', hoy: fecha === hoy }
  const r = resumenDia({ dia, hoy, sesiones: datos.sesiones, comidas: datos.comidas, pasos: datos.pasos })

  return (
    <Hoja titulo={titulo} sub={r.cuando === 'hoy' ? t('Hoy') : undefined}>
      <p className="lbl fl">{t('Entreno')}</p>
      <Entreno r={r} hora={perfil.horaEntreno} enCola={!!cola} />

      {r.comida && r.pasos ? (
        <>
          <p className="lbl fl mt16">{t('Comida y pasos')}</p>
          <div className="spec flat">
            <p><span>{t('Proteína')}</span><b>{num(r.comida.proteina, 0)} / {num(datos.energia.proteina, 0)} g</b></p>
            {ajustes.mostrarKcal && <p><span>{t('Calorías')}</span><b>{num(r.comida.kcal, 0)} kcal</b></p>}
            <p><span>{t('Pasos')}</span><b>{t('{n} de {objetivo}', { n: num(r.pasos.pasos, 0), objetivo: num(perfil.pasosObjetivo, 0) })}</b></p>
          </div>
          <div className="mt8"><Barra v={r.pasos.pasos} total={perfil.pasosObjetivo} tono="go" /></div>
          {r.comida.apuntadas === 0 && <p className="small muted mt8">{r.cuando === 'hoy' ? t('Hoy aún no has apuntado comida.') : t('Ese día no apuntaste comida.')}</p>}
        </>
      ) : (
        <p className="note plain mt16"><Ico n="calendar-blank" /><span>{t('La comida y los pasos de este día se verán cuando llegue.')}</span></p>
      )}
    </Hoja>
  )
}

/** Lo entrenado (con un toque para verlo entero) o lo que tocaba o toca ese día. */
function Entreno({ r, hora, enCola }: { r: ResumenDia; hora: string; enCola: boolean }) {
  const nav = useNav()
  if (r.hechos.length) {
    return (
      <div className="list">
        {r.hechos.map((h, i) => (
          <button key={h.id ?? i} className="it" disabled={h.id == null} onClick={() => h.id != null && nav.ir('detalle-entreno', { id: h.id }, 'pro')}>
            <span className="ico"><Ico n="check" b className="okc" /></span>
            <span className="tx">
              <b>{h.nombre}</b>
              <small>{[tn(h.ejercicios, '{n} ejercicio', '{n} ejercicios'), tn(h.series, '{n} serie', '{n} series'), `${h.minutos} min`].join(' · ')}</small>
              {h.records > 0 && <small className="dia-rec"><Ico n="trophy" b /> {tn(h.records, '{n} récord', '{n} récords')}</small>}
            </span>
            {h.id != null && <Ico n="caret-right" className="car" />}
          </button>
        ))}
      </div>
    )
  }
  if (r.plan) {
    const perdido = r.estado === 'perdido'
    const detalle = [tn(r.plan.ejercicios, '{n} ejercicio', '{n} ejercicios'), `~${r.plan.minutos} min`]
    if (!perdido && r.cuando !== 'pasado' && !enCola) detalle.unshift(t('A las {hora}', { hora: formatoHora(hora) }))
    return (
      <div className="list">
        <button className="it" onClick={() => nav.ir('detalle-dia', { letra: r.plan!.letra }, 'rut')}>
          <span className="ico"><Ico n={perdido ? 'x' : r.estado === 'opcional' ? 'circle-dashed' : 'barbell'} b className={perdido ? 'badc' : undefined} /></span>
          <span className="tx">
            <b>{perdido ? t('No entrenaste: {nombre}', { nombre: r.plan.nombre }) : r.estado === 'opcional' ? t('Opcional: {nombre}', { nombre: r.plan.nombre }) : r.plan.nombre}</b>
            <small>{detalle.join(' · ')}</small>
          </span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
    )
  }
  const texto = r.estado === 'movido' ? t('Este entreno lo pasaste a otro día.') : enCola ? t('Sin entreno este día.') : t('Día de descanso.')
  return <p className="note plain"><Ico n="minus" b /><span>{texto}</span></p>
}
