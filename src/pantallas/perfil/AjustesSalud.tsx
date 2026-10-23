// AJU-01 · Health Connect en Ajustes: «Reloj y báscula» (arriba) y «Pasos y báscula» (en «Más ajustes»). Solo Android;
// en otro navegador se dice que está en la app de Android y en los de Apple no se nombra.
import { useEffect, useState } from 'react'
import { guardarAjustes } from '../../datos/repos'
import type { Ajustes } from '../../datos/tipos'
import { abrirHealthConnect, capacidades, pasosDisponibles, pedirPermisoPasos } from '../../plataforma'
import { Elegir, Ico } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, usePerfil } from '../../datos/hooks'
import { activarBascula, comprobarSalud, conectarSalud, sincronizarPasos } from '../../app/servicios'
import { miles } from '../../dominio/formato'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

export type Salud = { hayPasos: boolean; activarPasos: () => Promise<void> }

/** Si Health Connect está listo en este móvil y cómo se activan los pasos (lo usan varias filas de Ajustes). */
export function useSalud(): Salud {
  const aviso = useAviso()
  const [hayPasos, setHayPasos] = useState(false)
  useEffect(() => { void pasosDisponibles().then(setHayPasos) }, [])
  const activarPasos = async () => {
    const ok = await pedirPermisoPasos()
    if (!ok) { aviso(t('Sin permiso de Health Connect: los pasos se apuntan a mano')); return }
    await guardarAjustes({ fuentePasos: 'auto' })
    const sincronizado = await sincronizarPasos()
    aviso(sincronizado ? t('Pasos conectados con Health Connect') : t('Health Connect activado'))
  }
  return { hayPasos, activarPasos }
}

/** «Reloj y báscula»: conectar Health Connect, comprobar qué llega y abrir sus permisos. */
export function RelojYBascula({ salud }: { salud: Salud }) {
  const aviso = useAviso()
  const a = useAjustes()
  const cap = capacidades()
  // Resultado de «Comprobar qué llega» (para probar en el móvil).
  const [llega, setLlega] = useState<string[] | null>(null)
  if (cap.apple) return null
  const conectado = a.fuentePasos === 'auto' || a.fuenteBascula === 'auto'
  const conectadoTodo = a.fuentePasos === 'auto' && a.fuenteBascula === 'auto'
  return (
    <>
      <p className="grp-t">{t('Reloj y báscula')}</p>
      {!cap.salud ? (
        <p className="note plain"><Ico n="watch" /><span>{tr('<b>Solo en la app de Android:</b> los pasos y el peso se apuntan a mano.', { b: x => <b>{x}</b> })}</span></p>
      ) : salud.hayPasos ? (
        <div className="list" data-tour="reloj">
          <div className="it col">
            <span className="row"><span className="ico"><Ico n="heartbeat" /></span><span className="tx"><b>Health Connect</b><small>{conectado
              ? t('Conectado: {que}. Se actualiza solo al abrir la app.', { que: conectadoTodo ? t('pasos, peso y grasa') : a.fuentePasos === 'auto' ? t('pasos') : t('peso y grasa') })
              : t('Trae solos los pasos de tu reloj y el peso y la grasa de tu báscula (Garmin, Samsung, Xiaomi, Fitdays…).')}</small></span></span>
            {!conectadoTodo && <button className="btn sm w100" onClick={() => void conectarSalud().then(texto => aviso(texto))}><Ico n="link" b />{conectado ? t('Conectar también lo que falta') : t('Conectar Health Connect')}</button>}
            <button className="btn ln sm w100" onClick={() => { setLlega([t('Comprobando…')]); void comprobarSalud().then(setLlega) }}><Ico n="heartbeat" />{t('Comprobar qué llega')}</button>
            {llega && <p className="small muted">{llega.join(' · ')}</p>}
            <button className="lnk" onClick={() => void abrirHealthConnect()}>{t('Abrir Health Connect (permisos)')} <Ico n="caret-right" /></button>
          </div>
        </div>
      ) : (
        <div className="list" data-tour="reloj">
          <div className="it col">
            <span className="row"><span className="ico"><Ico n="heartbeat" /></span><span className="tx"><b>{t('Health Connect no está listo en este móvil')}</b><small>{t('En Android 14 o más viene con el móvil: Ajustes → Seguridad y privacidad → Privacidad → Health Connect. En Android 13 o menos, se instala desde Google Play.')}</small></span></span>
            <button className="btn ln sm w100" onClick={() => void abrirHealthConnect().then(ok => { if (!ok) aviso(t('No se ha podido abrir: búscalo en los ajustes del móvil o en Google Play')) })}>{t('Abrir Health Connect')}</button>
          </div>
        </div>
      )}
    </>
  )
}

/** «Pasos y báscula» de «Más ajustes»: de dónde salen los pasos y el peso, y el objetivo de pasos. */
export function PasosYBascula({ salud }: { salud: Salud }) {
  const nav = useNav()
  const aviso = useAviso()
  const a = useAjustes()
  const p = usePerfil()
  const guardar = (c: Partial<Ajustes>) => { void guardarAjustes(c) }
  const cambiarFuente = (f: 'auto' | 'manual') => {
    if (f === 'auto') void salud.activarPasos()
    else guardar({ fuentePasos: 'manual' })
  }
  const cambiarBascula = (f: 'auto' | 'manual') => {
    if (f === 'auto') void activarBascula().then(texto => aviso(texto))
    else guardar({ fuenteBascula: 'manual' })
  }
  return (
    <>
      <p className="grp-t">{t('Pasos y báscula')}</p>
      <div className="list">
        {salud.hayPasos ? (
          <div className="it col">
            <span className="tx"><b>{t('De dónde salen los pasos')}</b><small>{a.fuentePasos === 'auto' ? t('Se leen solos de Health Connect') : t('Los apuntas tú en Progreso → Pasos')}</small></span>
            <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: t('A mano') }]} valor={a.fuentePasos} onCambio={cambiarFuente} />
          </div>
        ) : (
          <div className="it">
            <span className="ico"><Ico n="footprints" /></span>
            <span className="tx"><b>{t('De dónde salen los pasos')}</b><small>{capacidades().apple ? t('Los apuntas tú en Progreso → Pasos (míralos en la app Salud).') : t('En este móvil no hay Health Connect: los pasos se apuntan a mano en Progreso → Pasos.')}</small></span>
            <span className="end small">{t('A mano')}</span>
          </div>
        )}
        {salud.hayPasos && (
          <div className="it col">
            <span className="tx"><b>{t('Peso y grasa de la báscula')}</b><small>{a.fuenteBascula === 'auto' ? t('Se traen solos de Health Connect (la app de tu báscula los escribe allí)') : t('Los apuntas tú con «+ Peso» o en Progreso → Cuerpo')}</small></span>
            <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: t('A mano') }]} valor={a.fuenteBascula ?? 'manual'} onCambio={cambiarBascula} />
          </div>
        )}
        <button className="it" onClick={() => nav.ir('pro-pasos', undefined, 'pro')}>
          <span className="tx"><b>{t('Objetivo de pasos')}</b><small>{t('Se cambia en la pantalla Pasos')}</small></span>
          <span className="end small">{miles(p.pasosObjetivo)}</span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
    </>
  )
}
