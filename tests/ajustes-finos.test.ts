// Ajustes finos de AJU-01 y metas de repeticiones: franjas horarias de comida, trote → pasos (también al apuntar
// «Correr»), metas como «10 dominadas seguidas» y las reglas de la copia para todo ello.
import { beforeEach, describe, expect, it } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import { ajustesPorDefecto, guardarAjustes, leerAjustes, perfilPorDefecto } from '../src/datos/repos'
import { apuntar, apuntarPlantilla } from '../src/datos/acciones/comida'
import { apuntarCardio, guardarPasosAuto } from '../src/datos/acciones/cuerpo'
import { valorActualMeta } from '../src/datos/consultas'
import { validarDatos, versionNecesaria } from '../src/datos/validarCopia'
import { falloFranjas, FRANJAS_HORAS, franjaPorHora, franjasValidas } from '../src/dominio/comida'
import { pasosDeCardio } from '../src/dominio/cardio'
import { kcalPasos } from '../src/dominio/energia'
import { actualEjercicio, kmDeTrote, pasosEquivalentes } from '../src/dominio/tendencias'
import { metasInforme } from '../src/informe/calculo/cuerpo'
import type { Ctx } from '../src/informe/calculo/contexto'
import { TIPOS_CONSEJO, type Meta, type Serie, type Sesion } from '../src/datos/tipos'
import { cuentaRepeticiones } from '../src/catalogo/clasificacion'
import type { Ejercicio } from '../src/catalogo/tipos'

beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })

const HOY = '2026-11-03'

describe('franjas horarias', () => {
  it('las de siempre: de 5 a 11 desayuno, hasta las 16:30 comida, hasta las 19:30 merienda; luego y de madrugada, cena', () => {
    expect(['04:59', '05:00', '10:59', '11:00', '16:29', '16:30', '19:29', '19:30', '23:59'].map(h => franjaPorHora(h)))
      .toEqual(['cena', 'desayuno', 'desayuno', 'comida', 'comida', 'merienda', 'merienda', 'cena', 'cena'])
  })
  it('con las horas de Ajustes (7 · 14 · 17 · 20)', () => {
    const h = { desayuno: '07:00', comida: '14:00', merienda: '17:00', cena: '20:00' }
    expect(['06:30', '07:00', '13:59', '14:00', '17:00', '19:59', '20:00'].map(x => franjaPorHora(x, h)))
      .toEqual(['cena', 'desayuno', 'desayuno', 'comida', 'merienda', 'merienda', 'cena'])
  })
  it('cada comida tiene que empezar después de la anterior; si no, se usan las de siempre', () => {
    expect(franjasValidas(FRANJAS_HORAS)).toBe(true)
    const mal = { desayuno: '07:00', comida: '06:00', merienda: '17:00', cena: '20:00' }
    expect(franjasValidas(mal)).toBe(false)
    expect(franjasValidas({ ...FRANJAS_HORAS, merienda: FRANJAS_HORAS.comida })).toBe(false)
    expect(franjaPorHora('12:00', mal)).toBe(franjaPorHora('12:00'))
  })
  it('el aviso de la fila: a medio escribir (sin hora) o fuera de orden; si valen, ninguno', () => {
    expect(falloFranjas(FRANJAS_HORAS)).toBe('')
    expect(falloFranjas({ ...FRANJAS_HORAS, comida: '' })).toBe('Pon la hora de cada comida')
    // «12:00» pasa por «01:00» al teclear: sale el aviso, pero no se guarda ni se deshace lo escrito (eso lo hace la fila).
    expect(falloFranjas({ ...FRANJAS_HORAS, comida: '01:00' })).toBe('Cada comida tiene que empezar más tarde que la anterior')
    expect(falloFranjas({ ...FRANJAS_HORAS, comida: '12:00' })).toBe('')
  })
  it('al apuntar sin franja se usan las horas guardadas en Ajustes', async () => {
    const h = { desayuno: '07:00', comida: '14:00', merienda: '17:00', cena: '20:00' }
    await guardarAjustes({ franjasHoras: h })
    await apuntar({ fecha: HOY, hora: '12:00', nombre: 'Bocadillo', kcal: 400, proteina: 15, racion: 'N', tipo: 'nota' })
    await apuntarPlantilla({ id: 1, nombre: 'Café', kcal: 5, proteina: 0, tipo: 'bebida', usos: 0 }, 'N', HOY)
    const comidas = await db.comidas.toArray()
    const bocadillo = comidas.find(c => c.nombre === 'Bocadillo')
    // Con las de siempre, a las 12 sería «comida»; con estas, sigue siendo el desayuno.
    expect(bocadillo!.franja).toBe('desayuno')
    const cafe = comidas.find(c => c.nombre === 'Café')
    expect(cafe!.franja).toBe(franjaPorHora(cafe!.hora, h))
  })
})

