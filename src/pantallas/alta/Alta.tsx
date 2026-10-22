// ALT · Alta de usuario (primera vez). Pocos pasos y pocas preguntas: lo que no se sabe contestar
// sin saber de gimnasio se queda con un valor por defecto y se cambia después en Perfil.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { db } from '../../datos/db'
import { gimnasioNuevo, guardarPerfil, perfilPorDefecto } from '../../datos/repos'
import { completarAlta } from '../../datos/acciones/alta'
import { importar } from '../../datos/copias'
import type { Gimnasio, Medicion, Perfil, Rutina, Sexo, Zona } from '../../datos/tipos'
import { TODAS_LAS_CLAVES } from '../../catalogo/clasificacion'
import { estadoSemana } from '../../dominio/semana'
import { DIAS, deISO, diaSemana, edad, formatoHora, horaActual, hoyISO, minutosDe, sumarDias } from '../../dominio/fechas'
import { capital, decimal, leerNumero } from '../../dominio/formato'
import { elegirArchivo } from '../../plataforma'
import { cx, Elegir, FilaInterruptor, Ico, LARGO } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { guardarLetra, letraGuardada, type Letra } from '../../ui/tema'
import { CatalogoMaterial, ejerciciosDisponibles, PesosGimnasio } from '../rutina/CatalogoMaterial'
import { HorariosAlta } from '../perfil/Horarios'
import { FechaFacil } from './FechaFacil'
import { Medir } from './Medir'
// Los minutos de cada día salen del mismo cálculo que usa Mi plan, para que digan lo mismo.
import { minutos } from '../rutina/comun'
import { propio } from '../../dominio/claves'
import { t, tc, tk, tn } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'
import { tr } from '../../i18n/jsx'

// Pasos del alta. Comida y actividad no se preguntan: tienen valores por defecto y se cambian en Perfil.
const PASO = { bienvenida: 1, sobreTi: 2, objetivo: 3, entrenar: 4, horarios: 5, salud: 6, gimnasio: 7, lista: 8 } as const
const TOTAL = 8

/** «a», «a y b», «a, b y c». */
const enLista = (xs: string[]) => xs.length < 2 ? xs.join('') : xs.length > 2 ? tc('3+', '{lista} y {ultimo}', { lista: xs.slice(0, -1).join(', '), ultimo: xs[xs.length - 1]! }) : t('{lista} y {ultimo}', { lista: xs[0]!, ultimo: xs[1]! })
// Los nombres de las zonas, marcados con tk(): se traducen al pintarlos.
const ZONA_TXT: Record<string, string> = { brazos: tk('brazos'), pecho: tk('pecho'), espalda: tk('espalda'), hombros: tk('hombros'), piernas: tk('piernas'), gluteo: tk('glúteo'), abdomen: tk('abdomen') }

type Datos = { nacimiento: string; sexo: Sexo | null; altura: string; peso: string }
const PERIMETROS = [['cintura', tk('Cintura')], ['cuello', tk('Cuello')], ['cadera', tk('Cadera')], ['pecho', tk('Pecho')], ['brazo', tk('Brazo relajado')], ['brazoContraido', tk('Brazo contraído')], ['muslo', tk('Muslo')]] as const
type ClaveMedida = typeof PERIMETROS[number][0]
type Medidas = Record<ClaveMedida, string>
type Fallo = { msg: string; campos: string[] }
const SIN_MEDIDAS: Medidas = { cintura: '', cuello: '', cadera: '', pecho: '', brazo: '', brazoContraido: '', muslo: '' }
/** Las medidas escritas, solo las que tienen un número válido. */
const medidasEnCm = (m: Medidas) => Object.fromEntries(PERIMETROS.map(([k]) => [k, leerNumero(m[k]) ?? 0]).filter(([, v]) => (v as number) > 0)) as Partial<Record<ClaveMedida, number>>
const firma = (peso: number | null, m: Medidas) => JSON.stringify([peso, medidasEnCm(m)])
const aTexto = (n: number | null | undefined) => (n != null && n > 0 ? decimal(n) : '')


