// Hacer y guardar copias de seguridad: a mano, la semanal (con la limpieza de las automáticas que sobran), con el menú
// Compartir de Apple y, al poner la contraseña, cambiar las copias guardadas por una protegida.
import { exportarCopia } from '../datos/copias'
import { leerClaveCopias } from '../datos/claveCopias'
import { reprogramarNotificaciones } from '../datos/acciones/avisos'
import { guardarAjustes, leerAjustes, leerPerfil } from '../datos/repos'
import { automaticasDeMasNueva, esCifradaPorNombre, nombreCopia } from '../dominio/copias'
import { borrarCopiaGuardada, compartirArchivo, copiasGuardadas, esNativo, guardarArchivo } from '../plataforma'
import { t } from '../i18n'

export type CopiaPreparada = { nombre: string; bytes: Uint8Array }
// También la cifrada va como zip: es el tipo que el menú Compartir de Safari ya acepta con el «.jowyfit».
const TIPO = 'application/zip'

/**
 * La copia lista para guardar: cifrada si hay contraseña y con un nombre libre en Documentos/JowyFit (la hora y, si
 * ya existe, «-2», «-3»…).
 */
async function prepararCopia(auto = false): Promise<CopiaPreparada> {
  const { bytes, cifrada } = await exportarCopia()
  const existentes = esNativo() ? (await copiasGuardadas()).map(c => c.nombre) : []
  return { nombre: nombreCopia(new Date(), existentes, { auto, cifrada }), bytes }
}

async function apuntarCopia() {
  await guardarAjustes({ ultimaCopia: new Date().toISOString() })
  await reprogramarNotificaciones()
}

/** Borra esas copias; si una no se puede, sigue con las demás. Devuelve cuántas borró. */
async function borrarCopias(nombres: string[]): Promise<number> {
  let borradas = 0
  for (const n of nombres) {
    try { await borrarCopiaGuardada(n); borradas++ } catch { /* se queda; la siguiente vez */ }
  }
  return borradas
}

/**
 * Copia automática semanal en Documentos/JowyFit (Android). Después, se quitan las automáticas que sobran, salvo si
 * la nueva ocupa menos de la mitad que la anterior: algo se ha perdido (un «Borrar todo» sin querer) y las viejas
 * pueden ser las únicas buenas.
 */
export async function copiaAutomatica(): Promise<boolean> {
  const a = await leerAjustes()
  if (!a.copiaAuto || !esNativo()) return false
  if (a.ultimaCopia && Date.now() - new Date(a.ultimaCopia).getTime() < 7 * 86_400_000) return false
  if (!(await leerPerfil())?.altaCompleta) return false
  try {
    const guardadas = await copiasGuardadas()
    const [ultima] = automaticasDeMasNueva(guardadas.map(c => c.nombre))
    const tamUltima = guardadas.find(c => c.nombre === ultima)?.tam ?? 0
    const c = await prepararCopia(true)
    await guardarArchivo(c.nombre, c.bytes, TIPO)
    await apuntarCopia()
    if (c.bytes.length >= tamUltima / 2) await limpiarAutomaticas(a.copiasAuto)
    return true
  } catch { return false }
}

/**
 * Deja solo las `guardar` copias automáticas más nuevas (0 = todas). Las hechas a mano y las de antes de la 0.9.0
 * (sin «auto» en el nombre) no se tocan nunca.
 */
export async function limpiarAutomaticas(guardar: number): Promise<number> {
  if (guardar <= 0) return 0
  return borrarCopias(automaticasDeMasNueva((await copiasGuardadas()).map(c => c.nombre)).slice(guardar))
}

/** Hace la copia y devuelve el nombre del archivo (el que sale en el aviso: lleva la hora y, si hace falta, «-2»). */
export async function hacerCopiaAhora(): Promise<string> {
  const c = await prepararCopia()
  await guardarArchivo(c.nombre, c.bytes, TIPO)
  await apuntarCopia()
  return c.nombre
}

/**
 * Tras poner la contraseña: hace una copia nueva protegida y borra las guardadas sin contraseña. La copia nueva va
 * antes, para no quedarse nunca sin ninguna. Devuelve cuántas se borraron.
 */
export async function protegerCopiasGuardadas(): Promise<number> {
  if (!(await leerClaveCopias())) throw new Error(t('No hay contraseña puesta'))
  if (!esCifradaPorNombre(await hacerCopiaAhora())) throw new Error(t('No hay contraseña puesta'))
  return borrarCopias((await copiasGuardadas()).map(c => c.nombre).filter(n => !esCifradaPorNombre(n)))
}

/**
 * Web de Apple: se guarda con el menú Compartir o, si no comparte archivos, se descarga. Si Safari no deja abrirlo
 * (tardó tras el toque), devuelve 'sin-gesto' con la copia hecha para el siguiente toque. La fecha solo se apunta si se guardó.
 */
export async function copiaCompartiendo(lista?: CopiaPreparada): Promise<{ resultado: 'compartido' | 'descargado' | 'cancelado' | 'sin-gesto'; copia: CopiaPreparada }> {
  const copia = lista ?? await prepararCopia()
  const r = await compartirArchivo(copia.nombre, copia.bytes, TIPO)
  if (r === 'cancelado' || r === 'sin-gesto') return { resultado: r, copia }
  if (r === 'no-se-puede') await guardarArchivo(copia.nombre, copia.bytes, TIPO)
  await apuntarCopia()
  return { resultado: r === 'compartido' ? 'compartido' : 'descargado', copia }
}
