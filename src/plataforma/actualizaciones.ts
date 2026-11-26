// Comprobación y descarga de actualizaciones desde la propia app (Android nativo + PWA/web).
// Nunca se conecta sola al arrancar: solo cuando el usuario pulsa «Buscar actualizaciones».
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { API_ULTIMA_RELEASE, parsearRelease, urlApkSegura, type InfoActualizacion } from '../dominio/actualizacion'
import { esAndroid } from './dispositivo'

export type ProgresoDescarga = { porcentaje: number; descargado: number; total: number }

type PluginActualizacion = {
  puedeInstalar(): Promise<{ permitido: boolean }>
  descargarEInstalar(o: { url: string; sha256?: string }): Promise<{ estado: 'instalando' | 'permiso' }>
  addListener(evento: 'progreso', fn: (p: ProgresoDescarga) => void): Promise<PluginListenerHandle>
}

let pluginCache: PluginActualizacion | null = null
function pluginActualizacion(): PluginActualizacion {
  return (pluginCache ??= registerPlugin<PluginActualizacion>('ActualizacionApp'))
}

export type ResultadoBusqueda =
  | { ok: true; info: InfoActualizacion; webLista: boolean }
  | { ok: false; motivo: 'sin-red' | 'error' }

/** Comprueba si el Service Worker de la versión web/PWA tiene ya una versión nueva lista. */
async function comprobarServiceWorker(): Promise<boolean> {
  if (esAndroid() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return false
    await reg.update().catch(() => {})
    return !!(reg.waiting || reg.installing)
  } catch {
    return false
  }
}

/** Consulta la última versión publicada en GitHub Releases (solo bajo demanda del usuario). */
export async function buscarActualizacion(versionActual: string, fetchImpl: typeof fetch = fetch): Promise<ResultadoBusqueda> {
  const swPromesa = comprobarServiceWorker()
  try {
    const res = await fetchImpl(API_ULTIMA_RELEASE, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(10_000)
        : undefined,
    })
    if (!res.ok) return { ok: false, motivo: 'error' }
    const raw: unknown = await res.json()
    const info = parsearRelease(raw, versionActual)
    if (!info) return { ok: false, motivo: 'error' }
    return { ok: true, info, webLista: await swPromesa }
  } catch {
    const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false
    return { ok: false, motivo: sinRed ? 'sin-red' : 'error' }
  }
}

export type EstadoInstalacion = 'instalando' | 'permiso' | 'navegador'

/**
 * Descarga e instala el APK:
 * - En Android nativo usa el plugin ActualizacionApp (descarga verificada con SHA-256 + instalador del sistema).
 * - Si el APK instalado es antiguo y aún no incluye el plugin, o en navegador web, abre la descarga oficial.
 */
export async function instalarActualizacionApk(
  info: InfoActualizacion,
  alProgreso?: (p: ProgresoDescarga) => void,
): Promise<EstadoInstalacion> {
  const url = info.urlApk
  if (!urlApkSegura(url)) throw new Error('Enlace de actualización no válido')

  if (esAndroid()) {
    const plugin = pluginActualizacion()
    let handle: PluginListenerHandle | null = null
    try {
      if (alProgreso) {
        handle = await plugin.addListener('progreso', alProgreso)
      }
      const r = await plugin.descargarEInstalar({ url, sha256: info.sha256 ?? '' })
      return r.estado
    } catch (e) {
      const m = String((e as Error)?.message ?? e ?? '')
      if (/UNIMPLEMENTED|not implemented/i.test(m)) {
        abrirDescargaWeb(url)
        return 'navegador'
      }
      throw e
    } finally {
      if (handle) await handle.remove().catch(() => {})
    }
  }

  abrirDescargaWeb(url)
  return 'navegador'
}

function abrirDescargaWeb(url: string) {
  if (typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Recarga la versión web/PWA para aplicar la última versión en caché. */
export async function aplicarActualizacionWeb(): Promise<void> {
  if (typeof window === 'undefined') return
  await comprobarServiceWorker()
  window.location.reload()
}
