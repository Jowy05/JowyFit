// Acciones de datos/acciones (IndexedDB simulada): cada escritura de varias tablas va entera o no va,
// repetir el alta no duplica nada y cada «Deshacer» deja la base como estaba.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import { gimnasioNuevo, guardarAjustes, leerAjustes, perfilPorDefecto } from '../src/datos/repos'
import { completarAlta, type DatosAlta } from '../src/datos/acciones/alta'
import { apuntarPlantilla, desmarcarSuplemento, guardarSuplemento, marcarSuplemento, plantillaDeProducto } from '../src/datos/acciones/comida'
import { borrarMedicion, guardarLecturasBascula, guardarPasos, guardarPasosAuto, sumarTrote } from '../src/datos/acciones/cuerpo'
import { alargarDescanso, apuntarHecha, descartarEntreno, iniciarEntreno, pasarACorta, quitarDescanso, terminarEntreno } from '../src/datos/acciones/entreno'
import { activarRutina, borrarGimnasio, guardarMaquinaPropia } from '../src/datos/acciones/rutina'
import { hoyISO } from '../src/dominio/fechas'
import type { DiaRutina, Plantilla, Rutina } from '../src/datos/tipos'

async function vaciar() { for (const t of TABLAS) await db.table(t).clear() }
beforeEach(vaciar)
afterEach(() => { vi.restoreAllMocks() })

/** Espera a que terminen los «Deshacer» (lanzan su escritura sin esperarla). */
const esperar = () => new Promise(r => setTimeout(r, 30))
const HOY = hoyISO()

const alta = (x: Partial<DatosAlta> = {}): DatosAlta => ({
  gimnasio: { ...gimnasioNuevo('Mi gimnasio'), creado: '2026-10-22T10:00:00.000Z' },
  perfil: { ...perfilPorDefecto(), nacimiento: '1990-05-01', alturaCm: 178, diasFijos: [1, 3, 5], altaCompleta: false },
  medicion: { fecha: `${HOY}T07:00`, origen: 'manual', pesoKg: 80 },
  medicionCambiada: true,
  hoy: HOY,
  ...x,
})

describe('completarAlta', () => {
  it('guarda gimnasio, perfil, medición, rutina de prueba y ajustes', async () => {
    const { perfil, rutina } = await completarAlta(alta())
    expect(await db.gimnasios.count()).toBe(1)
    expect(perfil.alturaCm).toBe(178)
    expect(await db.mediciones.count()).toBe(1)
    expect(rutina.calibracion).toBe(true)
    const g = (await db.gimnasios.toArray())[0]!
    expect((await db.rutinas.toArray()).map(r => r.gimnasioId)).toEqual([g.id])
    const a = await leerAjustes()
    expect(a.gimnasioActivo).toBe(g.id)
    expect(a.inicio).toBe(HOY)
  })
  it('repetirlo no crea otro gimnasio, ni otra rutina, ni otra medición', async () => {
    await completarAlta(alta())
    await completarAlta(alta({ gimnasio: { ...alta().gimnasio, nombre: 'Otro nombre' } }))
    expect(await db.gimnasios.count()).toBe(1)
    expect((await db.gimnasios.toArray())[0]!.nombre).toBe('Otro nombre')
    expect(await db.rutinas.count()).toBe(1)
    expect(await db.mediciones.count()).toBe(1)
  })
  it('con datos importados sin cambios no apunta medición; sin ninguna medición, sí', async () => {
    await db.mediciones.add({ fecha: '2026-01-01T07:00', origen: 'casa', pesoKg: 82 })
    await completarAlta(alta({ medicionCambiada: false }))
    expect(await db.mediciones.count()).toBe(1)
    await vaciar()
    await completarAlta(alta({ medicionCambiada: false }))
    expect(await db.mediciones.count()).toBe(1)
  })
  it('si falla una escritura no queda nada a medias', async () => {
    await db.mediciones.add({ id: 7, fecha: '2026-01-01T07:00', origen: 'casa', pesoKg: 82 })
    // Misma clave que la que ya hay: el add de la medición falla después del gimnasio y el perfil.
    await expect(completarAlta(alta({ medicion: { id: 7, fecha: `${HOY}T07:00`, origen: 'manual', pesoKg: 80 } }))).rejects.toThrow()
    expect(await db.gimnasios.count()).toBe(0)
    expect(await db.perfil.count()).toBe(0)
    expect(await db.rutinas.count()).toBe(0)
    expect((await db.ajustes.get('app'))?.inicio ?? null).toBeNull()
  })
})

