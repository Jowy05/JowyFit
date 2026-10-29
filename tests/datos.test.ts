// Datos locales (IndexedDB simulada con fake-indexeddb): valores por defecto, perfil y ajustes,
// marcas de ejercicio, gimnasio activo, consultas que combinan tablas y sugerencias de peso.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseJowyFit, TABLAS, db } from '../src/datos/db'
import {
  ajustesPorDefecto, gimnasioActivo, gimnasioNuevo, guardarAjustes, guardarPerfil, leerAjustes, leerPerfil, marcaDe, marcar, perfilPorDefecto,
  pedirPersistencia, plantillasIniciales, prepararBase,
} from '../src/datos/repos'
import { comidasDe, gastoDelDia, grasaReciente, historialDe, objetivosEnergia, pesoActual, sesionDeHoy, sesionesHechas, sugerenciaPara, ultimaMedicion, ultimasSeries } from '../src/datos/consultas'
import { totalesComida } from '../src/dominio/comida'
import { bloqueObjetivo, historialEn } from '../src/dominio/progresion'
import { edad, hoyISO, sumarDias } from '../src/dominio/fechas'
import { objetivos } from '../src/dominio/calculos'
import type { Comida, EjercicioSesion, Serie, Sesion } from '../src/datos/tipos'

async function vaciar() { for (const t of TABLAS) await db.table(t).clear() }
beforeEach(vaciar)
afterEach(() => { vi.unstubAllGlobals() })