/** Qué falta o está mal en «Sobre ti». Null si se puede seguir. */
function falloSobreTi(d: Datos): Fallo | null {
  const falta: string[] = [], campos: string[] = []
  if (!d.nacimiento) { falta.push(t('tu fecha de nacimiento')); campos.push('nacimiento') }
  if (!d.sexo) { falta.push(t('si eres hombre o mujer')); campos.push('sexo') }
  if (!d.altura.trim()) { falta.push(t('tu altura')); campos.push('altura') }
  if (!d.peso.trim()) { falta.push(t('tu peso')); campos.push('peso') }
  if (falta.length) return { msg: t('Para seguir falta {lista}.', { lista: enLista(falta) }), campos }
  const años = /^\d{4}-\d{2}-\d{2}$/.test(d.nacimiento) ? edad(d.nacimiento) : NaN
  if (!(años >= 12 && años <= 100)) return { msg: t('Revisa la fecha de nacimiento.'), campos: ['nacimiento'] }
  const alt = leerNumero(d.altura)
  if (alt == null || alt < 120 || alt > 230) return { msg: t('La altura va en centímetros: por ejemplo, 170.'), campos: ['altura'] }
  const kg = leerNumero(d.peso)
  if (kg == null || kg < 30 || kg > 250) return { msg: t('El peso va en kilos: por ejemplo, 72.'), campos: ['peso'] }
  return null
}

/** «Tu primer entreno: martes a las 5:30 · Cuerpo completo A», con la rutina recién hecha. */
function primerEntreno(r: Omit<Rutina, 'id'>, hora: string, hoy: string): { cuando: string; nombre: string } | null {
  const rut = r as Rutina
  const sem = [...estadoSemana(rut, [], hoy), ...estadoSemana(rut, [], sumarDias(hoy, 7))]
  const d = sem.find(x => x.fecha >= hoy && x.estado === 'plan' && x.dia)
  if (!d?.dia) return null
  const h = formatoHora(hora)
  const cuando = d.fecha === hoy
    ? (minutosDe(horaActual()) <= minutosDe(hora) ? t('hoy a las {hora}', { hora: h }) : t('hoy mismo, cuando puedas'))
    : d.fecha === sumarDias(hoy, 1) ? t('mañana a las {hora}', { hora: h }) : t('{dia} a las {hora}', { dia: DIAS[diaSemana(deISO(d.fecha))]!, hora: h })
  return { cuando, nombre: nombreEntreno(d.dia) }
}

