// PER-02 a PER-11 · Secciones del perfil. Cada cambio se guarda al momento.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { guardarPerfil } from '../../../datos/repos'
import type { Bascula, Dia, Medicion, Perfil, Zona } from '../../../datos/tipos'
import { FACTOR_ACTIVIDAD, kg, num } from '../../../dominio/calculos'
import { DIAS_CORTOS, edad, fechaCorta } from '../../../dominio/fechas'
import { cx, Cab, Chip, Elegir, Ico, Interruptor, Pantalla, Stepper, Vacio } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { usePerfilCargado } from '../../datos'
import { reprogramarNotificaciones } from '../../servicios'
import { Horarios } from '../alta/Alta'
import { CARDIO_TXT, NIVEL_TXT, OBJETIVO_TXT, PREFERENCIA_TXT, REFERENCIAS, REPS_TXT, SECCIONES, TRABAJO_TXT, ZONAS_PRIORIDAD, ZONAS_SENSIBLES, type ClaveSeccion } from './textos'

type Props = { p: Perfil; guardar: (c: Partial<Perfil>) => void }

/** Secciones cuyos cambios afectan a la rutina: al final se ofrece regenerarla. */
const AFECTAN_RUTINA: ClaveSeccion[] = ['horario', 'objetivos', 'preferencias', 'salud']

const alternar = <T,>(lista: T[], v: T): T[] => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v])

