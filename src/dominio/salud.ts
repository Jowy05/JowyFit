// Salud y molestias: qué bloquea la rutina, qué quita o suaviza cada molestia y cada condición, y la frase de qué hará.
// Reglas de docs/INVESTIGACION-RUTINAS.md §4.0 y del pedido del usuario: todas quitan, nunca añaden ([O] salvo fuente).
import type { Ejercicio } from '../catalogo/tipos'
import { patron, ZONA_EVITAR, type Patron } from '../catalogo/clasificacion'
import type { CondicionSalud, Dolor, Perfil, Urgencia, ZonaDolor, Zona } from '../datos/tipos'
import { t, tk } from '../i18n'

export const URGENCIAS: { v: Urgencia; t: string; d?: string }[] = [
  { v: 'pecho', t: tk('Dolor o presión en el pecho') },
  { v: 'mareo', t: tk('Mareo o desmayo') },
  { v: 'aire', t: tk('Falta de aire'), d: tk('Más de lo normal para lo que haces') },
  { v: 'palpitaciones', t: tk('Palpitaciones raras'), d: tk('El corazón va a saltos o muy deprisa') },
]

type GrupoZona = 'art' | 'mus' | 'otr'
export const ZONAS_DOLOR: { v: ZonaDolor; t: string; grupo: GrupoZona; musculos?: string[]; ico?: string }[] = [
  { v: 'cuello', t: tk('Cuello'), grupo: 'art' },
  { v: 'hombros', t: tk('Hombros'), grupo: 'art' },
  { v: 'codos', t: tk('Codos'), grupo: 'art' },
  { v: 'munecas', t: tk('Muñecas'), grupo: 'art' },
  { v: 'manos', t: tk('Manos y dedos'), grupo: 'art' },
  { v: 'lumbar', t: tk('Lumbar'), grupo: 'art', musculos: ['erector_spinae'] },
  { v: 'caderas', t: tk('Caderas'), grupo: 'art' },
  { v: 'rodillas', t: tk('Rodillas'), grupo: 'art' },
  { v: 'tobillos', t: tk('Tobillos'), grupo: 'art' },
  { v: 'pies', t: tk('Pies'), grupo: 'art' },
  { v: 'pecho', t: tk('Pecho'), grupo: 'mus', musculos: ['pectoralis_major'] },
  { v: 'espalda', t: tk('Espalda'), grupo: 'mus', musculos: ['latissimus_dorsi', 'rhomboids', 'trapezius'] },
  { v: 'brazo', t: tk('Brazo'), grupo: 'mus', musculos: ['biceps_brachii', 'triceps_brachii', 'brachialis'] },
  { v: 'abdomen', t: tk('Abdomen'), grupo: 'mus', musculos: ['rectus_abdominis', 'obliques', 'transverse_abdominis'] },
  { v: 'gluteo', t: tk('Glúteo'), grupo: 'mus', musculos: ['gluteus_maximus', 'gluteus_medius'] },
  { v: 'muslo', t: tk('Muslo, delante'), grupo: 'mus', musculos: ['quadriceps'] },
  { v: 'isquio', t: tk('Muslo, detrás'), grupo: 'mus', musculos: ['hamstrings'] },
  { v: 'gemelo', t: tk('Gemelo'), grupo: 'mus', musculos: ['gastrocnemius', 'soleus'] },
  { v: 'cabeza', t: tk('Dolor de cabeza'), grupo: 'otr' },
  { v: 'estomago', t: tk('Estómago'), grupo: 'otr' },
  { v: 'hormigueo', t: tk('Hormigueo que baja'), grupo: 'otr', ico: 'lightning' },
  { v: 'cansancio', t: tk('Cansancio que no se va'), grupo: 'otr', ico: 'battery-low' },
  { v: 'fiebre', t: tk('Resfriado o fiebre'), grupo: 'otr', ico: 'thermometer' },
]
export const zonaDolor = (z: ZonaDolor) => ZONAS_DOLOR.find(x => x.v === z)
export const nombreZonaDolor = (z: ZonaDolor) => { const x = zonaDolor(z); return x ? t(x.t) : z }

