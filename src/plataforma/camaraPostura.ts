// Motor local de cámara con MediaPipe BlazePose (WASM + pose_landmarker_lite.task servidos desde /postura/).
// 100 % local y sin conexión: nunca guarda ni envía imágenes ni conecta con internet.
import type { PoseLandmarker as TipoPoseLandmarker } from '@mediapipe/tasks-vision'
import type { Punto2D, PuntosPostura } from '../dominio/postura'
import { CamaraCancelada, hayCamaraEnVivo, type LadoCamara } from './camaraFoto'

const INTERVALO_MS = 48 // ~20 fps: seguimiento fluido y estable en móviles
const CONF_DIBUJO = 0.45

export type CamaraPostura = {
  parar: () => void
  viva: () => boolean
}

type LandmarkMP = { x: number; y: number; z: number; visibility?: number }

const INDICES: [keyof PuntosPostura, number][] = [
  ['cara', 0],
  ['hombroIzq', 11],
  ['hombroDer', 12],
  ['codoIzq', 13],
  ['codoDer', 14],
  ['munecaIzq', 15],
  ['munecaDer', 16],
  ['caderaIzq', 23],
  ['caderaDer', 24],
  ['rodillaIzq', 25],
  ['rodillaDer', 26],
  ['tobilloIzq', 27],
  ['tobilloDer', 28],
]

const CONEXIONES: [keyof PuntosPostura, keyof PuntosPostura][] = [
  ['hombroIzq', 'hombroDer'],
  ['hombroIzq', 'codoIzq'], ['codoIzq', 'munecaIzq'],
  ['hombroDer', 'codoDer'], ['codoDer', 'munecaDer'],
  ['hombroIzq', 'caderaIzq'], ['hombroDer', 'caderaDer'],
  ['caderaIzq', 'caderaDer'],
  ['caderaIzq', 'rodillaIzq'], ['rodillaIzq', 'tobilloIzq'],
  ['caderaDer', 'rodillaDer'], ['rodillaDer', 'tobilloDer'],
]

let detectorUnico: Promise<TipoPoseLandmarker> | null = null

function rutaRecursosPostura(): string {
  const base = (import.meta.env.BASE_URL || './').replace(/\/$/, '')
  return `${base}/postura`
}

/** Carga una sola vez el modelo local MediaPipe PoseLandmarker (GPU con respaldo automático a CPU). */
async function obtenerDetector(): Promise<TipoPoseLandmarker> {
  if (detectorUnico) return detectorUnico
  detectorUnico = (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const base = rutaRecursosPostura()
    const vision = await FilesetResolver.forVisionTasks(base)
    const modelo = `${base}/pose_landmarker_lite.task`
    const comun = {
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
    try {
      return await PoseLandmarker.createFromOptions(vision, {
        ...comun,
        baseOptions: { modelAssetPath: modelo, delegate: 'GPU' },
      })
    } catch {
      return await PoseLandmarker.createFromOptions(vision, {
        ...comun,
        baseOptions: { modelAssetPath: modelo, delegate: 'CPU' },
      })
    }
  })().catch(e => {
    detectorUnico = null
    throw e
  })
  return detectorUnico
}

/** Media móvil exponencial por articulación: suave para el esqueleto, ágil para captar el fondo en reps rápidas. */
function suavizar(prev: Punto2D | undefined, nuevo: Punto2D | undefined, alpha = 0.72): Punto2D | undefined {
  if (!nuevo || nuevo.confianza < 0.25) {
    if (!prev || prev.confianza < 0.2) return undefined
    return { ...prev, confianza: prev.confianza * 0.45 }
  }
  if (!prev || prev.confianza < 0.25) return nuevo
  const z = Number.isFinite(nuevo.z) && Number.isFinite(prev.z)
    ? prev.z! + (nuevo.z! - prev.z!) * alpha
    : nuevo.z
  return {
    x: prev.x + (nuevo.x - prev.x) * alpha,
    y: prev.y + (nuevo.y - prev.y) * alpha,
    ...(z !== undefined ? { z } : {}),
    confianza: prev.confianza + (nuevo.confianza - prev.confianza) * alpha,
  }
}

function suavizarPuntos(prev: PuntosPostura, sig: PuntosPostura): PuntosPostura {
  const out: PuntosPostura = {}
  for (const [clave] of INDICES) {
    const p = suavizar(prev[clave], sig[clave])
    if (p) out[clave] = p
  }
  return out
}

function extraerPuntos(lms: LandmarkMP[] | undefined, conProfundidad: boolean, visFuente?: LandmarkMP[]): PuntosPostura {
  if (!lms?.length) return {}
  const out: PuntosPostura = {}
  for (const [clave, idx] of INDICES) {
    const p = lms[idx]
    if (!p) continue
    const vis = visFuente?.[idx]?.visibility ?? p.visibility ?? 0
    out[clave] = {
      x: p.x,
      y: p.y,
      ...(conProfundidad ? { z: p.z } : {}),
      confianza: vis,
    }
  }
  return out
}

