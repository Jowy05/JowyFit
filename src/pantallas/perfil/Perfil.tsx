// PER-01 · Perfil: tus datos, los números que calcula la app y las secciones para editar.
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerPerfil, perfilPorDefecto } from '../../datos/repos'
import { objetivosEnergia, ultimaMedicion } from '../../datos/consultas'
import type { Perfil as TPerfil } from '../../datos/tipos'
import { cinturaAltura, grasaMarina, imc } from '../../dominio/calculos'
import { capital, kg, num } from '../../dominio/formato'
import { veredictoCinturaAltura, veredictoGrasa, veredictoImc } from '../../dominio/tendencias'
import { edad } from '../../dominio/fechas'
import { Cab, cx, Ico, Pantalla } from '../../ui/componentes'
import { useNav, type ClaveSeccion } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfil } from '../../datos/hooks'
import { diasTxt, enFrase, iniciales, tituloSeccion, NIVEL_TXT, OBJETIVO_TXT, PREFERENCIA_TXT, REPS_TXT, SECCIONES, TRABAJO_TXT } from './textos'
import { CompletaFicha } from './SeccionesExtra'
import { resumenSalud } from '../../dominio/salud'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

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
  const p = (await leerPerfil()) ?? perfilPorDefecto()
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

  const sub = [t('{n} años', { n: edad(p.nacimiento) }), `${p.alturaCm} cm`, n?.peso != null ? `${kg(n.peso)} kg` : null].filter(Boolean).join(' · ')

  return (
    <Pantalla>
      <Cab crumb={t('Tus datos')} derecha={<button className="ib" aria-label={t('Ajustes')} onClick={() => nav.ir('ajustes')}><Ico n="gear" /></button>}>
        <div className="prof">
          <span className="avatar">{ini || <Ico n="user" b />}</span>
          <div className="grow">
            <h1>{p.nombre.trim() || t('Tu perfil')}</h1>
            <p className="sub">{sub}</p>
            <span className="tag go mt4">{t(OBJETIVO_TXT[p.objetivo])}</span>
          </div>
        </div>
      </Cab>
      <div className="pg">
        <div className="sec">
          <div className="sec-h"><h2>{t('Tus números')}</h2></div>
          <div className="grid2 nums">
            <button className="card kpi span2 per-obj" onClick={() => nav.ir('seccion-perfil', { s: 'calorias' })}>
              <span className="row jb"><span className="lbl">{t('Tu objetivo al día')}</span><Ico n="caret-right" className="car" /></span>
              <p className="k">{n ? num(n.kcal, 0) : '—'}<small>kcal</small>{n && <><span className="per-y">{t('y')}</span>{n.proteina}<small>{t('g de proteína')}</small></>}</p>
              <p className="d">{t('Lo que te conviene comer cada día. Toca para ver por qué.')}</p>
            </button>
          </div>
          {n && n.peso == null && <p className="note plain mt8"><Ico n="scales" /><span>{tr('Aún no te has pesado: los cálculos usan 75 kg. <b>Pésate</b> para afinarlos.', { b: s => <b>{s}</b> })}</span></p>}
          <details className="fold mt8">
            <summary><Ico n="calculator" className="blue" />{t('Ver más números')} <Ico n="caret-down" /></summary>
            <div className="in">
              <div className="grid2 nums">
                <Kpi titulo={t('IMC')} ayuda={t('IMC: tu peso entre la altura al cuadrado. Con músculo engaña: mira también la cintura.')} onAyuda={aviso}
                  palabra={n?.imc != null && Number.isFinite(n.imc) ? veredictoImc(n.imc) : null}>
                  {num(n?.imc)}
                </Kpi>
                <Kpi titulo={t('Cintura/altura')} ayuda={t('Tu cintura entre tu altura. Por debajo de 0,5 es lo saludable.')} onAyuda={aviso}
                  palabra={n?.ratio != null ? veredictoCinturaAltura(n.ratio) : null}>
                  {num(n?.ratio, 2)}
                </Kpi>
                <Kpi titulo={t('% de grasa')} ayuda={t('Estimado con tu última cintura, cuello y altura (método de la Marina). Si te falta alguna medida, apúntala en Progreso.')} onAyuda={aviso}
                  palabra={n?.grasa != null ? veredictoGrasa(n.grasa, p.sexo) : null}>
                  {num(n?.grasa)}{n?.grasa != null && <small>%</small>}
                </Kpi>
                <Kpi titulo={t('Gasto en reposo')} ayuda={t('Lo que gasta tu cuerpo sin moverte en todo el día (fórmula de Mifflin-St Jeor).')} onAyuda={aviso}>
                  {n ? num(n.basal, 0) : '—'}<small>kcal</small>
                </Kpi>
                <Kpi titulo={t('Gasto diario')} ayuda={t('Lo que gastas en reposo, más tu trabajo y una parte del entreno.')} onAyuda={aviso}>
                  {n ? `~${num(n.gasto, 0)}` : '—'}<small>kcal</small>
                </Kpi>
              </div>
            </div>
          </details>
        </div>

        <CompletaFicha p={p} />
        <div className="sec">
          <div className="sec-h"><h2>{t('Tu ficha')}</h2><span className="lbl">{t('toca para cambiar')}</span></div>
          <div className="list">
            {SECCIONES.filter(s => !s.mas).map(s => <FilaSeccion key={s.s} s={s} p={p} n={n} />)}
          </div>
          <details className="fold mt8">
            <summary><Ico n="dots-three" className="blue" />{t('Más secciones')} <Ico n="caret-down" /></summary>
            <div className="in">
              <div className="list">
                {SECCIONES.filter(s => s.mas).map(s => <FilaSeccion key={s.s} s={s} p={p} n={n} />)}
              </div>
            </div>
          </details>
        </div>

        <div className="list mt16">
          <button className="it" onClick={() => nav.ir('ajustes')}>
            <span className="ico"><Ico n="gear" /></span>
            <span className="tx"><b>{t('Ajustes')}</b><small>{t('Tamaño de letra, recordatorios, copia de seguridad')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
      </div>
    </Pantalla>
  )
}

