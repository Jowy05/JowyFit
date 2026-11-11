import { describe, expect, it } from 'vitest'
import { observarPlan, resumir } from '../../scripts/simulador/observador.ts'
import { markdown } from '../../scripts/simulador/informe.ts'
import { realizar } from '../../scripts/simulador/persona.ts'
import type { Informe, Prescripcion } from '../../scripts/simulador/tipos.ts'
import { configuracionEjemplo, contextoEjemplo as contexto, pasoEjemplo, planEjemplo } from './ayuda.ts'

describe('observadores, con fallos introducidos deliberadamente', () => {
  it.each([
    { series: 0 }, { series: -1 }, { series: 101 }, { series: Infinity }, { series: 2.2 },
    { minimo: -1 }, { maximo: 2 }, { esfuerzo: 11 }, { descanso: -1 }, { peso: NaN }, { peso: -10 }, { pesos: [Infinity] },
  ] satisfies Partial<Prescripcion>[])('detecta rangos inválidos %j', cambio => {
    const plan = planEjemplo()
    Object.assign(plan.ejercicios[0]!, cambio)
    expect(observarPlan(plan, contexto).find(regla => regla.regla === 'plan.valores')!.estado).toBe('fallida')
  })

  it('detecta identificadores duplicados, material y cargas', () => {
    const plan = planEjemplo()
    plan.ejercicios.push(structuredClone(plan.ejercicios[0]!))
    plan.ejercicios[0]!.material = ['barbell']
    plan.ejercicios[0]!.peso = 11
    const fallidas = observarPlan(plan, contexto).filter(regla => regla.estado === 'fallida').map(regla => regla.regla)
    expect(fallidas).toEqual(['plan.identificadores', 'plan.material', 'plan.pesos'])
  })

  it('admite peso corporal sin carga y asistencia negativa conocida', () => {
    const plan = planEjemplo()
    Object.assign(plan.ejercicios[0]!, { registro: 'corporal', peso: null, pesos: [] })
    expect(observarPlan(plan, contexto).some(regla => regla.estado === 'fallida')).toBe(false)
    Object.assign(plan.ejercicios[0]!, { registro: 'asistido', peso: -10, pesos: [-20, -10] })
    expect(observarPlan(plan, contexto).some(regla => regla.estado === 'fallida')).toBe(false)
  })

  it('informa el valor no finito que originó el fallo', () => {
    const plan = planEjemplo()
    plan.ejercicios[0]!.series = Infinity
    expect(observarPlan(plan, contexto).find(regla => regla.regla === 'plan.valores')!.detalle).toContain('Infinity')
  })
})

describe('resumen de la traza', () => {
  const configuracion = configuracionEjemplo()
  const sesion = (indice: number, minutos: number) => {
    const resultado = realizar(configuracion, { ...contexto, indice }, planEjemplo())
    return pasoEjemplo(indice, planEjemplo(), { ...resultado, minutos })
  }

  it('no convierte denominadores vacíos en porcentajes aprobados', () => {
    const resumen = resumir([], configuracion.escenario)
    expect(resumen.asistencia).toEqual({ numerador: 0, denominador: 0, porcentaje: null })
    expect(resumen.tiempo.p90).toBeNull()
    expect(resumen.tiempo.excedidas.porcentaje).toBeNull()
  })

  it('calcula la mediana par como media de los dos valores centrales y p90 por arriba', () => {
    const resumen = resumir([sesion(0, 10), sesion(7, 20)], configuracion.escenario)
    expect(resumen.tiempo.mediana).toBe(15)
    expect(resumen.tiempo.p90).toBe(20)
    expect(resumen.seriesPorZona.espalda).toEqual({ prescritas: 4, completadas: 4, estimuloDias: 2, mayorIntervaloDias: 7 })
  })

  it('separa series prescritas y completadas, cuenta zonas una sola vez y no suma lo no registrado', () => {
    const plan = planEjemplo()
    plan.ejercicios[0]!.zonas = ['espalda', 'espalda']
    const corta = realizar(configuracion, { ...contexto, eventos: [{ dia: 0, tipo: 'sesion', valor: 'corta' }] }, plan)
    const sinRegistrar = { ...pasoEjemplo(7, plan, corta), registrada: false }
    const resumen = resumir([pasoEjemplo(0, plan, corta), sinRegistrar], configuracion.escenario)
    expect(resumen.seriesPorZona.espalda).toMatchObject({ prescritas: 4, completadas: 1 })
    expect(resumen.sesiones).toMatchObject({ cortas: 1, sinRegistrar: 1 })
  })

  it('admite nombres de zonas y reglas que coincidan con propiedades de Object', () => {
    const paso = sesion(0, 10)
    paso.plan!.ejercicios[0]!.zonas = ['__proto__', 'constructor']
    paso.comprobaciones.push({ regla: '__proto__', estado: 'aprobada', detalle: 'Prueba de claves' })
    const resumen = resumir([paso], configuracion.escenario)
    expect(resumen.reglas['__proto__']!.aprobada).toBe(1)
    expect(resumen.seriesPorZona['constructor']!.prescritas).toBe(2)
    expect(resumen.seriesPorZona['__proto__']!.completadas).toBe(2)
  })
})

describe('informe Markdown', () => {
  function informe(): Informe {
    const configuracion = configuracionEjemplo()
    const pasos = [pasoEjemplo(0, planEjemplo(), realizar(configuracion, contexto, planEjemplo()))]
    pasos[0]!.comprobaciones.push({ regla: 'aplicacion.restricciones', estado: 'aprobada', detalle: 'Correcto' })
    return { version: 3, modelo: 'guiones-1', configuracion, aplicacion: { version: '0.0.0', huellaCatalogo: 'a'.repeat(64) }, resumen: resumir(pasos, configuracion.escenario), pasos }
  }

  it('dice qué se ha evaluado y que no demuestra eficacia fisiológica', () => {
    const texto = markdown(informe())
    expect(texto).toContain('No demuestra eficacia fisiológica')
    expect(texto).toContain('JowyFit 0.0.0')
    expect(texto).toContain('1/1 (100%)')
    expect(texto).toContain('aplicacion.restricciones')
    expect(texto).toContain('Sin incumplimientos detectados en las reglas evaluadas')
  })

  it('escapa celdas y muestra fecha y regla de los fallos', () => {
    const datos = informe()
    datos.pasos[0]!.comprobaciones.push({ regla: 'fallo|deliberado', estado: 'fallida', detalle: 'valor\nincorrecto' })
    datos.resumen = resumir(datos.pasos, datos.configuracion.escenario)
    const texto = markdown(datos)
    expect(texto).toContain('fallo\\|deliberado')
    expect(texto).toContain('2026-01-05')
    expect(texto).toContain('valor incorrecto')
  })
})
