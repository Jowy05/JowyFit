// Pesos disponibles, calculadora de discos, calentamiento y doble progresión con esfuerzo (RPE).
// Incluye casos límite que fallaban y tests de propiedades sobre muchas combinaciones.
import { describe, expect, it } from 'vitest'
import { ajustarA, calentamiento, discosPorLado, mancuernasDisponibles, pesosBarra, pesosPara, siguiente, BARRAS } from '../src/dominio/pesos'
import { esRecord, mejorMarca, sugerir, volumen, leerReferencia, pesoPartida } from '../src/dominio/progresion'
import { gimnasioNuevo } from '../src/datos/repos'
import type { Gimnasio, Serie, TipoRegistro } from '../src/datos/tipos'

const serie = (peso: number | null, reps: number | null, rpe: number | null = 8, extra: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe, calentamiento: false, hecha: true, ...extra })

const gym = (cambios: Partial<Gimnasio> = {}): Gimnasio => ({ ...gimnasioNuevo(), id: 1, ...cambios })

describe('pesos: casos límite', () => {
  it('discosPorLado encuentra combinaciones que el reparto voraz no veía (15 + 10)', () => {
    // 60 kg con barra de 20 → 20 kg por lado = 10 + 10 (el voraz cogía 15 y se quedaba con 5 sin disco).
    expect(discosPorLado(60, 20, [15, 10])).toEqual([10, 10])
    expect(discosPorLado(50, 20, [15, 10])).toEqual([15])
    expect(discosPorLado(26, 20, [1, 2])).toEqual([2, 1])
    expect(discosPorLado(26, 20, [1.25, 2])).toBeNull()
  })
  it('discosPorLado no se cuelga con un disco de 0 kg o negativo', () => {
    expect(discosPorLado(40, 20, [0, 10])).toEqual([10])
    expect(discosPorLado(40, 20, [-5, 10])).toEqual([10])
    expect(discosPorLado(40, 20, [0])).toBeNull()
    expect(discosPorLado(20, 20, [])).toEqual([])
    expect(discosPorLado(Number.NaN, 20, [10])).toBeNull()
  })
  it('pesosBarra ignora discos de 0 kg o negativos', () => {
    const l = pesosBarra(20, [-2.5, 0, 5])
    expect(l.every(v => v >= 20)).toBe(true)
    expect(l.slice(0, 3)).toEqual([20, 30, 40])
  })
  it('siguiente no baja al pulsar «+» con un peso por encima de la lista (ni sube con «−» por debajo)', () => {
    const m = mancuernasDisponibles(gym())
    expect(siguiente(m, 55, 1)).toBe(55) // antes devolvía 50
    expect(siguiente(m, 1, -1)).toBe(1) // antes devolvía 2
    expect(siguiente(m, 50, 1)).toBe(50)
    expect(siguiente(m, 50, -1)).toBe(48)
  })
  it('mancuernas con pasos decimales sin errores de coma flotante y tramos rotos', () => {
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 1, hasta: 2, paso: 0.1 }] })).toHaveLength(11)
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 5, hasta: 2, paso: 1 }, { desde: 2, hasta: 4, paso: 0 }, { desde: 2, hasta: 4, paso: Number.NaN }] })).toEqual([])
  })
  it('calentamiento sin lista de pesos redondea a 2,5 y no propone 0 kg', () => {
    for (const s of calentamiento(37, [])) expect(s.peso % 2.5).toBe(0)
    const maquina = Array.from({ length: 121 }, (_, i) => i * 2.5)
    expect(calentamiento(2.5, maquina).every(s => s.peso > 0)).toBe(true)
    expect(calentamiento(-20, maquina)).toEqual([]) // asistidas: sin aproximación
  })
  it('asistidas: lista de −100 a 0 (menos ayuda = más difícil)', () => {
    const l = pesosPara('assisted_pullup_machine', 'asistido', gym())
    expect(l[0]).toBe(-100)
    expect(l[l.length - 1]).toBe(0)
    expect(siguiente(l, -20, 1)).toBe(-15)
    expect(siguiente(l, -20, -1)).toBe(-25)
  })
})

