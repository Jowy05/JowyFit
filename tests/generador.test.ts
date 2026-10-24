import { describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import { cambiosRutina, claveMovimiento, duracionDia, generarRutina, mismoMovimiento, patronGenerador, plantillas, rutinaDefinitiva, tiemposReales, duracionBloque, descansoAjustado, alternativasDe, bloqueNuevo } from '../src/dominio/generador'
import { gimnasioNuevo } from '../src/datos/repos'
import type { Dia, MarcaEjercicio, Perfil, Bloque } from '../src/datos/tipos'
import { ejercicio } from '../src/catalogo/catalogo'
import { patron } from '../src/catalogo/clasificacion'

const bloque = (uid: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })

describe('estructura según los días', () => {
  it('3 días → cuerpo completo A/B/C', () => {
    expect(plantillas(3).dias.map(d => d.letra)).toEqual(['A', 'B', 'C'])
    expect(plantillas(3).estructura).toContain('Cuerpo completo')
  })
  it('4 días → torso / pierna', () => expect(plantillas(4).estructura).toContain('Torso'))
  it('6 días → empuje / tirón / pierna', () => expect(plantillas(6).dias).toHaveLength(6))
})

describe.skipIf(!hayCatalogo)('generador con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const gym = { ...gimnasioNuevo(), id: 1, material: [...gimnasioNuevo().material, 'leg_extension', 'pec_deck', 'reverse_fly_machine', 'assisted_pullup_machine', 'ab_crunch_machine'] }
  const odiados: MarcaEjercicio[] = [
    { id: 'leg-extension', duele: true, odiado: true },
    { id: 'pec-deck', odiado: true },
    { id: 'machine-reverse-fly', odiado: true },
  ]
  const marcas = new Map(odiados.map(m => [m.id, m]))
  const r = c ? generarRutina({ perfil: perfilEjemplo(), gimnasio: gym, marcas, ejercicios: c.ejercicios }) : null

  it('crea A, B, C y la sesión opcional del sábado', () => {
    expect(r!.dias.map(d => d.letra)).toEqual(['A', 'B', 'C', 'S'])
    expect(r!.dias[0]!.dia).toBe(1)
    expect(r!.dias[3]!.opcional).toBe(true)
  })

  it('nunca propone ejercicios odiados o que duelen, ni como alternativa', () => {
    for (const d of r!.dias) for (const b of d.bloques) {
      for (const id of [b.ejercicio, ...b.alternativas]) expect(['leg-extension', 'pec-deck', 'machine-reverse-fly']).not.toContain(id)
    }
  })

  it('todo el material está en el gimnasio', () => {
    const mat = new Set(gym.material)
    for (const d of r!.dias) for (const b of d.bloques) for (const id of [b.ejercicio, ...b.alternativas]) {
      const e = ejercicio(id)!
      expect(e.material === null || mat.has(e.material)).toBe(true)
    }
  })

  it('cada día cabe en su tiempo (normal y corta)', () => {
    for (const d of r!.dias.filter(x => !x.opcional)) {
      expect(duracionDia(d.bloques) / 60).toBeLessThanOrEqual(60)
      expect(duracionDia(d.bloques, true) / 60).toBeLessThanOrEqual(45)
      expect(d.bloques.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('las alternativas son del mismo patrón y distinto del elegido', () => {
    for (const d of r!.dias) for (const b of d.bloques) {
      expect(b.alternativas).not.toContain(b.ejercicio)
      // El patrón con el que coloca el generador (los pesos muertos de «espalda» sin tirón cuentan como cadera).
      for (const a of b.alternativas) expect(patronGenerador(ejercicio(a)!)).toBe(patronGenerador(ejercicio(b.ejercicio)!))
    }
  })

  it('superseries de brazos emparejadas', () => {
    const a = r!.dias[0]!
    const bi = a.bloques.find(b => patron(ejercicio(b.ejercicio)!) === 'biceps')!
    const tri = a.bloques.find(b => patron(ejercicio(b.ejercicio)!) === 'triceps')!
    expect(bi.superserie).toBe(tri.uid)
    expect(tri.superserie).toBe(bi.uid)
  })

  it('variedad: el empuje horizontal no se repite igual los tres días', () => {
    const empujes = r!.dias.slice(0, 3).map(d => d.bloques.find(b => patron(ejercicio(b.ejercicio)!) === 'empuje-h')?.ejercicio)
    expect(new Set(empujes).size).toBe(3)
  })

  it('muestra la rutina generada (para revisarla a ojo)', () => {
    const texto = r!.dias.map(d => `${d.nombre}: ` + d.bloques.map(b => `${ejercicio(b.ejercicio)!.nombre} ${b.series}×${b.repsMin}-${b.repsMax}${b.superserie ? '(SS)' : ''}${b.fueraEnCorta ? '(fuera corta)' : ''} [${b.alternativas.map(a => ejercicio(a)!.nombre).join(' / ')}]`).join(' | ') + ` · ${Math.round(duracionDia(d.bloques) / 60)}/${Math.round(duracionDia(d.bloques, true) / 60)} min`).join('\n')
    console.log(texto)
    expect(texto.length).toBeGreaterThan(0)
  })
})

describe('zonas sensibles sin etiqueta en RepDB', () => {
  it('con el codo o la muñeca sensibles no propone los ejercicios que más los cargan', async () => {
    const { generarRutina } = await import('../src/dominio/generador')
    const { ZONA_EVITAR } = await import('../src/catalogo/clasificacion')
    const { catalogoReal, perfilEjemplo } = await import('./ayuda')
    const cat = catalogoReal()
    if (!cat) return
    for (const z of ['codo', 'muneca'] as const) {
      const r = generarRutina({ perfil: { ...perfilEjemplo(), zonasSensibles: [z] }, gimnasio: null, marcas: new Map(), ejercicios: cat.ejercicios })
      const ids = r.dias.flatMap(d => d.bloques.flatMap(b => [b.ejercicio, ...b.alternativas]))
      expect(ids.length).toBeGreaterThan(10)
      expect(ids.filter(id => ZONA_EVITAR[z]!.test(id))).toEqual([])
    }
  })
})

describe('descansos de Ajustes', () => {
  it('escalan los descansos y con los valores por defecto no cambian nada', async () => {
    const { descansoAjustado } = await import('../src/dominio/generador')
    expect(descansoAjustado(150)).toBe(150)
    expect(descansoAjustado(150, { compuesto: 150, aislamiento: 90 })).toBe(150)
    expect(descansoAjustado(75, { compuesto: 150, aislamiento: 90 })).toBe(75)
    expect(descansoAjustado(150, { compuesto: 180, aislamiento: 90 })).toBe(180)
    expect(descansoAjustado(120, { compuesto: 90, aislamiento: 90 })).toBe(75)
    expect(descansoAjustado(60, { compuesto: 150, aislamiento: 45 })).toBe(30)
    expect(descansoAjustado(60, { compuesto: 150, aislamiento: 0 })).toBe(60)
  })
})

describe.skipIf(!hayCatalogo)('mismo movimiento: nunca dos variantes del mismo ejercicio el mismo día', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const ejercicios = c?.ejercicios ?? []
  const ej = (id: string) => ejercicios.find(e => e.id === id)!

  it('reconoce las variantes por material y no junta movimientos distintos', () => {
    expect(claveMovimiento(ej('romanian-deadlift'))).toBe('peso muerto rumano')
    expect(mismoMovimiento(ej('romanian-deadlift'), ej('dumbbell-romanian-deadlift'))).toBe(true)
    expect(mismoMovimiento(ej('romanian-deadlift'), ej('smith-machine-rdl'))).toBe(true)
    expect(mismoMovimiento(ej('squat'), ej('smith-machine-squat'))).toBe(true)
    expect(mismoMovimiento(ej('bench-press'), ej('db-bench-press'))).toBe(true)
    expect(mismoMovimiento(ej('bench-press'), ej('close-grip-bench-press'))).toBe(true)
    expect(mismoMovimiento(ej('lateral-raise'), ej('cable-lateral-raise'))).toBe(true)
    // Distintos de verdad: un curl de martillo y uno con barra, una sentadilla y una prensa, un remo y un jalón.
    expect(mismoMovimiento(ej('hammer-curl'), ej('barbell-curl'))).toBe(false)
    expect(mismoMovimiento(ej('squat'), ej('leg-press'))).toBe(false)
    expect(mismoMovimiento(ej('seated-cable-row'), ej('lat-pulldown'))).toBe(false)
    expect(mismoMovimiento(ej('romanian-deadlift'), ej('romanian-deadlift'))).toBe(false)
  })

  it('con la app en catalán o inglés compara igual: las reglas miran el nombre en castellano', () => {
    const traducido = (id: string, nombre: string) => ({ ...ej(id), nombre, nombreEs: ej(id).nombre })
    const rdl = traducido('romanian-deadlift', 'Pes Mort Romanès amb Barra')
    const rdlManuelles = traducido('dumbbell-romanian-deadlift', 'Pes Mort Romanès amb Manuelles')
    expect(claveMovimiento(rdl)).toBe('peso muerto rumano')
    expect(mismoMovimiento(rdl, rdlManuelles)).toBe(true)
    expect(mismoMovimiento(traducido('squat', 'Barbell Back Squat'), traducido('leg-press', 'Leg Press'))).toBe(false)
  })

  it('el peso muerto rumano con mancuernas es de cadera, no un remo', () => {
    expect(patronGenerador(ej('dumbbell-romanian-deadlift'))).toBe('cadera')
    expect(patronGenerador(ej('seated-cable-row'))).toBe('tiron-h')
    expect(patronGenerador(ej('lat-pulldown'))).toBe('tiron-v')
  })

  // Perfiles de la revisión («Primer día», «Persona mayor») y otros habituales.
  const PERFILES: Record<string, Partial<Perfil>> = {
    'dueño': {},
    'primer día': { nivel: 'empiezo', superseries: false, zonasPrioridad: [], preferencia: 'mezcla', reps: 'mezcla' },
    'persona mayor': { nivel: 'empiezo', superseries: false, zonasPrioridad: [], zonasSensibles: ['rodilla', 'lumbar'], preferencia: 'maquinas', minutosNormal: 45, minutosCorta: 30 },
    'peso libre, 4 días': { diasFijos: [1, 2, 4, 5] as Dia[], preferencia: 'libre' },
    '5 días': { diasFijos: [0, 1, 2, 3, 4] as Dia[] },
    '6 días, avanzado': { diasFijos: [0, 1, 2, 3, 4, 5] as Dia[], nivel: 'avanzado', diasOpcionales: [] },
    'sin core ni superseries, 2 días': { diasFijos: [1, 4] as Dia[], core: false, superseries: false },
  }
  const GIMNASIOS: Record<string, string[] | null> = {
    'completo': gimnasioNuevo().material,
    'sin gimnasio': null,
    'sin máquinas': ['dumbbell', 'barbell', 'ez_bar', 'flat_bench', 'pull_up_bar', 'kettlebell'],
    'máquinas y poleas': ['cable', 'leg_press', 'lat_pulldown_machine', 'seated_row_machine', 'chest_press_machine', 'shoulder_press_machine', 'leg_curl', 'leg_extension', 'pec_deck'],
    'mancuernas y banco': ['dumbbell', 'flat_bench'],
  }
  const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

  it('ningún día lleva dos variantes del mismo movimiento (catálogo real, varios perfiles y gimnasios)', () => {
    let dias = 0
    for (const [np, cambios] of Object.entries(PERFILES)) for (const [ng, material] of Object.entries(GIMNASIOS)) for (const variante of [0, 1]) {
      const perfil = perfilEjemplo(cambios)
      const base = { perfil, gimnasio: material ? { id: 1, material } : null, marcas: new Map<string, MarcaEjercicio>(), ejercicios }
      // También la «otra variante» (la que evita lo de la anterior), que tira de ejercicios menos habituales.
      const evitar = variante ? new Set(generarRutina(base).dias.flatMap(d => d.bloques.map(b => b.ejercicio))) : undefined
      const r = generarRutina({ ...base, evitar })
      for (const d of r.dias) {
        const es = d.bloques.map(b => ejercicio(b.ejercicio)!)
        const et = `${np} · ${ng} · variante ${variante} · ${d.nombre}`
        for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
          expect(mismoMovimiento(es[i]!, es[j]!), `${et}: «${es[i]!.nombre}» y «${es[j]!.nombre}»`).toBe(false)
          // Comprobación independiente de la definición: ningún nombre es otro con algo añadido detrás.
          const [a, b] = [sinTildes(es[i]!.nombre), sinTildes(es[j]!.nombre)]
          expect(b.startsWith(`${a} `) || a.startsWith(`${b} `), `${et}: «${es[i]!.nombre}» y «${es[j]!.nombre}»`).toBe(false)
        }
        // Las alternativas («si está ocupado») tampoco son otro ejercicio del mismo día con otro material.
        for (const b of d.bloques) for (const a of b.alternativas) for (const o of d.bloques) {
          if (o !== b) expect(mismoMovimiento(ejercicio(a)!, ejercicio(o.ejercicio)!), `${et}: alternativa ${a} de ${b.ejercicio} repite ${o.ejercicio}`).toBe(false)
        }
        dias++
      }
    }
    expect(dias).toBeGreaterThan(100)
  })
})

describe('tiempos reales de la semana de prueba', () => {
  const series = (ts: number[]) => ts.map(t => ({ hecha: true, calentamiento: false, ts: t * 1000 }))
  it('mide el descanso entre series de un ejercicio suelto', () => {
    const t = tiemposReales([{ ejercicios: [{ ejercicio: 'press', series: series([0, 160, 320]) }] }])
    expect(t.get('press')).toEqual({ serie: 40, descanso: 120 })
  })
  it('no usa los «dos seguidos»: su ciclo ya incluye la serie del compañero', () => {
    const t = tiemposReales([{ ejercicios: [{ ejercicio: 'curl', superserie: 'b2', series: series([0, 175, 350]) }] }])
    expect(t.has('curl')).toBe(false)
  })
})

describe.skipIf(!hayCatalogo)('rutina definitiva tras la semana de prueba', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const gym = { ...gimnasioNuevo(), id: 1 }
  const perfil = perfilEjemplo()
  const prueba = c ? generarRutina({ perfil, gimnasio: gym, marcas: new Map(), ejercicios: c.ejercicios, calibracion: true }) : null
  const compuesto = (id: string) => ejercicio(id)?.mecanica === 'compound'

  it('parte de la rutina de prueba, con sus cambios hechos a mano, y quita la prueba', () => {
    // Un cambio a mano durante la semana de prueba: otro ejercicio en el primer hueco del día A.
    const cambiada = structuredClone(prueba!)
    cambiada.dias[0]!.bloques[0]!.ejercicio = 'leg-press'
    const def = rutinaDefinitiva(cambiada, { perfil, compuesto })
    expect(def.calibracion).toBe(false)
    expect(rutinaDefinitiva({ ...cambiada, id: 4 } as typeof cambiada, { perfil, compuesto })).not.toHaveProperty('id')
    expect(def.dias[0]!.bloques[0]!.ejercicio).toBe('leg-press')
    // El esfuerzo cómodo de la prueba (7) pasa al normal.
    expect(def.dias.flatMap(d => d.bloques).every(b => b.rpe !== 7 || perfil.nivel === 'empiezo')).toBe(true)
  })
  it('si tardas más de lo previsto, recorta lo de menos prioridad y lo dice', () => {
    // Descansos reales larguísimos en todos los ejercicios: no cabe todo.
    const lentos = new Map(prueba!.dias.flatMap(d => d.bloques).map(b => [b.ejercicio, { serie: 60, descanso: 240 }]))
    const def = rutinaDefinitiva(prueba!, { perfil, tiempos: lentos, compuesto })
    for (const d of def.dias.filter(x => !x.opcional)) expect(duracionDia(d.bloques, false, { tiempos: lentos }) / 60).toBeLessThanOrEqual(perfil.minutosNormal)
    const cambios = cambiosRutina(prueba!, def, id => id, d => d.letra)
    expect(cambios.length).toBeGreaterThan(0)
    // Los dos primeros multiarticulares de cada día se quedan.
    for (const d of def.dias) {
      const principales = prueba!.dias.find(x => x.letra === d.letra)!.bloques.slice(0, 2).filter(b => compuesto(b.ejercicio))
      for (const b of principales) expect(d.bloques.some(x => x.uid === b.uid)).toBe(true)
    }
  })
})

