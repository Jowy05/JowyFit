// Dónde se ejecuta la app y qué puede hacer ese aparato; botón atrás, volver a la app y pantalla encendida.
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

export type Capacidades = {
  /** Recordatorios programados (notificaciones): solo el APK. */
  recordatorios: boolean
  /** Health Connect (pasos, peso y grasa): solo Android. */
  salud: boolean
  vibracion: boolean
  /** Copias en Documentos/JowyFit, que se listan y se hacen solas cada semana: solo el APK. */
  copiasEnDocumentos: boolean
  /** Navegador de Apple: la copia sale por el menú Compartir y no se nombra nada que sea solo de Android. */
  apple: boolean
  /** Cómo se pone como app en un navegador de Apple: en el Dock (Mac) o en la pantalla de inicio; null fuera de Apple. */
  instalar: 'dock' | 'inicio' | null
}

export function capacidades(): Capacidades {
  const apple = dispositivoApple()
  return {
    recordatorios: esNativo(),
    salud: esAndroid(),
    vibracion: puedeVibrar(),
    copiasEnDocumentos: esNativo(),
    apple: apple !== null,
    instalar: apple === 'mac' ? 'dock' : apple ? 'inicio' : null,
  }
}

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
