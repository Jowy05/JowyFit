// Catálogo RepDB: nombres como se dicen en el gimnasio, búsqueda sin tildes, imágenes, relacionados,
// carga (con y sin conexión), clasificación por patrón y por cómo se apunta, y el catálogo real.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Catalogo, Ejercicio } from '../src/catalogo/tipos'
import { catalogoReal, hayCatalogo } from './ayuda'

const ejer = (id: string, x: Partial<Ejercicio> = {}): Ejercicio => ({
  id, nombre: id, descripcion: '', instrucciones: [], consejos: [], categoria: 'strength', fuerza: 'push', mecanica: 'compound', dificultad: 'beginner',
  material: 'barbell', zona: 'chest', principales: ['pectoralis_major'], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false,
  poses: ['start', 'peak'], met: 5, ...x,
})
const mini = (): Catalogo => ({
  fuente: 'RepDB', version: 1, generado: '2026-10-01',
  etiquetas: { category: { strength: 'Fuerza' } },
  musculos: { pectoralis_major: { nombre: 'Pectoral mayor', cientifico: 'Pectoralis major', zona: 'chest', imagen: 'pecho.webp' }, triceps_brachii: { nombre: 'Tríceps', cientifico: 'Triceps', zona: 'upper_arms' } },
  material: { barbell: { nombre: 'Barra', etiquetas: [], imagen: 'barra.webp' }, smith_machine: { nombre: 'Máquina Smith', etiquetas: [] }, cable: { nombre: 'Polea', etiquetas: [] } },
  ejercicios: [
    ejer('bench-press', { nombre: 'Press de Banca con Barra', descripcion: 'En la Máquina Smith o con barra.', instrucciones: ['Usa la máquina Smith si vas solo.'], consejos: ['La barra Smith va guiada.'] }),
    ejer('cable-fly', { nombre: 'Aperturas con Cable', material: 'cable', mecanica: 'isolation', poses: ['main'] }),
    ejer('smith-bench', { nombre: 'Press en Máquina Smith', material: 'smith_machine' }),
    ejer('ez-curl', { nombre: 'Curl con Barra EZ', zona: 'upper_arms', principales: ['biceps_brachii'], mecanica: 'isolation', poses: [] }),
    ejer('dips', { nombre: 'Fondos', material: null, pesoCorporal: true, principales: ['pectoralis_major', 'triceps_brachii'], etiquetas: ['calisthenics'] }),
    ejer('burpees', { nombre: 'Burpees', material: null, categoria: 'cardio', zona: 'full_body', principales: [] }),
  ],
})

let cat: typeof import('../src/catalogo/catalogo')
beforeEach(async () => {
  vi.resetModules()
  vi.unstubAllGlobals()
  cat = await import('../src/catalogo/catalogo')
})

describe('nombres como se dicen en el gimnasio', () => {
  it('Cable → Polea, Barra EZ → Barra Z y Máquina Smith → Máquina de Barra Guiada', async () => {
    expect(cat.nombreComun('Aperturas con Cable')).toBe('Aperturas en Polea')
    expect(cat.nombreComun('Cable Crossover')).toBe('Polea Crossover')
    expect(cat.nombreComun('Curl con Barra EZ')).toBe('Curl con Barra Z')
    expect(cat.nombreComun('Press en Máquina Smith')).toBe('Press en Máquina de Barra Guiada')
    expect(cat.nombreComun('Cableado')).toBe('Cableado') // solo la palabra entera
    expect(cat.textoComun('Usa la máquina Smith. La Máquina Smith y la barra Smith.')).toBe('Usa la máquina de barra guiada. La Máquina de barra guiada y la barra guiada.')
  })
  it('usarCatalogo los cambia en nombres, descripciones, pasos, consejos y material', () => {
    const c = mini()
    cat.usarCatalogo(c)
    expect(cat.nombreEjercicio('cable-fly')).toBe('Aperturas en Polea')
    const b = cat.ejercicio('bench-press')!
    expect(b.descripcion).toBe('En la Máquina de barra guiada o con barra.')
    expect(b.instrucciones[0]).toContain('máquina de barra guiada')
    expect(b.consejos[0]).toContain('barra guiada')
    expect(cat.nombreMaterial('smith_machine')).toBe('Máquina de barra guiada')
    expect(cat.catalogoCargado()).toBe(c)
  })
})

