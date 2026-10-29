// Copias de seguridad a fondo: cada tabla con TODOS sus campos (los tipos `Required<…>` obligan a
// añadir aquí cualquier campo nuevo: si no, no compila), copias viejas sin los campos nuevos,
// copias sin comprimir, el nombre del archivo y la copia real del dueño si está en .cache.
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate'
import { db, TABLAS } from '../src/datos/db'
import { exportar, importar, nombreCopia } from '../src/datos/copias'
import { ajustesPorDefecto, leerAjustes, perfilPorDefecto } from '../src/datos/repos'
import { sugerenciaPara, gastoDelDia } from '../src/datos/consultas'
import type {
  Ajustes, Bloque, Comida, DiaRutina, DiaSuplementos, EjercicioPropio, EjercicioSesion, Foto, Gimnasio, MaquinaPropia, MarcaEjercicio, Medicion, Meta, PasosDia, Perfil,
  Plantilla, Producto, Revision, Rutina, Serie, Sesion,
} from '../src/datos/tipos'

const imagen = (txt: string, tipo = 'image/jpeg') => new Blob([new TextEncoder().encode(txt)], { type: tipo })

// ---------- una fila de cada tabla con todos los campos rellenos ----------
const perfil: Required<Perfil> = {
  ...perfilPorDefecto(), altaCompleta: true, nombre: 'Jowy', nacimiento: '2005-03-23', sexo: 'hombre', alturaCm: 177, objetivo: 'recomposicion',
  prioridades: ['Quitar barriga'], zonasPrioridad: ['brazos'], nivel: 'vuelvo', referencias: { banca: '40 kg × 8' }, diasFijos: [1, 3, 4], diasOpcionales: [5],
  horaEntreno: '05:30', transporte: 'andando', horaLimite: { coche: '06:20', andando: '06:45' }, minutosNormal: 60, minutosCorta: 45, horaDormir: '22:00',
  enAyunas: true, sesionPerdida: 'sabado', zonasSensibles: ['rodilla'], lesiones: 'rodilla', condiciones: '', preferencia: 'maquinas', reps: 'mezcla',
  superseries: true, alFallo: false, core: true, cardio: 'pasos', comidasDia: 3, franjasHambre: ['tarde'], bebidas: ['energética'],
  suplementos: ['Creatina', 'Batido de proteína'], dosisSuplementos: { Creatina: '5 g' }, batido: { proteina: 30, kcal: 150 }, trabajo: 'sentado',
  pasosObjetivo: 8000, diasPesaje: [1, 5], fotosCadaSemanas: 2,
  objetivosExtra: ['perder'], zonasMucho: ['brazos'], urgencias: ['mareo'], condicionesSalud: ['tension', 'asma'], noQuiero: ['poleas', 'suelo'],
  dolores: [{ zona: 'rodillas', cuanto: 'regular', cuando: 'fuerza', desde: 'semanas', inicio: '2026-10-01' }],
  modoMayor: { activo: true, propuesto: '2026-10-02', rechazado: '2026-09-01' }, modoRutina: 'cola', cardioMin: 75, cardioTipos: ['bici', 'caminar'],
  cardioCuando: 'despues', progresoMovimiento: '2026-10-12', sueno: 'poco', deportes: ['pádel'], diaDeporte: 6, experienciaPrevia: 'hace-anos',
}
const ajustes: Required<Ajustes> = {
  ...ajustesPorDefecto(), gimnasioActivo: 1, kcalManual: 2300, proteinaManual: 150, fuentePasos: 'auto', fuenteBascula: 'auto', hcIgnorados: ['hc-borrada'],
  ultimaCopia: '2026-10-12T10:00:00.000Z', ultimoAjusteEnergia: '2026-10-01', recolocadas: [{ fecha: '2026-10-17', letra: 'C', desde: '2026-10-16' }],
  inicio: '2026-10-13', semanaSuave: '2026-10-05', suavePospuesta: '2026-09-28',
  noti: { ...ajustesPorDefecto().noti, revision: true, revisionHora: '18:30' },
  informe: { periodo: 'semana', secciones: { entrenos: true, comida: false, cuerpo: true, pasos: false, detalle: true } },
}
const medicion: Required<Medicion> = {
  id: 1, fecha: '2026-10-13T07:05', origen: 'casa', pesoKg: 79.1,
  perimetros: { cintura: 98, cuello: 38, cadera: 100, pecho: 105, brazo: 34, brazoContraido: 36, muslo: 58 },
  bascula: { grasaPct: 24.2, masaGrasaKg: 19.1, masaLibreKg: 60, musculoKg: 56.8, musculoEsqKg: 33, aguaPct: 54, proteinaPct: 17, oseaKg: 3, visceral: 9, subcutaneaPct: 21, basalKcal: 1700, edadCorporal: 25 },
  hc: ['hc-1', 'hc-2'], fuente: 'com.fitdays.fitdays',
}
const foto: Required<Foto> = { id: 1, fecha: '2026-10-13T07:10', pose: 'frente', imagen: imagen('foto', 'image/png') }
const maquina: Required<MaquinaPropia> = { id: 'p1', nombre: 'Prensa vieja', parecida: 'leg-press', foto: imagen('maquina'), notas: 'asiento 3' }
const gimnasio: Required<Gimnasio> = { id: 1, nombre: 'Basic-Fit Ripollet', notas: 'abre a las 6', material: ['dumbbell', 'cable'], propias: [maquina, { id: 'p2', nombre: 'Sin foto', parecida: null }], mancuernas: [{ desde: 2, hasta: 10, paso: 1 }], discos: [1.25, 2.5, 5], barraKg: 20, creado: '2026-10-01T10:00:00.000Z' }
const marca: Required<MarcaEjercicio> = { id: 'bench-press', favorito: true, odiado: false, duele: false, notas: 'codos cerca', ajustes: 'Banco 3' }
const bloque: Required<Bloque> = { uid: 'b1', ejercicio: 'bench-press', alternativas: ['chest-press-machine'], series: 3, repsMin: 6, repsMax: 10, rpe: 8, descanso: 150, superserie: 'b2', fueraEnCorta: true, registro: 'peso', cargaPct: 0.8 }
const diaRutina: Required<DiaRutina> = { letra: 'A', nombre: 'Cuerpo completo A', dia: 1, opcional: false, bloques: [bloque, { ...bloque, uid: 'b2', ejercicio: 'seated-cable-row', superserie: 'b1' }] }
const rutina: Required<Rutina> = { id: 1, creada: '2026-10-13T05:00:00.000Z', activa: true, estructura: 'Cuerpo completo · 3 días', porque: ['3 días'], calibracion: true, gimnasioId: 1, dias: [diaRutina], equilibrio: 6, sinCubrir: ['Poleas'] }
const serie: Required<Serie> = { n: 1, peso: 40, reps: 8, segundos: null, rpe: 8.5, calentamiento: false, hecha: true, ts: 1_760_000_000_000, nota: 'bien', record: true }
const ejSesion: Required<EjercicioSesion> = { uid: 'b1', ejercicio: 'chest-press-machine', planificado: 'bench-press', motivo: 'ocupado', estado: 'hecho', series: [serie, { ...serie, n: 2, record: false, hecha: false, ts: 0 }], inicio: 1, fin: 2, repsMin: 6, repsMax: 10, rpe: 8, descanso: 150, superserie: 'b2', registro: 'peso', cargaPct: 0.8 }
const sesion: Required<Sesion> = {
  id: 1, fecha: '2026-10-13', rutinaId: 1, letra: 'A', nombre: 'Cuerpo completo A', gimnasioId: 1, inicio: 1_760_000_000_000, fin: 1_760_003_600_000, horaLimite: '06:45',
  version: 'normal', estado: 'hecha', ejercicios: [ejSesion], descansoHasta: 0, descansoTotal: 90,
  respuestas: { minutosReales: 55, descansos: 'bien', molestia: 'rodilla', ocupado: 'banco', nota: 'buen día' }, calibracion: true, suave: false,
}
const comidaFila: Required<Comida> = { id: 1, fecha: '2026-10-13', hora: '14:00', franja: 'comida', nombre: 'Arroz', kcal: 600, proteina: 22, cafeina: 0, racion: 'G', tipo: 'producto', plantillaId: 3, codigo: '8480000123458', foto: imagen('plato'), suplemento: 'Batido de proteína', hidratos: 82.8, azucares: 9, grasas: 18, sal: 2.9 }
const plantilla: Required<Plantilla> = { id: 3, nombre: 'Arroz al curry', kcal: 601, proteina: 22, cafeina: 0, franja: 'comida', tipo: 'comida', usos: 4, foto: imagen('arroz', 'image/png'), codigo: '8480000123458', hidratos: 82.8, azucares: 9, grasas: 18, sal: 2.9 }
const producto: Required<Producto> = { codigo: '8480000123458', nombre: 'Arroz al curry', marca: 'Hacendado', imagen: 'https://images.openfoodfacts.org/images/products/848/000/012/3458/front_es.3.200.jpg', kcal100: 167, proteina100: 6.1, hidratos100: 23, grasas100: 5, azucares100: 2.5, sal100: 0.8, cafeina100: null, racionG: 360, kcalRacion: 601, proteinaRacion: 22, guardado: '2026-10-13T10:00:00.000Z', pendiente: false, manual: false }
const pasos: Required<PasosDia> = { fecha: '2026-10-13', pasos: 8123, fuente: 'auto', troteKm: 2.5, cardio: [{ tipo: 'bici', min: 20 }] }
const suple: Required<DiaSuplementos> = { fecha: '2026-10-13', tomados: ['Creatina'] }
const propio: Required<EjercicioPropio> = {
  id: 'mio-abc123', nombre: 'Remo con goma elástica', grupo: 'espalda', material: 'otro', registro: 'corporal', foto: imagen('goma'),
  notas: 'Goma verde', rutinaAuto: true, creado: '2026-10-20', borrado: '2026-10-22',
}
const revision: Required<Revision> = {
  id: 1, fecha: '2026-10-18', estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'peor' }],
  cambios: [{ uid: 'b1', letra: 'A', zona: 'rodillas', antes: bloque, despues: { ...bloque, cargaPct: 0.8 }, deshecho: false }],
}
const meta: Required<Meta> = { id: 1, tipo: 'ejercicio', titulo: 'Banca 60 kg', objetivo: 60, unidad: 'kg', fecha: '2027-06-01', ejercicio: 'bench-press', inicio: 40, hecha: false }

