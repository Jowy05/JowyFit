// Copias de seguridad: un archivo .jowyfit (zip con datos.json y las fotos). Todo local.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db, TABLAS, type NombreTabla } from './db'
import { guardarPerfil } from './repos'
import type { Medicion, Perfil } from './tipos'

const VERSION = 1
type Fila = Record<string, unknown>

async function blobAU8(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer())
}

/** Crea la copia completa. Devuelve los bytes del zip. */
export async function exportar(): Promise<Uint8Array> {
  const datos: Record<string, Fila[]> = {}
  const archivos: Record<string, Uint8Array> = {}
  let n = 0
  for (const t of TABLAS) {
    const filas = (await db.table(t).toArray()) as Fila[]
    datos[t] = []
    for (const f of filas) {
      const copia: Fila = { ...f }
      for (const [k, v] of Object.entries(f)) {
        if (v instanceof Blob) {
          const ruta = `archivos/${t}-${n++}.${v.type.includes('png') ? 'png' : 'jpg'}`
          archivos[ruta] = await blobAU8(v)
          copia[k] = { __archivo: ruta, tipo: v.type }
        }
      }
      if (t === 'gimnasios' && Array.isArray(copia.propias)) {
        copia.propias = await Promise.all((copia.propias as Fila[]).map(async p => {
          if (p.foto instanceof Blob) {
            const ruta = `archivos/maquina-${n++}.jpg`
            archivos[ruta] = await blobAU8(p.foto)
            return { ...p, foto: { __archivo: ruta, tipo: (p.foto as Blob).type } }
          }
          return p
        }))
      }
      datos[t]!.push(copia)
    }
  }
  const json = JSON.stringify({ app: 'JowyFit', version: VERSION, creada: new Date().toISOString(), datos })
  return zipSync({ 'datos.json': strToU8(json), ...archivos }, { level: 6 })
}

export function nombreCopia(fecha = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0')
  return `jowyfit-${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}.jowyfit`
}

function revivir(v: unknown, archivos: Record<string, Uint8Array>): unknown {
  if (v && typeof v === 'object' && '__archivo' in (v as Fila)) {
    const r = v as { __archivo: string; tipo: string }
    const bytes = archivos[r.__archivo]
    return bytes ? new Blob([bytes as BlobPart], { type: r.tipo }) : undefined
  }
  if (Array.isArray(v)) return v.map(x => revivir(x, archivos))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revivir(x, archivos)]))
  return v
}

function leerJSON(texto: string): any {
  try {
    return JSON.parse(texto.replace(/^﻿/, ''))
  } catch {
    throw new Error('El archivo está dañado o no es una copia de JowyFit')
  }
}

/** Clave primaria de las tablas que no la generan solas: sin ella IndexedDB rechaza la fila. */
const CLAVE: Partial<Record<NombreTabla, string>> = { perfil: 'id', ajustes: 'id', marcas: 'id', productos: 'codigo', pasos: 'fecha', suplementos: 'fecha' }

/**
 * Comprueba la copia ANTES de tocar la base. Antes una copia con `datos: {}` (o con tablas que no eran
 * listas) vaciaba todo el móvil: se borraban las tablas y no había nada que poner.
 */
function validarDatos(datos: unknown): Record<string, Fila[]> {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('La copia está dañada: no tiene datos')
  const d = datos as Record<string, unknown>
  if (!TABLAS.some(t => Array.isArray(d[t]))) throw new Error('La copia está dañada: no tiene ninguna tabla de JowyFit')
  if (!Array.isArray(d.perfil)) throw new Error('La copia está incompleta: falta el perfil')
  for (const t of TABLAS) {
    const v = d[t]
    if (v == null) continue
    if (!Array.isArray(v)) throw new Error(`La copia está dañada (${t})`)
    const clave = CLAVE[t]
    for (const f of v) {
      if (!f || typeof f !== 'object' || Array.isArray(f)) throw new Error(`La copia está dañada (${t})`)
      if (clave && (typeof (f as Fila)[clave] !== 'string' || !(f as Fila)[clave])) throw new Error(`La copia está dañada (${t} sin ${clave})`)
      const id = (f as Fila).id
      if (!clave && id != null && (typeof id !== 'number' || !Number.isFinite(id))) throw new Error(`La copia está dañada (${t} con id raro)`)
    }
  }
  return d as Record<string, Fila[]>
}

function comprobarVersion(obj: { version?: unknown }) {
  if (typeof obj.version === 'number' && obj.version > VERSION) throw new Error('La copia es de una versión más nueva de JowyFit: actualiza la app')
}

/** Restaura una copia completa (sustituye todo) o importa un perfil en formato JSON sencillo. */
export async function importar(bytes: Uint8Array): Promise<'copia' | 'perfil'> {
  if (!bytes || !bytes.length) throw new Error('El archivo está vacío')
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!esZip) {
    const obj = leerJSON(new TextDecoder().decode(bytes))
    // La copia sin comprimir (datos.json suelto) también mira la versión: antes una de una versión más nueva entraba sin avisar.
    if (obj?.app === 'JowyFit') { comprobarVersion(obj); await restaurar(validarDatos(obj.datos), {}); return 'copia' }
    await importarPerfilSencillo(obj)
    return 'perfil'
  }
  let ar: Record<string, Uint8Array>
  try {
    ar = unzipSync(bytes)
  } catch {
    throw new Error('El archivo está dañado (no se puede descomprimir)')
  }
  const json = ar['datos.json']
  if (!json) throw new Error('El archivo no es una copia de JowyFit')
  const obj = leerJSON(strFromU8(json))
  if (obj?.app !== 'JowyFit') throw new Error('El archivo no es una copia de JowyFit')
  comprobarVersion(obj)
  await restaurar(validarDatos(obj.datos), ar)
  return 'copia'
}

