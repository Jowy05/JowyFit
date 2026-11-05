// Material del gimnasio: accesorios de la polea (lo que RepDB no separa), las barras, el tope de esfuerzo a mano y
// editar un bloque del plan (descanso y esfuerzo por ejercicio, y su pareja de superserie).
import { describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import type { Ejercicio } from '../src/catalogo/tipos'
import type { Bloque } from '../src/datos/tipos'
import { ACCESORIOS_POLEA, AGARRE_BASICO, accesoriosDe, conmutarMaterial, conmutarVarios, esAccesorioPolea, materialConAccesorios, materialEfectivo, NOMBRE_BARRA, tieneAccesorio } from '../src/catalogo/material'
import { hayEn, nombreMaterial } from '../src/catalogo/catalogo'
import { GRUPOS_MATERIAL, TODAS_LAS_CLAVES } from '../src/catalogo/clasificacion'
import { alternativasDe, generarRutina } from '../src/dominio/generador'
import { editarBloque, unirConSiguiente } from '../src/dominio/rutina'
import { esfuerzoMaximo } from '../src/dominio/salud'
import { gimnasioNuevo, perfilPorDefecto } from '../src/datos/repos'

const ejer = (id: string, material: string | null = 'cable', x: Partial<Ejercicio> = {}): Ejercicio => ({
  id, nombre: id, descripcion: '', instrucciones: [], consejos: [], categoria: 'strength', fuerza: 'pull', mecanica: 'isolation', dificultad: 'beginner',
  material, zona: 'upper_arms', principales: ['triceps_brachii'], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false,
  poses: ['main'], met: 4, ...x,
})
const bloque = (uid: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })

describe('accesorios de polea', () => {
  it('cada ejercicio pide lo suyo; los jalones con la barra de la máquina y los que no son de polea, nada', () => {
    expect(accesoriosDe(ejer('face-pull'))).toEqual(['polea-cuerda'])
    expect(accesoriosDe(ejer('tricep-pushdown'))).toEqual(['polea-cuerda', 'polea-barra-recta', 'polea-barra-v'])
    expect(accesoriosDe(ejer('cable-kickback'))).toEqual(['polea-tobilleras'])
    expect(accesoriosDe(ejer('v-bar-lat-pulldown', 'lat_pulldown_machine'))).toEqual(['polea-barra-v'])
    // De polea sin nada especial: un agarre suelto.
    expect(accesoriosDe(ejer('cable-fly'))).toEqual(['polea-agarres'])
    expect(accesoriosDe(ejer('lat-pulldown'))).toEqual([])
    expect(accesoriosDe(ejer('bench-press', 'barbell'))).toEqual([])
    // Uno propio de polea: el usuario lo creó para lo que tiene.
    expect(accesoriosDe(ejer('mio-1', 'cable', { propio: { id: 'mio-1', nombre: 'x', grupo: 'brazo', material: 'polea', registro: 'peso', rutinaAuto: true, creado: '2026-10-01' } }))).toEqual([])
  })
  it('sin ningún accesorio marcado (gimnasios de antes) se entiende que tiene todos', () => {
    const viejo = new Set(['cable'])
    expect(tieneAccesorio(ejer('face-pull'), viejo)).toBe(true)
    expect(hayEn(ejer('face-pull'), viejo)).toBe(true)
  })
  it('con accesorios marcados, solo lo que se puede hacer con ellos (vale cualquiera de los que pide)', () => {
    const m = new Set(['cable', 'polea-agarres', 'polea-barra-recta'])
    expect(hayEn(ejer('face-pull'), m)).toBe(false)
    expect(hayEn(ejer('tricep-pushdown'), m)).toBe(true)
    expect(hayEn(ejer('cable-fly'), m)).toBe(true)
    expect(hayEn(ejer('cable-kickback'), m)).toBe(false)
    expect(hayEn(ejer('lat-pulldown'), m)).toBe(true)
    // Sin la polea, nada de polea, tenga los accesorios que tenga.
    expect(hayEn(ejer('cable-fly'), new Set(['polea-agarres']))).toBe(false)
    // Lo que no es de polea no cambia.
    expect(hayEn(ejer('dips', null), m)).toBe(true)
  })
  it('las tarjetas ven todos marcados si no había ninguno', () => {
    expect(materialEfectivo(['cable'])).toEqual(['cable', ...ACCESORIOS_POLEA])
    expect(materialEfectivo(['cable', 'polea-cuerda'])).toEqual(['cable', 'polea-cuerda'])
  })
  it('quitar uno parte de lo que se ve; nunca se quedan todos fuera (se queda el agarre)', () => {
    const sinCuerda = conmutarMaterial(['cable'], 'polea-cuerda')
    expect(sinCuerda).toEqual(['cable', 'polea-agarres', 'polea-barra-recta', 'polea-barra-v', 'polea-tobilleras'])
    expect(conmutarMaterial(sinCuerda, 'polea-cuerda')).toContain('polea-cuerda')
    expect(conmutarMaterial(['cable', 'polea-tobilleras'], 'polea-tobilleras')).toEqual(['cable', 'polea-agarres'])
    expect(conmutarMaterial(['cable', 'polea-agarres'], 'polea-agarres')).toEqual(['cable', 'polea-agarres'])
    // Lo que no es accesorio, como siempre.
    expect(conmutarMaterial(['cable'], 'cable')).toEqual([])
    expect(conmutarMaterial([], 'barbell')).toEqual(['barbell'])
  })
  it('en el catálogo: la polea con sus accesorios, las barras aparte, sin claves repetidas, y el gimnasio completo con todo', () => {
    expect(GRUPOS_MATERIAL.find(g => g.id === 'poleas')!.claves).toEqual(['cable', ...ACCESORIOS_POLEA])
    expect(GRUPOS_MATERIAL.find(g => g.id === 'barras')!.claves).toEqual(['barbell', 'ez_bar', 'trap_bar'])
    expect(Object.keys(NOMBRE_BARRA).sort()).toEqual(['barbell', 'ez_bar', 'trap_bar'])
    for (const a of ACCESORIOS_POLEA) expect(TODAS_LAS_CLAVES).toContain(a)
    expect(esAccesorioPolea('polea-cuerda')).toBe(true)
    expect(esAccesorioPolea('cable')).toBe(false)
    expect(nombreMaterial('polea-cuerda')).toBe('Cuerda')
  })
})