async function sembrarTodo() {
  for (const t of TABLAS) await db.table(t).clear()
  await db.perfil.put(perfil)
  await db.ajustes.put(ajustes)
  await db.mediciones.put(medicion)
  await db.fotos.put(foto)
  await db.gimnasios.put(gimnasio)
  await db.marcas.put(marca)
  await db.rutinas.put(rutina)
  await db.sesiones.put(sesion)
  await db.comidas.put(comidaFila)
  await db.plantillas.put(plantilla)
  await db.productos.put(producto)
  await db.pasos.put(pasos)
  await db.suplementos.put(suple)
  await db.metas.put(meta)
  await db.propios.put(propio)
  await db.revisiones.put(revision)
}

/** Instantánea comparable de toda la base (los Blob se pasan a texto + tipo). */
async function instantanea() {
  const conv = async (v: unknown): Promise<unknown> => {
    if (v instanceof Blob) return { blob: await v.text(), tipo: v.type }
    if (Array.isArray(v)) return Promise.all(v.map(conv))
    if (v && typeof v === 'object') return Object.fromEntries(await Promise.all(Object.entries(v).map(async ([k, x]) => [k, await conv(x)])))
    return v
  }
  const out: Record<string, unknown> = {}
  for (const t of TABLAS) out[t] = await conv(await db.table(t).toArray())
  return out
}

