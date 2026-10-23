// Datos de ejemplo del informe: el mes del diseño (21 sep – 20 oct de 2026), un día con 4 semanas de antes
// y las piezas para montar casos (series, ejercicios, sesiones, medidas y comidas).
import type { Ajustes, Comida, DiaRutina, EjercicioSesion, Medicion, Meta, PasosDia, Perfil, Rutina, Serie, Sesion } from '../src/datos/tipos'
import type { CatalogoInforme, EntradaInforme } from '../src/informe/calculo/tipos'
import { diasDe } from '../src/informe/calculo/comun'

export const NOMBRES: Record<string, string> = {
  'bench-press': 'Press de banca', 'leg-press': 'Prensa de piernas', 'lat-pulldown': 'Jalón al pecho', 'seated-cable-row': 'Remo sentado en polea',
  'romanian-deadlift': 'Peso muerto rumano', 'bicep-curl': 'Curl de bíceps', 'cable-crunch': 'Crunch en polea', 'tricep-pushdown': 'Jalón de tríceps en polea',
  'lateral-raise': 'Elevaciones laterales en polea', 'assisted-pull-up': 'Dominada asistida', plank: 'Plancha', 'push-up': 'Flexiones',
}

export const PATRONES: Record<string, string> = {
  'bench-press': 'empuje-h', 'leg-press': 'rodilla', 'lat-pulldown': 'tiron-v', 'seated-cable-row': 'tiron-h', 'romanian-deadlift': 'cadera',
  'bicep-curl': 'biceps', 'cable-crunch': 'core', 'tricep-pushdown': 'triceps', 'lateral-raise': 'hombro-lat',
}

export const CAT: CatalogoInforme = { nombre: id => NOMBRES[id] ?? id, patron: id => PATRONES[id], met: id => (id === 'plank' ? null : 5) }

export const S = (peso: number | null, reps: number | null, rpe: number | null = null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe, calentamiento: false, hecha: true, ...x })

export const E = (id: string, series: Serie[], x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid: id, ejercicio: id, planificado: id, estado: 'hecho', series: series.map((s, i) => ({ ...s, n: i + 1 })), repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x,
})

let siguienteId = 1

/** Los ids de las sesiones que se crean a partir de ahora (cada caso usa los suyos). */
export function idsDesde(n: number) { siguienteId = n }

export const LETRA: Record<number, string> = { 1: 'A', 3: 'B', 4: 'C' }

export function SES(fecha: string, ejs: EjercicioSesion[], x: Partial<Sesion> = {}): Sesion {
  const inicio = new Date(`${fecha}T05:30:00`).getTime()
  const letra = LETRA[(new Date(`${fecha}T12:00:00`).getDay() + 6) % 7] ?? 'L'
  return { id: siguienteId++, fecha, rutinaId: 1, letra, nombre: letra === 'L' ? 'Entreno libre' : `Cuerpo completo ${letra}`, gimnasioId: null, inicio, fin: inicio + 60 * 60_000, version: 'normal', estado: 'hecha', calibracion: false, ejercicios: ejs, ...x }
}

export const diaR = (letra: string, d: number | null, opcional = false): DiaRutina => ({ letra, nombre: `Cuerpo completo ${letra}`, dia: d as DiaRutina['dia'], opcional, bloques: [] })

export const RUTINA: Rutina = { id: 1, creada: '2026-09-01T10:00:00.000Z', activa: true, estructura: 'Cuerpo completo · 3 días', porque: [], calibracion: false, gimnasioId: null, dias: [diaR('A', 1), diaR('B', 3), diaR('C', 4), diaR('S', 5, true)] }

export const PERFIL = {
  id: 'yo', creado: '2026-09-01', altaCompleta: true, nombre: 'Joel', nacimiento: '2005-03-23', sexo: 'hombre', alturaCm: 177, objetivo: 'recomposicion',
  pasosObjetivo: 10_000, diasFijos: [1, 3, 4], trabajo: 'sentado',
} as Perfil

export const AJUSTES = { id: 'app', cafeinaLimite: 400, kcalManual: 1850, proteinaManual: 140, recolocadas: [] } as unknown as Ajustes

export const MED = (fecha: string, x: Partial<Medicion>): Medicion => ({ fecha: `${fecha}T07:00:00`, origen: 'casa', ...x })

export const COM = (fecha: string, hora: string, franja: Comida['franja'], nombre: string, kcal: number, proteina: number, x: Partial<Comida> = {}): Comida => ({ fecha, hora, franja, nombre, kcal, proteina, racion: 'N', tipo: 'plantilla', ...x })