describe('duración de un bloque', () => {
  it('solo: series × 45 s + descansos entre series + 75 s de cambio', () => {
    expect(duracionBloque(bloque('a'), undefined)).toBe(3 * 45 + 2 * 90 + 75)
    // Reps altas (10+): series algo más cortas.
    expect(duracionBloque(bloque('a', { repsMin: 10 }), undefined)).toBe(3 * 40 + 2 * 90 + 75)
    // Por tiempo: lo que dura la serie más larga.
    expect(duracionBloque(bloque('p', { registro: 'tiempo', repsMax: 45 }), undefined)).toBe(3 * 45 + 2 * 90 + 75)
    expect(duracionBloque(bloque('a', { series: 1 }), undefined)).toBe(45 + 75)
  })
  it('superserie: las dos series + 20 s de cambio por vuelta y dos cambios de sitio', () => {
    expect(duracionBloque(bloque('a'), bloque('b'))).toBe(3 * (45 + 45 + 20) + 2 * 90 + 150)
  })
  it('con los tiempos reales de la semana de prueba', () => {
    const tiempos = new Map([['a', { serie: 40, descanso: 150 }]])
    expect(duracionBloque(bloque('a'), undefined, { tiempos })).toBe(3 * 40 + 2 * 150 + 75)
  })
  it('un día: 5 min de calentamiento, +3 si empieza con barra, y en la corta sin lo marcado', () => {
    const bs = [bloque('a'), bloque('b', { fueraEnCorta: true })]
    const uno = duracionBloque(bloque('a'), undefined)
    expect(duracionDia(bs)).toBe(300 + 180 + uno * 2)
    expect(duracionDia(bs, true)).toBe(300 + 180 + uno)
    expect(duracionDia([])).toBe(300)
    expect(duracionDia([bloque('c', { registro: 'corporal' })])).toBe(300 + uno)
  })
})

