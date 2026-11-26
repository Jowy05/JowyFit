// Exportación ligera en CSV (para Excel/Sheets) y JSON sin imágenes ni blobs.
// Todas las celdas CSV se escapan según RFC-4180 y neutralizan inyección de fórmulas (=, +, -, @, TAB, CR).
import type { Comida, Gimnasio, IntentoReto, Medicion, Meta, PasosDia, Perfil, Rutina, Sesion } from '../datos/tipos'
import { t } from '../i18n'

const NUMERO_PURO = /^-?\d+(\.\d+)?$/
const PELIGRO_FORMULA = /^[=+\-@\t\r]/

/** Escapa una celda CSV (RFC-4180) neutralizando fórmulas para evitar CSV injection en Excel/LibreOffice. */
export function escaparCSV(valor: unknown): string {
  if (valor == null) return ''
  let s = typeof valor === 'boolean' ? (valor ? '1' : '0') : String(valor)
  if (s && PELIGRO_FORMULA.test(s) && !NUMERO_PURO.test(s)) s = `'${s}`
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Serializa una tabla a CSV UTF-8 con BOM para que Excel abra acentos y eñes correctamente. */
export function aCSV(cabeceras: string[], filas: unknown[][]): string {
  const lineas = [cabeceras.map(escaparCSV).join(','), ...filas.map(f => f.map(escaparCSV).join(','))]
  return `\uFEFF${lineas.join('\r\n')}\r\n`
}

/** CSV de entrenos: una fila por serie de trabajo o calentamiento en sesiones terminadas. */
export function csvEntrenos(sesiones: Sesion[], nombreEj: (id: string) => string): string {
  const cab = [
    t('Fecha'), t('Entreno'), t('Ejercicio'), t('Registro'), t('Serie'), t('Calentamiento'),
    t('Peso (kg)'), t('Reps'), t('Segundos'), t('Km'), t('Esfuerzo'), t('Récord'), t('Nota'),
  ]
  const filas: unknown[][] = []
  const ordenadas = sesiones.filter(s => s.estado === 'hecha').sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio)
  for (const s of ordenadas) {
    for (const e of s.ejercicios) {
      const nombre = nombreEj(e.ejercicio)
      for (const x of e.series) {
        if (!x.hecha) continue
        filas.push([
          s.fecha, s.nombre, nombre, e.registro, x.n, x.calentamiento ? t('Sí') : t('No'),
          x.peso ?? '', x.reps ?? '', x.segundos ?? '', x.km ?? '', x.rpe ?? '',
          x.record ? t('Sí') : t('No'), x.nota ?? '',
        ])
      }
    }
  }
  return aCSV(cab, filas)
}

/** CSV de comidas apuntadas. */
export function csvComidas(comidas: Comida[]): string {
  const cab = [
    t('Fecha'), t('Hora'), t('Franja'), t('Nombre'), t('Tipo'), t('Ración'),
    'kcal', t('Proteína (g)'), t('Cafeína (mg)'), t('Hidratos (g)'), t('Azúcares (g)'), t('Grasas (g)'), t('Sal (g)'),
  ]
  const ordenadas = [...comidas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
  const filas = ordenadas.map(c => [
    c.fecha, c.hora, c.franja, c.nombre, c.tipo, c.racion,
    Math.round(c.kcal), Math.round(c.proteina), c.cafeina ?? '',
    c.hidratos ?? '', c.azucares ?? '', c.grasas ?? '', c.sal ?? '',
  ])
  return aCSV(cab, filas)
}

/** CSV de mediciones corporales (peso, perímetros y báscula). */
export function csvMedidas(mediciones: Medicion[]): string {
  const cab = [
    t('Fecha'), t('Origen'), t('Peso (kg)'), t('Grasa (%)'), t('Cintura (cm)'), t('Cuello (cm)'), t('Cadera (cm)'),
    t('Pecho (cm)'), t('Brazo (cm)'), t('Muslo (cm)'), t('Músculo (kg)'), t('Agua (%)'), t('Visceral'), t('Basal (kcal)'),
  ]
  const ordenadas = [...mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const filas = ordenadas.map(m => [
    m.fecha, m.origen, m.pesoKg ?? '', m.bascula?.grasaPct ?? '',
    m.perimetros?.cintura ?? '', m.perimetros?.cuello ?? '', m.perimetros?.cadera ?? '',
    m.perimetros?.pecho ?? '', m.perimetros?.brazo ?? '', m.perimetros?.muslo ?? '',
    m.bascula?.musculoKg ?? '', m.bascula?.aguaPct ?? '', m.bascula?.visceral ?? '', m.bascula?.basalKcal ?? '',
  ])
  return aCSV(cab, filas)
}

function quitarBlobs(v: unknown): unknown {
  if (typeof Blob !== 'undefined' && v instanceof Blob) return undefined
  if (Array.isArray(v)) return v.map(quitarBlobs).filter(x => x !== undefined)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      const limpio = quitarBlobs(x)
      if (limpio !== undefined) out[k] = limpio
    }
    return out
  }
  return v
}

export type DatosExportLigero = {
  perfil: Perfil | null
  mediciones: Medicion[]
  sesiones: Sesion[]
  comidas: Comida[]
  pasos: PasosDia[]
  metas: Meta[]
  retos: IntentoReto[]
  rutina: Rutina | null
  gimnasios: Gimnasio[]
}

/** JSON ligero y legible (sin fotos ni archivos binarios) para analizar o archivar fuera de la app. */
export function jsonLigero(datos: DatosExportLigero, ahora = new Date()): string {
  return JSON.stringify({
    app: 'JowyFit',
    formato: 'ligero',
    exportado: ahora.toISOString(),
    datos: quitarBlobs(datos),
  }, null, 2)
}
