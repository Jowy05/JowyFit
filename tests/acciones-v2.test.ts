// Escrituras del generador v2 (IndexedDB simulada): la revisión semanal con su «Deshacer», la subida poco a poco de
// pasos y cardio, el cardio apuntado, el alta con una urgencia, la sesión mínima y la víspera de su deporte.
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo } from './ayuda'
import { TABLAS, db } from '../src/datos/db'
import { gimnasioNuevo, guardarPerfil, leerPerfil, perfilPorDefecto, rutinaActiva } from '../src/datos/repos'
import { completarAlta } from '../src/datos/acciones/alta'
import { apuntarCardio, guardarPasosAuto, subirMovimiento } from '../src/datos/acciones/cuerpo'
import { activarRutina } from '../src/datos/acciones/rutina'
import { deshacerCambio, guardarRevision } from '../src/datos/acciones/revision'
import { iniciarEntreno } from '../src/datos/acciones/entreno'
import { diaSemana, deISO, hoyISO, sumarDias } from '../src/dominio/fechas'
import { CARGA_SUAVE } from '../src/dominio/revision'
import type { Bloque, Dolor, Rutina } from '../src/datos/tipos'

beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })

const HOY = hoyISO()
const bloque = (uid: string, ejercicio: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const rutina = (bloques: Bloque[]): Omit<Rutina, 'id'> => ({
  creada: '2026-10-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null,
  dias: [{ letra: 'A', nombre: 'Cuerpo completo A', dia: null, opcional: false, bloques }],
})
const rodilla = (x: Partial<Dolor> = {}): Dolor => ({ zona: 'rodillas', cuanto: 'poco', cuando: 'aveces', desde: 'dias', inicio: HOY, ...x })

describe('alta', () => {
  it('con una señal de «Antes de entrenar» se guarda todo menos la rutina', async () => {
    const { rutina: r } = await completarAlta({
      gimnasio: { ...gimnasioNuevo('Mi gimnasio'), creado: '2026-10-22T10:00:00.000Z' },
      perfil: { ...perfilPorDefecto(), nacimiento: '1990-05-01', alturaCm: 178, diasFijos: [1, 3, 5], urgencias: ['mareo'] },
      medicion: { fecha: `${HOY}T07:00`, origen: 'manual', pesoKg: 80 }, medicionCambiada: true, hoy: HOY,
    })
    expect(r).toBeNull()
    expect(await db.rutinas.count()).toBe(0)
    expect((await leerPerfil())!.urgencias).toEqual(['mareo'])
  })
})

describe('pasos y cardio', () => {
  it('cardio apuntado: se suma al día sin tocar los pasos; deshacer lo deja como estaba', async () => {
    await guardarPasosAuto({ [HOY]: 6000 })
    const deshacer = await apuntarCardio(HOY, 'bici', 20.4)
    await apuntarCardio(HOY, 'caminar', 15)
    expect(await db.pasos.get(HOY)).toMatchObject({ pasos: 6000, cardio: [{ tipo: 'bici', min: 20 }, { tipo: 'caminar', min: 15 }] })
    // Los pasos de Health Connect que llegan después no borran el cardio.
    await guardarPasosAuto({ [HOY]: 7000 })
    expect((await db.pasos.get(HOY))!.cardio).toHaveLength(2)
    deshacer()
    await new Promise(r => setTimeout(r, 30))
    expect((await db.pasos.get(HOY))!.pasos).toBe(6000)
  })
  it('cada 2 semanas desde que se fijó la meta: +1.000 pasos y +15 min; antes, nada', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), nacimiento: '1990-01-01', pasosObjetivo: 6000, cardioMin: 60, progresoMovimiento: '2026-10-05' })
    await subirMovimiento('2026-10-18')
    expect(await leerPerfil()).toMatchObject({ pasosObjetivo: 6000, cardioMin: 60, progresoMovimiento: '2026-10-05' })
    await subirMovimiento('2026-10-19')
    expect(await leerPerfil()).toMatchObject({ pasosObjetivo: 7000, cardioMin: 75, progresoMovimiento: '2026-10-19' })
    // Abrir la app otra vez el mismo día no vuelve a subir.
    await subirMovimiento('2026-10-19')
    expect((await leerPerfil())!.pasosObjetivo).toBe(7000)
  })
  it('sin meta tocada en Perfil no sube nada', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), pasosObjetivo: 6000 })
    await subirMovimiento('2027-01-01')
    expect((await leerPerfil())!.pasosObjetivo).toBe(6000)
  })
})

