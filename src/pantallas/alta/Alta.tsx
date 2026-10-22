// ALT · Alta de usuario (primera vez). Pocos pasos y pocas preguntas: lo que no se sabe contestar
// sin saber de gimnasio se queda con un valor por defecto y se cambia después en Perfil.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { db } from '../../datos/db'
import { gimnasioNuevo, guardarAjustes, guardarPerfil, perfilPorDefecto } from '../../datos/repos'
import { importar } from '../../datos/copias'
import type { Dia, Gimnasio, Medicion, Perfil, Rutina, Sexo, Zona } from '../../datos/tipos'
import { catalogoCargado } from '../../catalogo/catalogo'
import { TODAS_LAS_CLAVES } from '../../catalogo/clasificacion'
import { generarRutina } from '../../dominio/generador'
import { estadoSemana } from '../../dominio/semana'
import { DIAS, DIAS_ABREV, DIAS_CORTOS, MESES, deISO, diaSemana, edad, formatoHora, horaActual, hoyISO, minutosDe, sumarDias } from '../../dominio/fechas'
import { elegirArchivo } from '../../plataforma'
import { cx, Elegir, Ico, Interruptor, Stepper, LARGO } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { guardarLetra, letraGuardada, type Letra } from '../../ui/tema'
import { CatalogoMaterial, ejerciciosDisponibles, PesosGimnasio } from '../rutina/CatalogoMaterial'
// Los minutos de cada día salen del mismo cálculo que usa Mi plan, para que digan lo mismo.
import { minutos } from '../rutina/comun'
import { propio } from '../../dominio/claves'
import { idioma, t, tc, tk, tn } from '../../i18n'
import { nombreEntreno } from '../../dominio/nombres'
import { tr } from '../../i18n/jsx'

// Pasos del alta (antes eran 10: «Tu cuerpo hoy» va dentro de «Sobre ti» y «Comida y actividad»
// salió del alta; sus datos tienen valores por defecto y se cambian en Perfil).
const PASO = { bienvenida: 1, sobreTi: 2, objetivo: 3, entrenar: 4, horarios: 5, salud: 6, gimnasio: 7, lista: 8 } as const
const TOTAL = 8

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const numero = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null }
/** «a», «a y b», «a, b y c». */
const enLista = (xs: string[]) => xs.length < 2 ? xs.join('') : xs.length > 2 ? tc('3+', '{lista} y {ultimo}', { lista: xs.slice(0, -1).join(', '), ultimo: xs[xs.length - 1]! }) : t('{lista} y {ultimo}', { lista: xs[0]!, ultimo: xs[1]! })
/** «Lun», «Dl», «Mon» (sin el punto del catalán: en un botón pequeño sobra). */
const diaTres = (d: number) => mayuscula(DIAS_ABREV[d]!).replace(/\.$/, '')
// Los nombres de las zonas, marcados con tk(): se traducen al pintarlos.
const ZONA_TXT: Record<string, string> = { brazos: tk('brazos'), pecho: tk('pecho'), espalda: tk('espalda'), hombros: tk('hombros'), piernas: tk('piernas'), gluteo: tk('glúteo'), abdomen: tk('abdomen') }