describe('descanso según Ajustes', () => {
  it('sin ajustes o con valores raros, el de la rutina; si no, en proporción y de 15 en 15', () => {
    expect(descansoAjustado(150)).toBe(150)
    expect(descansoAjustado(150, { compuesto: 0, aislamiento: 90 })).toBe(150)
    expect(descansoAjustado(150, { compuesto: 180, aislamiento: 90 })).toBe(180)
    expect(descansoAjustado(75, { compuesto: 150, aislamiento: 60 })).toBe(45)
    expect(descansoAjustado(30, { compuesto: 150, aislamiento: 10 })).toBe(15)
  })
})

describe('tiempos reales', () => {
  it('sin series con hora o con ciclos absurdos (< 20 s o > 10 min) no da tiempos', () => {
    expect(tiemposReales([]).size).toBe(0)
    const ser = (ts: number) => ({ hecha: true, calentamiento: false, ts })
    expect(tiemposReales([{ ejercicios: [{ ejercicio: 'a', series: [ser(0), ser(5_000), ser(900_000)] }] }]).size).toBe(0)
    const t = tiemposReales([{ ejercicios: [{ ejercicio: 'a', series: [ser(0), ser(150_000), ser(300_000)] }] }])
    expect(t.get('a')).toEqual({ serie: 40, descanso: 110 })
  })
})

