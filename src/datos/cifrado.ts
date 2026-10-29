// Copias con contraseña: el zip de la copia cifrado con AES-GCM (256 bits) y una clave sacada de la contraseña con
// PBKDF2-SHA-256. Todo con WebCrypto, lo que trae el propio navegador.
// Formato: «JOWYFIT-CIFRADA-1», vueltas (4 bytes), sal (16), IV (12) y detrás el zip cifrado. La cabecera entra como
// datos adicionales del cifrado: si se toca un solo byte (también de la cabecera), no se puede abrir.
import { t } from '../i18n'

/** Cómo empieza una copia cifrada (las pruebas miden la cabecera con él). */
export const MARCA_CIFRADA = 'JOWYFIT-CIFRADA-1'
const MAGIA = new TextEncoder().encode(MARCA_CIFRADA)
const TAM_SAL = 16
const TAM_IV = 12
const TAM_CABECERA = MAGIA.length + 4 + TAM_SAL + TAM_IV
/** Lo que añade el cifrado a la copia: la cabecera y la etiqueta de AES-GCM. */
export const EXTRA_CIFRADO = TAM_CABECERA + 16

/** Vueltas de PBKDF2-SHA-256 para las claves nuevas (lo que recomienda OWASP). Abrir una copia tarda menos de un segundo. */
export const VUELTAS = 600_000
/**
 * Lo que se acepta al abrir: por debajo, una clave floja; por encima, colgar el móvil con una copia preparada a
 * propósito. El mínimo no se sube nunca aunque suba VUELTAS: las copias (y la clave guardada) de antes llevan 600.000.
 */
const VUELTAS_MIN = 600_000
const VUELTAS_MAX = 2_000_000
export const MIN_CONTRASENA = 8

/** La clave de las copias: no extraíble (solo se puede usar), con la sal y las vueltas que la sacaron. */
export type ClaveCopias = { clave: CryptoKey; sal: Uint8Array; vueltas: number }

/** La contraseña no abre la copia (o la copia está tocada: AES-GCM no distingue una cosa de la otra). */
export class ContrasenaMala extends Error {}

/** Sin WebCrypto (página sin https) no hay copias con contraseña. */
export const hayCifrado = (): boolean => !!globalThis.crypto?.subtle

/** Letras que cuenta la contraseña: «á» escrita de dos maneras cuenta (y cifra) igual. */
export const largoContrasena = (s: string): number => [...s.normalize('NFC')].length

export function esCifrada(bytes: Uint8Array): boolean {
  return bytes.length >= MAGIA.length && MAGIA.every((b, i) => bytes[i] === b)
}

export async function claveDe(contrasena: string, sal: Uint8Array = crypto.getRandomValues(new Uint8Array(TAM_SAL)), vueltas = VUELTAS): Promise<ClaveCopias> {
  const texto = new TextEncoder().encode(contrasena.normalize('NFC'))
  const base = await crypto.subtle.importKey('raw', texto, 'PBKDF2', false, ['deriveKey'])
  const clave = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: vueltas },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
  return { clave, sal, vueltas }
}

function cabecera(vueltas: number, sal: Uint8Array, iv: Uint8Array): Uint8Array<ArrayBuffer> {
  const c = new Uint8Array(TAM_CABECERA)
  c.set(MAGIA)
  new DataView(c.buffer).setUint32(MAGIA.length, vueltas)
  c.set(sal, MAGIA.length + 4)
  c.set(iv, MAGIA.length + 4 + TAM_SAL)
  return c
}

export async function cifrar(zip: Uint8Array, c: ClaveCopias): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(TAM_IV))
  const cab = cabecera(c.vueltas, c.sal, iv)
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: cab }, c.clave, zip as BufferSource))
  const out = new Uint8Array(cab.length + cifrado.length)
  out.set(cab)
  out.set(cifrado, cab.length)
  return out
}

/** Abre una copia cifrada. Devuelve el zip y la clave, para seguir usándola en las copias siguientes. */
export async function descifrar(bytes: Uint8Array, contrasena: string): Promise<{ zip: Uint8Array; clave: ClaveCopias }> {
  if (!esCifrada(bytes) || bytes.length < EXTRA_CIFRADO) throw new Error(t('El archivo está dañado o no es una copia de JowyFit'))
  const vueltas = new DataView(bytes.buffer, bytes.byteOffset).getUint32(MAGIA.length)
  if (vueltas < VUELTAS_MIN || vueltas > VUELTAS_MAX) throw new Error(t('El archivo está dañado o no es una copia de JowyFit'))
  const sal = bytes.slice(MAGIA.length + 4, MAGIA.length + 4 + TAM_SAL)
  const iv = bytes.slice(MAGIA.length + 4 + TAM_SAL, TAM_CABECERA) as Uint8Array<ArrayBuffer>
  const clave = await claveDe(contrasena, sal, vueltas)
  try {
    const zip = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: bytes.subarray(0, TAM_CABECERA) as BufferSource }, clave.clave, bytes.subarray(TAM_CABECERA) as BufferSource)
    return { zip: new Uint8Array(zip), clave }
  } catch {
    throw new ContrasenaMala(t('No es esta contraseña. Prueba otra vez.'))
  }
}
