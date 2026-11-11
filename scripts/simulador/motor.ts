import { diaSemana, fechaEn } from './azar'
import { observarPlan, resumir } from './observador'
import { asiste, realizar } from './persona'
import { validarConfiguracion } from './validar'
import * as jowyfit from './jowyfit/recorrido'
import type { Configuracion, ContextoDia, Decision, Informe, Paso } from './tipos'

/** Recorre día a día un escenario contra JowyFit y devuelve la traza con sus comprobaciones. */
export async function simular(entrada: Configuracion): Promise<Informe> {
  validarConfiguracion(entrada)
  const configuracion = structuredClone(entrada)
  const aplicacion = jowyfit.identidad()
  const pasos: Paso[] = []
  let material = [...configuracion.escenario.persona.material]
  let decision: Decision = 'aceptar'
  let fase = 'iniciar'
  try {
    const recorrido = await jowyfit.iniciar(configuracion)
    for (let indice = 0; indice < configuracion.semanas * 7; indice++) {
      const eventos = configuracion.escenario.eventos.filter(evento => evento.dia === indice)
      for (const evento of eventos) {
        if (evento.tipo === 'material') material = material.filter(elemento => !evento.quitar.includes(elemento))
        if (evento.tipo === 'decision') decision = evento.valor
      }
      const fecha = fechaEn(configuracion.inicio, indice)
      const contexto: ContextoDia = {
        indice, fecha, lunes: fechaEn(fecha, -diaSemana(fecha)), semana: Math.floor(indice / 7), decision, eventos, material: [...material],
        programado: configuracion.escenario.dias.includes(diaSemana(fecha)),
      }
      const paso: Paso = { contexto, asistencia: contexto.programado ? 'ausente' : 'descanso', plan: null, resultado: null, registrada: false, comprobaciones: [] }
      pasos.push(paso)
      fase = 'prepararDia'
      await jowyfit.prepararDia(recorrido, contexto)
      if (asiste(configuracion, contexto)) {
        paso.asistencia = 'bloqueada'
        fase = 'planificar'
        paso.plan = await jowyfit.planificar(recorrido, contexto)
        if (!paso.plan) {
          paso.comprobaciones.push({ regla: 'sesion.sin-plan', estado: 'no-evaluable', detalle: 'La app no ofrece sesión para este día' })
        } else if (!paso.plan.ejercicios.length) {
          paso.comprobaciones.push({ regla: 'sesion.sin-opciones', estado: 'no-evaluable', detalle: 'Sesión sin ejercicios: faltan opciones válidas' })
        } else {
          paso.comprobaciones.push(...observarPlan(paso.plan, contexto))
          // Una prescripción fuera de rango no se entrega a la persona virtual ni se registra como entrenada.
          if (!paso.comprobaciones.some(comprobacion => comprobacion.estado === 'fallida')) {
            paso.asistencia = 'asiste'
            fase = 'persona'
            paso.resultado = realizar(configuracion, contexto, paso.plan)
            fase = 'registrar'
            await jowyfit.registrar(recorrido, contexto, paso.resultado)
            paso.registrada = true
          }
        }
      }
      fase = 'cerrarDia'
      paso.comprobaciones.push(...await jowyfit.cerrarDia(recorrido, contexto))
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
      await jowyfit.finalizar()
    } catch (error) {
      pasos.at(-1)!.comprobaciones.push({ regla: 'motor.limpieza', estado: 'fallida', detalle: error instanceof Error ? error.message : String(error) })
    }
  }
  if (!pasos.some(paso => paso.plan?.ejercicios.length)) {
    pasos.at(-1)!.comprobaciones.push({ regla: 'cobertura.prescripciones', estado: 'no-evaluable', detalle: 'Ninguna prescripción evaluada en este recorrido' })
  }
  return { version: 3, modelo: 'guiones-1', configuracion, aplicacion, resumen: resumir(pasos, configuracion.escenario), pasos }
}
