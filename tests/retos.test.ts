// Pruebas de Retos: catálogo, récords, rachas, motor de postura (flexiones, sentadillas y plancha) y guardado en base.
import { beforeEach, describe, expect, it } from 'vitest'
import { db, TABLAS } from '../src/datos/db'
import { borrarIntentoReto, guardarIntentoReto } from '../src/datos/acciones/retos'
import {
  esMejorMarca, esNuevoRecordReto, formatoTiempoReto, mejorMarcaReto, rachaRetos, RETOS, retoDe,
  textoComparativaRecord, textoMarcaReto, textoRetoHoy,
} from '../src/dominio/retos'
import {
  alineacionCadera, angulo, estadoPosturaInicial, evaluarPostura, inclinacionVertical, type PuntosPostura,
} from '../src/dominio/postura'
import type { IntentoReto } from '../src/datos/tipos'

const pt = (x: number, y: number, confianza = 0.9) => ({ x, y, confianza })

describe('dominio/retos: marcas, récords y rachas', () => {
  it('incluye los 5 retos previstos (60 s, plancha y contrarreloj)', () => {
    expect(RETOS.map(r => r.id)).toEqual(['flexiones-60', 'sentadillas-60', 'plancha-max', 'flexiones-20', 'sentadillas-30'])
    expect(retoDe('flexiones-60').duracionS).toBe(60)
    expect(retoDe('flexiones-20').objetivoReps).toBe(20)
  })

  it('compara marcas según modo (más reps / más tiempo vs menos tiempo)', () => {
    expect(esMejorMarca(35, 34, 'mas-reps')).toBe(true)
    expect(esMejorMarca(34, 34, 'mas-reps')).toBe(false)
    expect(esMejorMarca(95, 90, 'mas-tiempo')).toBe(true)
    expect(esMejorMarca(25, 28, 'menos-tiempo')).toBe(true)
    expect(esMejorMarca(30, 28, 'menos-tiempo')).toBe(false)
    expect(esMejorMarca(0, 28, 'menos-tiempo')).toBe(false)
  })

  it('calcula mejor marca, nuevo récord y textos comparativos', () => {
    const intentos: IntentoReto[] = [
      { id: 1, fecha: '2026-11-20T08:00', reto: 'flexiones-60', valor: 25, duracionS: 60, modo: 'camara', record: true },
      { id: 2, fecha: '2026-11-21T08:00', reto: 'flexiones-60', valor: 34, duracionS: 60, modo: 'camara', record: true },
      { id: 3, fecha: '2026-11-21T09:00', reto: 'flexiones-20', valor: 32, duracionS: 32, modo: 'camara', record: true },
      { id: 4, fecha: '2026-11-22T09:00', reto: 'flexiones-20', valor: 28, duracionS: 28, modo: 'camara', record: true },
    ]
    const mejorFlex = mejorMarcaReto(intentos, 'flexiones-60')
    expect(mejorFlex?.valor).toBe(34)
    expect(esNuevoRecordReto(intentos, 'flexiones-60', 35)).toBe(true)
    expect(esNuevoRecordReto(intentos, 'flexiones-60', 34)).toBe(false)

    const mejorCrono = mejorMarcaReto(intentos, 'flexiones-20')
    expect(mejorCrono?.valor).toBe(28)
    expect(esNuevoRecordReto(intentos, 'flexiones-20', 26)).toBe(true)
    expect(esNuevoRecordReto(intentos, 'flexiones-20', 29)).toBe(false)

    expect(formatoTiempoReto(45)).toBe('45 s')
    expect(formatoTiempoReto(105)).toBe('1:45')
    expect(textoMarcaReto(1, 'mas-reps')).toBe('1 rep')
    expect(textoMarcaReto(34, 'mas-reps')).toBe('34 reps')
    expect(textoRetoHoy(mejorFlex, retoDe('flexiones-60'))).toContain('34')
    expect(textoRetoHoy(mejorCrono, retoDe('flexiones-20'))).toContain('28 s')
    expect(textoComparativaRecord(37, mejorFlex, retoDe('flexiones-60'))).toContain('+3')
    expect(textoComparativaRecord(24, mejorCrono, retoDe('flexiones-20'))).toContain('4 s')
  })

  it('calcula racha actual y mejor racha histórica', () => {
    const intento = (fecha: string): IntentoReto => ({ fecha, reto: 'flexiones-60', valor: 20, duracionS: 60, modo: 'manual' })
    const lista = [
      intento('2026-11-10T08:00'),
      intento('2026-11-11T08:00'),
      intento('2026-11-12T08:00'),
      intento('2026-11-13T08:00'), // racha histórica de 4
      intento('2026-11-23T08:00'),
      intento('2026-11-24T08:00'),
      intento('2026-11-25T08:00'), // racha actual de 3
    ]
    expect(rachaRetos(lista, '2026-11-25')).toEqual({ actual: 3, mejor: 4, hechoHoy: true })
    expect(rachaRetos(lista, '2026-11-26')).toEqual({ actual: 3, mejor: 4, hechoHoy: false })
    expect(rachaRetos(lista, '2026-11-27')).toEqual({ actual: 0, mejor: 4, hechoHoy: false })
  })
})

