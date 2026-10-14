// Primera vez sin historial ni referencia: peso de partida sugerido para que «Hecho» funcione a la primera.
import { beforeAll, describe, expect, it } from 'vitest'
import { conPartida, pesoPartida, sugerir, TEXTO_PARTIDA } from '../src/dominio/progresion'
import { pesosBarra, pesosPara } from '../src/dominio/pesos'
import { gimnasioNuevo } from '../src/datos/repos'
import { sugerenciaPara } from '../src/datos/consultas'
import { crearSesion } from '../src/dominio/sesion'
import type { Bloque, DiaRutina, Gimnasio, Sesion, TipoRegistro } from '../src/datos/tipos'
import { catalogoReal, hayCatalogo } from './ayuda'

const gym = (cambios: Partial<Gimnasio> = {}): Gimnasio => ({ ...gimnasioNuevo(), id: 1, ...cambios })
const obj = { repsMin: 8, repsMax: 12, rpe: 7 }

describe('pesoPartida', () => {
  it('barra: la barra vacía (la del gimnasio, o la típica si no hay gimnasio)', () => {
    expect(pesoPartida('barbell', 'peso', pesosPara('barbell', 'peso', gym()))).toBe(20)
    expect(pesoPartida('barbell', 'peso', pesosPara('barbell', 'peso', gym({ barraKg: 15 })))).toBe(15)
    expect(pesoPartida('barbell', 'peso', pesosPara('barbell', 'peso', null))).toBe(20)
    expect(pesoPartida('ez_bar', 'peso', pesosPara('ez_bar', 'peso', gym()))).toBe(10)
    expect(pesoPartida('smith_machine', 'peso', pesosPara('smith_machine', 'peso', gym()))).toBe(15)
    expect(pesoPartida('barbell', 'peso', [])).toBe(20)
  })
  it('mancuernas: la más ligera razonable de las que hay, nunca 0', () => {
    expect(pesoPartida('dumbbell', 'mancuerna', pesosPara('dumbbell', 'mancuerna', gym()))).toBe(4)
    // El gimnasio empieza en 6 kg: la más ligera que hay.
    expect(pesoPartida('dumbbell', 'mancuerna', pesosPara('dumbbell', 'mancuerna', gym({ mancuernas: [{ desde: 6, hasta: 30, paso: 2 }] })))).toBe(6)
    // Solo hay mancuernas pequeñas: la más pesada de ellas.
    expect(pesoPartida('dumbbell', 'mancuerna', [1, 2, 3])).toBe(3)
    // Sin gimnasio (lista de 2,5 en 2,5 desde 0): 5 kg, no 0.
    expect(pesoPartida('dumbbell', 'mancuerna', pesosPara('dumbbell', 'mancuerna', null))).toBe(5)
  })
  it('máquinas y poleas: ~10 kg aunque la lista empiece en 0', () => {
    const lista = pesosPara('cable', 'peso', gym())
    expect(lista[0]).toBe(0)
    expect(pesoPartida('cable', 'peso', lista)).toBe(10)
    expect(pesoPartida('leg_press', 'peso', pesosPara('leg_press', 'peso', gym()))).toBe(10)
    expect(pesoPartida(null, 'peso', [0, 5, 7.5, 12])).toBe(12)
  })
  it('corporal, tiempo, cardio y asistidos: sin cambios (null)', () => {
    for (const r of ['corporal', 'tiempo', 'cardio', 'asistido'] as TipoRegistro[]) expect(pesoPartida('assisted_pullup_machine', r, pesosPara('assisted_pullup_machine', r))).toBeNull()
  })
  it('siempre un peso de la lista, mayor que 0, para muchas combinaciones', () => {
    const listas = [
      pesosBarra(20, [1.25, 2.5, 5, 10, 15, 20]), pesosBarra(10, [2.5, 5]), pesosPara('cable', 'peso'),
      pesosPara('dumbbell', 'mancuerna', gym()), [2.5], [0, 2.5], [0.5, 1, 1.5],
    ]
    for (const l of listas) for (const m of ['barbell', 'ez_bar', 'dumbbell', 'cable', 'plates', null]) for (const r of ['peso', 'mancuerna'] as const) {
      const p = pesoPartida(m, r, l)!
      expect(p).toBeGreaterThan(0)
      if (l.some(v => v > 0)) expect(l).toContain(p)
    }
  })
})