describe('comida', () => {
  const batido: Plantilla = { nombre: 'Batido de proteína', kcal: 120, proteina: 24, tipo: 'comida', usos: 3 }

  it('marcar el batido apunta la comida; deshacer quita las dos cosas', async () => {
    const deshacer = await marcarSuplemento(perfilPorDefecto(), HOY, 'Batido de proteína')
    expect((await db.suplementos.get(HOY))?.tomados).toEqual(['Batido de proteína'])
    expect(await db.comidas.count()).toBe(1)
    deshacer()
    await esperar()
    expect((await db.suplementos.get(HOY))?.tomados).toEqual([])
    expect(await db.comidas.count()).toBe(0)
  })
  it('si falla apuntar el batido, tampoco queda marcado', async () => {
    vi.spyOn(db.comidas, 'add').mockRejectedValueOnce(new Error('disco lleno'))
    await expect(marcarSuplemento(perfilPorDefecto(), HOY, 'Batido de proteína')).rejects.toThrow('disco lleno')
    expect(await db.suplementos.get(HOY)).toBeUndefined()
  })
  it('desmarcar sin id borra el batido del suplemento pero no el apuntado a mano', async () => {
    await marcarSuplemento(perfilPorDefecto(), HOY, 'Batido de proteína')
    await db.comidas.add({ fecha: HOY, hora: '10:00', franja: 'desayuno', nombre: 'Batido casero', kcal: 200, proteina: 20, racion: 'N', tipo: 'nota' })
    await desmarcarSuplemento(HOY, 'Batido de proteína')
    expect((await db.comidas.toArray()).map(c => c.nombre)).toEqual(['Batido casero'])
  })
  it('apuntar una plantilla cuenta un uso; deshacer lo devuelve y quita la comida', async () => {
    const id = (await db.plantillas.add(batido))!
    const deshacer = await apuntarPlantilla({ ...batido, id }, 'N', HOY)
    expect((await db.plantillas.get(id))?.usos).toBe(4)
    expect(await db.comidas.count()).toBe(1)
    deshacer()
    await esperar()
    expect((await db.plantillas.get(id))?.usos).toBe(3)
    expect(await db.comidas.count()).toBe(0)
  })
  it('si falla contar el uso, la comida no se apunta', async () => {
    const id = (await db.plantillas.add(batido))!
    vi.spyOn(db.plantillas, 'update').mockRejectedValueOnce(new Error('no'))
    await expect(apuntarPlantilla({ ...batido, id }, 'N', HOY)).rejects.toThrow()
    expect(await db.comidas.count()).toBe(0)
  })
  it('un producto entra una sola vez en Mis comidas', async () => {
    const p = { nombre: 'Yogur', kcal: 100, proteina: 10, tipo: 'comida' as const, usos: 0, codigo: '8410000000000' }
    expect(await plantillaDeProducto(p)).toBe(true)
    expect(await plantillaDeProducto(p)).toBe(false)
    expect(await db.plantillas.count()).toBe(1)
  })
  it('cambiar el batido lo cambia en el perfil, en Mis comidas y en el de hoy', async () => {
    await db.perfil.put(perfilPorDefecto())
    await db.plantillas.add(batido)
    await marcarSuplemento(perfilPorDefecto(), HOY, 'Batido de proteína')
    await guardarSuplemento(perfilPorDefecto(), 'Batido de proteína', '1 cacito', { proteina: 30, kcal: 150 }, ['batido de proteína'])
    expect((await db.perfil.get('yo'))?.batido).toEqual({ proteina: 30, kcal: 150 })
    expect((await db.plantillas.toArray())[0]!.kcal).toBe(150)
    expect((await db.comidas.toArray())[0]!.proteina).toBe(30)
  })
})

