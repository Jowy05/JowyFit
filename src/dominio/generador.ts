// Generador automático de rutina. Lógica pura: recibe perfil, gimnasio, marcas y catálogo.
import type { Ejercicio } from '../catalogo/tipos'
import { ES_LIBRE, ES_MAQUINA, HABITUALES, patron, tipoRegistro, ZONA_EVITAR, ZONA_SEGURA, type Patron } from '../catalogo/clasificacion'
import type { Bloque, Dia, DiaRutina, Gimnasio, MarcaEjercicio, Perfil, Rutina } from '../datos/tipos'
import { DIAS } from './fechas'

type Papel = 'principal' | 'secundario' | 'accesorio' | 'core'
type Hueco = { patron: Patron; papel: Papel; prioridad: number; par?: number }
type Plantilla = { letra: string; nombre: string; huecos: Hueco[] }

const P = (patron: Patron, papel: Papel, prioridad: number, par?: number): Hueco => ({ patron, papel, prioridad, par })

// Pares de superserie: mismo número de «par» dentro del día.
const BRAZOS = (pr = 4): Hueco[] => [P('biceps', 'accesorio', pr, 1), P('triceps', 'accesorio', pr, 1)]
const HOMBROS = (pr = 4): Hueco[] => [P('hombro-lat', 'accesorio', pr, 2), P('hombro-post', 'accesorio', pr, 2)]

export function plantillas(nDias: number): { estructura: string; dias: Plantilla[] } {
  if (nDias <= 1) return { estructura: 'Cuerpo completo · 1 día', dias: [
    { letra: 'A', nombre: 'Cuerpo completo', huecos: [P('rodilla', 'principal', 1), P('empuje-h', 'principal', 1), P('tiron-h', 'principal', 1), P('cadera', 'secundario', 2), P('tiron-v', 'secundario', 2), P('empuje-v', 'secundario', 3), ...BRAZOS(5), P('core', 'core', 5)] },
  ] }
  if (nDias === 2) return { estructura: 'Cuerpo completo · 2 días', dias: [
    { letra: 'A', nombre: 'Cuerpo completo A', huecos: [P('rodilla', 'principal', 1), P('empuje-h', 'principal', 1), P('tiron-v', 'principal', 2), P('cadera', 'secundario', 3), ...BRAZOS(), P('core', 'core', 5)] },
    { letra: 'B', nombre: 'Cuerpo completo B', huecos: [P('cadera', 'principal', 1), P('tiron-h', 'principal', 1), P('empuje-v', 'principal', 2), P('empuje-h', 'secundario', 3), ...HOMBROS(), P('core', 'core', 5)] },
  ] }
  if (nDias === 3) return { estructura: 'Cuerpo completo · 3 días', dias: [
    { letra: 'A', nombre: 'Cuerpo completo A', huecos: [P('rodilla', 'principal', 1), P('empuje-h', 'principal', 1), P('tiron-v', 'secundario', 2), ...BRAZOS(), P('core', 'core', 5)] },
    { letra: 'B', nombre: 'Cuerpo completo B', huecos: [P('cadera', 'principal', 1), P('empuje-h', 'secundario', 2), P('tiron-h', 'principal', 1), P('tiron-v', 'secundario', 3), ...HOMBROS(), P('core', 'core', 5)] },
    { letra: 'C', nombre: 'Cuerpo completo C', huecos: [P('rodilla', 'secundario', 1), P('empuje-h', 'secundario', 2), P('tiron-h', 'secundario', 2), P('empuje-v', 'secundario', 3), ...BRAZOS(), P('core', 'core', 5)] },
  ] }
  if (nDias <= 5) {
    const dias: Plantilla[] = [
      { letra: 'A', nombre: 'Torso A', huecos: [P('empuje-h', 'principal', 1), P('tiron-h', 'principal', 1), P('empuje-v', 'secundario', 2), P('tiron-v', 'secundario', 2), ...BRAZOS()] },
      { letra: 'B', nombre: 'Pierna A', huecos: [P('rodilla', 'principal', 1), P('cadera', 'secundario', 1), P('femoral', 'accesorio', 3), P('gemelo', 'accesorio', 4), P('core', 'core', 5)] },
      { letra: 'C', nombre: 'Torso B', huecos: [P('tiron-v', 'principal', 1), P('empuje-h', 'secundario', 1), P('tiron-h', 'secundario', 2), P('empuje-v', 'secundario', 3), ...HOMBROS()] },
      { letra: 'D', nombre: 'Pierna B', huecos: [P('cadera', 'principal', 1), P('rodilla', 'secundario', 1), P('gluteo', 'accesorio', 3), P('gemelo', 'accesorio', 4), P('core', 'core', 5)] },
    ]
    if (nDias === 5) dias.push({ letra: 'E', nombre: 'Brazos y hombros', huecos: [...BRAZOS(1), ...HOMBROS(2), P('biceps', 'accesorio', 3), P('triceps', 'accesorio', 3), P('core', 'core', 4)] })
    return { estructura: `Torso / Pierna · ${nDias} días`, dias }
  }
  const ppl: Plantilla[] = [
    { letra: 'A', nombre: 'Empuje', huecos: [P('empuje-h', 'principal', 1), P('empuje-v', 'secundario', 2), P('pecho-aisl', 'accesorio', 3), P('hombro-lat', 'accesorio', 3), P('triceps', 'accesorio', 4)] },
    { letra: 'B', nombre: 'Tirón', huecos: [P('tiron-v', 'principal', 1), P('tiron-h', 'secundario', 1), P('hombro-post', 'accesorio', 3), P('biceps', 'accesorio', 3), P('core', 'core', 5)] },
    { letra: 'C', nombre: 'Pierna', huecos: [P('rodilla', 'principal', 1), P('cadera', 'secundario', 1), P('femoral', 'accesorio', 3), P('gemelo', 'accesorio', 4), P('core', 'core', 5)] },
  ]
  const segunda = ppl.map(d => ({ ...d, letra: String.fromCharCode(d.letra.charCodeAt(0) + 3), nombre: `${d.nombre} 2` }))
  // 7 días: el séptimo es un día ligero de brazos, hombros y core (antes se quedaba sin sesión).
  const septimo: Plantilla = { letra: 'G', nombre: 'Brazos, hombros y core', huecos: [...BRAZOS(2), ...HOMBROS(3), P('core', 'core', 4)] }
  return { estructura: `Empuje / Tirón / Pierna · ${nDias} días`, dias: [...ppl, ...segunda, septimo].slice(0, Math.min(nDias, 7)) }
}

