// PRO-07 · Objetivos e hitos (y la hoja para crear o editar una meta)
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { sesionesHechas } from '../../../datos/consultas'
import type { Medicion, Meta, Perfil, Sesion } from '../../../datos/tipos'
import { nombreEjercicio } from '../../../catalogo/catalogo'
import { kg, num } from '../../../dominio/calculos'
import { fechaCorta, hoyISO } from '../../../dominio/fechas'
import { ejerciciosHechos, faltaMeta, hitosDominadas, pesoMaximo, progresoMeta, seriesDe, ultimoValor } from '../../../dominio/tendencias'
import { Barra, Campo, Chip, cx, Hoja, Ico, Interruptor, Pantalla, Stepper, Vacio } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { usePerfil } from '../../datos'
import { CabProgreso, grasaActual, mesAno, TIPOS_META, valorActualMeta } from './comun'

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
const valorTxt = (v: number, unidad: string) => `${unidad === 'kg' ? kg(v) : num(v)}${unidad ? ` ${unidad === 'reps' && v === 1 ? 'rep' : unidad}` : ''}`

export function Objetivos() {
  const nav = useNav()
  const perfil = usePerfil()
  const datos = useLiveQuery(async () => {
    const [metas, ms, ses] = await Promise.all([db.metas.toArray(), db.mediciones.toArray(), sesionesHechas()])
    return { metas, ms, ses }
  }, [])
  const cab = <CabProgreso actual="pro-obj" crumb="Metas e hitos" />
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
          <Vacio icono="flag" titulo="Aún no tienes metas" texto="Por ejemplo: cintura por debajo de 88 cm para el verano, o 5 dominadas estrictas."
            accion={<><Ico n="plus" b />Crear una meta</>} onAccion={() => nav.hoja('sheet-meta')} />
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
                {conseguida ? <span className="tag ok"><Ico n="check" b />Conseguida</span> : m.fecha ? <span className="tag">{mesAno(m.fecha)}</span> : null}
              </div>
              <div className="mt8"><Barra v={prog} total={1} tono={conseguida ? 'ok' : TONO[m.tipo]} gruesa /></div>
              {m.tipo === 'libre' ? (
                <div className="spec flat c2 mt4"><p><span>Estado</span><b>{m.hecha ? 'Hecha' : 'Pendiente'}</b></p><p><span>Objetivo</span><b>{valorTxt(m.objetivo, m.unidad)}</b></p></div>
              ) : (
                <div className="spec flat c2 mt4">
                  <p><span>Ahora</span><b>{actual != null ? valorTxt(actual, m.unidad) : '—'}</b></p>
                  <p><span>Falta</span><b className={cx(conseguida && 'okc')}>{conseguida ? '¡Nada!' : falta != null ? valorTxt(falta, m.tipo === 'grasa' ? 'puntos' : m.unidad) : '—'}</b></p>
                </div>
              )}
            </button>
          )
        })}

        {verHitos && (
          <div className="sec">
            <div className="sec-h"><h2>Hitos: dominadas</h2><span className="lbl mono">{hechos} / {dom.hitos.length}</span></div>
            <ol className="mile">
              {dom.hitos.map((h, i) => (
                <li key={h.titulo} className={h.estado === 'hecho' ? 'done' : h.estado === 'actual' ? 'cur' : undefined}>
                  {h.estado === 'hecho' ? <Ico n={i >= 2 ? 'trophy' : 'check'} b /> : h.estado === 'actual' ? <Ico n="arrow-right" b /> : <Ico n="circle" />}
                  <span>
                    <b>{h.titulo}</b>
                    <small>{h.estado === 'hecho' ? (h.fecha ? `Conseguido el ${fechaCorta(h.fecha)}` : 'Superado') : h.estado === 'actual' ? `Siguiente paso · ${h.detalle.toLowerCase()}` : h.detalle}</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className="small muted">Se marcan solos con lo que apuntas en tus entrenos (asistidas, negativas y dominadas).</p>
          </div>
        )}

        {metas.length > 0 && <button className="btn ln sm mt16" onClick={() => nav.hoja('sheet-meta')}><Ico n="plus" />Crear otra meta</button>}
      </div>
    </Pantalla>
  )
}

// ---------- hoja: crear o editar una meta ----------

export function HojaMeta({ ruta }: { ruta: Ruta }) {
  const id = ruta.d?.id != null ? Number(ruta.d.id) : null
  const meta = useLiveQuery(async () => (id != null ? (await db.metas.get(id)) ?? null : null), [id])
  const ejercicios = useLiveQuery(async () => ejerciciosHechos(await sesionesHechas()), [])
  if ((id != null && meta === undefined) || !ejercicios) return <Hoja titulo="Meta"><div className="cargando">…</div></Hoja>
  const tipo = TIPOS_META.some(t => t.v === ruta.d?.tipo) ? (ruta.d!.tipo as Meta['tipo']) : undefined
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

function tituloAuto(tipo: Meta['tipo'], objetivo: number, unidad: string, ejercicio?: string): string {
  switch (tipo) {
    case 'cintura': return `Cintura < ${num(objetivo)} ${unidad || 'cm'}`
    case 'peso': return `Peso: ${num(objetivo)} ${unidad || 'kg'}`
    case 'grasa': return `~${num(objetivo)} % de grasa`
    case 'dominadas': return `${objetivo} dominadas estrictas`
    case 'ejercicio': return ejercicio ? `${nombreEjercicio(ejercicio)}: ${valorTxt(objetivo, unidad || 'kg')}` : `Ejercicio: ${valorTxt(objetivo, unidad || 'kg')}`
    default: return 'Mi meta'
  }
}

function FormMeta({ meta, tipoInicial, ejercicios }: { meta: Meta | null; tipoInicial?: Meta['tipo']; ejercicios: string[] }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const inicialTipo = meta?.tipo ?? tipoInicial ?? 'cintura'
  const def = TIPOS_META.find(t => t.v === inicialTipo)!
  const [tipo, setTipo] = useState<Meta['tipo']>(inicialTipo)
  const [titulo, setTitulo] = useState(meta?.titulo ?? '')
  const [objetivo, setObjetivo] = useState<number>(meta?.objetivo ?? sugerido(inicialTipo, null))
  const [unidad, setUnidad] = useState(meta?.unidad ?? def.unidad)
  const [fecha, setFecha] = useState(meta?.fecha ?? '')
  const [ej, setEj] = useState<string | undefined>(meta?.ejercicio ?? ejercicios[0])
  const [hecha, setHecha] = useState(!!meta?.hecha)
  const info = TIPOS_META.find(t => t.v === tipo)!

  // Al crear, propone un objetivo razonable a partir del valor actual.
  const proponer = (t: Meta['tipo'], e?: string) => {
    void valorActualMeta(t, e, perfil).then(v => setObjetivo(sugerido(t, v)))
  }
  useEffect(() => { if (!meta) proponer(inicialTipo, ej) }, []) // solo al abrir

  const cambiarTipo = (t: Meta['tipo']) => {
    setTipo(t)
    setUnidad(TIPOS_META.find(x => x.v === t)!.unidad)
    setObjetivo(sugerido(t, null))
    proponer(t, ej)
  }
  const cambiarEj = (e: string) => { setEj(e); if (!meta) proponer('ejercicio', e) }

  const guardar = async () => {
    if (tipo === 'ejercicio' && !ej) { aviso('Elige un ejercicio'); return }
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
    aviso(meta ? 'Meta guardada' : 'Meta creada')
  }

  const borrar = async () => {
    if (meta?.id == null) return
    const copia = { ...meta }
    await db.metas.delete(meta.id)
    nav.hoja(null)
    aviso('Meta borrada', () => void db.metas.put(copia))
  }

  return (
    <Hoja titulo={meta ? 'Editar meta' : 'Nueva meta'} sub="Con fecha y barra de progreso">
      <p className="lbl fl">Tipo</p>
      <div className="chips">
        {TIPOS_META.map(t => <Chip key={t.v} on={tipo === t.v} onClick={() => cambiarTipo(t.v)}><Ico n={t.icono} />{t.t}</Chip>)}
      </div>

      {tipo === 'ejercicio' && (
        <div className="mt12">
          <Campo etiqueta="Ejercicio">
            {ejercicios.length
              ? <select className="inp" value={ej ?? ''} onChange={e => cambiarEj(e.target.value)}>{ejercicios.map(x => <option key={x} value={x}>{nombreEjercicio(x)}</option>)}</select>
              : <p className="small muted">Haz algún entreno primero para elegir uno de tus ejercicios.</p>}
          </Campo>
        </div>
      )}

      <p className="lbl fl mt12">Objetivo</p>
      <Stepper valor={objetivo} onCambio={setObjetivo} paso={info.paso} min={0} sufijo={unidad} decimales={2} etiqueta="Objetivo" />

      <div className="grid2 mt12">
        <Campo etiqueta="Unidad"><input className="inp" value={unidad} onChange={e => setUnidad(e.target.value)} placeholder="kg, cm, reps…" /></Campo>
        <Campo etiqueta="Fecha (opcional)"><input className="inp" type="date" value={fecha} min={meta ? undefined : hoyISO()} onChange={e => setFecha(e.target.value)} /></Campo>
      </div>

      <div className="mt12">
        <Campo etiqueta="Nombre" ayuda="Si lo dejas vacío, lo ponemos nosotros.">
          <input className="inp" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tituloAuto(tipo, objetivo, unidad, ej)} />
        </Campo>
      </div>

      {(meta || tipo === 'libre') && (
        <div className="row jb mt12">
          <span>Ya la he conseguido</span>
          <Interruptor on={hecha} onCambio={setHecha} etiqueta="Meta conseguida" />
        </div>
      )}

      <button className="btn mt16" onClick={() => void guardar()}>{meta ? 'Guardar' : 'Crear meta'}</button>
      {meta && <button className="btn bad sm mt8" onClick={() => void borrar()}><Ico n="trash" />Borrar meta</button>}
    </Hoja>
  )
}
