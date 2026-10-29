// INI-01 · Inicio
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { comidasDe, gastoDelDia, hayEntrenoHecho, objetivosEnergia, pasosDelDia, sesionesEntre } from '../../datos/consultas'
import { totalesComida } from '../../dominio/comida'
import { basalHastaAhora } from '../../dominio/energia'
import { DIAS, DIAS_ABREV, DIAS_CORTOS, deISO, diaMes, diaSemana, formatoHora, hoyISO, numeroSemana, saludo, semanaDe, sumarDias } from '../../dominio/fechas'
import { estadoSemana, tarjetaCola, tarjetaHoy, type EstadoDia } from '../../dominio/semana'
import { capital, num } from '../../dominio/formato'
import { proponerModoMayor } from '../../dominio/modoMayor'
import { rutinaBloqueada } from '../../dominio/salud'
import { nombreEntreno } from '../../dominio/nombres'
import { Anillo, Barra, Cab, cx, Ico, Pantalla, Seccion, LARGO, recortar } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useCola, useGimnasio, usePerfil, useRutina, useSesionEnCurso } from '../../datos/hooks'
import { TarjetaHoy } from './TarjetaHoy'
import { CardioSemana, Pendientes, SemanaSuave, TuProgreso, VoyBien } from './Tarjetas'
import { PrimerosPasos, usePrimerosPasos } from './PrimerosPasos'
import { t, tc } from '../../i18n'
import { tr } from '../../i18n/jsx'

