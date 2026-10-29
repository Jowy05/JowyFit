// Copias de seguridad: un archivo .jowyfit (zip con datos.json y las fotos). Todo local.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db, TABLAS, type NombreTabla } from './db'
import { ajustesPorDefecto, guardarPerfil, perfilPorDefecto } from './repos'
import { cargarPropios } from './acciones/propios'
import type { Medicion, Perfil } from './tipos'
import { comprobarCabecera, esHora, fechaValida, TIPOS_FOTO, validarDatos, versionNecesaria, type RefArchivo } from './validarCopia'
import { fechaDeCampo } from '../dominio/fechas'
import { t } from '../i18n'

type Fila = Record<string, unknown>

async function blobAU8(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer())
}

/** Crea la copia completa. Devuelve los bytes del zip. */
export async function exportar(): Promise<Uint8Array> {
  const datos: Record<string, Fila[]> = {}
  const archivos: Record<string, Uint8Array> = {}
  let n = 0
  for (const tb of TABLAS) {
    const filas = (await db.table(tb).toArray()) as Fila[]
    datos[tb] = []
    for (const f of filas) {
      const copia: Fila = { ...f }
      for (const [k, v] of Object.entries(f)) {
        if (v instanceof Blob) {
          const ruta = `archivos/${tb}-${n++}.${v.type.includes('png') ? 'png' : 'jpg'}`
          archivos[ruta] = await blobAU8(v)
          copia[k] = { __archivo: ruta, tipo: v.type }
        }
      }
      if (tb === 'gimnasios' && Array.isArray(copia.propias)) {
        copia.propias = await Promise.all((copia.propias as Fila[]).map(async p => {
          if (p.foto instanceof Blob) {
            const ruta = `archivos/maquina-${n++}.jpg`
            archivos[ruta] = await blobAU8(p.foto)
            return { ...p, foto: { __archivo: ruta, tipo: (p.foto as Blob).type } }
          }
          return p
        }))
      }
      datos[tb]!.push(copia)
    }
  }
  // Con ejercicios propios, versión 2: una app anterior avisa de que hay que actualizar en vez de perderlos sin decir nada.
  const version = versionNecesaria(datos)
  const json = JSON.stringify({ app: 'JowyFit', version, creada: new Date().toISOString(), datos })
  return zipSync({ 'datos.json': strToU8(json), ...archivos }, { level: 6 })
}

/**
 * Nombre del archivo de la copia, con la fecha y la hora: dos copias del mismo día no se pisan.
 * Si ya existe uno con ese nombre (dos en el mismo minuto), se añade «-2», «-3»…
 */
export function nombreCopia(fecha = new Date(), existentes?: Iterable<string>): string {
  const d = (n: number) => String(n).padStart(2, '0')
  const base = `jowyfit-${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}-${d(fecha.getHours())}${d(fecha.getMinutes())}`
  const usados = new Set(existentes ?? [])
  let nombre = `${base}.jowyfit`
  for (let i = 2; usados.has(nombre); i++) nombre = `${base}-${i}.jowyfit`
  return nombre
}

/**
 * Vuelve a hacer Blob una foto de la copia. El tipo ya viene comprobado (solo imágenes); si falta el archivo, nada.
 * Un mismo archivo da un solo Blob (`hechos`), aunque lo usen muchas filas.
 */
function revivir(v: unknown, archivos: Record<string, Uint8Array>, hechos: Map<string, Blob>): unknown {
  if (v && typeof v === 'object' && '__archivo' in (v as Fila)) {
    const r = v as RefArchivo
    const bytes = Object.prototype.hasOwnProperty.call(archivos, r.__archivo) ? archivos[r.__archivo] : undefined
    if (!bytes || !(TIPOS_FOTO as readonly string[]).includes(r.tipo)) return undefined
    const clave = `${r.__archivo}|${r.tipo}`
    const blob = hechos.get(clave) ?? new Blob([bytes as BlobPart], { type: r.tipo })
    hechos.set(clave, blob)
    return blob
  }
  if (Array.isArray(v)) return v.map(x => revivir(x, archivos, hechos))
  if (v && typeof v === 'object') {
    const out: Fila = {}
    for (const [k, x] of Object.entries(v)) {
      const r = revivir(x, archivos, hechos)
      if (r !== undefined) Object.defineProperty(out, k, { value: r, enumerable: true, writable: true, configurable: true })
    }
    return out
  }
  return v
}

