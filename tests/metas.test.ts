// Metas: el valor de ahora de cada tipo, cuándo está conseguida y cuál es la principal que sale en Inicio.
import { describe, expect, it } from 'vitest'
import { estadoMeta, metaPrincipal, unidadFalta, valorMeta, valorTxt } from '../src/dominio/metas'
import { perfilPorDefecto } from '../src/datos/repos'
import type { Medicion, Meta, Sesion } from '../src/datos/tipos'

const HOY = '2026-11-04'
const meta = (x: Partial<Meta> & { id: number }): Meta & { id: number } => ({ tipo: 'peso', titulo: 'Peso', objetivo: 65, unidad: 'kg', ...x })
const ms: Medicion[] = [
  { fecha: '2026-10-01T07:00', origen: 'casa', pesoKg: 50, perimetros: { cintura: 95 } },
  { fecha: '2026-11-01T07:00', origen: 'casa', pesoKg: 47.5 },
]
const banca: Sesion = {
  fecha: '2026-11-03', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 1, fin: 2, version: 'normal', estado: 'hecha', calibracion: false,
  ejercicios: [{ uid: 'b1', ejercicio: 'bench-press', planificado: 'bench-press', estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso',
    series: [{ n: 1, peso: 50, reps: 8, rpe: null, calentamiento: false, hecha: true }, { n: 2, peso: 55, reps: 6, rpe: null, calentamiento: false, hecha: true }] }],
}

describe('valor de ahora', () => {
  const perfil = perfilPorDefecto()
  it('peso y cintura: lo último apuntado; ejercicio: el peso más alto hecho', () => {
    expect(valorMeta(meta({ id: 1 }), ms, [], perfil, HOY)).toBe(47.5)
    expect(valorMeta(meta({ id: 2, tipo: 'cintura', unidad: 'cm', objetivo: 88 }), ms, [], perfil, HOY)).toBe(95)
    expect(valorMeta(meta({ id: 3, tipo: 'ejercicio', ejercicio: 'bench-press', objetivo: 80 }), ms, [banca], perfil, HOY)).toBe(55)
    expect(valorMeta(meta({ id: 4, tipo: 'ejercicio', ejercicio: 'squat', objetivo: 80 }), ms, [banca], perfil, HOY)).toBeNull()
    expect(valorMeta(meta({ id: 5, tipo: 'libre', objetivo: 1, unidad: '' }), ms, [banca], perfil, HOY)).toBeNull()
  })
})

describe('estado', () => {
  it('subir de 47,5 a 65 kg desde 45: barra a un octavo y faltan 17,5', () => {
    expect(estadoMeta(meta({ id: 1, inicio: 45 }), 47.5)).toEqual({ actual: 47.5, falta: 17.5, progreso: 2.5 / 20, conseguida: false })
  })
  it('conseguida al llegar al objetivo (en las dos direcciones) o al marcarla a mano', () => {
    expect(estadoMeta(meta({ id: 1, inicio: 50, objetivo: 47 }), 46.8).conseguida).toBe(true)
    expect(estadoMeta(meta({ id: 1, inicio: 45 }), 65).conseguida).toBe(true)
    expect(estadoMeta(meta({ id: 1, inicio: 45, hecha: true }), 50)).toMatchObject({ conseguida: true, progreso: 1 })
  })
  it('una libre solo está hecha si se marcó', () => {
    expect(estadoMeta(meta({ id: 1, tipo: 'libre' }), null)).toEqual({ actual: null, falta: null, progreso: 0, conseguida: false })
    expect(estadoMeta(meta({ id: 1, tipo: 'libre', hecha: true }), null).conseguida).toBe(true)
  })
})

describe('meta principal', () => {
  const actual = (m: Meta) => (m.tipo === 'peso' ? 47.5 : m.tipo === 'cintura' ? 95 : null)
  it('la de fecha más cercana sin conseguir; las de sin fecha, después', () => {
    const metas = [meta({ id: 1, titulo: 'Sin fecha' }), meta({ id: 2, titulo: 'Verano', fecha: '2027-06-01' }), meta({ id: 3, titulo: 'Navidad', fecha: '2026-12-24', tipo: 'cintura', objetivo: 90, unidad: 'cm' })]
    expect(metaPrincipal(metas, actual)?.meta.titulo).toBe('Navidad')
    expect(metaPrincipal(metas.slice(0, 1), actual)).toMatchObject({ meta: { id: 1 }, estado: { actual: 47.5 } })
  })
  it('se salta las conseguidas y las libres; null si no queda ninguna', () => {
    const metas = [meta({ id: 1, hecha: true, fecha: '2026-11-10' }), meta({ id: 2, tipo: 'libre', fecha: '2026-11-11' }), meta({ id: 3, objetivo: 47.5, inicio: 50, fecha: '2026-11-12' })]
    expect(metaPrincipal(metas, actual)).toBeNull()
    expect(metaPrincipal([...metas, meta({ id: 4 })], actual)?.meta.id).toBe(4)
  })
})

