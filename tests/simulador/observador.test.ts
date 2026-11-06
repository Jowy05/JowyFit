import { describe, expect, it } from 'vitest'
import { observarPlan, resumir } from '../../scripts/simulador/observador.ts'
import { markdown } from '../../scripts/simulador/informe.ts'
import { simular } from '../../scripts/simulador/motor.ts'
import type { ContextoDia, Prescripcion } from '../../scripts/simulador/tipos.ts'
import { adaptadorEjemplo, configuracionEjemplo, planEjemplo } from './ayuda.ts'

const contexto: ContextoDia = { indice: 0, fecha: '2026-01-05', lunes: '2026-01-05', semana: 0, programado: true, decision: 'aceptar', eventos: [], material: ['dumbbell'] }

describe('observadores, con fallos introducidos deliberadamente', () => {
  it.each([
    { series: 0 }, { series: -1 }, { series: 101 }, { series: Infinity }, { series: 2.2 },
    { minimo: -1 }, { maximo: 2 }, { esfuerzo: 11 }, { descanso: -1 }, { peso: NaN }, { peso: -10 }, { pesos: [Infinity] },
  ] satisfies Partial<Prescripcion>[])('detecta rangos inválidos %j', cambio => {
    const plan = planEjemplo()
    Object.assign(plan.ejercicios[0]!, cambio)
    expect(observarPlan(plan, contexto, configuracionEjemplo().escenario).find(regla => regla.regla === 'plan.valores')!.estado).toBe('fallida')
  })

  it('detecta identificadores duplicados, exclusiones, material y cargas', () => {
    const escenario = configuracionEjemplo().escenario
    escenario.persona.excluidos = ['ficticio']
    const plan = planEjemplo()
    plan.ejercicios.push(structuredClone(plan.ejercicios[0]!))
    plan.ejercicios[0]!.material = ['barbell']
    plan.ejercicios[0]!.peso = 11
    const fallidas = observarPlan(plan, contexto, escenario).filter(regla => regla.estado === 'fallida').map(regla => regla.regla)
    expect(fallidas).toEqual(['plan.identificadores', 'plan.material', 'plan.exclusiones', 'plan.pesos'])
  })

  it('admite peso corporal sin carga y asistencia negativa conocida', () => {
    const plan = planEjemplo()
    plan.ejercicios[0]!.registro = 'corporal'
    plan.ejercicios[0]!.peso = null
    plan.ejercicios[0]!.pesos = []
    expect(observarPlan(plan, contexto, configuracionEjemplo().escenario).some(regla => regla.estado === 'fallida')).toBe(false)
    Object.assign(plan.ejercicios[0]!, { registro: 'asistido', peso: -10, pesos: [-20, -10] })
    expect(observarPlan(plan, contexto, configuracionEjemplo().escenario).some(regla => regla.estado === 'fallida')).toBe(false)
  })

  it('no convierte denominadores vacíos en porcentajes aprobados', () => {
    const resumen = resumir([], configuracionEjemplo().escenario)
    expect(resumen.asistencia).toEqual({ numerador: 0, denominador: 0, porcentaje: null })
    expect(resumen.tiempo.p90).toBeNull()
    expect(resumen.tiempo.excedidas.porcentaje).toBeNull()
  })

  it('admite nombres de zonas y reglas que coincidan con propiedades de Object', async () => {
    const adaptador = adaptadorEjemplo()
    const plan = planEjemplo()
    plan.ejercicios[0]!.zonas = ['__proto__', 'constructor']
    adaptador.planificar.mockReturnValue(plan)
    adaptador.cerrarDia.mockReturnValue([{ regla: '__proto__', estado: 'aprobada', detalle: 'Prueba de claves' }])
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.resumen.reglas['__proto__']!.aprobada).toBe(14)
    expect(informe.resumen.seriesPorZona['constructor']!.prescritas).toBe(4)
    expect(informe.resumen.seriesPorZona['__proto__']!.completadas).toBe(4)
  })

  it('informa el valor no finito que originó el fallo', () => {
    const plan = planEjemplo()
    plan.ejercicios[0]!.series = Infinity
    const reglas = observarPlan(plan, contexto, configuracionEjemplo().escenario)
    expect(reglas.find(regla => regla.regla === 'plan.valores')!.detalle).toContain('Infinity')
  })

  it('calcula la mediana par como media de los dos valores centrales', async () => {
    const informe = await simular(configuracionEjemplo(), adaptadorEjemplo())
    informe.pasos[0]!.resultado!.minutos = 10
    informe.pasos[7]!.resultado!.minutos = 20
    const resumen = resumir(informe.pasos, informe.configuracion.escenario)
    expect(resumen.tiempo.mediana).toBe(15)
    expect(resumen.tiempo.p90).toBe(20)
  })

  it('separa series prescritas y completadas y cuenta zonas una sola vez', async () => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.eventos = [{ dia: 0, tipo: 'sesion', valor: 'corta' }]
    const adaptador = adaptadorEjemplo()
    const plan = planEjemplo()
    plan.ejercicios[0]!.zonas = ['espalda', 'espalda']
    adaptador.planificar.mockReturnValue(plan)
    const informe = await simular(configuracion, adaptador)
    expect(informe.resumen.seriesPorZona.espalda!.prescritas).toBe(4)
    expect(informe.resumen.seriesPorZona.espalda!.completadas).toBe(3)
  })

  it('el informe identifica el objetivo ficticio y no afirma que JowyFit está validado', async () => {
    const informe = await simular(configuracionEjemplo(), adaptadorEjemplo())
    const texto = markdown(informe)
    expect(texto).toContain('No se ha probado JowyFit')
    expect(texto).toContain('2/2 (100%)')
    expect(texto).toContain('aplicacion.restricciones')
    expect(texto).toContain('pendientes')
    expect(texto).toContain('Sin incumplimientos detectados en las reglas evaluadas')
  })

  it('escapa celdas y muestra fecha y regla de los fallos', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.cerrarDia.mockReturnValue([{ regla: 'fallo|deliberado', estado: 'fallida', detalle: 'valor\nincorrecto' }])
    const texto = markdown(await simular(configuracionEjemplo(), adaptador))
    expect(texto).toContain('fallo\\|deliberado')
    expect(texto).toContain('2026-01-05')
    expect(texto).toContain('valor incorrecto')
  })
})