const EXTRA: Plantilla = { letra: 'S', nombre: 'Sesión extra', huecos: [...BRAZOS(1), P('tiron-v', 'secundario', 2), ...HOMBROS(3), P('core', 'core', 4)] }

export type EntradaGenerador = {
  perfil: Perfil
  gimnasio: Pick<Gimnasio, 'material' | 'id'> | null
  marcas: Map<string, MarcaEjercicio>
  ejercicios: Ejercicio[]
  /** Segundos medios por serie y descanso real por ejercicio (semana de calibración). */
  tiempos?: Map<string, { serie: number; descanso: number }>
  calibracion?: boolean
  /** Descansos por defecto de Ajustes (s). Sin ellos: 150 compuestos y 90 aislamiento. */
  descansos?: { compuesto: number; aislamiento: number }
  /** Ejercicios de una variante anterior: se intentan evitar para proponer otra. */
  evitar?: Set<string>
}

const RANGO_HABITUAL = new Map(HABITUALES.map((id, i) => [id, i]))

function disponible(e: Ejercicio, material: Set<string> | null): boolean {
  if (!e.material) return true
  return material ? material.has(e.material) : ['dumbbell', 'barbell', 'cable', 'flat_bench', 'pull_up_bar', 'leg_press', 'smith_machine'].includes(e.material)
}

// Músculos que de verdad tiran en un remo o un jalón.
const TIRAN = ['latissimus_dorsi', 'rhomboids', 'trapezius', 'posterior_deltoid', 'teres_major']
const PIERNA = ['gluteus_maximus', 'hamstrings', 'quadriceps']

/**
 * Patrón con el que el generador coloca un ejercicio. Igual que `patron` del catálogo, salvo los pesos
 * muertos que RepDB pone en «espalda» sin ningún músculo de tirón (p. ej. «Peso Muerto Rumano con
 * Mancuernas»): son de cadera, no un remo. Antes uno de ellos rellenaba el hueco de remo.
 */