describe('sin catálogo cargado', () => {
  it('nada rompe: «Ejercicio», la clave del material y del músculo', () => {
    expect(cat.catalogoCargado()).toBeNull()
    expect(cat.ejercicio('bench-press')).toBeUndefined()
    expect(cat.ejercicio(null)).toBeUndefined()
    expect(cat.ejercicio(undefined)).toBeUndefined()
    expect(cat.nombreEjercicio('bench-press')).toBe('Ejercicio')
    expect(cat.nombreMaterial('barbell')).toBe('barbell')
    expect(cat.nombreMaterial(null)).toBe('Peso corporal')
    expect(cat.nombreMusculo('triceps_brachii')).toBe('triceps_brachii')
    expect(cat.etiqueta('category', 'strength')).toBe('strength')
    expect(cat.imagenMaterial('barbell')).toBeUndefined()
    expect(cat.imagenMusculo('pectoralis_major')).toBeUndefined()
  })
})

describe('con catálogo', () => {
  beforeEach(() => cat.usarCatalogo(mini()))
  it('imágenes: pose pedida, la primera, «main» si no hay poses, y miniatura con «peak»', () => {
    const b = cat.ejercicio('bench-press')!
    expect(cat.imagen(b)).toBe('/repdb/img/bench-press-start.webp')
    expect(cat.imagen(b, 'peak')).toBe('/repdb/img/bench-press-peak.webp')
    expect(cat.miniatura(b)).toBe('/repdb/mini/bench-press-peak.webp')
    expect(cat.miniatura(cat.ejercicio('cable-fly')!)).toBe('/repdb/mini/cable-fly-main.webp')
    expect(cat.imagen(cat.ejercicio('ez-curl')!)).toBe('/repdb/img/ez-curl-main.webp')
    expect(cat.miniatura(cat.ejercicio('ez-curl')!)).toBe('/repdb/mini/ez-curl-main.webp')
  })
  it('imágenes de material y músculo (si las hay)', () => {
    expect(cat.imagenMaterial('barbell')).toBe('/repdb/maq/barra.webp')
    expect(cat.imagenMaterial('cable')).toBeUndefined()
    expect(cat.imagenMaterial('nada')).toBeUndefined()
    expect(cat.imagenMusculo('pectoralis_major')).toBe('/repdb/mus/pecho.webp')
    expect(cat.imagenMusculo('triceps_brachii')).toBeUndefined()
    expect(cat.nombreMusculo('pectoralis_major')).toBe('Pectoral mayor')
    expect(cat.etiqueta('category', 'strength')).toBe('Fuerza')
    expect(cat.etiqueta('nada', 'x')).toBe('x')
  })
  it('buscar sin tildes ni mayúsculas, por varias palabras, por músculo, material o id', () => {
    const lista = cat.catalogoCargado()!.ejercicios
    expect(cat.normalizar('Máquina ÉXITO ñ')).toBe('maquina exito n')
    expect(cat.buscar('', lista)).toBe(lista)
    expect(cat.buscar('   ', lista)).toBe(lista)
    expect(cat.buscar('PRESS banca', lista).map(e => e.id)).toEqual(['bench-press'])
    expect(cat.buscar('polea', lista).map(e => e.id)).toEqual(['cable-fly'])
    expect(cat.buscar('triceps', lista).map(e => e.id)).toEqual(['dips'])
    expect(cat.buscar('peso corporal', lista).map(e => e.id)).toEqual(['dips', 'burpees'])
    expect(cat.buscar('Calistenia', lista).map(e => e.id)).toEqual(['dips'])
    expect(cat.buscar('calisthenics', lista).map(e => e.id)).toEqual(['dips'])
    expect(cat.buscar('cardio', lista).map(e => e.id)).toEqual(['burpees'])
    expect(lista.filter(cat.esCalistenia).map(e => e.id)).toEqual(['dips'])
    expect(lista.filter(cat.esCardio).map(e => e.id)).toEqual(['burpees'])
    expect(cat.buscar('ez curl', lista).map(e => e.id)).toEqual(['ez-curl'])
    expect(cat.buscar('nada de nada', lista)).toEqual([])
  })
  it('relacionados: misma zona y categoría, con músculo en común, sin él mismo', () => {
    const lista = cat.catalogoCargado()!.ejercicios
    const r = cat.relacionados(cat.ejercicio('bench-press')!, lista)
    expect(r.map(e => e.id)).not.toContain('bench-press')
    expect(r.map(e => e.id)).not.toContain('ez-curl')
    // A igualdad de puntos, por nombre; más músculos y la misma mecánica suben.
    expect(r.map(e => e.id)).toEqual(['dips', 'smith-bench', 'cable-fly'])
    expect(cat.relacionados(cat.ejercicio('bench-press')!, lista, 1)).toHaveLength(1)
  })
})

