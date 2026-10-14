// COM-08 · Tu objetivo de energía: arriba solo los dos números y el porqué; la fórmula, plegada. Y el consejo de la quincena.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { objetivosEnergia } from '../../../datos/consultas'
import { guardarAjustes } from '../../../datos/repos'
import { FACTOR_ACTIVIDAD, num } from '../../../dominio/calculos'
import { datosQuincena } from '../../../dominio/comida'
import { hoyISO, sumarDias } from '../../../dominio/fechas'
import { Cab, cx, Ico, Pantalla, Seccion } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, usePerfil } from '../../datos'

const TRABAJO = { sentado: 'trabajo sentado', depie: 'de pie', fisico: 'trabajo físico' } as const
const POR_QUE = {
  recomposicion: 'así pierdes grasa poco a poco sin perder fuerza.',
  perder: 'así bajas grasa a buen ritmo.',
  fuerza: 'comes lo que gastas para ganar fuerza sin coger grasa.',
} as const

export function Energia() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const e = useLiveQuery(() => objetivosEnergia(perfil), [perfil, ajustes.kcalManual, ajustes.proteinaManual])
  const mediciones = useLiveQuery(() => db.mediciones.toArray(), []) ?? []
  const comidas = useLiveQuery(() => db.comidas.where('fecha').between(sumarDias(hoy, -27), hoy, true, true).toArray(), [hoy]) ?? []
  if (!e) return <Pantalla><div className="cargando">Cargando…</div></Pantalla>
  const factor = FACTOR_ACTIVIDAD[perfil.trabajo]
  const entreno = Math.max(0, Math.round(e.gasto - e.basal * factor))
  const manual = ajustes.kcalManual != null || ajustes.proteinaManual != null
  const q = datosQuincena({ hoy, mediciones, comidas, objetivoProteina: e.proteina, objetivo: perfil.objetivo })
  const gkg = e.peso ? e.proteina / e.peso : null

  return (
    <Pantalla>
      <Cab atras crumb="Comida" titulo="Tu objetivo de energía" sub="Lo que te toca comer cada día." />
      <div className="pg">
        <div className="card pd ux-com-obj">
          <span className="lbl">Tu objetivo{manual ? ' (puesto a mano)' : ''}</span>
          <p className="ux-com-obj-n">
            <span><b className="mono goc">~{e.kcal}</b> kcal</span>
            <span className="muted">y</span>
            <span><b className="mono okc">{e.proteina}</b> g de proteína</span>
          </p>
          <p className="small mt8">
            <b>Por qué:</b> {manual ? 'lo has puesto tú a mano.' : `${e.gasto - e.kcal > 0 ? `${e.gasto - e.kcal} kcal menos de lo que gastas: ` : ''}${POR_QUE[perfil.objetivo]}`}
          </p>
          <p className="small muted mt4">Es orientativo: lo que más importa es llegar a la proteína.</p>
        </div>
        {!e.peso && <p className="small muted mt8">Calculado con un peso aproximado: apunta tu peso para afinarlo.</p>}

        <details className="fold mt12">
          <summary>Ver cómo se calcula<Ico n="caret-down" /></summary>
          <div className="in">
            <div className="formula">
              <p><span className="lbl">Basal</span><b>{e.basal}</b></p>
              <i>×</i>
              <p><span className="lbl">Actividad</span><b>{num(factor, 3)}</b></p>
              <i>+</i>
              <p><span className="lbl">Entreno</span><b>{entreno}</b></p>
              <i>=</i>
              <p className="res"><span className="lbl">Gasto</span><b>~{e.gasto}</b></p>
            </div>
            <div className="spec-box mt12">
              <div className="spec">
                <p><span>En reposo (metabolismo basal)</span><b>{e.basal} kcal</b></p>
                <p><span>Tu día ({TRABAJO[perfil.trabajo]})</span><b>× {num(factor, 3)}</b></p>
                <p><span>Entreno (media al día)</span><b>+ {entreno} kcal</b></p>
                <p><span>Lo que gastas</span><b>~{e.gasto} kcal</b></p>
                <p><span>Objetivo de kcal{ajustes.kcalManual != null ? ' (manual)' : ''}</span><b className="goc">~{e.kcal} kcal</b></p>
                <p><span>Objetivo de proteína{ajustes.proteinaManual != null ? ' (manual)' : ''}</span><b className="okc">{e.proteina} g{gkg ? ` · ${num(gkg, 1)} g por kilo` : ''}</b></p>
              </div>
            </div>
          </div>
        </details>

        <Seccion titulo="Consejo de la quincena">
          <div className="card pd">
            <span className={cx('tag', q.tono === 'ok' ? 'ok' : q.tono === 'warn' ? 'warn' : '')}>{q.tono === 'ok' && <Ico n="check" b />}{q.etiqueta}</span>
            <b className="d-block mt8">{q.consejo}</b>
            <p className="small muted mt8">Se mira cómo cambian la cintura y el peso, no las calorías apuntadas.</p>
          </div>
          <details className="fold mt8">
            <summary>Ver los datos de 2 semanas<Ico n="caret-down" /></summary>
            <div className="in">
              <div className="spec">
                <p><span>Cintura (vs las 2 semanas anteriores)</span><b>{q.cinturaDelta == null ? '—' : `${q.cinturaDelta > 0 ? '+' : ''}${num(q.cinturaDelta)} cm`}</b></p>
                <p><span>Peso (vs las 2 semanas anteriores)</span><b>{q.pesoDelta == null ? '—' : `${q.pesoDelta > 0 ? '+' : ''}${num(q.pesoDelta)} kg`}</b></p>
                <p><span>Días con picoteo</span><b>{q.picoteoDias} de 14</b></p>
                <p><span>Proteína media</span><b>{q.proteinaMedia == null ? '—' : `${q.proteinaMedia} g`}</b></p>
              </div>
            </div>
          </details>
        </Seccion>

        {manual
          ? <button className="btn ln sm mt16" onClick={async () => { await guardarAjustes({ kcalManual: null, proteinaManual: null }); aviso('Vuelve a ser automático') }}>Volver a automático</button>
          : <button className="btn ln sm mt16" onClick={() => nav.ir('aju', { seccion: 'comida' })}>Poner mi objetivo a mano</button>}
      </div>
    </Pantalla>
  )
}
