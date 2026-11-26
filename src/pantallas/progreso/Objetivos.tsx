// PRO-07 · Objetivos e hitos (y las hojas para crear, editar o apuntar avance en una meta)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { borrarMeta, guardarMeta } from '../../datos/acciones/cuerpo'
import { datosMetas, leerMeta, sesionesHechas, valorActualMeta } from '../../datos/consultas'
import type { Guardado, Meta } from '../../datos/tipos'
import { cuentaRepeticiones } from '../../catalogo/clasificacion'
import { buscar, ejercicio, nombreEjercicio, useCatalogo } from '../../catalogo/catalogo'
import { capital, num } from '../../dominio/formato'
import { fechaCorta, hoyISO, mesAnio, fechaDeCampo } from '../../dominio/fechas'
import { ejerciciosHechos, hitosDominadas } from '../../dominio/tendencias'
import { estadoMeta, registrarAvanceMeta, borrarHitoMeta, unidadFalta, valorAutoMeta, valorMeta, valorTxt } from '../../dominio/metas'
import { lineaSpark } from '../../ui/graficas'
import { Barra, Campo, Chip, cx, Hoja, Ico, Interruptor, Pantalla, Stepper, useUnaVez, Vacio, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfil } from '../../datos/hooks'
import { CabProgreso, TIPOS_META } from './comun'
import { t } from '../../i18n'

const TONO: Partial<Record<Meta['tipo'], 'ok' | 'go'>> = { cintura: 'ok', grasa: 'ok', peso: 'ok', ejercicio: 'go', reps: 'go' }
const ADMITE_AVANCE = (tipo: Meta['tipo']) => tipo === 'dominadas' || tipo === 'reps' || tipo === 'ejercicio' || tipo === 'libre'