const serie = (peso: number | null, reps: number | null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe: null, calentamiento: false, hecha: true, ...x })
const ej = (id: string, series: Serie[], x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({ uid: id, ejercicio: id, planificado: id, estado: 'hecho', series, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const sesion = (fecha: string, inicio: number, ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion => ({ fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio, version: 'normal', estado: 'hecha', calibracion: false, ejercicios, ...x })
const comida = (fecha: string, x: Partial<Comida> = {}): Comida => ({ fecha, hora: '14:00', franja: 'comida', nombre: 'x', kcal: 500, proteina: 30, racion: 'N', tipo: 'nota', ...x })

describe('la base', () => {
  it('tiene las 14 tablas de TABLAS (y una base con otro nombre es independiente)', async () => {
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLAS].sort())
    const otra = new BaseJowyFit('jowyfit-prueba')
    await otra.perfil.put(perfilPorDefecto())
    expect(await otra.perfil.count()).toBe(1)
    expect(await db.perfil.count()).toBe(0)
    otra.close()
  })
  it('pedir que no se borren los datos: sin soporte, con soporte y si falla', async () => {
    vi.stubGlobal('navigator', {})
    expect(await pedirPersistencia()).toBe(false)
    vi.stubGlobal('navigator', { storage: { persist: async () => true } })
    expect(await pedirPersistencia()).toBe(true)
    vi.stubGlobal('navigator', { storage: { persist: async () => { throw new Error('no') } } })
    expect(await pedirPersistencia()).toBe(false)
  })
})

describe('valores por defecto', () => {
  it('perfil sin alta completa, con los días de Jowy y 8000 pasos', () => {
    const p = perfilPorDefecto()
    expect(p).toMatchObject({ id: 'yo', altaCompleta: false, diasFijos: [1, 3, 4], diasOpcionales: [5], pasosObjetivo: 8000, horaEntreno: '05:30' })
    expect(Number.isNaN(Date.parse(p.creado))).toBe(false)
  })
  it('ajustes: descansos, cafeína y recordatorios', () => {
    const a = ajustesPorDefecto()
    expect(a).toMatchObject({ id: 'app', gimnasioActivo: null, descansoCompuesto: 150, descansoAislamiento: 90, cafeinaLimite: 400, fuentePasos: 'manual', copiaAuto: true })
    expect(a.noti.copia).toBe(true)
    expect(a.recolocadas).toEqual([])
  })
  it('gimnasio nuevo con material básico, mancuernas y discos', () => {
    const g = gimnasioNuevo('Basic-Fit')
    expect(g.nombre).toBe('Basic-Fit')
    expect(g.material).toContain('dumbbell')
    expect(g.barraKg).toBe(20)
    expect(gimnasioNuevo().nombre).toBe('Mi gimnasio')
  })
  it('plantillas iniciales: picoteo, bebidas con cafeína y el batido', () => {
    const ps = plantillasIniciales()
    expect(ps).toHaveLength(8)
    expect(ps.filter(p => p.tipo === 'picoteo')).toHaveLength(3)
    expect(ps.find(p => p.nombre === 'Café')!.cafeina).toBe(80)
    expect(ps.every(p => p.usos === 0)).toBe(true)
  })
})

describe('perfil y ajustes guardados', () => {
  it('leerPerfil sin nada guardado: undefined; guardarPerfil parte de los valores por defecto', async () => {
    expect(await leerPerfil()).toBeUndefined()
    const p = await guardarPerfil({ nombre: 'Jowy', alturaCm: 177 })
    expect(p).toMatchObject({ id: 'yo', nombre: 'Jowy', alturaCm: 177, diasFijos: [1, 3, 4] })
    const p2 = await guardarPerfil({ alturaCm: 178, id: 'otro' as never })
    expect(p2).toMatchObject({ id: 'yo', nombre: 'Jowy', alturaCm: 178 })
    expect(await db.perfil.count()).toBe(1)
  })
  it('leerAjustes crea los de por defecto la primera vez', async () => {
    expect(await db.ajustes.count()).toBe(0)
    const a = await leerAjustes()
    expect(a).toEqual(ajustesPorDefecto())
    expect(await db.ajustes.count()).toBe(1)
  })
  it('ajustes viejos sin campos nuevos ni recordatorios nuevos: se completan con los de por defecto', async () => {
    const { noti: _, semanaSuave: __, ...viejos } = ajustesPorDefecto()
    await db.ajustes.put({ ...viejos, noti: { dormir: false } as never, vibrar: false } as never)
    const a = await leerAjustes()
    expect(a.vibrar).toBe(false)
    expect(a.noti.dormir).toBe(false)
    expect(a.noti.copia).toBe(true)
    expect(a.semanaSuave).toBeNull()
    expect(a.recolocadas).toEqual([])
  })
  it('guardarAjustes mezcla y no cambia el id', async () => {
    await guardarAjustes({ kcalManual: 2200 })
    const a = await guardarAjustes({ proteinaManual: 150, id: 'x' as never })
    expect(a).toMatchObject({ id: 'app', kcalManual: 2200, proteinaManual: 150 })
  })
  it('marcas de ejercicio: vacía si no hay, y se mezclan los cambios', async () => {
    expect(await marcaDe('bench-press')).toEqual({ id: 'bench-press' })
    await marcar('bench-press', { favorito: true })
    await marcar('bench-press', { ajustes: 'Banco 3' })
    expect(await marcaDe('bench-press')).toEqual({ id: 'bench-press', favorito: true, ajustes: 'Banco 3' })
    await marcar('bench-press', { favorito: false })
    expect((await marcaDe('bench-press')).favorito).toBe(false)
  })
  it('fallaba: dos cambios a la vez se pisaban (se perdía uno); ahora se guardan los dos', async () => {
    await Promise.all([marcar('x', { favorito: true }), marcar('x', { notas: 'n' }), marcar('x', { duele: true })])
    expect(await marcaDe('x')).toEqual({ id: 'x', favorito: true, notas: 'n', duele: true })
    await Promise.all([guardarAjustes({ kcalManual: 2100 }), guardarAjustes({ proteinaManual: 140 }), guardarAjustes({ vibrar: false })])
    expect(await leerAjustes()).toMatchObject({ kcalManual: 2100, proteinaManual: 140, vibrar: false })
    await Promise.all([guardarPerfil({ nombre: 'Jowy' }), guardarPerfil({ alturaCm: 177 })])
    expect(await leerPerfil()).toMatchObject({ nombre: 'Jowy', alturaCm: 177 })
  })
  it('prepararBase: ajustes y plantillas la primera vez, y no duplica al repetirse', async () => {
    await prepararBase()
    await prepararBase()
    expect(await db.plantillas.count()).toBe(8)
    expect(await db.ajustes.count()).toBe(1)
    // Si el usuario ya tiene sus plantillas (aunque haya borrado las iniciales), no se tocan.
    await db.plantillas.clear()
    await db.plantillas.add({ nombre: 'Mía', kcal: 1, proteina: 1, tipo: 'comida', usos: 0 })
    await prepararBase()
    expect(await db.plantillas.count()).toBe(1)
  })
  it('gimnasio activo: el elegido, si no existe el primero, y sin gimnasios nada', async () => {
    expect(await gimnasioActivo()).toBeUndefined()
    const a = await db.gimnasios.add(gimnasioNuevo('A'))
    const b = await db.gimnasios.add(gimnasioNuevo('B'))
    expect((await gimnasioActivo())!.nombre).toBe('A')
    await guardarAjustes({ gimnasioActivo: b })
    expect((await gimnasioActivo())!.nombre).toBe('B')
    await db.gimnasios.delete(b)
    expect((await gimnasioActivo())!.id).toBe(a)
  })
})

describe('historial y sugerencias', () => {
  it('sesionesHechas: solo hechas, de la más reciente a la más antigua', async () => {
    await db.sesiones.bulkAdd([sesion('2026-10-13', 1, []), sesion('2026-10-15', 3, []), sesion('2026-10-14', 2, [], { estado: 'cancelada' }), sesion('2026-10-16', 4, [], { estado: 'curso' })])
    expect((await sesionesHechas()).map(s => s.inicio)).toEqual([3, 1])
  })
  it('historial: sin calentamientos sueltos, excluyendo una sesión y solo con series hechas', async () => {
    const ss = [
      { ...sesion('2026-10-15', 3, [ej('press', [serie(50, 10), serie(50, 8, { hecha: false })])]), id: 3 },
      { ...sesion('2026-10-14', 2, [ej('press', [serie(20, 10, { calentamiento: true })])]), id: 2 },
      { ...sesion('2026-10-13', 1, [ej('press', [serie(45, 10)]), ej('remo', [serie(40, 10)])]), id: 1 },
    ]
    const h = historialEn(ss, 'press')
    expect(h.map(x => x.sesionId)).toEqual([3, 1])
    expect(h[0]!.series).toHaveLength(1)
    expect(historialEn(ss, 'press', 3).map(x => x.sesionId)).toEqual([1])
    expect(historialEn(ss, 'nada')).toEqual([])
    await db.sesiones.bulkPut(ss)
    expect((await historialDe('remo')).map(x => x.fecha)).toEqual(['2026-10-13'])
    expect(await ultimasSeries('press')).toEqual([serie(50, 10)])
    expect(await ultimasSeries('nada')).toBeNull()
  })
  it('bloqueObjetivo copia solo el objetivo', () => {
    expect(bloqueObjetivo({ repsMin: 6, repsMax: 10, rpe: 8, uid: 'x' } as never)).toEqual({ repsMin: 6, repsMax: 10, rpe: 8 })
  })
  const obj = { repsMin: 8, repsMax: 12, rpe: 8 }
  // Sin catálogo cargado el ejercicio se trata como de máquina: pesos de 2,5 en 2,5.
  it('primera vez sin historial ni referencia: peso de partida', async () => {
    const s = await sugerenciaPara('maquina-x', obj)
    expect(s).toMatchObject({ accion: 'primera', peso: 10, partida: true })
  })
  it('primera vez con peso de referencia en el perfil (press de banca)', async () => {
    await guardarPerfil({ referencias: { banca: '60 kg × 8' } })
    const s = await sugerenciaPara('bench-press', obj)
    expect(s.accion).toBe('primera')
    expect(s.partida).toBeUndefined()
    expect(s.peso).toBeGreaterThan(30)
    expect(s.texto).toContain('60 kg × 8')
    // Pasando las referencias a mano no lee el perfil.
    expect((await sugerenciaPara('bench-press', obj, null, undefined, [], {})).partida).toBe(true)
  })
  it('las semanas suaves no cuentan: se parte del peso de antes de la descarga', async () => {
    await db.sesiones.bulkAdd([
      sesion('2026-10-06', 1, [ej('press', [serie(50, 12), serie(50, 12)])]),
      sesion('2026-10-13', 2, [ej('press', [serie(45, 8)])], { suave: true }),
    ])
    const s = await sugerenciaPara('press', obj)
    expect(s.accion).toBe('subir')
    expect(s.ultima?.peso).toBe(50)
  })
  it('3 sesiones sin mejorar: baja un 10 % (la semana de prueba no cuenta para estancarse)', async () => {
    const h = (fecha: string, i: number, calibracion = false) => sesion(fecha, i, [ej('press', [serie(50, 9), serie(50, 9)])], { calibracion })
    await db.sesiones.bulkAdd([h('2026-09-29', 1), h('2026-10-06', 2), h('2026-10-08', 3), h('2026-10-13', 4)])
    const s = await sugerenciaPara('press', obj)
    expect(s).toMatchObject({ accion: 'bajar', peso: 45, reps: 8 })
    expect(s.texto).toMatch(/^Llevas 3 sesiones sin mejorar: baja a 45 kg/)
    await vaciar()
    await db.sesiones.bulkAdd([h('2026-09-29', 1, true), h('2026-10-06', 2, true), h('2026-10-08', 3), h('2026-10-13', 4)])
    expect((await sugerenciaPara('press', obj)).accion).toBe('mantener')
  })
})

describe('comida, medidas y energía', () => {
  it('totales del día (cafeína que falta cuenta 0) y comidas del día en orden de hora', async () => {
    expect(totalesComida([])).toEqual({ kcal: 0, proteina: 0, cafeina: 0 })
    expect(totalesComida([comida('d', { kcal: 100, proteina: 5, cafeina: 80 }), comida('d', { kcal: 50, proteina: 1 })])).toEqual({ kcal: 150, proteina: 6, cafeina: 80 })
    await db.comidas.bulkAdd([comida('2026-10-13', { hora: '21:00', nombre: 'cena' }), comida('2026-10-13', { hora: '08:00', nombre: 'desayuno' }), comida('2026-10-14', { nombre: 'otro día' })])
    expect((await comidasDe('2026-10-13')).map(c => c.nombre)).toEqual(['desayuno', 'cena'])
    expect(await comidasDe('2026-01-01')).toEqual([])
  })
  it('última medición de cada cosa y peso actual', async () => {
    expect(await pesoActual()).toBeNull()
    await db.mediciones.bulkAdd([
      { fecha: '2026-10-01T07:00', origen: 'casa', pesoKg: 80, perimetros: { cuello: 38 } },
      { fecha: '2026-10-10T07:00', origen: 'cinta', perimetros: { cintura: 98 } },
      { fecha: '2026-10-12T07:00', origen: 'casa', pesoKg: 79.1, bascula: { grasaPct: 24.2 } },
      { fecha: '2026-10-13T07:00', origen: 'casa', bascula: {} },
    ])
    expect(await pesoActual()).toBe(79.1)
    expect((await ultimaMedicion('cintura'))!.fecha).toBe('2026-10-10T07:00')
    expect((await ultimaMedicion('cuello'))!.perimetros!.cuello).toBe(38)
    expect((await ultimaMedicion('bascula'))!.fecha).toBe('2026-10-12T07:00') // la de báscula vacía no cuenta
    expect(await ultimaMedicion('cadera')).toBeUndefined()
  })
  it('% de grasa: el de la báscula si es de los últimos 4 meses; si no, el de la cinta', async () => {
    const p = perfilPorDefecto()
    expect(await grasaReciente(p)).toBeNull()
    const hace = (dias: number) => `${sumarDias(hoyISO(), -dias)}T07:00`
    await db.mediciones.bulkAdd([
      { fecha: hace(200), origen: 'casa', bascula: { grasaPct: 30 } },
      { fecha: hace(10), origen: 'cinta', perimetros: { cintura: 95, cuello: 38 } },
    ])
    const cinta = await grasaReciente({ ...p, alturaCm: 177 })
    expect(cinta).toBeGreaterThan(10)
    expect(cinta).not.toBe(30)
    await db.mediciones.add({ fecha: hace(5), origen: 'casa', bascula: { grasaPct: 22.5 } })
    expect(await grasaReciente(p)).toBe(22.5)
  })
  it('gasto del día: null sin peso o sin altura; con pasos, trote y el entreno de ese día', async () => {
    const p = { ...perfilPorDefecto(), alturaCm: 177, nacimiento: '2005-03-23' }
    expect(await gastoDelDia(p, '2026-10-13')).toBeNull()
    await db.mediciones.add({ fecha: '2026-10-13T07:00', origen: 'casa', pesoKg: 79.1, bascula: { grasaPct: 24.2 } })
    expect(await gastoDelDia({ ...p, alturaCm: 0 }, '2026-10-13')).toBeNull()
    const vacio = (await gastoDelDia(p, '2026-10-13'))!
    expect(vacio).toMatchObject({ peso: 79.1, pasos: 0, hayEntreno: false, entreno: { hecho: 0, plan: 0, saltado: 0 } })
    await db.pasos.put({ fecha: '2026-10-13', pasos: 10000, fuente: 'manual', troteKm: 3 })
    await db.sesiones.bulkAdd([
      sesion('2026-10-13', 1, [ej('press', [serie(50, 10), serie(50, 10, { hecha: false })])]),
      sesion('2026-10-13', 2, [ej('remo', [serie(50, 10)])], { estado: 'cancelada' }),
    ])
    const g = (await gastoDelDia(p, '2026-10-13'))!
    expect(g.pasos).toBeGreaterThan(300)
    expect(g.hayEntreno).toBe(true)
    expect(g.entreno.hecho).toBeGreaterThan(0)
    expect(g.entreno.plan).toBeGreaterThan(g.entreno.hecho)
    // El reposo sale de la báscula si es reciente; si no, de Mifflin.
    expect(['katch', 'mifflin']).toContain(g.formula)
  })
  it('objetivo de energía: automático o el que puso el usuario; sin peso usa 75 kg', async () => {
    const p = { ...perfilPorDefecto(), alturaCm: 177 }
    const auto = await objetivosEnergia(p)
    expect(auto.peso).toBeNull()
    expect(auto.kcal).toBe(objetivos({ pesoKg: 75, alturaCm: 177, edad: edad(p.nacimiento), sexo: p.sexo, trabajo: p.trabajo, objetivo: p.objetivo, entrenosSemana: 3, pasos: p.pasosObjetivo }).kcal)
    expect(auto).toMatchObject({ recomendado: auto.kcal, manual: false })
    await guardarAjustes({ kcalManual: 2300, proteinaManual: 160 })
    await db.mediciones.add({ fecha: '2026-10-13T07:00', origen: 'casa', pesoKg: 80 })
    const manual = await objetivosEnergia(p)
    expect(manual).toMatchObject({ kcal: 2300, proteina: 160, peso: 80, manual: true })
    await guardarAjustes({ kcalManual: null, proteinaManual: null })
    expect((await objetivosEnergia(p)).proteina).toBe(145) // 80 × 1,8 → 144 → 145
  })
  it('sesión de hoy: solo la hecha de hoy', async () => {
    expect(await sesionDeHoy()).toBeUndefined()
    await db.sesiones.bulkAdd([sesion(hoyISO(), 1, [], { estado: 'curso' }), sesion(sumarDias(hoyISO(), -1), 2, [])])
    expect(await sesionDeHoy()).toBeUndefined()
    await db.sesiones.add(sesion(hoyISO(), 3, []))
    expect((await sesionDeHoy())!.inicio).toBe(3)
  })
})
