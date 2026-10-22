// PER-02 a PER-11 · Secciones del perfil. Cada cambio se guarda al momento.
import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../datos/db'
import { guardarPerfil } from '../../datos/repos'
import type { Bascula, Dia, Medicion, Perfil, Zona } from '../../datos/tipos'
import { kg, num } from '../../dominio/formato'
import { DIAS_CORTOS, edad, fechaCorta } from '../../dominio/fechas'
import { cx, Cab, Chip, Elegir, FilaInterruptor, Ico, Pantalla, Stepper, TextoGuardado, Vacio, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfilCargado } from '../../datos/hooks'
import { reprogramarNotificaciones } from '../../app/servicios'
import { Horarios } from './Horarios'
import { NIVEL_TXT, OBJETIVO_TXT, PREFERENCIA_TXT, REFERENCIAS, REPS_TXT, SECCIONES, tituloSeccion, TRABAJO_TXT, ZONAS_PRIORIDAD, ZONAS_SENSIBLES, type ClaveSeccion } from './textos'
import { t, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Props = { p: Perfil; guardar: (c: Partial<Perfil>) => void }

/** Secciones cuyos cambios afectan a la rutina: al final se ofrece regenerarla. */
const AFECTAN_RUTINA: ClaveSeccion[] = ['horario', 'objetivos', 'preferencias', 'salud']

const alternar = <T,>(lista: T[], v: T): T[] => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v])

export function SeccionPerfil({ ruta }: { ruta: Ruta<'per-sec'> }) {
  const nav = useNav()
  const cargado = usePerfilCargado()
  const s = ruta.d.s
  const sec = SECCIONES.find(x => x.s === s)
  const guardar = (c: Partial<Perfil>) => { void guardarPerfil(c) }
  // Hasta tener el perfil guardado no se enseñan los campos: con el de por defecto, un toque rápido
  // guardaba listas (días, zonas, suplementos…) calculadas sobre valores que no son los tuyos.
  if (sec && !cargado) return <Pantalla><Cab atras crumb={t('Perfil')} titulo={tituloSeccion(sec)} /><div className="cargando">{t('Cargando…')}</div></Pantalla>
  const p = cargado!

  if (!sec) return (
    <Pantalla>
      <Cab atras crumb={t('Perfil')} titulo={t('Perfil')} />
      <div className="pg"><div className="sec"><Vacio icono="question" titulo={t('Esta sección no existe')} accion={t('Volver al perfil')} onAccion={nav.atras} /></div></div>
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
      <Cab atras crumb={t('Perfil')} titulo={tituloSeccion(sec)} sub={s === 'cuerpo' ? undefined : t('Los cambios se guardan solos')} />
      <div className="pg">
        {cuerpo[s]}
        {AFECTAN_RUTINA.includes(s) && (
          <div className="sec">
            <p className="note plain"><Ico n="arrows-clockwise" /><span>{tr('Tu rutina no cambia hasta que pulses <b>«Regenerar la rutina»</b>.', { b: x => <b>{x}</b> })}</span></p>
            <button className="btn ln sm mt8" onClick={regenerar}><Ico n="magic-wand" b />{t('Regenerar la rutina')}</button>
          </div>
        )}
      </div>
    </Pantalla>
  )
}

/** Texto que se guarda solo (al dejar de escribir, al salir del campo y al cerrar la pantalla). */
function Texto({ valor, onGuardar, placeholder, area, etiqueta, max }: { valor: string; onGuardar: (v: string) => void; placeholder?: string; area?: boolean; etiqueta?: string; max?: number }) {
  return <TextoGuardado valor={valor} onGuardar={v => { if (v !== valor) onGuardar(v) }} placeholder={placeholder} area={area} etiqueta={etiqueta} max={max} />
}

function Grupo({ titulo, children, ayuda }: { titulo: ReactNode; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <div>
      <span className="lbl fl">{titulo}</span>
      {children}
      {ayuda && <small className="small muted mt4" style={{ display: 'block' }}>{ayuda}</small>}
    </div>
  )
}