export function Objetivos() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const datos = useLiveQuery(datosMetas, [])
  const cab = <CabProgreso actual="objetivos" crumb={t('Metas e hitos')} />
  if (!datos) return <Pantalla>{cab}</Pantalla>

  const { metas, ms, ses } = datos
  const metasDom = metas.filter(m => m.tipo === 'dominadas')
  const maxManualDom = metasDom.reduce((max, m) => Math.max(max, m.actual ?? 0), 0)
  const maxObjDom = metasDom.reduce((max, m) => Math.max(max, m.objetivo), 5)
  const dom = hitosDominadas(ses, { estrictasManual: maxManualDom || undefined, objetivo: maxObjDom, nombre: nombreEjercicio })
  const verHitos = dom.hay || metasDom.length > 0
  const hoy = hoyISO()
  const ordenadas = [...metas].sort((a, b) => Number(!!a.hecha) - Number(!!b.hecha) || (a.fecha ?? '9').localeCompare(b.fecha ?? '9'))
  const hechos = dom.hitos.filter(h => h.estado === 'hecho').length

  const sumarUno = async (m: Guardado<Meta>, actual: number | null) => {
    const antes = { ...m }
    const nuevo = Math.round(((actual ?? 0) + 1) * 100) / 100
    await guardarMeta(registrarAvanceMeta(m, nuevo, hoy))
    const msg = m.objetivo > 0 && nuevo >= m.objetivo
      ? t('¡Meta conseguida! {titulo}', { titulo: m.titulo })
      : `${valorTxt(nuevo, m.unidad)} / ${valorTxt(m.objetivo, m.unidad)}`
    aviso(msg, () => { void guardarMeta(antes) })
  }

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        {!metas.length && (
          <Vacio icono="flag" titulo={t('Aún no tienes metas')} texto={t('Por ejemplo: cintura por debajo de 88 cm para el verano, o 5 dominadas estrictas.')}
            accion={<><Ico n="plus" b />{t('Crear una meta')}</>} onAccion={() => nav.hoja('hoja-meta')} />
        )}

        {ordenadas.map((m, i) => {
          const actual = valorMeta(m, ms, ses, perfil, hoy, nombreEjercicio)
          const { falta, conseguida, progreso: prog } = estadoMeta(m, actual)
          const libreSinAvance = m.tipo === 'libre' && (actual == null || !(m.objetivo > 0))
          return (
            <div key={m.id} className={cx('goal card pd', i > 0 && 'mt8')}>
              <button className="goal-main" onClick={() => nav.hoja('hoja-meta', { id: m.id })}>
                <div className="row jb">
                  <b>{m.titulo}</b>
                  {conseguida ? <span className="tag ok"><Ico n="check" b />{t('Conseguida')}</span> : m.fecha ? <span className="tag">{capital(mesAnio(m.fecha))}</span> : null}
                </div>
                <div className="mt8"><Barra v={prog} total={1} tono={conseguida ? 'ok' : TONO[m.tipo]} gruesa /></div>
                {libreSinAvance ? (
                  <div className="spec flat c2 mt4"><p><span>{t('Estado')}</span><b>{m.hecha ? t('Hecha') : t('Pendiente')}</b></p><p><span>{t('Objetivo')}</span><b>{valorTxt(m.objetivo, m.unidad)}</b></p></div>
                ) : (
                  <div className="spec flat c2 mt4">
                    <p><span>{t('Ahora')}</span><b>{actual != null ? valorTxt(actual, m.unidad) : '—'}</b></p>
                    <p><span>{t('Falta')}</span><b className={cx(conseguida && 'okc')}>{conseguida ? t('¡Nada!') : falta != null ? valorTxt(falta, unidadFalta(m)) : '—'}</b></p>
                  </div>
                )}
                {(m.historial?.length ?? 0) >= 2 && (
                  <div className="goal-hist mt8">
                    <svg className="goal-spark" viewBox="0 0 120 26" aria-hidden="true">
                      <polyline points={lineaSpark(m.historial!.slice(-12).map(x => x.valor), 120, 26)} />
                    </svg>
                    <span className="small muted">{m.historial!.at(-1)?.nota || t('{n} registros', { n: m.historial!.length })}</span>
                  </div>
                )}
              </button>
              {!conseguida && (
                <div className="goal-act mt8">
                  {ADMITE_AVANCE(m.tipo) ? (
                    <>
                      {(m.tipo === 'dominadas' || m.tipo === 'reps') && (
                        <button type="button" className="btn gry sm auto" aria-label={t('Sumar 1 a {titulo}', { titulo: m.titulo })} onClick={() => void sumarUno(m, actual)}>+1</button>
                      )}
                      <button type="button" className="btn gry sm" onClick={() => nav.hoja('hoja-avance-meta', { id: m.id })}><Ico n="plus" b />{t('Apuntar avance')}</button>
                    </>
                  ) : m.tipo === 'peso' ? (
                    <button type="button" className="btn gry sm" onClick={() => nav.hoja('hoja-peso')}><Ico n="scales" />{t('Apuntar peso')}</button>
                  ) : (
                    <button type="button" className="btn gry sm" onClick={() => nav.ir('registrar')}><Ico n="ruler" />{t('Registrar medidas')}</button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {verHitos && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Hitos: dominadas')}</h2><span className="lbl mono">{hechos} / {dom.hitos.length}</span></div>
            <ol className="mile">
              {dom.hitos.map((h, i) => (
                <li key={h.id} className={h.estado === 'hecho' ? 'done' : h.estado === 'actual' ? 'cur' : undefined}>
                  {h.estado === 'hecho' ? <Ico n={i >= 2 ? 'trophy' : 'check'} b /> : h.estado === 'actual' ? <Ico n="arrow-right" b /> : <Ico n="circle" />}
                  <span>
                    <b>{h.titulo}</b>
                    <small>{h.estado === 'hecho' ? (h.fecha ? t('Conseguido el {fecha}', { fecha: fechaCorta(h.fecha) }) : t('Superado')) : h.estado === 'actual' ? t('Siguiente paso · {detalle}', { detalle: h.detalle.toLowerCase() }) : h.detalle}</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className="small muted">{t('Se marcan con tus entrenos (asistidas, negativas y dominadas) y con el avance que apuntes en tu meta.')}</p>
          </div>
        )}

        {metas.length > 0 && <button className="btn ln sm mt16" onClick={() => nav.hoja('hoja-meta')}><Ico n="plus" />{t('Crear otra meta')}</button>}
      </div>
    </Pantalla>
  )
}

// Hoja para apuntar avance en una meta (dominadas, repeticiones, ejercicio o meta libre).

export function HojaAvanceMeta({ ruta }: { ruta: Ruta<'hoja-avance-meta'> }) {
  const datos = useLiveQuery(datosMetas, [])
  const perfil = usePerfil()
  if (!datos) return <Hoja titulo={t('Apuntar avance')}><div className="cargando">…</div></Hoja>
  const meta = datos.metas.find(m => m.id === ruta.d.id)
  if (!meta) return <Hoja titulo={t('Apuntar avance')}><p className="muted">{t('Esta meta ya no existe.')}</p></Hoja>
  const auto = valorAutoMeta(meta, datos.ms, datos.ses, perfil, hoyISO(), nombreEjercicio)
  const actual = valorMeta(meta, datos.ms, datos.ses, perfil, hoyISO(), nombreEjercicio)
  return <FormAvanceMeta key={meta.id} meta={meta} auto={auto} actualInicial={actual} />
}

function FormAvanceMeta({ meta, auto, actualInicial }: { meta: Guardado<Meta>; auto: number | null; actualInicial: number | null }) {
  const nav = useNav()
  const aviso = useAviso()
  const def = TIPOS_META.find(x => x.v === meta.tipo)!
  const paso = meta.tipo === 'ejercicio' && meta.unidad === 'kg' ? 2.5 : def.paso
  const [valor, setValor] = useState<number>(actualInicial ?? 0)
  const [nota, setNota] = useState('')
  const unaVez = useUnaVez()

  const efectivo = auto != null && meta.tipo !== 'libre' ? Math.max(auto, valor) : valor
  const vista = estadoMeta({ ...meta, inicio: meta.inicio ?? 0, hecha: false }, efectivo)
  const atajos = meta.tipo === 'ejercicio' && meta.unidad === 'kg' ? [2.5, 5, 10] : [1, 2, 5]
  const historial = meta.historial ?? []

  const guardar = unaVez(async () => {
    const antes = { ...meta }
    const actualizada = registrarAvanceMeta(meta, valor, hoyISO(), nota)
    await guardarMeta(actualizada)
    nav.hoja(null)
    const final = auto != null && meta.tipo !== 'libre' ? Math.max(auto, actualizada.actual ?? 0) : (actualizada.actual ?? 0)
    const msg = meta.objetivo > 0 && final >= meta.objetivo
      ? t('¡Meta conseguida! {titulo}', { titulo: meta.titulo })
      : t('Avance guardado: {valor}', { valor: valorTxt(final, meta.unidad) })
    aviso(msg, () => { void guardarMeta(antes) })
  })

  const quitarHito = async (indiceOriginal: number) => {
    const antes = { ...meta }
    await guardarMeta(borrarHitoMeta(meta, indiceOriginal))
    aviso(t('Registro borrado'), () => { void guardarMeta(antes) })
  }

  return (
    <Hoja titulo={meta.titulo} sub={t('Objetivo: {valor}', { valor: valorTxt(meta.objetivo, meta.unidad) })}>
      <p className="lbl fl">{t('¿Cuánto llevas ahora?')}</p>
      <Stepper className="big" valor={valor} onCambio={setValor} paso={paso} min={0} sufijo={meta.unidad} decimales={paso % 1 ? 2 : 1} etiqueta={t('Avance actual')} />
      <div className="chips eq mt12">
        {atajos.map(n => (
          <Chip key={n} onClick={() => setValor(v => Math.round((v + n) * 100) / 100)}>+{valorTxt(n, meta.unidad)}</Chip>
        ))}
      </div>
      <div className="mt12">
        <Campo etiqueta={t('Nota (opcional)')}>
          <input className="inp" maxLength={120} value={nota} onChange={e => setNota(e.target.value)} placeholder={t('Ej. con buena técnica, sin ayuda…')} />
        </Campo>
      </div>
      <div className="mt16">
        <Barra v={vista.progreso} total={1} tono={vista.conseguida ? 'ok' : TONO[meta.tipo]} gruesa />
        <p className="small muted mt8">
          {vista.conseguida
            ? t('¡Conseguida!')
            : vista.falta != null
              ? t('Te faltan {valor}', { valor: valorTxt(vista.falta, unidadFalta(meta)) })
              : ''}
        </p>
      </div>
      {auto != null && auto > 0 && meta.tipo !== 'libre' ? (
        <p className="note plain mt12"><Ico n="barbell" /><span>{t('En tus entrenos ya llevas {valor}. Si apuntas menos, se queda tu marca del entreno.', { valor: valorTxt(auto, meta.unidad) })}</span></p>
      ) : (
        <p className="small muted mt8">{t('Puedes apuntar tu mejor marca actual o lo que hagas fuera de un entreno.')}</p>
      )}
      <button className="btn mt16" onClick={() => void guardar()}>{t('Guardar avance')}</button>

      {historial.length > 0 && (
        <div className="mt16">
          <p className="lbl">{t('Histórico de avances')}</p>
          <div className="list mt8">
            {[...historial].map((h, i) => ({ h, i })).reverse().slice(0, 10).map(({ h, i }) => (
              <div key={`${h.fecha}-${i}`} className="it">
                <span className="code">{fechaCorta(h.fecha)}</span>
                <span className="tx">
                  <b className="mono">{valorTxt(h.valor, meta.unidad)}</b>
                  {h.nota && <small>{h.nota}</small>}
                </span>
                <button type="button" className="ib" aria-label={t('Borrar registro del {fecha}', { fecha: fechaCorta(h.fecha) })} onClick={() => void quitarHito(i)}>
                  <Ico n="trash" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Hoja>
  )
}

// Hoja para crear o editar una meta.

export function HojaMeta({ ruta }: { ruta: Ruta<'hoja-meta'> }) {
  const id = ruta.d?.id ?? null
  const meta = useLiveQuery(async () => (id != null ? (await leerMeta(id)) ?? null : null), [id])
  const ejercicios = useLiveQuery(async () => ejerciciosHechos(await sesionesHechas()), [])
  if ((id != null && meta === undefined) || !ejercicios) return <Hoja titulo={t('Meta')}><div className="cargando">…</div></Hoja>
  return <FormMeta key={meta?.id ?? 'nueva'} meta={meta ?? null} tipoInicial={ruta.d?.tipo} ejercicios={ejercicios} />
}

function sugerido(tipo: Meta['tipo'], actual: number | null): number {
  switch (tipo) {
    case 'cintura': return actual ? Math.round(actual - 5) : 88
    case 'peso': return actual ? Math.round(actual - 5) : 75
    case 'grasa': return actual ? Math.max(10, Math.round(actual - 5)) : 18
    case 'dominadas': return actual && actual >= 5 ? actual + 5 : 5
    case 'ejercicio': return actual ? Math.ceil((actual * 1.2) / 2.5) * 2.5 : 50
    case 'reps': return actual ? actual + 3 : 10
    default: return 1
  }
}

/** Título que se guarda si no se escribe uno: sale en el idioma de ese momento. */
function tituloAuto(tipo: Meta['tipo'], objetivo: number, unidad: string, ejercicio?: string): string {
  switch (tipo) {
    case 'cintura': return t('Cintura < {n} {unidad}', { n: num(objetivo), unidad: unidad || 'cm' })
    case 'peso': return t('Peso: {n} {unidad}', { n: num(objetivo), unidad: unidad || 'kg' })
    case 'grasa': return t('~{n} % de grasa', { n: num(objetivo) })
    case 'dominadas': return t('{n} dominadas estrictas', { n: objetivo })
    case 'ejercicio': return ejercicio ? `${nombreEjercicio(ejercicio)}: ${valorTxt(objetivo, unidad || 'kg')}` : t('Ejercicio: {valor}', { valor: valorTxt(objetivo, unidad || 'kg') })
    case 'reps': return ejercicio ? t('{nombre}: {n} seguidas', { nombre: nombreEjercicio(ejercicio), n: objetivo }) : t('{n} repeticiones seguidas', { n: objetivo })
    default: return t('Mi meta')
  }
}

function FormMeta({ meta, tipoInicial, ejercicios }: { meta: Guardado<Meta> | null; tipoInicial?: Meta['tipo']; ejercicios: string[] }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const cat = useCatalogo()
  const inicialTipo = meta?.tipo ?? tipoInicial ?? 'cintura'
  const def = TIPOS_META.find(x => x.v === inicialTipo)!
  const [tipo, setTipo] = useState<Meta['tipo']>(inicialTipo)
  const [titulo, setTitulo] = useState(meta?.titulo ?? '')
  const [objetivo, setObjetivo] = useState<number>(meta?.objetivo ?? sugerido(inicialTipo, null))
  const [unidad, setUnidad] = useState(meta?.unidad ?? def.unidad)
  const [fecha, setFecha] = useState(meta?.fecha ?? '')
  const [busqueda, setBusqueda] = useState('')
  // Una meta de repeticiones no vale para el cardio (se apuntan minutos) ni para la plancha (segundos).
  const conReps = useMemo(() => ejercicios.filter(x => { const e = ejercicio(x); return !e || cuentaRepeticiones(e) }), [ejercicios])
  const catalogoBase = useMemo(() => {
    const todos = (cat?.ejercicios ?? []).filter(e => e.categoria === 'strength' && (tipo === 'reps' ? cuentaRepeticiones(e) : true))
    return busqueda.trim() ? buscar(busqueda, todos) : todos
  }, [cat, tipo, busqueda])
  const hechosLista = tipo === 'reps' ? conReps : ejercicios
  const hechosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return hechosLista
    const validos = new Set(catalogoBase.map(e => e.id))
    return hechosLista.filter(id => validos.has(id))
  }, [hechosLista, busqueda, catalogoBase])
  const restoCatalogo = useMemo(() => {
    const ya = new Set(hechosFiltrados)
    return catalogoBase.filter(e => !ya.has(e.id)).slice(0, busqueda.trim() ? 80 : 60).map(e => e.id)
  }, [catalogoBase, hechosFiltrados, busqueda])
  const primerEj = hechosLista[0] ?? catalogoBase[0]?.id
  const [ej, setEj] = useState<string | undefined>(meta?.ejercicio ?? primerEj)
  const [hecha, setHecha] = useState(!!meta?.hecha)
  const info = TIPOS_META.find(x => x.v === tipo)!
  // Las de kilos y las de repeticiones van con un ejercicio.
  const deEjercicio = tipo === 'ejercicio' || tipo === 'reps'
  const unaVez = useUnaVez()
  // Solo vale la última propuesta: si se cambia de tipo rápido, una respuesta vieja pisaría el objetivo del tipo nuevo.
  const ultimaPropuesta = useRef(0)

  // Si aún no había ejercicio (porque el catálogo terminó de cargar después), elige el primero disponible.
  useEffect(() => {
    if (deEjercicio && !ej && primerEj) setEj(primerEj)
  }, [deEjercicio, ej, primerEj])

  // Al crear, propone un objetivo razonable a partir del valor actual.
  const proponer = (tp: Meta['tipo'], e?: string) => {
    const yo = ++ultimaPropuesta.current
    void valorActualMeta(tp, e, perfil).then(v => { if (yo === ultimaPropuesta.current) setObjetivo(sugerido(tp, v)) })
  }
  useEffect(() => { if (!meta) proponer(inicialTipo, ej) }, []) // solo al abrir

  const cambiarTipo = (tp: Meta['tipo']) => {
    setTipo(tp)
    setBusqueda('')
    setUnidad(TIPOS_META.find(x => x.v === tp)!.unidad)
    setObjetivo(sugerido(tp, null))
    const eActual = ej ? ejercicio(ej) : undefined
    const valido = ej && (tp !== 'reps' || !eActual || cuentaRepeticiones(eActual))
    const nuevoEj = valido ? ej : (tp === 'reps' ? conReps[0] : ejercicios[0]) ?? (cat?.ejercicios ?? []).find(e => e.categoria === 'strength' && (tp !== 'reps' || cuentaRepeticiones(e)))?.id
    setEj(nuevoEj)
    proponer(tp, nuevoEj)
  }
  const cambiarEj = (e: string) => { setEj(e); if (!meta) proponer(tipo, e) }

  // Una meta nueva no tiene id: un doble toque crearía dos.
  const guardar = unaVez(async () => {
    if (deEjercicio && !ej) { aviso(t('Elige un ejercicio')); return }
    // Se comprueba al guardar, no al teclear: en el PC el año pasa por «0002…» mientras se escribe.
    if (fecha && !fechaDeCampo(fecha)) { aviso(t('Revisa la fecha')); return }
    const mismoValor = meta && meta.tipo === tipo && (!deEjercicio || meta.ejercicio === ej)
    const actualAuto = mismoValor ? meta.inicio : (await valorActualMeta(tipo, ej, perfil)) ?? undefined
    const inicio = actualAuto ?? (ADMITE_AVANCE(tipo) ? 0 : undefined)
    const nueva: Meta = {
      tipo, objetivo, unidad: unidad.trim(),
      titulo: titulo.trim() || tituloAuto(tipo, objetivo, unidad.trim(), ej),
      fecha: fecha || undefined,
      ejercicio: deEjercicio ? ej : undefined,
      inicio,
      actual: mismoValor ? meta.actual : undefined,
      historial: mismoValor ? meta.historial : undefined,
      hecha,
    }
    if (meta) nueva.id = meta.id
    await guardarMeta(nueva)
    nav.hoja(null)
    aviso(meta ? t('Meta guardada') : t('Meta creada'))
  })

  const borrar = async () => {
    if (!meta) return
    const deshacer = await borrarMeta(meta)
    nav.hoja(null)
    aviso(t('Meta borrada'), deshacer)
  }

  const hayOpciones = hechosFiltrados.length > 0 || restoCatalogo.length > 0
  const ejFueraDeLista = ej && !hechosFiltrados.includes(ej) && !restoCatalogo.includes(ej)

  return (
    <Hoja titulo={meta ? t('Editar meta') : t('Nueva meta')} sub={t('Con fecha y barra de progreso')}>
      <p className="lbl fl">{t('Tipo')}</p>
      <div className="chips">
        {TIPOS_META.map(x => <Chip key={x.v} on={tipo === x.v} onClick={() => cambiarTipo(x.v)}><Ico n={x.icono} />{t(x.t)}</Chip>)}
      </div>

      {deEjercicio && (
        <div className="mt12">
          <Campo etiqueta={t('Ejercicio')} ayuda={tipo === 'reps' ? t('Cuenta tu mejor serie: las repeticiones seguidas sin parar.') : undefined}>
            <input type="search" className="inp" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={t('Buscar ejercicio…')} aria-label={t('Buscar ejercicio')} />
            {hayOpciones || ej ? (
              <select className="inp mt8" value={ej ?? ''} onChange={e => cambiarEj(e.target.value)} aria-label={t('Ejercicio')}>
                {ejFueraDeLista && <option value={ej}>{nombreEjercicio(ej)}</option>}
                {hechosFiltrados.length > 0 && (
                  <optgroup label={t('Tus ejercicios')}>
                    {hechosFiltrados.map(x => <option key={x} value={x}>{nombreEjercicio(x)}</option>)}
                  </optgroup>
                )}
                {restoCatalogo.length > 0 && (
                  <optgroup label={t('Catálogo')}>
                    {restoCatalogo.map(x => <option key={x} value={x}>{nombreEjercicio(x)}</option>)}
                  </optgroup>
                )}
              </select>
            ) : <p className="small muted mt8">{t('No encontramos ningún ejercicio con ese nombre.')}</p>}
          </Campo>
        </div>
      )}

      <p className="lbl fl mt12">{t('Objetivo')}</p>
      <Stepper valor={objetivo} onCambio={setObjetivo} paso={info.paso} min={0} sufijo={unidad} decimales={2} etiqueta={t('Objetivo')} />

      <div className="grid2 mt12">
        <Campo etiqueta={t('Unidad')}><input className="inp" maxLength={20} value={unidad} onChange={e => setUnidad(e.target.value)} placeholder={t('kg, cm, reps…')} /></Campo>
        <Campo etiqueta={t('Fecha (opcional)')}><input className="inp" type="date" value={fecha} min={meta ? undefined : hoyISO()} onChange={e => setFecha(e.target.value)} /></Campo>
      </div>

      <div className="mt12">
        <Campo etiqueta={t('Nombre')} ayuda={t('Si lo dejas vacío, lo ponemos nosotros.')}>
          <input className="inp" maxLength={LARGO.nombre} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tituloAuto(tipo, objetivo, unidad, ej)} />
        </Campo>
      </div>

      {(meta || tipo === 'libre') && (
        <div className="row jb mt12">
          <span>{t('Ya la he conseguido')}</span>
          <Interruptor on={hecha} onCambio={setHecha} etiqueta={t('Meta conseguida')} />
        </div>
      )}

      <button className="btn mt16" onClick={() => void guardar()}>{meta ? t('Guardar') : t('Crear meta')}</button>
      {meta && <button className="btn bad sm mt8" onClick={() => void borrar()}><Ico n="trash" />{t('Borrar meta')}</button>}
    </Hoja>
  )
}