export function Alta() {
  const aviso = useAviso()
  const [paso, setPaso] = useState<number>(PASO.bienvenida)
  // Días y hora empiezan vacíos: un horario ya puesto se acepta sin leerlo. El nivel empieza en «Empiezo»: si alguien
  // no lo cambia, lo peor que pasa es una rutina más suave, que la semana de prueba ajusta igualmente.
  const [p, setP] = useState<Perfil>(() => ({ ...perfilPorDefecto(), nivel: 'empiezo', superseries: true, diasFijos: [], diasOpcionales: [], horaEntreno: '' }))
  // Fecha, sexo, altura y peso empiezan vacíos: rellenos, quien no lee los deja falsos y salen mal las calorías y la proteína.
  const [datos, setDatos] = useState<Datos>({ nacimiento: '', sexo: null, altura: '', peso: '' })
  const [medidas, setMedidas] = useState<Medidas>(SIN_MEDIDAS)
  const [importado, setImportado] = useState<string | null>(null)
  const [gym, setGym] = useState<Gimnasio>(gimnasioNuevo())
  const [gymModo, setGymModo] = useState<'completo' | 'yo'>('completo')
  const [intento, setIntento] = useState(false)
  const [letra, setLetra] = useState<Letra>(letraGuardada())
  const [resumen, setResumen] = useState<{ tipo: string; estructura: string; dias: { t: string; d: string }[]; primero: { cuando: string; nombre: string } | null } | null>(null)
  const cambia = (c: Partial<Perfil>) => setP(x => ({ ...x, ...c }))
  const dato = (c: Partial<Datos>) => setDatos(x => ({ ...x, ...c }))
  const material = gymModo === 'completo' ? [...TODAS_LAS_CLAVES] : gym.material

  // La letra grande se nota al momento: el marco del alta no escucha el evento, así que se le cambia aquí.
  useEffect(() => { document.querySelector('.app')?.setAttribute('data-letra', letra) }, [letra])
  const cambiarLetra = () => {
    const l: Letra = letra === 'grande' ? 'normal' : 'grande'
    guardarLetra(l)
    setLetra(l)
    window.dispatchEvent(new Event('jf-letra'))
  }

  const fallo = (n: number): Fallo | null => {
    if (n === PASO.sobreTi) return falloSobreTi(datos)
    if (n === PASO.horarios) {
      const falta: string[] = [], campos: string[] = []
      if (!p.diasFijos.length) { falta.push(t('qué días vas a entrenar')); campos.push('dias') }
      if (!p.horaEntreno) { falta.push(t('a qué hora')); campos.push('hora') }
      return falta.length ? { msg: t('Para seguir falta elegir {lista}.', { lista: enLista(falta) }), campos } : null
    }
    return null
  }
  const ir = (n: number) => { setIntento(false); setPaso(n); window.scrollTo?.(0, 0) }
  const sig = () => { if (fallo(paso)) { setIntento(true); return } ir(Math.min(TOTAL, paso + 1)) }
  const atras = () => ir(Math.max(1, paso - 1))

  const importarCopia = async () => {
    const f = await elegirArchivo()
    if (!f) return
    try {
      const tipo = await importar(f.bytes)
      if (tipo === 'copia') { aviso(t('Copia restaurada')); return } // la app se recarga sola al ver el perfil
      const guardado = await db.perfil.get('yo')
      if (guardado) {
        setP({ ...guardado, altaCompleta: false })
        dato({ nacimiento: guardado.nacimiento, sexo: guardado.sexo, altura: String(guardado.alturaCm) })
      }
      const ult = (await db.mediciones.toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
      const peso = ult.find(m => m.pesoKg != null)?.pesoKg ?? null
      const per = ult.find(m => m.perimetros?.cintura)?.perimetros
      const m = Object.fromEntries(PERIMETROS.map(([k]) => [k, aTexto(per?.[k])])) as Medidas
      setMedidas(m)
      if (peso != null) dato({ peso: aTexto(peso) })
      setImportado(firma(peso, m))
      aviso(t('Datos importados: revísalos y sigue'))
      ir(PASO.sobreTi)
    } catch (e) {
      aviso(t('No se pudo importar: {error}', { error: String((e as Error).message ?? e) }))
    }
  }

  const terminar = useCallback(async () => {
    const hoy = hoyISO()
    const peso = leerNumero(datos.peso)
    const per = medidasEnCm(medidas)
    const medicion: Medicion = { fecha: `${hoy}T${new Date().toTimeString().slice(0, 5)}`, origen: 'manual' }
    if (peso != null) medicion.pesoKg = peso
    if (Object.keys(per).length) medicion.perimetros = per
    const { perfil, rutina } = await completarAlta({
      gimnasio: { ...gym, material: gymModo === 'completo' ? [...TODAS_LAS_CLAVES] : gym.material },
      perfil: { ...p, nacimiento: datos.nacimiento, sexo: datos.sexo ?? p.sexo, alturaCm: Math.round(leerNumero(datos.altura) ?? p.alturaCm), altaCompleta: false },
      medicion, medicionCambiada: firma(peso, medidas) !== importado, hoy,
    })
    const dias = [...rutina.dias].sort((a, b) => Number(a.opcional) - Number(b.opcional) || (a.dia ?? 9) - (b.dia ?? 9))
    const fijos = rutina.dias.filter(d => !d.opcional)
    const extra = rutina.dias.find(d => d.opcional)
    const diasTxt = tn(fijos.length, '{n} día', '{n} días')
    const minMax = fijos.length ? Math.max(...fijos.map(d => minutos(d))) : 0
    setResumen({
      tipo: rutina.estructura.split(' · ')[0] ?? rutina.estructura,
      // «3 días + sábado si puedes · ~55 min». Los minutos, igual que la «Duración» de Mi plan (el día más largo).
      estructura: extra
        ? t('{dias} + {dia} si puedes · ~{min} min', { dias: diasTxt, dia: extra.dia != null ? DIAS[extra.dia] : t('otro'), min: minMax })
        : t('{dias} · ~{min} min', { dias: diasTxt, min: minMax }),
      // El nombre del día de la semana en vez de las letras A, B, C, que no dicen nada.
      dias: dias.map(d => {
        const nombre = d.dia != null ? capital(DIAS[d.dia]) : t('Cuando puedas')
        return {
          t: d.opcional ? t('{dia} (si puedes)', { dia: nombre }) : nombre,
          d: t('{n} ejercicios · ~{min} min', { n: d.bloques.length, min: minutos(d) }),
        }
      }),
      primero: primerEntreno(rutina, perfil.horaEntreno, hoy),
    })
  }, [gym, gymModo, p, datos, medidas, importado])

  const fin = async () => { await guardarPerfil({ altaCompleta: true }) }

  if (paso === PASO.bienvenida) return (
    <section className="screen" data-full="">
      <div className="alt">
        <div className="alt-hero">
          <div className="brand"><img className="brand-img" src={`${import.meta.env.BASE_URL}iconos/icono-192.png`} alt="" width={48} height={48} /><span>JOWYFIT</span></div>
          <h1 className="alt-h">{t('Tu fuerza y tu comida, en una ficha clara.')}</h1>
          <p className="alt-p">{t('Ves qué toca hoy y con qué peso, apuntas cada serie en segundos y el domingo sabes si vas bien.')}</p>
        </div>
        <div className="alt-body">
          <div className="spec-box"><div className="spec flat">
            <p><span><Ico n="arrows-clockwise" className="blue" /> {t('Rutina')}</span><b>{t('automática')}</b></p>
            <p><span><Ico n="timer" className="blue" /> {t('Apuntar una serie')}</span><b>&lt; 5 s</b></p>
            <p><span><Ico n="wifi-slash" className="blue" /> {t('Internet')}</span><b>{t('no hace falta')}</b></p>
            <p><span><Ico n="user-circle" className="blue" /> {t('Cuentas')}</span><b>{t('ninguna')}</b></p>
          </div></div>
          <p className="note plain mt16"><Ico n="lock-simple" /><span>{tr('<b>Tus datos se quedan en este móvil.</b> Nada se sube a ningún sitio.', { b: x => <b>{x}</b> })}</span></p>
        </div>
        <div className="alt-foot col">
          <button className="btn xl" onClick={sig}>{t('Empezar')} <Ico n="arrow-right" b /></button>
          {/* Lo secundario en una fila: con tres botones apilados el pie tapa el texto en móviles bajos. */}
          <div className="alta-fila">
            <button className={cx('btn gry sm alta-letra', letra === 'grande' && 'on')} aria-pressed={letra === 'grande'} onClick={cambiarLetra}>
              <span className="alta-aa" aria-hidden="true">Aa</span>{t('Letra grande')}{letra === 'grande' && <Ico n="check" b />}
            </button>
            <button className="btn ln sm" onClick={importarCopia}>{t('Tengo una copia')}</button>
          </div>
        </div>
      </div>
    </section>
  )

  if (paso === PASO.lista) return (
    <Paso n={TOTAL} titulo={resumen ? t('Tu rutina está lista') : t('Creando tu rutina…')} sinAtras pie={resumen ? <button className="btn xl" onClick={fin}>{t('Ir a Inicio')} <Ico n="arrow-right" b /></button> : null}>
      {!resumen ? <Generando onListo={terminar} p={p} /> : (
        <>
          {resumen.primero && (
            <p className="note ok mt16 alta-primero"><Ico n="calendar-check" /><span>{tr('Tu primer entreno: {cuando} · {nombre}', { cuando: <b>{resumen.primero.cuando}</b>, nombre: resumen.primero.nombre })}</span></p>
          )}
          <div className="card ready mt12" style={{ animation: 'none' }}>
            <div className="ready-h">
              <span className="tag ok"><Ico n="check" b />{tc('rutina', 'Lista')}</span>
              <h2>{resumen.tipo}</h2>
              <p className="big-sum">{resumen.estructura}</p>
            </div>
            <div className="pd"><div className="spec flat">
              {resumen.dias.map(d => <p key={d.t}><span>{d.t}</span><b>{d.d}</b></p>)}
            </div></div>
          </div>
          <p className="note mt12"><Ico n="info" /><span>{tr('<b>Semana de prueba:</b> la primera semana vas con pesos cómodos mientras vemos por dónde empiezas.', { b: x => <b>{x}</b> })}</span></p>
        </>
      )}
    </Paso>
  )

  const f = intento ? fallo(paso) : null
  const mal = (campo: string) => !!f?.campos.includes(campo) && 'alta-falta'
  const contenido: Record<number, { t: string; d?: string; c: ReactNode }> = {
    [PASO.sobreTi]: { t: t('Sobre ti'), d: t('Para calcular cuánto comer. Lo puedes cambiar luego en Perfil.'), c: (
      <>
        <div className="fields mt16">
          <label className={cx(mal('nacimiento'))}><span className="lbl fl">{t('Fecha de nacimiento')}</span>
            <FechaFacil valor={datos.nacimiento} onCambio={v => dato({ nacimiento: v })} />
          </label>
          <div className={cx(mal('sexo'))}><span className="lbl fl">{t('Sexo')} <span className="hint">{t('(para calcular las calorías)')}</span></span>
            <Elegir eq opciones={[{ v: 'hombre' as Sexo, t: t('Hombre') }, { v: 'mujer' as Sexo, t: t('Mujer') }]} valor={(datos.sexo ?? '') as Sexo} onCambio={v => dato({ sexo: v })} />
          </div>
          <div className="grid2">
            <label className={cx(mal('altura'))}><span className="lbl fl">{t('Altura')}</span>
              <span className="alta-unid"><input className="inp" inputMode="numeric" aria-label={t('Altura en centímetros')} placeholder={t('Ej.: 170')} value={datos.altura} onChange={e => dato({ altura: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })} /><span>cm</span></span>
            </label>
            <label className={cx(mal('peso'))}><span className="lbl fl">{t('Peso')}</span>
              <span className="alta-unid"><input className="inp" inputMode="decimal" aria-label={t('Peso en kilos')} placeholder={t('Ej.: 72')} value={datos.peso} onChange={e => dato({ peso: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) })} /><span>kg</span></span>
            </label>
          </div>
          <div><span className="lbl fl">{t('Tu día a día')}</span>
            <Elegir eq opciones={[{ v: 'sentado', t: t('Sentado') }, { v: 'depie', t: t('De pie') }, { v: 'fisico', t: t('Físico') }]} valor={p.trabajo} onCambio={v => cambia({ trabajo: v })} />
            <p className="small muted mt4">{t('Sentado: oficina, coche · De pie: tienda, bar · Físico: obra, almacén')}</p>
          </div>
          <label><span className="lbl fl">{t('Nombre')} <span className="hint">{t('(opcional)')}</span></span><input className="inp" aria-label={t('Nombre')} maxLength={LARGO.nombre} value={p.nombre} onChange={e => cambia({ nombre: e.target.value })} placeholder={t('¿Cómo te llamamos?')} /></label>
        </div>
        <details className="fold mt16">
          <summary><Ico n="ruler" className="blue" />{t('Más medidas')} <span className="tag">{t('opcional')}</span><Ico n="caret-down" /></summary>
          <div className="in">
            <p className="small muted">{t('Si tienes una cinta métrica a mano. Si no, déjalo: lo puedes apuntar otro día en Progreso.')}</p>
            <Medir />
            <div className="grid2 mt12">
              {PERIMETROS.map(([k, nombre]) => (
                <label key={k}><span className="lbl fl">{t(nombre)}</span>
                  <span className="alta-unid"><input className="inp" inputMode="decimal" aria-label={t('{medida} en centímetros', { medida: t(nombre) })} value={medidas[k]} onChange={e => { const v = e.target.value.replace(/[^\d.,]/g, '').slice(0, 5); setMedidas(c => ({ ...c, [k]: v })) }} /><span>cm</span></span>
                </label>
              ))}
            </div>
          </div>
        </details>
      </>) },
    [PASO.objetivo]: { t: t('Tu objetivo'), d: t('Lo puedes cambiar cuando quieras.'), c: (
      <>
        <div className="opts mt16">
          {([['recomposicion', t('Perder grasa y ganar músculo'), t('El peso es lo de menos: menos barriga y más fuerza.'), t('Recomendado')], ['perder', t('Perder peso'), t('Déficit algo mayor y más proteína.'), ''], ['fuerza', t('Ganar fuerza'), t('Comer lo justo para subir de peso en los ejercicios.'), '']] as const).map(([v, nombre, d, tag]) => (
            <button key={v} className={cx('opt-c', p.objetivo === v && 'on')} aria-pressed={p.objetivo === v} onClick={() => cambia({ objetivo: v })}>
              <span className="rad" /><span className="tx"><b>{nombre} {tag && <span className="tag ok">{tag}</span>}</b><small>{d}</small></span>
            </button>
          ))}
        </div>
        <div className="alta-sep">
          <p className="lbl fl">{t('Zonas a priorizar')} <span className="hint">{t('(opcional)')}</span></p>
          <p className="small muted" style={{ marginBottom: 8 }}>{t('Si no eliges ninguna, se trabaja todo el cuerpo por igual.')}</p>
          <Elegir opciones={Object.keys(ZONA_TXT).map(z => ({ v: z, t: capital(t(ZONA_TXT[z]!)) }))} valor={p.zonasPrioridad} onCambio={z => cambia({ zonasPrioridad: p.zonasPrioridad.includes(z) ? p.zonasPrioridad.filter(x => x !== z) : [...p.zonasPrioridad, z] })} />
        </div>
      </>) },
    [PASO.entrenar]: { t: t('Cómo te gusta entrenar'), c: (
      <div className="fields mt16">
        {/* Con «Empiezo» no se pregunta por «Dos seguidos» (superseries): se dejan puestos. */}
        <div><span className="lbl fl">{t('Tu nivel')}</span><Elegir opciones={[{ v: 'empiezo', t: t('Empiezo') }, { v: 'vuelvo', t: t('Vuelvo tras un parón') }, { v: 'intermedio', t: t('Intermedio') }, { v: 'avanzado', t: t('Avanzado') }]} valor={p.nivel} onCambio={v => cambia(v === 'empiezo' ? { nivel: v, superseries: true } : { nivel: v })} />
          <p className="small muted mt4">{t('Empiezo: nunca o casi nunca he ido al gimnasio. Si dudas, deja «Empiezo».')}</p>
        </div>
        <div><span className="lbl fl">{t('Prefieres')}</span><Elegir eq opciones={[{ v: 'maquinas', t: t('Máquinas') }, { v: 'libre', t: t('Peso libre') }, { v: 'mezcla', t: t('Mezcla') }]} valor={p.preferencia} onCambio={v => cambia({ preferencia: v })} />
          <p className="small muted mt4">{t('Peso libre: barras y mancuernas. Si dudas, deja «Mezcla».')}</p>
        </div>
        <div className="list">
          {p.nivel !== 'empiezo' && <FilaInterruptor titulo={t('Dos seguidos')} d={t('Dos ejercicios uno detrás de otro, sin descanso entre ellos: acabas antes')} on={p.superseries} onCambio={v => cambia({ superseries: v })} />}
          <FilaInterruptor titulo={t('Abdominales')} d={t('Unos minutos al final de cada sesión')} on={p.core} onCambio={v => cambia({ core: v })} />
        </div>
      </div>) },
    [PASO.horarios]: { t: t('Tus horarios'), d: t('Qué días y a qué hora vas al gimnasio.'), c: <HorariosAlta p={p} cambia={cambia} faltaDias={!!mal('dias')} faltaHora={!!mal('hora')} /> },
    [PASO.salud]: { t: t('Salud'), d: t('Para no proponerte ejercicios que no te convienen. Si no te molesta nada, sigue.'), c: (
      <div className="fields mt16">
        <div><span className="lbl fl">{t('¿Te molesta alguna zona?')} <span className="hint">{t('(opcional)')}</span></span><Elegir opciones={[{ v: 'rodilla', t: t('Rodilla') }, { v: 'lumbar', t: t('Lumbar (espalda baja)') }, { v: 'hombro', t: t('Hombro') }, { v: 'muneca', t: t('Muñeca') }, { v: 'codo', t: t('Codo') }] as { v: Zona; t: string }[]} valor={p.zonasSensibles} onCambio={z => cambia({ zonasSensibles: p.zonasSensibles.includes(z) ? p.zonasSensibles.filter(x => x !== z) : [...p.zonasSensibles, z] })} /></div>
        <label><span className="lbl fl">{t('Lesiones o molestias')} <span className="hint">{t('(opcional)')}</span></span><textarea className="inp" maxLength={LARGO.nota} value={p.lesiones} onChange={e => cambia({ lesiones: e.target.value })} placeholder={t('Por ejemplo: me duele la rodilla al bajar escaleras')} /></label>
        <p className="note plain"><Ico n="first-aid" /><span>{tr('Si un ejercicio te duele, márcalo con «Me duele» en su ficha y no volverá a salir. <b>Esto no es consejo médico.</b>', { b: x => <b>{x}</b> })}</span></p>
      </div>) },
    [PASO.gimnasio]: { t: t('Tu gimnasio'), d: t('¿Qué tiene tu gimnasio? Si no lo sabes, deja «Gimnasio completo».'), c: (
      <>
        <div className="opts mt16">
          <button className={cx('opt-c', gymModo === 'completo' && 'on')} aria-pressed={gymModo === 'completo'} onClick={() => setGymModo('completo')}>
            <span className="rad" /><span className="tx"><b>{t('Gimnasio completo (lo normal)')}</b><small>{t('Máquinas, poleas, barras y mancuernas.')}</small></span>
          </button>
          <button className={cx('opt-c', gymModo === 'yo' && 'on')} aria-pressed={gymModo === 'yo'} onClick={() => setGymModo('yo')}>
            <span className="rad" /><span className="tx"><b>{t('Lo marco yo')}</b><small>{t('Eliges en una lista lo que tiene.')}</small></span>
          </button>
        </div>
        {gymModo === 'yo' && (
          <>
            <label className="mt16" style={{ display: 'block' }}><span className="lbl fl">{t('Nombre del gimnasio')}</span><input className="inp" aria-label={t('Nombre del gimnasio')} maxLength={LARGO.nombre} value={gym.nombre} onChange={e => setGym(g => ({ ...g, nombre: e.target.value }))} /></label>
            <div className="sec"><div className="sec-h"><h2>{t('Máquinas y material')}</h2><span className="lbl">{t('{n} marcadas', { n: gym.material.length })}</span></div>
              <CatalogoMaterial material={gym.material} onCambio={m => setGym(g => ({ ...g, material: m }))} />
            </div>
            <details className="fold mt12"><summary><Ico n="barbell" className="blue" />{t('Mancuernas y discos')} <Ico n="caret-down" /></summary><div className="in">
              <PesosGimnasio g={gym} onCambio={c => setGym(g => ({ ...g, ...c }))} />
            </div></details>
          </>
        )}
        <p className="result card mt16" style={{ boxShadow: 'none' }}><Ico n="check-circle" b className="okc" />{tr('Con este gimnasio tienes {n} ejercicios disponibles', { n: <b className="mono">{ejerciciosDisponibles(material)}</b> })}</p>
        <p className="small muted mt8">{t('Si cambias de gimnasio, lo añades en Rutina → Gimnasios.')}</p>
      </>) },
  }
  const c = contenido[paso]!
  return (
    <Paso n={paso} titulo={c.t} desc={c.d} onAtras={atras} aviso={f?.msg} pie={
      <>
        <button className="btn gry auto" onClick={atras} aria-label={t('Atrás')}><Ico n="caret-left" b /></button>
        <button className="btn" onClick={sig}>{t('Siguiente')} <Ico n="arrow-right" b /></button>
      </>
    }>{c.c}</Paso>
  )
}