type Datos = { nacimiento: string; sexo: Sexo | null; altura: string; peso: string }
const PERIMETROS = [['cintura', tk('Cintura')], ['cuello', tk('Cuello')], ['cadera', tk('Cadera')], ['pecho', tk('Pecho')], ['brazo', tk('Brazo relajado')], ['brazoContraido', tk('Brazo contraído')], ['muslo', tk('Muslo')]] as const
type ClaveMedida = typeof PERIMETROS[number][0]
type Medidas = Record<ClaveMedida, string>
type Fallo = { msg: string; campos: string[] }
const SIN_MEDIDAS: Medidas = { cintura: '', cuello: '', cadera: '', pecho: '', brazo: '', brazoContraido: '', muslo: '' }
/** Las medidas escritas, solo las que tienen un número válido. */
const medidasEnCm = (m: Medidas) => Object.fromEntries(PERIMETROS.map(([k]) => [k, numero(m[k]) ?? 0]).filter(([, v]) => (v as number) > 0)) as Partial<Record<ClaveMedida, number>>
const firma = (peso: number | null, m: Medidas) => JSON.stringify([peso, medidasEnCm(m)])
// En inglés, con punto decimal.
const aTexto = (n: number | null | undefined) => (n != null && n > 0 ? (idioma() === 'en' ? String(n) : String(n).replace('.', ',')) : '')

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
  const alt = numero(d.altura)
  if (alt == null || alt < 120 || alt > 230) return { msg: t('La altura va en centímetros: por ejemplo, 170.'), campos: ['altura'] }
  const kg = numero(d.peso)
  if (kg == null || kg < 30 || kg > 250) return { msg: t('El peso va en kilos: por ejemplo, 72.'), campos: ['peso'] }
  return null
}