describe('conPartida', () => {
  it('solo rellena la primera vez sin peso, con el texto para empezar', () => {
    const lista = pesosPara('barbell', 'peso', gym())
    const s = conPartida(sugerir(null, obj, 'peso', lista), 'barbell', 'peso', lista)
    expect(s).toMatchObject({ accion: 'primera', peso: 20, partida: true, texto: TEXTO_PARTIDA })
    expect(TEXTO_PARTIDA).toBe('Empieza con este y súbelo si va fácil')
    // Con historial no toca nada.
    const conHist = sugerir([{ n: 1, peso: 40, reps: 10, rpe: 8, calentamiento: false, hecha: true }], obj, 'peso', lista)
    expect(conPartida(conHist, 'barbell', 'peso', lista)).toBe(conHist)
    // Corporal: sigue sin peso.
    const corp = sugerir(null, obj, 'corporal', [])
    expect(conPartida(corp, null, 'corporal', []).peso).toBeNull()
  })
})

describe.skipIf(!hayCatalogo)('sugerenciaPara con el catálogo real', () => {
  beforeAll(() => { catalogoReal() })
  const g = gym()
  it('sin historial ni referencia: barra vacía, mancuerna ligera, ~10 kg en polea', async () => {
    expect((await sugerenciaPara('squat', obj, g, undefined, [], {})).peso).toBe(20)
    expect((await sugerenciaPara('bicep-curl', obj, g, undefined, [], {})).peso).toBe(4)
    expect((await sugerenciaPara('lat-pulldown', obj, g, undefined, [], {})).peso).toBe(10)
    const s = await sugerenciaPara('squat', obj, g, undefined, [], {})
    expect(s.partida).toBe(true)
    expect(s.texto).toBe(TEXTO_PARTIDA)
  })
  it('corporales y asistidos siguen igual (sin peso)', async () => {
    expect((await sugerenciaPara('push-up', obj, g, undefined, [], {})).peso).toBeNull()
    expect((await sugerenciaPara('assisted-pull-ups', obj, g, undefined, [], {})).peso).toBeNull()
  })
  it('la referencia del perfil manda sobre el peso de partida', async () => {
    const s = await sugerenciaPara('bench-press', obj, g, undefined, [], { banca: '60 kg × 8' })
    expect(s.partida).toBeUndefined()
    expect(s.peso!).toBeGreaterThan(20)
  })
  it('el historial manda sobre el peso de partida', async () => {
    const hecha: Sesion = {
      id: 7, fecha: '2026-10-01', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: 1, inicio: 1, version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: [{ uid: 'a', ejercicio: 'squat', planificado: 'squat', estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 7, descanso: 90, registro: 'peso',
        series: [1, 2, 3].map(n => ({ n, peso: 50, reps: 9, rpe: 8, calentamiento: false, hecha: true })) }],
    }
    const s = await sugerenciaPara('squat', obj, g, undefined, [hecha], {})
    expect(s.partida).toBeUndefined()
    expect(s.peso).toBe(50)
  })
  it('la sesión nueva sale con peso en las series: «Hecho» funciona a la primera', async () => {
    const b = (id: string, registro: TipoRegistro): Bloque => ({ uid: id, ejercicio: id, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 7, descanso: 90, registro })
    const dia: DiaRutina = { letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques: [b('squat', 'peso'), b('bicep-curl', 'mancuerna'), b('push-up', 'corporal')] }
    const sug = new Map<string, { peso: number | null; reps: number | null }>()
    for (const x of dia.bloques) sug.set(x.ejercicio, await sugerenciaPara(x.ejercicio, x, g, undefined, [], {}))
    const s = crearSesion(dia, { rutinaId: 1, gimnasioId: 1, version: 'normal', calibracion: true, sugerencias: sug })
    expect(s.ejercicios[0]!.series.every(x => x.peso === 20)).toBe(true)
    expect(s.ejercicios[1]!.series.every(x => x.peso === 4)).toBe(true)
    expect(s.ejercicios[2]!.series.every(x => x.peso === null)).toBe(true)
  })
})
