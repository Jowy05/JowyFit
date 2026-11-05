// PRO-07 · Objetivos e hitos (y la hoja para crear o editar una meta)
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { borrarMeta, guardarMeta } from '../../datos/acciones/cuerpo'
import { datosMetas, leerMeta, sesionesHechas, valorActualMeta } from '../../datos/consultas'
import type { Guardado, Meta } from '../../datos/tipos'
import { cuentaRepeticiones } from '../../catalogo/clasificacion'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { capital, num } from '../../dominio/formato'
import { fechaCorta, hoyISO, mesAnio, fechaDeCampo } from '../../dominio/fechas'
import { ejerciciosHechos, hitosDominadas } from '../../dominio/tendencias'
import { estadoMeta, unidadFalta, valorMeta, valorTxt } from '../../dominio/metas'
import { Barra, Campo, Chip, cx, Hoja, Ico, Interruptor, Pantalla, Stepper, useUnaVez, Vacio, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfil } from '../../datos/hooks'
import { CabProgreso, TIPOS_META } from './comun'
import { t } from '../../i18n'

const TONO: Partial<Record<Meta['tipo'], 'ok' | 'go'>> = { cintura: 'ok', grasa: 'ok', peso: 'ok', ejercicio: 'go', reps: 'go' }

export function Objetivos() {
  const nav = useNav()
  const perfil = usePerfil()
  const datos = useLiveQuery(datosMetas, [])
  const cab = <CabProgreso actual="objetivos" crumb={t('Metas e hitos')} />
  if (!datos) return <Pantalla>{cab}</Pantalla>

  const { metas, ms, ses } = datos
  const dom = hitosDominadas(ses)
  const verHitos = dom.hay || metas.some(m => m.tipo === 'dominadas')
  const ordenadas = [...metas].sort((a, b) => Number(!!a.hecha) - Number(!!b.hecha) || (a.fecha ?? '9').localeCompare(b.fecha ?? '9'))
  const hechos = dom.hitos.filter(h => h.estado === 'hecho').length

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        {!metas.length && (
          <Vacio icono="flag" titulo={t('Aún no tienes metas')} texto={t('Por ejemplo: cintura por debajo de 88 cm para el verano, o 5 dominadas estrictas.')}
            accion={<><Ico n="plus" b />{t('Crear una meta')}</>} onAccion={() => nav.hoja('hoja-meta')} />
        )}

        {ordenadas.map((m, i) => {
          const actual = valorMeta(m, ms, ses, perfil, hoyISO())
          const { falta, conseguida, progreso: prog } = estadoMeta(m, actual)
          return (
            <button key={m.id} className={cx('goal card pd', i > 0 && 'mt8')} onClick={() => nav.hoja('hoja-meta', { id: m.id })}>
              <div className="row jb">
                <b>{m.titulo}</b>
                {conseguida ? <span className="tag ok"><Ico n="check" b />{t('Conseguida')}</span> : m.fecha ? <span className="tag">{capital(mesAnio(m.fecha))}</span> : null}
              </div>
              <div className="mt8"><Barra v={prog} total={1} tono={conseguida ? 'ok' : TONO[m.tipo]} gruesa /></div>
              {m.tipo === 'libre' ? (
                <div className="spec flat c2 mt4"><p><span>{t('Estado')}</span><b>{m.hecha ? t('Hecha') : t('Pendiente')}</b></p><p><span>{t('Objetivo')}</span><b>{valorTxt(m.objetivo, m.unidad)}</b></p></div>
              ) : (
                <div className="spec flat c2 mt4">
                  <p><span>{t('Ahora')}</span><b>{actual != null ? valorTxt(actual, m.unidad) : '—'}</b></p>
                  <p><span>{t('Falta')}</span><b className={cx(conseguida && 'okc')}>{conseguida ? t('¡Nada!') : falta != null ? valorTxt(falta, unidadFalta(m)) : '—'}</b></p>
                </div>
              )}
            </button>
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
            <p className="small muted">{t('Se marcan solos con lo que apuntas en tus entrenos (asistidas, negativas y dominadas).')}</p>
          </div>
        )}

        {metas.length > 0 && <button className="btn ln sm mt16" onClick={() => nav.hoja('hoja-meta')}><Ico n="plus" />{t('Crear otra meta')}</button>}
      </div>
    </Pantalla>
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
  const inicialTipo = meta?.tipo ?? tipoInicial ?? 'cintura'
  const def = TIPOS_META.find(x => x.v === inicialTipo)!
  const [tipo, setTipo] = useState<Meta['tipo']>(inicialTipo)
  const [titulo, setTitulo] = useState(meta?.titulo ?? '')
  const [objetivo, setObjetivo] = useState<number>(meta?.objetivo ?? sugerido(inicialTipo, null))
  const [unidad, setUnidad] = useState(meta?.unidad ?? def.unidad)
  const [fecha, setFecha] = useState(meta?.fecha ?? '')
  // Una meta de repeticiones no vale para el cardio (se apuntan minutos) ni para la plancha (segundos).
  const conReps = ejercicios.filter(x => { const e = ejercicio(x); return !e || cuentaRepeticiones(e) })
  const [ej, setEj] = useState<string | undefined>(meta?.ejercicio ?? (inicialTipo === 'reps' ? conReps : ejercicios)[0])
  const [hecha, setHecha] = useState(!!meta?.hecha)
  const info = TIPOS_META.find(x => x.v === tipo)!
  // Las de kilos y las de repeticiones van con un ejercicio.
  const deEjercicio = tipo === 'ejercicio' || tipo === 'reps'
  const lista = tipo === 'reps' ? conReps : ejercicios
  const unaVez = useUnaVez()
  // Solo vale la última propuesta: si se cambia de tipo rápido, una respuesta vieja pisaría el objetivo del tipo nuevo.
  const ultimaPropuesta = useRef(0)

  // Al crear, propone un objetivo razonable a partir del valor actual.
  const proponer = (tp: Meta['tipo'], e?: string) => {
    const yo = ++ultimaPropuesta.current
    void valorActualMeta(tp, e, perfil).then(v => { if (yo === ultimaPropuesta.current) setObjetivo(sugerido(tp, v)) })
  }
  useEffect(() => { if (!meta) proponer(inicialTipo, ej) }, []) // solo al abrir

  const cambiarTipo = (tp: Meta['tipo']) => {
    setTipo(tp)
    setUnidad(TIPOS_META.find(x => x.v === tp)!.unidad)
    setObjetivo(sugerido(tp, null))
    const nuevoEj = tp === 'reps' && ej && !conReps.includes(ej) ? conReps[0] : ej
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
    const inicio = mismoValor ? meta.inicio : (await valorActualMeta(tipo, ej, perfil)) ?? undefined
    const nueva: Meta = {
      tipo, objetivo, unidad: unidad.trim(),
      titulo: titulo.trim() || tituloAuto(tipo, objetivo, unidad.trim(), ej),
      fecha: fecha || undefined,
      ejercicio: deEjercicio ? ej : undefined,
      inicio, hecha,
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

  return (
    <Hoja titulo={meta ? t('Editar meta') : t('Nueva meta')} sub={t('Con fecha y barra de progreso')}>
      <p className="lbl fl">{t('Tipo')}</p>
      <div className="chips">
        {TIPOS_META.map(x => <Chip key={x.v} on={tipo === x.v} onClick={() => cambiarTipo(x.v)}><Ico n={x.icono} />{t(x.t)}</Chip>)}
      </div>

      {deEjercicio && (
        <div className="mt12">
          <Campo etiqueta={t('Ejercicio')} ayuda={tipo === 'reps' ? t('Cuenta tu mejor serie: las repeticiones seguidas sin parar.') : undefined}>
            {lista.length
              ? <select className="inp" value={ej ?? ''} onChange={e => cambiarEj(e.target.value)}>{lista.map(x => <option key={x} value={x}>{nombreEjercicio(x)}</option>)}</select>
              : <p className="small muted">{t('Haz algún entreno primero para elegir uno de tus ejercicios.')}</p>}
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