function leerJSON(texto: string): unknown {
  try {
    return JSON.parse(texto.replace(/^﻿/, ''))
  } catch {
    throw new Error(t('El archivo está dañado o no es una copia de JowyFit'))
  }
}

// Límites al abrir una copia: una «bomba zip» de 400 KB puede ocupar 400 MB en memoria.
const MB = 1024 * 1024
export const LIMITES_ZIP = { archivo: 400 * MB, json: 50 * MB, foto: 30 * MB, total: 300 * MB, entradas: 20_000 }

/**
 * Abre el zip en dos pasos: primero solo datos.json; luego solo las fotos que usa, con su tamaño comprobado.
 * Un nombre repetido dentro del zip lo daña: se medía solo la última entrada y se descomprimían todas.
 */
function abrirZip(bytes: Uint8Array): { json: string; leerArchivos: (usos: Map<string, number>) => Record<string, Uint8Array> } {
  const tamanos = new Map<string, number>()
  let entradas = 0
  let repetido = false
  let ar: Record<string, Uint8Array>
  try {
    ar = unzipSync(bytes, {
      filter: f => {
        entradas++
        if (tamanos.has(f.name)) repetido = true
        tamanos.set(f.name, f.originalSize)
        return !repetido && f.name === 'datos.json' && f.originalSize <= LIMITES_ZIP.json
      },
    })
  } catch {
    throw new Error(t('El archivo está dañado (no se puede descomprimir)'))
  }
  if (repetido) throw new Error(t('El archivo está dañado (no se puede descomprimir)'))
  if (entradas > LIMITES_ZIP.entradas) throw new Error(t('El archivo no es una copia de JowyFit (tiene demasiados archivos dentro)'))
  if ((tamanos.get('datos.json') ?? 0) > LIMITES_ZIP.json) throw new Error(t('La copia es demasiado grande para abrirla'))
  const json = ar['datos.json']
  if (!json) throw new Error(t('El archivo no es una copia de JowyFit'))
  return {
    json: strFromU8(json),
    // Cada foto cuenta tantas veces como filas la usan: es lo que ocupará en la base del móvil.
    leerArchivos: usos => {
      let total = 0
      for (const [n, veces] of usos) {
        const tam = tamanos.get(n)
        if (tam == null) continue // falta: esa foto se queda fuera
        if (tam > LIMITES_ZIP.foto) throw new Error(t('La copia tiene una foto demasiado grande'))
        total += tam * veces
      }
      if (total > LIMITES_ZIP.total) throw new Error(t('La copia es demasiado grande para abrirla'))
      if (!usos.size) return {}
      try {
        return unzipSync(bytes, { filter: f => usos.has(f.name) && f.name !== 'datos.json' })
      } catch {
        throw new Error(t('El archivo está dañado (no se puede descomprimir)'))
      }
    },
  }
}

/** Restaura una copia completa (sustituye todo) o importa un perfil en formato JSON sencillo. */
export async function importar(bytes: Uint8Array): Promise<'copia' | 'perfil'> {
  if (!bytes || !bytes.length) throw new Error(t('El archivo está vacío'))
  if (bytes.length > LIMITES_ZIP.archivo) throw new Error(t('El archivo es demasiado grande para ser una copia de JowyFit'))
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!esZip) {
    if (bytes.length > LIMITES_ZIP.json) throw new Error(t('El archivo es demasiado grande para ser una copia de JowyFit'))
    const obj = leerJSON(new TextDecoder().decode(bytes))
    // La copia sin comprimir (datos.json suelto) también se comprueba entera.
    if (typeof obj === 'object' && obj !== null && 'app' in obj && obj.app === 'JowyFit') {
      comprobarCabecera(obj)
      await restaurar(validarDatos(obj.datos).tablas, {})
      return 'copia'
    }
    await importarPerfilSencillo(obj)
    return 'perfil'
  }
  const zip = abrirZip(bytes)
  const obj = leerJSON(zip.json)
  comprobarCabecera(obj)
  const { tablas, archivos } = validarDatos(obj.datos)
  await restaurar(tablas, zip.leerArchivos(archivos))
  return 'copia'
}