export function patronGenerador(e: Ejercicio): Patron {
  const p = patron(e)
  if ((p === 'tiron-h' || p === 'tiron-v') && !e.principales.some(m => TIRAN.includes(m)) && e.principales.some(m => PIERNA.includes(m))) return 'cadera'
  return p
}

// El patrón de cada ejercicio no cambia: se calcula una vez (antes se recalculaba para todo el catálogo en cada hueco).
const cachePatron = new WeakMap<Ejercicio, Patron>()
function patronDe(e: Ejercicio): Patron {
  let p = cachePatron.get(e)
  if (p === undefined) { p = patronGenerador(e); cachePatron.set(e, p) }
  return p
}

// ── Mismo movimiento ──────────────────────────────────────────────────────────
// Dos ejercicios son «el mismo movimiento» si su nombre, quitando el material y las palabras de relleno,
// coincide («Peso Muerto Rumano» = «Peso Muerto Rumano con Mancuernas» = «… en Máquina Smith»), o si uno
// es el otro con algo más detrás y la parte común tiene al menos dos palabras («Peso muerto» y «Peso muerto
// rumano»; «Press de banca» y «Press de banca con agarre cerrado»). Una sola palabra común («Curl», «Remo»)
// no basta: un curl de martillo y uno con barra pueden ir el mismo día.
const MATERIAL_EN_NOMBRE = /\b(?:con|en|sobre)\s+(?:la\s+|el\s+|una\s+|un\s+)?(?:maquina\s+de\s+barra\s+guiada|barra\s+guiada|barra\s+(?:z|ez|hexagonal|trap|recta)|barra|(?:doble|dos)\s+mancuernas?|mancuernas?|(?:dos\s+)?pesas?\s+rusas?|kettlebells?|cable|poleas?|bandas?(?:\s+elasticas?)?|trx|landmine|discos?|maquina(?:\s+smith)?(?:\s+de\s+(?:discos|predicador))?|multipower|smith)\b/g
const LADO = /\b(?:a\s+un\s+brazo|a\s+una\s+mano|unilateral)\b/g
const RELLENO = new Set(['de', 'del', 'la', 'el', 'en', 'con', 'y', 'a', 'al', 'los', 'las', 'trasera', 'biceps'])
const cacheClave = new WeakMap<Ejercicio, string>()

/** Nombre del movimiento sin material ni relleno: «peso muerto rumano». */
export function claveMovimiento(e: Ejercicio): string {
  let k = cacheClave.get(e)
  if (k === undefined) {
    const t = ` ${e.nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()} `
      .replace(/\(.*?\)/g, ' ').replace(MATERIAL_EN_NOMBRE, ' ').replace(LADO, ' ')
    k = t.split(/[^a-z0-9]+/).filter(w => w && !RELLENO.has(w)).join(' ')
    cacheClave.set(e, k)
  }
  return k
}