/** Dibuja el esqueleto y el aro de cara sobre el vídeo usando la resolución nativa del vídeo (alineación exacta). */
export function dibujarPostura(ctx: CanvasRenderingContext2D, ancho: number, alto: number, pts: PuntosPostura, bien: boolean): void {
  ctx.clearRect(0, 0, ancho, alto)
  const minDim = Math.min(ancho, alto)
  const color = bien ? '#7CC242' : '#F2B233'
  const grosor = Math.max(3, minDim * 0.0085)
  const radio = Math.max(4.5, minDim * 0.013)
  const ok = (p?: Punto2D): p is Punto2D => !!p && p.confianza >= CONF_DIBUJO

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = grosor
  ctx.strokeStyle = color

  for (const [ka, kb] of CONEXIONES) {
    const a = pts[ka], b = pts[kb]
    if (!ok(a) || !ok(b)) continue
    ctx.beginPath()
    ctx.moveTo(a.x * ancho, a.y * alto)
    ctx.lineTo(b.x * ancho, b.y * alto)
    ctx.stroke()
  }

  for (const [clave] of INDICES) {
    const p = pts[clave]
    if (!ok(p)) continue
    const x = p.x * ancho, y = p.y * alto
    ctx.beginPath()
    if (clave === 'cara') {
      ctx.strokeStyle = '#BDA0FF'
      ctx.lineWidth = Math.max(2.5, grosor * 0.75)
      ctx.arc(x, y, Math.max(14, minDim * 0.048), 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = color
      ctx.arc(x, y, radio, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#110C1B'
      ctx.lineWidth = Math.max(1.5, grosor * 0.4)
      ctx.stroke()
    }
  }
}

/**
 * Abre la cámara en vivo y ejecuta MediaPipe BlazePose localmente en el dispositivo.
 * Entrega `pts3D` (metros reales para ángulos sin distorsión) y `pts2D` (normalizados 0..1 para pintar el esqueleto).
 */
export async function abrirCamaraPostura(
  video: HTMLVideoElement,
  lado: LadoCamara,
  alDetectar: (pts3D: PuntosPostura, pts2D: PuntosPostura, ahoraMs: number) => void,
  alCortarse?: () => void,
  cancelado?: () => boolean,
): Promise<CamaraPostura> {
  if (!hayCamaraEnVivo()) throw new Error('Sin cámara en vivo')

  // Arrancar cámara y modelo local en paralelo para reducir el tiempo de apertura.
  const promModelo = obtenerDetector()
  const flujo = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: lado === 'delantera' ? 'user' : 'environment' }, width: { ideal: 640 } },
    audio: false,
  })
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

  let detector: TipoPoseLandmarker
  try {
    detector = await promModelo
  } catch (e) {
    flujo.getTracks().forEach(t => t.stop())
    if (video.srcObject === flujo) video.srcObject = null
    throw e
  }
  if (cancelado?.()) {
    flujo.getTracks().forEach(t => t.stop())
    if (video.srcObject === flujo) video.srcObject = null
    throw new CamaraCancelada()
  }

  let prev2D: PuntosPostura = {}
  let prev3D: PuntosPostura = {}
  let vivo = true
  let rafId = 0
  let ultimoPaso = 0
  let ultimoTs = 0
  let ocupado = false

  const bucle = (ahoraPerf: number) => {
    if (!vivo) return
    rafId = requestAnimationFrame(bucle)
    if (ocupado || document.hidden) return
    if (ahoraPerf - ultimoPaso < INTERVALO_MS) return
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return

    ocupado = true
    ultimoPaso = ahoraPerf
    try {
      // MediaPipe exige marcas de tiempo estrictamente crecientes en modo VIDEO.
      const ts = Math.max(ultimoTs + 1, Math.round(ahoraPerf))
      ultimoTs = ts
      const res = detector.detectForVideo(video, ts)
      const lm2D = res.landmarks?.[0]
      const lm3D = res.worldLandmarks?.[0]
      const crudos2D = extraerPuntos(lm2D, false)
      const crudos3D = lm3D?.length ? extraerPuntos(lm3D, true, lm2D) : crudos2D
      prev2D = suavizarPuntos(prev2D, crudos2D)
      prev3D = suavizarPuntos(prev3D, crudos3D)
      alDetectar(prev3D, prev2D, Date.now())
    } catch { /* reintenta en el siguiente fotograma */ } finally {
      ocupado = false
    }
  }
  rafId = requestAnimationFrame(bucle)

  const pista = flujo.getVideoTracks()[0]
  const parar = () => {
    vivo = false
    if (rafId) cancelAnimationFrame(rafId)
    flujo.getTracks().forEach(t => t.stop())
    if (video.srcObject === flujo) video.srcObject = null
  }
  pista?.addEventListener('ended', () => { if (vivo) { parar(); alCortarse?.() } })
  return { parar, viva: () => vivo && pista?.readyState !== 'ended' }
}
