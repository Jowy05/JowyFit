// Batería de pruebas estilo User Stories + simulación de una semana entera (lunes a domingo)
// ejercitando la app real (Dexie, catálogo RepDB, acciones, dominio, copias, exportación CSV/JSON e informe PDF).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { db, TABLAS } from '../src/datos/db'
import { ajustesPorDefecto, gimnasioNuevo, guardarAjustes, guardarPerfil, leerAjustes, perfilPorDefecto } from '../src/datos/repos'
import { guardarRutina } from '../src/datos/acciones/rutina'
import { apuntarHecha, borrarPlantillaEntreno, corregirHecha, guardarPlantillaEntreno, iniciarEntreno, terminarEntreno } from '../src/datos/acciones/entreno'
import { alternarSuplemento, apuntar, copiarComidasDia } from '../src/datos/acciones/comida'
import { apuntarCardio, apuntarMedicion, guardarMeta, guardarPasos, sumarTrote } from '../src/datos/acciones/cuerpo'
import { guardarIntentoReto } from '../src/datos/acciones/retos'
import { reprogramarNotificaciones } from '../src/datos/acciones/avisos'
import { exportar, importar } from '../src/datos/copias'
import { leerDatosExportLigero, sesionesHechas } from '../src/datos/consultas'
import { generarRutina } from '../src/dominio/generador'
import { registrarAvanceMeta, borrarHitoMeta, valorMeta, estadoMeta } from '../src/dominio/metas'
import { ejerciciosEstancados, recordsEn, recordsPorMes, subidas } from '../src/dominio/tendencias'
import { resumenSemana } from '../src/dominio/resumen'
import { semanaDe } from '../src/dominio/fechas'
import { rachaRetos } from '../src/dominio/retos'
import { csvComidas, csvEntrenos, csvMedidas, jsonLigero } from '../src/dominio/exportar'
import { calcularInforme } from '../src/informe/calculo'
import { tablasInforme } from '../src/informe/calculo/leer'
import { crearPdf } from '../src/informe/pdf'
import * as plataforma from '../src/plataforma'
import type { Ejercicio } from '../src/catalogo/tipos'
import type { Perfil, Sesion } from '../src/datos/tipos'
import fs from 'node:fs'
import path from 'node:path'

// Carga real del catálogo RepDB de la app.
function cargarEjerciciosReales(): Ejercicio[] {
  const ruta = path.resolve(import.meta.dirname, '..', 'public', 'repdb', 'catalogo.json')
  const raw = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  return raw.ejercicios as Ejercicio[]
}

const EJERCICIOS = cargarEjerciciosReales()
const NOMBRE_EJ = (id: string) => EJERCICIOS.find(e => e.id === id)?.nombre ?? id

/** Completa todas las series de trabajo de una sesión en curso con pesos/reps reales y la termina. */
async function completarSesionEnCurso(idSesion: number, factorPeso = 1, rpe = 7.5): Promise<Sesion> {
  const todasAntes = await sesionesHechas()
  let s = (await db.sesiones.get(idSesion))!
  for (let i = 0; i < s.ejercicios.length; i++) {
    s = (await db.sesiones.get(idSesion))!
    const e = s.ejercicios[i]!
    const previas = todasAntes.flatMap(x => x.ejercicios.filter(y => y.ejercicio === e.ejercicio).flatMap(y => y.series))
    for (let k = 0; k < e.series.length; k++) {
      s = (await db.sesiones.get(idSesion))!
      const ej = s.ejercicios[i]!
      const serie = ej.series[k]!
      if (serie.hecha) continue
      const pesoBase = ej.registro === 'peso' || ej.registro === 'mancuerna' ? Math.round((40 * factorPeso) / 2.5) * 2.5
        : ej.registro === 'asistido' ? -15 : null
      const datos = ej.registro === 'tiempo'
        ? { peso: null, reps: null, segundos: 40, rpe }
        : ej.registro === 'cardio'
          ? { peso: null, reps: 15, km: 2.2, rpe: null }
          : { peso: pesoBase, reps: ej.repsMax, rpe }
      await apuntarHecha(s, i, datos, [...previas, ...ej.series.filter(x => x.hecha)])
    }
  }
  const final = (await db.sesiones.get(idSesion))!
  const fin = final.inicio + 48 * 60_000
  await terminarEntreno(final, fin, { minutosReales: 48, nota: 'Buena sesión' })
  return (await db.sesiones.get(idSesion))!
}