/** ¿Son dos variantes del mismo movimiento? (No cuenta el mismo ejercicio consigo mismo.) */
export function mismoMovimiento(a: Ejercicio, b: Ejercicio): boolean {
  if (a.id === b.id) return false
  const ka = claveMovimiento(a), kb = claveMovimiento(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  const [corta, larga] = ka.length <= kb.length ? [ka, kb] : [kb, ka]
  return corta.includes(' ') && larga.startsWith(`${corta} `)
}

/** Ejercicios aptos para este perfil y gimnasio, agrupados por patrón (una sola pasada por el catálogo). */
function aptosPorPatron(x: EntradaGenerador, material: Set<string> | null): Map<Patron, Ejercicio[]> {
  const m = new Map<Patron, Ejercicio[]>()
  for (const e of x.ejercicios) {
    if (!apto(e, x, material)) continue
    const p = patronDe(e)
    const l = m.get(p)
    if (l) l.push(e)
    else m.set(p, [e])
  }
  return m
}

function apto(e: Ejercicio, x: EntradaGenerador, material: Set<string> | null): boolean {
  if (e.categoria !== 'strength') return false
  if (!disponible(e, material)) return false
  const m = x.marcas.get(e.id)
  if (m?.odiado || m?.duele) return false
  for (const z of x.perfil.zonasSensibles) {
    const etiqueta = ZONA_SEGURA[z]
    if (etiqueta && !e.etiquetas.includes(etiqueta)) return false
  }
  if ((x.perfil.nivel === 'empiezo' || x.perfil.nivel === 'vuelvo') && e.dificultad === 'advanced') return false
  return true
}

function puntuar(e: Ejercicio, h: Hueco, x: EntradaGenerador, usadosOtros: Set<string>): number {
  let s = 0
  const m = x.marcas.get(e.id)
  // Codo y muñeca no tienen etiqueta en RepDB: lo que más los carga solo sale si no queda otra cosa.
  if (x.perfil.zonasSensibles.some(z => ZONA_EVITAR[z]?.test(e.id))) s -= 1000
  if (m?.favorito) s += 30
  const r = RANGO_HABITUAL.get(e.id)
  if (r != null) s += 22 - r * 0.15
  const pref = x.perfil.preferencia
  if (pref === 'maquinas' && ES_MAQUINA(e)) s += 10
  if (pref === 'libre' && ES_LIBRE(e)) s += 10
  if (pref === 'mezcla' && (ES_MAQUINA(e) || ES_LIBRE(e))) s += 4
  if (!e.unilateral) s += 4
  if ((h.papel === 'principal' || h.papel === 'secundario') && e.mecanica === 'compound') s += 4
  if (h.papel === 'accesorio' && e.mecanica === 'isolation') s += 8
  if (h.papel === 'principal' && !e.material) s -= 8
  if (h.papel !== 'core' && h.papel !== 'principal' && !e.material && x.gimnasio) s -= 6
  if (e.dificultad === 'advanced') s -= 6
  if (usadosOtros.has(e.id) && !m?.favorito) s -= 15
  if (x.evitar?.has(e.id) && !m?.favorito) s -= 12
  return s
}

function alternativas(elegido: Ejercicio, h: Hueco, candidatos: Ejercicio[], x: EntradaGenerador): string[] {
  const out: Ejercicio[] = []
  const ordenados = candidatos
    .filter(e => e.id !== elegido.id)
    .map(e => {
      let s = puntuar(e, h, x, new Set())
      if (e.material !== elegido.material) s += 12
      if (!e.material && h.papel !== 'core') s -= 14
      if (e.principales.some(mm => elegido.principales.includes(mm))) s += 8
      return { e, s }
    })
    .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))
  for (const { e } of ordenados) {
    if (out.length >= 2) break
    if (out.some(o => o.material === e.material) && ordenados.some(o => o.e.material !== e.material && !out.includes(o.e) && o.e.material !== elegido.material && !out.some(oo => oo.material === o.e.material))) continue
    out.push(e)
  }
  return out.map(e => e.id)
}

/** Ajusta el descanso a los de Ajustes: los compuestos escalan con «compuestos» y el resto con «aislamiento». */
export function descansoAjustado(base: number, d?: { compuesto: number; aislamiento: number }): number {
  if (!d || !(d.compuesto > 0) || !(d.aislamiento > 0)) return base
  const f = base >= 100 ? d.compuesto / 150 : d.aislamiento / 90
  return Math.max(15, Math.round((base * f) / 15) * 15)
}

function seriesYReps(h: Hueco, x: EntradaGenerador, e: Ejercicio): Pick<Bloque, 'series' | 'repsMin' | 'repsMax' | 'rpe' | 'descanso'> {
  const r = seriesYRepsBase(h, x, e)
  return { ...r, descanso: descansoAjustado(r.descanso, x.descansos) }
}

function seriesYRepsBase(h: Hueco, x: EntradaGenerador, e: Ejercicio): Pick<Bloque, 'series' | 'repsMin' | 'repsMax' | 'rpe' | 'descanso'> {
  const reps = x.perfil.reps
  const rpeBase = x.calibracion ? 7 : x.perfil.nivel === 'empiezo' ? 7 : 8
  const reg = tipoRegistro(e)
  const extra = prioriza(x.perfil, h.patron) ? 1 : 0
  if (reg === 'tiempo') return { series: 3, repsMin: 30, repsMax: 45, rpe: rpeBase, descanso: 60 }
  switch (h.papel) {
    case 'principal':
      return { series: 3 + extra, repsMin: reps === 'pesadas' ? 5 : reps === 'moderadas' ? 8 : 6, repsMax: reps === 'pesadas' ? 8 : reps === 'moderadas' ? 12 : 10, rpe: rpeBase, descanso: 150 }
    case 'secundario':
      return { series: 3 + extra, repsMin: reps === 'pesadas' ? 6 : 8, repsMax: reps === 'pesadas' ? 10 : 12, rpe: rpeBase, descanso: 120 }
    case 'accesorio':
      return { series: 3 + extra, repsMin: reps === 'pesadas' ? 8 : 10, repsMax: reps === 'pesadas' ? 12 : 15, rpe: rpeBase, descanso: 75 }
    case 'core':
      return { series: 3, repsMin: 10, repsMax: 15, rpe: rpeBase, descanso: 60 }
  }
}

