// Todo lo que cambia entre Android (Capacitor) y el navegador / iPhone (PWA) pasa por aquí.
// Cada función funciona en los dos sitios: en la web hace lo que puede o no hace nada.
import { Capacitor } from '@capacitor/core'

export const esAndroid = (): boolean => Capacitor.getPlatform() === 'android'
export const esNativo = (): boolean => Capacitor.isNativePlatform()
export const esIPhone = (): boolean => !esNativo() && /iPhone|iPad|iPod/.test(navigator.userAgent)

/** Botón «atrás» de Android. Devuelve una función para dejar de escuchar. */
export async function alPulsarAtras(fn: () => boolean): Promise<() => void> {
  if (!esNativo()) return () => {}
  const { App } = await import('@capacitor/app')
  const h = await App.addListener('backButton', () => {
    // Si no hay nada a lo que volver, se minimiza (no se cierra: un entreno puede seguir en curso).
    if (!fn()) void App.minimizeApp()
  })
  return () => { void h.remove() }
}

export async function alVolverAPrimerPlano(fn: () => void): Promise<() => void> {
  if (!esNativo()) {
    const f = () => { if (document.visibilityState === 'visible') fn() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }
  const { App } = await import('@capacitor/app')
  const h = await App.addListener('appStateChange', s => { if (s.isActive) fn() })
  return () => { void h.remove() }
}

// ---------- vibración ----------
let audio: AudioContext | null = null
/** Tres pitidos cortos (fin del descanso). Sin archivos de sonido: se generan al momento. */
export function pitido() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
    const t0 = audio.currentTime + 0.02
    for (let i = 0; i < 3; i++) {
      const o = audio.createOscillator(), g = audio.createGain()
      o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880
      const t = t0 + i * 0.22
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(audio.destination)
      o.start(t); o.stop(t + 0.18)
    }
  } catch { /* sin audio */ }
}

export async function vibrar(tipo: 'corta' | 'fin' = 'corta') {
  try {
    if (esNativo()) {
      const { Haptics, NotificationType, ImpactStyle } = await import('@capacitor/haptics')
      if (tipo === 'fin') await Haptics.notification({ type: NotificationType.Success })
      else await Haptics.impact({ style: ImpactStyle.Medium })
    } else navigator.vibrate?.(tipo === 'fin' ? [200, 100, 200] : 40)
  } catch { /* sin vibración */ }
}

// ---------- pantalla encendida ----------
let wakeLock: { release: () => Promise<void> } | null = null
export async function pantallaEncendida(on: boolean) {
  try {
    if (esNativo()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake')
      if (on) await KeepAwake.keepAwake(); else await KeepAwake.allowSleep()
      return
    }
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    if (on && wl && !wakeLock) wakeLock = await wl.request('screen')
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null }
  } catch { /* no soportado */ }
}

// ---------- notificaciones (solo Android) ----------
export type Aviso = { id: number; titulo: string; texto: string; cuando: Date; repetirCada?: 'day' | 'week' }

export async function permisoNotificaciones(pedir: boolean): Promise<boolean> {
  if (!esNativo()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let p = await LocalNotifications.checkPermissions()
  if (p.display !== 'granted' && pedir) p = await LocalNotifications.requestPermissions()
  return p.display === 'granted'
}

/** Aviso de fin de descanso (y del calentamiento): va por su propio canal, con vibración, para que llegue al reloj. */
export const ID_DESCANSO = 9001
let canales = false
async function crearCanales(ln: typeof import('@capacitor/local-notifications').LocalNotifications) {
  if (canales) return
  canales = true
  await ln.createChannel({ id: 'descanso', name: 'Fin del descanso', description: 'Avisa cuando toca la siguiente serie (también en el reloj)', importance: 5, visibility: 1, vibration: true }).catch(() => {})
  await ln.createChannel({ id: 'recordatorios', name: 'Recordatorios', description: 'Dormir, pesarse, suplementos, copias…', importance: 3, visibility: 1, vibration: true }).catch(() => {})
}

export async function programar(avisos: Aviso[], borrarIds: number[] = []) {
  if (!esNativo()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  if (borrarIds.length) await LocalNotifications.cancel({ notifications: borrarIds.map(id => ({ id })) })
  if (!avisos.length) return
  if (!(await permisoNotificaciones(false))) return
  await crearCanales(LocalNotifications)
  // Solo se piden alarmas exactas si el sistema ya las permite: si no, el plugin abriría
  // la pantalla de «Alarmas y recordatorios» sin avisar. Un recordatorio inexacto llega igual.
  const exacta = await LocalNotifications.checkExactNotificationSetting().then(s => s.exact_alarm === 'granted').catch(() => false)
  await LocalNotifications.schedule({
    notifications: avisos.map(a => ({
      id: a.id, title: a.titulo, body: a.texto, isExactNotification: exacta,
      schedule: a.repetirCada ? { on: a.repetirCada === 'day' ? { hour: a.cuando.getHours(), minute: a.cuando.getMinutes() } : { weekday: a.cuando.getDay() + 1, hour: a.cuando.getHours(), minute: a.cuando.getMinutes() }, allowWhileIdle: true } : { at: a.cuando, allowWhileIdle: true },
      smallIcon: 'ic_stat_jowyfit', iconColor: '#FF7A1A',
      channelId: a.id === ID_DESCANSO ? 'descanso' : 'recordatorios',
    })),
  })
}

export async function cancelar(ids: number[]) {
  if (!esNativo() || !ids.length) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) })
}

