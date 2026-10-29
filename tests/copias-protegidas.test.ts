// Copias con contraseña y limpieza de las automáticas: nombres, exportar cifrado, recuperar con la contraseña
// (que se queda puesta), la copia semanal que borra las que sobran y «Borrarlas» sin quedarse nunca sin copia.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { strToU8 } from 'fflate'
import { db, TABLAS } from '../src/datos/db'
import { abrirCifrada, exportarCopia, importar, PideContrasena, recuperarCifrada } from '../src/datos/copias'
import { ContrasenaMala, descifrar, esCifrada } from '../src/datos/cifrado'
import { leerClaveCopias, ponerContrasena, quitarContrasena } from '../src/datos/claveCopias'
import { automaticasDeMasNueva, esCifradaPorNombre, esCopiaAuto, nombreCopia, type CopiasAuto } from '../src/dominio/copias'
import { ajustesPorDefecto, perfilPorDefecto } from '../src/datos/repos'

const cuenta = async () => Object.fromEntries(await Promise.all(TABLAS.map(async t => [t, await db.table(t).count()])))

async function sembrar() {
  await db.delete(); await db.open()
  await quitarContrasena()
  await db.perfil.put({ ...perfilPorDefecto(), nombre: 'Dueño', altaCompleta: true })
  await db.ajustes.put({ ...ajustesPorDefecto(), ultimaCopia: null })
  for (let i = 0; i < 3; i++) await db.mediciones.add({ fecha: `2026-10-1${i}T08:00`, origen: 'casa', pesoKg: 80 - i })
}
beforeEach(sembrar)

describe('nombres de las copias', () => {
  const f = new Date(2026, 10, 1, 19, 5)
  it('a mano, automática y con contraseña; «-2» antes de «-cifrada» si coincide el minuto', () => {
    expect(nombreCopia(f)).toBe('jowyfit-2026-11-01-1905.jowyfit')
    expect(nombreCopia(f, [], { auto: true, cifrada: true })).toBe('jowyfit-auto-2026-11-01-1905-cifrada.jowyfit')
    expect(nombreCopia(f, ['jowyfit-2026-11-01-1905-cifrada.jowyfit'], { cifrada: true })).toBe('jowyfit-2026-11-01-1905-2-cifrada.jowyfit')
  })
  it('la lista sabe cuál es automática y cuál va cifrada sin abrirla; también si el móvil la renombró al duplicarla', () => {
    expect(esCopiaAuto('jowyfit-auto-2026-11-01-1905.jowyfit')).toBe(true)
    expect(esCopiaAuto('jowyfit-2026-10-12-1900.jowyfit')).toBe(false)
    expect(esCifradaPorNombre('jowyfit-2026-11-01-1905-2-cifrada.jowyfit')).toBe(true)
    expect(esCifradaPorNombre('jowyfit-2026-11-01-1905-cifrada (1).jowyfit')).toBe(true)
    expect(esCifradaPorNombre('jowyfit-2026-10-12-1900.jowyfit')).toBe(false)
  })
  it('las automáticas, de la más nueva a la más vieja por la fecha del nombre; «-2» después de la primera', () => {
    expect(automaticasDeMasNueva([
      'jowyfit-auto-2026-09-01-1900.jowyfit', 'jowyfit-2026-12-01-1900.jowyfit', 'jowyfit-auto-2026-10-01-1900-cifrada.jowyfit',
      'jowyfit-auto-2026-10-01-1900-2-cifrada.jowyfit',
    ])).toEqual(['jowyfit-auto-2026-10-01-1900-2-cifrada.jowyfit', 'jowyfit-auto-2026-10-01-1900-cifrada.jowyfit', 'jowyfit-auto-2026-09-01-1900.jowyfit'])
  })
})

describe('copias con contraseña', () => {
  it('sin contraseña puesta, la copia es el zip de siempre', async () => {
    const c = await exportarCopia()
    expect(c.cifrada).toBe(false)
    expect([c.bytes[0], c.bytes[1]]).toEqual([0x50, 0x4b])
  })

  it('con contraseña: va cifrada, «importar» la para sin tocar nada y la contraseña mala no la abre', async () => {
    await ponerContrasena('mesa azul 7')
    const c = await exportarCopia()
    expect(c.cifrada).toBe(true)
    expect(esCifrada(c.bytes)).toBe(true)
    // Nada legible dentro: ni el nombre ni «datos.json».
    expect(Buffer.from(c.bytes).includes(Buffer.from('Dueño'))).toBe(false)
    expect(Buffer.from(c.bytes).includes(Buffer.from('datos.json'))).toBe(false)
    const antes = await cuenta()
    await expect(importar(c.bytes)).rejects.toBeInstanceOf(PideContrasena)
    await expect(abrirCifrada(c.bytes, 'mesa azul 8')).rejects.toBeInstanceOf(ContrasenaMala)
    expect(await cuenta()).toEqual(antes)
  })

  it('en otro móvil: se recupera con la contraseña y se queda puesta para las copias siguientes', async () => {
    await ponerContrasena('mesa azul 7')
    const c = await exportarCopia()
    // «Otro móvil»: base vacía y sin clave.
    await db.delete(); await db.open(); await quitarContrasena()
    const { zip, clave } = await abrirCifrada(c.bytes, 'mesa azul 7')
    expect(await recuperarCifrada(zip, clave)).toBe('copia')
    expect((await db.perfil.get('yo'))?.nombre).toBe('Dueño')
    expect(await db.mediciones.count()).toBe(3)
    const siguiente = await exportarCopia()
    expect(siguiente.cifrada).toBe(true)
    expect((await descifrar(siguiente.bytes, 'mesa azul 7')).zip.length).toBeGreaterThan(0)
  })

  it('si la copia de dentro no entra, no se cambia nada y vuelve la contraseña de antes', async () => {
    await ponerContrasena('otra de la copia')
    const deLaCopia = (await leerClaveCopias())!
    await ponerContrasena('la mía de antes')
    const antes = await cuenta()
    await expect(recuperarCifrada(strToU8('{"app":"JowyFit","version":99,"datos":{}}'), deLaCopia)).rejects.toThrow(/más nueva/)
    expect(await cuenta()).toEqual(antes)
    const ahora = (await exportarCopia()).bytes
    await expect(descifrar(ahora, 'otra de la copia')).rejects.toBeInstanceOf(ContrasenaMala)
    expect((await descifrar(ahora, 'la mía de antes')).zip.length).toBeGreaterThan(0)
  })

  it('«Guardar las automáticas» viaja en la copia; un valor raro se quita y vale el de siempre', async () => {
    await db.ajustes.update('app', { copiasAuto: 8 })
    await importar((await exportarCopia()).bytes)
    expect((await db.ajustes.get('app'))?.copiasAuto).toBe(8)
    await db.ajustes.update('app', { copiasAuto: 7 as unknown as CopiasAuto })
    await importar((await exportarCopia()).bytes)
    expect((await db.ajustes.get('app'))?.copiasAuto).toBe(4)
  })
})