export function SeccionPerfil({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const cargado = usePerfilCargado()
  const s = String(ruta.d?.s ?? '') as ClaveSeccion
  const sec = SECCIONES.find(x => x.s === s)
  const guardar = (c: Partial<Perfil>) => { void guardarPerfil(c) }
  // Hasta tener el perfil guardado no se enseñan los campos: con el de por defecto, un toque rápido
  // guardaba listas (días, zonas, suplementos…) calculadas sobre valores que no son los tuyos.
  if (sec && !cargado) return <Pantalla><Cab atras crumb="Perfil" titulo={sec.t} /><div className="cargando">Cargando…</div></Pantalla>
  const p = cargado!

  if (!sec) return (
    <Pantalla>
      <Cab atras crumb="Perfil" titulo="Perfil" />
      <div className="pg"><div className="sec"><Vacio icono="question" titulo="Esta sección no existe" accion="Volver al perfil" onAccion={nav.atras} /></div></div>
    </Pantalla>
  )

  const regenerar = () => {
    // Si venimos de «Generar rutina», volvemos a ella en lugar de abrir otra.
    const pila = nav.estado.pilas[nav.estado.pestana]
    if (pila[pila.length - 2]?.p === 'rut-gen') nav.atras()
    else nav.ir('rut-gen', undefined, 'rut')
  }

  const cuerpo: Record<ClaveSeccion, ReactNode> = {
    datos: <Datos p={p} guardar={guardar} />,
    cuerpo: <Cuerpo />,
    objetivos: <Objetivos p={p} guardar={guardar} />,
    salud: <Salud p={p} guardar={guardar} />,
    experiencia: <Experiencia p={p} guardar={guardar} />,
    preferencias: <Preferencias p={p} guardar={guardar} />,
    horario: <Horarios p={p} cambia={c => { void guardarPerfil(c).then(() => reprogramarNotificaciones()) }} />,
    alimentacion: <Alimentacion p={p} guardar={guardar} />,
    vida: <Vida p={p} guardar={guardar} />,
    seguimiento: <Seguimiento p={p} guardar={c => { void guardarPerfil(c).then(() => reprogramarNotificaciones()) }} />,
  }

  return (
    <Pantalla>
      <Cab atras crumb="Perfil" titulo={sec.t} sub={s === 'cuerpo' ? undefined : 'Los cambios se guardan solos'} />
      <div className="pg">
        {cuerpo[s]}
        {AFECTAN_RUTINA.includes(s) && (
          <div className="sec">
            <p className="note plain"><Ico n="arrows-clockwise" /><span>Si cambias días, tiempo o gimnasio, puedes <b>regenerar la rutina</b> para que se ajuste.</span></p>
            <button className="btn ln sm mt8" onClick={regenerar}><Ico n="magic-wand" b />Regenerar la rutina</button>
          </div>
        )}
      </div>
    </Pantalla>
  )
}

// ---------- piezas comunes ----------

/** Texto que se guarda al salir del campo (no en cada tecla, para no perder el cursor). */
function Texto({ valor, onGuardar, placeholder, area, etiqueta }: { valor: string; onGuardar: (v: string) => void; placeholder?: string; area?: boolean; etiqueta?: string }) {
  const [local, setLocal] = useState(valor)
  const enfocado = useRef(false)
  useEffect(() => { if (!enfocado.current) setLocal(valor) }, [valor])
  const comun = {
    className: 'inp',
    value: local,
    placeholder,
    'aria-label': etiqueta,
    onFocus: () => { enfocado.current = true },
    onBlur: () => { enfocado.current = false; if (local !== valor) onGuardar(local) },
  }
  return area
    ? <textarea {...comun} onChange={e => setLocal(e.target.value)} />
    : <input {...comun} onChange={e => setLocal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
}

function Grupo({ t, children, ayuda }: { t: ReactNode; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <div>
      <span className="lbl fl">{t}</span>
      {children}
      {ayuda && <small className="small muted mt4" style={{ display: 'block' }}>{ayuda}</small>}
    </div>
  )
}

function Fila({ t, d, on, c, ico }: { t: string; d?: string; on: boolean; c: (v: boolean) => void; ico?: string }) {
  return (
    <div className="it">
      {ico && <span className="ico"><Ico n={ico} /></span>}
      <span className="tx"><b>{t}</b>{d && <small>{d}</small>}</span>
      <Interruptor on={on} onCambio={c} etiqueta={t} />
    </div>
  )
}

// ---------- PER-02 · Datos personales ----------
function Datos({ p, guardar }: Props) {
  return (
    <div className="fields mt16">
      <label><span className="lbl fl">Nombre</span><Texto valor={p.nombre} onGuardar={v => guardar({ nombre: v.trim() })} placeholder="¿Cómo te llamamos?" /></label>
      <label>
        <span className="lbl fl">Fecha de nacimiento</span>
        <input className="inp" type="date" value={p.nacimiento} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) guardar({ nacimiento: e.target.value }) }} />
        <small className="small muted mt4" style={{ display: 'block' }}>Tienes {edad(p.nacimiento)} años</small>
      </label>
      <Grupo t="Sexo" ayuda="Solo se usa en las fórmulas de gasto y grasa.">
        <Elegir eq opciones={[{ v: 'hombre', t: 'Hombre' }, { v: 'mujer', t: 'Mujer' }]} valor={p.sexo} onCambio={v => guardar({ sexo: v })} />
      </Grupo>
      <Grupo t="Altura">
        <Stepper valor={p.alturaCm} paso={1} min={120} max={230} sufijo="cm" etiqueta="Altura" onCambio={v => guardar({ alturaCm: v })} />
      </Grupo>
    </div>
  )
}

// ---------- PER-03 · Cuerpo y composición ----------
const PERIMETROS: [keyof NonNullable<Medicion['perimetros']>, string][] = [
  ['cintura', 'Cintura'], ['cuello', 'Cuello'], ['cadera', 'Cadera'], ['pecho', 'Pecho'], ['brazo', 'Brazo relajado'], ['brazoContraido', 'Brazo contraído'], ['muslo', 'Muslo'],
]
const BASCULA: [keyof Bascula, string, string][] = [
  ['grasaPct', '% de grasa', '%'], ['masaGrasaKg', 'Masa grasa', 'kg'], ['masaLibreKg', 'Masa libre de grasa', 'kg'], ['musculoKg', 'Masa muscular', 'kg'],
  ['musculoEsqKg', 'Músculo esquelético', 'kg'], ['aguaPct', 'Agua', '%'], ['proteinaPct', 'Proteína', '%'], ['oseaKg', 'Masa ósea', 'kg'],
  ['visceral', 'Grasa visceral', ''], ['subcutaneaPct', 'Grasa subcutánea', '%'], ['basalKcal', 'Basal (báscula)', 'kcal'], ['edadCorporal', 'Edad corporal', 'años'],
]

