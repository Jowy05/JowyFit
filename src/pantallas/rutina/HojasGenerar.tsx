// Hojas del generador: «¿Qué no quieres hacer?» y el modo mayor (la propuesta al generar y quitarlo desde Ajustes).
import { useState } from 'react'
import { guardarPerfil } from '../../datos/repos'
import { regenerarRutina } from '../../datos/acciones/rutina'
import type { GrupoNoQuiero } from '../../datos/tipos'
import { GRUPOS_NO_QUIERO } from '../../catalogo/grupos'
import { hoyISO } from '../../dominio/fechas'
import { porQueModoMayor } from '../../dominio/modoMayor'
import { cx, Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfilCargado, useRutina } from '../../datos/hooks'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

export function HojaNoQuiero() {
  const nav = useNav()
  const aviso = useAviso()
  const p = usePerfilCargado()
  const [fuera, setFuera] = useState<GrupoNoQuiero[] | null>(null)
  const marcados = fuera ?? p?.noQuiero ?? []
  const alternar = (g: GrupoNoQuiero) => setFuera(marcados.includes(g) ? marcados.filter(x => x !== g) : [...marcados, g])
  // Sin ninguno de los grupos de fuerza no queda nada que proponer.
  const sinFuerza = (['corporal', 'maquinas', 'libre', 'poleas'] as const).every(g => marcados.includes(g))
  const guardar = async () => {
    await guardarPerfil({ noQuiero: marcados })
    nav.hoja(null)
    aviso(marcados.length ? t('Hecho: no saldrá en tu rutina') : t('Hecho: puede salir de todo'))
  }
  return (
    <Hoja titulo={t('¿Qué no quieres hacer?')} sub={t('Toca lo que prefieras no hacer. No saldrá en tu rutina ni en «Si está ocupado».')} className="tall">
      <div className="g2-grid">
        {GRUPOS_NO_QUIERO.map(g => {
          const on = marcados.includes(g.v)
          return (
            <button key={g.v} className={cx('mq g2-x', on && 'on')} aria-pressed={on} onClick={() => alternar(g.v)}>
              <span className="th"><span className="g2-ic tinted"><Ico n={g.ico} /></span></span>
              <span className="g2-out"><Ico n="prohibit" b />{t('Fuera')}</span>
              <b>{t(g.t)}</b>
            </button>
          )
        })}
      </div>
      {sinFuerza && <p className="note bad mt12"><Ico n="warning-circle" /><span>{tr('<b>Así no queda ningún ejercicio de fuerza.</b> Deja al menos un grupo.', { b: x => <b>{x}</b> })}</span></p>}
      <p className="small muted mt12">{t('Se guarda en tu perfil y lo cambias cuando quieras en Ajustes.')}</p>
      <button className="btn mt16" disabled={sinFuerza} onClick={() => void guardar()}>{marcados.length ? t('Guardar') : t('Nada, seguir')}</button>
    </Hoja>
  )
}

/**
 * Modo mayor: la propuesta («Sí, probarlo» / «Ahora no») o, con `quitar`, quitarlo desde Ajustes. Con `rehacer` (la
 * propuesta desde Inicio) aceptarlo rehace la rutina; al generar no, que la rutina nueva se hace después.
 */
export function HojaModoMayor({ ruta }: { ruta: Ruta<'hoja-modo-mayor'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const p = usePerfilCargado()
  const unaVez = useUnaVez()
  const quitar = !!ruta.d?.quitar
  const rehacer = !!ruta.d?.rehacer
  const hayRutina = !!useRutina()
  if (!p) return null
  const decidir = unaVez(async (activo: boolean) => {
    const hoy = hoyISO()
    // Quitarlo también cuenta como «no»: si no, Inicio lo volvería a proponer al momento.
    await guardarPerfil({ modoMayor: activo ? { activo: true, propuesto: hoy } : { activo: false, propuesto: p.modoMayor?.propuesto ?? hoy, rechazado: hoy } })
    // Al quitarlo (o aceptarlo con la rutina ya hecha) la rutina se rehace con los pesos e historial intactos.
    if (hayRutina && (quitar || (activo && rehacer))) await regenerarRutina()
    nav.hoja(null)
    aviso(quitar ? t('Modo mayor quitado: rutina rehecha') : activo && rehacer && hayRutina ? t('Modo mayor activado: rutina rehecha') : activo ? t('Modo mayor activado') : t('Vale. Lo tienes en Ajustes si cambias de idea'))
  })
  if (quitar) return (
    <Hoja titulo={t('¿Quitar el modo mayor?')}>
      <div className="why">
        <p><Ico n="arrows-clockwise" /><span>{t('Tu rutina se rehace normal.')}</span></p>
        <p><Ico n="barbell" /><span>{t('Vuelven las barras y los ejercicios de pie.')}</span></p>
        <p><Ico n="person-simple" /><span>{t('El equilibrio pasa a ser opcional.')}</span></p>
        <p><Ico n="shield-check" /><span>{t('Tus pesos y tu historial se conservan.')}</span></p>
      </div>
      <div className="btns mt16">
        <button className="btn gry sm" onClick={() => nav.hoja(null)}>{t('Dejarlo')}</button>
        <button className="btn sm" onClick={() => void decidir(false)}>{t('Quitar y rehacer')}</button>
      </div>
    </Hoja>
  )
  return (
    <Hoja titulo={t('¿Probamos el modo mayor?')} sub={porQueModoMayor(p)} cerrar={false}>
      <div className="why">
        <p><Ico n="armchair" /><span>{tr('Máquinas, silla o algo donde apoyarte: <b>más seguro</b>.', { b: x => <b>{x}</b> })}</span></p>
        <p><Ico n="hand-palm" /><span>{tr('Nunca hasta no poder más: siempre te <b>sobran 2 repeticiones</b>.', { b: x => <b>{x}</b> })}</span></p>
        <p><Ico n="person-simple" /><span>{t('Equilibrio: 5-10 minutos, 3 días a la semana (también en casa).')}</span></p>
        <p><Ico n="timer" /><span>{t('Descansos más largos, hasta estar sin mareo.')}</span></p>
      </div>
      <p className="small muted mt8">{t('Lo quitas cuando quieras en Ajustes.')}</p>
      <div className="btns mt16">
        <button className="btn gry sm" onClick={() => void decidir(false)}>{t('Ahora no')}</button>
        <button className="btn sm" onClick={() => void decidir(true)}>{t('Sí, probarlo')}</button>
      </div>
    </Hoja>
  )
}
