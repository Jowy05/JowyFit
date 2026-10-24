// Ejercicios creados por el usuario: cómo entran en el catálogo como uno más y qué se les propone al crearlos.
import type { Ejercicio } from './tipos'
import type { EjercicioPropio } from '../datos/tipos'
import { normalizar } from './catalogo'
import { tk } from '../i18n'

type Grupo = EjercicioPropio['grupo']
type Material = EjercicioPropio['material']
type Registro = EjercicioPropio['registro']

export const GRUPOS: { v: Grupo; t: string }[] = [
  { v: 'pecho', t: tk('Pecho') }, { v: 'espalda', t: tk('Espalda') }, { v: 'hombro', t: tk('Hombro') }, { v: 'brazo', t: tk('Brazo') },
  { v: 'abdomen', t: tk('Abdomen') }, { v: 'gluteo', t: tk('Glúteo') }, { v: 'pierna', t: tk('Pierna') }, { v: 'completo', t: tk('Cuerpo entero') },
]
export const MATERIALES: { v: Material; t: string }[] = [
  { v: 'corporal', t: tk('Peso corporal') }, { v: 'barra', t: tk('Barra') }, { v: 'mancuernas', t: tk('Mancuernas') },
  { v: 'maquina', t: tk('Máquina') }, { v: 'polea', t: tk('Polea') }, { v: 'otro', t: tk('Otro') },
]
export const REGISTROS: { v: Registro; t: string; ejemplo: string }[] = [
  { v: 'peso', t: tk('Peso y repeticiones'), ejemplo: tk('20 kg × 10') },
  { v: 'corporal', t: tk('Solo repeticiones'), ejemplo: tk('12 veces') },
  { v: 'tiempo', t: tk('Tiempo'), ejemplo: tk('45 segundos') },
  { v: 'cardio', t: tk('Minutos de cardio'), ejemplo: tk('20 minutos') },
]

// Lo que el catálogo de RepDB pone en cada grupo (zona y músculos), para que filtros, patrones y alternativas lo traten igual.
const DE_GRUPO: Record<Grupo, { zona: string; principales: string[] }> = {
  pecho: { zona: 'chest', principales: ['pectoralis_major'] },
  espalda: { zona: 'back', principales: ['latissimus_dorsi', 'rhomboids'] },
  hombro: { zona: 'shoulders', principales: ['anterior_deltoid', 'lateral_deltoid'] },
  brazo: { zona: 'upper_arms', principales: ['biceps_brachii', 'triceps_brachii'] },
  abdomen: { zona: 'core', principales: ['rectus_abdominis', 'obliques'] },
  gluteo: { zona: 'upper_legs', principales: ['gluteus_maximus'] },
  pierna: { zona: 'upper_legs', principales: ['quadriceps', 'hamstrings'] },
  completo: { zona: 'full_body', principales: [] },
}

/** Material de RepDB al que equivale; la máquina y «otro» no tienen uno, y llevan clave propia (nombreMaterial las conoce). */
const DE_MATERIAL: Record<Material, string | null> = {
  corporal: null, barra: 'barbell', mancuernas: 'dumbbell', polea: 'cable', maquina: 'mio-maquina', otro: 'mio-otro',
}

export function comoEjercicio(p: EjercicioPropio): Ejercicio {
  const g = DE_GRUPO[p.grupo]
  return {
    id: p.id,
    nombre: p.nombre,
    nombreEs: p.nombre,
    descripcion: p.notas ?? '',
    instrucciones: [],
    consejos: [],
    categoria: p.registro === 'cardio' ? 'cardio' : 'strength',
    fuerza: p.registro === 'tiempo' ? 'static' : 'push',
    mecanica: 'compound',
    dificultad: 'beginner',
    material: DE_MATERIAL[p.material],
    zona: g.zona,
    principales: g.principales,
    secundarios: [],
    objetivos: [],
    etiquetas: p.material === 'corporal' ? ['bodyweight'] : [],
    unilateral: false,
    pesoCorporal: p.material === 'corporal',
    poses: [],
    // Gasto de un entreno de fuerza normal y de un cardio moderado (Compendio de actividades físicas).
    met: p.registro === 'cardio' ? 5 : 3.5,
    propio: p,
  }
}

// En los tres idiomas de la app, sin tildes (se compara normalizado).
const CARDIO = /\b(bici|bicicleta|cinta|correr|carrera|andar|caminar|caminata|eliptica|comba|nadar|natacion|nedar|spinning|trote|trotar|bike|cycling|run|running|walk|walking|treadmill|swim|swimming|jog|jogging)\b/
const TIEMPO = /\b(plancha|planxa|aguantar|aguanta|isometrica?|isometrico|colgad[oa]|penjat|plank|hold|hang|wall sit)\b/

/** Cómo se apunta, según el nombre y con qué se hace (hasta que el usuario lo elige él). */
export function registroSugerido(nombre: string, material: Material): Registro {
  const n = normalizar(nombre)
  if (CARDIO.test(n)) return 'cardio'
  if (TIEMPO.test(n)) return 'tiempo'
  return material === 'corporal' ? 'corporal' : 'peso'
}

/**
 * El ejercicio de la lista que más se parece al nombre escrito (para avisar: «Se parece a Jalón al Pecho»).
 * Cuenta si todas las palabras de uno están en el otro, sin tildes ni mayúsculas ni palabras cortas («de», «con»…).
 */
export function parecido(nombre: string, lista: Ejercicio[], sinContar?: string): Ejercicio | undefined {
  const palabras = (s: string) => normalizar(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 2)
  const q = palabras(nombre)
  if (!q.length) return undefined
  let mejor: { e: Ejercicio; sobra: number } | undefined
  for (const e of lista) {
    if (e.id === sinContar) continue
    const w = new Set([...palabras(e.nombre), ...palabras(e.nombreEs ?? '')])
    if (!q.every(x => w.has(x))) continue
    const sobra = w.size - q.length
    if (!mejor || sobra < mejor.sobra) mejor = { e, sobra }
  }
  // Con una sola palabra («press») se parecen cientos: solo avisa si el otro tampoco tiene mucho más.
  return mejor && (q.length > 1 || mejor.sobra <= 1) ? mejor.e : undefined
}

/** id nuevo para un ejercicio propio. */
export const idPropio = () => `mio-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