function Cuerpo() {
  const nav = useNav()
  const datos = useLiveQuery(async () => {
    const todas = await db.mediciones.orderBy('fecha').reverse().toArray()
    const peso = todas.find(m => m.pesoKg != null)
    const per = PERIMETROS.map(([k, t]) => {
      const m = todas.find(x => x.perimetros?.[k] != null)
      return { k, t, v: m?.perimetros?.[k] ?? null, fecha: m?.fecha ?? null }
    }).filter(x => x.v != null)
    const bascula = todas.find(m => m.bascula && Object.keys(m.bascula).length > 0)
    return { hay: todas.length > 0, peso, per, bascula }
  }, [])
  const registrar = () => nav.ir('pro-reg', undefined, 'pro')
  const evolucion = () => nav.ir('pro-cuerpo', undefined, 'pro')

  if (!datos) return null
  if (!datos.hay) return (
    <div className="sec"><Vacio icono="ruler" titulo="Aún no hay medidas" texto="Pésate o mide tu cintura y cuello para ver aquí tu punto de partida." accion={<><Ico n="plus" b />Registrar medidas</>} onAccion={registrar} /></div>
  )
  const b = datos.bascula?.bascula
  return (
    <>
      <div className="sec">
        <div className="sec-h"><h2>Peso y medidas</h2><span className="lbl">lo último</span></div>
        <div className="spec-box"><div className="spec">
          <p><span>Peso</span><b>{datos.peso ? `${kg(datos.peso.pesoKg)} kg · ${fechaCorta(datos.peso.fecha)}` : '—'}</b></p>
          {datos.per.map(x => <p key={x.k}><span>{x.t}</span><b>{num(x.v)} cm{x.fecha ? ` · ${fechaCorta(x.fecha)}` : ''}</b></p>)}
        </div></div>
      </div>
      {b && (
        <div className="sec">
          <div className="sec-h"><h2>Báscula</h2><span className="lbl">{fechaCorta(datos.bascula!.fecha)}</span></div>
          <div className="spec-box"><div className="spec">
            {BASCULA.filter(([k]) => b[k] != null).map(([k, t, u]) => <p key={k}><span>{t}</span><b>{num(b[k])}{u ? ` ${u}` : ''}</b></p>)}
          </div></div>
        </div>
      )}
      <div className="sec">
        <div className="btns">
          <button className="btn sm" onClick={registrar}><Ico n="plus" b />Registrar</button>
          <button className="btn gry sm" onClick={evolucion}><Ico n="chart-line-up" b />Evolución</button>
        </div>
      </div>
    </>
  )
}

// ---------- PER-04 · Objetivos ----------
const SUGERENCIAS = ['Quitar barriga', 'Press de banca', 'Dominadas', 'Fuerza general', 'Abdominales', 'Cardio']

