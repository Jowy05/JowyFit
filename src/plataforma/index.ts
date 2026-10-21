// Todo lo que cambia entre Android (Capacitor) y el navegador / iPhone (PWA) pasa por aquí.
// Cada función funciona en los dos sitios: en la web hace lo que puede o no hace nada.
import { Capacitor } from '@capacitor/core'

export const esAndroid = (): boolean => Capacitor.getPlatform() === 'android'
export const esNativo = (): boolean => Capacitor.isNativePlatform()
export const esIPhone = (): boolean => !esNativo() && /iPhone|iPad|iPod/.test(navigator.userAgent)

export type DispositivoApple = 'iphone' | 'ipad' | 'mac'
/**
 * Navegador de Apple (la versión web): iPhone, iPad (también el que se presenta como un Mac) o Safari de Mac.
 * Nunca en el APK. Es la misma regla que el enrutador de index.html.
 */
export function dispositivoApple(): DispositivoApple | null {
  if (esNativo() || typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) return 'iphone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ipad'
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)) return 'mac'
  return null
}
export const esWebApple = (): boolean => dispositivoApple() !== null

/** Abierta desde la pantalla de inicio (o el Dock), sin las barras del navegador. */
export function estaInstalada(): boolean {
  if (esNativo()) return true
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  try { return matchMedia('(display-mode: standalone)').matches } catch { return false }
}

/** Hay vibración de verdad: en Android sí; en Safari (iPhone) no existe `navigator.vibrate`. */
export const puedeVibrar = (): boolean => esNativo() || typeof navigator.vibrate === 'function'

/** Marca la página para los estilos propios de Apple (barra de estado de la app instalada). */
export function marcarPlataforma() {
  if (typeof document === 'undefined') return
  const r = document.documentElement
  if (esWebApple()) r.dataset.plataforma = 'apple'
  if (esWebApple() && estaInstalada()) r.dataset.instalada = ''
}

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

// ---------- sonido y vibración ----------
let audio: AudioContext | null = null
function contextoAudio(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    audio ??= new C()
    return audio
  } catch { return null }
}

let sonidoPreparado = false
/**
 * iPhone solo deja sonar a una página si el sonido se «abre» dentro de un toque. Se abre con el primer toque en la
 * app (un sonido vacío) y se vuelve a abrir si el sistema lo cierra (al bloquear el móvil o cambiar de app):
 * así el pitido de fin de descanso suena aunque llegue solo, sin tocar nada.
 */
export function prepararSonido() {
  if (sonidoPreparado || typeof window === 'undefined') return
  sonidoPreparado = true
  const abrir = () => {
    const a = contextoAudio()
    if (!a || a.state === 'running') return
    void a.resume().catch(() => {})
    try {
      const s = a.createBufferSource()
      s.buffer = a.createBuffer(1, 1, 22050)
      s.connect(a.destination)
      s.start(0)
    } catch { /* sin audio */ }
  }
  for (const e of ['touchend', 'click', 'keydown']) window.addEventListener(e, abrir, { capture: true, passive: true })
}

/** ¿El sonido está abierto (se puede oír ya)? Para las pruebas y para decidir el destello. */
export const sonidoListo = (): boolean => audio?.state === 'running'

/** Tres pitidos cortos (fin del descanso). Sin archivos de sonido: se generan al momento. */
export function pitido() {
  try {
    const a = contextoAudio()
    if (!a) return
    void a.resume().catch(() => {})
    const t0 = a.currentTime + 0.02
    for (let i = 0; i < 3; i++) {
      const o = a.createOscillator(), g = a.createGain()
      o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880
      const t = t0 + i * 0.22
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(a.destination)
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
type Bloqueo = { release: () => Promise<void>; addEventListener?: (e: 'release', f: () => void) => void }
let wakeLock: Bloqueo | null = null
let quiereEncendida = false
// En la web (iPhone) el sistema suelta el bloqueo al bloquear el móvil o cambiar de app: al volver se pide otra vez.
let escuchaVisible = false
async function pedirBloqueo() {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Bloqueo> } }).wakeLock
  if (!wl || wakeLock) return
  const b = await wl.request('screen')
  wakeLock = b
  b.addEventListener?.('release', () => { if (wakeLock === b) wakeLock = null })
}
export async function pantallaEncendida(on: boolean) {
  try {
    if (esNativo()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake')
      if (on) await KeepAwake.keepAwake(); else await KeepAwake.allowSleep()
      return
    }
    quiereEncendida = on
    if (!escuchaVisible) {
      escuchaVisible = true
      document.addEventListener('visibilitychange', () => { if (quiereEncendida && document.visibilityState === 'visible') void pedirBloqueo().catch(() => {}) })
    }
    if (on) await pedirBloqueo()
    if (!on && wakeLock) { const b = wakeLock; wakeLock = null; await b.release() }
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

// Todas las llamadas de notificaciones van en fila: si «Saltar» (cancelar) llegaba antes de que terminara de
// programarse el aviso de descanso, el aviso quedaba puesto y el reloj vibraba en mitad de la serie.
let fila: Promise<unknown> = Promise.resolve()
function enFila<T>(f: () => Promise<T>): Promise<T> {
  const r = fila.then(f, f)
  fila = r.catch(() => {})
  return r
}

export function programar(avisos: Aviso[], borrarIds: number[] = []): Promise<void> {
  return enFila(() => programarYa(avisos, borrarIds))
}

async function programarYa(avisos: Aviso[], borrarIds: number[]) {
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
      smallIcon: 'ic_stat_jowyfit', iconColor: '#7F26FB',
      channelId: a.id === ID_DESCANSO ? 'descanso' : 'recordatorios',
    })),
  })
}