function Paso({ n, titulo, desc, children, pie, onAtras, sinAtras, aviso }: { n: number; titulo: string; desc?: string; children: ReactNode; pie: ReactNode; onAtras?: () => void; sinAtras?: boolean; aviso?: string | null }) {
  return (
    <section className="screen" data-full="" key={n}>
      <div className="alt">
        <div className="alt-top">
          {sinAtras || !onAtras ? <span className="skip-gap" /> : <button className="ib" onClick={onAtras} aria-label={t('Atrás')}><Ico n="caret-left" /></button>}
          <div className="prog" aria-label={t('Paso {n} de {total}', { n: n - 1, total: TOTAL - 1 })}>{Array.from({ length: TOTAL - 1 }, (_, i) => <i key={i} className={cx(i < n - 1 && 'on')} />)}</div>
          <span className="skip-gap" />
        </div>
        <div className="alt-body">
          <p className="lbl">{t('Paso {n} de {total}', { n: n - 1, total: TOTAL - 1 })}</p>
          <h1 className="alt-h2">{titulo}</h1>
          {desc && <p className="muted mt4">{desc}</p>}
          {children}
        </div>
        {pie && (
          <div className="alt-foot alta-pie">
            {/* Lo que falta para seguir, justo encima de «Siguiente» (es donde se mira al pulsarlo). */}
            {aviso && <p className="note warn alta-aviso" role="alert"><Ico n="warning-circle" /><span>{aviso}</span></p>}
            <div className="alta-botones">{pie}</div>
          </div>
        )}
      </div>
    </section>
  )
}

