// PER-01 · Perfil: tus datos, los números que calcula la app y las secciones para editar.
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { perfilPorDefecto } from '../../../datos/repos'
import { objetivosEnergia, ultimaMedicion } from '../../../datos/consultas'
import type { Perfil as TPerfil } from '../../../datos/tipos'
import { cinturaAltura, FACTOR_ACTIVIDAD, grasaMarina, imc, kg, num } from '../../../dominio/calculos'
import { edad } from '../../../dominio/fechas'
import { Cab, Ico, Pantalla } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { usePerfil } from '../../datos'
import { diasTxt, iniciales, NIVEL_TXT, OBJETIVO_TXT, PREFERENCIA_TXT, REPS_TXT, SECCIONES, TRABAJO_TXT, ZONAS_SENSIBLES, type ClaveSeccion } from './textos'

type Numeros = {
  peso: number | null
  cintura: number | null
  imc: number | null
  ratio: number | null
  grasa: number | null
  basal: number
  gasto: number
  kcal: number
  proteina: number
}

/** Calcula todo dentro de la consulta en vivo: se actualiza solo al pesarse o medirse. */
async function calcular(): Promise<Numeros> {
  const p = (await db.perfil.get('yo')) ?? perfilPorDefecto()
  const [e, mCint, mCuello, mCadera] = await Promise.all([objetivosEnergia(p), ultimaMedicion('cintura'), ultimaMedicion('cuello'), ultimaMedicion('cadera')])
  const cintura = mCint?.perimetros?.cintura ?? null
  const cuello = mCuello?.perimetros?.cuello
  const cadera = mCadera?.perimetros?.cadera
  return {
    peso: e.peso,
    cintura,
    imc: e.peso != null && p.alturaCm > 0 ? imc(e.peso, p.alturaCm) : null,
    ratio: cintura != null && p.alturaCm > 0 ? cinturaAltura(cintura, p.alturaCm) : null,
    grasa: cintura != null ? grasaMarina(p.sexo, p.alturaCm, cintura, cuello, cadera) : null,
    basal: e.basal,
    gasto: e.gasto,
    kcal: e.kcal,
    proteina: e.proteina,
  }
}

export function Perfil() {
  const nav = useNav()
  const aviso = useAviso()
  const p = usePerfil()
  const n = useLiveQuery(calcular, [])
  const ini = iniciales(p.nombre)

  const sub = [`${edad(p.nacimiento)} años`, `${p.alturaCm} cm`, n?.peso != null ? `${kg(n.peso)} kg` : null].filter(Boolean).join(' · ')

  return (
    <Pantalla>
      <Cab crumb="Tus datos" derecha={<button className="ib" aria-label="Ajustes" onClick={() => nav.ir('aju')}><Ico n="gear" /></button>}>
        <div className="prof">
          <span className="avatar">{ini || <Ico n="user" b />}</span>
          <div className="grow">
            <h1>{p.nombre.trim() || 'Tu perfil'}</h1>
            <p className="sub">{sub}</p>
            <span className="tag go mt4">{OBJETIVO_TXT[p.objetivo]}</span>
          </div>
        </div>
      </Cab>
      <div className="pg">
        <div className="sec">
          <div className="sec-h"><h2>Tus números</h2><span className="lbl">los calcula la app</span></div>
          <div className="grid2 nums">
            <Kpi t="IMC" ayuda="IMC: tu peso entre la altura al cuadrado. Con músculo engaña: mira también la cintura." onAyuda={aviso}>
              {num(n?.imc)}
            </Kpi>
            <Kpi t="Cintura/altura" ayuda="Cintura entre altura. Por debajo de 0,5 es la meta." onAyuda={aviso}>
              {num(n?.ratio, 2)}
            </Kpi>
            <Kpi t="% grasa est." ayuda="Estimado con tu última cintura, cuello y altura (método de la Marina). Si te falta alguna medida, apúntala en Progreso." onAyuda={aviso}>
              {num(n?.grasa)}{n?.grasa != null && <small>%</small>}
            </Kpi>
            <Kpi t="Basal" ayuda="Lo que gastas en reposo absoluto (fórmula de Mifflin-St Jeor)." onAyuda={aviso}>
              {n ? n.basal : '—'}<small>kcal</small>
            </Kpi>
            <Kpi t="Gasto diario" ayuda={`Basal × actividad de tu trabajo (${num(FACTOR_ACTIVIDAD[p.trabajo], 3)}) + una parte del entreno.`} onAyuda={aviso}>
              {n ? `~${n.gasto}` : '—'}<small>kcal</small>
            </Kpi>
            <button className="card kpi" onClick={() => nav.ir('com-energia', undefined, 'com')}>
              <span className="row jb"><span className="lbl">Objetivo</span><Ico n="caret-right" className="car" /></span>
              <p className="k">{n ? n.kcal : '—'}<small>kcal</small></p>
              <p className="d">{n ? `${n.proteina} g de proteína` : ' '}</p>
            </button>
          </div>
          {n && n.peso == null && <p className="note plain mt8"><Ico n="scales" /><span>Aún no te has pesado: los cálculos usan 75 kg. <b>Pésate</b> para afinarlos.</span></p>}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Secciones</h2></div>
          <div className="list">
            {SECCIONES.map(s => (
              <button key={s.s} className="it" onClick={() => nav.ir('per-sec', { s: s.s })}>
                <span className="ico"><Ico n={s.ico} /></span>
                <span className="tx"><b>{s.t}</b><small>{resumen(s.s, p, n)}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
            ))}
          </div>
        </div>

        <div className="list mt16">
          <button className="it" onClick={() => nav.ir('aju')}>
            <span className="ico"><Ico n="gear" /></span>
            <span className="tx"><b>Ajustes</b><small>Tema, avisos, copias de seguridad</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
      </div>
    </Pantalla>
  )
}

