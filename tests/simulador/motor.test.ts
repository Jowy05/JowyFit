import { describe, expect, it } from 'vitest'
import { simular } from '../../scripts/simulador/motor.ts'
import { crearAdaptador } from '../../scripts/simulador/demostracion.ts'
import { escenariosBase, escenariosLimite } from '../../scripts/simulador/escenarios.ts'
import { adaptadorEjemplo, configuracionEjemplo, planEjemplo } from './ayuda.ts'

describe('motor aislado, sin importar JowyFit', () => {
  it('recorre días, ordena llamadas y calcula resultados conocidos', async () => {
    const adaptador = adaptadorEjemplo()
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(adaptador.iniciar).toHaveBeenCalledTimes(1)
    expect(adaptador.prepararDia).toHaveBeenCalledTimes(14)
    expect(adaptador.planificar).toHaveBeenCalledTimes(2)
    expect(adaptador.registrar).toHaveBeenCalledTimes(2)
    expect(adaptador.cerrarDia).toHaveBeenCalledTimes(14)
    expect(adaptador.finalizar).toHaveBeenCalledTimes(1)
    expect(adaptador.iniciar.mock.invocationCallOrder[0]).toBeLessThan(adaptador.prepararDia.mock.invocationCallOrder[0]!)
    expect(adaptador.planificar.mock.invocationCallOrder[0]).toBeLessThan(adaptador.registrar.mock.invocationCallOrder[0]!)
    expect(informe.resumen.asistencia).toEqual({ numerador: 2, denominador: 2, porcentaje: 100 })
    expect(informe.resumen.tiempo).toEqual({ mediana: 6.4, p90: 6.4, excedidas: { numerador: 0, denominador: 2, porcentaje: 0 } })
    expect(informe.resumen.seriesPorZona.espalda).toEqual({ prescritas: 4, completadas: 4, estimuloDias: 2, mayorIntervaloDias: 7 })
    expect(informe.resumen.contratos.fallida).toBe(0)
    expect(informe.resumen.contratos.pendiente).toBe(2)
  })

  it('no planifica ni registra ausencias, pero entrega eventos y cierra los días', async () => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.eventos = [{ dia: 0, tipo: 'ausencia', hasta: 7 }]
    const adaptador = adaptadorEjemplo()
    const informe = await simular(configuracion, adaptador)
    expect(adaptador.planificar).not.toHaveBeenCalled()
    expect(adaptador.registrar).not.toHaveBeenCalled()
    expect(adaptador.cerrarDia).toHaveBeenCalledTimes(14)
    expect(informe.resumen.asistencia.porcentaje).toBe(0)
    expect(informe.resumen.tiempo.mediana).toBeNull()
    expect(informe.resumen.reglas['cobertura.prescripciones']!['no-evaluable']).toBe(1)
  })

  it('distingue semanas transcurridas y calendario al empezar a mitad de semana', async () => {
    const configuracion = { ...configuracionEjemplo(), inicio: '2026-01-07' }
    const informe = await simular(configuracion, adaptadorEjemplo())
    expect(informe.pasos[0]!.contexto.lunes).toBe('2026-01-05')
    expect(informe.pasos[5]!.contexto.lunes).toBe('2026-01-12')
    expect(informe.pasos[5]!.contexto.semana).toBe(0)
    expect(informe.pasos[7]!.contexto.semana).toBe(1)
  })

  it('no registra resultados cuando un objetivo desmesurado desborda los tiempos', async () => {
    const adaptador = adaptadorEjemplo()
    const plan = planEjemplo()
    Object.assign(plan.ejercicios[0]!, { minimo: Number.MAX_VALUE, maximo: Number.MAX_VALUE })
    adaptador.planificar.mockReturnValue(plan)
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(adaptador.registrar).not.toHaveBeenCalled()
    expect(informe.resumen.contratos.fallida).toBe(1)
    expect(informe.pasos[0]!.resultado).toBeNull()
  })

  it('conserva decisiones y material, sin repetir eventos de un solo día', async () => {
    const configuracion = configuracionEjemplo()
    configuracion.escenario.eventos = [{ dia: 1, tipo: 'material', quitar: ['dumbbell'] }, { dia: 2, tipo: 'decision', valor: 'posponer' }]
    const adaptador = adaptadorEjemplo()
    adaptador.planificar.mockReturnValue(null)
    const informe = await simular(configuracion, adaptador)
    expect(informe.pasos[1]!.contexto.material).not.toContain('dumbbell')
    expect(informe.pasos[10]!.contexto.decision).toBe('posponer')
    expect(informe.pasos[3]!.contexto.eventos).toEqual([])
    expect(informe.resumen.eventos).toEqual({ material: 1, decision: 1 })
  })

  it('no entrega referencias mutables al adaptador', async () => {
    const entrada = configuracionEjemplo()
    const original = structuredClone(entrada)
    const adaptador = adaptadorEjemplo()
    adaptador.iniciar.mockImplementation(configuracion => { configuracion.escenario.persona.material.length = 0 })
    adaptador.prepararDia.mockImplementation(contexto => { contexto.material.length = 0 })
    adaptador.registrar.mockImplementation((_contexto, resultado) => { resultado.ejercicios.length = 0 })
    const informe = await simular(entrada, adaptador)
    expect(entrada).toEqual(original)
    expect(informe.pasos[0]!.resultado!.ejercicios).toHaveLength(1)
    expect(informe.pasos[0]!.contexto.material).toContain('dumbbell')
  })

  it.each(['iniciar', 'prepararDia', 'planificar', 'registrar', 'cerrarDia'] as const)('guarda una excepción de %s y libera recursos', async fase => {
    const adaptador = adaptadorEjemplo()
    adaptador[fase].mockImplementation(() => { throw new Error('fallo deliberado') })
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(adaptador.finalizar).toHaveBeenCalledTimes(1)
    expect(informe.resumen.contratos.fallida).toBe(1)
    expect(informe.pasos.at(-1)!.comprobaciones).toContainEqual({ regla: 'motor.excepcion', estado: 'fallida', detalle: `${fase}: fallo deliberado` })
  })

  it('conserva el resultado generado sin contabilizarlo si el adaptador rechaza su registro', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.registrar.mockRejectedValue(new Error('Registro rechazado'))
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.pasos[0]!.resultado).not.toBeNull()
    expect(informe.pasos[0]!.registrada).toBe(false)
    expect(informe.resumen.sesiones.completas).toBe(0)
    expect(informe.resumen.sesiones.sinRegistrar).toBe(1)
    expect(informe.resumen.seriesPorZona.espalda!.completadas).toBe(0)
    expect(informe.resumen.tiempo.mediana).toBeNull()
    expect(informe.resumen.contratos.fallida).toBe(1)
  })

  it('registra el fallo de limpieza sin ocultar el original', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.iniciar.mockRejectedValue(new Error('inicio'))
    adaptador.finalizar.mockRejectedValue(new Error('limpieza'))
    expect((await simular(configuracionEjemplo(), adaptador)).resumen.contratos.fallida).toBe(2)
  })

  it('mantiene las sesiones ya confirmadas cuando falla un registro posterior', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.registrar.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Segundo registro rechazado'))
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.resumen.sesiones.completas).toBe(1)
    expect(informe.resumen.sesiones.sinRegistrar).toBe(1)
    expect(informe.resumen.seriesPorZona.espalda!.completadas).toBe(2)
    expect(informe.pasos[0]!.registrada).toBe(true)
    expect(informe.pasos[7]!.registrada).toBe(false)
  })

  it('conserva un registro confirmado si después falla el cierre del día', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.cerrarDia.mockRejectedValueOnce(new Error('Cierre rechazado'))
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.resumen.sesiones.completas).toBe(1)
    expect(informe.resumen.sesiones.sinRegistrar).toBe(0)
    expect(informe.resumen.seriesPorZona.espalda!.completadas).toBe(2)
    expect(informe.resumen.contratos.fallida).toBe(1)
  })

  it('cuenta el intento de asistencia aunque falle la planificación', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.planificar.mockRejectedValueOnce(new Error('Plan rechazado'))
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.resumen.asistencia).toEqual({ numerador: 1, denominador: 1, porcentaje: 100 })
    expect(informe.resumen.sesiones.bloqueadas).toBe(1)
  })

  it('no simula ni registra planes de valores inválidos', async () => {
    const adaptador = adaptadorEjemplo()
    const plan = planEjemplo()
    plan.ejercicios[0]!.series = Infinity
    adaptador.planificar.mockReturnValue(plan)
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(adaptador.registrar).not.toHaveBeenCalled()
    expect(informe.resumen.reglas['plan.valores']!.fallida).toBe(2)
  })

  it('marca planes nulos y vacíos como no evaluables', async () => {
    for (const plan of [null, { ...planEjemplo(), ejercicios: [] }]) {
      const adaptador = adaptadorEjemplo()
      adaptador.planificar.mockReturnValue(plan)
      const informe = await simular(configuracionEjemplo(), adaptador)
      expect(adaptador.registrar).not.toHaveBeenCalled()
      expect(informe.resumen.contratos['no-evaluable']).toBeGreaterThan(0)
    }
  })

  it('conserva una excepción de estructura de plan sin romper el informe', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.planificar.mockReturnValue({ letra: 'A', minutosEstimados: 2, ejercicios: null } as unknown as ReturnType<typeof planEjemplo>)
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.resumen.contratos.fallida).toBe(1)
    expect(adaptador.registrar).not.toHaveBeenCalled()
    expect(informe.pasos[0]!.plan).toBeNull()
  })

  it('sustituye solo el marcador pendiente cuando el adaptador evalúa la regla', async () => {
    const adaptador = adaptadorEjemplo()
    adaptador.cerrarDia.mockReturnValue([{ regla: 'aplicacion.restricciones', estado: 'aprobada', detalle: 'Evaluada por el adaptador' }])
    const informe = await simular(configuracionEjemplo(), adaptador)
    expect(informe.resumen.reglas['aplicacion.restricciones']!.pendiente).toBe(0)
    expect(informe.resumen.reglas['aplicacion.restricciones']!.aprobada).toBe(14)
  })

  it('bloquea un objetivo de aplicación antes de inicializarlo', async () => {
    const ficticio = adaptadorEjemplo()
    const adaptador = { ...ficticio, identidad: { ...ficticio.identidad, objetivo: 'aplicacion' as const } }
    await expect(simular(configuracionEjemplo(), adaptador)).rejects.toThrow('autorización explícita')
    expect(adaptador.iniciar).not.toHaveBeenCalled()
    await expect(simular(configuracionEjemplo(), adaptador, { permitirAplicacion: true })).rejects.toThrow('identificar el catálogo')
    expect(adaptador.iniciar).not.toHaveBeenCalled()
  })

  it('la cola ficticia no avanza con abandono y sí con una sesión corta', async () => {
    const configuracion = configuracionEjemplo()
    configuracion.semanas = 3
    configuracion.escenario.persona.sesiones = 2
    configuracion.escenario.dias = [0, 2]
    configuracion.escenario.eventos = [{ dia: 0, tipo: 'sesion', valor: 'abandonada' }, { dia: 2, tipo: 'sesion', valor: 'corta' }]
    const informe = await simular(configuracion, crearAdaptador())
    expect(informe.pasos[0]!.plan!.letra).toBe('A')
    expect(informe.pasos[2]!.plan!.letra).toBe('A')
    expect(informe.pasos[7]!.plan!.letra).toBe('B')
    expect(informe.resumen.sesiones.abandonadas).toBe(1)
    expect(informe.resumen.sesiones.cortas).toBe(1)
  })

  it('soporta 52 semanas y 20 semillas únicamente con el sistema ficticio', async () => {
    const escenario = escenariosBase().find(candidato => candidato.id === 'turnos')!
    const asistencias = new Set<number>()
    for (let semilla = 1; semilla <= 20; semilla++) {
      const informe = await simular({ ...configuracionEjemplo(), escenario, semanas: 52, semilla }, crearAdaptador())
      expect(informe.pasos).toHaveLength(364)
      expect(informe.resumen.contratos.fallida).toBe(0)
      expect(informe.adaptador.objetivo).toBe('ficticio')
      asistencias.add(informe.resumen.asistencia.numerador)
    }
    expect(asistencias.size).toBeGreaterThan(1)
  })

  it.each([...escenariosBase(), ...escenariosLimite()].map(escenario => [escenario.id, escenario] as const))('reproduce el escenario ficticio %s en dos instancias nuevas', async (_id, escenario) => {
    const configuracion = { ...configuracionEjemplo(), escenario, semanas: 12 }
    const primero = await simular(configuracion, crearAdaptador())
    const segundo = await simular(configuracion, crearAdaptador())
    expect(segundo).toEqual(primero)
    expect(primero.pasos).toHaveLength(84)
    expect(primero.resumen.contratos.fallida).toBe(0)
    expect(primero.adaptador.objetivo).toBe('ficticio')
  })
})