describe.skipIf(!hayCatalogo)('alternativas y bloques nuevos con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const gym = { ...gimnasioNuevo(), id: 1 }
  it('alternativas de un ejercicio: otras distintas de él, del mismo patrón y con el material del gimnasio', () => {
    const x = { perfil: perfilEjemplo(), gimnasio: gym, marcas: new Map(), ejercicios: c!.ejercicios }
    const alt = alternativasDe('bench-press', x)
    expect(alt.length).toBeGreaterThan(0)
    expect(alt).not.toContain('bench-press')
    for (const id of alt) {
      const e = c!.ejercicios.find(z => z.id === id)!
      expect(e.material == null || gym.material.includes(e.material), id).toBe(true)
    }
    expect(alternativasDe('no-existe', x)).toEqual([])
  })
  it('las alternativas no proponen lo que odia', () => {
    const x = { perfil: perfilEjemplo(), gimnasio: gym, marcas: new Map([['chest-press-machine', { id: 'chest-press-machine', odiado: true }]]), ejercicios: c!.ejercicios }
    expect(alternativasDe('bench-press', x)).not.toContain('chest-press-machine')
  })
  it('bloque nuevo: series y reps razonables, registro correcto y esfuerzo 7 en la semana de prueba', () => {
    const b = bloqueNuevo('bench-press', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios, gimnasio: gym })
    expect(b.ejercicio).toBe('bench-press')
    expect(b.series).toBeGreaterThanOrEqual(3)
    expect(b.repsMin).toBeLessThan(b.repsMax)
    expect(b.registro).toBe('peso')
    const plancha = bloqueNuevo('plank', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios })
    expect(plancha.registro).toBe('tiempo')
    expect(bloqueNuevo('desconocido', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios, calibracion: true }).rpe).toBe(7)
    const a = bloqueNuevo('bench-press', { perfil: perfilEjemplo(), ejercicios: c!.ejercicios })
    expect(a.uid).not.toBe(b.uid)
  })
})
