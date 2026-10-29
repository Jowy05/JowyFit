// Seguridad: claves que escribe el usuario, imágenes de fuera, Open Food Facts manipulado, la política de
// contenido (CSP) de la compilación y la huella del catálogo RepDB. Cada prueba fallaba antes de los arreglos.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { dosisDe, imagenOFF, leerOFF } from '../src/dominio/comida'
import { propio } from '../src/dominio/claves'
import { desdeReferencia } from '../src/dominio/progresion'
import { cspPara } from '../vite.config'

const RAIZ = path.resolve(import.meta.dirname, '..')
const NOMBRES_RAROS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__']

describe('seguridad · claves que escribe el usuario («constructor», «__proto__»…)', () => {
  for (const s of NOMBRES_RAROS) {
    it(`dosisDe con un suplemento llamado «${s}» no rompe (antes: «trim is not a function»)`, () => {
      expect(() => dosisDe({ Creatina: '5 g' }, s)).not.toThrow()
      expect(dosisDe({ Creatina: '5 g' }, s)).toBe('')
      expect(dosisDe(undefined, s)).toBe('')
    })
  }
  it('la dosis propia de un nombre raro sí se lee si está guardada de verdad', () => {
    const d: Record<string, string> = { Creatina: '5 g' }
    Object.defineProperty(d, '__proto__', { value: ' 2 g ', enumerable: true })
    d.constructor = '1 g' as never
    expect(dosisDe(d, '__proto__')).toBe('2 g')
    expect(dosisDe(d, 'constructor')).toBe('1 g')
    expect(dosisDe(d, 'Creatina')).toBe('5 g')
  })
  it('propio solo devuelve lo que el objeto tiene', () => {
    for (const s of NOMBRES_RAROS) expect(propio({ a: 1 }, s)).toBeUndefined()
    expect(propio({ a: 1 }, 'a')).toBe(1)
    expect(propio(undefined, 'a')).toBeUndefined()
  })
  it('referencias con nombres raros no rompen la primera carga', () => {
    for (const s of NOMBRES_RAROS) expect(() => desdeReferencia(s, { banca: '40 kg × 8' }, { repsMin: 8, rpe: 8 }, [])).not.toThrow()
  })
})

describe('seguridad · imágenes de fuera (píxel espía)', () => {
  it('imagenOFF solo deja https de Open Food Facts', () => {
    expect(imagenOFF('https://images.openfoodfacts.org/images/products/1/front.jpg')).toBe('https://images.openfoodfacts.org/images/products/1/front.jpg')
    expect(imagenOFF('https://static.openfoodfacts.net/x.png')).toBeTruthy()
    for (const u of ['https://seguimiento.invalid/p.gif', 'http://images.openfoodfacts.org/x.jpg', 'javascript:alert(1)', 'data:image/svg+xml,<svg>', 'https://openfoodfacts.org.malo.example/x', 'https://evilopenfoodfacts.org/x', '//images.openfoodfacts.org/x', 'blob:https://x/1', '', 42, null, {}]) {
      expect(imagenOFF(u), String(u)).toBeUndefined()
    }
  })
  it('leerOFF descarta la imagen de un servidor ajeno y recorta nombres enormes', () => {
    const p = leerOFF('8410000000002', { status: 1, product: { product_name: 'Ä'.repeat(100_000), brands: 'M'.repeat(5000) + ',Otra', image_front_small_url: 'https://seguimiento.invalid/p.gif', image_front_url: 'https://images.openfoodfacts.org/f.jpg' } })!
    expect(p.imagen).toBe('https://images.openfoodfacts.org/f.jpg')
    expect(p.nombre.length).toBeLessThanOrEqual(150)
    expect(p.marca.length).toBeLessThanOrEqual(80)
    const q = leerOFF('1', { status: 1, product: { product_name: { a: 1 } as never, brands: 7 as never, image_front_url: 'javascript:alert(1)' } })!
    expect(q.imagen).toBeUndefined()
    expect(q.nombre).toBe('Producto 1')
    expect(q.marca).toBe('')
  })
})

describe('seguridad · Content-Security-Policy de la compilación', () => {
  const index = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(RAIZ, 'app.html'), 'utf8')
  const valor = (csp: string, dir: string) => csp.split('; ').find(d => d.startsWith(`${dir} `))?.slice(dir.length + 1) ?? ''
  it('index.html: los scripts en línea van con su huella sha256 y no se permite cualquiera', () => {
    const csp = cspPara(index)
    const scripts = valor(csp, 'script-src')
    const enLinea = [...index.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    expect(enLinea.length).toBeGreaterThanOrEqual(2)
    expect(scripts.match(/'sha256-/g)).toHaveLength(enLinea.length)
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
    expect(scripts).toContain("'wasm-unsafe-eval'")
  })
  it('las imágenes y las conexiones solo a la app y a Open Food Facts', () => {
    const csp = cspPara(app)
    expect(valor(csp, 'img-src')).toBe("'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org")
    expect(valor(csp, 'connect-src')).toBe("'self' https://world.openfoodfacts.org")
    expect(valor(csp, 'object-src')).toBe("'none'")
    expect(valor(csp, 'form-action')).toBe("'none'")
    expect(csp).not.toMatch(/googleapis|gstatic|\*/)
  })
  it('la misma política en la web y en el APK: nunca «unsafe-inline» en los scripts (antes el APK lo llevaba)', () => {
    expect(valor(cspPara(app), 'script-src')).toBe("'self' 'wasm-unsafe-eval'")
  })
})

describe('seguridad · huella del catálogo RepDB', () => {
  it('lo que no es la versión revisada se para con un mensaje claro', async () => {
    const { comprobarRepDB } = await import('../scripts/preparar-repdb.mjs')
    expect(() => comprobarRepDB(Buffer.from('zip cambiado'))).toThrow(/no es el esperado[\s\S]*Huella esperada/)
  })
  const zip = path.join(RAIZ, '.cache', 'repdb', 'repdb-free.zip')
  it.skipIf(!fs.existsSync(zip))('el zip revisado (13/10) pasa', async () => {
    const { comprobarRepDB } = await import('../scripts/preparar-repdb.mjs')
    expect(() => comprobarRepDB(fs.readFileSync(zip))).not.toThrow()
  })
})

describe('seguridad · textos de RepDB en catalán, cifrados en el repositorio', () => {
  it('se descifran tal cual con la clave buena; con otra clave o tocados, falla', async () => {
    const { cifrar, descifrar } = await import('../scripts/repdb-ca.mjs')
    const k = Buffer.alloc(32, 7)
    const json = JSON.stringify({ ejercicios: { 'push-up': { nombre: 'Flexions' } } })
    const c = cifrar(json, k)
    expect(c.toString('utf8')).not.toContain('Flexions')
    expect(descifrar(c, k)).toBe(json)
    expect(() => descifrar(c, Buffer.alloc(32, 8))).toThrow()
    const tocado = Buffer.from(c)
    tocado.writeUInt8(tocado.readUInt8(tocado.length - 1) ^ 1, tocado.length - 1)
    expect(() => descifrar(tocado, k)).toThrow()
  })
})
