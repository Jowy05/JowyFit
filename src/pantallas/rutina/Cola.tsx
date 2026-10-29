// Mi plan en cola (§9b): «En orden · Días fijos» y, en orden, la cola (Siguiente, Después, Luego).
// Los días de la semana solo sirven para los recordatorios.
import { guardarPerfilYAvisos } from '../../datos/acciones/avisos'
import type { Perfil, Rutina } from '../../datos/tipos'
import type { Cola } from '../../dominio/cola'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { formatoHora } from '../../dominio/fechas'
import { capital } from '../../dominio/formato'
import { nombreEntreno } from '../../dominio/nombres'
import { minutosDia } from '../../dominio/rutina'
import { cx, Ico } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfilCargado } from '../../datos/hooks'
import { listaDias } from './comun'
import { t, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

const MODOS = [{ v: 'cola', t: tk('En orden') }, { v: 'dias', t: tk('Días fijos') }] as const
const PUESTO = [tk('Siguiente'), tk('Después'), tk('Luego')]

export function ModoRutina() {
  const aviso = useAviso()
  const p = usePerfilCargado()
  const modo = p?.modoRutina ?? 'dias'
  const cambiar = async (v: 'cola' | 'dias') => {
    if (v === modo) return
    await guardarPerfilYAvisos({ modoRutina: v })
    aviso(v === 'cola' ? t('En orden: toca la siguiente') : t('Días fijos: cada entreno, su día'))
  }
  // Hasta tener el perfil no se marca ninguna: con el de por defecto saldría «Días fijos» a quien va en orden.
  if (!p) return null
  return (
    <div className="card pd mt12">
      <span className="lbl fl">{t('Cómo va tu rutina')}</span>
      <div className="segc" role="radiogroup" aria-label={t('Cómo va tu rutina')}>
        {MODOS.map(m => <button key={m.v} role="radio" aria-checked={modo === m.v} className={cx(modo === m.v && 'on')} onClick={() => void cambiar(m.v)}>{t(m.t)}</button>)}
      </div>
      <p className="small muted mt8">{modo === 'cola' ? t('Haces la siguiente el día que puedas. Si un día no entrenas, no se descoloca nada.') : t('Cada entreno tiene su día. Si fallas uno, te proponemos pasarlo a otro.')}</p>
    </div>
  )
}

export function ListaCola({ cola, r, p }: { cola: Cola; r: Rutina; p: Perfil }) {
  const nav = useNav()
  const dias = [cola.siguiente, ...cola.despues]
  const conDia = r.dias.filter(d => !d.opcional && d.dia != null).map(d => d.dia!)
  return (
    <>
      <div className="sec g2-cola">
        <div className="sec-h"><h2>{t('La cola')}</h2><span className="lbl">{t('{n} de {total} hechas esta semana', { n: Math.min(cola.hechasSemana, cola.porSemana), total: cola.porSemana })}</span></div>
        <div className="edl">
          {dias.map((d, i) => (
            <button key={d.letra} className={cx('card dayc', i === 0 && 'hot', i > 0 && 'mt8')} onClick={() => nav.ir('detalle-dia', { letra: d.letra })}>
              <span className="dayc-h">
                <span className="dl">{d.letra}</span>
                <span className="tx"><b>{nombreEntreno(d)}</b><small>{t('{ejercicios} · ~{min} min', { ejercicios: d.bloques.slice(0, 4).map(b => nombreEjercicio(b.ejercicio)).join(', '), min: minutosDia(d) })}</small></span>
                <span className={cx('tag', i === 0 && 'go')}>{t(PUESTO[i] ?? PUESTO[2]!)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="spec-box"><div className="spec">
          <p><span>{t('A la semana')}</span><b>{tn(cola.porSemana, '{n} entreno', '{n} entrenos')}</b></p>
          {conDia.length > 0 && <p><span>{t('Te lo recordamos')}</span><b className="ux-rut-wrap">{capital(listaDias(conDia))} · {formatoHora(p.horaEntreno)}</b></p>}
          <p><span>{t('Tras 7 días sin entrenar')}</span><b>{t('Lo más atrasado')}</b></p>
        </div></div>
        <p className="note ok mt12"><Ico n="check-circle" /><span>{tr('¿Un día malo? Haz la <b>sesión mínima</b>: 15 minutos con lo más importante de la que toca.', { b: x => <b>{x}</b> })}</span></p>
      </div>
    </>
  )
}
