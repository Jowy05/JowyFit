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

/** Restaura una copia completa (sustituye todo) o importa un perfil en formato JSON sencillo. */
export async function importar(bytes: Uint8Array): Promise<'copia' | 'perfil'> {
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!esZip) {
    const obj = JSON.parse(new TextDecoder().decode(bytes))
    if (obj?.app === 'JowyFit' && obj.datos) { await restaurar(obj.datos, {}); return 'copia' }
    await importarPerfilSencillo(obj)
    return 'perfil'
  }
  const ar = unzipSync(bytes)
  const json = ar['datos.json']
  if (!json) throw new Error('El archivo no es una copia de JowyFit')
  const obj = JSON.parse(strFromU8(json))
  if (obj?.app !== 'JowyFit') throw new Error('El archivo no es una copia de JowyFit')
  await restaurar(obj.datos, ar)
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
async function importarPerfilSencillo(o: Record<string, any>) {
  const p = o.perfil ?? {}
  const log = o.logistica ?? {}
  const cambios: Partial<Perfil> = {}
  if (p.nacimiento && /^\d{4}-\d{2}-\d{2}$/.test(p.nacimiento)) cambios.nacimiento = p.nacimiento
  if (p.sexo === 'hombre' || p.sexo === 'mujer') cambios.sexo = p.sexo
  if (typeof p.altura_cm === 'number') cambios.alturaCm = p.altura_cm
  if (Array.isArray(p.preocupaciones)) cambios.prioridades = p.preocupaciones
  const mapaDias: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, miércoles: 2, jueves: 3, viernes: 4, sabado: 5, sábado: 5, domingo: 6 }
  if (Array.isArray(log.dias_fijos)) cambios.diasFijos = log.dias_fijos.map((d: string) => mapaDias[d]).filter((d: number | undefined) => d != null)
  if (log.vuelta_casa?.coche) cambios.horaLimite = { coche: log.vuelta_casa.coche.padStart(5, '0'), andando: (log.vuelta_casa.andando ?? '07:00').padStart(5, '0') }
  if (typeof log.entrena_en_ayunas === 'boolean') cambios.enAyunas = log.entrena_en_ayunas
  const supl = o.alimentacion?.suplementos?.tiene
  if (Array.isArray(supl)) cambios.suplementos = supl.filter((s: string) => /creatina|prote/i.test(s)).map((s: string) => (/creatina/i.test(s) ? 'Creatina' : 'Batido de proteína'))
  await guardarPerfil(cambios)
  for (const m of o.mediciones ?? []) {
    const med: Medicion = { fecha: String(m.fecha ?? new Date().toISOString()).length === 10 ? `${m.fecha}T08:00` : m.fecha, origen: m.origen === 'cinta_metrica' ? 'cinta' : String(m.origen ?? '').includes('bascula') ? 'casa' : 'manual' }
    if (typeof m.peso_kg === 'number') med.pesoKg = m.peso_kg
    if (m.perimetros_cm) med.perimetros = {
      cintura: m.perimetros_cm.cintura_ombligo, cuello: m.perimetros_cm.cuello, cadera: m.perimetros_cm.cadera, pecho: m.perimetros_cm.pecho,
      brazo: m.perimetros_cm.biceps_relajado, brazoContraido: m.perimetros_cm.biceps_contraido, muslo: m.perimetros_cm.muslo,
    }
    if (m.grasa_pct != null || m.masa_muscular_kg != null) med.bascula = {
      grasaPct: m.grasa_pct, masaGrasaKg: m.masa_grasa_kg, masaLibreKg: m.masa_libre_grasa_kg, musculoKg: m.masa_muscular_kg, musculoEsqKg: m.musculo_esqueletico_kg,
      aguaPct: m.agua_pct, proteinaPct: m.proteina_pct, oseaKg: m.masa_osea_kg, visceral: m.grasa_visceral, subcutaneaPct: m.grasa_subcutanea_pct, basalKcal: m.metabolismo_basal_kcal, edadCorporal: m.edad_corporal,
    }
    if (med.pesoKg != null || med.perimetros || med.bascula) await db.mediciones.add(med)
  }
}