const ZONA_PATRON: Record<string, Patron[]> = {
  brazos: ['biceps', 'triceps'], pecho: ['empuje-h', 'pecho-aisl'], espalda: ['tiron-h', 'tiron-v'], hombros: ['empuje-v', 'hombro-lat', 'hombro-post'],
  piernas: ['rodilla', 'cadera', 'cuadriceps', 'femoral'], gluteo: ['cadera', 'gluteo'], abdomen: ['core'],
}
function prioriza(p: Perfil, patronH: Patron): boolean {
  return p.zonasPrioridad.some(z => ZONA_PATRON[z]?.includes(patronH))
}

let contador = 0
const uid = () => `b${Date.now().toString(36)}${(contador++).toString(36)}`

/** Segundos que dura un bloque (o el par de superserie). */
export function duracionBloque(b: Bloque, companero: Bloque | undefined, x?: Pick<EntradaGenerador, 'tiempos'>): number {
  const t = (bl: Bloque) => x?.tiempos?.get(bl.ejercicio)?.serie ?? (bl.registro === 'tiempo' ? bl.repsMax : bl.repsMin >= 10 ? 40 : 45)
  const descanso = x?.tiempos?.get(b.ejercicio)?.descanso ?? b.descanso
  const transicion = 75
  if (companero) return b.series * (t(b) + t(companero) + 20) + (b.series - 1) * descanso + transicion * 2
  return b.series * t(b) + (b.series - 1) * descanso + transicion
}

export function duracionDia(bloques: Bloque[], corta = false, x?: Pick<EntradaGenerador, 'tiempos'>): number {
  let s = 5 * 60 // calentamiento general
  const vistos = new Set<string>()
  for (const b of bloques) {
    if (corta && b.fueraEnCorta) continue
    if (vistos.has(b.uid)) continue
    const comp = b.superserie ? bloques.find(o => o.uid === b.superserie) : undefined
    if (comp) vistos.add(comp.uid)
    s += duracionBloque(b, comp && !(corta && comp.fueraEnCorta) ? comp : undefined, x)
  }
  // Aproximación del primer básico con barra
  if (bloques[0] && ['peso'].includes(bloques[0].registro)) s += 3 * 60
  return s
}

/** Recorta series y ejercicios de menor prioridad hasta que el día quepa en el tiempo. */
export function ajustarATiempo(bloques: Bloque[], prioridades: Map<string, number>, minutos: number, minutosCorta: number, x?: Pick<EntradaGenerador, 'tiempos'>): Bloque[] {
  let bs = bloques.map(b => ({ ...b }))
  const limite = (minutos - 3) * 60
  let guard = 0
  while (duracionDia(bs, false, x) > limite && guard++ < 40) {
    const orden = [...bs].sort((a, b) => (prioridades.get(b.uid) ?? 3) - (prioridades.get(a.uid) ?? 3))
    const reducible = orden.find(b => b.series > 2 && (prioridades.get(b.uid) ?? 3) > 1)
      ?? orden.find(b => b.series > 2)
    if (reducible) { reducible.series--; if (reducible.superserie) { const c = bs.find(o => o.uid === reducible.superserie); if (c && c.series > reducible.series) c.series = reducible.series } continue }
    const quitar = orden.find(b => (prioridades.get(b.uid) ?? 3) > 1)
    if (!quitar) break
    bs = bs.filter(b => b.uid !== quitar.uid && b.uid !== quitar.superserie).map(b => b.superserie === quitar.uid ? { ...b, superserie: undefined } : b)
  }
  // Versión corta: se marcan fuera los de menor prioridad.
  const limiteCorta = (minutosCorta - 2) * 60
  for (const b of bs) b.fueraEnCorta = false
  // A igual prioridad se quita antes lo que va al final de la sesión.
  const pos = new Map(bs.map((b, i) => [b.uid, i]))
  const orden = [...bs].sort((a, b) => (prioridades.get(b.uid) ?? 3) - (prioridades.get(a.uid) ?? 3) || (pos.get(b.uid)! - pos.get(a.uid)!))
  for (const b of orden) {
    if (duracionDia(bs, true, x) <= limiteCorta) break
    if ((prioridades.get(b.uid) ?? 3) <= 1) continue
    b.fueraEnCorta = true
    if (b.superserie) { const c = bs.find(o => o.uid === b.superserie); if (c) c.fueraEnCorta = true }
  }
  return bs
}