describe('cuerpo', () => {
  it('borrar una medición de Health Connect la ignora en adelante; deshacer la devuelve y quita el ignorado', async () => {
    await guardarAjustes({ hcIgnorados: ['viejo'] })
    const id = (await db.mediciones.add({ fecha: '2026-10-20T07:00', origen: 'casa', pesoKg: 80, hc: ['hc-1'] }))!
    const deshacer = await borrarMedicion(id)
    expect(await db.mediciones.count()).toBe(0)
    expect((await leerAjustes()).hcIgnorados).toEqual(['viejo', 'hc-1'])
    deshacer!()
    await esperar()
    expect(await db.mediciones.get(id)).toBeDefined()
    expect((await leerAjustes()).hcIgnorados).toEqual(['viejo'])
  })
  it('borrar una medición que no existe no ofrece deshacer', async () => {
    expect(await borrarMedicion(99)).toBeUndefined()
  })
  it('si falla guardar el ignorado, la medición sigue ahí', async () => {
    const id = (await db.mediciones.add({ fecha: '2026-10-20T07:00', origen: 'casa', pesoKg: 80, hc: ['hc-1'] }))!
    vi.spyOn(db.ajustes, 'put').mockRejectedValueOnce(new Error('no'))
    await expect(borrarMedicion(id)).rejects.toThrow()
    expect(await db.mediciones.get(id)).toBeDefined()
  })
  it('pasos a mano conservan el trote; el trote suma y deshacer deja el día como estaba', async () => {
    const deshacer = await sumarTrote(HOY, 4000, 3)
    expect(await db.pasos.get(HOY)).toEqual({ fecha: HOY, pasos: 4000, fuente: 'manual', troteKm: 3 })
    await guardarPasos(HOY, 9000.4)
    expect(await db.pasos.get(HOY)).toEqual({ fecha: HOY, pasos: 9000, fuente: 'manual', troteKm: 3 })
    const otra = await sumarTrote(HOY, 1300, 1)
    expect((await db.pasos.get(HOY))?.troteKm).toBe(4)
    otra()
    await esperar()
    expect((await db.pasos.get(HOY))?.pasos).toBe(9000)
    // El primero vuelve al día de antes de él: no había nada.
    deshacer()
    await esperar()
    expect(await db.pasos.get(HOY)).toBeUndefined()
  })
  it('deshacer el trote de un día vacío borra el día', async () => {
    const deshacer = await sumarTrote(HOY, 1000, 1)
    deshacer()
    await esperar()
    expect(await db.pasos.get(HOY)).toBeUndefined()
  })
  it('los pasos de Health Connect suman el trote apuntado a mano', async () => {
    await db.pasos.put({ fecha: HOY, pasos: 100, fuente: 'manual', troteKm: 2 })
    await guardarPasosAuto({ [HOY]: 5000, '2026-01-01': 300 })
    expect((await db.pasos.get(HOY))?.pasos).toBeGreaterThan(5000)
    expect(await db.pasos.get('2026-01-01')).toEqual({ fecha: '2026-01-01', pasos: 300, fuente: 'auto', troteKm: undefined })
  })
  it('las pesadas nuevas y la grasa tardía van juntas', async () => {
    const id = (await db.mediciones.add({ fecha: '2026-10-20T07:00', origen: 'casa', pesoKg: 80, hc: ['p1'] }))!
    await guardarLecturasBascula([{ fecha: '2026-10-21T07:00', origen: 'casa', pesoKg: 79.5, hc: ['p2'] }], [{ id, grasaPct: 21, ids: ['g1'] }])
    expect(await db.mediciones.count()).toBe(2)
    expect(await db.mediciones.get(id)).toMatchObject({ bascula: { grasaPct: 21 }, hc: ['p1', 'g1'] })
  })
})

