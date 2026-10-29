// Los seis grupos de «¿Qué no quieres hacer?» sobre los datos de RepDB (categoría, material y etiquetas).
import type { Ejercicio } from './tipos'
import type { GrupoNoQuiero } from '../datos/tipos'
import { esCalistenia, esCardio } from './catalogo'
import { ES_LIBRE } from './clasificacion'
import { tk } from '../i18n'

export const GRUPOS_NO_QUIERO: { v: GrupoNoQuiero; t: string; ico: string }[] = [
  { v: 'cardio', t: tk('Cardio'), ico: 'person-simple-run' },
  { v: 'corporal', t: tk('Con tu peso'), ico: 'person-arms-spread' },
  { v: 'maquinas', t: tk('Máquinas'), ico: 'gear-six' },
  { v: 'libre', t: tk('Barras y mancuernas'), ico: 'barbell' },
  { v: 'poleas', t: tk('Poleas'), ico: 'arrows-down-up' },
  { v: 'suelo', t: tk('En el suelo'), ico: 'person-simple' },
]

export const NOMBRE_NO_QUIERO = Object.fromEntries(GRUPOS_NO_QUIERO.map(g => [g.v, g.t])) as Record<GrupoNoQuiero, string>

const MAQUINAS_SIN_MACHINE = ['smith_machine', 'leg_press', 'hack_squat', 'leg_curl', 'leg_extension', 'pec_deck', 'glute_ham_developer']
// Lo que se hace tumbado o de rodillas en el suelo: RepDB no lo marca, se reconoce por el nombre (en inglés, el id).
const EN_EL_SUELO = /(crunch|plank|bridge|dead-bug|bird-dog|lying|floor|sit-?up|(?<!hanging-)leg-raise|mountain-climber|push-?up|superman|v-up|russian-twist|hollow|flutter-kick|scissor|side-lying|clamshell|fire-hydrant|donkey-kick)/

/** ¿Es este ejercicio del grupo? Los propios, por el material que eligió el usuario. */
export function deGrupo(e: Ejercicio, g: GrupoNoQuiero): boolean {
  if (e.propio) {
    const m = e.propio.material
    if (g === 'cardio') return e.propio.registro === 'cardio'
    if (g === 'corporal') return m === 'corporal'
    if (g === 'maquinas') return m === 'maquina'
    if (g === 'libre') return m === 'barra' || m === 'mancuernas'
    if (g === 'poleas') return m === 'polea'
    return false
  }
  switch (g) {
    case 'cardio': return esCardio(e)
    case 'corporal': return esCalistenia(e) || (!e.material && e.categoria !== 'cardio' && e.categoria !== 'stretching')
    case 'maquinas': return !!e.material && (e.material.includes('machine') || MAQUINAS_SIN_MACHINE.includes(e.material))
    case 'libre': return ES_LIBRE(e)
    case 'poleas': return e.material === 'cable'
    case 'suelo': return !e.material || e.material === 'stability_ball' || e.material === 'ab_wheel' ? EN_EL_SUELO.test(e.id) : false
  }
}

/** ¿Lo quita «¿Qué no quieres hacer?»? */
export const quitadoPor = (e: Ejercicio, noQuiero: readonly GrupoNoQuiero[] | undefined) => !!noQuiero?.some(g => deGrupo(e, g))
