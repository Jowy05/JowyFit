// Cámara en vivo para las fotos de progreso (Android dentro de la app, iPhone y web): la imagen se ve en la
// pantalla, con la silueta guía encima, y la foto se saca del propio vídeo. Si no hay cámara en vivo, la pantalla
// usa el selector de siempre (hacerFoto, en archivos.ts).
import { recorteFoto } from '../dominio/fotos'

/** La cámara de la pantalla (para hacerse la foto uno mismo) o la de atrás. */
export type LadoCamara = 'delantera' | 'trasera'

/** Por qué no se ha abierto: no se dio el permiso, o el móvil no la deja usar (otra app, sin cámara…). */
export type FalloCamara = 'permiso' | 'no-se-pudo'

/** Este navegador deja abrir la cámara dentro de la página (en http sin cifrar, o en navegadores viejos, no). */
export function hayCamaraEnVivo(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/**
 * Qué cámara se pide. Con «ideal», si el móvil no tiene esa (un ordenador con una sola), se usa la que haya.
 * Se pide buena resolución: luego se recorta y se reduce.
 */
export function restriccionesFoto(lado: LadoCamara): MediaStreamConstraints {
  return { video: { facingMode: { ideal: lado === 'delantera' ? 'user' : 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }
}

/** El error de getUserMedia en palabras de la pantalla. */
export function falloCamara(e: unknown): FalloCamara {
  const nombre = (e as { name?: string } | null)?.name ?? ''
  return nombre === 'NotAllowedError' || nombre === 'SecurityError' || /NotAllowed|Permission/i.test(String(e)) ? 'permiso' : 'no-se-pudo'
}

export type CamaraFoto = {
  /** Saca la foto del vídeo: recortada con la forma de las fotos y reducida a JPEG. */
  capturar: (max?: number) => Promise<Blob>
  parar: () => void
  /** Sigue dando imagen: no se ha parado ni la ha apagado el sistema. */
  viva: () => boolean
}

/** Se dejó de querer la cámara mientras se abría (se cambió de cámara, se salió…): no es un fallo que enseñar. */
export class CamaraCancelada extends Error {
  constructor() { super('Cámara cancelada') }
}

/**
 * Abre la cámara en el <video>. `alCortarse`: la cámara se apagó sola (otra app la cogió, se bloqueó el móvil…).
 * `cancelado`: se mira al llegar la imagen; si ya no se quiere, se apaga sin tocar el <video> (puede tener ya
 * la de otra apertura) y se lanza CamaraCancelada.
 * La foto se guarda tal cual la ve la cámara, también con la delantera (el visor la enseña como un espejo).
 */
export async function abrirCamaraFoto(video: HTMLVideoElement, lado: LadoCamara, alCortarse?: () => void, cancelado?: () => boolean): Promise<CamaraFoto> {
  if (!hayCamaraEnVivo()) throw new Error('Sin cámara en vivo')
  const flujo = await navigator.mediaDevices.getUserMedia(restriccionesFoto(lado))
  if (cancelado?.()) { flujo.getTracks().forEach(t => t.stop()); throw new CamaraCancelada() }
  video.srcObject = flujo
  video.setAttribute('playsinline', '')
  video.muted = true
  await video.play().catch(() => {})
  if (cancelado?.()) {
    flujo.getTracks().forEach(t => t.stop())
    if (video.srcObject === flujo) video.srcObject = null
    throw new CamaraCancelada()
  }
  let vivo = true
  const pista = flujo.getVideoTracks()[0]
  // Solo se quita la imagen del <video> si sigue siendo esta: otra apertura puede haber puesto ya la suya.
  const parar = () => { vivo = false; flujo.getTracks().forEach(t => t.stop()); if (video.srcObject === flujo) video.srcObject = null }
  pista?.addEventListener('ended', () => { if (vivo) { parar(); alCortarse?.() } })
  return {
    parar,
    viva: () => vivo && pista?.readyState !== 'ended',
    capturar: async (max = 1280) => {
      if (!video.videoWidth || !video.videoHeight) throw new Error('La cámara aún no da imagen')
      const r = recorteFoto(video.videoWidth, video.videoHeight, max)
      const c = document.createElement('canvas')
      c.width = r.ancho; c.height = r.alto
      const g = c.getContext('2d')
      if (!g) throw new Error('Sin lienzo para la foto')
      g.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, r.ancho, r.alto)
      return new Promise<Blob>((ok, mal) => c.toBlob(b => (b ? ok(b) : mal(new Error('No se pudo hacer la foto'))), 'image/jpeg', 0.85))
    },
  }
}
