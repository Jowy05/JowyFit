// Generador v2 (0.8.0): las piezas puras (objetivos, volumen, salud, cola, cardio, modo mayor y revisión semanal)
// y, con el catálogo real, las reglas que tiene que cumplir cualquier rutina generada.
import { describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import type { Bloque, CambioRevision, DiaRutina, Dolor, Rutina, Sesion } from '../src/datos/tipos'
import { gimnasioNuevo } from '../src/datos/repos'
import { versionNecesaria } from '../src/datos/validarCopia'
import { juegoDe, rpeMaximo, queHaraRutina, RPE_MAX_GENERAL, RPE_MAX_PRUDENTE, subirPesoEsBueno } from '../src/dominio/objetivos'
import { seriesEjercicio, seriesSemana } from '../src/dominio/volumen'
import { cargaZona, detalleDolor, doloresDe, nivelDolor, restricciones, rutinaBloqueada } from '../src/dominio/salud'
import { colaDe, diaMinimo, enCola } from '../src/dominio/cola'
import { cardioSinImpacto, hayPasos, metaMovimiento, pasosDePartida } from '../src/dominio/cardio'
import { proponerModoMayor } from '../src/dominio/modoMayor'
import { aplicarCambios, cambiosRevision, CARGA_SUAVE, CARGA_VUELTA, doloresTrasRevision, textoCambio } from '../src/dominio/revision'
import { tarjetaCola, type EstadoDia } from '../src/dominio/semana'
import { generarRutina } from '../src/dominio/generador'
import { deGrupo, quitadoPor } from '../src/catalogo/grupos'
import { ejercicio } from '../src/catalogo/catalogo'

const bloque = (uid: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const dia = (letra: string, bloques: Bloque[] = [bloque(`${letra}1`)], x: Partial<DiaRutina> = {}): DiaRutina => ({ letra, nombre: `Día ${letra}`, dia: null, opcional: false, bloques, ...x })
const hecha = (fecha: string, letra: string, x: Partial<Sesion> = {}) => ({ fecha, letra, estado: 'hecha' as const, rutinaId: 1, inicio: Date.parse(`${fecha}T10:00:00`), ...x })
const dolor = (x: Partial<Dolor> = {}): Dolor => ({ zona: 'rodillas', cuanto: 'regular', cuando: 'fuerza', desde: 'semanas', inicio: '2026-10-01', ...x })

describe('objetivos: tres juegos de parámetros para siete objetivos', () => {
  it('cada objetivo cae en salud, músculo o fuerza; subir de peso solo es bueno al ganar', () => {
    expect([juegoDe('salud'), juegoDe('perder'), juegoDe('recomposicion'), juegoDe('fuerza'), juegoDe(undefined)]).toEqual(['salud', 'salud', 'musculo', 'fuerza', 'salud'])
    expect(subirPesoEsBueno('musculo')).toBe(true)
    expect(subirPesoEsBueno('perder')).toBe(false)
  })
  it('esfuerzo máximo: 2 repeticiones de margen al empezar, al volver o en modo mayor; nunca al fallo', () => {
    expect(rpeMaximo({ nivel: 'intermedio' })).toBe(RPE_MAX_GENERAL)
    expect(rpeMaximo({ nivel: 'vuelvo' })).toBe(RPE_MAX_PRUDENTE)
    expect(rpeMaximo({ nivel: 'avanzado', modoMayor: { activo: true } })).toBe(RPE_MAX_PRUDENTE)
    expect(RPE_MAX_GENERAL).toBeLessThan(10)
  })
  it('«Qué hará tu rutina»: una línea por zona elegida y otra para lo demás', () => {
    const lineas = queHaraRutina({ objetivo: 'musculo', zonasPrioridad: ['brazos', 'piernas'], zonasMucho: ['piernas'] })
    // Brazos, piernas, lo demás y las repeticiones del objetivo.
    expect(lineas).toHaveLength(4)
    expect(lineas[1]).toContain('16') // «Mucho más» con músculo: lo alto del rango
    expect(queHaraRutina({ objetivo: 'salud', zonasPrioridad: [] })).toHaveLength(2)
    expect(queHaraRutina({ objetivo: 'salud', objetivosExtra: ['perder'], zonasPrioridad: [] }).at(-1)).toContain('Cardio y pasos')
  })
})

describe('volumen por zona', () => {
  const p = { objetivo: 'musculo' as const, zonasPrioridad: ['brazos'], zonasMucho: [] as string[], nivel: 'avanzado' as const }
  it('las zonas elegidas llevan más series que el resto, y «Mucho más» aún más', () => {
    const normal = seriesSemana('pecho', p, { sesiones: 3, prueba: false })
    const prioridad = seriesSemana('brazos', p, { sesiones: 3, prueba: false })
    const mucho = seriesSemana('brazos', { ...p, zonasMucho: ['brazos'] }, { sesiones: 3, prueba: false })
    expect(prioridad).toBeGreaterThan(normal)
    expect(mucho).toBeGreaterThan(prioridad)
  })
  it('nunca menos de 4 a la semana; con un entreno, como mucho 4; en la semana de prueba, poco', () => {
    expect(seriesSemana('pecho', { ...p, objetivo: 'salud' }, { sesiones: 3, prueba: false })).toBeGreaterThanOrEqual(4)
    expect(seriesSemana('brazos', p, { sesiones: 1, prueba: false })).toBe(4)
    expect(seriesSemana('brazos', { ...p, nivel: 'empiezo' }, { sesiones: 3, prueba: true })).toBeLessThanOrEqual(6)
  })
  it('por ejercicio: de 2 a 4 series (5 con «Mucho más»)', () => {
    expect(seriesEjercicio(20, 2, false)).toBe(4)
    expect(seriesEjercicio(20, 2, true)).toBe(5)
    expect(seriesEjercicio(2, 3, false)).toBe(2)
  })
})

describe('salud: urgencias, molestias y condiciones', () => {
  it('con una urgencia marcada no hay rutina', () => {
    expect(rutinaBloqueada({ urgencias: ['pecho'] })).toBe(true)
    expect(rutinaBloqueada({ urgencias: [] })).toBe(false)
    expect(rutinaBloqueada({})).toBe(false)
  })
  it('las zonas sensibles de antes pasan a molestias «regular»', () => {
    expect(doloresDe({ zonasSensibles: ['rodilla', 'lumbar'], creado: '2026-01-02T10:00:00.000Z' })).toEqual([
      { zona: 'rodillas', cuanto: 'regular', cuando: 'fuerza', desde: 'meses', inicio: '2026-01-02' },
      { zona: 'lumbar', cuanto: 'regular', cuando: 'fuerza', desde: 'meses', inicio: '2026-01-02' },
    ])
    expect(doloresDe({ dolores: [], zonasSensibles: ['rodilla'], creado: '2026-01-01' })).toEqual([])
  })
  it('nivel de una molestia: mucho o siempre la quita del todo; regular, solo ejercicios seguros; poco, menos', () => {
    expect(nivelDolor({ cuanto: 'mucho', cuando: 'aveces' })).toBe('fuera')
    expect(nivelDolor({ cuanto: 'poco', cuando: 'siempre' })).toBe('fuera')
    expect(nivelDolor({ cuanto: 'regular', cuando: 'fuerza' })).toBe('seguro')
    expect(nivelDolor({ cuanto: 'poco', cuando: 'aveces' })).toBe('menos')
    expect(detalleDolor(dolor())).toBe('regular · al hacer fuerza · desde hace semanas')
  })
  it('sin molestias ni condiciones no quita nada', () => {
    const r = restricciones({ zonasSensibles: [], dolores: [], condicionesSalud: [], creado: '2026-01-01' })
    expect(r.rpeMax).toBeNull()
    expect(r.maxIsometrico).toBeNull()
  })
})

describe('rutina en cola', () => {
  const r = { id: 1, dias: [dia('A'), dia('B'), dia('C'), dia('S', undefined, { opcional: true })] }
  it('toca la siguiente tras la última hecha, sea el día que sea', () => {
    expect(colaDe(r, [], '2026-10-21', 3)!.siguiente.letra).toBe('A')
    const c = colaDe(r, [hecha('2026-10-19', 'A'), hecha('2026-10-21', 'B')], '2026-10-22', 3)!
    expect(c.siguiente.letra).toBe('C')
    expect(c.despues.map(d => d.letra)).toEqual(['A', 'B'])
    expect(c.ultima).toMatchObject({ fecha: '2026-10-21' })
    expect(c.hechasSemana).toBe(2)
  })
  it('la opcional y las que no se acabaron no entran; las de la rutina anterior sí (al rehacerla, sigue donde iba)', () => {
    const c = colaDe(r, [hecha('2026-10-20', 'C'), hecha('2026-10-21', 'S'), hecha('2026-10-21', 'B', { estado: 'curso' as never })], '2026-10-22', 3)!
    expect(c.siguiente.letra).toBe('A')
    expect(colaDe(r, [hecha('2026-10-20', 'A', { rutinaId: 7 })], '2026-10-22', 3)!.siguiente.letra).toBe('B')
  })
  it('tras más de 7 días sin entrenar toca la más atrasada', () => {
    const ses = [hecha('2026-10-01', 'B'), hecha('2026-10-02', 'C'), hecha('2026-10-05', 'A')]
    // Tocaría la B (tras la A), pero la B es la que lleva más tiempo sin hacerse.
    expect(colaDe(r, ses, '2026-10-20', 3)!.siguiente.letra).toBe('B')
    expect(colaDe(r, [hecha('2026-10-01', 'A')], '2026-10-20', 3)!.siguiente.letra).toBe('B') // la que nunca se hizo
  })
  it('las altas nuevas van en cola; quien ya tenía rutina sigue por días', () => {
    expect(enCola({ modoRutina: 'cola' })).toBe(true)
    expect(enCola({})).toBe(false)
  })
  it('sesión mínima: hasta 4 ejercicios del principio, a 2 series, sin dejar una pareja a medias', () => {
    const d = dia('A', [bloque('a'), bloque('b'), bloque('c', { superserie: 'd' }), bloque('d', { superserie: 'c' }), bloque('e')])
    const m = diaMinimo(d)
    expect(m.bloques.map(b => b.uid)).toEqual(['a', 'b', 'c', 'd'])
    expect(m.bloques.every(b => b.series === 2)).toBe(true)
    const corta = diaMinimo(dia('A', [bloque('a'), bloque('b'), bloque('x'), bloque('c', { superserie: 'd' }), bloque('d', { superserie: 'c' })]))
    expect(corta.bloques.map(b => b.uid)).toEqual(['a', 'b', 'x'])
  })
  it('la tarjeta: en curso, hecha hoy, extra si ya se hicieron las de la semana, o la que toca', () => {
    const cola = colaDe(r, [], '2026-10-21', 3)!
    const semana: EstadoDia[] = [{ fecha: '2026-10-21', estado: 'descanso', hoy: true }]
    expect(tarjetaCola(cola, semana, '2026-10-21', true).tipo).toBe('curso')
    expect(tarjetaCola(cola, semana, '2026-10-21', false)).toMatchObject({ tipo: 'hoy', dia: { letra: 'A' } })
    expect(tarjetaCola({ ...cola, hechasSemana: 3 }, semana, '2026-10-21', false).tipo).toBe('opcional')
    const s = { ...hecha('2026-10-21', 'A'), nombre: 'A', gimnasioId: null, version: 'normal' as const, calibracion: false, ejercicios: [] }
    expect(tarjetaCola(cola, [{ fecha: '2026-10-21', estado: 'hecho', hoy: true, sesion: s }], '2026-10-21', false).tipo).toBe('hecho')
  })
})

describe('pasos y cardio', () => {
  it('se empieza cerca de lo que ya haces, sin pasar de lo bueno para tu edad', () => {
    expect(pasosDePartida(4200, 40)).toBe(4500)
    expect(pasosDePartida(14_000, 40)).toBe(10_000)
    expect(pasosDePartida(14_000, 70)).toBe(8000)
    expect(pasosDePartida(null, 70)).toBe(6000)
  })
  it('cada 2 semanas, +1.000 pasos y +15 min de cardio, hasta lo recomendado', () => {
    expect(metaMovimiento({ pasos: 5000, cardio: 60, edad: 40, semanas: 1 })).toEqual({ pasos: 5000, cardio: 60 })
    expect(metaMovimiento({ pasos: 5000, cardio: 60, edad: 40, semanas: 4 })).toEqual({ pasos: 7000, cardio: 90 })
    expect(metaMovimiento({ pasos: 9500, cardio: 140, edad: 40, semanas: 20 })).toEqual({ pasos: 10_000, cardio: 150 })
    // Quien ya hacía más que lo recomendado no baja.
    expect(metaMovimiento({ pasos: 12_000, cardio: 200, edad: 40, semanas: 2 })).toEqual({ pasos: 12_000, cardio: 200 })
  })
  it('sin impacto con rodilla, modo mayor o IMC de 35 o más', () => {
    const base = { zonasSensibles: [], dolores: [], creado: '2026-01-01', alturaCm: 170 }
    expect(cardioSinImpacto(base, 70)).toBe(false)
    expect(cardioSinImpacto({ ...base, dolores: [dolor()] }, 70)).toBe(true)
    expect(cardioSinImpacto({ ...base, modoMayor: { activo: true } }, 70)).toBe(true)
    expect(cardioSinImpacto(base, 102)).toBe(true)
  })
})

describe('modo mayor', () => {
  it('se propone desde los 65; tras «Ahora no», no hasta dentro de un año', () => {
    expect(proponerModoMayor({ nacimiento: '1960-01-01' }, '2026-10-20')).toBe(true)
    expect(proponerModoMayor({ nacimiento: '1970-01-01' }, '2026-10-20')).toBe(false)
    expect(proponerModoMayor({ nacimiento: '1960-01-01', modoMayor: { activo: false, rechazado: '2026-06-01' } }, '2026-10-20')).toBe(false)
    expect(proponerModoMayor({ nacimiento: '1960-01-01', modoMayor: { activo: false, rechazado: '2025-06-01' } }, '2026-10-20')).toBe(true)
    expect(proponerModoMayor({ nacimiento: '1960-01-01', modoMayor: { activo: true } }, '2026-10-20')).toBe(false)
    expect(proponerModoMayor({ nacimiento: '' }, '2026-10-20')).toBe(false)
  })
})

describe('revisión semanal', () => {
  it('las molestias: «ya no» se quita, «peor» sube un nivel, «mejor» baja uno', () => {
    const ds = [dolor({ zona: 'rodillas', cuanto: 'poco' }), dolor({ zona: 'lumbar', cuanto: 'mucho' }), dolor({ zona: 'hombros' })]
    expect(doloresTrasRevision(ds, [{ zona: 'rodillas', va: 'peor' }, { zona: 'lumbar', va: 'mejor' }, { zona: 'hombros', va: 'ya' }]).map(d => [d.zona, d.cuanto])).toEqual([['rodillas', 'regular'], ['lumbar', 'regular']])
  })
})

describe.skipIf(!hayCatalogo)('revisión semanal: los cambios en la rutina', () => {
  if (hayCatalogo) catalogoReal()
  // La prensa (compuesto) y la extensión (aislamiento) cargan la rodilla.
  const ctx = { ejercicio, candidatos: () => [] }
  const rut = (bloques: Bloque[]): Rutina => ({ id: 1, creada: '2026-10-01', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null, dias: [dia('A', bloques)] })
  const perfil = { zonasSensibles: [], creado: '2026-01-01', dolores: [dolor({ cuanto: 'poco', cuando: 'aveces' })] }

  it('la prensa y la extensión cargan la rodilla', () => {
    expect(cargaZona('rodillas', ejercicio('leg-press')!)).toBe(true)
    expect(cargaZona('rodillas', ejercicio('leg-extension')!)).toBe(true)
  })
  it('va peor: el compuesto baja el peso y el de aislamiento una serie; se deshace igual', () => {
    const r = rut([bloque('b1', { ejercicio: 'leg-press' }), bloque('b2', { ejercicio: 'leg-extension' })])
    const cambios = cambiosRevision(r, perfil, { ...ctx, zonasPeor: ['rodillas'], zonasMejor: [], activos: [] })
    expect(cambios.map(c => [c.uid, c.despues.cargaPct, c.despues.series])).toEqual([['b1', CARGA_SUAVE, 3], ['b2', undefined, 2]])
    const suave = aplicarCambios(r, cambios)
    expect(suave.dias[0]!.bloques.map(b => b.cargaPct ?? b.series)).toEqual([CARGA_SUAVE, 2])
    expect(aplicarCambios(suave, cambios, true)).toEqual(r)
    expect(textoCambio(cambios[0]!, id => id)).toBe('leg-press: peso al 80 %')
  })

  it('va mejor: vuelve poco a poco (−10 % y luego normal) y no se repite al seguir mejor', () => {
    const r0 = rut([bloque('b1', { ejercicio: 'leg-press' })])
    const suavizar = cambiosRevision(r0, perfil, { ...ctx, zonasPeor: ['rodillas'], zonasMejor: [], activos: [] })
    let r = aplicarCambios(r0, suavizar)
    const activos: CambioRevision[] = [...suavizar]
    const semana = () => {
      const cs = cambiosRevision(r, perfil, { ...ctx, zonasPeor: [], zonasMejor: [{ zona: 'rodillas', del: false }], activos })
      r = aplicarCambios(r, cs)
      activos.push(...cs)
      return cs
    }
    expect(semana().map(c => [c.despues.cargaPct, c.vuelta])).toEqual([[CARGA_VUELTA, true]])
    expect(semana().map(c => [c.despues.cargaPct, c.vuelta])).toEqual([[undefined, true]])
    expect(r).toEqual(r0)
    // Ya está normal: más semanas «mejor» no cambian nada.
    expect(semana()).toEqual([])
    expect(r).toEqual(r0)
  })

  it('dos semanas peor y luego mejor: vuelve hasta el bloque de antes del primer suavizado y no oscila', () => {
    const r0 = rut([bloque('b2', { ejercicio: 'leg-extension' })])
    let r = r0
    const activos: CambioRevision[] = []
    const revision = (zonasPeor: ('rodillas')[], mejor: boolean) => {
      const cs = cambiosRevision(r, perfil, { ...ctx, zonasPeor, zonasMejor: mejor ? [{ zona: 'rodillas', del: false }] : [], activos })
      r = aplicarCambios(r, cs)
      activos.push(...cs)
    }
    revision(['rodillas'], false)
    revision(['rodillas'], false)
    expect(r.dias[0]!.bloques[0]!.series).toBe(1)
    const series: (number | undefined)[][] = []
    for (let i = 0; i < 5; i++) { revision([], true); series.push([r.dias[0]!.bloques[0]!.series, r.dias[0]!.bloques[0]!.cargaPct]) }
    expect(series).toEqual([[3, CARGA_VUELTA], [3, undefined], [3, undefined], [3, undefined], [3, undefined]])
  })

  it('el impacto se mira por palabras enteras: «crunch» no es correr', () => {
    expect(cargaZona('rodillas', ejercicio('cable-crunch')!)).toBe(false)
  })
})

describe('copias: la versión que hace falta', () => {
  it('1 sin nada nuevo, 2 con ejercicios propios, 3 con revisiones o campos del generador v2', () => {
    expect(versionNecesaria({ perfil: [{ objetivo: 'recomposicion' }] })).toBe(1)
    expect(versionNecesaria({ perfil: [{ objetivo: 'fuerza' }], propios: [{}] })).toBe(2)
    expect(versionNecesaria({ perfil: [{ objetivo: 'salud' }] })).toBe(3)
    expect(versionNecesaria({ perfil: [{ objetivo: 'fuerza', noQuiero: ['poleas'] }] })).toBe(3)
    expect(versionNecesaria({ perfil: [], revisiones: [{}] })).toBe(3)
    // Fuera del perfil: sesión mínima, peso rebajado, cardio, equilibrio y el aviso de la revisión.
    const base = { perfil: [{ objetivo: 'recomposicion' }] }
    expect(versionNecesaria({ ...base, sesiones: [{ version: 'minima', ejercicios: [] }] })).toBe(3)
    expect(versionNecesaria({ ...base, sesiones: [{ version: 'normal', ejercicios: [{ cargaPct: 0.8 }] }] })).toBe(3)
    expect(versionNecesaria({ ...base, pasos: [{ cardio: [{ tipo: 'bici', min: 20 }] }] })).toBe(3)
    expect(versionNecesaria({ ...base, rutinas: [{ equilibrio: 6, dias: [] }] })).toBe(3)
    expect(versionNecesaria({ ...base, ajustes: [{ noti: { revision: true } }] })).toBe(3)
    expect(versionNecesaria({ ...base, perfil: [{ objetivo: 'fuerza', progresoMovimiento: '2026-10-05' }] })).toBe(3)
    expect(versionNecesaria({ ...base, sesiones: [{ version: 'normal', ejercicios: [{}] }], pasos: [{ pasos: 5000 }] })).toBe(1)
  })
  it('un día con cardio y sin pasos no cuenta como día de 0 pasos', () => {
    expect(hayPasos({ pasos: 0, cardio: [{ tipo: 'bici', min: 20 }] })).toBe(false)
    expect(hayPasos({ pasos: 0 })).toBe(true)
    expect(hayPasos({ pasos: 4000, cardio: [{ tipo: 'bici', min: 20 }] })).toBe(true)
  })
})

describe.skipIf(!hayCatalogo)('generador v2 con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const gym = { ...gimnasioNuevo(), id: 1 }
  const generar = (cambios: Parameters<typeof perfilEjemplo>[0]) => generarRutina({ perfil: perfilEjemplo(cambios), gimnasio: gym, marcas: new Map(), ejercicios: c!.ejercicios })
  const todos = (r: ReturnType<typeof generarRutina>) => r.dias.flatMap(d => d.bloques)

  it('«No quiero»: nada de esos grupos, ni como alternativa', () => {
    const r = generar({ noQuiero: ['poleas', 'libre'] })
    for (const b of todos(r)) for (const id of [b.ejercicio, ...b.alternativas]) {
      const e = ejercicio(id)!
      expect(quitadoPor(e, ['poleas', 'libre']), id).toBe(false)
    }
    expect(todos(r).length).toBeGreaterThan(8)
  })
  it('si un grupo fuera deja un hueco sin nada, lo dice en «sin cubrir»', () => {
    const r = generar({ noQuiero: ['maquinas', 'poleas', 'libre'] })
    expect(todos(r).every(b => deGrupo(ejercicio(b.ejercicio)!, 'corporal') || !quitadoPor(ejercicio(b.ejercicio)!, ['maquinas', 'poleas', 'libre']))).toBe(true)
    expect(r.sinCubrir?.length ?? 0).toBeGreaterThan(0)
  })
  it('esfuerzo: nunca al fallo; con «vuelvo» o modo mayor, 2 de margen (RPE ≤ 8)', () => {
    expect(Math.max(...todos(generar({ nivel: 'avanzado', objetivo: 'fuerza' })).map(b => b.rpe))).toBeLessThanOrEqual(RPE_MAX_GENERAL)
    expect(Math.max(...todos(generar({ nivel: 'vuelvo' })).map(b => b.rpe))).toBeLessThanOrEqual(RPE_MAX_PRUDENTE)
    expect(Math.max(...todos(generar({ modoMayor: { activo: true } })).map(b => b.rpe))).toBeLessThanOrEqual(RPE_MAX_PRUDENTE)
  })
  it('modo mayor: equilibrio al final y sin superseries', () => {
    const r = generar({ modoMayor: { activo: true }, superseries: true })
    expect(r.equilibrio).toBeGreaterThan(0)
    expect(todos(r).some(b => b.superserie)).toBe(false)
  })
  it('fuerza: pocas repeticiones en los principales; salud: de 8 en adelante', () => {
    const fuerza = todos(generar({ objetivo: 'fuerza', nivel: 'avanzado' }))
    const salud = todos(generar({ objetivo: 'salud', reps: 'mezcla' }))
    expect(Math.min(...fuerza.map(b => b.repsMin))).toBeLessThanOrEqual(6)
    expect(Math.min(...salud.filter(b => b.registro === 'peso').map(b => b.repsMin))).toBeGreaterThanOrEqual(8)
  })
  it('una molestia fuerte en la rodilla: nada que la cargue y no esté marcado como seguro', () => {
    const p = perfilEjemplo({ dolores: [dolor({ cuanto: 'mucho' })] })
    const r = generarRutina({ perfil: p, gimnasio: gym, marcas: new Map(), ejercicios: c!.ejercicios })
    const salud = restricciones(p)
    for (const b of todos(r)) expect(salud.fuera(ejercicio(b.ejercicio)!), b.ejercicio).toBeNull()
  })
})
