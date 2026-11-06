import { azar } from './azar.ts'
import type { Conducta, Configuracion, ContextoDia, PlanSesion, ResultadoSesion, SerieVirtual } from './tipos.ts'

export function asiste(configuracion: Configuracion, contexto: ContextoDia): boolean {
  const ausente = configuracion.escenario.eventos.some(evento => evento.tipo === 'ausencia' && evento.dia <= contexto.indice && evento.hasta >= contexto.indice)
  return contexto.programado && !ausente && azar(configuracion.semilla, 'asistencia', contexto.indice) < configuracion.escenario.persona.asistencia
}

function conductaEn(configuracion: Configuracion, indice: number): Conducta {
  const cambios = configuracion.escenario.eventos.filter(evento => evento.tipo === 'conducta' && evento.dia <= indice)
  const ultimo = cambios.at(-1)
  return ultimo?.tipo === 'conducta' ? ultimo.valor : 'normal'
}

export function realizar(configuracion: Configuracion, contexto: ContextoDia, plan: PlanSesion): ResultadoSesion {
  const conducta = conductaEn(configuracion, contexto.indice)
  const eventoSesion = contexto.eventos.find(evento => evento.tipo === 'sesion')
  const estado = eventoSesion?.tipo === 'sesion' ? eventoSesion.valor : 'completa'
  const fraccion = estado === 'abandonada' ? 0.25 : estado === 'corta' ? 0.6 : 1
  const total = plan.ejercicios.reduce((suma, ejercicio) => suma + ejercicio.series, 0)
  const limite = estado === 'completa' ? total : Math.floor(total * fraccion)
  let completadas = 0
  let segundosTotales = 300
  const ejercicios = plan.ejercicios.map(ejercicio => {
    const series: SerieVirtual[] = []
    const ruido = (azar(configuracion.semilla, 'rendimiento', contexto.indice, ejercicio.ejercicio) * 2 - 1) * configuracion.escenario.persona.variabilidad
    const objetivo = conducta === 'facil' || conducta === 'sin-esfuerzo' ? ejercicio.maximo : conducta === 'dificil' ? Math.max(0, ejercicio.minimo - 2) : ejercicio.minimo
    const cantidad = Math.max(0, Math.round(objetivo * (1 + ruido)))
    const esfuerzo = conducta === 'sin-esfuerzo' ? null : Math.min(10, Math.max(1, ejercicio.esfuerzo + (conducta === 'dificil' ? 2 : conducta === 'facil' ? -2 : 0)))
    for (let numero = 1; numero <= ejercicio.series; numero++) {
      const hecha = completadas < limite
      if (hecha) {
        completadas++
        const duracion = ejercicio.registro === 'tiempo' ? cantidad : ejercicio.registro === 'cardio' ? cantidad * 60 : cantidad * 3.5
        const descansoReal = ejercicio.descanso * (0.9 + azar(configuracion.semilla, 'duracion', contexto.indice, ejercicio.ejercicio, numero) * 0.2)
        segundosTotales += duracion + (numero < ejercicio.series ? descansoReal : 30)
      }
      series.push({
        numero, peso: hecha ? ejercicio.peso : null,
        repeticiones: hecha && ejercicio.registro !== 'tiempo' ? cantidad : null,
        segundos: hecha && ejercicio.registro === 'tiempo' ? cantidad : null,
        esfuerzo: hecha ? esfuerzo : null, hecha,
      })
    }
    return { id: ejercicio.id, ejercicio: ejercicio.ejercicio, series }
  })
  const minutos = Math.round(segundosTotales / 6) / 10
  if (!Number.isFinite(minutos)) throw new Error('El guion produciría una duración no finita; revisar la prescripción')
  return { estado, minutos, ejercicios }
}