export function cancelar(ids: number[]): Promise<void> {
  return enFila(async () => {
    if (!esNativo() || !ids.length) return
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) })
  })
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

// ---------- báscula (peso y % de grasa en Health Connect) ----------
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

export type MuestraBascula = { fecha: string; valor: number; id?: string; fuente?: string }
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

export type Compartido = 'compartido' | 'cancelado' | 'sin-gesto' | 'no-se-puede'
/**
 * Web (sobre todo iPhone): abre el menú Compartir con el archivo («Guardar en Archivos», AirDrop, WhatsApp…).
 * 'sin-gesto': Safari pide que salga justo después de un toque y se tardó demasiado (hay que tocar otra vez);
 * 'no-se-puede': este navegador no comparte archivos (se descarga en su lugar).
 */
export async function compartirArchivo(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<Compartido> {
  if (esNativo()) return 'no-se-puede'
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof n.share !== 'function' || typeof File === 'undefined') return 'no-se-puede'
  const archivo = new File([bytes as BlobPart], nombre, { type: tipo })
  if (n.canShare && !n.canShare({ files: [archivo] })) return 'no-se-puede'
  try {
    await n.share({ files: [archivo], title: nombre })
    return 'compartido'
  } catch (e) {
    const err = (e as Error)?.name
    if (err === 'AbortError') return 'cancelado'
    if (err === 'NotAllowedError') return 'sin-gesto'
    return 'no-se-puede'
  }
}

/**
 * Android: abre el menú Compartir del sistema con un archivo (WhatsApp, Gmail, Drive…). Se deja antes en la caché,
 * en la carpeta «compartir», que es la que el FileProvider deja dar a otra app (res/xml/file_paths.xml).
 */
export async function compartirNativo(nombre: string, bytes: Uint8Array, titulo: string): Promise<'compartido' | 'cancelado'> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const r = await Filesystem.writeFile({ path: `compartir/${nombre}`, data: aBase64(bytes), directory: Directory.Cache, recursive: true })
  try {
    await Share.share({ title: titulo, files: [r.uri], dialogTitle: titulo })
    return 'compartido'
  } catch (e) {
    // Cerrar el menú sin elegir nada no es un error.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelado'
    throw e
  }
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

/**
 * Un <input type=file> de un solo uso. Va metido en la página (escondido): en iPhone, uno suelto a veces no avisa
 * al elegir. Si se cierra sin elegir nada (evento «cancel», Safari 16.4 o más), devuelve null.
 */
function pedirArchivo(preparar: (i: HTMLInputElement) => void): Promise<File | null> {
  return new Promise(resolve => {
    const i = document.createElement('input')
    i.type = 'file'
    i.style.display = 'none'
    preparar(i)
    let hecho = false
    const fin = (f: File | null) => { if (hecho) return; hecho = true; i.remove(); resolve(f) }
    i.addEventListener('change', () => fin(i.files?.[0] ?? null))
    i.addEventListener('cancel', () => fin(null))
    document.body.appendChild(i)
    i.click()
  })
}

/** Abre el selector de archivos y devuelve el contenido. */
export async function elegirArchivo(aceptar = '.jowyfit,.json,application/json,application/zip'): Promise<{ nombre: string; bytes: Uint8Array } | null> {
  // En Android el selector filtra por tipo de archivo y no conoce «.jowyfit»: la copia salía en gris
  // y no se podía elegir. En iPhone pasa lo mismo (Archivos no sabe qué es «.jowyfit»). Allí se deja elegir
  // cualquier archivo; al importar se comprueba que sea una copia.
  const f = await pedirArchivo(i => { i.accept = esNativo() || esWebApple() ? '' : aceptar })
  return f ? { nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null
}

/** Hace una foto (o la elige de la galería) y la devuelve reducida a JPEG. */
export async function hacerFoto(max = 1280): Promise<Blob | null> {
  // En iPhone, sin «capture» sale el menú «Hacer foto · Fototeca · Elegir archivo»: con él solo se podía usar la cámara.
  const f = await pedirArchivo(i => { i.accept = 'image/*'; if (!esWebApple()) i.setAttribute('capture', 'environment') })
  return f ? reducir(f, max) : null
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