/**
 * Patrones parecidos para cuando el gimnasio no tiene nada para un hueco (p. ej. sin material no hay
 * remos: antes el día de «Tirón» se quedaba solo con una plancha). Solo se usan si el patrón propio está vacío.
 */
const RESPALDO: Partial<Record<Patron, Patron[]>> = {
  rodilla: ['cuadriceps', 'cadera', 'gluteo'],
  cadera: ['gluteo', 'femoral', 'rodilla'],
  'empuje-h': ['pecho-aisl', 'empuje-v', 'triceps'],
  'empuje-v': ['hombro-lat', 'empuje-h'],
  'tiron-h': ['tiron-v', 'lumbar', 'hombro-post'],
  'tiron-v': ['tiron-h', 'lumbar', 'hombro-post'],
  cuadriceps: ['rodilla'],
  femoral: ['cadera', 'gluteo'],
  gluteo: ['cadera', 'femoral'],
  'pecho-aisl': ['empuje-h'],
  'hombro-lat': ['empuje-v', 'hombro-post'],
  'hombro-post': ['tiron-h', 'hombro-lat'],
  biceps: ['antebrazo', 'tiron-v', 'tiron-h'],
  triceps: ['empuje-h', 'empuje-v'],
  core: ['lumbar'],
}

/** Minutos válidos (un perfil a medias puede traer 0, negativos o NaN). */
const minutosValidos = (m: number, porDefecto: number) => (Number.isFinite(m) && m > 0 ? m : porDefecto)