// ---------- pasos (Health Connect en Android) ----------
export async function pasosDisponibles(): Promise<boolean> {
  if (!esAndroid()) return false
  try {
    const { Health } = await import('@capgo/capacitor-health')
    return (await Health.isAvailable()).available
  } catch { return false }
}

export async function pedirPermisoPasos(): Promise<boolean> {
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

// ---------- escáner de códigos de barras ----------
/** Android: escáner nativo de Google (ML Kit). Devuelve null si no hay escáner nativo. */
export async function escanearNativo(): Promise<string | null | 'cancelado'> {
  if (!esAndroid()) return null
  try {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')
    if (!(await BarcodeScanner.isSupported()).supported) return null
    const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: true }))
    if (!mod.available) { await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {}); }
    try {
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE] })
      return barcodes[0]?.rawValue ?? 'cancelado'
    } catch {
      // El escáner de Google ya se abrió: cerrarlo da «Failed to scan code» (no dice «cancel»).
      // No se cae a la cámara web, que en Android no tiene permiso: se ofrece escribir el código.
      return 'cancelado'
    }
  } catch {
    return null
  }
}

// ---------- archivos ----------
function aBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Guarda un archivo. Android: Documentos/JowyFit (sobrevive a desinstalar). Web: descarga. */
export async function guardarArchivo(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<string> {
  if (esNativo()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const r = await Filesystem.writeFile({ path: `JowyFit/${nombre}`, data: aBase64(bytes), directory: Directory.Documents, recursive: true })
    return r.uri
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return nombre
}

/** Lista las copias guardadas en Documentos/JowyFit (solo Android). */
export async function copiasGuardadas(): Promise<{ nombre: string; fecha: number; tam: number }[]> {
  if (!esNativo()) return []
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const r = await Filesystem.readdir({ path: 'JowyFit', directory: Directory.Documents })
    return r.files.filter(f => f.name.endsWith('.jowyfit')).map(f => ({ nombre: f.name, fecha: Number(f.mtime ?? 0), tam: Number(f.size ?? 0) })).sort((a, b) => b.fecha - a.fecha)
  } catch { return [] }
}

export async function leerCopiaGuardada(nombre: string): Promise<Uint8Array> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const r = await Filesystem.readFile({ path: `JowyFit/${nombre}`, directory: Directory.Documents })
  const bin = atob(typeof r.data === 'string' ? r.data : await (r.data as Blob).text())
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

/** Abre el selector de archivos y devuelve el contenido. */
export function elegirArchivo(aceptar = '.jowyfit,.json,application/json,application/zip'): Promise<{ nombre: string; bytes: Uint8Array } | null> {
  return new Promise(resolve => {
    const i = document.createElement('input')
    // En Android el selector filtra por tipo de archivo y no conoce «.jowyfit»: la copia salía en gris
    // y no se podía elegir. Allí se deja elegir cualquier archivo; al importar se comprueba que sea una copia.
    i.type = 'file'; i.accept = esNativo() ? '' : aceptar
    i.onchange = async () => {
      const f = i.files?.[0]
      resolve(f ? { nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null)
    }
    i.click()
  })
}

/** Hace una foto (o la elige de la galería) y la devuelve reducida a JPEG. */
export function hacerFoto(max = 1280): Promise<Blob | null> {
  return new Promise(resolve => {
    const i = document.createElement('input')
    i.type = 'file'; i.accept = 'image/*'; i.setAttribute('capture', 'environment')
    i.onchange = async () => {
      const f = i.files?.[0]
      if (!f) return resolve(null)
      resolve(await reducir(f, max))
    }
    i.click()
  })
}

export async function reducir(f: Blob, max = 1280): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise<Blob>(r => c.toBlob(b => r(b ?? f), 'image/jpeg', 0.82))
  } catch { return f }
}