describe('copias guardadas en el móvil: limpieza y «Borrarlas»', () => {
  type Carpeta = Map<string, { fecha: number; tam: number }>
  /** Documentos/JowyFit simulado (la fecha, la del archivo; la más nueva, la mayor). `falla`: la que no se deja borrar. */
  async function conCarpeta(o: { copias: string[]; tam?: (nombre: string) => number; falla?: string }, prueba: (c: typeof import('../src/app/copias'), carpeta: Carpeta) => Promise<void>) {
    const carpeta: Carpeta = new Map(o.copias.map((n, i) => [n, { fecha: i + 1, tam: o.tam?.(n) ?? 1 }]))
    let reloj = o.copias.length
    vi.resetModules()
    vi.doMock('../src/plataforma', async orig => ({
      ...((await orig()) as Record<string, unknown>),
      esNativo: () => true,
      guardarArchivo: async (n: string, b: Uint8Array) => { carpeta.set(n, { fecha: ++reloj, tam: b.length }); return n },
      copiasGuardadas: async () => [...carpeta].map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => b.fecha - a.fecha),
      borrarCopiaGuardada: async (n: string) => { if (n === o.falla) throw new Error('sin permiso'); carpeta.delete(n) },
    }))
    try { await prueba(await import('../src/app/copias'), carpeta) }
    finally { vi.doUnmock('../src/plataforma'); vi.resetModules() }
  }
  // La clave se pone con el módulo recién cargado: es la misma IndexedDB.
  const poner = async (c: string) => (await import('../src/datos/claveCopias')).ponerContrasena(c)
  const autos = (n: number) => Array.from({ length: n }, (_, i) => `jowyfit-auto-2026-09-${String(i + 1).padStart(2, '0')}-1900.jowyfit`)
  const aMano = ['jowyfit-2026-08-01-1000.jowyfit', 'jowyfit-2026-08-02-1000-cifrada.jowyfit']

  it('la copia semanal sale «auto» y cifrada y deja solo las 4 automáticas más nuevas; las hechas a mano no se tocan', async () => {
    await conCarpeta({ copias: [...aMano, ...autos(6)] }, async (s, carpeta) => {
      await poner('mesa azul 7')
      expect(await s.copiaAutomatica()).toBe(true)
      const quedan = [...carpeta.keys()]
      const nueva = quedan.find(n => n.startsWith('jowyfit-auto-') && n.endsWith('-cifrada.jowyfit'))
      expect(nueva).toBeTruthy()
      expect(quedan.filter(esCopiaAuto).sort()).toEqual([...autos(6).slice(3), nueva].sort())
      for (const n of aMano) expect(carpeta.has(n)).toBe(true)
    })
  })

  it('si la copia nueva ocupa menos de la mitad que la última, no se borra ninguna vieja (se perdió algo)', async () => {
    await conCarpeta({ copias: autos(6), tam: () => 50 * 1024 * 1024 }, async (s, carpeta) => {
      expect(await s.copiaAutomatica()).toBe(true)
      expect([...carpeta.keys()].filter(esCopiaAuto)).toHaveLength(7)
    })
  })

  it('con «Todas» no se borra ninguna', async () => {
    await conCarpeta({ copias: autos(6) }, async s => { expect(await s.limpiarAutomaticas(0)).toBe(0) })
  })

  it('si una no se puede borrar, se sigue con las demás', async () => {
    await conCarpeta({ copias: autos(6), falla: autos(6)[0] }, async (s, carpeta) => {
      expect(await s.limpiarAutomaticas(2)).toBe(3)
      expect(carpeta.has(autos(6)[0]!)).toBe(true)
    })
  })

  it('«Borrarlas»: sin contraseña no hace nada; con ella, primero una copia protegida y luego fuera las que no la llevan', async () => {
    const renombrada = 'jowyfit-2026-08-03-1000-cifrada (1).jowyfit'
    await conCarpeta({ copias: [...aMano, renombrada, ...autos(2)] }, async (s, carpeta) => {
      await expect(s.protegerCopiasGuardadas()).rejects.toThrow(/contraseña/)
      expect(carpeta.size).toBe(5)
      await poner('mesa azul 7')
      expect(await s.protegerCopiasGuardadas()).toBe(3)
      const quedan = [...carpeta.keys()]
      expect(quedan).toHaveLength(3)
      expect(quedan).toContain(renombrada)
      expect(quedan.every(esCifradaPorNombre)).toBe(true)
    })
  })
})
