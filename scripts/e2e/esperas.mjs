// Esperar a que algo se cumpla en vez de un tiempo fijo: con una espera fija, en la máquina lenta de GitHub a veces
// se miraba antes de tiempo y la prueba fallaba sin que la app hiciera nada mal.
import { FACTOR_ESPERAS } from './pagina.mjs'

const dormir = ms => new Promise(r => setTimeout(r, ms))

/**
 * Lee con `leer` hasta que `cumple(valor)` y devuelve ese valor; si no llega a tiempo, falla con `msg` (un texto o una
 * función del último valor leído). Para lo que la app guarda o pinta un momento después de tocar.
 * `ms` es lo de casa: en la integración continua se alarga (FACTOR_ESPERAS).
 */
export async function leerHasta(leer, cumple, msg, ms = 5000) {
  const fin = Date.now() + ms * FACTOR_ESPERAS
  for (;;) {
    const v = await leer()
    if (cumple(v)) return v
    if (Date.now() > fin) throw new Error(typeof msg === 'function' ? msg(v) : msg)
    await dormir(100)
  }
}

/** Espera a que `cond` (puede ser async) dé algo que no sea falso y lo devuelve; si no llega a tiempo, falla con `msg`. */
export const hastaQue = (cond, msg, ms) => leerHasta(cond, Boolean, msg, ms)