describe('cargar el catálogo', () => {
  it('lo pide una sola vez y lo guarda', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => mini() }))
    vi.stubGlobal('fetch', f)
    const [a, b] = await Promise.all([cat.cargarCatalogo(), cat.cargarCatalogo()])
    expect(a).toBe(b)
    expect(await cat.cargarCatalogo()).toBe(a)
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0]).toEqual(['/repdb/catalogo.json'])
    expect(cat.nombreEjercicio('cable-fly')).toBe('Aperturas en Polea')
  })
  it('si el servidor falla, da un error que se entiende', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }))
    await expect(cat.cargarCatalogo()).rejects.toThrow('No se pudo cargar el catálogo (404)')
    expect(cat.catalogoCargado()).toBeNull()
  })
  it('fallaba: tras un fallo ya no se volvía a intentar; ahora el siguiente intento lo carga', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('sin conexión') })
    await expect(cat.cargarCatalogo()).rejects.toThrow()
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => mini() }))
    expect((await cat.cargarCatalogo()).ejercicios).toHaveLength(6)
  })
})

describe('clasificación', () => {
  let cl: typeof import('../src/catalogo/clasificacion')
  beforeEach(async () => { cl = await import('../src/catalogo/clasificacion') })
  it('cómo se apunta cada ejercicio', () => {
    expect(cl.tipoRegistro(ejer('run', { categoria: 'cardio' }))).toBe('cardio')
    expect(cl.tipoRegistro(ejer('assisted-pull-ups', { material: 'assisted_pullup_machine' }))).toBe('asistido')
    expect(cl.tipoRegistro(ejer('assisted-dips', { material: null }))).toBe('asistido')
    expect(cl.tipoRegistro(ejer('plank', { material: null, fuerza: 'static' }))).toBe('tiempo')
    expect(cl.tipoRegistro(ejer('dead-hang', { material: 'pull_up_bar' }))).toBe('tiempo')
    expect(cl.tipoRegistro(ejer('db-press', { material: 'dumbbell' }))).toBe('mancuerna')
    expect(cl.tipoRegistro(ejer('kb-swing', { material: 'kettlebell' }))).toBe('mancuerna')
    expect(cl.tipoRegistro(ejer('push-up', { material: null }))).toBe('corporal')
    expect(cl.tipoRegistro(ejer('pull-up', { material: 'pull_up_bar', pesoCorporal: true }))).toBe('corporal')
    // Barra, paralelas, anillas y TRX sin la marca de peso corporal: por repeticiones; los lastrados, con kilos.
    expect(cl.tipoRegistro(ejer('pull-up', { material: 'pull_up_bar', fuerza: 'pull' }))).toBe('corporal')
    expect(cl.tipoRegistro(ejer('ring-dips', { material: 'rings' }))).toBe('corporal')
    expect(cl.tipoRegistro(ejer('trx-row', { material: 'suspension_trainer', fuerza: 'pull' }))).toBe('corporal')
    expect(cl.tipoRegistro(ejer('weighted-pull-up', { material: 'pull_up_bar', fuerza: 'pull' }))).toBe('peso')
    expect(cl.tipoRegistro(ejer('weighted-dips', { material: 'dip_station' }))).toBe('peso')
    expect(cl.tipoRegistro(ejer('bench-press'))).toBe('peso')
  })
  it('patrón de movimiento por zona', () => {
    const p = (x: Partial<Ejercicio>) => cl.patron(ejer('x', x))
    expect(p({ categoria: 'stretching' })).toBe('estiramiento')
    expect(p({ categoria: 'cardio' })).toBe('cardio')
    expect(p({ categoria: 'olympic' })).toBe('potencia')
    expect(p({ zona: 'upper_legs', principales: ['quadriceps'] })).toBe('rodilla')
    expect(p({ zona: 'upper_legs', principales: ['quadriceps'], mecanica: 'isolation' })).toBe('cuadriceps')
    expect(p({ zona: 'upper_legs', principales: ['hamstrings'], mecanica: 'isolation' })).toBe('femoral')
    expect(p({ zona: 'upper_legs', principales: ['adductors'] })).toBe('gluteo')
    expect(p({ zona: 'upper_legs', principales: ['hamstrings'] })).toBe('cadera')
    expect(p({ zona: 'lower_legs' })).toBe('gemelo')
    expect(p({ zona: 'chest', mecanica: 'isolation' })).toBe('pecho-aisl')
    expect(p({ zona: 'shoulders', principales: ['lateral_deltoid'], mecanica: 'isolation' })).toBe('hombro-lat')
    expect(p({ zona: 'shoulders', principales: ['posterior_deltoid'] })).toBe('hombro-post')
    expect(p({ zona: 'shoulders', principales: ['trapezius'] })).toBe('trapecio')
    expect(p({ zona: 'shoulders', principales: ['anterior_deltoid'], fuerza: 'pull' })).toBe('hombro-post')
    expect(p({ zona: 'shoulders', principales: ['anterior_deltoid'] })).toBe('empuje-v')
    expect(p({ zona: 'back', principales: ['erector_spinae'] })).toBe('lumbar')
    expect(p({ zona: 'back', principales: ['trapezius'], mecanica: 'isolation' })).toBe('trapecio')
    expect(cl.patron(ejer('lat-pulldown', { zona: 'back', principales: ['latissimus_dorsi'] }))).toBe('tiron-v')
    expect(p({ zona: 'back', principales: ['latissimus_dorsi'], material: 'lat_pulldown_machine' })).toBe('tiron-v')
    expect(p({ zona: 'back', principales: ['latissimus_dorsi'] })).toBe('tiron-h')
    expect(p({ zona: 'upper_arms', principales: ['triceps_brachii'] })).toBe('triceps')
    expect(p({ zona: 'upper_arms', principales: ['biceps_brachii'] })).toBe('biceps')
    expect(p({ zona: 'lower_arms' })).toBe('antebrazo')
    expect(p({ zona: 'core' })).toBe('core')
    expect(p({ zona: 'full_body' })).toBe('completo')
    for (const v of Object.values(cl.NOMBRE_PATRON)) expect(v).toBeTruthy()
  })
  it('máquina o peso libre', () => {
    expect(cl.ES_MAQUINA(ejer('a', { material: 'chest_press_machine' }))).toBe(true)
    expect(cl.ES_MAQUINA(ejer('a', { material: 'cable' }))).toBe(true)
    expect(cl.ES_MAQUINA(ejer('a', { material: 'leg_press' }))).toBe(true)
    expect(cl.ES_MAQUINA(ejer('a', { material: 'barbell' }))).toBe(false)
    expect(cl.ES_MAQUINA(ejer('a', { material: null }))).toBe(false)
    expect(cl.ES_LIBRE(ejer('a', { material: 'dumbbell' }))).toBe(true)
    expect(cl.ES_LIBRE(ejer('a', { material: null }))).toBe(false)
  })
  it('grupos de material sin claves repetidas; zonas y etiquetas', () => {
    expect(new Set(cl.TODAS_LAS_CLAVES).size).toBe(cl.TODAS_LAS_CLAVES.length)
    expect(cl.GRUPOS_MATERIAL.map(g => g.id)).toEqual(['libre', 'poleas', 'pierna', 'torso', 'dominadas', 'cardio', 'accesorios'])
    expect(cl.ZONA_SEGURA).toEqual({ rodilla: 'knee_safe', lumbar: 'lower_back_safe', hombro: 'shoulder_safe' })
    expect(cl.ETIQUETAS_ES.knee_safe).toBe('Cuida la rodilla')
    expect(cl.ZONA_EVITAR.codo!.test('skull-crusher')).toBe(true)
    expect(cl.ZONA_EVITAR.codo!.test('bench-press')).toBe(false)
    expect(cl.ZONA_EVITAR.muneca!.test('push-ups')).toBe(true)
    expect(cl.ZONA_EVITAR.muneca!.test('dips')).toBe(true)
    expect(cl.ZONA_EVITAR.muneca!.test('lat-pulldown')).toBe(false)
    expect(new Set(cl.HABITUALES).size).toBe(cl.HABITUALES.length)
  })
})

