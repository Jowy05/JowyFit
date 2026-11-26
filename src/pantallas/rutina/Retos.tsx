// RUT-08 · Retos: retos diarios con detección de postura por cámara (flexiones, sentadillas, plancha)
// y superación de tu propia marca día a día.
import { borrarIntentoReto } from '../../datos/acciones/retos'
import { useRetos } from '../../datos/hooks'
import { fechaCorta, hoyISO } from '../../dominio/fechas'
import { mejorMarcaReto, rachaRetos, RETOS, retoDe, textoMarcaReto, textoRetoHoy } from '../../dominio/retos'
import { cx, Ico, Pantalla, Seccion } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { CabRutina } from './CabRutina'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

export function Retos() {
  const nav = useNav()
  const aviso = useAviso()
  const intentos = useRetos()
  const hoy = hoyISO()
  const racha = rachaRetos(intentos, hoy)
  const destacados = RETOS.filter(r => r.modo === 'mas-reps')
  const otros = RETOS.filter(r => r.modo !== 'mas-reps')

  const borrar = async (id: number) => {
    await borrarIntentoReto(id)
    aviso(t('Intento borrado'))
  }

  return (
    <Pantalla>
      <CabRutina actual="retos" crumb={t('Supera tu mejor marca')} />
      <div className="pg">
        <div className="sec">
          <div className="card pd ret-racha">
            <span className={cx('ico big', racha.actual > 0 && 'goldb')}><Ico n="flame" b /></span>
            <div className="grow">
              <span className="lbl">{t('Racha de retos')}</span>
              <p className="ret-racha-v">
                <b>{tn(racha.actual, '{n} día', '{n} días')}</b>
                {racha.mejor > 0 && <small className="muted"> · {t('mejor: {n}', { n: racha.mejor })}</small>}
              </p>
              <p className="small muted">{racha.hechoHoy ? t('Reto de hoy completado') : t('Completa un reto hoy para sumar un día')}</p>
            </div>
          </div>

          <p className="note plain mt12">
            <Ico n="lock-simple" />
            <span>{tr('<b>Cámara 100 % local:</b> detecta tu postura en el móvil para contar solo las repeticiones bien hechas. Ninguna imagen se guarda ni sale de aquí.', { b: x => <b>{x}</b> })}</span>
          </p>
        </div>

        <Seccion titulo={t('Máximo en 60 segundos')}>
          <div className="ret-grid">
            {destacados.map(r => {
              const mejor = mejorMarcaReto(intentos, r.id)
              return (
                <div key={r.id} className={cx('card pd ret-card', mejor && 'con-rec')}>
                  <div className="row jb">
                    <span className="ico ret-ico"><Ico n={r.icono} b /></span>
                    {mejor ? (
                      <span className="tag gold"><Ico n="trophy" b />{textoMarcaReto(mejor.valor, r.modo)}</span>
                    ) : (
                      <span className="tag blue">{t('60 s')}</span>
                    )}
                  </div>
                  <h3 className="ret-t mt8">{t(r.titulo)}</h3>
                  <p className="small muted mt4">{t(r.descripcion)}</p>
                  <p className="ret-obj mt8"><Ico n="target" b />{textoRetoHoy(mejor, r)}</p>
                  <button className="btn sm mt12" onClick={() => nav.ir('reto-activo', { reto: r.id })}>
                    <Ico n="play" b />{mejor ? t('Superar marca') : t('Empezar reto')}
                  </button>
                </div>
              )
            })}
          </div>
        </Seccion>

        <Seccion titulo={t('Más retos')}>
          <div className="list">
            {otros.map(r => {
              const mejor = mejorMarcaReto(intentos, r.id)
              return (
                <button key={r.id} className="it" onClick={() => nav.ir('reto-activo', { reto: r.id })}>
                  <span className="ico"><Ico n={r.icono} b /></span>
                  <span className="tx">
                    <b>{t(r.titulo)}</b>
                    <small>{textoRetoHoy(mejor, r)}</small>
                  </span>
                  <span className="end">
                    {mejor ? textoMarcaReto(mejor.valor, r.modo) : t('Nuevo')}
                  </span>
                  <Ico n="caret-right" className="car" />
                </button>
              )
            })}
          </div>
        </Seccion>

        {intentos.length > 0 && (
          <Seccion titulo={t('Últimos intentos')}>
            <div className="list">
              {intentos.slice(0, 10).map(x => {
                const def = retoDe(x.reto)
                return (
                  <div key={x.id} className="it">
                    <span className={cx('ico', x.record && 'goldb')}><Ico n={x.record ? 'trophy' : def.icono} b /></span>
                    <span className="tx">
                      <b>{t(def.corto)} {x.record && <span className="tag gold">{t('Récord')}</span>}</b>
                      <small>
                        {fechaCorta(x.fecha)} · {x.modo === 'camara' ? t('Cámara') : t('Manual')}
                        {x.invalidas ? ` · ${tn(x.invalidas, '{n} sin contar', '{n} sin contar')}` : ''}
                      </small>
                    </span>
                    <span className="end">{textoMarcaReto(x.valor, def.modo)}</span>
                    <button className="ib sm" aria-label={t('Borrar intento')} onClick={() => void borrar(x.id)}><Ico n="trash" /></button>
                  </div>
                )
              })}
            </div>
          </Seccion>
        )}
      </div>
    </Pantalla>
  )
}
