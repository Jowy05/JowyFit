// «Empezar» en otro gimnasio: la sesión guarda el elegido, cambia lo que allí no se puede hacer por su alternativa
// (apuntado como cambio, sin tocar la rutina) y usa sus pesos. Y las cuentas puras que lo deciden.
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo } from './ayuda'
import { ejercicio, hayEn } from '../src/catalogo/catalogo'
import { alternativasDe } from '../src/dominio/generador'
import { TABLAS, db } from '../src/datos/db'
import { gimnasioNuevo, guardarAjustes, perfilPorDefecto, rutinaActiva } from '../src/datos/repos'
import { activarRutina } from '../src/datos/acciones/rutina'
import { cambiosEnGimnasio, iniciarEntreno } from '../src/datos/acciones/entreno'
import { bloquesDeVersion, cambiosPorMaterial, crearSesion, opcionesOcupado } from '../src/dominio/sesion'
import type { Bloque, DiaRutina, Gimnasio, Rutina } from '../src/datos/tipos'

const bloque = (uid: string, ejercicio: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const dia = (bloques: Bloque[]): DiaRutina => ({ letra: 'A', nombre: 'Cuerpo completo A', dia: null, opcional: false, bloques })

describe('qué se cambia por falta de material', () => {
  const hay = new Set(['b-ok', 'alt-ok', 'otra-ok'])
  const sePuede = (id: string) => (id.startsWith('raro') ? null : hay.has(id))
  it('el que no se puede hacer pasa a su primera alternativa posible; los demás, igual', () => {
    const bs = [bloque('1', 'b-ok'), bloque('2', 'b-no', { alternativas: ['alt-no', 'alt-ok'] })]
    expect([...cambiosPorMaterial(bs, sePuede, () => [])]).toEqual([['2', 'alt-ok']])
  })
  it('sin alternativa en el plan, busca otras; sin ninguna, se queda; uno desconocido no se toca', () => {
    const bs = [bloque('1', 'b-no'), bloque('2', 'c-no'), bloque('3', 'raro')]
    const m = cambiosPorMaterial(bs, sePuede, b => (b.uid === '1' ? ['otra-ok'] : ['nada']))
    expect([...m]).toEqual([['1', 'otra-ok']])
  })
  it('no repite un ejercicio que ya está en el día', () => {
    const bs = [bloque('1', 'alt-ok'), bloque('2', 'b-no', { alternativas: ['alt-ok', 'otra-ok'] }), bloque('3', 'c-no', { alternativas: ['otra-ok'] })]
    expect([...cambiosPorMaterial(bs, sePuede, () => [])]).toEqual([['2', 'otra-ok']])
  })
  it('la sesión hace la alternativa, apuntada como cambio, con su forma de apuntar y el peso que le toca', () => {
    const s = crearSesion(dia([bloque('1', 'press'), bloque('2', 'remo')]), {
      rutinaId: 1, gimnasioId: 7, version: 'normal', calibracion: false,
      cambios: new Map([['2', { ejercicio: 'flexiones', registro: 'corporal' }]]),
      sugerencias: new Map([['press', { peso: 40, reps: 8 }], ['flexiones', { peso: null, reps: 10 }]]),
    })
    expect(s.gimnasioId).toBe(7)
    expect(s.ejercicios[0]).toMatchObject({ ejercicio: 'press', planificado: 'press' })
    expect(s.ejercicios[0]!.motivo).toBeUndefined()
    expect(s.ejercicios[1]).toMatchObject({ ejercicio: 'flexiones', planificado: 'remo', motivo: 'cambio', registro: 'corporal', descanso: 90, rpe: 8 })
    expect(s.ejercicios[1]!.series[0]).toMatchObject({ peso: null, reps: 10 })
  })
})

describe('«Ocupado» con el gimnasio de hoy', () => {
  const vale = (id: string) => !id.endsWith('-no')
  it('si el de ahora vino de fuera del plan (ninguna del plan valía), sigue habiendo alternativas', () => {
    const e = { ejercicio: 'otra-1', planificado: 'plan-no', motivo: 'cambio' as const }
    const l = opcionesOcupado(e, ['alt1-no', 'alt2-no'], new Set(), vale, () => ['otra-1', 'otra-2', 'otra-3'])
    expect(l).toEqual(['otra-1', 'otra-2', 'otra-3'])
  })
  it('sin repetir lo que ya está en el entreno; el orden del plan se mantiene', () => {
    const e = { ejercicio: 'alt1', planificado: 'plan' }
    expect(opcionesOcupado(e, ['alt1', 'alt2', 'alt3'], new Set(['alt2']), vale, () => ['x'])).toEqual(['plan', 'alt1', 'alt3'])
    // Si tras el de ahora no queda nada del plan, se buscan más.
    expect(opcionesOcupado(e, ['alt1', 'alt2'], new Set(['alt2']), vale, () => ['alt2', 'x'])).toEqual(['plan', 'alt1', 'x'])
  })
})

describe('las versiones del día', () => {
  it('la corta quita los del final y la mínima deja lo más importante', () => {
    const d = dia([bloque('1', 'a'), bloque('2', 'b'), bloque('3', 'c', { fueraEnCorta: true })])
    expect(bloquesDeVersion(d, 'normal').map(b => b.uid)).toEqual(['1', '2', '3'])
    expect(bloquesDeVersion(d, 'corta').map(b => b.uid)).toEqual(['1', '2'])
    expect(bloquesDeVersion(d, 'minima').every(b => b.series <= 2)).toBe(true)
  })
  it('si la alternativa se apunta distinto (segundos), toma sus reps y descanso, no los del plan', () => {
    const s = crearSesion(dia([bloque('1', 'crunch', { repsMin: 10, repsMax: 15, descanso: 75 })]), {
      rutinaId: 1, gimnasioId: 1, version: 'normal', calibracion: false,
      cambios: new Map([['1', { ejercicio: 'plancha', registro: 'tiempo', pauta: { repsMin: 20, repsMax: 45, descanso: 60 } }]]),
    })
    expect(s.ejercicios[0]).toMatchObject({ ejercicio: 'plancha', planificado: 'crunch', registro: 'tiempo', repsMin: 20, repsMax: 45, descanso: 60, rpe: 8 })
    expect(s.ejercicios[0]!.series[0]).toMatchObject({ segundos: 20, reps: null })
  })
})

describe.skipIf(!hayCatalogo)('empezar en otro gimnasio', () => {
  if (hayCatalogo) catalogoReal()
  beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })
  const rutina = (): Omit<Rutina, 'id'> => ({
    creada: '2026-10-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: 1,
    dias: [dia([bloque('b1', 'leg-press'), bloque('b2', 'face-pull', { alternativas: [] }), bloque('b3', 'bench-press', { descanso: 150, rpe: 7 })])],
  })
  const gym = (nombre: string, x: Partial<Gimnasio>): Gimnasio => ({ ...gimnasioNuevo(nombre), ...x })

  it('por defecto, el activo: todo como en el plan', async () => {
    const casa = (await db.gimnasios.add(gym('Basic', {}))) as number
    await guardarAjustes({ gimnasioActivo: casa })
    await db.perfil.put(perfilPorDefecto())
    await activarRutina(rutina())
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A' })))!
    expect(s.gimnasioId).toBe(casa)
    expect(s.ejercicios.map(e => e.ejercicio)).toEqual(['leg-press', 'face-pull', 'bench-press'])
    // El descanso y el esfuerzo de cada ejercicio, los del plan.
    expect(s.ejercicios[2]).toMatchObject({ descanso: 150, rpe: 7 })
  })
  it('en el elegido: lo que allí no hay se cambia y la rutina no se toca', async () => {
    const casa = (await db.gimnasios.add(gym('Basic', {}))) as number
    // Sin prensa y con la polea sin cuerda.
    const hotel = (await db.gimnasios.add(gym('Hotel', { material: ['dumbbell', 'barbell', 'flat_bench', 'cable', 'polea-agarres'], discos: [2.5, 5, 10] }))) as number
    await guardarAjustes({ gimnasioActivo: casa })
    await db.perfil.put(perfilPorDefecto())
    await activarRutina(rutina())
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A', gimnasioId: hotel })))!
    expect(s.gimnasioId).toBe(hotel)
    const [prensa, face, banca] = s.ejercicios
    expect(prensa).toMatchObject({ planificado: 'leg-press', motivo: 'cambio' })
    expect(prensa!.ejercicio).not.toBe('leg-press')
    expect(face).toMatchObject({ planificado: 'face-pull', motivo: 'cambio' })
    expect(face!.ejercicio).not.toBe('face-pull')
    expect(banca).toMatchObject({ ejercicio: 'bench-press', planificado: 'bench-press' })
    expect(banca!.motivo).toBeUndefined()
    // Ningún ejercicio repetido en el día.
    expect(new Set(s.ejercicios.map(e => e.ejercicio)).size).toBe(3)
    expect((await rutinaActiva())!.dias[0]!.bloques.map(b => b.ejercicio)).toEqual(['leg-press', 'face-pull', 'bench-press'])
    // El activo sigue siendo el de siempre.
    expect((await db.ajustes.get('app'))!.gimnasioActivo).toBe(casa)
  })
  it('un gimnasio que ya no existe: el activo', async () => {
    const casa = (await db.gimnasios.add(gym('Basic', {}))) as number
    await guardarAjustes({ gimnasioActivo: casa })
    await activarRutina(rutina())
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A', gimnasioId: 999 })))!
    expect(s.gimnasioId).toBe(casa)
  })
  it('el aviso de «Empezar» cuenta lo mismo que cambia el entreno; un cambio de reps a segundos trae su pauta', () => {
    const hotel = gym('Hotel', { material: ['dumbbell', 'flat_bench', 'cable', 'polea-agarres'] })
    const d = dia([bloque('b1', 'leg-press'), bloque('b2', 'cable-crunch', { repsMin: 10, repsMax: 15 }), bloque('b3', 'bench-press', { fueraEnCorta: true })])
    const c = cambiosEnGimnasio(bloquesDeVersion(d, 'normal'), hotel, perfilPorDefecto(), new Map())
    expect(c.size).toBeGreaterThan(0)
    for (const [uid, x] of c) {
      const b = d.bloques.find(z => z.uid === uid)!
      if (x.registro !== b.registro) expect(x.pauta).toBeDefined()
      else expect(x.pauta).toBeUndefined()
    }
    // En la corta no cuenta el que se quita.
    const corta = cambiosEnGimnasio(bloquesDeVersion(d, 'corta'), hotel, perfilPorDefecto(), new Map())
    expect(corta.has('b3')).toBe(false)
  })
  it('sin nada del mismo patrón en el gimnasio (jalón sin polea ni barra), uno de un patrón parecido', () => {
    const casa = gym('Casa', { material: ['dumbbell', 'flat_bench'] })
    const d = dia([bloque('b1', 'lat-pulldown'), bloque('b2', 'single-arm-chest-supported-dumbbell-row')])
    const c = cambiosEnGimnasio(bloquesDeVersion(d, 'normal'), casa, perfilPorDefecto(), new Map())
    const otro = c.get('b1')?.ejercicio
    expect(otro).toBeDefined()
    expect(otro).not.toBe('single-arm-chest-supported-dumbbell-row')
    expect(hayEn(ejercicio(otro!)!, new Set(casa.material))).toBe(true)
  })
  it('«Ocupado» tras un cambio por material ofrece alternativas que se pueden hacer allí', async () => {
    const casa = (await db.gimnasios.add(gym('Basic', {}))) as number
    const hotel = (await db.gimnasios.add(gym('Hotel', { material: ['dumbbell', 'barbell', 'flat_bench', 'cable', 'polea-agarres'] }))) as number
    await guardarAjustes({ gimnasioActivo: casa })
    await db.perfil.put(perfilPorDefecto())
    await activarRutina(rutina())
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A', gimnasioId: hotel })))!
    const face = s.ejercicios[1]!
    expect(face.motivo).toBe('cambio')
    const g = (await db.gimnasios.get(hotel))!
    const material = new Set(g.material)
    const c = catalogoReal()
    const vale = (id: string) => { const x = c.ejercicios.find(z => z.id === id); return !!x && hayEn(x, material) }
    const enEntreno = new Set(s.ejercicios.filter((_, i) => i !== 1).map(x => x.ejercicio))
    const entrada = { perfil: perfilPorDefecto(), gimnasio: g, marcas: new Map(), ejercicios: c.ejercicios }
    const l = opcionesOcupado(face, [], enEntreno, vale, () => alternativasDe(face.ejercicio, entrada))
    expect(l[0]).toBe(face.ejercicio)
    expect(l.length).toBeGreaterThan(1)
    expect(l.slice(1).every(vale)).toBe(true)
  })
})