export const CONDICIONES: { v: CondicionSalud; t: string; d: string }[] = [
  { v: 'tension', t: tk('Tensión alta'), d: tk('Sin aguantar la respiración ni esfuerzos largos quieta.') },
  { v: 'osteoporosis', t: tk('Osteoporosis'), d: tk('Sin doblar la espalda con peso y sin saltos.') },
  { v: 'diabetes', t: tk('Diabetes'), d: tk('Al empezar te recordamos llevar algo de azúcar.') },
  { v: 'protesis', t: tk('Prótesis de cadera o rodilla'), d: tk('Solo ejercicios seguros para esa articulación, sin impacto.') },
  { v: 'anticoagulantes', t: tk('Tomo anticoagulantes'), d: tk('Nada con riesgo de golpe o caída; equilibrio siempre con apoyo.') },
  { v: 'asma', t: tk('Asma'), d: tk('Calentamiento más largo.') },
  { v: 'embarazo', t: tk('Embarazo o posparto'), d: tk('Solo un plan suave, con permiso de tu médico o tu matrona.') },
]

/** Con alguna urgencia marcada no hay rutina hasta que el médico dé el visto bueno (PAR-Q+; ACSM 2015). */
export const rutinaBloqueada = (p: Pick<Perfil, 'urgencias'>) => !!p.urgencias?.length

// Las zonas sensibles de antes (un toque, sin más) cuentan como molestias «regular».
const DE_ZONA: Record<Zona, ZonaDolor> = { rodilla: 'rodillas', lumbar: 'lumbar', hombro: 'hombros', muneca: 'munecas', codo: 'codos' }

/** Las molestias del perfil; con un perfil de antes, las zonas sensibles como molestias «regular». */
export function doloresDe(p: Pick<Perfil, 'dolores' | 'zonasSensibles' | 'creado'>): Dolor[] {
  if (p.dolores) return p.dolores
  return [...new Set(p.zonasSensibles.map(z => DE_ZONA[z]).filter(Boolean))].map(zona => ({ zona, cuanto: 'regular', cuando: 'fuerza', desde: 'meses', inicio: (p.creado ?? '').slice(0, 10) || '2026-01-01' }))
}

export type NivelDolor = 'fuera' | 'seguro' | 'menos'
/** «Mucho» o «siempre» → la zona queda fuera; «regular» → solo lo seguro para ella; «poco» → menos carga. */
const CUANTO = { poco: tk('poco'), regular: tk('regular'), mucho: tk('mucho') }
const CUANDO = { siempre: tk('siempre'), fuerza: tk('al hacer fuerza'), aveces: tk('a veces') }
const DESDE = { dias: tk('desde hace días'), semanas: tk('desde hace semanas'), meses: tk('desde hace meses') }
/** «regular · al hacer fuerza · desde hace semanas». */
export const detalleDolor = (d: Pick<Dolor, 'cuanto' | 'cuando' | 'desde'>) => [t(CUANTO[d.cuanto]), t(CUANDO[d.cuando]), t(DESDE[d.desde])].join(' · ')

export const nivelDolor = (d: Pick<Dolor, 'cuanto' | 'cuando'>): NivelDolor => (d.cuanto === 'mucho' || d.cuando === 'siempre' ? 'fuera' : d.cuanto === 'regular' ? 'seguro' : 'menos')

const tiene = (e: Ejercicio, ms: string[]) => e.principales.some(m => ms.includes(m))
const musculos = (z: ZonaDolor) => zonaDolor(z)?.musculos ?? []
const sinCargaEspalda = (e: Ejercicio) => e.etiquetas.includes('no_axial_load')
// Palabras enteras del id: «crunch» lleva «run» dentro y no es correr.
const conImpacto = (e: Ejercicio) => e.categoria === 'plyometrics' || /(^|-)(jumps?|jumping|hops?|hopping|bounds?|bounding|skips?|skipping|burpees?|sprints?|sprinting|runs?|running)(-|$)/.test(e.id)
const P = (e: Ejercicio): Patron => patron(e)

