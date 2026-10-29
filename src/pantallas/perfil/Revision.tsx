// Revisión de la semana (4b-4d): cómo van las molestias, si hay algo nuevo y qué cambia en los entrenos que quedan.
// Al acabar, una pregunta opcional de «Completa tu ficha» (8b). Sale siempre, también sin molestias apuntadas.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { deshacerCambio, guardarRevision } from '../../datos/acciones/revision'
import { leerRevisiones } from '../../datos/consultas'
import { guardarPerfil } from '../../datos/repos'
import type { CambioRevision, Guardado, Perfil, Revision as TRevision, ZonaDolor } from '../../datos/tipos'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { detalleDolor, doloresDe, nombreZonaDolor } from '../../dominio/salud'
import { capital } from '../../dominio/formato'
import { textoCambio } from '../../dominio/revision'
import { diaMes, deISO, hoyISO, semanaDe } from '../../dominio/fechas'
import { Cab, Chip, cx, Hoja, Ico, Pantalla, useUnaVez } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfilCargado } from '../../datos/hooks'
import { DibujoZona, Dolores } from './SaludDolor'
import { fichaCompleta, Sueno, Deportes, ExperienciaPrevia } from './SeccionesExtra'
import { t, tk } from '../../i18n'
import { tr } from '../../i18n/jsx'

const VA = [{ v: 'mejor', t: tk('Mejor') }, { v: 'igual', t: tk('Igual') }, { v: 'peor', t: tk('Peor') }, { v: 'ya', t: tk('Ya no me duele') }] as const

/** «Semana del 19 al 25 oct». */
function tituloSemana(hoy: string) {
  const s = semanaDe(hoy)
  const a = deISO(s[0]!), b = deISO(s[6]!)
  return t('Semana del {desde} al {hasta}', { desde: a.getDate(), hasta: diaMes(b.getDate(), b.getMonth()) })
}

export function Revision() {
  const p = usePerfilCargado()
  if (!p) return <Pantalla><Cab atras crumb={t('Ajustes')} titulo={t('Revisión de la semana')} /><div className="cargando">{t('Cargando…')}</div></Pantalla>
  return <FormRevision p={p} />
}

