import { vi } from 'vitest'
import { escenariosBase } from '../../scripts/simulador/escenarios.ts'
import type { Adaptador, Configuracion, PlanSesion } from '../../scripts/simulador/tipos.ts'

export function configuracionEjemplo(): Configuracion {
  const escenario = escenariosBase()[0]!
  escenario.persona.sesiones = 1
  escenario.persona.variabilidad = 0
  escenario.dias = [0]
  return { version: 1, escenario, semanas: 2, semilla: 1, inicio: '2026-01-05' }
}

export function planEjemplo(): PlanSesion {
  return {
    letra: 'A', minutosEstimados: 10,
    ejercicios: [{ id: 'bloque', ejercicio: 'ficticio', registro: 'peso', series: 2, minimo: 8, maximo: 12, esfuerzo: 7, descanso: 0, peso: 10, pesos: [10, 12], material: ['dumbbell'], zonas: ['espalda'], accion: 'primera' }],
  }
}

export function adaptadorEjemplo() {
  const adaptador = {
    identidad: { nombre: 'Doble de prueba sin aplicación', version: '1', objetivo: 'ficticio', huellaCatalogo: null },
    iniciar: vi.fn<Adaptador['iniciar']>(),
    prepararDia: vi.fn<Adaptador['prepararDia']>(),
    planificar: vi.fn<Adaptador['planificar']>(() => planEjemplo()),
    registrar: vi.fn<Adaptador['registrar']>(),
    cerrarDia: vi.fn<Adaptador['cerrarDia']>(() => []),
    finalizar: vi.fn<Adaptador['finalizar']>(),
  } satisfies Adaptador
  return adaptador
}