export const AHORA = new Date('2026-10-20T22:30:00')

export function entrada(x: Partial<EntradaInforme> = {}): EntradaInforme {
  return { perfil: PERFIL, ajustes: AJUSTES, mediciones: [], sesiones: [], rutina: RUTINA, comidas: [], suplementos: [], pasos: [], metas: [], periodo: 'mes', ahora: AHORA, catalogo: CAT, ...x }
}

/** El mes del ejemplo del diseño: 21 sep – 20 oct de 2026, martes A, jueves B y viernes C, semana de prueba al principio y un viernes perdido. */
export function mesDeEjemplo() {
  siguienteId = 1
  const fechas = ['2026-09-22', '2026-09-24', '2026-09-25', '2026-09-29', '2026-10-01', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-20']
  const pesos: Record<string, number[]> = {
    'bench-press': [40, 42.5, 45, 47.5, 50, 50, 52.5, 55], 'leg-press': [80, 90, 90, 100, 110, 110, 115, 120], 'lat-pulldown': [40, 42.5, 45, 47.5, 47.5],
    'seated-cable-row': [40, 45, 45, 50], 'romanian-deadlift': [40, 45, 50, 55], 'bicep-curl': [10, 12, 12, 14], 'cable-crunch': [20, 25, 25],
  }
  const vez: Record<string, number> = {}
  const maximo: Record<string, number> = {}
  let marcados = 0
  const ej = (id: string, prueba: boolean): EjercicioSesion => {
    const i = vez[id] ?? 0
    vez[id] = i + 1
    const p = pesos[id]![i]!
    const record = maximo[id] != null && p > maximo[id]!
    if (record) marcados++
    maximo[id] = Math.max(maximo[id] ?? 0, p)
    const r = prueba ? 7 : id === 'bicep-curl' ? 9 : 8
    const series = [S(p, 8, null), S(p, 8, r), S(p, 8, r, { record })]
    if (id === 'bench-press') series.unshift(S(20, 10, 5, { calentamiento: true }))
    return E(id, series, { rpe: prueba ? 7 : 8 })
  }
  const sesiones = fechas.map((f, k) => {
    const d = (new Date(`${f}T12:00:00`).getDay() + 6) % 7
    const prueba = k < 3
    const ids = d === 1 ? ['bench-press', 'leg-press', 'lat-pulldown'] : d === 3 ? ['seated-cable-row', 'romanian-deadlift', 'bicep-curl'] : ['bench-press', 'leg-press', 'cable-crunch']
    return SES(f, ids.map(id => ej(id, prueba)), { calibracion: prueba })
  })
  // Una sesión sin hora de fin (cuenta lo que dijo al terminar) y una cancelada (no cuenta).
  sesiones[3] = { ...sesiones[3]!, fin: undefined, respuestas: { minutosReales: 61 } }
  sesiones.push(SES('2026-10-13', [E('bench-press', [S(100, 10, 10)])], { estado: 'cancelada' }))
  const mediciones: Medicion[] = [
    MED('2026-09-13', { pesoKg: 81 }),
    MED('2026-09-21', { pesoKg: 80.6, bascula: { grasaPct: 25 }, perimetros: { cintura: 99.5, cuello: 39 } }),
    MED('2026-09-28', { pesoKg: 80.2 }),
    MED('2026-10-05', { pesoKg: 79.8, bascula: { grasaPct: 24.8 }, perimetros: { cintura: 99 } }),
    MED('2026-10-12', { pesoKg: 79.4, bascula: { grasaPct: 24.5 } }),
    MED('2026-10-20', { pesoKg: 79.1, bascula: { grasaPct: 24.3, basalKcal: 1665, musculoKg: 56, aguaPct: 55.6, visceral: 7, edadCorporal: 22 }, perimetros: { cintura: 98 } }),
  ]
  const comidas: Comida[] = []
  const pasos: PasosDia[] = []
  for (const f of diasDe('2026-09-21', '2026-10-20')) {
    const n = Number(f.slice(8))
    pasos.push({ fecha: f, pasos: n % 3 === 0 ? 11_000 : 8000, fuente: 'manual', ...(f === '2026-09-26' ? { troteKm: 3 } : {}) })
    if (f === '2026-09-23' || f === '2026-10-04') continue
    comidas.push(COM(f, '07:30', 'desayuno', 'Batido de proteína', 120, 24, { tipo: 'bebida' }))
    comidas.push(COM(f, '06:50', 'desayuno', 'Café', 5, 0, { cafeina: 80, tipo: 'bebida' }))
    comidas.push(COM(f, '14:10', 'comida', 'Pollo teriyaki', 1100, n % 2 ? 90 : 70))
    comidas.push(COM(f, '21:15', 'cena', 'Arroz con atún', 600, 20))
    if (n % 5 === 0) comidas.push(COM(f, '17:45', 'merienda', 'Quicos', 150, 3, { tipo: 'picoteo', racion: 'P' }))
  }
  comidas.push(COM('2026-10-01', '18:20', 'merienda', 'Monster', 230, 0, { cafeina: 400, tipo: 'bebida', hidratos: 56, azucares: 55 }))
  const metas: Meta[] = [
    { id: 1, tipo: 'cintura', titulo: 'Cintura por debajo de 88 cm', objetivo: 88, unidad: 'cm', inicio: 99.5, fecha: '2027-06-30' },
    { id: 2, tipo: 'ejercicio', titulo: 'Press de banca: 65 kg × 5', objetivo: 65, unidad: 'kg', inicio: 40, ejercicio: 'bench-press', fecha: '2027-06-30' },
    { id: 3, tipo: 'grasa', titulo: 'Grasa al 18 %', objetivo: 18, unidad: '%', inicio: 25, fecha: '2027-06-30' },
    { id: 4, tipo: 'dominadas', titulo: '5 dominadas estrictas', objetivo: 5, unidad: 'reps', fecha: '2027-06-30' },
    { id: 5, tipo: 'libre', titulo: 'Ir andando al trabajo', objetivo: 1, unidad: '', hecha: true },
  ]
  return { sesiones, mediciones, comidas, pasos, metas, marcados }
}

/** El día de la página 5 del diseño: martes 20 de octubre, con 4 semanas de historial detrás. */
export function diaDeEjemplo(extra: Partial<Sesion> = {}) {
  siguienteId = 100
  const ant = ['2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16']
  const banca = [47.5, 50, 50, 52.5]
  const curl = [13, 13, 13, 14]
  const previas = ant.map((f, i) => SES(f, [
    E('bench-press', [S(banca[i]!, 8, 8), S(banca[i]!, 8, 8)]),
    E('lat-pulldown', [S(47.5, 8, 8), S(47.5, 8, 8)]),
    E('bicep-curl', [S(curl[i]!, 10, 8.5)]),
    E('tricep-pushdown', [S(27.5, 12)]),
    E('assisted-pull-up', [S(-20, 6)], { registro: 'asistido' }),
    E('leg-press', [S(110, 10, 7.5)]),
  ]))
  const hoy = SES('2026-10-20', [
    E('bench-press', [S(20, 10, 5, { calentamiento: true }), S(55, 6, 9, { record: true }), S(52.5, 8, 9)]),
    E('lat-pulldown', [S(47.5, 10, 7), S(47.5, 9, 7)]),
    E('bicep-curl', [S(12, 10, 9)]),
    E('tricep-pushdown', [S(27.5, 12)]),
    E('lateral-raise', [S(7.5, 12, 8)]),
    E('assisted-pull-up', [S(-15, 6)], { registro: 'asistido' }),
    E('leg-press', [S(110, 10, 8.5)]),
  ], { ...extra })
  const mediciones = [
    MED('2026-10-14', { pesoKg: 79.4 }), MED('2026-10-17', { pesoKg: 79.2 }),
    MED('2026-10-13', { perimetros: { cintura: 98 } }),
    MED('2026-10-20', { pesoKg: 79.1, bascula: { grasaPct: 24.3 } }),
  ]
  const comidas: Comida[] = []
  for (const f of diasDe('2026-09-22', '2026-10-19')) comidas.push(COM(f, '14:00', 'comida', 'Comida', 1800, 131))
  comidas.push(
    COM('2026-10-20', '06:50', 'desayuno', 'Café', 5, 0, { cafeina: 80, tipo: 'bebida' }),
    COM('2026-10-20', '14:10', 'comida', 'Pollo teriyaki', 1465, 112),
    COM('2026-10-20', '17:45', 'merienda', 'Quicos', 150, 3, { tipo: 'picoteo', racion: 'P' }),
    COM('2026-10-20', '18:20', 'merienda', 'Monster', 230, 0, { cafeina: 160, tipo: 'bebida' }),
  )
  const pasos: PasosDia[] = diasDe('2026-09-22', '2026-10-19').map(f => ({ fecha: f, pasos: 8420, fuente: 'manual' }))
  pasos.push({ fecha: '2026-10-20', pasos: 6240, fuente: 'manual' })
  return { sesiones: [...previas, hoy], mediciones, comidas, pasos }
}