describe.skipIf(!hayCatalogo)('revisión semanal', () => {
  if (hayCatalogo) catalogoReal()
  const base = () => rutina([bloque('b1', 'leg-press'), bloque('b2', 'leg-extension'), bloque('b3', 'bench-press')])

  it('una molestia que va peor suaviza lo que carga la rodilla, sube la molestia y se guarda; deshacer lo devuelve', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), dolores: [rodilla()] })
    await activarRutina(base())
    const rev = await guardarRevision({ estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'peor' }], zonasAntes: ['rodillas'] })
    expect(rev.cambios.map(c => c.uid).sort()).toEqual(['b1', 'b2'])
    expect((await leerPerfil())!.dolores).toEqual([rodilla({ cuanto: 'regular' })])
    const r = (await rutinaActiva())!
    expect(r.dias[0]!.bloques.find(b => b.uid === 'b3')).toEqual(base().dias[0]!.bloques[2])
    expect(r.dias[0]!.bloques.find(b => b.uid === 'b1')!.cargaPct).toBe(CARGA_SUAVE)
    expect(await db.revisiones.count()).toBe(1)

    await deshacerCambio(rev.id, 'b1')
    expect((await rutinaActiva())!.dias[0]!.bloques.find(b => b.uid === 'b1')).toEqual(base().dias[0]!.bloques[0])
    expect((await db.revisiones.get(rev.id))!.cambios.find(c => c.uid === 'b1')!.deshecho).toBe(true)
    // Deshacer dos veces no hace nada más.
    await deshacerCambio(rev.id, 'b1')
    expect((await rutinaActiva())!.dias[0]!.bloques.find(b => b.uid === 'b1')).toEqual(base().dias[0]!.bloques[0])
  })
  it('deshacer un cambio que otra revisión volvió a tocar no lo marca como deshecho', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), dolores: [rodilla()] })
    await activarRutina(rutina([bloque('b2', 'leg-extension')]))
    const una = await guardarRevision({ estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'peor' }], zonasAntes: ['rodillas'] })
    await guardarRevision({ estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'peor' }], zonasAntes: ['rodillas'] })
    expect(await deshacerCambio(una.id, 'b2')).toBe(false)
    expect((await db.revisiones.get(una.id))!.cambios[0]!.deshecho).toBeUndefined()
  })
  it('«Ya no me duele» quita la molestia y devuelve todo; una molestia nueva también suaviza', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), dolores: [rodilla()] })
    await activarRutina(base())
    await guardarRevision({ estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'peor' }], zonasAntes: ['rodillas'] })
    await guardarRevision({ estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'ya' }], zonasAntes: ['rodillas'] })
    expect((await leerPerfil())!.dolores).toEqual([])
    expect((await rutinaActiva())!.dias).toEqual(base().dias)
    // La molestia nueva se guarda al tocarla en la cuadrícula; la revisión la ve como nueva.
    await guardarPerfil({ dolores: [rodilla()] })
    const nueva = await guardarRevision({ estado: 'molestia', respuestas: [], zonasAntes: [] })
    expect(nueva.cambios.length).toBeGreaterThan(0)
  })
  it('sin rutina se guarda igual, sin cambios', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), dolores: [rodilla()] })
    const rev = await guardarRevision({ estado: 'bien', respuestas: [], zonasAntes: ['rodillas'] })
    expect(rev.cambios).toEqual([])
    expect(await db.revisiones.count()).toBe(1)
  })
})

describe.skipIf(!hayCatalogo)('peso con una molestia', () => {
  if (hayCatalogo) catalogoReal()
  it('el peso rebajado no se rebaja otra vez: se parte del último entreno sin rebaja', async () => {
    await db.perfil.put(perfilPorDefecto())
    await activarRutina(rutina([bloque('b1', 'leg-press', { cargaPct: 0.8, repsMin: 10, repsMax: 12 })]))
    const hecha = (fecha: string, peso: number, cargaPct?: number) => ({
      fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: Date.parse(`${fecha}T10:00:00`), version: 'normal' as const, estado: 'hecha' as const, calibracion: false,
      ejercicios: [{ uid: 'b1', ejercicio: 'leg-press', planificado: 'leg-press', estado: 'hecho' as const, repsMin: 10, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso' as const, ...(cargaPct ? { cargaPct } : {}),
        series: [1, 2].map(n => ({ n, peso, reps: 10, rpe: 8, calentamiento: false, hecha: true })) }],
    })
    await db.sesiones.bulkAdd([hecha('2026-10-01', 100), hecha('2026-10-05', 80, 0.8), hecha('2026-10-08', 80, 0.8)])
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A' })))!
    // Desde los 100 kg sin rebaja, al 80 %: 80 kg (no 64 ni menos).
    expect(s.ejercicios[0]!.series[0]!.peso).toBe(80)
    expect(s.ejercicios[0]!.cargaPct).toBe(0.8)
  })
})

describe.skipIf(!hayCatalogo)('empezar el entreno', () => {
  if (hayCatalogo) catalogoReal()
  const cinco = () => rutina(['leg-press', 'bench-press', 'seated-cable-row', 'leg-extension', 'lat-pulldown'].map((id, i) => bloque(`b${i}`, id)))

  it('mínima: los 4 primeros a 2 series', async () => {
    await db.perfil.put(perfilPorDefecto())
    await activarRutina(cinco())
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A', version: 'minima' })))!
    expect(s.version).toBe('minima')
    expect(s.ejercicios.map(e => e.ejercicio)).toEqual(['leg-press', 'bench-press', 'seated-cable-row', 'leg-extension'])
    expect(s.ejercicios.every(e => e.series.filter(x => !x.calentamiento).length === 2)).toBe(true)
  })
  it('la víspera de su deporte, la pierna va con una serie menos y esfuerzo cómodo; el resto igual', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), diaDeporte: diaSemana(deISO(sumarDias(HOY, 1))) })
    await activarRutina(cinco())
    const s = (await db.sesiones.get(await iniciarEntreno({ letra: 'A' })))!
    const de = (id: string) => s.ejercicios.find(e => e.ejercicio === id)!
    expect(de('leg-press').series.filter(x => !x.calentamiento)).toHaveLength(2)
    expect(de('leg-press').rpe).toBeLessThanOrEqual(7)
    expect(de('bench-press').series.filter(x => !x.calentamiento)).toHaveLength(3)
    expect(de('bench-press').rpe).toBe(8)
  })
})