function generarDia(pl: Plantilla, x: EntradaGenerador, aptos: Map<Patron, Ejercicio[]>, usados: Set<string>, dia: Dia | null, opcional: boolean): DiaRutina {
  const bloques: Bloque[] = []
  const prioridades = new Map<string, number>()
  const delDia = new Set<string>()
  const porPar = new Map<number, string>()
  const pendientesAlt: { b: Bloque; h: Hueco; elegido: Ejercicio; candidatos: Ejercicio[] }[] = []
  // Copia de los huecos: las plantillas (p. ej. EXTRA) son compartidas y no se deben modificar.
  const huecos = pl.huecos
    .filter(h => !(h.patron === 'core' && !x.perfil.core && !x.perfil.zonasPrioridad.includes('abdomen')))
    .map(h => ({ ...h, par: x.perfil.superseries ? h.par : undefined }))
  const elegidosDia: Ejercicio[] = []
  // Libre = no está ya en el día ni es otra variante de un movimiento que ya está («Peso Muerto Rumano»
  // y «Peso Muerto Rumano con Mancuernas» el mismo día parecía un error).
  const libresDe = (l: Ejercicio[], mov: boolean) => l.filter(e => !delDia.has(e.id) && !(mov && elegidosDia.some(o => mismoMovimiento(o, e))))
  for (const h of huecos) {
    let candidatos: Ejercicio[] = []
    let libres: Ejercicio[] = []
    // Primero el patrón propio y sus parecidos sin repetir movimiento; si no queda nada, se permite repetirlo
    // antes que dejar el hueco vacío (gimnasios con muy poco material).
    for (const mov of [true, false]) {
      for (const p of [h.patron, ...(RESPALDO[h.patron] ?? [])]) {
        candidatos = aptos.get(p) ?? []
        libres = libresDe(candidatos, mov)
        if (libres.length) break
      }
      if (libres.length) break
    }
    if (!libres.length) continue
    // El mejor por puntuación (y por id a igualdad), puntuando cada candidato una sola vez.
    let elegido = libres[0]!, mejor = -Infinity
    for (const e of libres) {
      const p = puntuar(e, h, x, usados)
      if (p > mejor || (p === mejor && e.id.localeCompare(elegido.id) < 0)) { mejor = p; elegido = e }
    }
    delDia.add(elegido.id)
    elegidosDia.push(elegido)
    usados.add(elegido.id)
    const b: Bloque = {
      uid: uid(),
      ejercicio: elegido.id,
      alternativas: [],
      ...seriesYReps(h, x, elegido),
      registro: tipoRegistro(elegido),
    }
    pendientesAlt.push({ b, h, elegido, candidatos })
    if (h.par != null) {
      const otro = porPar.get(h.par)
      if (otro) {
        b.superserie = otro
        const o = bloques.find(bb => bb.uid === otro)
        if (o) { o.superserie = b.uid; b.series = o.series = Math.min(o.series, b.series) }
      } else porPar.set(h.par, b.uid)
    }
    // Priorizar una zona sube la prioridad de sus accesorios, pero nunca hace quitable un principal (prioridad 1).
    prioridades.set(b.uid, prioriza(x.perfil, h.patron) && h.prioridad > 2 ? h.prioridad - 1 : h.prioridad)
    bloques.push(b)
  }
  // Alternativas al final, sin proponer ningún ejercicio que ya es principal en este día.
  // Tampoco una variante de OTRO ejercicio del día (sí del propio: «Barra → Mancuernas» es justo lo que se busca).
  for (const { b, h, elegido, candidatos } of pendientesAlt) {
    const otros = elegidosDia.filter(o => o.id !== elegido.id)
    b.alternativas = alternativas(elegido, h, candidatos.filter(e => !delDia.has(e.id) && !otros.some(o => mismoMovimiento(o, e))), x)
  }
  // Las superseries van juntas: el segundo del par justo detrás del primero.
  const ordenados: Bloque[] = []
  for (const b of bloques) {
    if (ordenados.includes(b)) continue
    ordenados.push(b)
    const c = b.superserie ? bloques.find(o => o.uid === b.superserie) : undefined
    if (c && !ordenados.includes(c)) ordenados.push(c)
  }
  const normal = minutosValidos(x.perfil.minutosNormal, 60)
  const corta = Math.min(normal, minutosValidos(x.perfil.minutosCorta, Math.min(45, normal)))
  const minutos = opcional ? Math.max(normal, 45) : normal
  return { letra: pl.letra, nombre: pl.nombre, dia, opcional, bloques: ajustarATiempo(ordenados, prioridades, minutos, corta, x) }
}

export function generarRutina(x: EntradaGenerador): Omit<Rutina, 'id'> {
  const material = x.gimnasio ? new Set(x.gimnasio.material) : null
  // Sin repetidos ni valores fuera de 0-6 (un perfil editado a mano o importado puede traerlos).
  const fijos = [...new Set(x.perfil.diasFijos)].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b)
  const { estructura, dias } = plantillas(fijos.length || 3)
  const usados = new Set<string>()
  const aptos = aptosPorPatron(x, material)
  const salida: DiaRutina[] = dias.map((pl, i) => generarDia(pl, x, aptos, usados, fijos[i] ?? null, false))
  const opcionales = [...new Set(x.perfil.diasOpcionales)].filter(d => Number.isInteger(d) && d >= 0 && d <= 6 && !fijos.includes(d))
  if (opcionales.length) salida.push(generarDia(EXTRA, x, aptos, usados, opcionales[0]!, true))

  const porque: string[] = []
  const n = fijos.length || 3
  // Domingo y lunes también son seguidos (la semana da la vuelta).
  const seguidos = fijos.some((d, i) => i > 0 && d - fijos[i - 1]! === 1) || (fijos.length > 1 && fijos.includes(0) && fijos.includes(6))
  if (n <= 3) porque.push(`${n} día${n === 1 ? '' : 's'}${seguidos ? ', con dos días seguidos' : ''} → cuerpo completo: cada músculo se trabaja ${n} ve${n === 1 ? 'z' : 'ces'} por semana sin acumular cansancio.`)
  else if (n <= 5) porque.push(`${n} días → torso y pierna alternos: cada músculo dos veces por semana.`)
  else porque.push(`${n} días → empuje, tirón y pierna dos veces por semana.`)
  if (x.perfil.zonasPrioridad.length) porque.push(`Prioridad en ${x.perfil.zonasPrioridad.join(', ')} → una serie más en esos ejercicios.`)
  if (x.perfil.superseries) porque.push('Brazos y hombros en «dos seguidos» (dos ejercicios sin descanso entre ellos) para que quepa todo en el tiempo.')
  porque.push(`Sesiones de ${x.perfil.minutosNormal} min como mucho, con versión corta de ~${x.perfil.minutosCorta} min si vas con prisa.`)
  if (x.perfil.zonasSensibles.length) porque.push(`Solo ejercicios que cuidan: ${x.perfil.zonasSensibles.join(', ')}.`)
  const evitados = [...x.marcas.values()].filter(m => m.odiado || m.duele).length
  if (evitados) porque.push(`${evitados} ejercicio${evitados === 1 ? '' : 's'} que no te gusta${evitados === 1 ? '' : 'n'} o te duele${evitados === 1 ? '' : 'n'}, fuera.`)
  if (opcionales.length) porque.push(`${DIAS[opcionales[0]!]![0]!.toUpperCase()}${DIAS[opcionales[0]!]!.slice(1)} opcional: brazos, hombros y core.`)

  return {
    creada: new Date().toISOString(),
    activa: true,
    estructura,
    porque,
    calibracion: !!x.calibracion,
    gimnasioId: x.gimnasio?.id ?? null,
    dias: salida,
  }
}