/** Hora a la que irse del gimnasio: la de entrenar + los minutos + 15 de margen. */
function limites(hora: string, minutos: number): Perfil['horaLimite'] {
  const m = (minutosDe(hora) + minutos + 15) % 1440
  const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return { coche: hhmm, andando: hhmm }
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

/**
 * Fecha de nacimiento con tres desplegables (día, mes, año). El calendario del móvil empieza en el año
 * actual y llegar a 1960 cuesta muchos toques; así se elige el año de una lista.
 */
function FechaFacil({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  const [a0, m0, d0] = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split('-').map(Number) : [0, 0, 0]
  const [dia, setDia] = useState(d0 || 0)
  const [mes, setMes] = useState(m0 || 0)
  const [anio, setAnio] = useState(a0 || 0)
  const ultimo = new Date().getFullYear() - 10
  const anios = Array.from({ length: ultimo - 1920 + 1 }, (_, i) => ultimo - i)
  const poner = (d: number, m: number, a: number) => {
    setDia(d); setMes(m); setAnio(a)
    if (d && m && a) {
      const dd = Math.min(d, new Date(a, m, 0).getDate())
      onCambio(`${a}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`)
    } else onCambio('')
  }
  return (
    <div className="fecha-facil" role="group" aria-label={t('Fecha de nacimiento')}>
      <select className="inp" aria-label={t('Día de nacimiento')} value={dia || ''} onChange={e => poner(Number(e.target.value), mes, anio)}>
        <option value="">{t('Día')}</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select className="inp" aria-label={t('Mes de nacimiento')} value={mes || ''} onChange={e => poner(dia, Number(e.target.value), anio)}>
        <option value="">{t('Mes')}</option>
        {MESES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select className="inp" aria-label={t('Año de nacimiento')} value={anio || ''} onChange={e => poner(dia, mes, Number(e.target.value))}>
        <option value="">{t('Año')}</option>
        {anios.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  )
}

export function Alta() {
  const aviso = useAviso()
  const [paso, setPaso] = useState<number>(PASO.bienvenida)
  // Días y hora empiezan vacíos (antes venía el horario de otra persona: martes, jueves y viernes a las 5:30
  // con el sábado de extra, y quien no lee lo aceptaba). El nivel empieza en «Empiezo»: si alguien no lo
  // cambia, lo peor que pasa es una rutina más suave, que la semana de prueba ajusta igualmente.
  const [p, setP] = useState<Perfil>(() => ({ ...perfilPorDefecto(), nivel: 'empiezo', superseries: true, diasFijos: [], diasOpcionales: [], horaEntreno: '' }))
  // Fecha, sexo, altura y peso empiezan vacíos: antes venían rellenos (01/01/2000, hombre, 175 cm, 75 kg)
  // y quien no lee los dejaba falsos, con lo que salían mal las calorías y la proteína.
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
    const gimnasio: Gimnasio = { ...gym, material: gymModo === 'completo' ? [...TODAS_LAS_CLAVES] : gym.material, creado: new Date().toISOString() }
    const gymId = await db.gimnasios.add(gimnasio)
    const perfil = await guardarPerfil({ ...p, nacimiento: datos.nacimiento, sexo: datos.sexo ?? p.sexo, alturaCm: Math.round(numero(datos.altura) ?? p.alturaCm), altaCompleta: false })
    const peso = numero(datos.peso)
    const yaHay = (await db.mediciones.count()) > 0
    // Con datos importados solo se apunta una medición nueva si se ha cambiado algo.
    if (!yaHay || firma(peso, medidas) !== importado) {
      const per = medidasEnCm(medidas)
      const m: Medicion = { fecha: `${hoy}T${new Date().toTimeString().slice(0, 5)}`, origen: 'manual' }
      if (peso != null) m.pesoKg = peso
      if (Object.keys(per).length) m.perimetros = per
      await db.mediciones.add(m)
    }
    const c = catalogoCargado()
    const rutina = generarRutina({ perfil, gimnasio: { ...gimnasio, id: gymId }, marcas: new Map(), ejercicios: c?.ejercicios ?? [], calibracion: true })
    await db.rutinas.add(rutina)
    await guardarAjustes({ gimnasioActivo: gymId, inicio: hoy })
    const dias = [...rutina.dias].sort((a, b) => Number(a.opcional) - Number(b.opcional) || (a.dia ?? 9) - (b.dia ?? 9))
    const fijos = rutina.dias.filter(d => !d.opcional)
    const extra = rutina.dias.find(d => d.opcional)
    const diasTxt = tn(fijos.length, '{n} día', '{n} días')
    const minMax = fijos.length ? Math.max(...fijos.map(d => minutos(d))) : 0
    setResumen({
      tipo: rutina.estructura.split(' · ')[0] ?? rutina.estructura,
      // «3 días + sábado si puedes · ~55 min»: antes ponía «3 días» con 4 filas debajo y un rango de minutos
      // que no cuadraba con Mi plan. Los minutos, igual que la «Duración» de Mi plan (el día más largo).
      estructura: extra
        ? t('{dias} + {dia} si puedes · ~{min} min', { dias: diasTxt, dia: extra.dia != null ? DIAS[extra.dia] : t('otro'), min: minMax })
        : t('{dias} · ~{min} min', { dias: diasTxt, min: minMax }),
      // El nombre del día de la semana en vez de las letras A, B, C, que no dicen nada.
      dias: dias.map(d => {
        const nombre = d.dia != null ? mayuscula(DIAS[d.dia]) : t('Cuando puedas')
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
          {/* Lo secundario en una fila: con tres botones apilados el pie tapaba el texto en móviles bajos. */}
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
          <Elegir opciones={Object.keys(ZONA_TXT).map(z => ({ v: z, t: mayuscula(t(ZONA_TXT[z]!)) }))} valor={p.zonasPrioridad} onCambio={z => cambia({ zonasPrioridad: p.zonasPrioridad.includes(z) ? p.zonasPrioridad.filter(x => x !== z) : [...p.zonasPrioridad, z] })} />
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
          {p.nivel !== 'empiezo' && <Fila t={t('Dos seguidos')} d={t('Dos ejercicios uno detrás de otro, sin descanso entre ellos: acabas antes')} on={p.superseries} c={v => cambia({ superseries: v })} />}
          <Fila t={t('Abdominales')} d={t('Unos minutos al final de cada sesión')} on={p.core} c={v => cambia({ core: v })} />
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

function Fila({ t: titulo, d, on, c }: { t: string; d?: string; on: boolean; c: (v: boolean) => void }) {
  return <div className="it"><span className="tx"><b>{titulo}</b>{d && <small>{d}</small>}</span><Interruptor on={on} onCambio={c} etiqueta={titulo} /></div>
}

function Medir() {
  return (
    <div className="measure mt16">
      <svg className="sil-fig" viewBox="0 0 120 240" aria-hidden="true">
        <circle className="sil" cx="60" cy="24" r="15" />
        <path className="sil" d="M53 38h14v10H53zM36 50Q60 44 84 50L100 58Q106 62 106 72L110 126Q110 134 104 134L98 80 92 82 92 138 90 226Q90 232 84 232H76L64 150H56L44 232H36Q30 232 30 226L28 138 28 82 22 80 16 134Q10 134 10 126L14 72Q14 62 20 58Z" />
        <line className="msr" x1="34" y1="44" x2="86" y2="44" />
        <line className="msr go" x1="20" y1="108" x2="100" y2="108" />
        <circle className="msr-dot" cx="60" cy="108" r="3" />
      </svg>
      <div className="measure-key">
        <p><span className="kdot blue" /><b>{t('Cuello')}</b><small>{t('Justo bajo la nuez')}</small></p>
        <p><span className="kdot go" /><b>{t('Cintura')}</b><small>{t('A la altura del ombligo, sin apretar')}</small></p>
        <p className="muted small mt8">{t('Cinta métrica horizontal, después de soltar el aire.')}</p>
      </div>
    </div>
  )
}

/** Horas del desplegable del alta, cada media hora, agrupadas por parte del día. */
// Los nombres se traducen al pintarlos, con contexto: «Mañana» y «Tarde» también son tiempo («mañana», «llegas tarde»).
const FRANJAS_HORA: [string, number, number][] = [['Mañana', 5, 12], ['Mediodía', 12, 16], ['Tarde', 16, 20], ['Noche', 20, 23]]
const nombreFranja = (f: string) => (f === 'Mañana' ? tc('parte del día', 'Mañana') : f === 'Mediodía' ? tc('parte del día', 'Mediodía') : f === 'Tarde' ? tc('parte del día', 'Tarde') : tc('parte del día', 'Noche'))
const horasDe = (desde: number, hasta: number) => Array.from({ length: (hasta - desde) * 2 }, (_, i) => `${String(desde + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/**
 * Horario sencillo del alta: días (un toque = entrenas o no), un día extra opcional aparte,
 * la hora y los minutos. Días y hora empiezan sin marcar y hay que elegirlos; el día extra empieza en «Ninguno».
 * Coche/andando, hora de salida, hora de acostarse y «si pierdes una sesión»
 * se quedan con su valor por defecto y se cambian en Perfil → Horario (que usa `Horarios`, abajo).
 */
function HorariosAlta({ p, cambia, faltaDias, faltaHora }: { p: Perfil; cambia: (c: Partial<Perfil>) => void; faltaDias: boolean; faltaHora: boolean }) {
  const conmutar = (d: Dia) => {
    if (p.diasFijos.includes(d)) cambia({ diasFijos: p.diasFijos.filter(x => x !== d) })
    else cambia({ diasFijos: [...p.diasFijos, d].sort((a, b) => a - b), diasOpcionales: p.diasOpcionales.filter(x => x !== d) })
  }
  const extra = p.diasOpcionales.find(d => !p.diasFijos.includes(d)) ?? null
  const libres = ([0, 1, 2, 3, 4, 5, 6] as Dia[]).filter(d => !p.diasFijos.includes(d))
  const n = p.diasFijos.length
  // Una copia importada puede traer una hora que no está en la lista (7:15): se añade para que se vea.
  const enLaLista = FRANJAS_HORA.some(([, a, b]) => horasDe(a, b).includes(p.horaEntreno))
  // La hora de irse del gimnasio (para la versión corta) se recalcula con la hora y los minutos elegidos.
  const ponHora = (h: string) => { if (h) cambia({ horaEntreno: h, horaLimite: limites(h, p.minutosNormal) }) }
  const ponMinutos = (v: number) => cambia({ minutosNormal: v, minutosCorta: Math.min(perfilPorDefecto().minutosCorta, v - 5), ...(p.horaEntreno ? { horaLimite: limites(p.horaEntreno, v) } : {}) })
  return (
    <>
      <div className={cx(faltaDias && 'alta-falta')}>
        <p className="lbl fl mt16">{t('¿Qué días vas a entrenar?')}</p>
        <div className="days alta-dias">
          {DIAS.map((nombre, i) => (
            <button key={i} className={cx('chip day', p.diasFijos.includes(i as Dia) && 'fix on')} aria-pressed={p.diasFijos.includes(i as Dia)} aria-label={nombre} onClick={() => conmutar(i as Dia)}>{diaTres(i)}</button>
          ))}
        </div>
        <p className="small muted mt8">{n === 0 ? t('Toca los días que vas a ir. Con 3 días a la semana va muy bien.')
          : n === 3 ? t('Toca un día para marcarlo o quitarlo · {n} días a la semana (va muy bien)', { n })
            : tn(n, 'Toca un día para marcarlo o quitarlo · 1 día a la semana', 'Toca un día para marcarlo o quitarlo · {n} días a la semana')}</p>
      </div>
      {/* El día extra solo aparece con algún día elegido: dos filas de días iguales desde el principio confundían. */}
      {n > 0 && (
        <>
          <p className="lbl fl mt20">{t('Día extra si puedes')} <span className="hint">{t('(opcional)')}</span></p>
          <div className="chips">
            <button className={cx('chip', extra == null && 'on')} aria-pressed={extra == null} onClick={() => cambia({ diasOpcionales: [] })}>{t('Ninguno')}</button>
            {libres.map(d => <button key={d} className={cx('chip', extra === d && 'on')} aria-pressed={extra === d} aria-label={t('Extra el {dia}', { dia: DIAS[d] })} onClick={() => cambia({ diasOpcionales: [d] })}>{diaTres(d)}</button>)}
          </div>
          <p className="small muted mt4">{t('Una sesión corta de brazos y hombros, solo si te apetece.')}</p>
        </>
      )}
      <div className={cx('alta-hora', faltaHora && 'alta-falta')}>
        <p className="lbl fl mt16">{t('¿A qué hora entrenas?')}</p>
        {/* Un solo control: antes había botones de hora y además un campo con la misma hora escrita de otra forma. */}
        <select className="inp" aria-label={t('Hora de entreno')} data-vacio={p.horaEntreno ? undefined : ''} value={p.horaEntreno} onChange={e => ponHora(e.target.value)}>
          <option value="" disabled>{t('Elige la hora')}</option>
          {!enLaLista && p.horaEntreno && <option value={p.horaEntreno}>{formatoHora(p.horaEntreno)}</option>}
          {FRANJAS_HORA.map(([franja, a, b]) => (
            <optgroup key={franja} label={nombreFranja(franja)}>{horasDe(a, b).map(h => <option key={h} value={h}>{formatoHora(h)}</option>)}</optgroup>
          ))}
        </select>
      </div>
      <p className="lbl fl mt16">{t('¿Cuánto tiempo tienes cada día?')}</p>
      <Stepper valor={p.minutosNormal} paso={5} min={30} max={120} sufijo="min" etiqueta={t('Minutos por sesión')} onCambio={ponMinutos} />
      <p className="small muted mt4">{t('Si un día vas con prisa, la app te ofrece una versión más corta.')}</p>
      <p className="note plain mt16"><Ico n="gear" /><span>{tr('Coche o andando, hora de salir y hora de acostarte: en <b>Perfil → Horario</b>.', { b: x => <b>{x}</b> })}</span></p>
    </>
  )
}

/** Horario completo (Perfil → Horario). */
export function Horarios({ p, cambia }: { p: Perfil; cambia: (c: Partial<Perfil>) => void }) {
  const ciclo = (d: Dia) => {
    if (p.diasFijos.includes(d)) cambia({ diasFijos: p.diasFijos.filter(x => x !== d), diasOpcionales: [...p.diasOpcionales, d].sort() })
    else if (p.diasOpcionales.includes(d)) cambia({ diasOpcionales: p.diasOpcionales.filter(x => x !== d) })
    else cambia({ diasFijos: [...p.diasFijos, d].sort() })
  }
  const horas = ['05:00', '05:30', '06:00', '07:00', '18:00', '19:00']
  return (
    <>
      <div className="days mt16">
        {DIAS_CORTOS.map((d, i) => (
          <button key={i} className={cx('chip day', p.diasFijos.includes(i as Dia) && 'fix on', p.diasOpcionales.includes(i as Dia) && 'opt on')} onClick={() => ciclo(i as Dia)}>{d}</button>
        ))}
      </div>
      <p className="legend mt8"><span><i className="lg fix" />{t('Fijo')}</span><span><i className="lg opt" />{t('Opcional')}</span><span><i className="lg" />{t('Libre')}</span></p>
      <p className="lbl fl mt16">{t('¿A qué hora entrenas?')}</p>
      <div className="chips">
        {horas.map(h => <button key={h} className={cx('chip', p.horaEntreno === h && 'on')} onClick={() => cambia({ horaEntreno: h })}>{h.replace(/^0/, '')}</button>)}
        {/* Al borrar un campo de hora llega '' y luego salía «NaN:undefined»: solo se guarda una hora válida. */}
        <input className="inp" type="time" value={p.horaEntreno} onChange={e => { if (e.target.value) cambia({ horaEntreno: e.target.value }) }} style={{ width: 120, minHeight: 40 }} aria-label={t('Otra hora')} />
      </div>
      <p className="lbl fl mt16">{t('¿Cómo vas al gimnasio?')}</p>
      <div className="chips eq">
        <button className={cx('chip big', p.transporte === 'coche' && 'on')} onClick={() => cambia({ transporte: 'coche' })}><Ico n="car" />{t('Coche')}</button>
        <button className={cx('chip big', p.transporte === 'andando' && 'on')} onClick={() => cambia({ transporte: 'andando' })}><Ico n="person-simple-walk" />{t('Andando')}</button>
      </div>
      <div className="grid2 mt16">
        <label><span className="lbl fl">{t('Me voy (coche)')}</span><input className="inp" type="time" value={p.horaLimite.coche} onChange={e => { if (e.target.value) cambia({ horaLimite: { ...p.horaLimite, coche: e.target.value } }) }} /></label>
        <label><span className="lbl fl">{t('Me voy (andando)')}</span><input className="inp" type="time" value={p.horaLimite.andando} onChange={e => { if (e.target.value) cambia({ horaLimite: { ...p.horaLimite, andando: e.target.value } }) }} /></label>
      </div>
      <p className="lbl fl mt16">{t('Tiempo por sesión')}</p>
      <div className="grid2">
        <div><span className="lbl fl">{t('Normal')}</span><Stepper className="sm" valor={p.minutosNormal} paso={5} min={30} max={120} sufijo="min" onCambio={v => cambia({ minutosNormal: v, minutosCorta: Math.min(p.minutosCorta, v - 5) })} /></div>
        <div><span className="lbl fl">{t('Corto')}</span><Stepper className="sm" valor={p.minutosCorta} paso={5} min={20} max={p.minutosNormal - 5} sufijo="min" onCambio={v => cambia({ minutosCorta: v })} /></div>
      </div>
      <div className="list mt16">
        <div className="it">
          <span className="ico"><Ico n="moon" /></span>
          <span className="tx"><b>{t('Hora de acostarte')}</b><small>{t('Para avisarte 1 h antes')}</small></span>
          <input className="inp" type="time" value={p.horaDormir} onChange={e => { if (e.target.value) cambia({ horaDormir: e.target.value }) }} style={{ width: 110 }} aria-label={t('Hora de acostarte')} />
        </div>
        <div className="it"><span className="ico"><Ico n="calendar-x" /></span><span className="tx"><b>{t('Si pierdes una sesión')}</b><small>{p.sesionPerdida === 'sabado' ? t('Te propongo pasarla al día opcional') : t('Se salta sin más')}</small></span><Interruptor on={p.sesionPerdida === 'sabado'} onCambio={v => cambia({ sesionPerdida: v ? 'sabado' : 'saltar' })} etiqueta={t('Recolocar sesión perdida')} /></div>
      </div>
    </>
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