/** Ejercicios que cargan cada zona y, si RepDB la marca, la etiqueta de los que la cuidan. */
// `estricta`: articulaciones sin etiqueta en RepDB cuya lista de «lo que más las carga» ya es precisa: con «regular»
// esos ejercicios solo salen si no queda otra cosa para el hueco (en las demás zonas, fuera los multiarticulares).
const ZONA: Record<ZonaDolor, { carga: (e: Ejercicio) => boolean; segura?: string; pesoEspalda?: boolean; estricta?: boolean }> = {
  cuello: { carga: e => tiene(e, ['trapezius']) || !sinCargaEspalda(e), pesoEspalda: true },
  hombros: { carga: e => ['empuje-v', 'empuje-h', 'hombro-lat', 'pecho-aisl'].includes(P(e)) || tiene(e, ['anterior_deltoid', 'lateral_deltoid']), segura: 'shoulder_safe' },
  codos: { carga: e => ZONA_EVITAR.codo!.test(e.id), estricta: true },
  munecas: { carga: e => ZONA_EVITAR.muneca!.test(e.id), estricta: true },
  manos: { carga: e => ZONA_EVITAR.muneca!.test(e.id) || /(grip|farmer|hang|pull-?up|chin-?up)/.test(e.id), estricta: true },
  lumbar: { carga: e => ['cadera', 'lumbar'].includes(P(e)) || !sinCargaEspalda(e), segura: 'lower_back_safe', pesoEspalda: true },
  caderas: { carga: e => ['cadera', 'gluteo', 'rodilla'].includes(P(e)) || conImpacto(e) },
  rodillas: { carga: e => ['rodilla', 'cuadriceps'].includes(P(e)) || conImpacto(e), segura: 'knee_safe', pesoEspalda: true },
  tobillos: { carga: e => conImpacto(e) || P(e) === 'gemelo', estricta: true },
  pies: { carga: e => conImpacto(e) || P(e) === 'gemelo', estricta: true },
  pecho: { carga: e => tiene(e, musculos('pecho')) },
  espalda: { carga: e => tiene(e, musculos('espalda')) },
  brazo: { carga: e => tiene(e, musculos('brazo')) },
  abdomen: { carga: e => tiene(e, musculos('abdomen')) || P(e) === 'core' },
  gluteo: { carga: e => tiene(e, musculos('gluteo')) },
  muslo: { carga: e => tiene(e, musculos('muslo')) },
  isquio: { carga: e => tiene(e, musculos('isquio')) },
  gemelo: { carga: e => tiene(e, musculos('gemelo')) },
  // Las que no son de un músculo cambian la sesión entera (más suave) o quitan un tipo de ejercicio.
  cabeza: { carga: e => e.fuerza === 'static' || e.categoria === 'olympic' },
  estomago: { carga: e => P(e) === 'core' || tiene(e, ['rectus_abdominis', 'obliques']) },
  hormigueo: { carga: e => !sinCargaEspalda(e), pesoEspalda: true },
  cansancio: { carga: () => false },
  fiebre: { carga: () => false },
}

/** ¿Este ejercicio carga la zona? (Para la revisión semanal: qué bloques suavizar.) */
export const cargaZona = (z: ZonaDolor, e: Ejercicio) => !!ZONA[z]?.carga(e)

export type Restricciones = {
  /** Motivo por el que un ejercicio no puede salir (o null si puede). */
  fuera: (e: Ejercicio) => string | null
  /** Puntos de menos al elegir (molestias leves). */
  penaliza: (e: Ejercicio) => number
  /** Esfuerzo máximo de la sesión (RPE) si alguna molestia o condición pide ir más suave. */
  rpeMax: number | null
  /** Segundos máximos en ejercicios de aguantar (tensión alta, dolor de cabeza). */
  maxIsometrico: number | null
}

/** Lo que las molestias y las condiciones de salud quitan o suavizan. */
export function restricciones(p: Pick<Perfil, 'dolores' | 'zonasSensibles' | 'creado' | 'condicionesSalud'>): Restricciones {
  const dolores = doloresDe(p)
  const cond = new Set(p.condicionesSalud ?? [])
  const reglas: ((e: Ejercicio) => string | null)[] = []
  const leves: ZonaDolor[] = []
  const ultimos: ZonaDolor[] = []
  let rpeMax: number | null = null
  let maxIsometrico: number | null = null
  const bajar = (r: number) => { rpeMax = rpeMax == null ? r : Math.min(rpeMax, r) }

  for (const d of dolores) {
    const z = ZONA[d.zona]
    if (!z) continue
    const nivel = nivelDolor(d)
    const nombre = d.zona
    if (d.zona === 'cabeza' || d.zona === 'cansancio' || d.zona === 'fiebre') bajar(nivel === 'menos' ? 7.5 : 7)
    if (d.zona === 'cabeza') maxIsometrico = Math.min(maxIsometrico ?? 30, 30)
    if (d.zona === 'hormigueo') { reglas.push(e => (z.carga(e) ? nombre : null)); continue }
    if (nivel === 'fuera') reglas.push(e => (z.carga(e) ? nombre : null))
    else if (nivel === 'seguro') {
      reglas.push(e => {
        if (!z.carga(e)) return null
        if (z.estricta) return null
        const malo = (z.segura && !e.etiquetas.includes(z.segura)) || (z.pesoEspalda && !sinCargaEspalda(e)) || (!z.segura && !z.pesoEspalda && e.mecanica === 'compound')
        return malo ? nombre : null
      })
      if (z.estricta) ultimos.push(d.zona)
    }
    else leves.push(d.zona)
  }

  if (cond.has('tension')) { bajar(8); maxIsometrico = Math.min(maxIsometrico ?? 30, 30); reglas.push(e => (e.categoria === 'olympic' || e.categoria === 'plyometrics' ? 'tension' : null)) }
  if (cond.has('osteoporosis')) reglas.push(e => (conImpacto(e) || (P(e) === 'core' && e.fuerza !== 'static' && !!e.material) ? 'osteoporosis' : null))
  if (cond.has('protesis')) reglas.push(e => (conImpacto(e) || (['rodilla', 'cadera'].includes(P(e)) && !e.etiquetas.includes('knee_safe')) ? 'protesis' : null))
  if (cond.has('anticoagulantes')) reglas.push(e => (conImpacto(e) || e.categoria === 'olympic' ? 'anticoagulantes' : null))
  if (cond.has('embarazo')) { bajar(7); reglas.push(e => (conImpacto(e) || e.categoria === 'olympic' || P(e) === 'core' ? 'embarazo' : null)) }

  return {
    fuera: e => { for (const r of reglas) { const m = r(e); if (m) return m } return null },
    penaliza: e => (ultimos.some(z => ZONA[z].carga(e)) ? 1000 : 0) + (leves.some(z => ZONA[z].carga(e)) ? 40 : 0),
    rpeMax,
    maxIsometrico,
  }
}