// PER-02 · Datos personales
function Datos({ p, guardar }: Props) {
  return (
    <div className="fields mt16">
      <label><span className="lbl fl">{t('Nombre')}</span><Texto valor={p.nombre} max={LARGO.nombre} onGuardar={v => guardar({ nombre: v.trim() })} placeholder={t('¿Cómo te llamamos?')} /></label>
      <label>
        <span className="lbl fl">{t('Fecha de nacimiento')}</span>
        <input className="inp" type="date" value={p.nacimiento} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) guardar({ nacimiento: e.target.value }) }} />
        <small className="small muted mt4" style={{ display: 'block' }}>{t('Tienes {n} años', { n: edad(p.nacimiento) })}</small>
      </label>
      <Grupo titulo={t('Sexo')} ayuda={t('Solo se usa en las fórmulas de gasto y grasa.')}>
        <Elegir eq opciones={[{ v: 'hombre', t: t('Hombre') }, { v: 'mujer', t: t('Mujer') }]} valor={p.sexo} onCambio={v => guardar({ sexo: v })} />
      </Grupo>
      <Grupo titulo={t('Altura')}>
        <Stepper valor={p.alturaCm} paso={1} min={120} max={230} sufijo="cm" etiqueta={t('Altura')} onCambio={v => guardar({ alturaCm: v })} />
      </Grupo>
    </div>
  )
}

// PER-03 · Cuerpo y composición
// Nombres con tk(): se traducen al pintarlos (las unidades kg, %, kcal pasan por t() sin cambiar).
const PERIMETROS: [keyof NonNullable<Medicion['perimetros']>, string][] = [
  ['cintura', tk('Cintura')], ['cuello', tk('Cuello')], ['cadera', tk('Cadera')], ['pecho', tk('Pecho')], ['brazo', tk('Brazo relajado')], ['brazoContraido', tk('Brazo contraído')], ['muslo', tk('Muslo')],
]
const BASCULA: [keyof Bascula, string, string][] = [
  ['grasaPct', tk('% de grasa'), '%'], ['masaGrasaKg', tk('Masa grasa'), 'kg'], ['masaLibreKg', tk('Masa libre de grasa'), 'kg'], ['musculoKg', tk('Masa muscular'), 'kg'],
  ['musculoEsqKg', tk('Músculo esquelético'), 'kg'], ['aguaPct', tk('Agua'), '%'], ['proteinaPct', tk('Proteína'), '%'], ['oseaKg', tk('Masa ósea'), 'kg'],
  ['visceral', tk('Grasa visceral'), ''], ['subcutaneaPct', tk('Grasa subcutánea'), '%'], ['basalKcal', tk('Basal (báscula)'), 'kcal'], ['edadCorporal', tk('Edad corporal'), tk('años')],
]

function Cuerpo() {
  const nav = useNav()
  const datos = useLiveQuery(async () => {
    const todas = await db.mediciones.orderBy('fecha').reverse().toArray()
    const peso = todas.find(m => m.pesoKg != null)
    const per = PERIMETROS.map(([k, nombre]) => {
      const m = todas.find(x => x.perimetros?.[k] != null)
      return { k, nombre, v: m?.perimetros?.[k] ?? null, fecha: m?.fecha ?? null }
    }).filter(x => x.v != null)
    const bascula = todas.find(m => m.bascula && Object.keys(m.bascula).length > 0)
    return { hay: todas.length > 0, peso, per, bascula }
  }, [])
  const registrar = () => nav.ir('pro-reg', undefined, 'pro')
  const evolucion = () => nav.ir('pro-cuerpo', undefined, 'pro')

  if (!datos) return null
  if (!datos.hay) return (
    <div className="sec"><Vacio icono="ruler" titulo={t('Aún no hay medidas')} texto={t('Pésate o mide tu cintura y cuello para ver aquí tu punto de partida.')} accion={<><Ico n="plus" b />{t('Registrar medidas')}</>} onAccion={registrar} /></div>
  )
  const b = datos.bascula?.bascula
  return (
    <>
      <div className="sec">
        <div className="sec-h"><h2>{t('Lo último que apuntaste')}</h2></div>
        <div className="spec-box"><div className="spec">
          <p><span>{t('Peso')}</span><b>{datos.peso ? `${kg(datos.peso.pesoKg)} kg · ${fechaCorta(datos.peso.fecha)}` : '—'}</b></p>
          {datos.per.map(x => <p key={x.k}><span>{t(x.nombre)}</span><b>{num(x.v)} cm{x.fecha ? ` · ${fechaCorta(x.fecha)}` : ''}</b></p>)}
        </div></div>
      </div>
      {b && (
        <div className="sec">
          <div className="sec-h"><h2>{t('Báscula')}</h2><span className="lbl">{fechaCorta(datos.bascula!.fecha)}</span></div>
          <div className="spec-box"><div className="spec">
            {BASCULA.filter(([k]) => b[k] != null).map(([k, nombre, u]) => <p key={k}><span>{t(nombre)}</span><b>{num(b[k])}{u ? ` ${t(u)}` : ''}</b></p>)}
          </div></div>
        </div>
      )}
      <div className="sec">
        <div className="btns">
          <button className="btn sm" onClick={registrar}><Ico n="plus" b />{t('Registrar')}</button>
          <button className="btn gry sm" onClick={evolucion}><Ico n="chart-line-up" b />{t('Evolución')}</button>
        </div>
      </div>
    </>
  )
}

