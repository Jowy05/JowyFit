import '../../scripts/simulador/jowyfit/entorno.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { db } from '../../src/datos/db'
import { simular } from '../../scripts/simulador/motor.ts'
import { escenarios } from '../../scripts/simulador/escenarios.ts'
import { perfilSintetico } from '../../scripts/simulador/jowyfit/perfil.ts'
import * as jowyfit from '../../scripts/simulador/jowyfit/recorrido.ts'
import type { Informe } from '../../scripts/simulador/tipos.ts'
import { configuracionEjemplo, planEjemplo } from './ayuda.ts'

// Las fases reales, envueltas para contar llamadas y provocar fallos en una sola.
vi.mock('../../scripts/simulador/jowyfit/recorrido.ts', async importOriginal => {
  const real = await importOriginal<typeof import('../../scripts/simulador/jowyfit/recorrido.ts')>()
  return {
    ...real, iniciar: vi.fn(real.iniciar), prepararDia: vi.fn(real.prepararDia), planificar: vi.fn(real.planificar),
    registrar: vi.fn(real.registrar), cerrarDia: vi.fn(real.cerrarDia), finalizar: vi.fn(real.finalizar),
  }
})

const fase = {
  iniciar: vi.mocked(jowyfit.iniciar), prepararDia: vi.mocked(jowyfit.prepararDia), planificar: vi.mocked(jowyfit.planificar),
  registrar: vi.mocked(jowyfit.registrar), cerrarDia: vi.mocked(jowyfit.cerrarDia), finalizar: vi.mocked(jowyfit.finalizar),
}

const fallidas = (informe: Informe) => JSON.stringify(informe.pasos.flatMap(paso => paso.comprobaciones.filter(regla => regla.estado === 'fallida')))

beforeEach(() => { vi.clearAllMocks() })

describe('perfil sintético', () => {
  it('lleva urgencias, condiciones y días opcionales a los campos reales del perfil', () => {
    expect(perfilSintetico(configuracionEjemplo('bloqueo-pecho')).urgencias).toEqual(['pecho'])
    expect(perfilSintetico(configuracionEjemplo('condiciones')).condicionesSalud).toEqual(['tension', 'osteoporosis'])
    expect(perfilSintetico(configuracionEjemplo('posparto'))).toMatchObject({ condicionesSalud: ['embarazo'], urgencias: [] })
    expect(perfilSintetico(configuracionEjemplo('casa-rodilla'))).toMatchObject({ zonasSensibles: ['rodilla'], modoMayor: { activo: true } })
    expect(perfilSintetico(configuracionEjemplo('sabado-opcional'))).toMatchObject({ diasFijos: [0, 2, 4], diasOpcionales: [5] })
  })
})

describe('recorrido contra JowyFit', () => {
  it('usa una base temporal con el catálogo real, recorre las fases en orden y la borra al terminar', async () => {
    expect(db.name).toBe('jowyfit-simulador')
    expect(globalThis.indexedDB).toBeInstanceOf(IDBFactory)
    const informe = await simular(configuracionEjemplo('musculo-gimnasio'))
    expect(informe.resumen.contratos.fallida, fallidas(informe)).toBe(0)
    expect(informe.aplicacion.huellaCatalogo).toMatch(/^[a-f0-9]{64}$/)
    expect(informe.resumen.sesiones.completas).toBe(8)
    expect(informe.resumen.reglas['calibracion.definitiva']!.aprobada).toBe(1)
    expect(informe.resumen.reglas['sesion.persistencia']!.aprobada).toBe(8)
    expect(informe.resumen.reglas['aplicacion.restricciones']!.aprobada).toBe(8)
    expect([fase.iniciar, fase.prepararDia, fase.planificar, fase.registrar, fase.cerrarDia, fase.finalizar].map(llamada => llamada.mock.calls.length)).toEqual([1, 14, 8, 8, 14, 1])
    expect(fase.iniciar.mock.invocationCallOrder[0]).toBeLessThan(fase.prepararDia.mock.invocationCallOrder[0]!)
    expect(fase.planificar.mock.invocationCallOrder[0]).toBeLessThan(fase.registrar.mock.invocationCallOrder[0]!)
    expect(db.isOpen()).toBe(false)
  })

  it('la urgencia de pecho bloquea el alta real y todas las sesiones', async () => {
    const informe = await simular(configuracionEjemplo('bloqueo-pecho'))
    expect(informe.resumen.contratos.fallida, fallidas(informe)).toBe(0)
    expect(informe.resumen.sesiones.completas).toBe(0)
    expect(informe.resumen.reglas['alta.bloqueo']!.aprobada).toBe(1)
    expect(informe.resumen.reglas['salud.bloqueo']!.aprobada).toBe(14)
    expect(informe.resumen.reglas['cobertura.prescripciones']!['no-evaluable']).toBe(1)
  })

  it('repite exactamente el mismo recorrido', async () => {
    const entrada = configuracionEjemplo('musculo-gimnasio')
    expect(await simular(entrada)).toEqual(await simular(entrada))
  })

  it('descartar un entrenamiento no lo termina ni avanza la cola real', async () => {
    const entrada = configuracionEjemplo('musculo-gimnasio', 1)
    entrada.escenario.eventos = [{ dia: 0, tipo: 'sesion', valor: 'abandonada' }]
    const informe = await simular(entrada)
    expect(informe.pasos[0]!.plan!.letra).toBe(informe.pasos[1]!.plan!.letra)
    expect(informe.resumen.sesiones.abandonadas).toBe(1)
    expect(informe.resumen.reglas['sesion.persistencia']!.aprobada).toBe(4)
    expect(informe.resumen.contratos.fallida, fallidas(informe)).toBe(0)
  })

  it('aplica la progresión y las descargas a partir del historial real', async () => {
    const informe = await simular(configuracionEjemplo('progresion-facil', 8))
    expect(informe.resumen.acciones.subir).toBeGreaterThan(0)
    expect(informe.resumen.reglas['descarga.aceptar']!.aprobada).toBeGreaterThan(0)
    expect(informe.resumen.reglas['descarga.aplicada']!.aprobada).toBeGreaterThan(0)
    expect(informe.resumen.contratos.fallida, fallidas(informe)).toBe(0)
  })

  it('no planifica ausencias, mantiene material y decisiones y separa semanas de calendario', async () => {
    const entrada = { ...configuracionEjemplo('casa-rodilla'), inicio: '2026-01-07' }
    entrada.escenario.eventos = [{ dia: 0, tipo: 'ausencia', hasta: 13 }, { dia: 1, tipo: 'material', quitar: ['dumbbell'] }, { dia: 2, tipo: 'decision', valor: 'posponer' }]
    const informe = await simular(entrada)
    expect(fase.planificar).not.toHaveBeenCalled()
    expect(informe.resumen.asistencia.porcentaje).toBe(0)
    expect(informe.pasos[1]!.contexto.material).not.toContain('dumbbell')
    expect(informe.pasos[10]!.contexto.decision).toBe('posponer')
    expect(informe.pasos[3]!.contexto.eventos).toEqual([])
    expect(informe.pasos[0]!.contexto.lunes).toBe('2026-01-05')
    expect(informe.pasos[5]!.contexto).toMatchObject({ lunes: '2026-01-12', semana: 0 })
    expect(informe.pasos[7]!.contexto.semana).toBe(1)
    expect(informe.resumen.reglas['cobertura.prescripciones']!['no-evaluable']).toBe(1)
  })

  it.each(escenarios().map(escenario => [escenario.id] as const))('el escenario %s recorre una semana sin incumplimientos', async id => {
    const informe = await simular(configuracionEjemplo(id, 1))
    expect(informe.pasos).toHaveLength(7)
    expect(informe.resumen.contratos.fallida, fallidas(informe)).toBe(0)
  })
})

