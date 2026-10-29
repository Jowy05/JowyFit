// Copias con contraseña: ida y vuelta, contraseña mala, archivo tocado o cortado, cabeceras raras y la clave guardada.
import { describe, expect, it } from 'vitest'
import { claveDe, cifrar, ContrasenaMala, descifrar, esCifrada, EXTRA_CIFRADO, largoContrasena, MARCA_CIFRADA, VUELTAS } from '../src/datos/cifrado'
import { leerClaveCopias, ponerContrasena, quitarContrasena } from '../src/datos/claveCopias'

// Dónde va cada cosa en la cabecera: la marca, las vueltas (4 bytes) y la sal.
const POS_VUELTAS = MARCA_CIFRADA.length
const POS_SAL = POS_VUELTAS + 4

const zip = new Uint8Array([0x50, 0x4b, 3, 4, ...Array.from({ length: 300 }, (_, i) => i % 251)])

describe('cifrado de las copias', () => {
  it('ida y vuelta con la contraseña buena; la clave sacada sirve para la copia siguiente', async () => {
    const c = await claveDe('mesa azul 7')
    const cif = await cifrar(zip, c)
    expect(esCifrada(cif)).toBe(true)
    expect(esCifrada(zip)).toBe(false)
    expect(cif.length).toBe(zip.length + EXTRA_CIFRADO)
    const r = await descifrar(cif, 'mesa azul 7')
    expect([...r.zip]).toEqual([...zip])
    expect(r.clave.vueltas).toBe(VUELTAS)
    // Con la clave devuelta se cifra otra copia que abre la misma contraseña.
    expect([...(await descifrar(await cifrar(zip, r.clave), 'mesa azul 7')).zip]).toEqual([...zip])
  })

  it('cada copia lleva su IV: dos copias iguales no se parecen', async () => {
    const c = await claveDe('mesa azul 7')
    const [a, b] = [await cifrar(zip, c), await cifrar(zip, c)]
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it('contraseña mala, un byte cambiado, la cabecera tocada o el archivo cortado: no se abre', async () => {
    const cif = await cifrar(zip, await claveDe('mesa azul 7'))
    await expect(descifrar(cif, 'mesa azul 8')).rejects.toBeInstanceOf(ContrasenaMala)
    const tocado = cif.slice(); tocado[tocado.length - 40]! ^= 1
    await expect(descifrar(tocado, 'mesa azul 7')).rejects.toBeInstanceOf(ContrasenaMala)
    const sal = cif.slice(); sal[POS_SAL + 2]! ^= 1
    await expect(descifrar(sal, 'mesa azul 7')).rejects.toBeInstanceOf(ContrasenaMala)
    await expect(descifrar(cif.slice(0, cif.length - 1), 'mesa azul 7')).rejects.toBeInstanceOf(ContrasenaMala)
    await expect(descifrar(cif.slice(0, 30), 'mesa azul 7')).rejects.toThrow(/dañado/)
  })

  it('vueltas fuera de lo normal en la cabecera: se rechaza sin ponerse a calcular', async () => {
    const cif = await cifrar(zip, await claveDe('mesa azul 7'))
    for (const v of [1, VUELTAS - 1, 2_000_001, 0xffffffff]) {
      const raro = cif.slice()
      new DataView(raro.buffer).setUint32(POS_VUELTAS, v)
      await expect(descifrar(raro, 'mesa azul 7')).rejects.toThrow(/dañado/)
    }
  })

  it('la contraseña se normaliza: «á» compuesta o separada abre igual y cuenta una letra', async () => {
    const cif = await cifrar(zip, await claveDe('canción 1234'))
    expect([...(await descifrar(cif, 'canción 1234')).zip]).toEqual([...zip])
    expect(largoContrasena('canción')).toBe(7)
    expect(largoContrasena('💪💪💪💪')).toBe(4)
  })
})

describe('la clave guardada en el móvil', () => {
  it('se guarda no extraíble, se lee, cifra y se borra', async () => {
    await ponerContrasena('mesa azul 7')
    const c = await leerClaveCopias()
    expect(c?.clave.extractable).toBe(false)
    expect([...(await descifrar(await cifrar(zip, c!), 'mesa azul 7')).zip]).toEqual([...zip])
    await quitarContrasena()
    expect(await leerClaveCopias()).toBeNull()
  })
})