describe('trote → pasos', () => {
  it('los pasos por km se pueden cambiar (1.300 si no)', () => {
    expect(ajustesPorDefecto().pasosPorKm).toBe(1300)
    expect(pasosEquivalentes(3, 'km')).toBe(3900)
    expect(pasosEquivalentes(3, 'km', 1400)).toBe(4200)
    // Los minutos no dependen de la zancada.
    expect(pasosEquivalentes(20, 'min', 1400)).toBe(3200)
    expect(kmDeTrote(4200, 1400)).toBe(3)
    expect(kmDeTrote(3200)).toBe(2.5)
  })
  it('las kcal del trote salen igual con otros pasos por km si los km son los mismos', () => {
    expect(kcalPasos(3900, 80, 178, 3)).toBe(kcalPasos(4200, 80, 178, 3, 1400))
  })
  it('correr cuenta como pasos aproximados; caminar o bici, no', () => {
    expect(pasosDeCardio('correr', 20)).toBe(3200)
    expect(pasosDeCardio('caminar', 20)).toBe(0)
    expect(pasosDeCardio('bici', 45)).toBe(0)
  })
  it('apuntar «Correr» suma sus pasos y sus km al día; deshacer lo deja como estaba', async () => {
    await guardarAjustes({ pasosPorKm: 1600 })
    await db.pasos.put({ fecha: HOY, pasos: 5000, fuente: 'manual' })
    const deshacer = await apuntarCardio(HOY, 'correr', 20)
    expect(await db.pasos.get(HOY)).toMatchObject({ pasos: 8200, troteKm: 2, cardio: [{ tipo: 'correr', min: 20 }] })
    await apuntarCardio(HOY, 'bici', 30)
    expect((await db.pasos.get(HOY))!.pasos).toBe(8200)
    // Los pasos de Health Connect que llegan después mantienen el trote (con los pasos por km de Ajustes).
    await guardarPasosAuto({ [HOY]: 6000 })
    expect((await db.pasos.get(HOY))!.pasos).toBe(6000 + 2 * 1600)
    deshacer()
    await new Promise(r => setTimeout(r, 30))
    expect(await db.pasos.get(HOY)).toEqual({ fecha: HOY, pasos: 5000, fuente: 'manual' })
  })
  it('con el móvil o el reloj encima (sumarPasos = false), correr apunta los minutos pero no suma pasos otra vez', async () => {
    await db.pasos.put({ fecha: HOY, pasos: 7000, fuente: 'auto' })
    await apuntarCardio(HOY, 'correr', 20, false)
    const dia = (await db.pasos.get(HOY))!
    expect(dia).toMatchObject({ pasos: 7000, fuente: 'auto', cardio: [{ tipo: 'correr', min: 20 }] })
    expect(dia.troteKm).toBeUndefined()
    await guardarPasosAuto({ [HOY]: 7200 })
    expect((await db.pasos.get(HOY))!.pasos).toBe(7200)
  })
  it('correr un día sin pasos crea el día con los del trote', async () => {
    await apuntarCardio(HOY, 'correr', 10)
    expect(await db.pasos.get(HOY)).toMatchObject({ pasos: 1600, troteKm: 1.2, fuente: 'manual' })
  })
})

