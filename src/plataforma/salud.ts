// Health Connect (solo Android): pasos del reloj y peso y % de grasa de la báscula (se leen) y los entrenos (se escriben).
import { registerPlugin } from '@capacitor/core'
import { esAndroid } from './dispositivo'

export async function pasosDisponibles(): Promise<boolean> {
  if (!esAndroid()) return false
  try {
    const { Health } = await import('@capgo/capacitor-health')
    return (await Health.isAvailable()).available
  } catch { return false }
}

export async function pedirPermisoPasos(): Promise<boolean> {
  // En la web no hay Health Connect: nunca se da el permiso por bueno.
  if (!esAndroid()) return false
  try {
    const { Health } = await import('@capgo/capacitor-health')
    const r = await Health.requestAuthorization({ read: ['steps'] })
    return (r as unknown as { readAuthorized?: string[] }).readAuthorized?.includes('steps') ?? true
  } catch { return false }
}

/** Pasos por día entre dos fechas (AAAA-MM-DD, ambas incluidas). */
export async function leerPasos(desde: string, hasta: string): Promise<Record<string, number>> {
  const { Health } = await import('@capgo/capacitor-health')
  const ini = new Date(`${desde}T00:00:00`)
  const fin = new Date(`${hasta}T00:00:00`); fin.setDate(fin.getDate() + 1)
  const r = await Health.queryAggregated({ dataType: 'steps', startDate: ini.toISOString(), endDate: fin.toISOString(), bucket: 'day' as never })
  const out: Record<string, number> = {}
  for (const s of r.samples) {
    const d = new Date(s.startDate)
    out[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = Math.round(s.value)
  }
  return out
}

/** Pide leer el peso y la grasa. Devuelve si al menos el peso quedó permitido. */
export async function pedirPermisoBascula(): Promise<boolean> {
  // En la web no hay Health Connect: nunca se da el permiso por bueno.
  if (!esAndroid()) return false
  try {
    const { Health } = await import('@capgo/capacitor-health')
    const r = await Health.requestAuthorization({ read: ['weight', 'bodyFat'] })
    return (r as unknown as { readAuthorized?: string[] }).readAuthorized?.includes('weight') ?? true
  } catch { return false }
}

/** Pide de una vez leer los pasos, el peso y la grasa. Devuelve lo que quedó permitido. */
export async function pedirPermisosSalud(): Promise<string[]> {
  try {
    const { Health } = await import('@capgo/capacitor-health')
    const r = await Health.requestAuthorization({ read: ['steps', 'weight', 'bodyFat'] })
    return (r as unknown as { readAuthorized?: string[] }).readAuthorized ?? []
  } catch { return [] }
}

/** Abre Health Connect (para dar o quitar permisos, o instalarlo si falta). */
export async function abrirHealthConnect(): Promise<boolean> {
  try {
    const { Health } = await import('@capgo/capacitor-health')
    await Health.openHealthConnectSettings()
    return true
  } catch { return false }
}

/** Qué deja leer Health Connect ahora mismo (pasos, peso, grasa). */
export async function permisosSalud(): Promise<string[]> {
  try {
    const { Health } = await import('@capgo/capacitor-health')
    const r = await Health.checkAuthorization({ read: ['steps', 'weight', 'bodyFat'] })
    return (r as unknown as { readAuthorized?: string[] }).readAuthorized ?? []
  } catch { return [] }
}

type MuestraBascula = { fecha: string; valor: number; id?: string; fuente?: string }
/** Pesos (kg) y % de grasa escritos en Health Connect desde una fecha. Si falta un permiso, esa parte llega vacía. */
export async function leerBascula(desde: Date): Promise<{ pesos: MuestraBascula[]; grasas: MuestraBascula[] }> {
  const { Health } = await import('@capgo/capacitor-health')
  const leer = async (dataType: 'weight' | 'bodyFat') => {
    try {
      const r = await Health.readSamples({ dataType, startDate: desde.toISOString(), endDate: new Date().toISOString(), limit: 500, ascending: true })
      return r.samples.map(x => ({ fecha: x.startDate, valor: x.value, id: x.platformId, fuente: x.sourceName }))
    } catch { return [] }
  }
  return { pesos: await leer('weight'), grasas: await leer('bodyFat') }
}

// Entrenos hacia Health Connect. @capgo/capacitor-health (8.11) solo lee sesiones de ejercicio: no sabe escribirlas.
// Lo hace un plugin propio de la app (android/app/…/EntrenosSalud.java) con el mismo cliente de Health Connect.
type PermisosEntrenos = { sesion: boolean; calorias: boolean }
/** Un entreno terminado tal como va a Health Connect: marcas de tiempo en milisegundos y kcal solo si se saben. */
export type EntrenoSalud = { id: string; inicio: number; fin: number; titulo: string; kcal?: number }
type PluginEntrenos = {
  permisos(): Promise<PermisosEntrenos>
  pedirPermiso(): Promise<PermisosEntrenos>
  guardar(e: EntrenoSalud): Promise<{ calorias: boolean }>
  borrar(o: { id: string }): Promise<void>
}
const EntrenosSalud = registerPlugin<PluginEntrenos>('EntrenosSalud')

/** Pide guardar los entrenos (y sus kcal) en Health Connect. Devuelve si al menos la sesión quedó permitida. */
export async function pedirPermisoEntrenos(): Promise<boolean> {
  if (!esAndroid()) return false
  try { return (await EntrenosSalud.pedirPermiso()).sesion } catch { return false }
}

/** Si Health Connect deja guardar los entrenos ahora mismo (el permiso se puede quitar desde Health Connect). */
export async function permisoEntrenos(): Promise<boolean> {
  if (!esAndroid()) return false
  try { return (await EntrenosSalud.permisos()).sesion } catch { return false }
}

/**
 * Guarda un entreno en Health Connect como sesión de fuerza. Con el mismo `id` no se duplica: se sobrescribe.
 * Devuelve si se guardó; nunca lanza (sin permiso o sin Health Connect, el entreno se queda solo en la app).
 */
export async function guardarEntrenoEnSalud(e: EntrenoSalud): Promise<boolean> {
  if (!esAndroid() || !(e.fin > e.inicio)) return false
  try {
    const kcal = e.kcal != null && e.kcal > 0 ? { kcal: Math.round(e.kcal) } : {}
    await EntrenosSalud.guardar({ id: e.id, inicio: e.inicio, fin: e.fin, titulo: e.titulo, ...kcal })
    return true
  } catch { return false }
}

/** Quita de Health Connect un entreno (y sus kcal) que se ha borrado en la app. Nunca lanza. */
export async function borrarEntrenoDeSalud(id: string): Promise<boolean> {
  if (!esAndroid()) return false
  try {
    await EntrenosSalud.borrar({ id })
    return true
  } catch { return false }
}
