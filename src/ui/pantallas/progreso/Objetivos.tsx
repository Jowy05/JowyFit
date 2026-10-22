// PRO-07 · Objetivos e hitos (y la hoja para crear o editar una meta)
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { sesionesHechas } from '../../../datos/consultas'
import type { Medicion, Meta, Perfil, Sesion } from '../../../datos/tipos'
import { nombreEjercicio } from '../../../catalogo/catalogo'
import { kg, num } from '../../../dominio/calculos'
import { fechaCorta, hoyISO } from '../../../dominio/fechas'
import { ejerciciosHechos, faltaMeta, hitosDominadas, pesoMaximo, progresoMeta, seriesDe, ultimoValor } from '../../../dominio/tendencias'
import { Barra, Campo, Chip, cx, Hoja, Ico, Interruptor, Pantalla, Stepper, useUnaVez, Vacio, LARGO } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { usePerfil } from '../../datos'
import { CabProgreso, grasaActual, mesAno, TIPOS_META, valorActualMeta } from './comun'
import { t } from '../../../i18n'

function actualDe(m: Meta, ms: Medicion[], ses: Sesion[], perfil: Perfil): number | null {
  switch (m.tipo) {
    case 'cintura': return ultimoValor(ms, x => x.perimetros?.cintura)?.valor ?? null
    case 'peso': return ultimoValor(ms, x => x.pesoKg)?.valor ?? null
    case 'grasa': return grasaActual(ms, perfil)
    case 'dominadas': return hitosDominadas(ses).estrictas
    case 'ejercicio': {
      if (!m.ejercicio) return null
      const p = ses.map(s => pesoMaximo(seriesDe(s, m.ejercicio!))).filter((v): v is number => v != null)
      return p.length ? Math.max(...p) : null
    }
    default: return null
  }
}

const TONO: Partial<Record<Meta['tipo'], 'ok' | 'go'>> = { cintura: 'ok', grasa: 'ok', peso: 'ok', ejercicio: 'go' }
// La unidad la escribe el usuario: solo se traducen «puntos» (los de la grasa, que pone la app).
const valorTxt = (v: number, unidad: string) => `${unidad === 'kg' ? kg(v) : num(v)}${unidad ? ` ${unidad === 'reps' && v === 1 ? 'rep' : unidad === 'puntos' ? t('puntos') : unidad}` : ''}`