describe.skipIf(!hayCatalogo)('el catálogo real de RepDB', () => {
  it('todos los ejercicios tienen id único, nombre en español sin «Cable» ni «Smith», patrón y registro', async () => {
    vi.resetModules()
    const { usarCatalogo, catalogoCargado } = await import('../src/catalogo/catalogo')
    const { patron, tipoRegistro, HABITUALES } = await import('../src/catalogo/clasificacion')
    const c = catalogoReal()
    usarCatalogo(c)
    const ej = catalogoCargado()!.ejercicios
    expect(new Set(ej.map(e => e.id)).size).toBe(ej.length)
    for (const e of ej) {
      expect(e.nombre, e.id).toBeTruthy()
      expect(e.nombre, e.id).not.toMatch(/\bCable\b|Máquina Smith|Barra EZ/)
      expect(patron(e), e.id).toBeTruthy()
      expect(['peso', 'mancuerna', 'asistido', 'corporal', 'tiempo', 'cardio']).toContain(tipoRegistro(e))
    }
    // Los ejercicios «habituales» que prefiere el generador existen en el catálogo.
    const ids = new Set(ej.map(e => e.id))
    const faltan = HABITUALES.filter(id => !ids.has(id))
    expect(faltan).toEqual([])
  })
  it('hay calistenia y cardio de verdad, y buscarlos por su nombre los encuentra (no son solo máquinas y pesas)', async () => {
    vi.resetModules()
    const { usarCatalogo, catalogoCargado, buscar, esCalistenia, esCardio } = await import('../src/catalogo/catalogo')
    usarCatalogo(catalogoReal())
    const ej = catalogoCargado()!.ejercicios
    const cal = ej.filter(esCalistenia), car = ej.filter(esCardio)
    expect(cal.length).toBeGreaterThan(60)
    expect(car.length).toBeGreaterThan(15)
    for (const id of ['pull-up', 'push-up', 'dips']) expect(cal.map(e => e.id), id).toContain(id)
    for (const id of ['running', 'jump-rope', 'burpees']) expect(car.map(e => e.id), id).toContain(id)
    expect(buscar('calistenia', ej)).toHaveLength(cal.length)
    expect(buscar('cardio', ej)).toHaveLength(car.length)
  })
})

describe('material corto en las listas', () => {
  it('quita «Máquina de» en castellano y catalán, y «Machine» en inglés', async () => {
    const { materialSinMaquina } = await import('../src/pantallas/rutina/comun')
    expect(materialSinMaquina('Máquina de remo')).toBe('remo')
    expect(materialSinMaquina('Màquina de rem')).toBe('rem')
    expect(materialSinMaquina("Màquina d'extensió d'esquena")).toBe("extensió d'esquena")
    expect(materialSinMaquina('Leg Press Machine')).toBe('Leg Press')
    expect(materialSinMaquina('Barra')).toBe('Barra')
  })
})