describe.skipIf(!hayCatalogo)('accesorios con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  it('cada ejercicio de la tabla existe en RepDB (si cambia un id, la tabla se queda vieja)', () => {
    const ids = new Set(c!.ejercicios.map(e => e.id))
    for (const id of ['face-pull', 'tricep-pushdown', 'v-bar-tricep-pushdown', 'v-bar-lat-pulldown', 'close-grip-lat-pulldown', 'seated-cable-row', 'cable-kickback', 'straight-bar-cable-front-raise', 'cable-crunch', 'lat-pulldown']) expect(ids.has(id), id).toBe(true)
  })
  it('el generador y las alternativas no proponen lo que pide un accesorio que no hay', () => {
    const material = [...gimnasioNuevo().material, 'polea-agarres']
    const gym = { ...gimnasioNuevo(), id: 1, material }
    const r = generarRutina({ perfil: perfilEjemplo(), gimnasio: gym, marcas: new Map(), ejercicios: c!.ejercicios })
    const usados = r.dias.flatMap(d => d.bloques.flatMap(b => [b.ejercicio, ...b.alternativas]))
    const set = new Set(material)
    for (const id of usados) {
      const e = c!.ejercicios.find(x => x.id === id)!
      expect(hayEn(e, set), id).toBe(true)
    }
    expect(usados).not.toContain('face-pull')
    expect(alternativasDe('lat-pulldown', { perfil: perfilEjemplo(), gimnasio: gym, marcas: new Map(), ejercicios: c!.ejercicios })).not.toContain('close-grip-lat-pulldown')
  })
  it('con todos los accesorios, la rutina sale igual que sin marcar ninguno', () => {
    const base = { ...gimnasioNuevo(), id: 1 }
    const sin = generarRutina({ perfil: perfilEjemplo(), gimnasio: base, marcas: new Map(), ejercicios: c!.ejercicios })
    const con = generarRutina({ perfil: perfilEjemplo(), gimnasio: { ...base, material: [...base.material, ...ACCESORIOS_POLEA] }, marcas: new Map(), ejercicios: c!.ejercicios })
    const ids = (r: typeof sin) => r.dias.map(d => d.bloques.map(b => [b.ejercicio, ...b.alternativas]))
    expect(ids(con)).toEqual(ids(sin))
  })
})