describe('rutina y gimnasios', () => {
  const rutina = (x: Partial<Rutina> = {}): Omit<Rutina, 'id'> => ({ creada: '2026-10-01', activa: true, estructura: 'x', porque: [], calibracion: false, gimnasioId: null, dias: [], ...x })

  it('activar una rutina apaga las demás', async () => {
    await db.rutinas.add(rutina())
    const id = await activarRutina(rutina({ estructura: 'nueva', activa: false }))
    expect((await db.rutinas.toArray()).map(r => [r.id === id, r.activa])).toEqual([[false, false], [true, true]])
  })
  it('borrar el gimnasio activo pasa al primero que quede', async () => {
    const a = (await db.gimnasios.add(gimnasioNuevo('A')))!
    const b = (await db.gimnasios.add(gimnasioNuevo('B')))!
    await guardarAjustes({ gimnasioActivo: b })
    await borrarGimnasio(b)
    expect((await leerAjustes()).gimnasioActivo).toBe(a)
    await borrarGimnasio(a)
    expect((await leerAjustes()).gimnasioActivo).toBeNull()
  })
  it('una máquina propia suma su material parecido; sin gimnasio, false', async () => {
    const id = (await db.gimnasios.add({ ...gimnasioNuevo('A'), material: [] }))!
    expect(await guardarMaquinaPropia(id, { id: 'm1', nombre: 'Prensa rara', parecida: 'leg_press' })).toBe(true)
    expect(await guardarMaquinaPropia(id, { id: 'm1', nombre: 'Prensa', parecida: 'leg_press' })).toBe(true)
    const g = await db.gimnasios.get(id)
    expect(g?.propias.map(m => m.nombre)).toEqual(['Prensa'])
    expect(g?.material).toEqual(['leg_press'])
    expect(await guardarMaquinaPropia(999, { id: 'm2', nombre: 'x', parecida: null })).toBe(false)
  })
})

describe('entreno', () => {
  const dia: DiaRutina = { letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques: [
    { uid: 'a', ejercicio: 'a', alternativas: [], series: 2, repsMin: 8, repsMax: 12, rpe: 8, descanso: 120, registro: 'peso' as const },
    { uid: 'b', ejercicio: 'b', alternativas: [], series: 2, repsMin: 8, repsMax: 12, rpe: 8, descanso: 120, registro: 'peso' as const, fueraEnCorta: true },
  ] }

  it('dos «Empezar» a la vez dejan un solo entreno en curso', async () => {
    await db.rutinas.add({ creada: '2026-10-01', activa: true, estructura: 'x', porque: [], calibracion: false, gimnasioId: null, dias: [dia] })
    const [a, b] = await Promise.all([iniciarEntreno({ letra: 'A' }), iniciarEntreno({ letra: 'A' })])
    expect(a).toBe(b)
    expect(await db.sesiones.where('estado').equals('curso').count()).toBe(1)
  })
  it('hecho, más tiempo, saltar descanso, pasar a corta y terminar', async () => {
    await db.rutinas.add({ creada: '2026-10-01', activa: true, estructura: 'x', porque: [], calibracion: false, gimnasioId: null, dias: [dia] })
    const id = await iniciarEntreno({ letra: 'A' })
    const s0 = (await db.sesiones.get(id))!
    expect(await apuntarHecha(s0, 0, { peso: 40, reps: 8, rpe: null, segundos: null }, [])).toBeNull()
    const s1 = (await db.sesiones.get(id))!
    expect(s1.descansoTotal).toBe(120)
    await alargarDescanso(s1)
    const s2 = (await db.sesiones.get(id))!
    expect(s2.descansoTotal).toBe(135)
    expect(s2.descansoHasta).toBe(s1.descansoHasta! + 15_000)
    await quitarDescanso(s2)
    const s3 = (await db.sesiones.get(id))!
    expect(s3.descansoHasta).toBeUndefined()
    await pasarACorta(s3)
    const s4 = (await db.sesiones.get(id))!
    expect(s4.version).toBe('corta')
    expect(s4.ejercicios.map(e => e.estado)).toEqual(['curso', 'saltado'])
    await terminarEntreno(s4, s4.inicio + 60_000, { minutosReales: 1 })
    expect(await db.sesiones.get(id)).toMatchObject({ estado: 'hecha', fin: s4.inicio + 60_000, respuestas: { minutosReales: 1 } })
  })
  it('descartar borra el entreno en curso', async () => {
    const id = await iniciarEntreno({ libre: true })
    await descartarEntreno(id)
    expect(await db.sesiones.count()).toBe(0)
  })
})