function Objetivos({ p, guardar }: Props) {
  const nav = useNav()
  const [nueva, setNueva] = useState('')
  const metas = useLiveQuery(() => db.metas.toArray(), []) ?? []
  const activas = metas.filter(m => !m.hecha).length
  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= p.prioridades.length) return
    const l = [...p.prioridades]
    ;[l[i], l[j]] = [l[j]!, l[i]!]
    guardar({ prioridades: l })
  }
  const anadir = (t: string) => {
    const v = t.trim()
    if (!v || p.prioridades.some(x => x.toLowerCase() === v.toLowerCase())) return
    guardar({ prioridades: [...p.prioridades, v] })
    setNueva('')
  }
  const sugerencias = SUGERENCIAS.filter(x => !p.prioridades.some(y => y.toLowerCase() === x.toLowerCase()))
  return (
    <>
      <span className="lbl fl mt16">Tipo</span>
      <div className="opts">
        {([['recomposicion', 'Perder grasa y ganar músculo · recomendado'], ['perder', 'Déficit algo mayor y más proteína'], ['fuerza', 'Comer lo justo para subir los pesos']] as const).map(([v, d]) => (
          <button key={v} className={cx('opt-c', p.objetivo === v && 'on')} aria-pressed={p.objetivo === v} onClick={() => guardar({ objetivo: v })}>
            <span className="rad" /><span className="tx"><b>{OBJETIVO_TXT[v]}</b><small>{d}</small></span>
          </button>
        ))}
      </div>

      <div className="sec">
        <div className="sec-h"><h2>Prioridades</h2><span className="lbl">la 1 es la más importante</span></div>
        {p.prioridades.length > 0 && (
          <div className="list prio">
            {p.prioridades.map((t, i) => (
              <div key={t} className="it">
                <span className="pn">{i + 1}</span>
                <span className="tx"><b>{t}</b></span>
                <button className={cx('ib sm', i === 0 && 'dim')} aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><Ico n="arrow-up" /></button>
                <button className={cx('ib sm', i === p.prioridades.length - 1 && 'dim')} aria-label="Bajar" disabled={i === p.prioridades.length - 1} onClick={() => mover(i, 1)}><Ico n="arrow-down" /></button>
                <button className="ib sm" aria-label={`Quitar ${t}`} onClick={() => guardar({ prioridades: p.prioridades.filter(x => x !== t) })}><Ico n="x" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="row mt8">
          <input className="inp grow" value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anadir(nueva) }} placeholder="Añadir otra prioridad" aria-label="Nueva prioridad" />
          <button className="btn sm auto" onClick={() => anadir(nueva)} disabled={!nueva.trim()}><Ico n="plus" b />Añadir</button>
        </div>
        {sugerencias.length > 0 && <div className="chips mt8">{sugerencias.map(x => <Chip key={x} onClick={() => anadir(x)}><Ico n="plus" />{x}</Chip>)}</div>}
      </div>

      <div className="sec">
        <div className="sec-h"><h2>Zonas a priorizar</h2></div>
        <Elegir opciones={ZONAS_PRIORIDAD} valor={p.zonasPrioridad} onCambio={z => guardar({ zonasPrioridad: alternar(p.zonasPrioridad, z) })} />
      </div>

      <div className="sec">
        <div className="list">
          <button className="it" onClick={() => nav.ir('pro-obj', undefined, 'pro')}>
            <span className="ico"><Ico n="flag-checkered" /></span>
            <span className="tx"><b>Metas con fecha</b><small>{activas ? `${activas} en marcha` : 'Cintura, un peso en banca, dominadas…'}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
      </div>
    </>
  )
}

// ---------- PER-05 · Salud ----------
function Salud({ p, guardar }: Props) {
  const nav = useNav()
  const evitados = useLiveQuery(() => db.marcas.filter(m => !!m.odiado || !!m.duele).count(), []) ?? 0
  return (
    <>
      <div className="fields mt16">
        <Grupo t="Zonas sensibles" ayuda="Se evitan los ejercicios que cargan estas zonas.">
          <Elegir opciones={ZONAS_SENSIBLES} valor={p.zonasSensibles} onCambio={(z: Zona) => guardar({ zonasSensibles: alternar(p.zonasSensibles, z) })} />
        </Grupo>
        <label><span className="lbl fl">Lesiones o molestias</span><Texto area valor={p.lesiones} onGuardar={v => guardar({ lesiones: v })} placeholder="Por ejemplo: me molesta el hombro derecho en el press" /></label>
        <label><span className="lbl fl">Condiciones médicas o indicaciones del médico</span><Texto area valor={p.condiciones} onGuardar={v => guardar({ condiciones: v })} placeholder="Opcional" /></label>
      </div>
      <div className="list mt16">
        <button className="it" onClick={() => nav.ir('rut-ej', { filtro: 'evitados' }, 'rut')}>
          <span className="ico"><Ico n="prohibit" /></span>
          <span className="tx"><b>Ejercicios que evitas</b><small>{evitados ? `${evitados} marcado${evitados === 1 ? '' : 's'} como que duele o no gusta` : 'Los que te duelen o no te gustan'}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
      <p className="note plain mt12"><Ico n="first-aid" /><span><b>Esto no es consejo médico.</b> Si tienes una lesión o una condición, consulta a un profesional.</span></p>
    </>
  )
}

// ---------- PER-06 · Experiencia ----------
function Experiencia({ p, guardar }: Props) {
  return (
    <>
      <div className="fields mt16">
        <Grupo t="Tu nivel">
          <Elegir opciones={(Object.keys(NIVEL_TXT) as Perfil['nivel'][]).map(v => ({ v, t: NIVEL_TXT[v] }))} valor={p.nivel} onCambio={v => guardar({ nivel: v })} />
        </Grupo>
      </div>
      <div className="sec">
        <div className="sec-h"><h2>Pesos de referencia</h2><span className="lbl">opcional</span></div>
        <p className="small muted">Lo último que moviste con buena técnica, por ejemplo «40 kg × 8».</p>
        <div className="fields mt8">
          {REFERENCIAS.map(r => (
            <label key={r.k}><span className="lbl fl">{r.t}</span>
              <Texto valor={p.referencias[r.k] ?? ''} placeholder="kg × reps" etiqueta={r.t} onGuardar={v => {
                const refs = { ...p.referencias }
                if (v.trim()) refs[r.k] = v.trim()
                else delete refs[r.k]
                guardar({ referencias: refs })
              }} />
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

// ---------- PER-07 · Preferencias de entreno ----------
function Preferencias({ p, guardar }: Props) {
  return (
    <div className="fields mt16">
      <Grupo t="Prefieres">
        <Elegir eq opciones={(Object.keys(PREFERENCIA_TXT) as Perfil['preferencia'][]).map(v => ({ v, t: v === 'maquinas' ? 'Máquinas' : PREFERENCIA_TXT[v] }))} valor={p.preferencia} onCambio={v => guardar({ preferencia: v })} />
      </Grupo>
      <Grupo t="Repeticiones">
        <Elegir eq opciones={(Object.keys(REPS_TXT) as Perfil['reps'][]).map(v => ({ v, t: REPS_TXT[v] }))} valor={p.reps} onCambio={v => guardar({ reps: v })} />
      </Grupo>
      <div className="list">
        <Fila t="Superseries" d="Dos ejercicios seguidos: ahorran tiempo" on={p.superseries} c={v => guardar({ superseries: v })} />
        <Fila t="Ir al fallo" d="Solo donde es seguro (máquinas)" on={p.alFallo} c={v => guardar({ alFallo: v })} />
        <Fila t="Abdominales y core" d="Al final de las sesiones" on={p.core} c={v => guardar({ core: v })} />
      </div>
      <Grupo t="Cardio">
        <Elegir eq opciones={(Object.keys(CARDIO_TXT) as Perfil['cardio'][]).map(v => ({ v, t: CARDIO_TXT[v] }))} valor={p.cardio} onCambio={v => guardar({ cardio: v })} />
      </Grupo>
      <Grupo t="Objetivo de pasos diarios">
        <Stepper valor={p.pasosObjetivo} paso={500} min={2000} max={20000} etiqueta="Objetivo de pasos" onCambio={v => guardar({ pasosObjetivo: v })} />
      </Grupo>
    </div>
  )
}

// ---------- PER-09 · Alimentación y suplementos ----------
const FRANJAS = [{ v: 'mañana', t: 'Mañana' }, { v: 'mediodía', t: 'Mediodía' }, { v: 'tarde', t: 'Tarde' }, { v: 'noche', t: 'Noche' }]
const SUPLEMENTOS_BASE = ['Creatina', 'Batido de proteína']

function Alimentacion({ p, guardar }: Props) {
  const aviso = useAviso()
  const [otro, setOtro] = useState('')
  const todos = [...SUPLEMENTOS_BASE, ...p.suplementos.filter(s => !SUPLEMENTOS_BASE.includes(s))]
  const anadir = () => {
    const v = otro.trim()
    if (!v) return
    if (!p.suplementos.some(s => s.toLowerCase() === v.toLowerCase())) guardar({ suplementos: [...p.suplementos, v] })
    setOtro('')
    aviso(`${v} añadido`)
  }
  return (
    <div className="fields mt16">
      <Grupo t="Comidas al día">
        <Stepper valor={p.comidasDia} paso={1} min={1} max={8} etiqueta="Comidas al día" onCambio={v => guardar({ comidasDia: v })} />
      </Grupo>
      <Grupo t="Cuándo tienes más hambre">
        <Elegir opciones={FRANJAS} valor={p.franjasHambre} onCambio={f => guardar({ franjasHambre: alternar(p.franjasHambre, f) })} />
      </Grupo>
      <Grupo t="Suplementos que tomas" ayuda="Salen en Comida para marcarlos cada día. Para quitar uno, desmárcalo.">
        <Elegir opciones={todos.map(s => ({ v: s, t: s }))} valor={p.suplementos} onCambio={s => guardar({ suplementos: alternar(p.suplementos, s) })} />
        <div className="row mt8">
          <input className="inp grow" value={otro} onChange={e => setOtro(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anadir() }} placeholder="Otro (p. ej. pre-entreno)" aria-label="Otro suplemento" />
          <button className="btn sm auto" disabled={!otro.trim()} onClick={anadir}><Ico n="plus" b />Añadir</button>
        </div>
      </Grupo>
      <label>
        <span className="lbl fl">Bebidas habituales</span>
        <Texto valor={p.bebidas.join(', ')} placeholder="Energética, refresco zero, café…" onGuardar={v => guardar({ bebidas: v.split(',').map(x => x.trim()).filter(Boolean) })} />
        <small className="small muted mt4" style={{ display: 'block' }}>Separadas por comas. Las de un toque se editan en Comida → Plantillas.</small>
      </label>
    </div>
  )
}

// ---------- PER-10 · Estilo de vida ----------
function Vida({ p, guardar }: Props) {
  const detalle: Record<Perfil['trabajo'], string> = { sentado: 'Oficina, estudiar, conducir', depie: 'Tienda, camarero, profesor', fisico: 'Obra, almacén, reparto a pie' }
  return (
    <>
      <span className="lbl fl mt16">Tu trabajo</span>
      <div className="opts">
        {(Object.keys(TRABAJO_TXT) as Perfil['trabajo'][]).map(v => (
          <button key={v} className={cx('opt-c', p.trabajo === v && 'on')} aria-pressed={p.trabajo === v} onClick={() => guardar({ trabajo: v })}>
            <span className="rad" /><span className="tx"><b>{TRABAJO_TXT[v]}</b><small>{detalle[v]}</small></span>
            <span className="end">×{num(FACTOR_ACTIVIDAD[v], 3)}</span>
          </button>
        ))}
      </div>
      <p className="note plain mt12"><Ico n="info" /><span>Tu gasto diario es tu basal <b>× el factor de actividad</b>. El entreno se suma aparte.</span></p>
    </>
  )
}

// ---------- PER-11 · Seguimiento ----------
function Seguimiento({ p, guardar }: Props) {
  const dia = (d: Dia) => guardar({ diasPesaje: alternar(p.diasPesaje, d).sort((a, b) => a - b) })
  return (
    <div className="fields mt16">
      <Grupo t="Días de pesarte" ayuda="En ayunas y después del baño. Te lo recordamos esos días.">
        <div className="days">
          {DIAS_CORTOS.map((d, i) => <button key={d} className={cx('chip day', p.diasPesaje.includes(i as Dia) && 'on')} aria-pressed={p.diasPesaje.includes(i as Dia)} onClick={() => dia(i as Dia)}>{d}</button>)}
        </div>
      </Grupo>
      <Grupo t="Foto de progreso" ayuda={p.fotosCadaSemanas > 0 ? `Cada ${p.fotosCadaSemanas} semana${p.fotosCadaSemanas === 1 ? '' : 's'}. Pon 0 para no hacer fotos.` : 'Sin fotos de progreso.'}>
        <Stepper valor={p.fotosCadaSemanas} paso={1} min={0} max={8} sufijo="sem" etiqueta="Semanas entre fotos" onCambio={v => guardar({ fotosCadaSemanas: v })} />
      </Grupo>
      <p className="note plain"><Ico n="calendar-check" /><span>La <b>revisión de la semana</b> sale el domingo en Progreso.</span></p>
    </div>
  )
}
