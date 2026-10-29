// «Tu objetivo» (uno principal y hasta 2 más) y «Afinar» (hasta 3 zonas, con «Un poco más» o «Mucho más», y qué hará
// tu rutina). Se usan en el alta y en Perfil → Objetivos.
import type { Perfil, TipoObjetivo } from '../../datos/tipos'
import { imagenMusculo } from '../../catalogo/catalogo'
import { mezclaObjetivos, OBJETIVOS, queHaraRutina, ZONAS_AFINAR } from '../../dominio/objetivos'
import { Chip, cx, Ico } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { t } from '../../i18n'

type Props = { p: Pick<Perfil, 'objetivo' | 'objetivosExtra' | 'zonasPrioridad' | 'zonasMucho'>; cambia: (c: Partial<Perfil>) => void }

const MAX_EXTRA = 2
const MAX_ZONAS = 3
// El dibujo de RepDB que representa cada zona.
const MUSCULO_ZONA: Record<string, string> = {
  pecho: 'pectoralis_major', espalda: 'latissimus_dorsi', hombros: 'lateral_deltoid', brazos: 'biceps_brachii',
  abdomen: 'rectus_abdominis', gluteo: 'gluteus_maximus', piernas: 'quadriceps', gemelos: 'gastrocnemius',
}

export function ElegirObjetivo({ p, cambia }: Props) {
  const aviso = useAviso()
  const extra = (p.objetivosExtra ?? []).filter(o => o !== p.objetivo)
  const principal = (v: TipoObjetivo) => cambia({ objetivo: v, objetivosExtra: extra.filter(o => o !== v) })
  const alternarExtra = (v: TipoObjetivo) => {
    if (extra.includes(v)) { cambia({ objetivosExtra: extra.filter(o => o !== v) }); return }
    if (extra.length >= MAX_EXTRA) { aviso(t('Como mucho 2 más: quita uno antes')); return }
    cambia({ objetivosExtra: [...extra, v] })
  }
  return (
    <>
      <div className="opts mt16" role="radiogroup" aria-label={t('¿Qué quieres conseguir?')}>
        {OBJETIVOS.map(o => (
          <button key={o.v} role="radio" aria-checked={p.objetivo === o.v} className={cx('opt-c', p.objetivo === o.v && 'on')} onClick={() => principal(o.v)}>
            <span className="rad" />
            <span className="tx"><b>{t(o.t)} {o.v === 'salud' && <span className="tag ok">{t('Si dudas, este')}</span>}</b><small>{t(o.d)}</small></span>
          </button>
        ))}
      </div>
      <p className="lbl fl mt16">{t('¿Algo más?')} <span className="hint">{t('(opcional, hasta 2)')}</span></p>
      <div className="chips mt8">
        {OBJETIVOS.filter(o => o.v !== p.objetivo).map(o => <Chip key={o.v} ck on={extra.includes(o.v)} onClick={() => alternarExtra(o.v)}>{t(o.t)}</Chip>)}
      </div>
      <p className="small muted mt8">{mezclaObjetivos(p.objetivo, extra)}</p>
    </>
  )
}

export function Afinar({ p, cambia }: Props) {
  const aviso = useAviso()
  const zonas = p.zonasPrioridad.filter(z => ZONAS_AFINAR.some(o => o.v === z))
  const mucho = (p.zonasMucho ?? []).filter(z => zonas.includes(z))
  const alternar = (z: string) => {
    if (zonas.includes(z)) { cambia({ zonasPrioridad: zonas.filter(x => x !== z), zonasMucho: mucho.filter(x => x !== z) }); return }
    if (zonas.length >= MAX_ZONAS) { aviso(t('Como mucho 3 zonas: quita una antes')); return }
    cambia({ zonasPrioridad: [...zonas, z] })
  }
  const cuanto = (z: string, v: 'poco' | 'mucho') => cambia({ zonasMucho: v === 'mucho' ? [...new Set([...mucho, z])] : mucho.filter(x => x !== z) })
  return (
    <>
      <p className="small muted">{t('Si no tocas nada, se trabaja todo el cuerpo por igual.')}</p>
      <p className="lbl fl mt16">{t('¿Qué quieres mejorar más?')} <span className="hint">{t('(hasta 3)')}</span></p>
      <div className="g2-grid mt8">
        {ZONAS_AFINAR.map(z => {
          const on = zonas.includes(z.v)
          const img = imagenMusculo(MUSCULO_ZONA[z.v]!)
          return (
            <button key={z.v} className={cx('mq', on && 'on')} aria-pressed={on} onClick={() => alternar(z.v)}>
              <span className="th">{img ? <img src={img} alt="" loading="lazy" /> : <Ico n="person-simple" />}</span>
              <span className="ck"><Ico n="check" b /></span>
              <b>{t(z.t)}</b>
            </button>
          )
        })}
        <button className={cx('mq', !zonas.length && 'on')} aria-pressed={!zonas.length} onClick={() => cambia({ zonasPrioridad: [], zonasMucho: [] })}>
          <span className="th"><span className="g2-ic tinted"><Ico n="person-arms-spread" /></span></span>
          <span className="ck"><Ico n="check" b /></span>
          <b>{t('Todo por igual')}</b>
        </button>
      </div>
      {zonas.length > 0 && (
        <div className="card pd mt12">
          <span className="lbl">{t('Cuánto más')}</span>
          {zonas.map(z => (
            <div key={z} className="g2-zr">
              <b>{t(ZONAS_AFINAR.find(o => o.v === z)!.t)}</b>
              <div className="segc" role="radiogroup" aria-label={t('Cuánto más')}>
                <button role="radio" aria-checked={!mucho.includes(z)} className={cx(!mucho.includes(z) && 'on')} onClick={() => cuanto(z, 'poco')}>{t('Un poco más')}</button>
                <button role="radio" aria-checked={mucho.includes(z)} className={cx(mucho.includes(z) && 'on')} onClick={() => cuanto(z, 'mucho')}>{t('Mucho más')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="sec">
        <div className="sec-h"><h2>{t('Qué hará tu rutina')}</h2></div>
        <div className="why">{queHaraRutina({ ...p, zonasPrioridad: zonas, zonasMucho: mucho }).map((x, i) => <p key={i}><Ico n="check-circle" /><span>{x}</span></p>)}</div>
      </div>
    </>
  )
}