describe('progresión: casos que fallaban', () => {
  const obj = { repsMin: 8, repsMax: 12, rpe: 8 }
  const m = mancuernasDisponibles(gym())

  it('asistida con una serie sin peso apuntado no se trata como peso corporal', () => {
    const s = sugerir([serie(-20, 12, 7), serie(null, 12, 7), serie(-20, 12, 7)], obj, 'asistido', pesosPara(null, 'asistido'))
    expect(s.accion).toBe('subir')
    expect(s.peso).toBe(-15)
  })
  it('en el peso más alto disponible no dice «subir» con el mismo peso (ni baja)', () => {
    const s = sugerir([serie(50, 12, 7), serie(50, 12, 7)], obj, 'mancuerna', m)
    expect(s.accion).toBe('mantener')
    expect(s.peso).toBe(50)
    const fuera = sugerir([serie(55, 12, 7)], obj, 'mancuerna', m)
    expect(fuera.peso).toBeGreaterThanOrEqual(55)
  })
  it('no baja el peso si faltaron reps pero el esfuerzo apuntado fue bajo (se paró antes)', () => {
    const s = sugerir([serie(40, 8, 7), serie(40, 6, 7)], obj, 'peso', pesosBarra(20, [1.25, 2.5, 5, 10, 20]))
    expect(s.accion).toBe('mantener')
    expect(s.peso).toBe(40)
  })
  it('sí baja si faltaron reps con esfuerzo alto', () => {
    const s = sugerir([serie(40, 8, 9), serie(40, 5, 10)], obj, 'peso', pesosBarra(20, [1.25, 2.5, 5, 10, 20]))
    expect(s.accion).toBe('bajar')
    expect(s.peso).toBeLessThan(40)
  })
  it('en el peso más bajo no propone «bajar» al mismo peso', () => {
    const s = sugerir([serie(2, 5, 10), serie(2, 4, 10)], obj, 'mancuerna', m)
    expect(s.accion).toBe('mantener')
    expect(s.peso).toBe(2)
  })
  it('reps o esfuerzo no numéricos (NaN) no dan sugerencias NaN', () => {
    const s = sugerir([serie(40, Number.NaN, Number.NaN), serie(40, 10, 8)], obj, 'peso', pesosPara(null, 'peso'))
    expect(Number.isNaN(s.peso)).toBe(false)
    expect(Number.isNaN(s.reps)).toBe(false)
  })
})