function Generando({ onListo, p }: { onListo: () => Promise<void>; p: Perfil }) {
  useEffect(() => {
    const espera = setTimeout(() => void onListo(), 1400)
    return () => clearTimeout(espera)
  }, [onListo])
  const fijos = p.diasFijos.length
  return (
    <>
      <div className="bar thick go mt12 build"><i /></div>
      <ul className="steps-done mt12">
        <li><Ico n="check" b />{p.diasOpcionales.some(d => !p.diasFijos.includes(d))
          ? tn(fijos, '{n} día a la semana y uno extra si puedes', '{n} días a la semana y uno extra si puedes')
          : tn(fijos, '{n} día a la semana', '{n} días a la semana')}</li>
        <li><Ico n="check" b />{t('Sesiones de {n} min como mucho', { n: p.minutosNormal })}</li>
        <li><Ico n="check" b />{p.preferencia === 'maquinas' ? t('Máquinas y poleas por delante') : p.preferencia === 'libre' ? t('Peso libre por delante') : t('Máquinas y peso libre')}</li>
        <li><Ico n="check" b />{p.zonasPrioridad.length ? t('Más trabajo en: {zonas}', { zonas: p.zonasPrioridad.map(z => { const nombre = propio(ZONA_TXT, z); return nombre ? t(nombre) : z }).join(', ') }) : t('Todo el cuerpo por igual')}</li>
      </ul>
    </>
  )
}
