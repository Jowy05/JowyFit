import { diaSemana } from './azar.ts'
import type { Adaptador, Configuracion, ContextoDia, PlanSesion, ResultadoSesion } from './tipos.ts'

export function crearAdaptador(): Adaptador {
  let configuracion: Configuracion
  let turno = 0
  let sesiones = 0
  let planActual: PlanSesion | null = null
  const cargas = new Map<string, number>()
  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  return {
    identidad: { nombre: 'Sistema ficticio de demostración, no JowyFit', version: '1', objetivo: 'ficticio', huellaCatalogo: null },
    iniciar(entrada) { configuracion = entrada; turno = 0; sesiones = 0; planActual = null; cargas.clear() },
    prepararDia() {},
    planificar(contexto: ContextoDia) {
      const posicion = configuracion.escenario.persona.modo === 'cola' ? turno % configuracion.escenario.persona.sesiones : configuracion.escenario.dias.indexOf(diaSemana(contexto.fecha))
      const letra = letras[posicion] ?? 'A'
      const ocupado = contexto.eventos.some(evento => evento.tipo === 'ocupado' && evento.ejercicio === `demo-${letra}`)
      const ejercicio = ocupado ? `demo-${letra}-alternativa` : `demo-${letra}`
      const peso = cargas.get(ejercicio) ?? 10
      const tieneMancuernas = contexto.material.includes('dumbbell')
      planActual = {
        letra, minutosEstimados: 12,
        ejercicios: [{
          id: `bloque-${letra}`, ejercicio, registro: tieneMancuernas ? 'peso' : 'corporal',
          series: 3, minimo: 8, maximo: 12, esfuerzo: 7, descanso: 90,
          peso: tieneMancuernas ? peso : null, pesos: tieneMancuernas ? [10, 12, 14, 16, 18, 20] : [],
          material: tieneMancuernas ? ['dumbbell'] : [], zonas: posicion % 2 ? ['piernas'] : ['espalda'],
          accion: cargas.has(ejercicio) ? 'mantener' : 'primera',
        }],
      }
      return planActual
    },
    registrar(_contexto: ContextoDia, resultado: ResultadoSesion) {
      if (resultado.estado === 'abandonada') return
      turno++
      sesiones++
      for (const ejercicio of resultado.ejercicios) {
        const ultima = ejercicio.series.filter(serie => serie.hecha).at(-1)
        if (ultima?.peso != null) cargas.set(ejercicio.ejercicio, ultima.peso)
      }
    },
    cerrarDia() {
      return [
        { regla: 'demo.estado', estado: 'aprobada', detalle: `Sesiones registradas: ${sesiones}; última letra: ${planActual?.letra ?? 'ninguna'}` },
        { regla: 'aplicacion.ciclo', estado: 'pendiente', detalle: 'Sistema ficticio: no evalúa calibración, salud, revisiones ni descargas de JowyFit' },
      ]
    },
    finalizar() { cargas.clear(); planActual = null },
  }
}