describe('propiedades de la progresión (muchas combinaciones)', () => {
  const listas: Record<string, number[]> = {
    maquina: pesosPara('cable', 'peso'),
    barra: pesosPara('barbell', 'peso', gym()),
    mancuernas: pesosPara('dumbbell', 'mancuerna', gym()),
    asistida: pesosPara('assisted_pullup_machine', 'asistido'),
  }
  const registroDe: Record<string, TipoRegistro> = { maquina: 'peso', barra: 'peso', mancuernas: 'mancuerna', asistida: 'asistido' }
  const objetivos = [{ repsMin: 5, repsMax: 8, rpe: 8 }, { repsMin: 8, repsMax: 12, rpe: 8 }, { repsMin: 10, repsMax: 15, rpe: 7 }]
  const rpes: (number | null)[] = [null, 6, 7, 8, 8.5, 9, 9.5, 10]

  it('nunca sube si el esfuerzo fue alto (≥ 9) · nunca baja si se completó el rango · sube solo un peso que existe', () => {
    let casos = 0
    for (const [nombre, lista] of Object.entries(listas)) for (const o of objetivos) for (const rpe of rpes) {
      for (const idx of [0, 1, Math.floor(lista.length / 2), lista.length - 2, lista.length - 1]) {
        const peso = lista[idx]!
        for (let reps = 0; reps <= o.repsMax + 2; reps++) for (const nSeries of [1, 3]) {
          const series = Array.from({ length: nSeries }, (_, i) => serie(peso, i === nSeries - 1 ? reps : Math.max(reps, o.repsMin), rpe))
          const s = sugerir(series, o, registroDe[nombre]!, lista)
          const et = `${nombre} ${peso} kg × ${reps} @${rpe} (${o.repsMin}-${o.repsMax})`
          casos++
          expect(s.peso, et).not.toBeNull()
          expect(Number.isFinite(s.peso!), et).toBe(true)
          expect(lista.includes(s.peso!), `${et}: ${s.peso} no está en la lista`).toBe(true)
          if (rpe != null && rpe >= 9) expect(s.peso!, `${et}: subió con esfuerzo alto`).toBeLessThanOrEqual(peso)
          if (s.accion === 'subir') expect(s.peso!, et).toBeGreaterThan(peso)
          if (s.accion === 'bajar') expect(s.peso!, et).toBeLessThan(peso)
          if (s.accion === 'mantener') expect(s.peso!, et).toBe(peso)
          const todas = series.every(x => (x.reps ?? 0) >= o.repsMax)
          if (todas) expect(s.peso!, `${et}: bajó tras completar el rango`).toBeGreaterThanOrEqual(peso)
          // Sin reps por debajo del mínimo no hay motivo para bajar.
          if (series.every(x => (x.reps ?? 0) >= o.repsMin)) expect(s.accion, et).not.toBe('bajar')
          // Esfuerzo apuntado ≤ 8: no se baja nunca.
          if (rpe != null && rpe <= 8) expect(s.accion, et).not.toBe('bajar')
          expect(s.reps!, et).toBeGreaterThan(0)
        }
      }
    }
    expect(casos).toBeGreaterThan(3000)
  })

  it('peso corporal y tiempo: suben reps/segundos solo con esfuerzo no máximo', () => {
    for (const registro of ['corporal', 'tiempo'] as const) for (const rpe of rpes) for (let r = 1; r <= 60; r += 3) {
      const o = registro === 'tiempo' ? { repsMin: 30, repsMax: 45, rpe: 8 } : { repsMin: 8, repsMax: 12, rpe: 8 }
      const ss = [serie(null, registro === 'tiempo' ? null : r, rpe, registro === 'tiempo' ? { segundos: r } : {})]
      const s = sugerir(ss, o, registro, [])
      expect(s.peso).toBeNull()
      expect(s.reps!).toBeGreaterThanOrEqual(Math.min(r, o.repsMin))
      if (rpe != null && rpe >= 9.5) expect(s.accion).not.toBe('subir')
    }
  })

  it('récords y volumen ignoran calentamientos, asistidas y series sin hacer', () => {
    const hist = [serie(40, 8), serie(42.5, 6)]
    expect(esRecord(serie(45, 5), hist)?.tipo).toBe('peso')
    expect(esRecord(serie(42.5, 7), hist)?.tipo).toBe('reps')
    expect(esRecord(serie(45, 5, 8, { calentamiento: true }), hist)).toBeNull()
    expect(esRecord(serie(-10, 8), hist)).toBeNull()
    expect(esRecord(serie(45, 5, 8, { hecha: false }), hist)).toBeNull()
    expect(volumen([serie(40, 10), serie(-20, 10), serie(20, 10, 8, { calentamiento: true })])).toBe(400)
    expect(mejorMarca([serie(-20, 10)])).toBeNull()
  })
})