function Kpi({ titulo, ayuda, onAyuda, palabra, children }: { titulo: string; ayuda: string; onAyuda: (texto: string) => void; palabra?: { palabra: string; tono: string } | null; children: ReactNode }) {
  return (
    <div className="card kpi">
      <span className="row jb">
        <span className="lbl">{titulo}</span>
        <button className="q" aria-label={t('¿Qué es esto?')} onClick={() => onAyuda(ayuda)}><Ico n="question" /></button>
      </span>
      <p className="k">{children}</p>
      {palabra && <p className={cx('d', palabra.tono === 'ok' ? 'okc' : palabra.tono === 'bad' ? 'badc' : 'warnc')}>{capital(palabra.palabra)}</p>}
    </div>
  )
}

function FilaSeccion({ s, p, n }: { s: (typeof SECCIONES)[number]; p: TPerfil; n: Numeros | undefined }) {
  const nav = useNav()
  return (
    <button className="it" onClick={() => nav.ir('seccion-perfil', { s: s.s })}>
      <span className="ico"><Ico n={s.ico} /></span>
      <span className="tx"><b>{tituloSeccion(s)}</b><small>{resumen(s.s, p, n)}</small></span>
      <Ico n="caret-right" className="car" />
    </button>
  )
}

/** Línea de resumen bajo cada sección. */
function resumen(s: ClaveSeccion, p: TPerfil, n: Numeros | undefined): string {
  switch (s) {
    case 'datos':
      return [p.nombre.trim() || t('Sin nombre'), t('{n} años', { n: edad(p.nacimiento) }), p.sexo === 'mujer' ? t('mujer') : t('hombre'), `${p.alturaCm} cm`].join(' · ')
    case 'cuerpo': {
      const partes = [n?.peso != null ? `${kg(n.peso)} kg` : null, n?.cintura != null ? t('cintura {n}', { n: num(n.cintura) }) : null].filter(Boolean)
      return partes.length ? partes.join(' · ') : t('Sin medidas todavía')
    }
    case 'objetivos':
      return [p.objetivo, ...(p.objetivosExtra ?? [])].map(o => t(OBJETIVO_TXT[o])).join(' · ')
    case 'salud':
      return resumenSalud(p) || (p.lesiones.trim() ? capital(t('con lesiones apuntadas')) : capital(t('sin lesiones')))
    case 'movimiento':
      return p.cardioMin !== undefined ? t('{pasos} pasos · {min} min a la semana', { pasos: num(p.pasosObjetivo, 0), min: p.cardioMin }) : t('1 pregunta')
    case 'calorias':
      return n ? t('{n} kcal al día', { n: num(n.kcal, 0) }) : '—'
    case 'sueno':
      return p.sueno === 'poco' ? t('Menos de 6 horas') : p.sueno === 'normal' ? t('6 o 7 horas') : p.sueno === 'mucho' ? t('8 horas o más') : t('1 pregunta')
    case 'deportes':
      return p.deportes === undefined ? t('1 pregunta') : p.deportes.length ? p.deportes.map(d => t(d)).join(' · ') : t('Ninguno')
    case 'experiencia': {
      const refs = Object.values(p.referencias).filter(v => v.trim()).length
      return `${t(NIVEL_TXT[p.nivel])}${refs ? ` · ${tn(refs, '{n} peso apuntado', '{n} pesos apuntados')}` : ''}`
    }
    case 'preferencias':
      return t('{preferencia} · repeticiones {reps}', { preferencia: t(PREFERENCIA_TXT[p.preferencia]), reps: p.reps === 'mezcla' ? t('variadas') : t(REPS_TXT[p.reps]).toLowerCase() })
    case 'horario':
      return p.diasFijos.length ? t('{dias} a las {hora}', { dias: diasTxt(p.diasFijos), hora: p.horaEntreno.replace(/^0/, '') }) : t('Sin días fijos')
    case 'alimentacion':
      return p.suplementos.length ? t('Suplementos: {lista}', { lista: p.suplementos.map(x => t(x)).join(` ${t('y')} `).toLowerCase() }) : t('Sin suplementos')
    case 'vida':
      return t('Trabajo {tipo}', { tipo: t(TRABAJO_TXT[p.trabajo]).toLowerCase() })
    case 'seguimiento': {
      const pesaje = p.diasPesaje.length ? t('Pesaje {dias}', { dias: enFrase(diasTxt(p.diasPesaje)) }) : t('Sin días de pesaje')
      return t('{pesaje} · fotos {fotos}', { pesaje, fotos: p.fotosCadaSemanas > 0 ? tn(p.fotosCadaSemanas, 'cada {n} semana', 'cada {n} semanas') : t('no') })
    }
  }
}

