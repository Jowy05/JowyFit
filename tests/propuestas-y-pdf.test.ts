// Pruebas de las 7 propuestas nuevas y de la ampliación del informe en PDF.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { db, TABLAS } from '../src/datos/db'
import { ajustesPorDefecto, guardarAjustes, guardarPerfil, perfilPorDefecto } from '../src/datos/repos'
import { registrarAvanceMeta, borrarHitoMeta } from '../src/dominio/metas'
import { aCSV, csvComidas, csvEntrenos, csvMedidas, escaparCSV, jsonLigero } from '../src/dominio/exportar'
import { ejerciciosEstancados, recordsPorMes } from '../src/dominio/tendencias'
import { copiarComidasDia } from '../src/datos/acciones/comida'
import { borrarPlantillaEntreno, guardarPlantillaEntreno, iniciarEntreno } from '../src/datos/acciones/entreno'
import { calcularInforme } from '../src/informe/calculo'
import { crearPdf } from '../src/informe/pdf'
import { reprogramarNotificaciones } from '../src/datos/acciones/avisos'
import * as plataforma from '../src/plataforma'
import { hoyISO } from '../src/dominio/fechas'
import type { Comida, IntentoReto, Medicion, Meta, Sesion } from '../src/datos/tipos'

const sesionBase = (id: number, fecha: string, peso: number, reps: number, record = false): Sesion => ({
  id,
  fecha,
  rutinaId: 1,
  letra: 'A',
  nombre: 'Cuerpo completo A',
  gimnasioId: 1,
  inicio: new Date(`${fecha}T06:00:00Z`).getTime(),
  fin: new Date(`${fecha}T06:50:00Z`).getTime(),
  version: 'normal',
  estado: 'hecha',
  calibracion: false,
  ejercicios: [{
    uid: 'b1',
    ejercicio: 'bench-press',
    planificado: 'bench-press',
    estado: 'hecho',
    repsMin: 6,
    repsMax: 10,
    rpe: 8,
    descanso: 120,
    registro: 'peso',
    series: [{ n: 1, peso, reps, rpe: 8, calentamiento: false, hecha: true, record }],
  }],
})

describe('Propuesta 1 · Histórico y notas en metas', () => {
  it('registra avances con fecha y nota, actualiza el del mismo día sin duplicar y permite borrar recalculando actual', () => {
    const base: Meta = { tipo: 'dominadas', titulo: '10 dominadas', objetivo: 10, unidad: 'reps', inicio: 0 }
    const m1 = registrarAvanceMeta(base, 3, '2026-10-01', 'primer intento')
    expect(m1.actual).toBe(3)
    expect(m1.historial).toEqual([{ fecha: '2026-10-01', valor: 3, nota: 'primer intento' }])
    // Mismo día sin nota nueva actualiza el valor en sitio
    const m2 = registrarAvanceMeta(m1, 4, '2026-10-01')
    expect(m2.historial).toHaveLength(1)
    expect(m2.historial![0]!.valor).toBe(4)
    // Nuevo día añade entrada
    const m3 = registrarAvanceMeta(m2, 6, '2026-10-10', 'limpias')
    expect(m3.historial).toHaveLength(2)
    expect(m3.actual).toBe(6)
    // Borrar la última recalcula actual a 4
    const m4 = borrarHitoMeta(m3, 1)
    expect(m4.actual).toBe(4)
    expect(m4.historial).toHaveLength(1)
  })
})

describe('Propuesta 3 · Plantillas de entreno libre', () => {
  beforeEach(async () => {
    for (const tb of TABLAS) await db.table(tb).clear()
    await guardarPerfil({ ...perfilPorDefecto(), altaCompleta: true })
    await guardarAjustes(ajustesPorDefecto())
  })

  it('guarda una plantilla libre, inicia un entreno desde ella y la borra con deshacer', async () => {
    const s = sesionBase(1, '2026-10-10', 50, 8)
    const pl = await guardarPlantillaEntreno('Express torso', s.ejercicios)
    expect(pl.nombre).toBe('Express torso')
    expect(pl.ejercicios).toHaveLength(1)

    const idSesion = await iniciarEntreno({ plantilla: pl })
    const creada = await db.sesiones.get(idSesion)
    expect(creada?.letra).toBe('L')
    expect(creada?.nombre).toBe('Express torso')
    expect(creada?.ejercicios).toHaveLength(1)
    expect(creada?.ejercicios[0]!.ejercicio).toBe('bench-press')

    const deshacer = await borrarPlantillaEntreno(pl.id)
    expect((await db.ajustes.get('app'))?.entrenosLibres).toEqual([])
    deshacer()
    await new Promise(r => setTimeout(r, 20))
    expect((await db.ajustes.get('app'))?.entrenosLibres?.map(x => x.id)).toEqual([pl.id])
  })
})