describe('propiedades de los pesos', () => {
  const juegos = [[1.25, 2.5, 5, 10, 15, 20, 25], [2.5, 5, 10, 20], [15, 10], [0.5, 1, 1.25, 2.5, 5, 10, 15, 20], [5], [1, 2, 3]]
  it('todo total de pesosBarra se puede montar con discosPorLado y la suma cuadra', () => {
    let n = 0
    for (const discos of juegos) for (const barra of [20, 15, 10, 7]) {
      for (const total of pesosBarra(barra, discos, 200)) {
        const lado = discosPorLado(total, barra, discos)
        expect(lado, `${total} con ${discos.join('/')} y barra ${barra}`).not.toBeNull()
        expect(Math.round((barra + 2 * lado!.reduce((a, b) => a + b, 0)) * 100) / 100).toBe(total)
        // Ordenados de mayor a menor.
        expect([...lado!].sort((a, b) => b - a)).toEqual(lado)
        n++
      }
    }
    expect(n).toBeGreaterThan(500)
  })

  it('ajustarA(abajo) nunca pasa del valor salvo que no haya nada menor; siguiente siempre se mueve en su dirección o se queda', () => {
    const listas = [pesosPara('cable', 'peso'), pesosPara('barbell', 'peso', gym()), pesosPara('dumbbell', 'mancuerna', gym()), pesosPara(null, 'asistido')]
    for (const l of listas) for (let v = -110; v <= 320; v += 0.75) {
      const a = ajustarA(l, v, true)
      if (v >= l[0]!) expect(a).toBeLessThanOrEqual(v + 1e-9)
      expect(l).toContain(a)
      const arriba = siguiente(l, v, 1), abajo = siguiente(l, v, -1)
      expect(arriba).toBeGreaterThanOrEqual(v)
      expect(abajo).toBeLessThanOrEqual(v)
    }
  })

  it('calentamiento: series crecientes, por debajo del peso de trabajo y con pesos de la lista', () => {
    const l = pesosPara('barbell', 'peso', gym())
    for (let p = 0; p <= 200; p += 2.5) {
      const c = calentamiento(p, l, 20)
      for (const s of c) {
        expect(s.peso).toBeLessThan(p)
        expect(s.peso).toBeGreaterThan(0)
        expect(l).toContain(s.peso)
      }
      for (let i = 1; i < c.length; i++) expect(c[i]!.peso).toBeGreaterThan(c[i - 1]!.peso)
    }
  })

  it('rendimiento: la lista de pesos de barra (se pide al abrir la calculadora) es rápida', () => {
    const t0 = performance.now()
    for (let i = 0; i < 50; i++) pesosPara('barbell', 'peso', gym())
    const ms = (performance.now() - t0) / 50
    console.log(`pesosPara(barra): ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(20)
    const t1 = performance.now()
    for (let i = 0; i < 50; i++) discosPorLado(297.5, 20, [0.5, 1, 1.25, 2.5, 5, 10, 15, 20, 25])
    expect((performance.now() - t1) / 50).toBeLessThan(10)
  })
})

describe('pesos reales', () => {
  it('mancuernas por tramos', () => {
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 5, hasta: 10, paso: 1 }, { desde: 12, hasta: 16, paso: 2 }] })).toEqual([5, 6, 7, 8, 9, 10, 12, 14, 16])
  })
  it('barra con discos de 0,5 permite subir de kilo en kilo', () => {
    const p = pesosBarra(20, [0.5, 1, 2.5, 5, 10])
    expect(p).toContain(41)
    expect(p).toContain(47)
    expect(p).not.toContain(47.5)
    expect(siguiente(p, 45, 1)).toBe(46)
  })
  it('discos por lado', () => {
    expect(discosPorLado(47.5, 20, [0.5, 1, 1.25, 2.5, 5, 10, 20])).toEqual([10, 2.5, 1.25])
    expect(discosPorLado(21.3, 20, [1.25])).toBeNull()
  })
  it('calentamiento de aproximación con pesos que existen', () => {
    const lista = pesosBarra(20, [1.25, 2.5, 5, 10])
    const c = calentamiento(47.5, lista, 20)
    expect(c[0]).toEqual({ peso: 22.5, reps: 10 })
    expect(c.every(x => lista.includes(x.peso))).toBe(true)
    expect(ajustarA(lista, 33, true)).toBe(32.5)
  })
})

describe('progresión', () => {
  const lista = pesosBarra(20, [1.25, 2.5, 5, 10])
  const obj = { repsMin: 6, repsMax: 8, rpe: 8 }
  it('primera vez', () => expect(sugerir(null, obj, 'peso', lista).accion).toBe('primera'))
  it('sube cuando completa el rango con esfuerzo ≤ 8', () => {
    const s = sugerir([serie(45, 8, 7), serie(45, 8, 8), serie(45, 8, 8)], obj, 'peso', lista)
    expect(s.accion).toBe('subir')
    expect(s.peso).toBe(47.5)
  })
  it('salto doble si costó muy poco', () => {
    expect(sugerir([serie(40, 8, 5), serie(40, 8, 6)], obj, 'peso', lista).peso).toBe(45)
  })
  it('mantiene si no llega al tope', () => expect(sugerir([serie(45, 8), serie(45, 7), serie(45, 6)], obj, 'peso', lista).accion).toBe('mantener'))
  it('baja si se queda muy corto', () => {
    const s = sugerir([serie(45, 4, 10), serie(45, 3, 10)], obj, 'peso', lista)
    expect(s.accion).toBe('bajar')
    expect(s.peso).toBe(42.5)
  })
  it('ignora el calentamiento', () => {
    expect(sugerir([serie(20, 10, 3, { calentamiento: true }), serie(45, 8, 8)], obj, 'peso', lista).accion).toBe('subir')
  })
  it('asistido: subir es quitar asistencia', () => {
    const asis = Array.from({ length: 21 }, (_, i) => -i * 5).reverse()
    expect(sugerir([serie(-25, 8, 7), serie(-25, 8, 8)], obj, 'asistido', asis).peso).toBe(-20)
  })
  it('peso corporal: una rep más', () => {
    expect(sugerir([serie(null, 12, 8), serie(null, 12, 8)], { repsMin: 8, repsMax: 12, rpe: 8 }, 'corporal', []).reps).toBe(13)
  })
  it('récords', () => {
    const h = [serie(45, 8), serie(45, 7)]
    expect(esRecord(serie(47.5, 6), h)?.tipo).toBe('peso')
    expect(esRecord(serie(45, 9), h)?.tipo).toBe('reps')
    expect(esRecord(serie(45, 8), h)).toBeNull()
    expect(esRecord(serie(45, 8), [])).toBeNull()
    expect(mejorMarca(h)?.peso).toBe(45)
  })
})

describe('pesos del gimnasio', () => {
  const g = gimnasioNuevo()
  it('mancuernas: tramos raros (paso 0, NaN) se ignoran y no se repiten', () => {
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 2, hasta: 4, paso: 0 }, { desde: NaN, hasta: 4, paso: 1 }] })).toEqual([])
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 2, hasta: 4, paso: 1 }, { desde: 4, hasta: 6, paso: 2 }] })).toEqual([2, 3, 4, 6])
    expect(mancuernasDisponibles({ mancuernas: [{ desde: 1, hasta: 2, paso: 0.25 }] })).toEqual([1, 1.25, 1.5, 1.75, 2])
    expect(mancuernasDisponibles({ mancuernas: [] })).toEqual([])
  })
  it('barra: sin discos solo la barra; discos 0 o negativos no cuentan', () => {
    expect(pesosBarra(20, [])).toEqual([20])
    expect(pesosBarra(20, [0, -5])).toEqual([20])
    expect(pesosBarra(20, [5], 40)).toEqual([20, 30, 40])
  })
  it('lista según el material: corporal vacía, asistida de −100 a 0, mancuernas, barra Z y máquinas', () => {
    expect(pesosPara(null, 'corporal', g)).toEqual([])
    const asist = pesosPara('assisted_pullup_machine', 'asistido', g)
    expect(asist[0]).toBe(-100)
    expect(asist.at(-1)).toBe(0)
    expect(Object.is(asist.at(-1), -0)).toBe(false)
    expect(pesosPara('dumbbell', 'mancuerna', g)[0]).toBe(2)
    expect(pesosPara('ez_bar', 'peso', g)[0]).toBe(BARRAS.ez_bar)
    expect(pesosPara('dumbbell', 'mancuerna', { ...g, mancuernas: [] })).toHaveLength(121) // sin mancuernas: de 2,5 en 2,5
    expect(pesosPara('cable', 'peso', null)).toHaveLength(121)
  })
  it('ajustar y siguiente: lista vacía y valores fuera de la lista', () => {
    expect(ajustarA([], 7)).toBe(7)
    expect(ajustarA([10, 20], 14)).toBe(10)
    expect(ajustarA([10, 20], 16)).toBe(20)
    expect(ajustarA([10, 20], 19, true)).toBe(10)
    expect(siguiente([], 10, 1)).toBe(12.5)
    expect(siguiente([], 1, -1)).toBe(0)
    expect(siguiente([10, 20], 30, 1)).toBe(30)
    expect(siguiente([10, 20], 5, -1)).toBe(5)
    expect(siguiente([10, 20], 15, -1)).toBe(10)
  })
  it('discos por lado: imposibles, barra sola y pesos absurdos', () => {
    expect(discosPorLado(20, 20, [5])).toEqual([])
    expect(discosPorLado(15, 20, [5])).toBeNull()
    expect(discosPorLado(23, 20, [5])).toBeNull()
    expect(discosPorLado(NaN, 20, [5])).toBeNull()
    expect(discosPorLado(5000, 20, [5])).toBeNull()
    expect(discosPorLado(60, 20, [])).toBeNull()
    expect(discosPorLado(60, 20, [0])).toBeNull()
    expect(discosPorLado(62.5, 20, [20, 1.25])).toEqual([20, 1.25])
  })
  it('calentamiento: peso de trabajo 0 o muy ligero no da aproximaciones; sin lista, de 2,5 en 2,5', () => {
    expect(calentamiento(0, [])).toEqual([])
    expect(calentamiento(2.5, [])).toEqual([])
    expect(calentamiento(30, [])).toEqual([{ peso: 15, reps: 10 }, { peso: 22.5, reps: 5 }])
    // Con un mínimo (la barra) no baja de él y no repite.
    expect(calentamiento(30, [], 20)).toEqual([{ peso: 20, reps: 10 }, { peso: 22.5, reps: 5 }])
    expect(calentamiento(22.5, [], 20)).toEqual([{ peso: 20, reps: 10 }])
  })
})

describe('progresión: lo que faltaba', () => {
  const serie = (x: Partial<Serie> = {}): Serie => ({ n: 1, peso: 40, reps: 8, rpe: null, calentamiento: false, hecha: false, ...x })
  const s = (peso: number | null, reps: number | null, x: Partial<Serie> = {}) => serie({ peso, reps, hecha: true, ...x })
  const obj = { repsMin: 8, repsMax: 12, rpe: 8 }
  it('corporal: sube una rep si las hizo todas; si no, repite', () => {
    expect(sugerir([s(null, 12), s(null, 12)], obj, 'corporal', [])).toMatchObject({ accion: 'subir', reps: 13, texto: 'Hoy: 13 reps' })
    expect(sugerir([s(null, 10)], obj, 'corporal', [])).toMatchObject({ accion: 'mantener', reps: 10 })
    expect(sugerir([s(null, 12, { rpe: 10 })], obj, 'corporal', [])).toMatchObject({ accion: 'mantener' })
  })
  it('por tiempo: +5 s', () => {
    expect(sugerir([s(null, null, { segundos: 45 })], { repsMin: 30, repsMax: 45, rpe: 8 }, 'tiempo', [])).toMatchObject({ accion: 'subir', reps: 50, texto: 'Hoy: aguanta 50 s' })
  })
  it('en el peso más alto que hay: busca más reps', () => {
    expect(sugerir([s(50, 12), s(50, 12)], obj, 'peso', [40, 45, 50])).toMatchObject({ accion: 'mantener', peso: 50, reps: 12 })
  })
  it('muy fácil (esfuerzo ≤ 6): salto doble', () => {
    expect(sugerir([s(40, 12, { rpe: 6 }), s(40, 12, { rpe: 6 })], obj, 'peso', [40, 42.5, 45, 47.5]).peso).toBe(45)
  })
  it('costó demasiado pero no hay peso menor: mantener', () => {
    expect(sugerir([s(40, 5, { rpe: 10 })], obj, 'peso', [40, 45])).toMatchObject({ accion: 'mantener', peso: 40 })
  })
  it('mismo peso, una rep más (sin pasar del máximo)', () => {
    expect(sugerir([s(40, 9, { rpe: 8 }), s(40, 10, { rpe: 8 })], obj, 'peso', [40, 45])).toMatchObject({ accion: 'mantener', reps: 11, texto: 'Mismo peso, una rep más' })
  })
  it('marca, récord y volumen con datos vacíos o asistidos', () => {
    expect(mejorMarca([])).toBeNull()
    expect(mejorMarca([s(-20, 8)])).toBeNull()
    expect(esRecord(s(50, 8), [])).toBeNull()
    expect(esRecord(s(50, 8, { calentamiento: true }), [s(40, 8)])).toBeNull()
    expect(esRecord(s(40, 8), [s(40, 8)])).toBeNull()
    expect(esRecord(s(40, 9), [s(40, 8), s(45, 3)])).toMatchObject({ tipo: 'reps' })
    expect(volumen([s(-20, 8), s(40, 10)])).toBe(400)
  })
  it('referencias raras', () => {
    expect(leerReferencia(undefined)).toBeNull()
    expect(leerReferencia('sin número')).toBeNull()
    expect(leerReferencia('0 kg')).toBeNull()
    expect(leerReferencia('500 kg')).toBeNull()
    expect(leerReferencia('47,5 kg x 6')).toEqual({ peso: 47.5, reps: 6 })
    expect(leerReferencia('40 × 50')).toEqual({ peso: 40, reps: 8 }) // 50 reps no es creíble
  })
  it('peso de partida sin lista: el mínimo del material', () => {
    expect(pesoPartida('barbell', 'peso', [])).toBe(20)
    expect(pesoPartida('dumbbell', 'mancuerna', [])).toBe(4)
    expect(pesoPartida('loop_band', 'peso', [])).toBe(5)
    expect(pesoPartida('dumbbell', 'mancuerna', [1, 2, 3])).toBe(3) // todas más ligeras: la más pesada
    expect(pesoPartida(null, 'corporal', [])).toBeNull()
  })
})