describe('User Stories · semana entera simulada (lunes 12 oct → domingo 18 oct 2026)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T08:00:00'))
    for (const tb of TABLAS) await db.table(tb).clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('recorre los 7 días de una semana completa verificando rutina, entreno, plantillas, comida, metas, retos, pasos/avisos, fuerza, revisión, CSV/JSON, copia .jowyfit e informe PDF', async () => {
    // ── US-01 · LUNES (12 oct): Alta con salud/sueño, rutina adaptada, meta con nota, comidas, reto y recordatorio inteligente de pasos ──
    const gymId = (await db.gimnasios.add(gimnasioNuevo('Gimnasio Central'))) as number
    const perfil: Perfil = {
      ...perfilPorDefecto(),
      altaCompleta: true,
      creado: '2026-10-12T07:00:00.000Z',
      nombre: 'Jowy',
      nacimiento: '1998-05-10',
      sexo: 'hombre',
      alturaCm: 178,
      objetivo: 'recomposicion',
      diasFijos: [0, 2, 4], // lunes, miércoles, viernes
      diasOpcionales: [5],  // sábado opcional
      sueno: 'poco',
      condicionesSalud: ['diabetes', 'asma'],
      suplementos: ['Creatina', 'Batido de proteína'],
      pasosObjetivo: 8000,
    }
    await guardarPerfil(perfil)
    await guardarAjustes({
      ...ajustesPorDefecto(),
      gimnasioActivo: gymId,
      inicio: '2026-10-12',
      proteinaManual: 150,
      noti: { ...ajustesPorDefecto().noti, pasos: true, pasosHora: '18:00' },
    })

    const gym = (await db.gimnasios.get(gymId))!
    const rutina = generarRutina({ perfil, gimnasio: gym, marcas: new Map(), ejercicios: EJERCICIOS })
    expect(rutina.dias.length).toBeGreaterThanOrEqual(3)
    // Como duerme poco, el esfuerzo objetivo de todos los bloques debe quedar limitado a <= 7.5
    for (const d of rutina.dias) {
      for (const b of d.bloques) expect(b.rpe).toBeLessThanOrEqual(7.5)
    }
    await guardarRutina({ ...rutina, calibracion: false })

    // Pesaje inicial del lunes
    await apuntarMedicion({ fecha: '2026-10-12T07:15', origen: 'casa', pesoKg: 80.4, perimetros: { cintura: 90 } })

    // Meta de 10 dominadas + primer avance con nota
    const metaId = (await db.metas.add(registrarAvanceMeta(
      { tipo: 'dominadas', titulo: '10 dominadas estrictas', objetivo: 10, unidad: 'reps', inicio: 0 },
      4, '2026-10-12', 'sin impulso',
    ))) as number

    // Comidas del lunes (148 g proteína, dentro del objetivo de 150 g)
    await apuntar({ fecha: '2026-10-12', hora: '08:15', franja: 'desayuno', nombre: 'Tostadas con huevos y yogur', kcal: 510, proteina: 42, racion: 'N', tipo: 'nota' })
    await apuntar({ fecha: '2026-10-12', hora: '14:00', franja: 'comida', nombre: 'Pollo con arroz', kcal: 680, proteina: 60, racion: 'N', tipo: 'nota' })
    await apuntar({ fecha: '2026-10-12', hora: '21:00', franja: 'cena', nombre: 'Merluza con patata', kcal: 540, proteina: 46, racion: 'N', tipo: 'nota' })

    // Entreno Día A (lunes) + guardar como plantilla libre
    const idLunes = await iniciarEntreno({ letra: 'A' })
    const sLunes = await completarSesionEnCurso(idLunes, 1, 7)
    expect(sLunes.estado).toBe('hecha')
    const plantillaExpress = await guardarPlantillaEntreno('Express torso', sLunes.ejercicios)
    expect((await leerAjustes()).entrenosLibres).toHaveLength(1)

    // Reto del lunes (flexiones-60: 26 reps → récord)
    const rLunes = await guardarIntentoReto({ fecha: '2026-10-12T17:00', reto: 'flexiones-60', valor: 26, duracionS: 60, modo: 'camara' })
    expect(rLunes.record).toBe(true)

    // Recordatorio inteligente de pasos: con 2500 (< 50 % de 8000) a las 12:00 se programa; al subir a 8500 se cancela el de hoy
    vi.setSystemTime(new Date('2026-10-12T12:00:00'))
    vi.spyOn(plataforma, 'esNativo').mockReturnValue(true)
    vi.spyOn(plataforma, 'cancelar').mockResolvedValue()
    const spyProg = vi.spyOn(plataforma, 'programar').mockResolvedValue()

    await guardarPasos('2026-10-12', 2500)
    await reprogramarNotificaciones()
    expect((spyProg.mock.calls.at(-1)?.[0] ?? []).map(a => a.id)).toContain(plataforma.ID_AVISO.pasos)

    await guardarPasos('2026-10-12', 8500)
    await reprogramarNotificaciones()
    expect((spyProg.mock.calls.at(-1)?.[0] ?? []).map(a => a.id)).not.toContain(plataforma.ID_AVISO.pasos)

    // ── US-02 · MARTES (13 oct): Descanso activo, repetir día completo de ayer con deshacer, cardio/trote, avance de meta y racha de retos ──
    vi.setSystemTime(new Date('2026-10-13T09:00:00'))
    const copiaMartes = await copiarComidasDia('2026-10-12', '2026-10-13')
    expect(copiaMartes?.n).toBe(3)
    // Probar deshacer y volver a copiar
    copiaMartes!.deshacer()
    await new Promise(r => setTimeout(r, 20))
    expect(await db.comidas.where('fecha').equals('2026-10-13').count()).toBe(0)
    await copiarComidasDia('2026-10-12', '2026-10-13')
    expect(await db.comidas.where('fecha').equals('2026-10-13').count()).toBe(3)

    await guardarPasos('2026-10-13', 6500)
    await sumarTrote('2026-10-13', 2600, 2)
    await apuntarCardio('2026-10-13', 'bici', 25, false)
    expect((await db.pasos.get('2026-10-13'))?.pasos).toBe(9100)

    // Segundo avance en la meta de dominadas (histórico = 2 hitos)
    const metaAntes = (await db.metas.get(metaId))!
    await guardarMeta(registrarAvanceMeta(metaAntes, 6, '2026-10-13', 'agarre prono limpio'))
    const metaMartes = (await db.metas.get(metaId))!
    expect(metaMartes.historial).toHaveLength(2)
    expect(valorMeta(metaMartes, [], await sesionesHechas(), perfil, '2026-10-13', NOMBRE_EJ)).toBe(6)
    expect(estadoMeta(metaMartes, 6).falta).toBe(4)

    // Superar el reto del lunes (30 reps → nuevo récord, racha = 2 días)
    const rMartes = await guardarIntentoReto({ fecha: '2026-10-13T18:30', reto: 'flexiones-60', valor: 30, duracionS: 60, modo: 'camara' })
    expect(rMartes.record).toBe(true)

    // ── US-03 · MIÉRCOLES (14 oct): Día B de rutina, repetir solo desayuno de ayer y suplementos ──
    vi.setSystemTime(new Date('2026-10-14T08:00:00'))
    const soloDesayuno = await copiarComidasDia('2026-10-13', '2026-10-14', 'desayuno')
    expect(soloDesayuno?.n).toBe(1)
    await apuntar({ fecha: '2026-10-14', hora: '14:00', franja: 'comida', nombre: 'Ternera con patatas', kcal: 720, proteina: 58, racion: 'N', tipo: 'nota' })
    await apuntar({ fecha: '2026-10-14', hora: '21:00', franja: 'cena', nombre: 'Salmón al horno', kcal: 560, proteina: 44, racion: 'N', tipo: 'nota' })
    // Marcar creatina y batido de proteína (el batido debe sumar una comida con proteína)
    await alternarSuplemento(perfil, '2026-10-14', 'Creatina')
    const desBatido = await alternarSuplemento(perfil, '2026-10-14', 'Batido de proteína')
    expect(desBatido).not.toBeNull()
    const comidasMiercoles = await db.comidas.where('fecha').equals('2026-10-14').toArray()
    expect(comidasMiercoles.some(c => c.suplemento === 'Batido de proteína')).toBe(true)

    const idMiercoles = await iniciarEntreno({ letra: 'B' })
    await completarSesionEnCurso(idMiercoles, 1.05, 7.5)
    await guardarPasos('2026-10-14', 8400)

    // ── US-04 · JUEVES (15 oct): Lanzar plantilla libre en 1 toque, corregir serie y medir progreso ──
    vi.setSystemTime(new Date('2026-10-15T17:30:00'))
    const idLibre = await iniciarEntreno({ plantilla: plantillaExpress })
    const sLibre = await completarSesionEnCurso(idLibre, 1.1, 7)
    expect(sLibre.letra).toBe('L')
    expect(sLibre.nombre).toBe('Express torso')
    // Corregir una serie hecha y comprobar que se guarda limpia
    const primeraSerie = sLibre.ejercicios[0]!.series[0]!
    await corregirHecha(sLibre, 0, 0, { peso: (primeraSerie.peso ?? 40) + 2.5, reps: primeraSerie.reps ?? 8, segundos: primeraSerie.segundos })
    await guardarPasos('2026-10-15', 8200)
    await copiarComidasDia('2026-10-14', '2026-10-15')

    // ── US-05 · VIERNES (16 oct): Día C de rutina, pesaje intermedio y reto de plancha ──
    vi.setSystemTime(new Date('2026-10-16T07:15:00'))
    await apuntarMedicion({ fecha: '2026-10-16T07:15', origen: 'casa', pesoKg: 79.9, perimetros: { cintura: 89.2 } })
    const idViernes = await iniciarEntreno({ letra: 'C' })
    await completarSesionEnCurso(idViernes, 1.12, 7.5)
    await guardarPasos('2026-10-16', 9200)
    await copiarComidasDia('2026-10-13', '2026-10-16')
    await guardarIntentoReto({ fecha: '2026-10-16T19:00', reto: 'plancha-max', valor: 75, duracionS: 75, modo: 'manual' })

    // ── US-06 · SÁBADO (17 oct): Borrar y restaurar plantilla libre + borrar hito temporal de meta ──
    vi.setSystemTime(new Date('2026-10-17T11:00:00'))
    await guardarPasos('2026-10-17', 10_400)
    await copiarComidasDia('2026-10-13', '2026-10-17')
    const metaConError = registrarAvanceMeta((await db.metas.get(metaId))!, 9, '2026-10-17', 'error de dedo')
    await guardarMeta(metaConError)
    expect((await db.metas.get(metaId))!.historial).toHaveLength(3)
    await guardarMeta(borrarHitoMeta(metaConError, 2))
    expect((await db.metas.get(metaId))!.actual).toBe(6)
    expect((await db.metas.get(metaId))!.historial).toHaveLength(2)

    const desBorrarPl = await borrarPlantillaEntreno(plantillaExpress.id)
    expect((await leerAjustes()).entrenosLibres).toEqual([])
    desBorrarPl()
    await new Promise(r => setTimeout(r, 20))
    expect((await leerAjustes()).entrenosLibres).toHaveLength(1)

    // ── US-07 · DOMINGO (18 oct): Revisión semanal, «¿Voy bien?», exportación CSV/JSON, copia .jowyfit e Informe PDF ──
    vi.setSystemTime(new Date('2026-10-18T19:30:00'))
    await guardarPasos('2026-10-18', 8100)
    await copiarComidasDia('2026-10-13', '2026-10-18')
    await db.revisiones.add({ fecha: '2026-10-18', estado: 'bien', respuestas: [], cambios: [] })

    const sesionesTodas = await sesionesHechas()
    expect(sesionesTodas).toHaveLength(4) // Lunes A, Miércoles B, Jueves Libre, Viernes C

    // Comprobar semáforo semanal («¿Voy bien?»)
    const diasSem = semanaDe('2026-10-18')
    const resSem = resumenSemana({
      hoy: '2026-10-18',
      sesiones: sesionesTodas,
      fijos: 3,
      mediciones: await db.mediciones.toArray(),
      comidas: await db.comidas.toArray(),
      pasos: await db.pasos.toArray(),
      objetivoProteina: 150,
      objetivoPasos: 8000,
      recordsSemana: recordsEn(sesionesTodas, diasSem),
      subidasSemana: subidas(sesionesTodas).filter(x => diasSem.includes(x.fecha)).length,
    })
    expect(resSem.entrenos).toBeGreaterThanOrEqual(3)
    expect(resSem.semaforo).toBe('verde')

    // Racha y récords de retos + comparador mensual de récords de fuerza
    const retos = await db.retos.toArray()
    expect(rachaRetos(retos, '2026-10-18').mejor).toBe(2)
    const recMes = recordsPorMes(sesionesTodas, '2026-10-18', 6)
    expect(recMes).toHaveLength(6)
    expect(recMes.at(-1)!.total).toBeGreaterThanOrEqual(0)

    // Exportación ligera CSV y JSON
    const datosExp = await leerDatosExportLigero()
    const csvE = csvEntrenos(datosExp.sesiones, NOMBRE_EJ)
    const csvC = csvComidas(datosExp.comidas)
    const csvM = csvMedidas(datosExp.mediciones)
    const json = jsonLigero(datosExp, new Date('2026-10-18T19:30:00Z'))
    expect(csvE.startsWith('\uFEFF')).toBe(true)
    expect(csvE).toContain('Express torso')
    expect(csvC).toContain('Pollo con arroz')
    expect(csvM).toContain('79.9')
    const parsedJson = JSON.parse(json)
    expect(parsedJson.formato).toBe('ligero')
    expect(parsedJson.datos.sesiones).toHaveLength(4)
    expect(parsedJson.datos.retos).toHaveLength(3)

    // Copia de seguridad completa (.jowyfit): exportar → vaciar BD → importar → integridad 100 %
    const copiaBytes = await exportar()
    for (const tb of TABLAS) await db.table(tb).clear()
    expect(await importar(copiaBytes)).toBe('copia')
    expect(await db.sesiones.count()).toBe(4)
    expect(await db.retos.count()).toBe(3)
    expect((await db.metas.get(metaId))!.historial).toHaveLength(2)
    expect((await leerAjustes()).entrenosLibres).toHaveLength(1)
    expect((await leerAjustes()).noti.pasos).toBe(true)

    // Informe PDF semanal completo: cálculo + generación binaria válida
    const tablas = await tablasInforme()
    const inf = calcularInforme({
      ...tablas,
      periodo: 'semana',
      ahora: new Date('2026-10-18T19:30:00'),
      secciones: { entrenos: true, comida: true, cuerpo: true, pasos: true, detalle: true },
      catalogo: { nombre: NOMBRE_EJ, patron: () => undefined, met: () => 5 },
    })
    expect(inf.hayDatos).toBe(true)
    expect(inf.entrenos?.sesiones).toBe(4)
    expect(inf.retos?.intentos).toBe(3)
    expect(inf.retos?.mejorRacha).toBe(2)
    expect(inf.comida?.diasApuntados).toBe(7)
    expect(inf.pasos?.diasCumplidos).toBe(7)
    expect(inf.resumen.metas[0]?.historial).toHaveLength(2)
    expect(inf.rutinaSalud?.perfil.some(x => x.nombre === 'Plantillas libres' && x.valor.includes('Express torso'))).toBe(true)
    expect(inf.rutinaSalud?.perfil.some(x => x.nombre === 'Proteína' && x.valor.includes('150'))).toBe(true)
    expect(inf.rutinaSalud?.revisiones.some(x => x.nombre === 'Sueño' && x.valor.includes('7,5'))).toBe(true)

    const pdfBytes = await crearPdf(inf, { version: '0.12.1' })
    const pdfDoc = await PDFDocument.load(pdfBytes)
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(4)
  })

  it('US-08 · Estancamiento: tras 3 sesiones normales sin mejorar el 1RM, aparece en Fuerza y en el Informe PDF', async () => {
    const ejBanca = EJERCICIOS.find(e => e.material === 'barbell' && /banca/i.test(e.nombre))!
    const s = (id: number, fecha: string): Sesion => ({
      id, fecha, rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: 1,
      inicio: new Date(`${fecha}T06:00:00Z`).getTime(), fin: new Date(`${fecha}T06:45:00Z`).getTime(),
      version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: [{
        uid: 'b1', ejercicio: ejBanca.id, planificado: ejBanca.id, estado: 'hecho',
        repsMin: 6, repsMax: 10, rpe: 8, descanso: 120, registro: 'peso',
        series: [{ n: 1, peso: 65, reps: 8, rpe: 8.5, calentamiento: false, hecha: true }],
      }],
    })
    const sesiones = [s(1, '2026-10-01'), s(2, '2026-10-05'), s(3, '2026-10-09'), s(4, '2026-10-13')]
    const est = ejerciciosEstancados(sesiones)
    expect(est).toEqual([{ ejercicio: ejBanca.id, peso: 65, sesiones: 3 }])

    const inf = calcularInforme({
      perfil: { ...perfilPorDefecto(), altaCompleta: true },
      ajustes: ajustesPorDefecto(),
      mediciones: [], sesiones, rutina: null, comidas: [], suplementos: [], pasos: [], metas: [], revisiones: [], retos: [],
      periodo: 'mes', ahora: new Date('2026-10-15T12:00:00Z'),
      catalogo: { nombre: NOMBRE_EJ, patron: () => undefined, met: () => 5 },
    })
    expect(inf.fuerza?.estancados).toHaveLength(1)
    expect(inf.fuerza?.estancados[0]!.id).toBe(ejBanca.id)
    expect(inf.fuerza?.estancados[0]!.nombre.toLowerCase()).toContain('banca')
    const pdfBytes = await crearPdf(inf, { version: '0.12.1' })
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
  })
})