/** Qué hará la rutina con una molestia (la frase bajo los tres toques), y su tono. */
export function efectoDolor(d: Pick<Dolor, 'zona' | 'cuanto' | 'cuando' | 'desde'>): { texto: string; tono: '' | 'warn' | 'bad' } {
  const z = zonaDolor(d.zona)
  const fuerte = d.cuanto === 'mucho' || d.cuando === 'siempre'
  const tono = fuerte ? 'bad' : d.cuanto === 'regular' ? 'warn' : ''
  const nombre = z ? t(z.t).toLowerCase() : d.zona
  let texto: string
  if (d.zona === 'cabeza') texto = fuerte ? t('Si es fuerte, de golpe o con el esfuerzo: hoy no entrenes y ve al médico.') : t('Sesión más suave, sin aguantar la respiración ni esfuerzos largos quieto.')
  else if (d.zona === 'estomago') texto = t('Sin abdominales intensos ni ejercicios que aprieten la tripa. Mejor no entrenar recién comido.') + (fuerte ? ' ' + t('Si no se pasa, consúltalo con tu médico.') : '')
  else if (d.zona === 'hormigueo') texto = t('Fuera el peso sobre la espalda (sentadilla y peso muerto con barra). Coméntalo con tu médico.')
  else if (d.zona === 'cansancio') texto = fuerte ? t('Sesiones suaves hasta que se pase. Si dura semanas, consúltalo con tu médico.') : t('Sesiones algo más suaves esta temporada.')
  else if (d.zona === 'fiebre') texto = fuerte ? t('Con fiebre o dolor por todo el cuerpo, descansa. Vuelve cuando se pase.') : t('Si solo es de nariz y garganta, entreno suave si te apetece.')
  else if (fuerte) texto = t('Dejamos {zona} fuera de la rutina. Te recomendamos que lo vea tu médico o un fisio.', { zona: nombre })
  else if (d.cuanto === 'regular') texto = d.zona === 'rodillas' ? t('Solo ejercicios suaves para esta zona, sin peso sobre la espalda (prensa en vez de sentadilla con barra).') : t('Solo ejercicios suaves para esta zona, sin peso sobre la espalda.')
  else texto = t('Menos ejercicios que carguen esta zona. Te lo volvemos a preguntar en 2 semanas.')
  if (['munecas', 'codos', 'manos'].includes(d.zona) && !fuerte) texto += ' ' + t('Fuera flexiones, fondos y barra recta: agarres neutros, máquinas o mancuernas.')
  if (d.desde === 'meses' && !fuerte && z?.grupo !== 'otr') texto += ' ' + t('Si dura meses, conviene que lo mire un profesional.')
  return { texto, tono }
}

/** «Rodillas · lumbar · tensión alta»: resumen de la salud para Perfil, Generar y el PDF. */
export function resumenSalud(p: Pick<Perfil, 'dolores' | 'zonasSensibles' | 'creado' | 'condicionesSalud'>): string {
  const partes = [...doloresDe(p).map(d => nombreZonaDolor(d.zona)), ...(p.condicionesSalud ?? []).map(c => t(CONDICIONES.find(x => x.v === c)!.t).toLowerCase())]
  return partes.length ? partes.map((x, i) => (i ? x.toLowerCase() : x)).join(' · ') : ''
}