describe('fallos dentro de la app', () => {
  it.each(['iniciar', 'prepararDia', 'planificar', 'registrar', 'cerrarDia'] as const)('guarda una excepción de %s, para el recorrido y limpia', async nombre => {
    fase[nombre].mockRejectedValueOnce(new Error('fallo deliberado'))
    const informe = await simular(configuracionEjemplo('musculo-gimnasio'))
    expect(fase.finalizar).toHaveBeenCalledTimes(1)
    expect(informe.resumen.contratos.fallida).toBe(1)
    expect(informe.pasos.at(-1)!.comprobaciones).toContainEqual({ regla: 'motor.excepcion', estado: 'fallida', detalle: `${nombre}: fallo deliberado` })
    expect(db.isOpen()).toBe(false)
  })

  it('conserva el resultado sin contarlo si falla su registro', async () => {
    fase.registrar.mockRejectedValueOnce(new Error('Registro rechazado'))
    const informe = await simular(configuracionEjemplo('musculo-gimnasio'))
    expect(informe.pasos[0]!.resultado).not.toBeNull()
    expect(informe.pasos[0]!.registrada).toBe(false)
    expect(informe.resumen.sesiones).toMatchObject({ completas: 0, sinRegistrar: 1 })
    expect(informe.resumen.tiempo.mediana).toBeNull()
  })

  it('no entrega a la persona ni registra una prescripción fuera de rango', async () => {
    const plan = planEjemplo()
    plan.ejercicios[0]!.series = Infinity
    fase.planificar.mockResolvedValueOnce(plan)
    const informe = await simular(configuracionEjemplo('musculo-gimnasio'))
    expect(informe.pasos[0]!.resultado).toBeNull()
    expect(informe.pasos[0]!.asistencia).toBe('bloqueada')
    expect(informe.resumen.reglas['plan.valores']!.fallida).toBe(1)
    expect(fase.registrar).toHaveBeenCalledTimes(7)
  })

  it('marca como no evaluables los días sin plan o sin ejercicios', async () => {
    fase.planificar.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...planEjemplo(), ejercicios: [] })
    const informe = await simular(configuracionEjemplo('musculo-gimnasio', 1))
    expect(informe.resumen.reglas['sesion.sin-plan']!['no-evaluable']).toBe(1)
    expect(informe.resumen.reglas['sesion.sin-opciones']!['no-evaluable']).toBe(1)
    expect(informe.resumen.contratos.fallida, fallidas(informe)).toBe(0)
  })

  it('registra el fallo de limpieza sin ocultar el original', async () => {
    fase.iniciar.mockRejectedValueOnce(new Error('inicio'))
    fase.finalizar.mockRejectedValueOnce(new Error('limpieza'))
    expect((await simular(configuracionEjemplo('musculo-gimnasio'))).resumen.contratos.fallida).toBe(2)
    await jowyfit.finalizar()
  })
})