describe('metas de repeticiones', () => {
  const serie = (reps: number | null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso: null, reps, rpe: null, calentamiento: false, hecha: true, ...x })
  const sesion = (id: number, fecha: string, ej: string, series: Serie[]): Sesion => ({
    id, fecha, rutinaId: null, letra: 'A', nombre: 'A', gimnasioId: null, inicio: id, version: 'normal', estado: 'hecha', calibracion: false,
    ejercicios: [{ uid: 'b', ejercicio: ej, planificado: ej, estado: 'hecho', series, repsMin: 5, repsMax: 10, rpe: 8, descanso: 90, registro: 'corporal' }],
  })
  const sesiones = [
    sesion(1, '2026-10-20', 'pull-up', [serie(4), serie(6), serie(12, { calentamiento: true })]),
    sesion(2, '2026-10-27', 'pull-up', [serie(7), serie(9, { hecha: false })]),
    sesion(3, '2026-10-29', 'push-up', [serie(20)]),
  ]
  it('lo actual es la serie con más repeticiones seguidas (sin calentamiento ni sin hacer)', () => {
    expect(actualEjercicio(sesiones, 'pull-up', 'reps')).toBe(7)
    expect(actualEjercicio(sesiones, 'push-up', 'reps')).toBe(20)
    expect(actualEjercicio(sesiones, 'squat', 'reps')).toBeNull()
    // La de kilos sigue igual: sin peso no hay valor.
    expect(actualEjercicio(sesiones, 'pull-up', 'kg')).toBeNull()
  })
  it('solo los ejercicios que cuentan repeticiones valen para la meta: ni el cardio (minutos) ni la plancha (segundos)', () => {
    const base = { id: 'x', categoria: 'strength', fuerza: 'pull', material: 'pull_up_bar', etiquetas: [], pesoCorporal: true } as unknown as Ejercicio
    expect(cuentaRepeticiones({ ...base, id: 'pull-up' })).toBe(true)
    expect(cuentaRepeticiones({ ...base, id: 'bench-press', material: 'barbell', pesoCorporal: false })).toBe(true)
    expect(cuentaRepeticiones({ ...base, id: 'treadmill', categoria: 'cardio', material: 'treadmill' })).toBe(false)
    expect(cuentaRepeticiones({ ...base, id: 'plank', fuerza: 'static', material: null })).toBe(false)
    const propio = (registro: string) => ({ ...base, id: 'mio-1', propio: { registro, material: 'otro' } }) as unknown as Ejercicio
    expect(cuentaRepeticiones(propio('corporal'))).toBe(true)
    expect(cuentaRepeticiones(propio('cardio'))).toBe(false)
    expect(cuentaRepeticiones(propio('tiempo'))).toBe(false)
  })
  it('se lee al crear la meta y sale en el informe con su progreso', async () => {
    await db.sesiones.bulkPut(sesiones as (Sesion & { id: number })[])
    expect(await valorActualMeta('reps', 'pull-up', perfilPorDefecto())).toBe(7)
    const meta: Meta = { id: 1, tipo: 'reps', titulo: '10 dominadas', objetivo: 10, unidad: 'reps', ejercicio: 'pull-up', inicio: 4 }
    const ctx = { metas: [meta], hechas: sesiones, ms: [], fin: HOY, marina: [], cat: { nombre: () => 'Dominada' } } as unknown as Ctx
    const [m] = metasInforme(ctx)
    expect(m).toMatchObject({ tipo: 'reps', actual: 7, falta: 3, conseguida: false })
    expect(m!.progreso).toBeCloseTo(0.5)
  })
})

