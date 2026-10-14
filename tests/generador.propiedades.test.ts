// Propiedades del generador: para muchas combinaciones de perfil y gimnasio siempre debe salir
// una rutina válida (días con ejercicios, sin repetidos en el mismo día, sin odiados, material disponible…).
import { describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import { ajustarATiempo, bloqueNuevo, duracionDia, generarRutina, plantillas } from '../src/dominio/generador'
import { gimnasioNuevo } from '../src/datos/repos'
import type { Bloque, Dia, MarcaEjercicio, Perfil, Rutina, Zona } from '../src/datos/tipos'
import { ejercicio } from '../src/catalogo/catalogo'

const GIMNASIOS: Record<string, string[] | null> = {
  'sin gimnasio (material típico)': null,
  'gimnasio completo': gimnasioNuevo().material,
  'solo mancuernas y banco': ['dumbbell', 'flat_bench'],
  'nada de material (peso corporal)': [],
  'sin máquinas (peso libre y barra de dominadas)': ['dumbbell', 'barbell', 'ez_bar', 'flat_bench', 'pull_up_bar', 'kettlebell'],
  'solo máquinas y poleas': ['cable', 'leg_press', 'lat_pulldown_machine', 'seated_row_machine', 'chest_press_machine', 'shoulder_press_machine', 'leg_curl', 'leg_extension', 'pec_deck'],
  'solo poleas': ['cable'],
}

const ZONAS: Zona[][] = [[], ['rodilla'], ['lumbar'], ['hombro'], ['muneca'], ['codo'], ['rodilla', 'lumbar', 'hombro'], ['rodilla', 'lumbar', 'hombro', 'muneca', 'codo']]
const DIAS_FIJOS: Dia[][] = [[], [0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]]

function comprobar(r: Omit<Rutina, 'id'>, perfil: Perfil, material: string[] | null, marcas: Map<string, MarcaEjercicio>, etiqueta: string) {
  const fijos = [...new Set(perfil.diasFijos)]
  const esperados = (fijos.length || 3) + (perfil.diasOpcionales.some(d => !fijos.includes(d)) ? 1 : 0)
  expect(r.dias.length, `${etiqueta}: número de días`).toBe(esperados)
  // Cada día fijo del perfil tiene su sesión.
  for (const d of fijos) expect(r.dias.some(x => x.dia === d && !x.opcional), `${etiqueta}: falta el día ${d}`).toBe(true)
  const mat = material ? new Set(material) : null
  for (const d of r.dias) {
    expect(d.bloques.length, `${etiqueta}: ${d.nombre} sin ejercicios`).toBeGreaterThan(0)
    const ids = d.bloques.map(b => b.ejercicio)
    expect(new Set(ids).size, `${etiqueta}: ${d.nombre} repite ejercicio`).toBe(ids.length)
    const uids = new Set(d.bloques.map(b => b.uid))
    expect(uids.size).toBe(d.bloques.length)
    for (const b of d.bloques) {
      expect(b.series, `${etiqueta}: series`).toBeGreaterThanOrEqual(1)
      expect(b.repsMin).toBeLessThanOrEqual(b.repsMax)
      expect(b.descanso).toBeGreaterThan(0)
      expect(b.alternativas).not.toContain(b.ejercicio)
      // Las alternativas no repiten otro ejercicio principal del día.
      for (const a of b.alternativas) expect(ids, `${etiqueta}: alternativa ${a} ya está en el día`).not.toContain(a)
      for (const id of [b.ejercicio, ...b.alternativas]) {
        const e = ejercicio(id)!
        expect(e, id).toBeTruthy()
        const m = marcas.get(id)
        expect(!!(m?.odiado || m?.duele), `${etiqueta}: ${id} evitado`).toBe(false)
        if (mat) expect(e.material === null || mat.has(e.material), `${etiqueta}: ${id} sin material`).toBe(true)
        for (const z of perfil.zonasSensibles) {
          const etq = { rodilla: 'knee_safe', lumbar: 'lower_back_safe', hombro: 'shoulder_safe' }[z as string]
          if (etq) expect(e.etiquetas, `${etiqueta}: ${id} no cuida ${z}`).toContain(etq)
        }
      }
      if (b.superserie) {
        const c = d.bloques.find(o => o.uid === b.superserie)
        expect(c, `${etiqueta}: superserie huérfana`).toBeTruthy()
        expect(c!.superserie).toBe(b.uid)
        expect(c!.series).toBe(b.series)
        // El segundo del par va justo detrás del primero.
        expect(Math.abs(d.bloques.indexOf(c!) - d.bloques.indexOf(b))).toBe(1)
      }
    }
  }
}

describe('plantillas para 1-7 días', () => {
  for (let n = 1; n <= 7; n++) {
    it(`${n} día(s) → ${n} sesiones con letras distintas`, () => {
      const p = plantillas(n)
      expect(p.dias).toHaveLength(n)
      expect(new Set(p.dias.map(d => d.letra)).size).toBe(n)
    })
  }
})

describe.skipIf(!hayCatalogo)('propiedades del generador con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const ejercicios = c?.ejercicios ?? []

  it('siempre da una rutina válida: días × gimnasios × zonas sensibles × preferencias', () => {
    let n = 0
    for (const [nombreGym, material] of Object.entries(GIMNASIOS)) {
      for (const dias of DIAS_FIJOS) for (const zonas of ZONAS) for (const preferencia of ['maquinas', 'libre', 'mezcla'] as const) {
        const perfil = perfilEjemplo({ diasFijos: dias, diasOpcionales: [5], zonasSensibles: zonas, preferencia })
        const marcas = new Map<string, MarcaEjercicio>()
        const r = generarRutina({ perfil, gimnasio: material ? { id: 1, material } : null, marcas, ejercicios })
        comprobar(r, perfil, material ?? ['dumbbell', 'barbell', 'cable', 'flat_bench', 'pull_up_bar', 'leg_press', 'smith_machine'], marcas, `${nombreGym} · ${dias.length} días · ${zonas.join('+') || 'sin zonas'} · ${preferencia}`)
        // Aunque falte material, ningún día se queda en uno o dos ejercicios (antes, sin material, «Tirón» = solo una plancha).
        for (const d of r.dias) expect(d.bloques.length, `${nombreGym} · ${dias.length} días · ${zonas.join('+')} · ${d.nombre}`).toBeGreaterThanOrEqual(3)
        n++
      }
    }
    expect(n).toBeGreaterThan(1000)
  }, 60_000)

  it('30 a 90 minutos, con y sin superseries, cada nivel y tipo de reps: cabe y es válida', () => {
    const gym = { id: 1, material: gimnasioNuevo().material }
    for (const minutos of [30, 35, 40, 45, 50, 60, 75, 90]) for (const superseries of [true, false]) for (const nivel of ['empiezo', 'vuelvo', 'intermedio', 'avanzado'] as const) for (const reps of ['pesadas', 'moderadas', 'mezcla'] as const) {
      const perfil = perfilEjemplo({ minutosNormal: minutos, minutosCorta: Math.max(20, minutos - 15), superseries, nivel, reps })
      const marcas = new Map<string, MarcaEjercicio>()
      const r = generarRutina({ perfil, gimnasio: gym, marcas, ejercicios })
      const et = `${minutos} min · ss=${superseries} · ${nivel} · ${reps}`
      comprobar(r, perfil, gym.material, marcas, et)
      for (const d of r.dias.filter(x => !x.opcional)) {
        // Los principales (prioridad 1) nunca se quitan: si aun así no cabe, al menos no se pasa con margen.
        if (minutos >= 45) expect(duracionDia(d.bloques) / 60, et).toBeLessThanOrEqual(minutos)
        if (superseries === false) expect(d.bloques.some(b => b.superserie), et).toBe(false)
      }
    }
  })

  it('las superseries no dependen de una generación anterior sin superseries (no se muta la plantilla)', () => {
    const gym = { id: 1, material: gimnasioNuevo().material }
    const base = { gimnasio: gym, marcas: new Map<string, MarcaEjercicio>(), ejercicios }
    generarRutina({ ...base, perfil: perfilEjemplo({ superseries: false, diasOpcionales: [5] }) })
    const r = generarRutina({ ...base, perfil: perfilEjemplo({ superseries: true, diasOpcionales: [5] }) })
    const extra = r.dias.find(d => d.opcional)!
    expect(extra.bloques.some(b => b.superserie)).toBe(true)
  })

  it('respeta los ejercicios evitados aunque se eviten muchísimos', () => {
    const gym = { id: 1, material: gimnasioNuevo().material }
    // Se odia la mitad del catálogo de fuerza (los de índice par).
    const marcas = new Map<string, MarcaEjercicio>()
    ejercicios.filter(e => e.categoria === 'strength').forEach((e, i) => { if (i % 2 === 0) marcas.set(e.id, { id: e.id, odiado: true }) })
    for (const dias of DIAS_FIJOS) {
      const perfil = perfilEjemplo({ diasFijos: dias })
      const r = generarRutina({ perfil, gimnasio: gym, marcas, ejercicios })
      comprobar(r, perfil, gym.material, marcas, `mitad odiados · ${dias.length} días`)
    }
  })

  it('priorizar una zona no deja quitar los principales de esa zona en la versión corta', () => {
    const gym = { id: 1, material: gimnasioNuevo().material }
    const perfil = perfilEjemplo({ zonasPrioridad: ['piernas', 'pecho', 'espalda'], minutosNormal: 40, minutosCorta: 10 })
    const r = generarRutina({ perfil, gimnasio: gym, marcas: new Map(), ejercicios })
    for (const d of r.dias.filter(x => !x.opcional)) {
      const primero = d.bloques[0]!
      // El primer ejercicio de cada día es un principal: debe seguir en la versión corta.
      expect(primero.fueraEnCorta, `${d.nombre}: ${primero.ejercicio}`).toBe(false)
    }
  })

  it('días fijos repetidos o desordenados no crean sesiones de más', () => {
    const perfil = perfilEjemplo({ diasFijos: [3, 1, 3, 1] as Dia[], diasOpcionales: [] })
    const r = generarRutina({ perfil, gimnasio: null, marcas: new Map(), ejercicios })
    expect(r.dias.map(d => d.dia)).toEqual([1, 3])
  })

  it('perfil incompleto (minutos 0 o NaN) sigue dando una rutina con ejercicios', () => {
    for (const minutos of [0, Number.NaN, -10]) {
      const perfil = perfilEjemplo({ minutosNormal: minutos, minutosCorta: minutos })
      const r = generarRutina({ perfil, gimnasio: null, marcas: new Map(), ejercicios })
      for (const d of r.dias) expect(d.bloques.length).toBeGreaterThan(0)
    }
  })

  it('bloqueNuevo con un id desconocido no revienta', () => {
    const b = bloqueNuevo('no-existe-este-ejercicio', { perfil: perfilEjemplo(), ejercicios })
    expect(b.ejercicio).toBe('no-existe-este-ejercicio')
    expect(b.series).toBeGreaterThan(0)
  })

  it('rendimiento: generar una rutina tarda poco (se llama al pulsar «Generar otra variante»)', () => {
    const perfil = perfilEjemplo({ diasFijos: [0, 1, 2, 3, 4, 5] })
    const gym = { id: 1, material: gimnasioNuevo().material }
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) generarRutina({ perfil, gimnasio: gym, marcas: new Map(), ejercicios })
    const ms = (performance.now() - t0) / 20
    console.log(`generarRutina: ${ms.toFixed(1)} ms por rutina`)
    expect(ms).toBeLessThan(150)
  })
})

describe('ajustarATiempo', () => {
  const bloque = (uid: string, series: number, extra: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...extra })
  it('nunca deja un bloque con menos de 1 serie y conserva los principales', () => {
    const bs = [bloque('a', 4), bloque('b', 4), bloque('c', 3, { superserie: 'd' }), bloque('d', 3, { superserie: 'c' }), bloque('e', 3)]
    const pr = new Map([['a', 1], ['b', 2], ['c', 4], ['d', 4], ['e', 5]])
    for (const minutos of [10, 20, 30, 45, 60, 90]) {
      const r = ajustarATiempo(bs, pr, minutos, minutos - 10)
      expect(r.find(b => b.uid === 'a')).toBeTruthy()
      for (const b of r) {
        expect(b.series).toBeGreaterThanOrEqual(1)
        if (b.superserie) expect(r.find(o => o.uid === b.superserie)?.superserie).toBe(b.uid)
      }
    }
  })
})
