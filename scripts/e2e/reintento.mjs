// Reintento de las pruebas en la integración continua: la máquina de GitHub a veces va tan lenta que una prueba
// buena falla y pasa al relanzarla. Allí se vuelve a pasar una sola vez lo que falle; si falla otra vez, falla.
// En casa no se reintenta nada: un fallo se ve a la primera.

/** Si se reintenta lo que falle: solo en la integración continua (GitHub pone CI=true). */
export const reintentarEnCI = (entorno = process.env) => !!entorno.CI

/**
 * Pasa `f` y, si falla y `reintentar`, una vez más (antes, `antesDeReintentar` con el error, para apuntarlo).
 * Devuelve cómo ha ido: `ok`, si se `reintentó`, el `error` que lo hizo fallar y, si se reintentó, el `primerError`.
 */
export async function conReintento(f, { reintentar = false, antesDeReintentar } = {}) {
  try {
    await f()
    return { ok: true, reintentado: false }
  } catch (primero) {
    if (!reintentar) return { ok: false, reintentado: false, error: primero }
    await antesDeReintentar?.(primero)
    try {
      await f()
      return { ok: true, reintentado: true, primerError: primero }
    } catch (error) {
      return { ok: false, reintentado: true, error, primerError: primero }
    }
  }
}

/** La línea final: «46 bien (1 reintentado), 0 mal · 653 s». */
export function resumen({ bien, mal, reintentados, segundos }) {
  const r = reintentados ? ` (${reintentados} ${reintentados === 1 ? 'reintentado' : 'reintentados'})` : ''
  return `${bien} bien${r}, ${mal} mal · ${segundos} s`
}
