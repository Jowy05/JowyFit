// Health Connect (solo Android): pasos del reloj y peso y % de grasa de la báscula.
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
