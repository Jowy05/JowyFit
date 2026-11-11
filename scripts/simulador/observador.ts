import type { Comprobacion, ContextoDia, Escenario, Metrica, Paso, PlanSesion, Resumen } from './tipos'

export function comprobar(regla: string, valido: boolean, detalle: string): Comprobacion {
  return { regla, estado: valido ? 'aprobada' : 'fallida', detalle }
}

/** Comprobaciones de la prescripción que no dependen de la app: rangos, identificadores, material y cargas. */
export function observarPlan(plan: PlanSesion, contexto: ContextoDia): Comprobacion[] {
  const numerosValidos = Number.isFinite(plan.minutosEstimados) && plan.minutosEstimados >= 0 && plan.ejercicios.length <= 100 && plan.ejercicios.every(ejercicio =>
    Number.isInteger(ejercicio.series) && ejercicio.series >= 1 && ejercicio.series <= 100 &&
    [ejercicio.minimo, ejercicio.maximo, ejercicio.esfuerzo, ejercicio.descanso].every(Number.isFinite) &&
    ejercicio.minimo >= 0 && ejercicio.maximo >= ejercicio.minimo && ejercicio.esfuerzo >= 1 && ejercicio.esfuerzo <= 10 && ejercicio.descanso >= 0 &&
    (ejercicio.peso === null || (Number.isFinite(ejercicio.peso) && (ejercicio.peso >= 0 || ejercicio.registro === 'asistido'))) && ejercicio.pesos.every(Number.isFinite))
  const detalleValores = numerosValidos ? 'Rangos y tipos de la prescripción' : `Prescripción fuera de contrato: ${JSON.stringify(plan, (_clave, valor: unknown) => typeof valor === 'number' && !Number.isFinite(valor) ? String(valor) : valor)}`
  return [
    comprobar('plan.valores', numerosValidos, detalleValores),
    comprobar('plan.identificadores', !!plan.letra && plan.ejercicios.every(ejercicio => !!ejercicio.id && !!ejercicio.ejercicio) && new Set(plan.ejercicios.map(ejercicio => ejercicio.id)).size === plan.ejercicios.length, 'Identificadores presentes y únicos dentro de la sesión'),
    comprobar('plan.material', plan.ejercicios.every(ejercicio => ejercicio.material.every(material => contexto.material.includes(material))), 'Material requerido disponible'),
    comprobar('plan.pesos', plan.ejercicios.every(ejercicio => ejercicio.peso === null || !ejercicio.pesos.length || ejercicio.pesos.includes(ejercicio.peso)), 'Cargas dentro de la lista disponible cuando se conoce'),
  ]
}

function metrica(numerador: number, denominador: number): Metrica {
  return { numerador, denominador, porcentaje: denominador ? Math.round(numerador / denominador * 10000) / 100 : null }
}

function percentil(valores: number[], fraccion: number): number | null {
  if (!valores.length) return null
  const ordenados = [...valores].sort((primero, segundo) => primero - segundo)
  return ordenados[Math.max(0, Math.ceil(ordenados.length * fraccion) - 1)]!
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null
  const ordenados = [...valores].sort((primero, segundo) => primero - segundo)
  const centro = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 ? ordenados[centro]! : (ordenados[centro - 1]! + ordenados[centro]!) / 2
}

export function resumir(pasos: Paso[], escenario: Escenario): Resumen {
  const sesiones = pasos.filter(paso => paso.resultado && paso.registrada)
  const duraciones = sesiones.map(paso => paso.resultado!.minutos)
  const seriesPorZona: Resumen['seriesPorZona'] = Object.create(null)
  const estimulos = new Map<string, Set<number>>()
  const contratos = { aprobada: 0, fallida: 0, 'no-evaluable': 0, pendiente: 0 }
  const reglas: Resumen['reglas'] = Object.create(null)
  const acciones: Resumen['acciones'] = { primera: 0, subir: 0, mantener: 0, bajar: 0 }
  const eventos: Resumen['eventos'] = Object.create(null)
  for (const paso of pasos) {
    for (const evento of paso.contexto.eventos) eventos[evento.tipo] = (eventos[evento.tipo] ?? 0) + 1
    for (const comprobacion of paso.comprobaciones) {
      contratos[comprobacion.estado]++
      const cuenta = reglas[comprobacion.regla] ??= { aprobada: 0, fallida: 0, 'no-evaluable': 0, pendiente: 0 }
      cuenta[comprobacion.estado]++
    }
    for (const ejercicio of paso.plan?.ejercicios ?? []) {
      if (Object.hasOwn(acciones, ejercicio.accion)) acciones[ejercicio.accion]++
      if (!Number.isInteger(ejercicio.series) || ejercicio.series < 1 || ejercicio.series > 100) continue
      const completadas = paso.registrada ? paso.resultado?.ejercicios.find(resultado => resultado.id === ejercicio.id)?.series.filter(serie => serie.hecha).length ?? 0 : 0
      for (const zona of new Set(ejercicio.zonas)) {
        const cuenta = seriesPorZona[zona] ??= { prescritas: 0, completadas: 0, estimuloDias: 0, mayorIntervaloDias: null }
        cuenta.prescritas += ejercicio.series
        cuenta.completadas += completadas
        if (completadas) {
          if (!estimulos.has(zona)) estimulos.set(zona, new Set())
          estimulos.get(zona)!.add(paso.contexto.indice)
        }
      }
    }
  }
  for (const [zona, dias] of estimulos) {
    const indices = [...dias].sort((primero, segundo) => primero - segundo)
    const cuenta = seriesPorZona[zona]!
    cuenta.estimuloDias = indices.length
    cuenta.mayorIntervaloDias = indices.length > 1 ? Math.max(...indices.slice(1).map((dia, indice) => dia - indices[indice]!)) : null
  }
  return {
    dias: pasos.length,
    asistencia: metrica(pasos.filter(paso => paso.asistencia === 'asiste' || paso.asistencia === 'bloqueada').length, pasos.filter(paso => paso.contexto.programado).length),
    sesiones: {
      completas: sesiones.filter(paso => paso.resultado!.estado === 'completa').length,
      cortas: sesiones.filter(paso => paso.resultado!.estado === 'corta').length,
      abandonadas: sesiones.filter(paso => paso.resultado!.estado === 'abandonada').length,
      bloqueadas: pasos.filter(paso => paso.asistencia === 'bloqueada').length,
      sinRegistrar: pasos.filter(paso => paso.resultado && !paso.registrada).length,
    },
    tiempo: { mediana: mediana(duraciones), p90: percentil(duraciones, 0.9), excedidas: metrica(duraciones.filter(minutos => minutos > escenario.persona.minutos).length, duraciones.length) },
    seriesPorZona, acciones, contratos, reglas, eventos,
  }
}