async function restaurar(datos: Record<string, Fila[]>, archivos: Record<string, Uint8Array>) {
  await db.transaction('rw', TABLAS.map(t => db.table(t)), async () => {
    for (const t of TABLAS) {
      await db.table(t).clear()
      const filas = (datos[t as NombreTabla] ?? []).map(f => revivir(f, archivos))
      if (filas.length) await db.table(t).bulkPut(filas)
    }
  })
}

/** Formato de data/perfil.ejemplo.json: perfil + mediciones + logística + objetivos. */
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
/** Quita los campos sin número (la plantilla de ejemplo trae todo a null). Undefined si no queda nada. */
function soloNumeros<T extends Record<string, unknown>>(o: T): Partial<Record<keyof T, number>> | undefined {
  const out: Partial<Record<keyof T, number>> = {}
  for (const [k, v] of Object.entries(o)) { const n = numero(v); if (n != null) out[k as keyof T] = n }
  return Object.keys(out).length ? out : undefined
}
const dosCifras = (n: number) => String(n).padStart(2, '0')
const ahoraLocal = (d = new Date()) => `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}T${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`
const hora = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim().padStart(5, '0') : undefined)

async function importarPerfilSencillo(o: Record<string, any>) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || !(o.perfil || o.logistica || o.mediciones)) {
    throw new Error('El archivo no es una copia de JowyFit ni un perfil')
  }
  const p = o.perfil ?? {}
  const log = o.logistica ?? {}
  const cambios: Partial<Perfil> = {}
  if (p.nacimiento && /^\d{4}-\d{2}-\d{2}$/.test(p.nacimiento)) cambios.nacimiento = p.nacimiento
  if (p.sexo === 'hombre' || p.sexo === 'mujer') cambios.sexo = p.sexo
  if (typeof p.altura_cm === 'number' && p.altura_cm > 0) cambios.alturaCm = p.altura_cm
  if (Array.isArray(p.preocupaciones)) cambios.prioridades = p.preocupaciones.filter((x: unknown) => typeof x === 'string')
  const mapaDias: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, miércoles: 2, jueves: 3, viernes: 4, sabado: 5, sábado: 5, domingo: 6 }
  // «Lunes» o « martes » también valen; sin repetidos y en orden.
  if (Array.isArray(log.dias_fijos)) cambios.diasFijos = [...new Set<number>(log.dias_fijos.map((d: unknown) => mapaDias[String(d).trim().toLowerCase()]).filter((d: number | undefined) => d != null))].sort((a, b) => a - b) as Perfil['diasFijos']
  const coche = hora(log.vuelta_casa?.coche)
  if (coche) cambios.horaLimite = { coche, andando: hora(log.vuelta_casa.andando) ?? '07:00' }
  if (typeof log.entrena_en_ayunas === 'boolean') cambios.enAyunas = log.entrena_en_ayunas
  const supl = o.alimentacion?.suplementos?.tiene
  if (Array.isArray(supl)) cambios.suplementos = supl.filter((s: string) => /creatina|prote/i.test(s)).map((s: string) => (/creatina/i.test(s) ? 'Creatina' : 'Batido de proteína'))
  await guardarPerfil(cambios)
  for (const m of Array.isArray(o.mediciones) ? o.mediciones : []) {
    if (!m || typeof m !== 'object') continue
    // Fecha en hora local: «AAAA-MM-DD» → a las 8:00; sin fecha → ahora (antes se usaba la hora UTC,
    // que de madrugada caía en el día anterior). Una fecha que no es fecha («AAAA-MM-DD» de la plantilla) se descarta.
    let fecha: string
    if (m.fecha == null) fecha = ahoraLocal()
    else if (typeof m.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) fecha = `${m.fecha}T08:00`
    else if (typeof m.fecha === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(m.fecha)) fecha = m.fecha.slice(0, 16)
    else continue
    const med: Medicion = { fecha, origen: m.origen === 'cinta_metrica' ? 'cinta' : String(m.origen ?? '').includes('bascula') ? 'casa' : 'manual' }
    const peso = numero(m.peso_kg)
    if (peso != null && peso > 0) med.pesoKg = peso
    const pc = m.perimetros_cm
    // Antes un bloque de perímetros todo a null se guardaba igualmente como medición vacía.
    const perimetros = pc && typeof pc === 'object' ? soloNumeros({
      cintura: pc.cintura_ombligo, cuello: pc.cuello, cadera: pc.cadera, pecho: pc.pecho,
      brazo: pc.biceps_relajado, brazoContraido: pc.biceps_contraido, muslo: pc.muslo,
    }) : undefined
    if (perimetros) med.perimetros = perimetros
    const bascula = soloNumeros({
      grasaPct: m.grasa_pct, masaGrasaKg: m.masa_grasa_kg, masaLibreKg: m.masa_libre_grasa_kg, musculoKg: m.masa_muscular_kg, musculoEsqKg: m.musculo_esqueletico_kg,
      aguaPct: m.agua_pct, proteinaPct: m.proteina_pct, oseaKg: m.masa_osea_kg, visceral: m.grasa_visceral, subcutaneaPct: m.grasa_subcutanea_pct, basalKcal: m.metabolismo_basal_kcal, edadCorporal: m.edad_corporal,
    })
    if (bascula) med.bascula = bascula
    if (med.pesoKg != null || med.perimetros || med.bascula) await db.mediciones.add(med)
  }
}
