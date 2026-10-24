// Textos de RepDB en catalán (traducción propia de los textos en castellano de RepDB).
// La licencia de RepDB deja traducirlos para usarlos dentro de la app, pero no publicarlos como dataset (punto 3):
// por eso en el repositorio van CIFRADOS (assets/repdb/catalogo.ca.cifrado) y solo se descifran al compilar, con la
// clave del secreto REPDB_CA_CLAVE de GitHub (o, en este PC, firmas/repdb-ca.clave, que no se sube).
//   node scripts/repdb-ca.mjs cifrar <catalogo.ca.json>   → escribe assets/repdb/catalogo.ca.cifrado
// Formato: 12 bytes de IV + 16 de etiqueta GCM + el JSON comprimido con gzip y cifrado con AES-256-GCM.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

const RAIZ = path.resolve(import.meta.dirname, '..')
export const CIFRADO = path.join(RAIZ, 'assets', 'repdb', 'catalogo.ca.cifrado')
const CLAVE_LOCAL = path.join(RAIZ, 'firmas', 'repdb-ca.clave')

/** La clave (32 bytes): del entorno (integración continua) o del archivo local; null si no hay. */
export function clave() {
  const hex = (process.env.REPDB_CA_CLAVE || (fs.existsSync(CLAVE_LOCAL) ? fs.readFileSync(CLAVE_LOCAL, 'utf8') : '')).trim()
  if (!hex) return null
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('RepDB en catalán: la clave tiene que ser de 64 caracteres hexadecimales.')
  return Buffer.from(hex, 'hex')
}

export function cifrar(json, k) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', k, iv)
  const datos = Buffer.concat([c.update(gzipSync(Buffer.from(json, 'utf8'))), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), datos])
}

/** El JSON en claro. Si la clave no es la buena o el archivo está tocado, GCM lo detecta y lanza un error. */
export function descifrar(buf, k) {
  if (buf.length < 29) throw new Error('RepDB en catalán: el archivo cifrado está vacío o cortado.')
  const d = createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12), { authTagLength: 16 })
  d.setAuthTag(buf.subarray(12, 28))
  return gunzipSync(Buffer.concat([d.update(buf.subarray(28)), d.final()])).toString('utf8')
}

// node scripts/repdb-ca.mjs cifrar <json>
if (path.basename(process.argv[1] ?? '') === 'repdb-ca.mjs') {
  const [orden, origen] = process.argv.slice(2)
  const k = clave()
  if (orden !== 'cifrar' || !origen) { console.error('Uso: node scripts/repdb-ca.mjs cifrar <catalogo.ca.json>'); process.exit(1) }
  if (!k) { console.error(`Falta la clave: REPDB_CA_CLAVE o ${path.relative(RAIZ, CLAVE_LOCAL)}`); process.exit(1) }
  const json = JSON.stringify(JSON.parse(fs.readFileSync(origen, 'utf8')))
  fs.mkdirSync(path.dirname(CIFRADO), { recursive: true })
  fs.writeFileSync(CIFRADO, cifrar(json, k))
  console.log(`Cifrado: ${path.relative(RAIZ, CIFRADO)} (${fs.statSync(CIFRADO).size} bytes)`)
}
