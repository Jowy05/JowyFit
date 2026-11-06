import { diaSemana, fechaEn } from './azar.ts'
import { observarPlan, resumir } from './observador.ts'
import { asiste, realizar } from './persona.ts'
import { validarConfiguracion, validarEstructuraPlan } from './validar.ts'
import type { Adaptador, Configuracion, ContextoDia, Decision, Informe, Paso } from './tipos.ts'

export async function simular(entrada: Configuracion, adaptador: Adaptador, opciones: { permitirAplicacion?: boolean } = {}): Promise<Informe> {
  validarConfiguracion(entrada)
  if (!['ficticio', 'aplicacion'].includes(adaptador.identidad.objetivo)) throw new Error('Objetivo de adaptador no válido')
  if (adaptador.identidad.objetivo === 'aplicacion' && !opciones.permitirAplicacion) throw new Error('La ejecución contra la aplicación requiere autorización explícita')
  if (adaptador.identidad.objetivo === 'aplicacion' && !adaptador.identidad.huellaCatalogo) throw new Error('El adaptador de aplicación debe identificar el catálogo')
  const configuracion = structuredClone(entrada)
  const identidad = structuredClone(adaptador.identidad)
  const pasos: Paso[] = []
  let material = [...configuracion.escenario.persona.material]
  let decision: Decision = 'aceptar'
  let fase = 'iniciar'
  try {
    await adaptador.iniciar(structuredClone(configuracion))
    for (let indice = 0; indice < configuracion.semanas * 7; indice++) {
      const eventos = configuracion.escenario.eventos.filter(evento => evento.dia === indice)
      for (const evento of eventos) {
        if (evento.tipo === 'material') material = material.filter(elemento => !evento.quitar.includes(elemento))
        if (evento.tipo === 'decision') decision = evento.valor
      }
      const fecha = fechaEn(configuracion.inicio, indice)
      const contexto: ContextoDia = {
        indice, fecha, lunes: fechaEn(fecha, -diaSemana(fecha)), semana: Math.floor(indice / 7), decision, eventos: structuredClone(eventos), material: [...material],
        programado: configuracion.escenario.dias.includes(diaSemana(fecha)),
      }
      const paso: Paso = { contexto, asistencia: contexto.programado ? 'ausente' : 'descanso', plan: null, resultado: null, registrada: false, comprobaciones: [] }
      pasos.push(paso)
      fase = 'prepararDia'
      await adaptador.prepararDia(structuredClone(contexto))
      if (asiste(configuracion, contexto)) {
        paso.asistencia = 'bloqueada'
        fase = 'planificar'
        const plan = structuredClone(await adaptador.planificar(structuredClone(contexto)))
        if (plan !== null) validarEstructuraPlan(plan)
        paso.plan = plan
        if (paso.plan) {
          fase = 'observarPlan'
          paso.comprobaciones.push(...observarPlan(paso.plan, contexto, configuracion.escenario))
          if (paso.plan.ejercicios.length && !paso.comprobaciones.some(comprobacion => comprobacion.estado === 'fallida')) {
            paso.asistencia = 'asiste'
            fase = 'persona'
            paso.resultado = realizar(configuracion, contexto, paso.plan)
            fase = 'registrar'
            await adaptador.registrar(structuredClone(contexto), structuredClone(paso.resultado))
            paso.registrada = true
          } else if (!paso.plan.ejercicios.length) {
            paso.comprobaciones.push({ regla: 'sesion.sin-opciones', estado: 'no-evaluable', detalle: 'Plan vacío: el adaptador debe explicar si faltan opciones válidas' })
          }
        } else {
          paso.comprobaciones.push({ regla: 'sesion.sin-plan', estado: 'no-evaluable', detalle: 'No hay prescripción; el adaptador debe comprobar la causa' })
        }
      }
      fase = 'cerrarDia'
      const comprobaciones = await adaptador.cerrarDia(structuredClone(contexto))
      for (const comprobacion of comprobaciones) {
        if (!comprobacion.regla || typeof comprobacion.detalle !== 'string' || !['aprobada', 'fallida', 'pendiente', 'no-evaluable'].includes(comprobacion.estado)) throw new Error('Comprobación del adaptador no válida')
      }
      paso.comprobaciones = paso.comprobaciones.filter(anterior => anterior.estado !== 'pendiente' || !comprobaciones.some(actual => actual.regla === anterior.regla && actual.estado !== 'pendiente'))
      paso.comprobaciones.push(...structuredClone(comprobaciones))
    }
  } catch (error) {
    const paso = pasos.at(-1) ?? {
      contexto: { indice: 0, fecha: configuracion.inicio, lunes: fechaEn(configuracion.inicio, -diaSemana(configuracion.inicio)), semana: 0, programado: false, decision, eventos: [], material },
      asistencia: 'descanso' as const, plan: null, resultado: null, registrada: false, comprobaciones: [],
    }
    if (!pasos.length) pasos.push(paso)
    paso.comprobaciones.push({ regla: 'motor.excepcion', estado: 'fallida', detalle: `${fase}: ${error instanceof Error ? error.message : String(error)}` })
  } finally {
    try {
      await adaptador.finalizar()
    } catch (error) {
      pasos.at(-1)!.comprobaciones.push({ regla: 'motor.limpieza', estado: 'fallida', detalle: error instanceof Error ? error.message : String(error) })
    }
  }
  if (!pasos.some(paso => paso.plan?.ejercicios.length)) {
    pasos.at(-1)!.comprobaciones.push({ regla: 'cobertura.prescripciones', estado: 'no-evaluable', detalle: 'Ninguna prescripción evaluada; esta ejecución no valida un generador' })
  }
  return { version: 2, modelo: 'guiones-1', configuracion, adaptador: identidad, resumen: resumir(pasos, configuracion.escenario), pasos }
}