describe('descanso y esfuerzo por ejercicio en Editar plan', () => {
  it('cambia solo ese bloque', () => {
    const bs = [bloque('a'), bloque('b')]
    const out = editarBloque(bs, 'a', { descanso: 150, rpe: 7 })
    expect(out[0]).toMatchObject({ descanso: 150, rpe: 7 })
    expect(out[1]).toMatchObject({ descanso: 90, rpe: 8 })
    expect(bs[0]!.descanso).toBe(90) // sin tocar el original
  })
  it('en «dos seguidos» la pareja comparte el descanso y las series, pero no el esfuerzo ni las reps', () => {
    const bs = [bloque('a', { superserie: 'b' }), bloque('b', { superserie: 'a' })]
    const out = editarBloque(bs, 'a', { descanso: 60, rpe: 9, repsMin: 10, repsMax: 15 })
    expect(out[1]).toMatchObject({ descanso: 60, rpe: 8, repsMin: 8 })
    expect(editarBloque(bs, 'b', { series: 4 })[0]!.series).toBe(4)
    expect(editarBloque(bs, 'b', { rpe: 6 })[0]).toBe(bs[0])
  })
  it('el tope de esfuerzo a mano es el del generador: por nivel, modo mayor y salud', () => {
    expect(esfuerzoMaximo({ ...perfilPorDefecto(), nivel: 'intermedio' })).toBe(9)
    expect(esfuerzoMaximo({ ...perfilPorDefecto(), nivel: 'empiezo' })).toBe(8)
    expect(esfuerzoMaximo({ ...perfilPorDefecto(), nivel: 'avanzado', modoMayor: { activo: true } })).toBe(8)
    expect(esfuerzoMaximo({ ...perfilPorDefecto(), nivel: 'avanzado', condicionesSalud: ['embarazo'] })).toBe(7)
  })
})

describe('«Marcar todo» y «Quitar todo» de un grupo', () => {
  it('quitar todos los accesorios que se ven deja el agarre suelto: nunca vuelve a «todos»', () => {
    // Sin accesorios guardados se ven todos: quitarlos de golpe no puede dejar la lista igual que antes.
    expect(conmutarVarios(['cable'], ACCESORIOS_POLEA, false)).toEqual(['cable', AGARRE_BASICO])
    // Con la búsqueda («barra») solo se ven dos: se quitan esos y los demás siguen.
    const fuera = conmutarVarios(['cable'], ['polea-barra-recta', 'polea-barra-v'], false)
    expect(fuera.filter(esAccesorioPolea).sort()).toEqual(['polea-agarres', 'polea-cuerda', 'polea-tobilleras'])
    // Si los guardados eran justo esos dos, queda el agarre (vacío contaría como todos).
    expect(conmutarVarios(['cable', 'polea-barra-recta', 'polea-barra-v'], ['polea-barra-recta', 'polea-barra-v'], false)).toEqual(['cable', AGARRE_BASICO])
  })
  it('marcar todo suma lo que se ve; sin accesorios, como siempre', () => {
    expect(conmutarVarios(['cable', 'polea-cuerda'], ['polea-barra-recta', 'polea-barra-v'], true).sort()).toEqual(['cable', 'polea-barra-recta', 'polea-barra-v', 'polea-cuerda'])
    expect(conmutarVarios(['dumbbell'], ['barbell', 'ez_bar'], true)).toEqual(['dumbbell', 'barbell', 'ez_bar'])
    expect(conmutarVarios(['dumbbell', 'barbell', 'ez_bar'], ['barbell', 'ez_bar'], false)).toEqual(['dumbbell'])
  })
})

describe('qué material enseña los accesorios', () => {
  it('la polea y también la máquina de jalón (su jalón con barra en V pide el triángulo)', () => {
    const m = materialConAccesorios([ejer('face-pull'), ejer('v-bar-lat-pulldown', 'lat_pulldown_machine'), ejer('lat-pulldown'), ejer('bench-press', 'barbell')])
    expect([...m].sort()).toEqual(['cable', 'lat_pulldown_machine'])
  })
})

describe('juntar dos seguidos', () => {
  it('el segundo toma las series, el descanso y «quitar con prisa» del primero', () => {
    const bs = [bloque('a', { series: 4, descanso: 120 }), bloque('b', { series: 3, descanso: 60, fueraEnCorta: true })]
    const out = unirConSiguiente(bs, 'a')
    expect(out[0]).toMatchObject({ superserie: 'b', series: 4, descanso: 120 })
    expect(out[1]).toMatchObject({ superserie: 'a', series: 4, descanso: 120 })
    expect('fueraEnCorta' in out[1]!).toBe(false)
    // Si alguno ya va en pareja, nada.
    expect(unirConSiguiente(out, 'a')).toBe(out)
  })
})