describe('cifras con su unidad (Metas e Inicio dicen lo mismo)', () => {
  it('los kilos con su formato, «rep» con un 1 y la unidad del usuario tal cual', () => {
    expect(valorTxt(47.5, 'kg')).toBe('47,5 kg')
    expect(valorTxt(1, 'reps')).toBe('1 rep')
    expect(valorTxt(3, 'reps')).toBe('3 reps')
    expect(valorTxt(2, 'puntos')).toBe('2 puntos')
    expect(valorTxt(88, 'cm')).toBe('88 cm')
    expect(valorTxt(5, '')).toBe('5')
  })
  it('lo que falta de grasa va en puntos; lo demás, en su unidad', () => {
    expect(unidadFalta({ tipo: 'grasa', unidad: '%' })).toBe('puntos')
    expect(unidadFalta({ tipo: 'dominadas', unidad: 'reps' })).toBe('reps')
  })
})


it('la meta de repeticiones progresa y se consigue también en Inicio', () => {
  const m = meta({ id: 8, tipo: 'reps', ejercicio: 'bench-press', inicio: 6, objetivo: 8, unidad: 'reps' })
  const v = valorMeta(m, [], [banca], perfilPorDefecto(), HOY)
  expect(v).toBe(8)
  expect(estadoMeta(m, v).conseguida).toBe(true)
  expect(metaPrincipal([m], () => v)).toBeNull()
})

describe('avance manual en metas (dominadas, reps, ejercicio y libre)', () => {
  const perfil = perfilPorDefecto()
  it('dominadas sin entrenos: avanza con actual desde 0 hasta el objetivo y entra en Inicio', () => {
    const m = meta({ id: 9, tipo: 'dominadas', titulo: '15 dominadas estrictas', objetivo: 15, unidad: 'reps', actual: 8 })
    const v = valorMeta(m, [], [], perfil, HOY)
    expect(v).toBe(8)
    const e = estadoMeta(m, v)
    expect(e).toEqual({ actual: 8, falta: 7, progreso: 8 / 15, conseguida: false })
    expect(metaPrincipal([m], () => v)?.meta.id).toBe(9)
    expect(estadoMeta(m, 15).conseguida).toBe(true)
  })
  it('toma el mayor entre los entrenos y el avance manual', () => {
    const m1 = meta({ id: 10, tipo: 'ejercicio', ejercicio: 'bench-press', objetivo: 80, actual: 60 })
    const m2 = meta({ id: 11, tipo: 'ejercicio', ejercicio: 'bench-press', objetivo: 80, actual: 45 })
    expect(valorMeta(m1, [], [banca], perfil, HOY)).toBe(60)
    expect(valorMeta(m2, [], [banca], perfil, HOY)).toBe(55)
  })
  it('meta libre con objetivo y avance numérico muestra barra y se completa al llegar', () => {
    const m = meta({ id: 12, tipo: 'libre', titulo: 'Correr 10 km', objetivo: 10, unidad: 'km', actual: 4 })
    const v = valorMeta(m, [], [], perfil, HOY)
    expect(v).toBe(4)
    expect(estadoMeta(m, v)).toEqual({ actual: 4, falta: 6, progreso: 0.4, conseguida: false })
    expect(metaPrincipal([m], () => v)?.meta.id).toBe(12)
    expect(estadoMeta(m, 10).conseguida).toBe(true)
  })
  it('dominadas creadas como ejercicio propio también cuentan por su nombre', () => {
    const sesPropia: Sesion = {
      ...banca,
      ejercicios: [{ ...banca.ejercicios[0]!, ejercicio: 'mio-dom', registro: 'corporal', series: [{ n: 1, peso: null, reps: 6, rpe: null, calentamiento: false, hecha: true }] }],
    }
    const m = meta({ id: 13, tipo: 'dominadas', objetivo: 15, unidad: 'reps' })
    expect(valorMeta(m, [], [sesPropia], perfil, HOY, id => (id === 'mio-dom' ? 'Dominadas estrictas' : id))).toBe(6)
  })
})