/** Icono de cada día en la tira de la semana; el día de hoy con entreno lleva una pesa. */
const ICONO_DIA: Record<EstadoDia['estado'], string> = {
  hecho: 'ph-bold ph-check okc', plan: 'ph-bold ph-circle', perdido: 'ph-bold ph-x badc', movido: 'ph-bold ph-arrow-right',
  opcional: 'ph ph-circle-dashed', descanso: 'ph-bold ph-minus',
}
const iconoDia = (e: EstadoDia) => (e.hoy && e.estado === 'plan' ? 'ph-bold ph-barbell' : ICONO_DIA[e.estado])

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
  const sesiones = useLiveQuery(() => sesionesEntre(sumarDias(dias[0]!, -7), dias[6]!), [hoy]) ?? []
  const comidas = useLiveQuery(() => comidasDe(hoy), [hoy]) ?? []
  const pasos = useLiveQuery(() => pasosDelDia(hoy), [hoy])
  const yaEntreno = useLiveQuery(hayEntrenoHecho, []) ?? false
  const energia = useLiveQuery(() => objetivosEnergia(perfil), [perfil])
  // Lo que gastas hoy: en reposo y por ejercicio (pasos + entreno). Se recalcula al cambiar pasos, entrenos o medidas.
  const gasto = useLiveQuery(() => gastoDelDia(perfil, hoy), [perfil, hoy])
  // undefined mientras carga: no se pinta la tarjeta por días para cambiarla al momento por la de la cola.
  const cola = useCola(hoy)
  // En cola los días de la semana solo recuerdan: un día sin entrenar no se pierde, la cola espera.
  const semana = estadoSemana(rutina, sesiones, hoy, ajustes.recolocadas).map(e => (cola !== null && (e.estado === 'perdido' || e.estado === 'movido') ? { ...e, estado: 'descanso' as const } : e))
  const proxSemana = estadoSemana(rutina, sesiones, sumarDias(dias[6]!, 1), ajustes.recolocadas).find(d => d.estado === 'plan')
  const tarjeta = cola ? tarjetaCola(cola, semana, hoy, !!enCurso) : tarjetaHoy(rutina, semana, hoy, !!enCurso, perfil.sesionPerdida === 'sabado', proxSemana)
  const tot = totalesComida(comidas)
  const d = deISO(hoy)
  // Antes del primer entreno también es la semana 1.
  const nSemana = ajustes.inicio ? Math.max(1, numeroSemana(ajustes.inicio, hoy)) : 1
  // Mientras se ve la guía «Primeros pasos» no salen «Pendientes de hoy» ni la tarjeta de pasos (dos listas casi iguales).
  const guia = usePrimerosPasos(tarjeta)
  const conGuia = guia !== null

  // Desde los 65, el modo mayor se propone una vez con la rutina ya hecha (también a quien ya la tenía); con
  // «Ahora no» no vuelve hasta dentro de un año. La hoja no se cierra sin elegir, para no salir en cada visita.
  const proponer = !!rutina && !enCurso && !rutinaBloqueada(perfil) && proponerModoMayor(perfil, hoy)
  // Solo depende de `proponer`: `nav` cambia al abrir la hoja y, con él, el efecto la volvería a abrir sin parar.
  const hayHoja = !!nav.estado.hoja
  useEffect(() => { if (proponer && !hayHoja) nav.hoja('hoja-modo-mayor', { rehacer: true }) }, [proponer])

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
        derecha={<button className="ib" aria-label={t('Ajustes')} onClick={() => nav.ir('ajustes')}><Ico n="gear" /></button>}
      >
        <div className="week mt12" role="list" data-tour="semana">
          {semana.map((e, i) => (
            <button key={e.fecha} role="listitem" className={cx('wd', e.hoy ? 'today' : e.estado === 'plan' ? 'plan' : e.estado === 'opcional' ? 'opt' : 'off')} onClick={() => aviso(describe(e))}>
              <span>{DIAS_CORTOS[i]}</span>
              <b>{deISO(e.fecha).getDate()}</b>
              <i className={iconoDia(e)} />
            </button>
          ))}
        </div>
        <p className="legend mt8">
          <span><Ico n="check" b className="okc" />{t('Hecho')}</span>
          <span><Ico n="circle" b className="blue" />{t('Plan')}</span>
          <span><Ico n="circle-dashed" />{t('Opcional')}</span>
          {!cola && <span><Ico n="x" b className="badc" />{t('Perdido')}</span>}
          {cola && <span><Ico n="minus" b />{t('Sin entreno')}</span>}
          {!cola && <span><Ico n="minus" b />{t('Descanso')}</span>}
        </p>
      </Cab>

      <div className="pg">
        <SemanaSuave rutina={rutina ?? null} />

        {cola !== undefined && <Seccion tour="hoy" titulo={cola ? t('Te toca') : t('Hoy te toca')} accion={cola ? t('Ver la cola') : tarjeta.tipo === 'hoy' ? t('Ver día') : undefined}
          onAccion={() => (cola ? nav.pestana('rut') : tarjeta.tipo === 'hoy' && nav.ir('detalle-dia', { letra: tarjeta.dia.letra }, 'rut'))}>
          <TarjetaHoy tar={tarjeta} cola={cola} rutina={rutina ?? null} enCurso={enCurso ?? null} gym={gym?.nombre == null ? undefined : recortar(gym.nombre, LARGO.nombre)} />
        </Seccion>}

        {/* El domingo, «¿Voy bien?» justo debajo de «Hoy te toca», donde se ve sin bajar. */}
        {diaSemana(d) === 6 && <VoyBien rutina={rutina ?? null} />}

        {/* Los accesos rápidos, a mano. Comida y picoteo van en un solo botón: no hay que decidir si un café es comida o picoteo. */}
        <div className="sec">
          <div className="qa-row ux-qa3" data-tour="atajos">
            <button className="qa" onClick={() => nav.hoja('hoja-anadir', { fecha: hoy })}><Ico n="fork-knife" /><span>{t('+ Comer o beber')}</span></button>
            <button className="qa" onClick={() => nav.ir('escaner', undefined, 'com')}><Ico n="barcode" /><span>{t('Escanear')}</span></button>
            <button className="qa" onClick={() => nav.hoja('hoja-peso')}><Ico n="scales" /><span>{t('+ Peso')}</span></button>
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
              <button className={cx('card kpi steps', !ajustes.mostrarKcal && 'span2')} onClick={() => nav.ir('pasos', undefined, 'pro')}>
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
            {!!perfil.cardioMin && <CardioSemana meta={perfil.cardioMin} />}
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
            <button className="note warn w100" style={{ textAlign: 'left' }} onClick={() => nav.ir('ajustes', { seccion: 'datos' })}>
              <Ico n="download-simple" />
              <span>{tr('<b>Haz una copia de seguridad.</b> Tus datos solo están en este móvil.', { b: s => <b>{s}</b> })}</span>
            </button>
          </div>
        ) : null}
      </div>
    </Pantalla>
  )
}
