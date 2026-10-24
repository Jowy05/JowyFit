// Grupos de material del catálogo y patrón de movimiento de cada ejercicio (generador de rutina y alternativas A → B → C).
// Los nombres van marcados con tk(): se traducen al pintarlos con t().
import type { Ejercicio } from './tipos'
import type { TipoRegistro } from '../datos/tipos'
import { tk } from '../i18n'

export const GRUPOS_MATERIAL: { id: string; nombre: string; claves: string[] }[] = [
  { id: 'libre', nombre: tk('Peso libre'), claves: ['dumbbell', 'barbell', 'ez_bar', 'trap_bar', 'kettlebell', 'plates', 'flat_bench', 'smith_machine'] },
  { id: 'poleas', nombre: tk('Poleas'), claves: ['cable'] },
  { id: 'pierna', nombre: tk('Máquinas de pierna'), claves: ['leg_press', 'hack_squat', 'leg_curl', 'leg_extension', 'standing_calf_raise_machine', 'seated_calf_raise_machine', 'donkey_calf_raise_machine', 'hip_abduction_machine', 'hip_adduction_machine', 'hip_thrust_machine', 'glute_ham_developer', 'back_extension_machine'] },
  { id: 'torso', nombre: tk('Máquinas de torso'), claves: ['chest_press_machine', 'chest_fly_machine', 'pec_deck', 'reverse_fly_machine', 'shoulder_press_machine', 'plate_loaded_lateral_raise_machine', 'lat_pulldown_machine', 'seated_row_machine', 'bicep_curl_machine', 'preacher_curl_machine', 'tricep_extension_machine', 'plate_loaded_dip_machine', 'shrug_machine', 'ab_crunch_machine'] },
  { id: 'dominadas', nombre: tk('Dominadas y fondos'), claves: ['pull_up_bar', 'dip_station', 'assisted_pullup_machine', 'dip_machine', 'rings', 'climbing_rope'] },
  { id: 'cardio', nombre: tk('Cardio'), claves: ['treadmill', 'stationary_bike', 'air_bike', 'elliptical', 'rower', 'stair_climber', 'ski_erg', 'jump_rope', 'sled', 'battle_rope'] },
  { id: 'accesorios', nombre: tk('Accesorios'), claves: ['resistance_band', 'loop_band', 'suspension_trainer', 'stability_ball', 'ab_wheel', 'plyo_box', 'slam_ball', 'wrist_roller'] },
]

export const TODAS_LAS_CLAVES = GRUPOS_MATERIAL.flatMap(g => g.claves)

export type Patron =
  | 'rodilla' | 'cadera' | 'empuje-h' | 'empuje-v' | 'tiron-h' | 'tiron-v'
  | 'cuadriceps' | 'femoral' | 'gluteo' | 'gemelo' | 'pecho-aisl' | 'hombro-lat' | 'hombro-post' | 'trapecio'
  | 'biceps' | 'triceps' | 'antebrazo' | 'core' | 'lumbar' | 'completo' | 'cardio' | 'estiramiento' | 'potencia'

export const NOMBRE_PATRON: Record<Patron, string> = {
  rodilla: tk('Pierna (rodilla)'), cadera: tk('Pierna (cadera)'), 'empuje-h': tk('Empuje horizontal'), 'empuje-v': tk('Empuje vertical'),
  'tiron-h': tk('Remo'), 'tiron-v': tk('Tirón vertical'), cuadriceps: tk('Cuádriceps'), femoral: tk('Femoral'), gluteo: tk('Glúteo'), gemelo: tk('Gemelo'),
  'pecho-aisl': tk('Pecho'), 'hombro-lat': tk('Hombro lateral'), 'hombro-post': tk('Hombro posterior'), trapecio: tk('Trapecio'), biceps: tk('Bíceps'),
  triceps: tk('Tríceps'), antebrazo: tk('Antebrazo'), core: tk('Core'), lumbar: tk('Lumbar'), completo: tk('Cuerpo completo'), cardio: tk('Cardio'),
  estiramiento: tk('Estiramiento'), potencia: tk('Potencia'),
}