describe('dominio/postura: geometría y conteo válido/inválido', () => {
  it('mide ángulos, inclinación vertical y alineación de cadera', () => {
    expect(Math.round(angulo(pt(0, 0), pt(0, 1), pt(1, 1)))).toBe(90)
    expect(Math.round(angulo(pt(0, 0), pt(1, 0), pt(2, 0)))).toBe(180)
    expect(Math.round(inclinacionVertical(pt(0.5, 0.2), pt(0.5, 0.6)))).toBe(0)
    expect(Math.round(inclinacionVertical(pt(0.9, 0.2), pt(0.5, 0.6)))).toBe(45)
    expect(alineacionCadera(pt(0.2, 0.5), pt(0.5, 0.5), pt(0.8, 0.5)).estado).toBe('bien')
    expect(alineacionCadera(pt(0.2, 0.5), pt(0.5, 0.72), pt(0.8, 0.5)).estado).toBe('caida')
    expect(alineacionCadera(pt(0.2, 0.5), pt(0.5, 0.28), pt(0.8, 0.5)).estado).toBe('alta')
  })

  it('flexiones: cuenta una repetición válida y rechaza una media flexión o cadera caída', () => {
    const flexArriba: PuntosPostura = {
      cara: pt(0.18, 0.35),
      hombroIzq: pt(0.25, 0.4), codoIzq: pt(0.25, 0.6), munecaIzq: pt(0.25, 0.8), // 180°
      caderaIzq: pt(0.55, 0.48), tobilloIzq: pt(0.85, 0.56), // alineado
    }
    const flexAbajoBien: PuntosPostura = {
      cara: pt(0.18, 0.62),
      hombroIzq: pt(0.25, 0.65), codoIzq: pt(0.38, 0.68), munecaIzq: pt(0.25, 0.82), // < 90°
      caderaIzq: pt(0.55, 0.7), tobilloIzq: pt(0.85, 0.75), // alineado
    }
    const flexParcial: PuntosPostura = {
      ...flexArriba,
      hombroIzq: pt(0.25, 0.5), codoIzq: pt(0.332, 0.65), munecaIzq: pt(0.25, 0.8), // ~124° (insuficiente)
    }
    const flexCaderaCaida: PuntosPostura = {
      ...flexAbajoBien,
      caderaIzq: pt(0.55, 0.92), // cadera muy caída
    }

    let e = estadoPosturaInicial()
    e = evaluarPostura(e, flexArriba, 'flexiones', 1000)
    e = evaluarPostura(e, flexAbajoBien, 'flexiones', 1400)
    e = evaluarPostura(e, flexArriba, 'flexiones', 1900)
    expect(e.validas).toBe(1)
    expect(e.invalidas).toBe(0)

    // Media flexión (no llega abajo) -> suma inválida y avisa
    e = evaluarPostura(e, flexParcial, 'flexiones', 2400)
    e = evaluarPostura(e, flexArriba, 'flexiones', 2900)
    expect(e.validas).toBe(1)
    expect(e.invalidas).toBe(1)
    expect(e.aviso).toMatch(/pecho/i)

    // Flexión profunda pero con cadera caída -> inválida y avisa de cadera
    e = evaluarPostura(e, flexCaderaCaida, 'flexiones', 3400)
    e = evaluarPostura(e, flexArriba, 'flexiones', 4000)
    expect(e.validas).toBe(1)
    expect(e.invalidas).toBe(2)
    expect(e.aviso).toMatch(/cadera/i)
  })

  it('sentadillas: cuenta sentadilla profunda y rechaza media sentadilla o espalda muy inclinada', () => {
    const arriba: PuntosPostura = {
      cara: pt(0.5, 0.12), hombroIzq: pt(0.5, 0.25), caderaIzq: pt(0.5, 0.5),
      rodillaIzq: pt(0.5, 0.74), tobilloIzq: pt(0.5, 0.95), // 180°
    }
    const abajoBien: PuntosPostura = {
      cara: pt(0.5, 0.34), hombroIzq: pt(0.47, 0.45), caderaIzq: pt(0.45, 0.72),
      rodillaIzq: pt(0.62, 0.74), tobilloIzq: pt(0.5, 0.95), // rodilla < 90°, tronco erguido
    }
    const mediaSentadilla: PuntosPostura = {
      cara: pt(0.5, 0.2), hombroIzq: pt(0.5, 0.32), caderaIzq: pt(0.48, 0.56),
      rodillaIzq: pt(0.585, 0.74), tobilloIzq: pt(0.5, 0.95), // ~126° (parcial)
    }

    let e = estadoPosturaInicial()
    e = evaluarPostura(e, arriba, 'sentadillas', 1000)
    e = evaluarPostura(e, abajoBien, 'sentadillas', 1500)
    e = evaluarPostura(e, arriba, 'sentadillas', 2100)
    expect(e.validas).toBe(1)
    expect(e.invalidas).toBe(0)

    e = evaluarPostura(e, mediaSentadilla, 'sentadillas', 2700)
    e = evaluarPostura(e, arriba, 'sentadillas', 3300)
    expect(e.validas).toBe(1)
    expect(e.invalidas).toBe(1)
    expect(e.aviso).toMatch(/cadera/i)
  })

  it('plancha: acumula segundos solo cuando la cadera está alineada', () => {
    const recta: PuntosPostura = {
      hombroIzq: pt(0.2, 0.5), caderaIzq: pt(0.5, 0.52), rodillaIzq: pt(0.68, 0.54), tobilloIzq: pt(0.85, 0.56),
    }
    const caida: PuntosPostura = {
      hombroIzq: pt(0.2, 0.5), caderaIzq: pt(0.5, 0.78), rodillaIzq: pt(0.68, 0.65), tobilloIzq: pt(0.85, 0.56),
    }
    let e = estadoPosturaInicial()
    e = evaluarPostura(e, recta, 'plancha', 1000)
    e = evaluarPostura(e, recta, 'plancha', 1500)
    e = evaluarPostura(e, recta, 'plancha', 2000)
    expect(e.segundosValidos).toBeCloseTo(1, 2)
    e = evaluarPostura(e, caida, 'plancha', 2500)
    expect(e.posturaBien).toBe(false)
    expect(e.segundosValidos).toBeCloseTo(1, 2)

    // De pie no cuenta como plancha aunque el cuerpo esté recto
    const dePie: PuntosPostura = {
      hombroIzq: pt(0.5, 0.2), caderaIzq: pt(0.5, 0.52), rodillaIzq: pt(0.5, 0.74), tobilloIzq: pt(0.5, 0.95),
    }
    e = evaluarPostura(e, dePie, 'plancha', 3000)
    expect(e.posturaBien).toBe(false)
    expect(e.segundosValidos).toBeCloseTo(1, 2)
  })

  it('usa coordenadas 3D (worldLandmarks) para detectar sentadilla y flexión frontales sin distorsión', () => {
    const pt3 = (x: number, y: number, z: number, confianza = 0.92) => ({ x, y, z, confianza })
    // Sentadilla frontal: las rodillas avanzan hacia la cámara en Z
    const pie3D: PuntosPostura = {
      hombroIzq: pt3(-0.18, -0.52, 0), hombroDer: pt3(0.18, -0.52, 0),
      caderaIzq: pt3(-0.12, 0, 0), caderaDer: pt3(0.12, 0, 0),
      rodillaIzq: pt3(-0.13, 0.42, -0.02), rodillaDer: pt3(0.13, 0.42, -0.02),
      tobilloIzq: pt3(-0.14, 0.84, 0.02), tobilloDer: pt3(0.14, 0.84, 0.02),
    }
    const abajo3D: PuntosPostura = {
      hombroIzq: pt3(-0.18, -0.18, -0.08), hombroDer: pt3(0.18, -0.18, -0.08),
      caderaIzq: pt3(-0.12, 0.34, 0.18), caderaDer: pt3(0.12, 0.34, 0.18),
      rodillaIzq: pt3(-0.16, 0.36, -0.22), rodillaDer: pt3(0.16, 0.36, -0.22),
      tobilloIzq: pt3(-0.14, 0.78, 0.04), tobilloDer: pt3(0.14, 0.78, 0.04),
    }
    let e = estadoPosturaInicial()
    e = evaluarPostura(e, pie3D, 'sentadillas', 1000)
    e = evaluarPostura(e, abajo3D, 'sentadillas', 1600)
    e = evaluarPostura(e, pie3D, 'sentadillas', 2200)
    expect(e.validas).toBe(1)
    expect(e.invalidas).toBe(0)
  })
})

describe('datos/acciones/retos: guardar y borrar con récords automáticos', () => {
  beforeEach(async () => { for (const tb of TABLAS) await db.table(tb).clear() })

  it('marca el primer intento como récord y solo marca los que lo superan', async () => {
    const a = await guardarIntentoReto({ reto: 'flexiones-60', valor: 20, duracionS: 60, modo: 'camara', fecha: '2026-11-24T08:00' })
    const b = await guardarIntentoReto({ reto: 'flexiones-60', valor: 18, duracionS: 60, modo: 'camara', fecha: '2026-11-24T19:00' })
    const c = await guardarIntentoReto({ reto: 'flexiones-60', valor: 26, duracionS: 60, modo: 'manual', fecha: '2026-11-25T08:00' })
    expect(a.record).toBe(true)
    expect(b.record).toBe(false)
    expect(c.record).toBe(true)
    expect(await db.retos.count()).toBe(3)
    await borrarIntentoReto(b.id)
    expect(await db.retos.count()).toBe(2)
  })
})
