// Pitido y vibración del fin del descanso.
import { esNativo } from './dispositivo'

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
 * iPhone solo deja sonar a una página si el sonido se «abre» dentro de un toque: se abre en el primer toque (un sonido
 * vacío) y otra vez si el sistema lo cierra, para que el pitido de fin de descanso suene sin tocar nada.
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