describe('Propuesta 4 · Copiar día y franja de comidas con deshacer', () => {
  beforeEach(async () => {
    for (const tb of TABLAS) await db.table(tb).clear()
  })

  it('copia un día completo o una franja concreta y deshacer borra exactamente lo copiado', async () => {
    const c1: Comida = { fecha: '2026-10-12', hora: '08:00', franja: 'desayuno', nombre: 'Avena', kcal: 380, proteina: 22, racion: 'N', tipo: 'nota' }
    const c2: Comida = { fecha: '2026-10-12', hora: '14:00', franja: 'comida', nombre: 'Pollo con arroz', kcal: 620, proteina: 48, racion: 'N', tipo: 'nota' }
    await db.comidas.bulkAdd([c1, c2])

    const soloDesayuno = await copiarComidasDia('2026-10-12', '2026-10-13', 'desayuno')
    expect(soloDesayuno?.n).toBe(1)
    expect((await db.comidas.where('fecha').equals('2026-10-13').toArray()).map(x => x.nombre)).toEqual(['Avena'])
    soloDesayuno!.deshacer()
    await new Promise(r => setTimeout(r, 20))
    expect(await db.comidas.where('fecha').equals('2026-10-13').count()).toBe(0)

    const diaEntero = await copiarComidasDia('2026-10-12', '2026-10-13')
    expect(diaEntero?.n).toBe(2)
    expect(await db.comidas.where('fecha').equals('2026-10-13').count()).toBe(2)
  })
})

describe('Propuesta 5 · Récords por mes y ejercicios estancados', () => {
  it('cuenta récords por mes en los últimos 6 meses y detecta 3 sesiones sin progreso', () => {
    const sesiones: Sesion[] = [
      sesionBase(1, '2026-09-10', 50, 8, true),
      sesionBase(2, '2026-10-01', 50, 8, false),
      sesionBase(3, '2026-10-05', 50, 8, false),
      sesionBase(4, '2026-10-09', 50, 8, false),
    ]
    const meses = recordsPorMes(sesiones, '2026-10-15', 4)
    expect(meses).toHaveLength(4)
    expect(meses.find(m => m.mes === '2026-09')?.total).toBe(1)
    expect(meses.find(m => m.mes === '2026-10')?.total).toBe(0)

    const est = ejerciciosEstancados(sesiones)
    expect(est).toHaveLength(1)
    expect(est[0]).toMatchObject({ ejercicio: 'bench-press', peso: 50, sesiones: 3 })
  })
})

