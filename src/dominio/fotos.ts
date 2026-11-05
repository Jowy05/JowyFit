// Fotos de progreso: el orden de las poses, cuál toca después, la cuenta atrás del temporizador y el recorte
// de la imagen de la cámara (para que todas las fotos salgan con la misma forma). Sin React ni base.
import type { Foto } from '../datos/tipos'

export type Pose = Foto['pose']

export const ORDEN_POSES: readonly Pose[] = ['frente', 'perfil', 'espalda']

/** Segundos del temporizador: tiempo de dejar el móvil apoyado y ponerse en su sitio. */
export const SEGUNDOS_ESPERA = 5

/** Forma de las fotos (ancho / alto): de pie, como la silueta guía. */
export const FORMA_FOTO = 3 / 4

/** La primera pose que aún no se ha hecho hoy (en el orden de siempre); null si ya están las tres. */
export function siguientePose(hechasHoy: Iterable<Pose>): Pose | null {
  const hechas = new Set(hechasHoy)
  return ORDEN_POSES.find(p => !hechas.has(p)) ?? null
}

/**
 * Cuenta atrás de `segundos`: avisa enseguida con los que quedan, luego cada segundo, y al llegar a 0 llama a
 * `alFin` (una sola vez). Devuelve con qué pararla; parada, ya no avisa de nada.
 */
export function cuentaAtras(segundos: number, alTic: (quedan: number) => void, alFin: () => void): () => void {
  let quedan = Math.max(0, Math.round(segundos))
  let vivo = true
  let reloj: ReturnType<typeof setTimeout> | undefined
  const paso = () => {
    if (!vivo) return
    if (quedan <= 0) { vivo = false; alFin(); return }
    alTic(quedan)
    quedan--
    reloj = setTimeout(paso, 1000)
  }
  paso()
  return () => { vivo = false; clearTimeout(reloj) }
}

export type Recorte = { sx: number; sy: number; sw: number; sh: number; ancho: number; alto: number }

/**
 * El trozo central de la imagen de la cámara con la forma de las fotos (lo mismo que se ve en el visor, que la
 * recorta igual) y el tamaño final, con el lado largo de `max` como mucho (nunca se agranda).
 */
export function recorteFoto(ancho: number, alto: number, max = 1280, forma = FORMA_FOTO): Recorte {
  let sw = ancho, sh = alto
  if (ancho / alto > forma) sw = alto * forma
  else sh = ancho / forma
  const k = Math.min(1, max / Math.max(sw, sh))
  return {
    sx: Math.round((ancho - sw) / 2), sy: Math.round((alto - sh) / 2), sw: Math.round(sw), sh: Math.round(sh),
    ancho: Math.round(sw * k), alto: Math.round(sh * k),
  }
}
