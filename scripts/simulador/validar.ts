import { fechaEn } from './azar'
import type { Configuracion, Escenario } from './tipos'

function exigir(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(mensaje)
}

export function validarEscenario(escenario: Escenario): void {
  exigir(/^[a-z0-9][a-z0-9-]*$/.test(escenario.id), 'Identificador de escenario no válido')
  const persona = escenario.persona
  exigir(Number.isFinite(persona.edad) && persona.edad >= 18 && persona.edad <= 120, 'Edad fuera de rango')
  exigir(Number.isInteger(persona.sesiones) && persona.sesiones >= 1 && persona.sesiones <= 7, 'Sesiones fuera de rango')
  exigir(Number.isFinite(persona.minutos) && persona.minutos > 0 && persona.minutos <= 240, 'Minutos fuera de rango')
  exigir(Number.isFinite(persona.asistencia) && persona.asistencia >= 0 && persona.asistencia <= 1, 'Asistencia fuera de rango')
  exigir(Number.isFinite(persona.variabilidad) && persona.variabilidad >= 0 && persona.variabilidad <= 0.5, 'Variabilidad fuera de rango')
  for (const valor of [persona.imc, persona.mesesSinEntrenar, persona.semanasPosparto, persona.pruebaSillaSegundos]) {
    exigir(valor === undefined || (Number.isFinite(valor) && valor >= 0), 'Dato opcional de perfil no válido')
  }
  exigir(escenario.dias.length === persona.sesiones && new Set(escenario.dias).size === escenario.dias.length && escenario.dias.every(dia => Number.isInteger(dia) && dia >= 0 && dia <= 6), 'Días de entrenamiento incoherentes')
  exigir((escenario.diasOpcionales ?? []).every(dia => escenario.dias.includes(dia)), 'Día opcional fuera de los días de entrenamiento')
  let anterior = -1
  for (const evento of escenario.eventos) {
    exigir(Number.isInteger(evento.dia) && evento.dia >= anterior && evento.dia >= 0, 'Eventos desordenados o día no válido')
    anterior = evento.dia
    switch (evento.tipo) {
      case 'ausencia': exigir(Number.isInteger(evento.hasta) && evento.hasta >= evento.dia, 'Intervalo de ausencia no válido'); break
      case 'conducta': exigir(['normal', 'facil', 'dificil', 'estancado', 'sin-esfuerzo'].includes(evento.valor), 'Conducta no válida'); break
      case 'sesion': exigir(['corta', 'abandonada'].includes(evento.valor), 'Estado de sesión no válido'); break
      case 'decision': exigir(['aceptar', 'posponer', 'rechazar', 'deshacer'].includes(evento.valor), 'Decisión no válida'); break
      case 'material': exigir(Array.isArray(evento.quitar) && evento.quitar.every(valor => typeof valor === 'string'), 'Material no válido'); break
      case 'ocupado': exigir(typeof evento.ejercicio === 'string' && evento.ejercicio.length > 0, 'Ejercicio ocupado no válido'); break
      case 'molestia': exigir(typeof evento.zona === 'string' && ['mejor', 'igual', 'peor', 'ya'].includes(evento.estado), 'Molestia no válida'); break
      default: throw new Error('Tipo de evento desconocido')
    }
  }
}

export function validarConfiguracion(configuracion: Configuracion): void {
  exigir(configuracion.version === 2, 'Versión de configuración no compatible')
  exigir(Number.isInteger(configuracion.semilla) && configuracion.semilla >= 0 && configuracion.semilla <= 0xffffffff, 'Semilla fuera de rango uint32')
  exigir(Number.isInteger(configuracion.semanas) && configuracion.semanas >= 1 && configuracion.semanas <= 520, 'Semanas fuera de rango (1-520)')
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(configuracion.inicio), 'Fecha inicial no válida')
  exigir(fechaEn(configuracion.inicio, 0) === configuracion.inicio, 'Fecha inicial inexistente')
  validarEscenario(configuracion.escenario)
}
