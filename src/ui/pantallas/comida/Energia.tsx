// COM-08 · Tu objetivo de energía: arriba solo los dos números y el porqué; la fórmula, plegada.
// El consejo de la quincena ya no se repite aquí: está en la tarjeta «Cómo vas» del Día.
import { useLiveQuery } from 'dexie-react-hooks'
import { objetivosEnergia } from '../../../datos/consultas'
import { guardarAjustes } from '../../../datos/repos'
import { FACTOR_ACTIVIDAD, num } from '../../../dominio/calculos'
import { Cab, Ico, Pantalla } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, usePerfil } from '../../datos'
import { t, tk } from '../../../i18n'

// Marcados con tk(): se traducen al pintarlos.
const TRABAJO = { sentado: tk('trabajo sentado'), depie: tk('de pie'), fisico: tk('trabajo físico') } as const
const POR_QUE = {
  recomposicion: tk('así pierdes grasa poco a poco sin perder fuerza.'),
  perder: tk('así bajas grasa a buen ritmo.'),
  fuerza: tk('comes lo que gastas para ganar fuerza sin coger grasa.'),
} as const

export function Energia() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const e = useLiveQuery(() => objetivosEnergia(perfil), [perfil, ajustes.kcalManual, ajustes.proteinaManual])
  if (!e) return <Pantalla><div className="cargando">{t('Cargando…')}</div></Pantalla>
  const factor = FACTOR_ACTIVIDAD[perfil.trabajo]
  const entreno = Math.max(0, Math.round(e.gasto - e.basal * factor))
  const manual = ajustes.kcalManual != null || ajustes.proteinaManual != null
  const gkg = e.peso ? e.proteina / e.peso : null

  return (
    <Pantalla>
      <Cab atras crumb={t('Comida')} titulo={t('Tu objetivo de energía')} sub={t('Lo que te toca comer cada día.')} />
      <div className="pg">
        <div className="card pd ux-com-obj">
          <span className="lbl">{manual ? t('Tu objetivo (puesto a mano)') : t('Tu objetivo')}</span>
          <p className="ux-com-obj-n">
            <span><b className="mono goc">~{num(e.kcal, 0)}</b> kcal</span>
            <span className="muted">{t('y')}</span>
            <span><b className="mono okc">{e.proteina}</b> {t('g de proteína')}</span>
          </p>
          <p className="small mt8">
            <b>{t('Por qué:')}</b> {manual ? t('lo has puesto tú a mano.') : e.gasto - e.kcal > 0 ? t('{n} kcal menos de lo que gastas: {porque}', { n: e.gasto - e.kcal, porque: t(POR_QUE[perfil.objetivo]) }) : t(POR_QUE[perfil.objetivo])}
          </p>
          <p className="small muted mt4">{t('Es orientativo: lo que más importa es llegar a la proteína.')}</p>
        </div>
        {!e.peso && <p className="small muted mt8">{t('Calculado con un peso aproximado: apunta tu peso para afinarlo.')}</p>}

        <details className="fold mt12">
          <summary>{t('Ver cómo se calcula')}<Ico n="caret-down" /></summary>
          <div className="in">
            <div className="formula">
              <p><span className="lbl">{t('Basal')}</span><b>{e.basal}</b></p>
              <i>×</i>
              <p><span className="lbl">{t('Actividad')}</span><b>{num(factor, 3)}</b></p>
              <i>+</i>
              <p><span className="lbl">{t('Entreno')}</span><b>{entreno}</b></p>
              <i>=</i>
              <p className="res"><span className="lbl">{t('Gasto')}</span><b>~{e.gasto}</b></p>
            </div>
            <div className="spec-box mt12">
              <div className="spec">
                <p><span>{t('En reposo (metabolismo basal)')}</span><b>{e.basal} kcal</b></p>
                <p><span>{t('Tu día ({trabajo})', { trabajo: t(TRABAJO[perfil.trabajo]) })}</span><b>× {num(factor, 3)}</b></p>
                <p><span>{t('Entreno (media al día)')}</span><b>+ {entreno} kcal</b></p>
                <p><span>{t('Lo que gastas')}</span><b>~{e.gasto} kcal</b></p>
                <p><span>{ajustes.kcalManual != null ? t('Objetivo de kcal (manual)') : t('Objetivo de kcal')}</span><b className="goc">~{e.kcal} kcal</b></p>
                <p><span>{ajustes.proteinaManual != null ? t('Objetivo de proteína (manual)') : t('Objetivo de proteína')}</span><b className="okc">{e.proteina} g{gkg ? ` · ${t('{n} g por kilo', { n: num(gkg, 1) })}` : ''}</b></p>
              </div>
            </div>
          </div>
        </details>

        {manual
          ? <button className="btn ln sm mt16" onClick={async () => { await guardarAjustes({ kcalManual: null, proteinaManual: null }); aviso(t('Vuelve a ser automático')) }}>{t('Volver a automático')}</button>
          : <button className="btn ln sm mt16" onClick={() => nav.ir('aju', { seccion: 'comida' })}>{t('Poner mi objetivo a mano')}</button>}
      </div>
    </Pantalla>
  )
}
