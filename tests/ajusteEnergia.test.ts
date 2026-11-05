// Historial de los ajustes de cada 2 semanas (src/dominio/ajusteEnergia.ts y src/datos/acciones/energia.ts):
// cuándo toca, qué se guarda (antes, después y por qué), cómo se cuenta y que la copia lo conserva.
import { beforeEach, describe, expect, it } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import { guardarAjustes, leerAjustes, perfilPorDefecto } from '../src/datos/repos'
import { registrarAjusteEnergia } from '../src/datos/acciones/energia'
import { exportar, importar } from '../src/datos/copias'
import { anadirAjuste, cambioAjuste, cambioPeso, DIAS_AJUSTE, HISTORIAL_MAX, nuevoAjuste, porqueAjuste, tocaAjuste } from '../src/dominio/ajusteEnergia'
import { textoConsejo } from '../src/dominio/resumen'
import type { AjusteEnergia, Medicion } from '../src/datos/tipos'

const ajuste = (x: Partial<AjusteEnergia> = {}): AjusteEnergia => ({
  fecha: '2026-11-01', antes: { kcal: 2250, proteina: 145, peso: 80 }, despues: { kcal: 2200, proteina: 140, peso: 78.5 }, porque: 'baja-cintura', ...x,
})

describe('cuándo toca', () => {
  it('el primero en cuanto se abre la app; luego, a los 14 días del último', () => {
    expect(DIAS_AJUSTE).toBe(14)
    expect(tocaAjuste(null, '2026-11-01')).toBe(true)
    expect(tocaAjuste(undefined, '2026-11-01')).toBe(true)
    expect(tocaAjuste('2026-11-01', '2026-11-01')).toBe(false)
    expect(tocaAjuste('2026-11-01', '2026-11-14')).toBe(false)
    expect(tocaAjuste('2026-11-01', '2026-11-15')).toBe(true)
    // Si no se abre la app en un mes, toca igual (uno solo).
    expect(tocaAjuste('2026-10-01', '2026-11-15')).toBe(true)
  })
})

describe('qué se guarda', () => {
  const ahora = { kcal: 2100, proteina: 140, peso: 78 }
  it('sin historial es el punto de partida: sin «antes» y «inicio» aunque el consejo sea otro', () => {
    expect(nuevoAjuste({ hoy: '2026-11-01', historial: [], ahora, porque: 'baja-cintura', manual: false }))
      .toEqual({ fecha: '2026-11-01', antes: null, despues: ahora, porque: 'inicio' })
  })
  it('con historial, el «antes» es el «después» del último', () => {
    const a = nuevoAjuste({ hoy: '2026-11-15', historial: [ajuste()], ahora, porque: 'estable', manual: true })
    expect(a).toEqual({ fecha: '2026-11-15', antes: ajuste().despues, despues: ahora, porque: 'estable', manual: true })
  })
  it('se queda con los más nuevos', () => {
    let h: AjusteEnergia[] = []
    for (let i = 0; i < HISTORIAL_MAX + 5; i++) h = anadirAjuste(h, ajuste({ fecha: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, despues: { kcal: i, proteina: 1, peso: null } }))
    expect(h).toHaveLength(HISTORIAL_MAX)
    expect(h[h.length - 1]!.despues.kcal).toBe(HISTORIAL_MAX + 4)
    expect(h[0]!.despues.kcal).toBe(5)
  })
})

describe('cómo se cuenta', () => {
  it('el cambio del objetivo, el del peso y el porqué', () => {
    expect(cambioAjuste(ajuste())).toBe('~2250 → ~2200 kcal · 145 → 140 g de proteína')
    expect(cambioAjuste(ajuste({ antes: null }))).toBe('Empiezas con ~2200 kcal y 140 g de proteína')
    expect(cambioAjuste(ajuste({ antes: { kcal: 2200, proteina: 140, peso: 80 } }))).toBe('Igual que antes: ~2200 kcal y 140 g de proteína')
    expect(cambioPeso(ajuste())).toBe('Tu peso: 80 → 78,5 kg')
    expect(cambioPeso(ajuste({ antes: null }))).toBeNull()
    expect(cambioPeso(ajuste({ despues: { kcal: 1, proteina: 1, peso: 80.04 } }))).toBeNull()
    expect(porqueAjuste(ajuste())).toBe(textoConsejo('baja-cintura'))
    expect(porqueAjuste(ajuste({ porque: 'inicio', antes: null }))).toMatch(/^Punto de partida/)
    expect(porqueAjuste(ajuste({ manual: true }))).toMatch(/a mano/)
  })
})