function FormRevision({ p }: { p: Perfil }) {
  const nav = useNav()
  const unaVez = useUnaVez()
  // Las molestias de antes, fijadas al abrir (las nuevas se apuntan en la cuadrícula y se guardan al tocarlas).
  const [antes] = useState(() => doloresDe(p))
  const [respuestas, setRespuestas] = useState<TRevision['respuestas']>([])
  const [nuevo, setNuevo] = useState<'no' | 'molestia' | 'lesion' | null>(null)
  const [hecha, setHecha] = useState<Guardado<TRevision> | null>(null)
  const zonasAntes = antes.map(d => d.zona)
  const responder = (zona: ZonaDolor, va: TRevision['respuestas'][number]['va']) => setRespuestas(r => [...r.filter(x => x.zona !== zona), { zona, va }])
  const guardar = unaVez(async (estado: TRevision['estado']) => {
    setHecha(await guardarRevision({ estado, respuestas, zonasAntes }))
  })
  const completa = antes.every(d => respuestas.some(r => r.zona === d.zona))

  if (hecha) return <Resultado rev={hecha} />
  return (
    <Pantalla>
      <Cab atras crumb={tituloSemana(hoyISO())} titulo={t('Revisión de la semana')} sub={antes.length ? t('Dos toques por molestia.') : t('Para ajustar tu rutina a cómo estás.')} />
      <div className="pg">
        {antes.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Lo que te dolía')}</h2></div>
            {antes.map(d => {
              const va = respuestas.find(r => r.zona === d.zona)?.va
              return (
                <div key={d.zona} className="card pd mt8 g2-rv">
                  <div className="rv-h"><span className="th"><DibujoZona zona={d.zona} /></span><span className="tx"><b>{nombreZonaDolor(d.zona)}</b><small>{capital(detalleDolor(d))}</small></span></div>
                  <div className="g2-4">{VA.map(x => <Chip key={x.v} on={va === x.v} onClick={() => responder(d.zona, x.v)}>{t(x.t)}</Chip>)}</div>
                </div>
              )
            })}
          </div>
        )}
        <div className="sec">
          <div className="sec-h"><h2>{antes.length ? t('¿Algo nuevo?') : t('¿Qué tal estás?')}</h2></div>
          {antes.length ? (
            <div className="chips eq">
              <Chip on={nuevo === 'no'} onClick={() => setNuevo('no')}>{t('No, nada nuevo')}</Chip>
              <Chip on={nuevo === 'molestia'} onClick={() => setNuevo('molestia')}>{t('Molestia nueva')}</Chip>
              <Chip on={nuevo === 'lesion'} onClick={() => setNuevo('lesion')}>{t('Lesión nueva')}</Chip>
            </div>
          ) : (
            <div className="g2-big">
              <button className="g2-bb ok" onClick={() => void guardar('bien')}><Ico n="smiley" /><span className="tx grow"><b>{t('Todo bien')}</b><small>{t('Nada nuevo que contar')}</small></span><Ico n="caret-right" className="car" /></button>
              <button className={cx('g2-bb', nuevo === 'molestia' && 'on')} onClick={() => setNuevo('molestia')}><Ico n="bandaids" /><span className="tx grow"><b>{t('Noto una molestia')}</b><small>{t('Algo pequeño que antes no tenía')}</small></span><Ico n="caret-right" className="car" /></button>
              <button className={cx('g2-bb', nuevo === 'lesion' && 'on')} onClick={() => setNuevo('lesion')}><Ico n="first-aid" /><span className="tx grow"><b>{t('Tengo una lesión nueva')}</b><small>{t('Un golpe, un tirón, algo que duele de verdad')}</small></span><Ico n="caret-right" className="car" /></button>
            </div>
          )}
          {(nuevo === 'molestia' || nuevo === 'lesion') && (
            <div className="mt12">
              <p className="small muted">{t('Toca dónde y contesta los tres toques.')}</p>
              <Dolores p={p} cambia={c => void guardarPerfil(c)} />
            </div>
          )}
        </div>
        {(antes.length > 0 || nuevo === 'molestia' || nuevo === 'lesion') && (
          <div className="dock">
            <button className={cx('btn', antes.length > 0 && (!completa || !nuevo) && 'off')} disabled={antes.length > 0 && (!completa || !nuevo)}
              onClick={() => void guardar(nuevo === 'lesion' ? 'lesion' : nuevo === 'molestia' ? 'molestia' : 'seguimiento')}>{t('Guardar revisión')}</button>
          </div>
        )}
        <p className="small muted mt12">{tr('Te la volvemos a preguntar el <b>domingo que viene</b>.', { b: x => <b>{x}</b> })} <button className="lnk" onClick={nav.atras}>{t('Ahora no')}</button></p>
      </div>
    </Pantalla>
  )
}