// PER-04 · Objetivos
// Se guardan en castellano (como lo que escribe el usuario) y se pintan con t().
const SUGERENCIAS = [tk('Quitar barriga'), tk('Press de banca'), tk('Dominadas'), tk('Fuerza general'), tk('Abdominales'), tk('Cardio')]

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
  const anadir = (texto: string) => {
    const v = texto.trim()
    if (!v || p.prioridades.some(x => x.toLowerCase() === v.toLowerCase())) return
    guardar({ prioridades: [...p.prioridades, v] })
    setNueva('')
  }
  const sugerencias = SUGERENCIAS.filter(x => !p.prioridades.some(y => y.toLowerCase() === x.toLowerCase()))
  return (
    <>
      <span className="lbl fl mt16">{t('Tipo')}</span>
      <div className="opts">
        {([['recomposicion', t('Perder grasa y ganar músculo · recomendado')], ['perder', t('Déficit algo mayor y más proteína')], ['fuerza', t('Comer lo justo para subir los pesos')]] as const).map(([v, d]) => (
          <button key={v} className={cx('opt-c', p.objetivo === v && 'on')} aria-pressed={p.objetivo === v} onClick={() => guardar({ objetivo: v })}>
            <span className="rad" /><span className="tx"><b>{t(OBJETIVO_TXT[v])}</b><small>{d}</small></span>
          </button>
        ))}
      </div>

      <div className="sec">
        <div className="sec-h"><h2>{t('Prioridades')}</h2><span className="lbl">{t('la 1 es la más importante')}</span></div>
        {p.prioridades.length > 0 && (
          <div className="list prio">
            {p.prioridades.map((x, i) => (
              <div key={x} className="it">
                <span className="pn">{i + 1}</span>
                <span className="tx"><b>{t(x)}</b></span>
                <button className={cx('ib sm', i === 0 && 'dim')} aria-label={t('Subir')} disabled={i === 0} onClick={() => mover(i, -1)}><Ico n="arrow-up" /></button>
                <button className={cx('ib sm', i === p.prioridades.length - 1 && 'dim')} aria-label={t('Bajar')} disabled={i === p.prioridades.length - 1} onClick={() => mover(i, 1)}><Ico n="arrow-down" /></button>
                <button className="ib sm" aria-label={t('Quitar {que}', { que: t(x) })} onClick={() => guardar({ prioridades: p.prioridades.filter(y => y !== x) })}><Ico n="x" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="row mt8">
          <input className="inp grow" maxLength={LARGO.nombre} value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anadir(nueva) }} placeholder={t('Añadir otra prioridad')} aria-label={t('Nueva prioridad')} />
          <button className="btn sm auto" onClick={() => anadir(nueva)} disabled={!nueva.trim()}><Ico n="plus" b />{t('Añadir')}</button>
        </div>
        {sugerencias.length > 0 && <div className="chips mt8">{sugerencias.map(x => <Chip key={x} onClick={() => anadir(x)}><Ico n="plus" />{t(x)}</Chip>)}</div>}
      </div>

      <div className="sec">
        <div className="sec-h"><h2>{t('Zonas a priorizar')}</h2></div>
        <Elegir opciones={ZONAS_PRIORIDAD.map(z => ({ v: z.v, t: t(z.t) }))} valor={p.zonasPrioridad} onCambio={z => guardar({ zonasPrioridad: alternar(p.zonasPrioridad, z) })} />
      </div>

      <div className="sec">
        <div className="list">
          <button className="it" onClick={() => nav.ir('pro-obj', undefined, 'pro')}>
            <span className="ico"><Ico n="flag-checkered" /></span>
            <span className="tx"><b>{t('Metas con fecha')}</b><small>{activas ? t('{n} en marcha', { n: activas }) : t('Cintura, un peso en banca, dominadas…')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
      </div>
    </>
  )
}

// PER-05 · Salud
function Salud({ p, guardar }: Props) {
  const nav = useNav()
  const evitados = useLiveQuery(() => db.marcas.filter(m => !!m.odiado || !!m.duele).count(), []) ?? 0
  return (
    <>
      <div className="fields mt16">
        <Grupo titulo={t('Zonas sensibles')} ayuda={t('Se evitan los ejercicios que cargan estas zonas.')}>
          <Elegir opciones={ZONAS_SENSIBLES.map(z => ({ v: z.v, t: t(z.t) }))} valor={p.zonasSensibles} onCambio={(z: Zona) => guardar({ zonasSensibles: alternar(p.zonasSensibles, z) })} />
        </Grupo>
        <label><span className="lbl fl">{t('Lesiones o molestias')}</span><Texto area valor={p.lesiones} onGuardar={v => guardar({ lesiones: v })} placeholder={t('Por ejemplo: me molesta el hombro derecho en el press')} /></label>
        <label><span className="lbl fl">{t('Condiciones médicas o indicaciones del médico')}</span><Texto area valor={p.condiciones} onGuardar={v => guardar({ condiciones: v })} placeholder={t('Opcional')} /></label>
      </div>
      <div className="list mt16">
        <button className="it" onClick={() => nav.ir('rut-ej', { filtro: 'evitados' }, 'rut')}>
          <span className="ico"><Ico n="prohibit" /></span>
          <span className="tx"><b>{t('Ejercicios que evitas')}</b><small>{evitados ? tn(evitados, '{n} marcado como que duele o no gusta', '{n} marcados como que duele o no gusta') : t('Los que te duelen o no te gustan')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
      <p className="note plain mt12"><Ico n="first-aid" /><span>{tr('<b>Esto no es consejo médico.</b> Si tienes una lesión o una condición, consulta a un profesional.', { b: x => <b>{x}</b> })}</span></p>
    </>
  )
}

// PER-06 · Experiencia
function Experiencia({ p, guardar }: Props) {
  return (
    <>
      <div className="fields mt16">
        <Grupo titulo={t('Tu nivel')}>
          <Elegir opciones={(Object.keys(NIVEL_TXT) as Perfil['nivel'][]).map(v => ({ v, t: t(NIVEL_TXT[v]) }))} valor={p.nivel} onCambio={v => guardar({ nivel: v })} />
        </Grupo>
      </div>
      <div className="sec">
        <div className="sec-h"><h2>{t('Pesos de referencia')}</h2><span className="lbl">{t('opcional')}</span></div>
        <p className="small muted">{t('Lo último que moviste con buena técnica, por ejemplo «40 kg × 8».')}</p>
        <div className="fields mt8">
          {REFERENCIAS.map(r => (
            <label key={r.k}><span className="lbl fl">{t(r.t)}</span>
              <Texto valor={p.referencias[r.k] ?? ''} max={LARGO.corto} placeholder={t('kg × reps')} etiqueta={t(r.t)} onGuardar={v => {
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

// PER-07 · Preferencias de entreno
function Preferencias({ p, guardar }: Props) {
  return (
    <div className="fields mt16">
      <Grupo titulo={t('Prefieres')} ayuda={t('Si no lo sabes, deja «Mezcla».')}>
        <Elegir eq opciones={(Object.keys(PREFERENCIA_TXT) as Perfil['preferencia'][]).map(v => ({ v, t: v === 'maquinas' ? t('Máquinas') : t(PREFERENCIA_TXT[v]) }))} valor={p.preferencia} onCambio={v => guardar({ preferencia: v })} />
      </Grupo>
      <Grupo titulo={t('Repeticiones')} ayuda={t('Si no lo sabes, deja «Mezcla».')}>
        <Elegir eq opciones={(Object.keys(REPS_TXT) as Perfil['reps'][]).map(v => ({ v, t: t(REPS_TXT[v]) }))} valor={p.reps} onCambio={v => guardar({ reps: v })} />
      </Grupo>
      <div className="list">
        <FilaInterruptor titulo={t('Dos seguidos')} d={t('Dos ejercicios sin descanso entre ellos: ahorran tiempo')} on={p.superseries} onCambio={v => guardar({ superseries: v })} />
        <FilaInterruptor titulo={t('Abdominales')} d={t('Unos minutos al final de las sesiones')} on={p.core} onCambio={v => guardar({ core: v })} />
      </div>
      <p className="small muted">{t('El objetivo de pasos se cambia tocando «Pasos» en Inicio.')}</p>
    </div>
  )
}

// PER-09 · Alimentación y suplementos
// Son claves (dosis, avisos, Comida): se guardan en castellano y se pintan con t().
const SUPLEMENTOS_BASE: string[] = [tk('Creatina'), tk('Batido de proteína')]

function Alimentacion({ p, guardar }: Props) {
  const aviso = useAviso()
  const [otro, setOtro] = useState('')
  const todos = [...SUPLEMENTOS_BASE, ...p.suplementos.filter(s => !SUPLEMENTOS_BASE.includes(s))]
  const anadir = () => {
    const v = otro.trim()
    if (!v) return
    if (!p.suplementos.some(s => s.toLowerCase() === v.toLowerCase())) guardar({ suplementos: [...p.suplementos, v] })
    setOtro('')
    aviso(t('{nombre} añadido', { nombre: v }))
  }
  return (
    <div className="fields mt16">
      <Grupo titulo={t('Suplementos que tomas')} ayuda={t('Salen en Comida para marcarlos cada día. Para quitar uno, desmárcalo.')}>
        <Elegir opciones={todos.map(s => ({ v: s, t: t(s) }))} valor={p.suplementos} onCambio={s => guardar({ suplementos: alternar(p.suplementos, s) })} />
        <div className="row mt8">
          <input className="inp grow" maxLength={LARGO.nombre} value={otro} onChange={e => setOtro(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anadir() }} placeholder={t('Otro (p. ej. pre-entreno)')} aria-label={t('Otro suplemento')} />
          <button className="btn sm auto" disabled={!otro.trim()} onClick={anadir}><Ico n="plus" b />{t('Añadir')}</button>
        </div>
      </Grupo>
      <p className="small muted">{t('Las comidas y bebidas de un toque se editan en Comida → Mis comidas.')}</p>
    </div>
  )
}

// PER-10 · Estilo de vida
function Vida({ p, guardar }: Props) {
  const detalle: Record<Perfil['trabajo'], string> = { sentado: t('Oficina, estudiar, conducir'), depie: t('Tienda, camarero, profesor'), fisico: t('Obra, almacén, reparto a pie') }
  return (
    <>
      <span className="lbl fl mt16">{t('Tu trabajo')}</span>
      <div className="opts">
        {(Object.keys(TRABAJO_TXT) as Perfil['trabajo'][]).map(v => (
          <button key={v} className={cx('opt-c', p.trabajo === v && 'on')} aria-pressed={p.trabajo === v} onClick={() => guardar({ trabajo: v })}>
            <span className="rad" /><span className="tx"><b>{t(TRABAJO_TXT[v])}</b><small>{detalle[v]}</small></span>
          </button>
        ))}
      </div>
      <p className="note plain mt12"><Ico n="info" /><span>{tr('Sirve para calcular <b>cuánto gastas al día</b> y cuánto comer. El entreno se suma aparte.', { b: x => <b>{x}</b> })}</span></p>
    </>
  )
}

// PER-11 · Seguimiento
function Seguimiento({ p, guardar }: Props) {
  const dia = (d: Dia) => guardar({ diasPesaje: alternar(p.diasPesaje, d).sort((a, b) => a - b) })
  return (
    <div className="fields mt16">
      <Grupo titulo={t('Días de pesarte')} ayuda={t('En ayunas y después del baño. Te lo recordamos esos días.')}>
        <div className="days">
          {DIAS_CORTOS.map((d, i) => <button key={i} className={cx('chip day', p.diasPesaje.includes(i as Dia) && 'on')} aria-pressed={p.diasPesaje.includes(i as Dia)} onClick={() => dia(i as Dia)}>{d}</button>)}
        </div>
      </Grupo>
      <Grupo titulo={t('Foto de progreso')} ayuda={p.fotosCadaSemanas > 0 ? tn(p.fotosCadaSemanas, 'Cada {n} semana. Pon 0 para no hacer fotos.', 'Cada {n} semanas. Pon 0 para no hacer fotos.') : t('Sin fotos de progreso.')}>
        <Stepper valor={p.fotosCadaSemanas} paso={1} min={0} max={8} sufijo={t('sem')} etiqueta={t('Semanas entre fotos')} onCambio={v => guardar({ fotosCadaSemanas: v })} />
      </Grupo>
      <p className="note plain"><Ico n="calendar-check" /><span>{tr('La <b>revisión de la semana</b> sale el domingo en Progreso.', { b: x => <b>{x}</b> })}</span></p>
    </div>
  )
}