async function restaurar(datos: Record<NombreTabla, Fila[]>, archivos: Record<string, Uint8Array>) {
  const filas = {} as Record<NombreTabla, Fila[]>
  const hechos = new Map<string, Blob>()
  for (const tb of TABLAS) filas[tb] = (datos[tb] ?? []).map(f => revivir(f, archivos, hechos) as Fila)
  // Fotos cuyo archivo falta o no es una imagen: fuera (la pantalla de fotos falla con una foto sin imagen).
  filas.fotos = filas.fotos.filter(f => f.imagen instanceof Blob)
  // Lo que falte del perfil y de los ajustes (copias de versiones viejas) se completa con lo de siempre.
  filas.perfil = filas.perfil.map(p => ({ ...perfilPorDefecto(), ...p }))
  filas.ajustes = filas.ajustes.map(a => ({ ...ajustesPorDefecto(), ...a, noti: { ...ajustesPorDefecto().noti, ...(a.noti as object | undefined) } }))
  await db.transaction('rw', TABLAS.map(tb => db.table(tb)), async () => {
    for (const tb of TABLAS) {
      await db.table(tb).clear()
      if (filas[tb].length) await db.table(tb).bulkPut(filas[tb])
    }
  })
  // Restaurar desde la bienvenida no recarga la app: el catálogo tiene que ver ya los ejercicios propios de la copia.
  // Si fallara, la copia ya está puesta: se verán al volver a abrir la app.
  await cargarPropios().catch(() => undefined)
}

/**
 * «Borrar todos los datos»: borra la base entera (no tabla a tabla) para reiniciar también los contadores de
 * IndexedDB, que una copia con un id enorme puede dejar agotados (y ya no se podría apuntar nada).
 */
export async function borrarTodosLosDatos(): Promise<void> {
  try {
    await db.delete()
  } catch {
    await db.transaction('rw', TABLAS.map(tb => db.table(tb)), async () => { for (const tb of TABLAS) await db.table(tb).clear() })
  }
  try { localStorage.clear() } catch { /* nada */ }
}

/** Formato del perfil sencillo (un JSON escrito a mano): perfil + mediciones + logística + objetivos. */
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
/** Quita los campos sin número (la plantilla de ejemplo trae todo a null). Undefined si no queda nada. */
function soloNumeros<T extends Record<string, unknown>>(o: T): Partial<Record<keyof T, number>> | undefined {
  const out: Partial<Record<keyof T, number>> = {}
  for (const [k, v] of Object.entries(o)) { const n = numero(v); if (n != null) out[k as keyof T] = n }
  return Object.keys(out).length ? out : undefined
}
const dosCifras = (n: number) => String(n).padStart(2, '0')
const ahoraLocal = (d = new Date()) => `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}T${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`
// Con las mismas reglas que la copia completa: si no, lo importado aquí luego no dejaría recuperar la copia.
const hora = (v: unknown): string | undefined => (typeof v === 'string' && esHora(v.trim()) ? v.trim().padStart(5, '0') : undefined)

async function importarPerfilSencillo(v: unknown) {
  // Formato libre: comprobado que es un objeto, cada campo se mira uno a uno antes de usarlo.
  const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, any>
  if (!(o.perfil || o.logistica || o.mediciones)) {
    throw new Error(t('El archivo no es una copia de JowyFit ni un perfil'))
  }
  const p = o.perfil ?? {}
  const log = o.logistica ?? {}
  const cambios: Partial<Perfil> = {}
  if (typeof p.nacimiento === 'string' && fechaDeCampo(p.nacimiento) && fechaValida(p.nacimiento)) cambios.nacimiento = p.nacimiento
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
    // Fecha en hora local (en UTC, de madrugada cae en el día anterior): «AAAA-MM-DD» → a las 8:00; sin fecha → ahora.
    // Una fecha que no es fecha («AAAA-MM-DD» de la plantilla) se descarta.
    let fecha: string
    if (m.fecha == null) fecha = ahoraLocal()
    else if (typeof m.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.fecha) && fechaValida(m.fecha)) fecha = `${m.fecha}T08:00`
    else if (typeof m.fecha === 'string' && fechaValida(m.fecha.slice(0, 16))) fecha = m.fecha.slice(0, 16)
    else continue
    const med: Medicion = { fecha, origen: m.origen === 'cinta_metrica' ? 'cinta' : String(m.origen ?? '').includes('bascula') ? 'casa' : 'manual' }
    const peso = numero(m.peso_kg)
    if (peso != null && peso > 0) med.pesoKg = peso
    const pc = m.perimetros_cm
    // Un bloque de perímetros todo a null no se guarda como medición vacía.
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