describe('la copia de seguridad', () => {
  const perfil = { ...perfilPorDefecto(), altaCompleta: true }
  it('pide la versión 6 con una meta de repeticiones o con historial de ajustes', () => {
    expect(versionNecesaria({ perfil: [{ objetivo: 'fuerza' }], metas: [{ tipo: 'reps' }] })).toBe(6)
    expect(versionNecesaria({ perfil: [{ objetivo: 'fuerza' }], ajustes: [{ historialEnergia: [{}] }] })).toBe(6)
    // Sin historial (lista vacía) ni metas nuevas, la de antes.
    expect(versionNecesaria({ perfil: [{ objetivo: 'fuerza' }], ajustes: [{ historialEnergia: [] }], metas: [{ tipo: 'peso' }] })).toBe(1)
  })
  it('acepta los ajustes nuevos y rechaza un ajuste con datos que no son de JowyFit', async () => {
    const ajustes = {
      ...ajustesPorDefecto(), ayudaEsfuerzo: false, pasosPorKm: 1450, franjasHoras: { desayuno: '7:00', comida: '14:00', merienda: '17:00', cena: '20:30' },
      historialEnergia: [{ fecha: '2026-11-01', antes: null, despues: { kcal: 2200, proteina: 140, peso: null }, porque: 'inicio', otro: 'se quita' }],
    }
    const r = validarDatos({ perfil: [perfil], ajustes: [ajustes] })
    expect(r.tablas.ajustes[0]).toMatchObject({ ayudaEsfuerzo: false, pasosPorKm: 1450, franjasHoras: ajustes.franjasHoras })
    expect(r.tablas.ajustes[0]!.historialEnergia).toEqual([{ fecha: '2026-11-01', antes: null, despues: { kcal: 2200, proteina: 140, peso: null }, porque: 'inicio' }])
    const malo = (h: unknown) => () => validarDatos({ perfil: [perfil], ajustes: [{ ...ajustes, historialEnergia: [h] }] })
    expect(malo({ fecha: '2026-11-01', antes: null, despues: { kcal: 2200, proteina: 140, peso: null }, porque: 'magia' })).toThrow()
    expect(malo({ fecha: '2026-11-01', antes: null, despues: { kcal: '2200', proteina: 140, peso: null }, porque: 'inicio' })).toThrow()
    expect(() => validarDatos({ perfil: [perfil], ajustes: [{ ...ajustes, pasosPorKm: 99_999 }] })).toThrow()
    expect(() => validarDatos({ perfil: [perfil], ajustes: [{ ...ajustes, franjasHoras: { desayuno: '25:00', comida: '14:00', merienda: '17:00', cena: '20:00' } }] })).toThrow()
  })
  it('cada consejo de la quincena pasa en el historial de una copia (la lista sale de TIPOS_CONSEJO)', () => {
    for (const porque of ['inicio', ...TIPOS_CONSEJO]) {
      const h = { fecha: '2026-11-01', antes: null, despues: { kcal: 2200, proteina: 140, peso: 80 }, porque }
      const r = validarDatos({ perfil: [perfil], ajustes: [{ ...ajustesPorDefecto(), historialEnergia: [h] }] })
      expect(r.tablas.ajustes[0]!.historialEnergia, porque).toEqual([h])
    }
  })
  it('acepta las metas de repeticiones', () => {
    const r = validarDatos({ perfil: [perfil], metas: [{ id: 1, tipo: 'reps', titulo: '10 dominadas', objetivo: 10, unidad: 'reps', ejercicio: 'pull-up' }] })
    expect(r.tablas.metas[0]).toMatchObject({ tipo: 'reps', ejercicio: 'pull-up' })
  })
  it('los ajustes por defecto ya traen las franjas, la ayuda del esfuerzo y el historial vacío', async () => {
    expect(await leerAjustes()).toMatchObject({ ayudaEsfuerzo: true, franjasHoras: FRANJAS_HORAS, historialEnergia: [], pasosPorKm: 1300 })
  })
})


it('el formato 6 prevalece sobre los datos de formatos 4 y 5', () => {
  expect(versionNecesaria({ ajustes: [{ historialEnergia: [{}], molestiasVistas: [] }], sesiones: [{ ejercicios: [{ molestia: true, series: [{ izq: 8, der: 8 }] }] }] })).toBe(6)
})
