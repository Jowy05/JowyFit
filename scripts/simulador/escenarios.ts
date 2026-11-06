import type { Escenario, Evento, Persona } from './tipos.ts'

const completo = ['dumbbell', 'flat_bench', 'barbell', 'cable', 'pull_up_bar', 'leg_press', 'smith_machine']
const casa = ['dumbbell', 'flat_bench']
const base: Persona = {
  edad: 30, sexo: 'hombre', nivel: 'empiezo', objetivo: 'salud', sesiones: 3, minutos: 60,
  modo: 'cola', material: completo, restricciones: [], excluidos: [], asistencia: 1, variabilidad: 0,
}

const diasPorFrecuencia: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5],
}

function escenario(id: string, nombre: string, persona: Partial<Persona>, eventos: Evento[] = []): Escenario {
  const perfil = { ...base, ...persona }
  return { id, nombre, persona: structuredClone(perfil), dias: [...diasPorFrecuencia[perfil.sesiones]!], eventos }
}

export function escenariosBase(): Escenario[] {
  return [
    escenario('casa-rodilla', '62 años, casa y rodilla sensible', { edad: 62, sexo: 'mujer', sesiones: 2, minutos: 45, material: casa, restricciones: ['rodilla'] }),
    escenario('musculo-gimnasio', '30 años, músculo y gimnasio completo', { sesiones: 4, objetivo: 'musculo', nivel: 'intermedio' }),
    escenario('vuelta-lumbar', 'Vuelta tras cinco años, lumbar sensible', { nivel: 'vuelvo', mesesSinEntrenar: 60, restricciones: ['lumbar'] }),
    escenario('perder-grasa', 'Objetivo perder grasa, IMC de referencia 37', { objetivo: 'perder', imc: 37 }),
    escenario('mayor-piernas', '72 años, fuerza baja de piernas', { edad: 72, sesiones: 2, material: casa, pruebaSillaSegundos: 18, restricciones: ['fuerzaBajaPiernas'] }),
    escenario('fuerza-barra', 'Fuerza con barra, tres sesiones', { objetivo: 'fuerza', material: ['barbell', 'flat_bench'], nivel: 'intermedio' }),
    escenario('minimo-tiempo', 'Una sesión y treinta minutos', { sesiones: 1, minutos: 30, modo: 'dias' }),
    escenario('seis-dias', 'Seis sesiones y noventa minutos', { sesiones: 6, minutos: 90, nivel: 'intermedio', modo: 'dias' }),
    escenario('bloqueo-pecho', 'Chequeo con dolor en el pecho', { restricciones: ['dolorPecho'] }),
    escenario('posparto', 'Posparto de seis semanas', { sexo: 'mujer', semanasPosparto: 6, restricciones: ['posparto6Semanas'] }),
    escenario('turnos', 'Turnos irregulares y ausencias', { asistencia: 0.7, variabilidad: 0.08 }, [{ dia: 7, tipo: 'ausencia', hasta: 11 }]),
    escenario('sin-barra', 'Casa sin barra de dominadas', { material: casa }),
    escenario('condiciones', '66 años, hipertensión y osteoporosis', { edad: 66, restricciones: ['hipertension', 'osteoporosis'] }),
  ]
}

export function escenariosLimite(): Escenario[] {
  return [
    escenario('sin-material', 'Sin material disponible', { material: [] }),
    escenario('sin-historial', 'Primeras sesiones sin esfuerzo apuntado', {}, [{ dia: 0, tipo: 'conducta', valor: 'sin-esfuerzo' }]),
    escenario('pausa-y-vuelta', 'Pausa de tres semanas y vuelta', {}, [{ dia: 14, tipo: 'ausencia', hasta: 34 }]),
    escenario('incidencias', 'Sesiones parciales, retirada de material y revisión', {}, [
      { dia: 0, tipo: 'sesion', valor: 'abandonada' },
      { dia: 2, tipo: 'sesion', valor: 'corta' },
      { dia: 4, tipo: 'material', quitar: ['dumbbell'] },
      { dia: 7, tipo: 'molestia', zona: 'rodilla', estado: 'peor' },
      { dia: 7, tipo: 'decision', valor: 'posponer' },
      { dia: 14, tipo: 'decision', valor: 'aceptar' },
      { dia: 21, tipo: 'decision', valor: 'deshacer' },
      { dia: 28, tipo: 'conducta', valor: 'estancado' },
      { dia: 35, tipo: 'molestia', zona: 'rodilla', estado: 'ya' },
    ]),
  ]
}