const tiene = (e: Ejercicio, m: string) => e.principales.includes(m)
const VERTICAL = /(pull-?ups?|chin-?ups?|pulldown|pull-down|muscle-up|rope-climb)/

export function patron(e: Ejercicio): Patron {
  if (e.categoria === 'stretching') return 'estiramiento'
  if (e.categoria === 'cardio') return 'cardio'
  if (e.categoria === 'olympic' || e.categoria === 'plyometrics') return 'potencia'
  const aisl = e.mecanica === 'isolation'
  switch (e.zona) {
    case 'upper_legs':
      if (tiene(e, 'quadriceps')) return aisl ? 'cuadriceps' : 'rodilla'
      if (tiene(e, 'hamstrings') && aisl) return 'femoral'
      if (tiene(e, 'abductors') || tiene(e, 'adductors') || (aisl && tiene(e, 'gluteus_maximus'))) return 'gluteo'
      return 'cadera'
    case 'lower_legs': return 'gemelo'
    case 'chest': return aisl ? 'pecho-aisl' : 'empuje-h'
    case 'shoulders':
      if (tiene(e, 'lateral_deltoid') && aisl) return 'hombro-lat'
      if (tiene(e, 'posterior_deltoid')) return 'hombro-post'
      if (tiene(e, 'trapezius')) return 'trapecio'
      return e.fuerza === 'pull' ? 'hombro-post' : 'empuje-v'
    case 'back':
      if (tiene(e, 'erector_spinae') && !tiene(e, 'latissimus_dorsi')) return 'lumbar'
      if (tiene(e, 'trapezius') && aisl) return 'trapecio'
      if (VERTICAL.test(e.id) || ['pull_up_bar', 'assisted_pullup_machine', 'lat_pulldown_machine', 'climbing_rope'].includes(e.material ?? '')) return 'tiron-v'
      return 'tiron-h'
    case 'upper_arms':
      if (tiene(e, 'triceps_brachii')) return 'triceps'
      return 'biceps'
    case 'lower_arms': return 'antebrazo'
    case 'core': return 'core'
    default: return 'completo'
  }
}

// Barra, paralelas, anillas, TRX y cuerda: se cuelga o se empuja el propio cuerpo. RepDB no los marca como peso corporal,
// pero apuntarles kilos no tiene sentido (los lastrados, «weighted-…», sí llevan peso).
const APARATOS_DE_CALISTENIA = new Set(['pull_up_bar', 'dip_station', 'rings', 'suspension_trainer', 'climbing_rope'])

/** Cómo se apunta cada serie de este ejercicio. */
export function tipoRegistro(e: Ejercicio): TipoRegistro {
  if (e.propio) return e.propio.registro === 'peso' && e.propio.material === 'mancuernas' ? 'mancuerna' : e.propio.registro
  if (e.categoria === 'cardio') return 'cardio'
  if (e.material === 'assisted_pullup_machine' || e.material === 'dip_machine' || /assisted/.test(e.id)) return 'asistido'
  if (e.fuerza === 'static' || /(plank|-hold$|dead-hang|wall-sit|l-sit)/.test(e.id)) return 'tiempo'
  if (APARATOS_DE_CALISTENIA.has(e.material ?? '') && !/^weighted-/.test(e.id)) return 'corporal'
  if (e.material === 'dumbbell' || e.material === 'kettlebell') return 'mancuerna'
  if (!e.material || e.pesoCorporal) return 'corporal'
  return 'peso'
}

