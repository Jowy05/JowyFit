import { escenarios } from '../../scripts/simulador/escenarios.ts'
import type { Configuracion, ContextoDia, Paso, PlanSesion, ResultadoSesion } from '../../scripts/simulador/tipos.ts'

export function configuracionEjemplo(id = 'casa-rodilla', semanas = 2): Configuracion {
  const escenario = escenarios().find(candidato => candidato.id === id)!
  return { version: 2, escenario, semanas, semilla: 1, inicio: '2026-01-05' }
}

export const contextoEjemplo: ContextoDia = { indice: 0, fecha: '2026-01-05', lunes: '2026-01-05', semana: 0, programado: true, decision: 'aceptar', eventos: [], material: ['dumbbell'] }

export function planEjemplo(): PlanSesion {
  return {
    letra: 'A', minutosEstimados: 10,
    ejercicios: [{ id: 'bloque', ejercicio: 'ficticio', registro: 'peso', series: 2, minimo: 8, maximo: 12, esfuerzo: 7, descanso: 0, peso: 10, pesos: [10, 12], material: ['dumbbell'], zonas: ['espalda'], accion: 'primera' }],
  }
}

/** Un día con sesión registrada; los demás campos, los de un día previsto normal. */
export function pasoEjemplo(indice: number, plan: PlanSesion | null, resultado: ResultadoSesion | null): Paso {
  return { contexto: { ...contextoEjemplo, indice }, asistencia: plan ? 'asiste' : 'ausente', plan, resultado, registrada: !!resultado, comprobaciones: [] }
}