/** Tiempos reales por ejercicio a partir de entrenos hechos (semana de calibración). */
export function tiemposReales(sesiones: { ejercicios: { ejercicio: string; series: { hecha: boolean; calentamiento: boolean; ts?: number }[] }[] }[]): Map<string, { serie: number; descanso: number }> {
  const acc = new Map<string, number[]>()
  for (const s of sesiones) for (const e of s.ejercicios) {
    const ts = e.series.filter(x => x.hecha && !x.calentamiento && x.ts).map(x => x.ts!).sort((a, b) => a - b)
    for (let i = 1; i < ts.length; i++) {
      const ciclo = (ts[i]! - ts[i - 1]!) / 1000
      if (ciclo > 20 && ciclo < 600) (acc.get(e.ejercicio) ?? acc.set(e.ejercicio, []).get(e.ejercicio)!).push(ciclo)
    }
  }
  const out = new Map<string, { serie: number; descanso: number }>()
  for (const [id, ciclos] of acc) {
    const medio = ciclos.reduce((a, b) => a + b, 0) / ciclos.length
    out.set(id, { serie: 40, descanso: Math.max(30, Math.round(medio - 40)) })
  }
  return out
}

/** Alternativas B y C para un ejercicio cualquiera (mismo patrón, otro material, disponibles). */
export function alternativasDe(id: string, x: EntradaGenerador): string[] {
  const elegido = x.ejercicios.find(e => e.id === id)
  if (!elegido) return []
  const material = x.gimnasio ? new Set(x.gimnasio.material) : null
  const p = patronDe(elegido)
  const h: Hueco = { patron: p, papel: elegido.mecanica === 'compound' ? 'secundario' : 'accesorio', prioridad: 3 }
  const candidatos = x.ejercicios.filter(e => patronDe(e) === p && apto(e, x, material))
  return alternativas(elegido, h, candidatos, x)
}

/** Bloque nuevo con series y reps razonables para un ejercicio añadido a mano. */
export function bloqueNuevo(id: string, x: Pick<EntradaGenerador, 'perfil' | 'ejercicios'> & Partial<EntradaGenerador>): Bloque {
  const e = x.ejercicios.find(z => z.id === id)
  // Ejercicio que ya no está en el catálogo (o propio): bloque genérico en vez de romper.
  if (!e) return { uid: uid(), ejercicio: id, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: x.calibracion ? 7 : 8, descanso: 90, registro: 'peso' }
  const h: Hueco = { patron: patronDe(e), papel: patronDe(e) === 'core' ? 'core' : e.mecanica === 'compound' ? 'secundario' : 'accesorio', prioridad: 3 }
  const entrada: EntradaGenerador = { perfil: x.perfil, gimnasio: x.gimnasio ?? null, marcas: x.marcas ?? new Map(), ejercicios: x.ejercicios }
  return { uid: uid(), ejercicio: id, alternativas: alternativasDe(id, entrada), ...seriesYReps(h, entrada, e), registro: tipoRegistro(e) }
}
