// Escáner de códigos con la cámara del navegador (iPhone y web). El lector va dentro de la app:
// no se descarga nada de internet para leer el código.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }

let detector: Detector | null = null

async function crearDetector(): Promise<Detector> {
  if (detector) return detector
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
  prepareZXingModule({ overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith('.wasm') ? wasmUrl : prefijo + ruta) }, fireImmediately: false })
  detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }) as Detector
  return detector
}

export type Camara = { parar: () => void; linterna: (on: boolean) => Promise<boolean> }

/** Abre la cámara trasera en el <video> y llama a `alLeer` con el primer código que encuentre. */
export async function abrirCamara(video: HTMLVideoElement, alLeer: (codigo: string) => void): Promise<Camara> {
  const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
  video.srcObject = flujo
  video.setAttribute('playsinline', '')
  video.muted = true
  await video.play().catch(() => {})
  const det = await crearDetector()
  let vivo = true
  let ultimo = ''
  let repes = 0
  const bucle = async () => {
    if (!vivo) return
    try {
      if (video.readyState >= 2) {
        const r = await det.detect(video)
        const c = r[0]?.rawValue
        // Dos lecturas iguales seguidas para no confundir un código mal leído.
        if (c) { repes = c === ultimo ? repes + 1 : 1; ultimo = c }
        if (c && repes >= 2) { vivo = false; alLeer(c); return }
      }
    } catch { /* sigue intentándolo */ }
    setTimeout(() => void bucle(), 180)
  }
  void bucle()
  const pista = flujo.getVideoTracks()[0]
  return {
    parar: () => { vivo = false; flujo.getTracks().forEach(t => t.stop()); video.srcObject = null },
    linterna: async on => {
      try { await pista?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); return true } catch { return false }
    },
  }
}