function Kpi({ t, ayuda, onAyuda, children }: { t: string; ayuda: string; onAyuda: (texto: string) => void; children: ReactNode }) {
  return (
    <div className="card kpi">
      <span className="row jb">
        <span className="lbl">{t}</span>
        <button className="q" aria-label="¿Qué es esto?" onClick={() => onAyuda(ayuda)}><Ico n="question" /></button>
      </span>
      <p className="k">{children}</p>
    </div>
  )
}

/** Línea de resumen bajo cada sección. */
function resumen(s: ClaveSeccion, p: TPerfil, n: Numeros | undefined): string {
  switch (s) {
    case 'datos':
      return [p.nombre.trim() || 'Sin nombre', `${edad(p.nacimiento)} años`, p.sexo, `${p.alturaCm} cm`].join(' · ')
    case 'cuerpo': {
      const partes = [n?.peso != null ? `${kg(n.peso)} kg` : null, n?.cintura != null ? `cintura ${num(n.cintura)}` : null].filter(Boolean)
      return partes.length ? partes.join(' · ') : 'Sin medidas todavía'
    }
    case 'objetivos':
      return p.prioridades.length ? p.prioridades.slice(0, 3).join(' · ') : OBJETIVO_TXT[p.objetivo]
    case 'salud': {
      const zonas = ZONAS_SENSIBLES.filter(z => p.zonasSensibles.includes(z.v)).map(z => z.t.toLowerCase())
      const les = p.lesiones.trim() ? 'con lesiones apuntadas' : 'sin lesiones'
      return zonas.length ? `${capital(les)} · sensible: ${zonas.join(', ')}` : capital(les)
    }
    case 'experiencia': {
      const refs = Object.values(p.referencias).filter(v => v.trim()).length
      return `${NIVEL_TXT[p.nivel]}${refs ? ` · ${refs} peso${refs === 1 ? '' : 's'} de referencia` : ''}`
    }
    case 'preferencias':
      return `${PREFERENCIA_TXT[p.preferencia]} · reps ${REPS_TXT[p.reps].toLowerCase()} · superseries ${p.superseries ? 'sí' : 'no'}`
    case 'horario':
      return p.diasFijos.length ? `${diasTxt(p.diasFijos)} a las ${p.horaEntreno.replace(/^0/, '')}` : 'Sin días fijos'
    case 'alimentacion':
      return [`${p.comidasDia} comida${p.comidasDia === 1 ? '' : 's'}`, p.suplementos.length ? p.suplementos.join(' y ').toLowerCase() : 'sin suplementos'].join(' · ')
    case 'vida':
      return `Trabajo ${TRABAJO_TXT[p.trabajo].toLowerCase()} · factor ${num(FACTOR_ACTIVIDAD[p.trabajo], 3)}`
    case 'seguimiento': {
      const pesaje = p.diasPesaje.length ? `Pesaje ${diasTxt(p.diasPesaje).toLowerCase()}` : 'Sin días de pesaje'
      return `${pesaje} · fotos ${p.fotosCadaSemanas > 0 ? `cada ${p.fotosCadaSemanas} semana${p.fotosCadaSemanas === 1 ? '' : 's'}` : 'no'}`
    }
  }
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