/** Ejercicios conocidos y fiables: el generador los prefiere a variantes raras. */
export const HABITUALES: string[] = [
  'squat', 'leg-press', 'smith-machine-squat', 'hack-squat', 'bulgarian-split-squat', 'goblet-squat',
  'romanian-deadlift', 'deadlift', 'hip-thrust', 'leg-curl', 'seated-leg-curl', 'dumbbell-romanian-deadlift',
  'bench-press', 'incline-db-press', 'chest-press-machine', 'close-grip-db-bench-press', 'smith-machine-incline-bench-press', 'incline-bench-press', 'push-up', 'dips',
  'machine-shoulder-press', 'seated-barbell-overhead-press', 'dumbbell-shoulder-press', 'smith-machine-shoulder-press', 'arnold-press',
  'lat-pulldown', 'assisted-pull-ups', 'neutral-grip-pull-ups', 'chin-ups', 'negative-pull-ups', 'close-grip-lat-pulldown',
  'seated-cable-row', 'chest-supported-machine-row', 'barbell-row', 'single-arm-chest-supported-dumbbell-row', 'reverse-grip-lat-pulldown', 'cable-bent-over-row',
  'lateral-raise', 'cable-lateral-raise', 'face-pull', 'rear-delt-fly', 'machine-reverse-fly',
  'bicep-curl', 'hammer-curl', 'incline-db-curl', 'cable-curl', 'ez-bar-curl', 'seated-dumbbell-curl',
  'tricep-pushdown', 'cable-overhead-tricep-extension', 'overhead-tricep-extension', 'skull-crusher', 'close-grip-bench-press',
  'cable-crunch', 'plank', 'hanging-leg-raise', 'ab-wheel-rollout', 'dead-bug', 'cable-pallof-press', 'side-plank',
  'machine-calf-raise', 'standing-calf-raise', 'seated-calf-raise',
]

export const ES_MAQUINA = (e: Ejercicio) => !!e.material && (e.material.includes('machine') || ['cable', 'smith_machine', 'leg_press', 'hack_squat', 'leg_curl', 'leg_extension', 'pec_deck', 'glute_ham_developer'].includes(e.material))
export const ES_LIBRE = (e: Ejercicio) => ['barbell', 'dumbbell', 'ez_bar', 'trap_bar', 'kettlebell'].includes(e.material ?? '')

/** Etiquetas de RepDB en español (las que se muestran). */
export const ETIQUETAS_ES: Record<string, string> = {
  knee_safe: tk('Cuida la rodilla'), no_axial_load: tk('Sin carga en la columna'), lower_back_safe: tk('Cuida la lumbar'), shoulder_safe: tk('Cuida el hombro'),
  leg_day: tk('Día de pierna'), calisthenics: tk('Calistenia'), mobility: tk('Movilidad'), stretching: tk('Estiramiento'), requires_bench: tk('Necesita banco'),
  push_day: tk('Empuje'), pull_day: tk('Tirón'), core: tk('Core'), arm_day: tk('Brazos'), full_body: tk('Cuerpo completo'), glute_focus: tk('Glúteo'),
  core_focus: tk('Core'), conditioning: tk('Acondicionamiento'), shoulder_focus: tk('Hombro'), warm_up: tk('Calentamiento'), grip_focus: tk('Agarre'),
  shoulder_stability: tk('Estabilidad de hombro'), bodyweight: tk('Peso corporal'), powerlifting: tk('Powerlifting'), big_three: tk('Básico'), chest_focus: tk('Pecho'),
}

/** Zona sensible del perfil → etiqueta de RepDB que debe tener el ejercicio para proponerlo. */
export const ZONA_SEGURA: Record<string, string> = { rodilla: 'knee_safe', lumbar: 'lower_back_safe', hombro: 'shoulder_safe' }

/** Zonas sin etiqueta en RepDB: se apartan los ejercicios que más las cargan (por id). */
export const ZONA_EVITAR: Record<string, RegExp> = {
  codo: /skull|triceps-extension|overhead-triceps|french-press|close-grip-(?:[a-z-]*bench|[a-z-]*press|push)|(?:^|-)dips?(?:$|-)|dip-machine/,
  muneca: /push-?ups?(?:$|-)|front-squat|wrist-curl|(?:^|-)clean(?:$|-)|snatch|handstand|(?:^|-)barbell-curl|straight-bar|(?:^|-)dips?(?:$|-)/,
}