describe('Propuesta 7 · Exportación ligera CSV y JSON', () => {
  it('escapa CSV con BOM UTF-8, protege contra inyección de fórmulas y conserva números negativos', () => {
    expect(escaparCSV('=CMD()')).toBe("'=CMD()")
    expect(escaparCSV('+1+1')).toBe("'+1+1")
    expect(escaparCSV('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(escaparCSV('-15')).toBe('-15')
    expect(escaparCSV('Pollo, "asado"')).toBe('"Pollo, ""asado"""')
    const csv = aCSV(['A', 'B'], [['=1+1', 'normal']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain("'=1+1,normal")
  })

  it('genera CSV de entrenos, comidas y medidas y JSON ligero sin Blobs', () => {
    const ses = [sesionBase(1, '2026-10-13', 60, 8, true)]
    const com: Comida[] = [{ fecha: '2026-10-13', hora: '14:00', franja: 'comida', nombre: 'Lentejas', kcal: 540, proteina: 28, racion: 'N', tipo: 'nota', foto: new Blob(['img']) }]
    const med: Medicion[] = [{ fecha: '2026-10-13T07:00', origen: 'casa', pesoKg: 78.5, perimetros: { cintura: 88 } }]
    expect(csvEntrenos(ses, id => id)).toContain('bench-press')
    expect(csvComidas(com)).toContain('Lentejas')
    expect(csvMedidas(med)).toContain('78.5')

    const json = JSON.parse(jsonLigero({
      perfil: perfilPorDefecto(), mediciones: med, sesiones: ses, comidas: com, pasos: [], metas: [], retos: [], rutina: null, gimnasios: [],
    }, new Date('2026-10-13T12:00:00Z')))
    expect(json.formato).toBe('ligero')
    expect(json.datos.comidas[0].foto).toBeUndefined()
  })
})

describe('Informe PDF ampliado · retos, histórico de metas, estancados y rutina/salud', () => {
  it('incluye retos, histórico de metas, sueño limitado, estancados y genera un PDF válido', async () => {
    const sesiones: Sesion[] = [
      sesionBase(1, '2026-10-01', 60, 8, true),
      sesionBase(2, '2026-10-05', 60, 8, false),
      sesionBase(3, '2026-10-09', 60, 8, false),
      sesionBase(4, '2026-10-13', 60, 8, false),
    ]
    const retos: IntentoReto[] = [
      { id: 1, fecha: '2026-10-12T08:00', reto: 'flexiones-60', valor: 30, duracionS: 60, modo: 'camara', record: true },
      { id: 2, fecha: '2026-10-13T08:00', reto: 'flexiones-60', valor: 35, duracionS: 60, modo: 'camara', record: true },
      { id: 3, fecha: '2026-10-13T08:05', reto: 'plancha-max', valor: 95, duracionS: 95, modo: 'manual', record: true },
    ]
    const metas: Meta[] = [{
      id: 1, tipo: 'dominadas', titulo: '10 dominadas estrictas', objetivo: 10, unidad: 'reps', inicio: 0, actual: 6,
      historial: [{ fecha: '2026-10-01', valor: 4 }, { fecha: '2026-10-13', valor: 6, nota: 'sin balanceo' }],
    }]
    const perfil = {
      ...perfilPorDefecto(),
      altaCompleta: true,
      nombre: 'Prueba',
      sueno: 'poco' as const,
      condicionesSalud: ['diabetes' as const, 'asma' as const],
      lesiones: 'hombro derecho antiguo',
    }
    const ajustes = {
      ...ajustesPorDefecto(),
      proteinaManual: 155,
      mostrarKcal: false,
      entrenosLibres: [{ id: 'pl-1', nombre: 'Express', creado: '2026-10-10', ejercicios: [{ ejercicio: 'bench-press', series: 3, repsMin: 6, repsMax: 10, descanso: 120, registro: 'peso' as const }] }],
    }

    const inf = calcularInforme({
      perfil, ajustes, mediciones: [{ fecha: '2026-10-13T07:00', origen: 'casa', pesoKg: 78 }],
      sesiones, rutina: null, comidas: [], suplementos: [], pasos: [], metas, revisiones: [], retos,
      periodo: 'mes', ahora: new Date('2026-10-15T12:00:00Z'),
    })

    expect(inf.retos).not.toBeNull()
    expect(inf.retos!.intentos).toBe(3)
    expect(inf.retos!.rachaActual).toBe(0) // hoy es 15, último reto el 13
    expect(inf.retos!.mejorRacha).toBe(2)
    expect(inf.retos!.filas).toHaveLength(2)
    expect(inf.fuerza?.estancados).toHaveLength(1)
    expect(inf.resumen.metas[0]?.historial?.at(-1)?.nota).toBe('sin balanceo')
    expect(inf.rutinaSalud?.perfil.some(x => x.nombre === 'Proteína' && x.valor.includes('155'))).toBe(true)
    expect(inf.rutinaSalud?.perfil.some(x => x.nombre === 'Plantillas libres')).toBe(true)
    expect(inf.rutinaSalud?.revisiones.some(x => x.nombre === 'Sueño' && x.valor.includes('7,5'))).toBe(true)

    const bytes = await crearPdf(inf, { version: '0.12.1' })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3)

    // Informe de un solo día con retos también genera PDF válido
    const infDia = calcularInforme({
      perfil, ajustes, mediciones: [], sesiones: [], rutina: null, comidas: [], suplementos: [], pasos: [], metas: [], revisiones: [], retos,
      periodo: 'hoy', ahora: new Date('2026-10-13T12:00:00Z'),
    })
    expect(infDia.hayDatos).toBe(true)
    expect(infDia.retos?.intentos).toBe(2)
    const bytesDia = await crearPdf(infDia, { version: '0.12.1' })
    const docDia = await PDFDocument.load(bytesDia)
    expect(docDia.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})

describe('Propuesta 6 · Recordatorio inteligente de pasos', () => {
  beforeEach(async () => {
    for (const tb of TABLAS) await db.table(tb).clear()
    vi.restoreAllMocks()
  })

  it('programa el aviso de hoy solo cuando llevas menos del 50 % y lo cancela al superarlo', async () => {
    const a = ajustesPorDefecto()
    expect(a.noti.pasos).toBe(false)
    expect(a.noti.pasosHora).toBe('18:00')

    await guardarPerfil({ ...perfilPorDefecto(), altaCompleta: true, pasosObjetivo: 8000 })
    await guardarAjustes({ ...a, noti: { ...a.noti, dormir: false, pesarse: false, copia: false, revision: false, pasos: true, pasosHora: '23:59' } })
    const hoy = hoyISO()
    await db.pasos.put({ fecha: hoy, pasos: 2000, fuente: 'manual' })

    vi.spyOn(plataforma, 'esNativo').mockReturnValue(true)
    vi.spyOn(plataforma, 'cancelar').mockResolvedValue()
    const prog = vi.spyOn(plataforma, 'programar').mockResolvedValue()

    await reprogramarNotificaciones()
    const idsBajo = (prog.mock.calls.at(-1)?.[0] ?? []).map(x => x.id)
    expect(idsBajo).toContain(plataforma.ID_AVISO.pasos)
    expect(idsBajo).toContain(plataforma.ID_AVISO.pasos + 1)

    // Al superar el 50 % (4000 pasos), el aviso de hoy deja de programarse y queda solo el de mañana
    await db.pasos.put({ fecha: hoy, pasos: 4500, fuente: 'manual' })
    await reprogramarNotificaciones()
    const idsAlto = (prog.mock.calls.at(-1)?.[0] ?? []).map(x => x.id)
    expect(idsAlto).not.toContain(plataforma.ID_AVISO.pasos)
    expect(idsAlto).toContain(plataforma.ID_AVISO.pasos + 1)

    vi.restoreAllMocks()
  })
})