const copiaJSON = (datos: Record<string, unknown[]>, version = 1) => strToU8(JSON.stringify({ app: 'JowyFit', version, creada: '2026-01-01T00:00:00.000Z', datos }))

describe('copia completa: cada tabla y cada campo', () => {
  beforeEach(sembrarTodo)

  it('las 16 tablas tienen una fila con todos sus campos', async () => {
    for (const t of TABLAS) expect(await db.table(t).count(), t).toBe(1)
  })
  it('exportar → borrar todo → importar deja cada campo igual (fotos, propias y campos nuevos incluidos)', async () => {
    const antes = await instantanea()
    const bytes = await exportar()
    for (const t of TABLAS) await db.table(t).clear()
    expect(await importar(bytes)).toBe('copia')
    expect(await instantanea()).toEqual(antes)
    // Campos nuevos (0.1.1 – 0.1.6) que tienen que sobrevivir.
    const p = (await db.perfil.get('yo'))!
    expect(p.dosisSuplementos).toEqual({ Creatina: '5 g' })
    expect(p.batido).toEqual({ proteina: 30, kcal: 150 })
    const a = (await db.ajustes.get('app'))!
    expect(a).toMatchObject({ fuenteBascula: 'auto', hcIgnorados: ['hc-borrada'], semanaSuave: '2026-10-05', suavePospuesta: '2026-09-28' })
    expect(a.informe).toEqual({ periodo: 'semana', secciones: { entrenos: true, comida: false, cuerpo: true, pasos: false, detalle: true } })
    const m = (await db.mediciones.toArray())[0]!
    expect(m.hc).toEqual(['hc-1', 'hc-2'])
    expect(m.fuente).toBe('com.fitdays.fitdays')
    const c = (await db.comidas.toArray())[0]!
    expect(c).toMatchObject({ suplemento: 'Batido de proteína', hidratos: 82.8, azucares: 9, grasas: 18, sal: 2.9 })
    expect(c.foto).toBeInstanceOf(Blob)
    expect((await db.plantillas.toArray())[0]!.foto).toBeInstanceOf(Blob)
    expect((await db.propios.toArray())[0]!.foto).toBeInstanceOf(Blob)
    expect((await db.sesiones.toArray())[0]!.suave).toBe(false)
    expect((await db.sesiones.toArray())[0]!.respuestas).toEqual(sesion.respuestas)
  })
  it('la copia es un zip con datos.json y un archivo por imagen (5: foto, máquina, plato, plantilla y ejercicio propio)', async () => {
    const ar = unzipSync(await exportar())
    const nombres = Object.keys(ar)
    expect(nombres).toContain('datos.json')
    expect(nombres.filter(n => n.startsWith('archivos/'))).toHaveLength(5)
    expect(nombres.some(n => n.endsWith('.png'))).toBe(true)
    const json = JSON.parse(strFromU8(ar['datos.json']!))
    // Trae revisiones y campos del generador v2: versión 3 (una app anterior pide actualizar en vez de perderlos).
    expect(json).toMatchObject({ app: 'JowyFit', version: 3 })
    expect(Object.keys(json.datos).sort()).toEqual([...TABLAS].sort())
    // Los Blob van como referencia al archivo, no como «{}».
    expect(json.datos.fotos[0].imagen).toMatchObject({ __archivo: expect.stringMatching(/^archivos\//), tipo: 'image/png' })
  })
  it('una copia sin comprimir (solo datos.json) también se restaura', async () => {
    const ar = unzipSync(await exportar())
    const sinFotos = JSON.parse(strFromU8(ar['datos.json']!))
    for (const t of TABLAS) await db.table(t).clear()
    expect(await importar(strToU8(JSON.stringify(sinFotos)))).toBe('copia')
    expect(await db.sesiones.count()).toBe(1)
    // Sin el zip no hay imágenes: la foto sin imagen no se restaura (la pantalla de fotos fallaba con ella).
    expect(await db.fotos.count()).toBe(0)
  })
  it('fallaba: una copia sin comprimir de una versión más nueva entraba sin avisar', async () => {
    const antes = await instantanea()
    await expect(importar(copiaJSON({ perfil: [] }, 4))).rejects.toThrow(/versión más nueva/)
    expect(await instantanea()).toEqual(antes)
  })
  it('una copia con un archivo de imagen que falta: la foto se queda fuera y el resto entra sin esa imagen', async () => {
    const ar = unzipSync(await exportar())
    const json = ar['datos.json']!
    for (const t of TABLAS) await db.table(t).clear()
    await importar(zipSync({ 'datos.json': json }))
    expect(await db.fotos.count()).toBe(0)
    expect((await db.gimnasios.toArray())[0]!.propias[0]!.foto).toBeUndefined()
  })
  it('restaurar sustituye todo: lo que había y no está en la copia desaparece', async () => {
    const bytes = await exportar()
    await db.comidas.add({ ...comidaFila, id: undefined, nombre: 'Después de la copia' })
    await importar(bytes)
    expect((await db.comidas.toArray()).map(c => c.nombre)).toEqual(['Arroz'])
  })
})

describe('copias viejas (sin los campos nuevos)', () => {
  beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })

  // Una copia de las primeras versiones: sin metas ni suplementos, sin macros, sin dosis, sin Health Connect y sin semana suave.
  const { dosisSuplementos: _d, batido: _b, ...perfilViejo } = perfil
  const { fuenteBascula: _f, hcIgnorados: _h, semanaSuave: _s, suavePospuesta: _p, ...ajustesViejos } = ajustes
  const vieja = {
    perfil: [perfilViejo],
    ajustes: [{ ...ajustesViejos, noti: { dormir: true, pesarse: false, pesarseHora: '07:00', copia: true } }],
    mediciones: [{ id: 1, fecha: '2026-09-01T07:00', origen: 'casa', pesoKg: 80, bascula: { grasaPct: 25 } }],
    sesiones: [{ id: 1, fecha: '2026-09-02', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 1, fin: 2, version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: [{ uid: 'b1', ejercicio: 'bench-press', planificado: 'bench-press', estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 120, registro: 'peso', series: [{ n: 1, peso: 40, reps: 12, rpe: 7, calentamiento: false, hecha: true }] }] }],
    comidas: [{ id: 1, fecha: '2026-09-02', hora: '14:00', franja: 'comida', nombre: 'Lentejas', kcal: 650, proteina: 32, racion: 'N', tipo: 'nota' }],
    plantillas: [{ id: 1, nombre: 'Batido', kcal: 120, proteina: 24, tipo: 'comida', usos: 1 }],
    productos: [{ codigo: '1', nombre: 'Yogur', marca: '', kcal100: 60, proteina100: 10, racionG: 125, kcalRacion: 75, proteinaRacion: 12.5, guardado: '2026-09-01' }],
    pasos: [{ fecha: '2026-09-02', pasos: 9000, fuente: 'manual' }],
    gimnasios: [{ id: 1, nombre: 'Gym', notas: '', material: [], propias: [], mancuernas: [], discos: [], barraKg: 20, creado: '2026-09-01' }],
    marcas: [], rutinas: [], fotos: [],
  }

  it('se importa (zip y sin comprimir) y las tablas que no traía quedan vacías', async () => {
    await db.metas.add({ ...meta, id: undefined })
    await db.propios.put(propio)
    expect(await importar(zipSync({ 'datos.json': copiaJSON(vieja) }))).toBe('copia')
    expect(await db.metas.count()).toBe(0)
    expect(await db.propios.count()).toBe(0)
    expect(await db.suplementos.count()).toBe(0)
    expect(await db.sesiones.count()).toBe(1)
    expect(await importar(copiaJSON(vieja))).toBe('copia')
    expect(await db.comidas.count()).toBe(1)
  })
  it('lo que falta se completa al leerlo y la app funciona con ello', async () => {
    await importar(copiaJSON(vieja))
    const a = await leerAjustes()
    expect(a.noti).toEqual({ ...ajustesPorDefecto().noti, dormir: true, pesarse: false })
    expect(a.semanaSuave).toBeNull()
    expect(a.suavePospuesta).toBeNull()
    expect(a.hcIgnorados).toBeUndefined()
    const p = (await db.perfil.get('yo'))!
    expect(p.dosisSuplementos).toBeUndefined()
    // Sugerencias y gasto del día con los datos viejos.
    const s = await sugerenciaPara('bench-press', { repsMin: 8, repsMax: 12, rpe: 8 })
    expect(s.accion).toBe('subir')
    expect(await gastoDelDia(p, '2026-09-02')).not.toBeNull()
  })
  it('una copia sin la tabla de ajustes no rompe al leer los ajustes', async () => {
    await importar(copiaJSON({ perfil: [{ id: 'yo', altaCompleta: true, nombre: 'Mínimo' }] }))
    expect((await db.perfil.get('yo'))!.nombre).toBe('Mínimo')
    expect(await leerAjustes()).toEqual(ajustesPorDefecto())
  })
  it('un perfil mínimo se completa con lo de siempre (antes dejaba la app en blanco)', async () => {
    await importar(copiaJSON({ perfil: [{ id: 'yo', altaCompleta: true }] }))
    const p = (await db.perfil.get('yo'))!
    expect(p).toMatchObject({ ...perfilPorDefecto(), creado: expect.any(String), altaCompleta: true })
  })
})

describe('perfil sencillo (data/perfil.ejemplo.json): todos los campos', () => {
  beforeEach(async () => { for (const t of TABLAS) await db.table(t).clear() })
  it('perfil, días, horas de vuelta, ayunas, suplementos y una medición completa', async () => {
    const datos = {
      perfil: { nacimiento: '2005-03-23', sexo: 'hombre', altura_cm: 177, preocupaciones: ['Quitar barriga', 5, 'Press de banca'] },
      logistica: { dias_fijos: ['martes', 'miércoles', 'domingo', 'nada'], vuelta_casa: { coche: '6:20', andando: '6:45' }, entrena_en_ayunas: false },
      alimentacion: { suplementos: { tiene: ['Creatina monohidrato', 'Proteína whey', 'Magnesio'] } },
      mediciones: [
        { fecha: '2026-10-13T07:05:00', origen: 'bascula_bioimpedancia', peso_kg: 79.1, grasa_pct: 24.2, masa_muscular_kg: 56.8, agua_pct: 54, grasa_visceral: 9, metabolismo_basal_kcal: 1700,
          perimetros_cm: { cintura_ombligo: 98, cuello: 38, cadera: null, biceps_relajado: 34, biceps_contraido: 36, muslo: 58 } },
        { origen: 'manual', peso_kg: 79.5 }, // sin fecha: ahora
        { fecha: 12345, peso_kg: 80 }, // fecha rara: fuera
        { fecha: '2026-10-01', peso_kg: 0, perimetros_cm: 'nada' }, // sin nada válido: no se guarda
        null,
      ],
    }
    expect(await importar(strToU8(JSON.stringify(datos)))).toBe('perfil')
    const p = (await db.perfil.get('yo'))!
    expect(p).toMatchObject({ nacimiento: '2005-03-23', sexo: 'hombre', alturaCm: 177, prioridades: ['Quitar barriga', 'Press de banca'], diasFijos: [1, 2, 6], enAyunas: false })
    expect(p.horaLimite).toEqual({ coche: '06:20', andando: '06:45' })
    expect(p.suplementos).toEqual(['Creatina', 'Batido de proteína'])
    const ms = (await db.mediciones.toArray()).sort((a, b) => a.fecha.localeCompare(b.fecha))
    expect(ms).toHaveLength(2)
    expect(ms[0]).toMatchObject({ fecha: '2026-10-13T07:05', origen: 'casa', pesoKg: 79.1, perimetros: { cintura: 98, cuello: 38, brazo: 34, brazoContraido: 36, muslo: 58 }, bascula: { grasaPct: 24.2, musculoKg: 56.8, aguaPct: 54, visceral: 9, basalKcal: 1700 } })
    expect(ms[1]).toMatchObject({ origen: 'manual', pesoKg: 79.5 })
    expect(ms[1]!.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
  it('sin vuelta en coche no toca las horas; sin vuelta andando pone las 7:00; perfil sin nada válido no cambia lo que hay', async () => {
    await importar(strToU8(JSON.stringify({ logistica: { vuelta_casa: { coche: '6:10' } } })))
    expect((await db.perfil.get('yo'))!.horaLimite).toEqual({ coche: '06:10', andando: '07:00' })
    await importar(strToU8(JSON.stringify({ perfil: { sexo: 'otro', altura_cm: -3, nacimiento: '23/03/2005' }, logistica: { vuelta_casa: { coche: 'pronto' } } })))
    const p = (await db.perfil.get('yo'))!
    expect(p.sexo).toBe('hombre')
    expect(p.alturaCm).toBe(perfilPorDefecto().alturaCm)
    expect(p.horaLimite.coche).toBe('06:10')
  })
  it('la plantilla de verdad (data/perfil.ejemplo.json) y el perfil inicial se importan sin romper', async () => {
    for (const f of ['perfil.ejemplo.json', 'perfil-inicial.json']) {
      const ruta = path.resolve(import.meta.dirname, '..', 'data', f)
      if (!fs.existsSync(ruta)) continue
      expect(await importar(new Uint8Array(fs.readFileSync(ruta)))).toBe('perfil')
    }
    expect(await db.perfil.count()).toBeLessThanOrEqual(1)
  })
})

describe('nombre del archivo de la copia', () => {
  it('jowyfit-AAAA-MM-DD-HHMM.jowyfit con la fecha y la hora locales', () => {
    expect(nombreCopia(new Date(2026, 9, 3, 23, 59))).toBe('jowyfit-2026-10-03-2359.jowyfit')
    expect(nombreCopia(new Date(2027, 0, 1, 0, 1))).toBe('jowyfit-2027-01-01-0001.jowyfit')
    expect(nombreCopia()).toMatch(/^jowyfit-\d{4}-\d{2}-\d{2}-\d{4}\.jowyfit$/)
  })
  it('si ya hay una copia con ese nombre, se añade -2, -3… (no se pisa)', () => {
    const f = new Date(2026, 9, 20, 7, 5)
    expect(nombreCopia(f, ['jowyfit-2026-10-20-0705.jowyfit'])).toBe('jowyfit-2026-10-20-0705-2.jowyfit')
    expect(nombreCopia(f, ['jowyfit-2026-10-20-0705.jowyfit', 'jowyfit-2026-10-20-0705-2.jowyfit'])).toBe('jowyfit-2026-10-20-0705-3.jowyfit')
  })
})

// La copia real del dueño (local, no va a git): si está, se importa y da dos vueltas sin perder nada.
const REAL = path.resolve(import.meta.dirname, '..', '.cache', 'JowyFit-mis-datos.jowyfit')
describe.skipIf(!fs.existsSync(REAL))('la copia real del dueño', () => {
  it('se importa y exportar → importar la deja igual', async () => {
    expect(await importar(new Uint8Array(fs.readFileSync(REAL)))).toBe('copia')
    const p = (await db.perfil.get('yo'))!
    expect(p.altaCompleta).toBe(true)
    expect(p.alturaCm).toBe(177)
    const antes = await instantanea()
    await importar(await exportar())
    expect(await instantanea()).toEqual(antes)
  })
})