export function Objetivos() {
  const nav = useNav()
  const perfil = usePerfil()
  const datos = useLiveQuery(async () => {
    const [metas, ms, ses] = await Promise.all([db.metas.toArray(), db.mediciones.toArray(), sesionesHechas()])
    return { metas, ms, ses }
  }, [])
  const cab = <CabProgreso actual="pro-obj" crumb={t('Metas e hitos')} />
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
            accion={<><Ico n="plus" b />{t('Crear una meta')}</>} onAccion={() => nav.hoja('sheet-meta')} />
        )}

        {ordenadas.map((m, i) => {
          const actual = actualDe(m, ms, ses, perfil)
          const falta = m.tipo === 'libre' ? null : faltaMeta(m.inicio, actual, m.objetivo)
          const conseguida = m.hecha || falta === 0
          const prog = m.tipo === 'libre' ? (m.hecha ? 1 : 0) : conseguida ? 1 : progresoMeta(m.inicio, actual, m.objetivo)
          return (
            <button key={m.id} className={cx('goal card pd', i > 0 && 'mt8')} onClick={() => nav.hoja('sheet-meta', { id: m.id })}>
              <div className="row jb">
                <b>{m.titulo}</b>
                {conseguida ? <span className="tag ok"><Ico n="check" b />{t('Conseguida')}</span> : m.fecha ? <span className="tag">{mesAno(m.fecha)}</span> : null}
              </div>
              <div className="mt8"><Barra v={prog} total={1} tono={conseguida ? 'ok' : TONO[m.tipo]} gruesa /></div>
              {m.tipo === 'libre' ? (
                <div className="spec flat c2 mt4"><p><span>{t('Estado')}</span><b>{m.hecha ? t('Hecha') : t('Pendiente')}</b></p><p><span>{t('Objetivo')}</span><b>{valorTxt(m.objetivo, m.unidad)}</b></p></div>
              ) : (
                <div className="spec flat c2 mt4">
                  <p><span>{t('Ahora')}</span><b>{actual != null ? valorTxt(actual, m.unidad) : '—'}</b></p>
                  <p><span>{t('Falta')}</span><b className={cx(conseguida && 'okc')}>{conseguida ? t('¡Nada!') : falta != null ? valorTxt(falta, m.tipo === 'grasa' ? 'puntos' : m.unidad) : '—'}</b></p>
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

        {metas.length > 0 && <button className="btn ln sm mt16" onClick={() => nav.hoja('sheet-meta')}><Ico n="plus" />{t('Crear otra meta')}</button>}
      </div>
    </Pantalla>
  )
}

// ---------- hoja: crear o editar una meta ----------

export function HojaMeta({ ruta }: { ruta: Ruta<'sheet-meta'> }) {
  const id = ruta.d?.id ?? null
  const meta = useLiveQuery(async () => (id != null ? (await db.metas.get(id)) ?? null : null), [id])
  const ejercicios = useLiveQuery(async () => ejerciciosHechos(await sesionesHechas()), [])
  if ((id != null && meta === undefined) || !ejercicios) return <Hoja titulo={t('Meta')}><div className="cargando">…</div></Hoja>
  const tipo = TIPOS_META.some(x => x.v === ruta.d?.tipo) ? ruta.d?.tipo : undefined
  return <FormMeta key={meta?.id ?? 'nueva'} meta={meta ?? null} tipoInicial={tipo} ejercicios={ejercicios} />
}

function sugerido(tipo: Meta['tipo'], actual: number | null): number {
  switch (tipo) {
    case 'cintura': return actual ? Math.round(actual - 5) : 88
    case 'peso': return actual ? Math.round(actual - 5) : 75
    case 'grasa': return actual ? Math.max(10, Math.round(actual - 5)) : 18
    case 'dominadas': return actual && actual >= 5 ? actual + 5 : 5
    case 'ejercicio': return actual ? Math.ceil((actual * 1.2) / 2.5) * 2.5 : 50
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
    default: return t('Mi meta')
  }
}

function FormMeta({ meta, tipoInicial, ejercicios }: { meta: Meta | null; tipoInicial?: Meta['tipo']; ejercicios: string[] }) {
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
  const [ej, setEj] = useState<string | undefined>(meta?.ejercicio ?? ejercicios[0])
  const [hecha, setHecha] = useState(!!meta?.hecha)
  const info = TIPOS_META.find(x => x.v === tipo)!
  const unaVez = useUnaVez()
  // Solo vale la última propuesta: si se cambia de tipo rápido, una respuesta vieja pisaba el objetivo del tipo nuevo.
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
    proponer(tp, ej)
  }
  const cambiarEj = (e: string) => { setEj(e); if (!meta) proponer('ejercicio', e) }

  // Una meta nueva no tiene id: con un doble toque se creaban dos.
  const guardar = unaVez(async () => {
    if (tipo === 'ejercicio' && !ej) { aviso(t('Elige un ejercicio')); return }
    const mismoValor = meta && meta.tipo === tipo && (tipo !== 'ejercicio' || meta.ejercicio === ej)
    const inicio = mismoValor ? meta.inicio : (await valorActualMeta(tipo, ej, perfil)) ?? undefined
    const nueva: Meta = {
      tipo, objetivo, unidad: unidad.trim(),
      titulo: titulo.trim() || tituloAuto(tipo, objetivo, unidad.trim(), ej),
      fecha: fecha || undefined,
      ejercicio: tipo === 'ejercicio' ? ej : undefined,
      inicio, hecha,
    }
    if (meta?.id != null) nueva.id = meta.id
    await db.metas.put(nueva)
    nav.hoja(null)
    aviso(meta ? t('Meta guardada') : t('Meta creada'))
  })

  const borrar = async () => {
    if (meta?.id == null) return
    const copia = { ...meta }
    await db.metas.delete(meta.id)
    nav.hoja(null)
    aviso(t('Meta borrada'), () => void db.metas.put(copia))
  }

  return (
    <Hoja titulo={meta ? t('Editar meta') : t('Nueva meta')} sub={t('Con fecha y barra de progreso')}>
      <p className="lbl fl">{t('Tipo')}</p>
      <div className="chips">
        {TIPOS_META.map(x => <Chip key={x.v} on={tipo === x.v} onClick={() => cambiarTipo(x.v)}><Ico n={x.icono} />{t(x.t)}</Chip>)}
      </div>

      {tipo === 'ejercicio' && (
        <div className="mt12">
          <Campo etiqueta={t('Ejercicio')}>
            {ejercicios.length
              ? <select className="inp" value={ej ?? ''} onChange={e => cambiarEj(e.target.value)}>{ejercicios.map(x => <option key={x} value={x}>{nombreEjercicio(x)}</option>)}</select>
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