/** «Tu semana, ajustada» (4d) o «Apuntado. ¡Buena semana!» si no cambia nada. */
function Resultado({ rev }: { rev: Guardado<TRevision> }) {
  const nav = useNav()
  const aviso = useAviso()
  const p = usePerfilCargado()
  const actual = useLiveQuery(async () => (await leerRevisiones()).find(x => x.id === rev.id) ?? rev, [rev.id]) ?? rev
  const porZona = useMemo(() => {
    const m = new Map<ZonaDolor, CambioRevision[]>()
    for (const c of actual.cambios) m.set(c.zona, [...(m.get(c.zona) ?? []), c])
    return [...m]
  }, [actual])
  const peor = rev.respuestas.filter(r => r.va === 'peor').map(r => r.zona)
  const deshacer = async (cs: CambioRevision[]) => {
    let todos = true
    for (const c of cs.filter(x => !x.deshecho)) todos = (await deshacerCambio(rev.id, c.uid)) && todos
    aviso(todos ? t('Deshecho: tu rutina vuelve a como estaba') : t('Algún cambio ya no se puede deshacer: la rutina cambió después'))
  }
  const pregunta = p && fichaCompleta(p).some(x => !x.hecha && EXTRA(x.s))
  const salir = () => { nav.atras(); if (pregunta) nav.hoja('hoja-pregunta') }
  if (!actual.cambios.length) return (
    <Pantalla>
      <Cab atras crumb={tituloSemana(rev.fecha)} titulo={t('Revisión de la semana')} />
      <div className="pg">
        <div className="card pd empty"><span className="empty-ic ok"><Ico n="check-circle" /></span><h3 className="h3">{t('Apuntado. ¡Buena semana!')}</h3><p className="muted">{t('Tu rutina sigue igual.')}</p></div>
        <button className="btn mt16" onClick={salir}>{t('Vale')}</button>
      </div>
    </Pantalla>
  )
  return (
    <Pantalla>
      <Cab atras crumb={t('Revisión hecha')} titulo={t('Tu semana, ajustada')} sub={t('{n} cambios en tus próximos entrenos.', { n: actual.cambios.filter(c => !c.deshecho).length })} />
      <div className="pg">
        {porZona.map(([zona, cs]) => {
          const vuelve = rev.respuestas.some(r => r.zona === zona && (r.va === 'mejor' || r.va === 'ya'))
          return (
            <div key={zona} className={cx('card g2-cb mt12', cs.every(c => c.deshecho) && 'undone')}>
              <div className="cb-h"><span className="th"><DibujoZona zona={zona} /></span><span className="tx"><b>{vuelve ? t('{zona}: vuelve poco a poco', { zona: nombreZonaDolor(zona) }) : t('{zona}: más suave esta semana', { zona: nombreZonaDolor(zona) })}</b><small>{vuelve ? t('Porque va mejor.') : rev.respuestas.some(r => r.zona === zona) ? t('Porque va peor.') : t('Por tu molestia nueva.')}</small></span></div>
              <ul>{cs.map(c => <li key={c.uid}><Ico n="arrow-right" /><span>{textoCambio(c, nombreEjercicio)}{c.deshecho && <> · <s>{t('deshecho')}</s></>}</span></li>)}</ul>
              {!cs.every(c => c.deshecho) && (
                <div className="cb-f"><span className="small muted">{t('Día {letra}', { letra: cs.map(c => c.letra).filter((l, i, a) => a.indexOf(l) === i).join(', ') })}</span>
                  <button className="lnk" onClick={() => void deshacer(cs)}>{t('Deshacer')}</button>
                </div>
              )}
            </div>
          )
        })}
        <p className="note plain mt12"><Ico n="info" /><span>{tr('Se queda así <b>hasta que la revisión diga que va mejor</b>. Luego vuelve a lo normal poco a poco. Tu historial no cambia.', { b: x => <b>{x}</b> })}</span></p>
        {peor.length > 0 && <p className="note warn mt8"><Ico n="first-aid" /><span>{tr('Va peor: {zona}. Si la semana que viene sigue igual o peor, <b>que te lo mire tu médico o un fisio</b>.', { zona: peor.map(nombreZonaDolor).join(', '), b: x => <b>{x}</b> })}</span></p>}
        <button className="btn mt16" onClick={salir}>{t('Vale')}</button>
      </div>
    </Pantalla>
  )
}

/** Una pregunta más, si quieres (8b): la primera de «Completa tu ficha» sin contestar, con «Saltar». */
export function HojaPregunta() {
  const p = usePerfilCargado()
  if (!p) return <Hoja titulo={t('Una pregunta más, si quieres')}><p className="muted">{t('Cargando…')}</p></Hoja>
  return <Pregunta inicial={p} />
}

const EXTRA = (s: string) => s === 'sueno' || s === 'deportes' || s === 'experiencia'

/** La pregunta se elige al abrir: al contestarla el perfil cambia y no debe saltar a otra (ni a nada) a mitad. */
function Pregunta({ inicial }: { inicial: Perfil }) {
  const nav = useNav()
  const [{ falta, n, total }] = useState(() => {
    const items = fichaCompleta(inicial)
    return { falta: items.find(x => !x.hecha && EXTRA(x.s))?.s, n: items.filter(x => x.hecha).length + 1, total: items.length }
  })
  const p = usePerfilCargado() ?? inicial
  useEffect(() => { if (!falta) nav.hoja(null) }, [falta]) // sin nada que preguntar, la hoja se cierra
  if (!falta) return null
  const guardar = (c: Partial<Perfil>) => void guardarPerfil(c)
  return (
    <Hoja titulo={t('Una pregunta más, si quieres')} sub={t('{n} de {total}', { n, total })}>
      {falta === 'sueno' && <Sueno p={p} guardar={guardar} />}
      {falta === 'deportes' && <Deportes p={p} guardar={guardar} />}
      {falta === 'experiencia' && <ExperienciaPrevia p={p} guardar={guardar} />}
      <div className="btns mt16">
        <button className="btn gry sm" onClick={() => nav.hoja(null)}>{t('Saltar')}</button>
        <button className="btn sm" onClick={() => nav.hoja(null)}>{t('Guardar')}</button>
      </div>
    </Hoja>
  )
}