describe('al abrir la app (registrarAjusteEnergia)', () => {
  const medir = (fecha: string, pesoKg: number, cintura?: number): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', pesoKg, ...(cintura ? { perimetros: { cintura } } : {}) })
  beforeEach(async () => {
    for (const t of TABLAS) await db.table(t).clear()
    await db.perfil.put({ ...perfilPorDefecto(), altaCompleta: true, nacimiento: '1980-01-01', alturaCm: 178 })
    await leerAjustes()
    await db.mediciones.bulkAdd([medir('2026-10-20', 80, 95), medir('2026-10-25', 80, 95)])
  })

  it('sin el alta hecha no guarda nada', async () => {
    await db.perfil.put({ ...perfilPorDefecto(), altaCompleta: false })
    expect(await registrarAjusteEnergia('2026-11-01')).toBeNull()
    expect((await leerAjustes()).historialEnergia).toEqual([])
  })

  it('guarda el punto de partida, no repite antes de 2 semanas y luego guarda antes, después y por qué', async () => {
    const primero = await registrarAjusteEnergia('2026-11-01')
    expect(primero).toMatchObject({ fecha: '2026-11-01', antes: null, porque: 'inicio', despues: { peso: 80 } })
    expect(primero!.despues.kcal).toBeGreaterThan(1000)
    expect((await leerAjustes()).ultimoAjusteEnergia).toBe('2026-11-01')

    // El mismo día (al volver a la app) y a los 13 días, nada.
    expect(await registrarAjusteEnergia('2026-11-01')).toBeNull()
    expect(await registrarAjusteEnergia('2026-11-14')).toBeNull()

    // Baja el peso y la cintura: el objetivo baja y el porqué es el consejo de la quincena.
    await db.mediciones.bulkAdd([medir('2026-11-10', 78.5), medir('2026-11-14', 78, 93)])
    const segundo = await registrarAjusteEnergia('2026-11-15')
    expect(segundo).toMatchObject({ fecha: '2026-11-15', antes: primero!.despues, porque: 'baja-cintura', despues: { peso: 78 } })
    expect(segundo!.despues.kcal).toBeLessThanOrEqual(primero!.despues.kcal)
    expect(segundo!.manual).toBeUndefined()
    const a = await leerAjustes()
    expect(a.historialEnergia).toEqual([primero, segundo])
    expect(a.ultimoAjusteEnergia).toBe('2026-11-15')
  })

  it('a la vez (abrir y volver a la app) se guarda una sola vez', async () => {
    const [x, y] = await Promise.all([registrarAjusteEnergia('2026-11-01'), registrarAjusteEnergia('2026-11-01')])
    expect([x, y].filter(Boolean)).toHaveLength(1)
    expect((await leerAjustes()).historialEnergia).toHaveLength(1)
  })

  it('con el objetivo puesto a mano, se guarda el suyo y se marca', async () => {
    await guardarAjustes({ kcalManual: 1900, proteinaManual: 150 })
    const a = await registrarAjusteEnergia('2026-11-01')
    expect(a).toMatchObject({ despues: { kcal: 1900, proteina: 150 }, manual: true })
  })

  it('la copia de seguridad conserva el historial', async () => {
    await registrarAjusteEnergia('2026-11-01')
    const antes = (await leerAjustes()).historialEnergia
    const bytes = await exportar()
    for (const t of TABLAS) await db.table(t).clear()
    expect(await importar(bytes)).toBe('copia')
    expect((await leerAjustes()).historialEnergia).toEqual(antes)
  })
})
