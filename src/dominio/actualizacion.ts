// Actualizaciones de la app: compara versiones (semver) y valida lo que devuelve GitHub Releases.
// Módulo puro (sin red ni DOM) para que sea fácil de probar y mantenga estrictas las reglas de seguridad.

export const API_ULTIMA_RELEASE = 'https://api.github.com/repos/Jowy05/JowyFit/releases/latest'
export const URL_RELEASES = 'https://github.com/Jowy05/JowyFit/releases/latest'

const RE_VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/
const RE_APK = /^https:\/\/github\.com\/Jowy05\/JowyFit\/releases\/(?:download\/v\d+\.\d+\.\d+|latest\/download)\/JowyFit(?:-\d+\.\d+\.\d+)?\.apk$/
const RE_RELEASE = /^https:\/\/github\.com\/Jowy05\/JowyFit\/releases\/[A-Za-z0-9._/-]+$/
const RE_SHA = /SHA-256 del APK:\s*([0-9a-fA-F]{64})/i
const RE_FECHA = /^(\d{4}-\d{2}-\d{2})/

export type InfoActualizacion = {
  actual: string
  ultima: string
  hayNueva: boolean
  notas: string
  urlApk: string | null
  urlRelease: string
  sha256: string | null
  bytes: number | null
  fecha: string | null
}

/** Parte una versión «X.Y.Z» (con o sin «v» delante). null si no cumple el formato. */
function partesVersion(v: string): [number, number, number] | null {
  const m = RE_VERSION.exec(v.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Compara dos versiones semver: 1 si a > b, -1 si a < b, 0 si son iguales o alguna no es válida. */
export function compararVersion(a: string, b: string): -1 | 0 | 1 {
  const pa = partesVersion(a)
  const pb = partesVersion(b)
  if (!pa || !pb) return 0
  for (let i = 0; i < 3; i++) {
    if (pa[i]! > pb[i]!) return 1
    if (pa[i]! < pb[i]!) return -1
  }
  return 0
}

/** Extrae la huella SHA-256 (64 hex en minúsculas) del cuerpo de la release si existe. */
export function extraerSha256(cuerpo: string): string | null {
  const m = RE_SHA.exec(cuerpo)
  return m ? m[1]!.toLowerCase() : null
}

/** Quita la línea técnica del SHA-256 y recorta espacios/longitud para enseñarla en la app. */
export function limpiarNotas(cuerpo: string): string {
  const limpio = cuerpo
    .replace(/\r\n?/g, '\n')
    .replace(/^.*SHA-256 del APK:.*$/gim, '')
    .trim()
  return limpio.length > 1200 ? `${limpio.slice(0, 1200).trimEnd()}…` : limpio
}

/** Solo acepta enlaces HTTPS del APK oficial en GitHub Releases de Jowy05/JowyFit. */
export function urlApkSegura(url: unknown): url is string {
  return typeof url === 'string' && RE_APK.test(url)
}

/** Solo acepta enlaces HTTPS a las releases oficiales de Jowy05/JowyFit. */
export function urlReleaseSegura(url: unknown): string {
  return typeof url === 'string' && RE_RELEASE.test(url) ? url : URL_RELEASES
}

type AssetRaw = { name?: unknown; browser_download_url?: unknown; size?: unknown }
type ReleaseRaw = { tag_name?: unknown; body?: unknown; html_url?: unknown; published_at?: unknown; assets?: unknown }

/** Valida y convierte la respuesta de GitHub Releases en datos seguros para la interfaz. */
export function parsearRelease(raw: unknown, actual: string): InfoActualizacion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as ReleaseRaw
  if (typeof r.tag_name !== 'string') return null
  const partes = partesVersion(r.tag_name)
  if (!partes) return null
  const ultima = partes.join('.')
  const cuerpo = typeof r.body === 'string' ? r.body : ''

  let urlApk: string | null = null
  let bytes: number | null = null
  if (Array.isArray(r.assets)) {
    const assets = r.assets.filter((a): a is AssetRaw => !!a && typeof a === 'object')
    const elegido =
      assets.find(a => a.name === 'JowyFit.apk' && urlApkSegura(a.browser_download_url))
      ?? assets.find(a => a.name === `JowyFit-${ultima}.apk` && urlApkSegura(a.browser_download_url))
      ?? assets.find(a => urlApkSegura(a.browser_download_url))
    if (elegido && urlApkSegura(elegido.browser_download_url)) {
      urlApk = elegido.browser_download_url
      if (typeof elegido.size === 'number' && Number.isFinite(elegido.size) && elegido.size > 0) bytes = Math.round(elegido.size)
    }
  }

  const fecha = typeof r.published_at === 'string' ? (RE_FECHA.exec(r.published_at)?.[1] ?? null) : null

  return {
    actual: partesVersion(actual)?.join('.') ?? actual,
    ultima,
    hayNueva: compararVersion(ultima, actual) > 0,
    notas: limpiarNotas(cuerpo),
    urlApk,
    urlRelease: urlReleaseSegura(r.html_url),
    sha256: extraerSha256(cuerpo),
    bytes,
    fecha,
  }
}

/** Tamaño del archivo en MB con un decimal (p. ej. «29,9 MB»). */
export function tamanoMB(bytes: number): string {
  const mb = Math.max(0.1, Math.round((bytes / (1024 * 1024)) * 10) / 10)
  return `${mb.toFixed(1).replace('.', ',')} MB`
}
