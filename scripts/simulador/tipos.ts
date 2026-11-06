export type Registro = 'peso' | 'mancuerna' | 'asistido' | 'corporal' | 'tiempo' | 'cardio'
export type Conducta = 'normal' | 'facil' | 'dificil' | 'estancado' | 'sin-esfuerzo'
export type Decision = 'aceptar' | 'posponer' | 'rechazar' | 'deshacer'

export type Persona = {
  edad: number
  imc?: number
  mesesSinEntrenar?: number
  semanasPosparto?: number
  pruebaSillaSegundos?: number
  sexo: 'hombre' | 'mujer'
  nivel: 'empiezo' | 'vuelvo' | 'intermedio'
  objetivo: 'salud' | 'musculo' | 'fuerza' | 'perder'
  sesiones: number
  minutos: number
  modo: 'dias' | 'cola'
  material: string[]
  restricciones: string[]
  excluidos: string[]
  asistencia: number
  variabilidad: number
}

export type Evento =
  | { dia: number; tipo: 'ausencia'; hasta: number }
  | { dia: number; tipo: 'conducta'; valor: Conducta }
  | { dia: number; tipo: 'sesion'; valor: 'corta' | 'abandonada' }
  | { dia: number; tipo: 'material'; quitar: string[] }
  | { dia: number; tipo: 'ocupado'; ejercicio: string }
  | { dia: number; tipo: 'molestia'; zona: string; estado: 'mejor' | 'igual' | 'peor' | 'ya' }
  | { dia: number; tipo: 'decision'; valor: Decision }

export type Escenario = {
  id: string
  nombre: string
  persona: Persona
  dias: number[]
  eventos: Evento[]
}

export type Configuracion = {
  version: 1
  escenario: Escenario
  semilla: number
  semanas: number
  inicio: string
}

export type ContextoDia = {
  indice: number
  fecha: string
  lunes: string
  semana: number
  programado: boolean
  decision: Decision
  eventos: Evento[]
  material: string[]
}

export type Prescripcion = {
  id: string
  ejercicio: string
  registro: Registro
  series: number
  minimo: number
  maximo: number
  esfuerzo: number
  descanso: number
  peso: number | null
  pesos: number[]
  material: string[]
  zonas: string[]
  accion: 'primera' | 'subir' | 'mantener' | 'bajar'
}

export type PlanSesion = {
  letra: string
  minutosEstimados: number
  ejercicios: Prescripcion[]
}

export type SerieVirtual = {
  numero: number
  peso: number | null
  repeticiones: number | null
  segundos: number | null
  esfuerzo: number | null
  hecha: boolean
}

export type ResultadoSesion = {
  estado: 'completa' | 'corta' | 'abandonada'
  minutos: number
  ejercicios: { id: string; ejercicio: string; series: SerieVirtual[] }[]
}

export type Comprobacion = {
  regla: string
  estado: 'aprobada' | 'fallida' | 'no-evaluable' | 'pendiente'
  detalle: string
}

export type Paso = {
  contexto: ContextoDia
  asistencia: 'descanso' | 'ausente' | 'bloqueada' | 'asiste'
  plan: PlanSesion | null
  resultado: ResultadoSesion | null
  registrada: boolean
  comprobaciones: Comprobacion[]
}

export type Adaptador = {
  identidad: { nombre: string; version: string; objetivo: 'ficticio' | 'aplicacion'; huellaCatalogo: string | null }
  iniciar: (configuracion: Configuracion) => void | Promise<void>
  prepararDia: (contexto: ContextoDia) => void | Promise<void>
  planificar: (contexto: ContextoDia) => PlanSesion | null | Promise<PlanSesion | null>
  registrar: (contexto: ContextoDia, resultado: ResultadoSesion) => void | Promise<void>
  cerrarDia: (contexto: ContextoDia) => Comprobacion[] | Promise<Comprobacion[]>
  finalizar: () => void | Promise<void>
}

export type Metrica = { numerador: number; denominador: number; porcentaje: number | null }
export type Resumen = {
  dias: number
  asistencia: Metrica
  sesiones: { completas: number; cortas: number; abandonadas: number; bloqueadas: number; sinRegistrar: number }
  tiempo: { mediana: number | null; p90: number | null; excedidas: Metrica }
  seriesPorZona: Record<string, { prescritas: number; completadas: number; estimuloDias: number; mayorIntervaloDias: number | null }>
  acciones: Record<Prescripcion['accion'], number>
  contratos: Record<Comprobacion['estado'], number>
  reglas: Record<string, Record<Comprobacion['estado'], number>>
  eventos: Record<string, number>
}

export type Informe = {
  version: 2
  modelo: 'guiones-1'
  configuracion: Configuracion
  adaptador: Adaptador['identidad']
  resumen: Resumen
  pasos: Paso[]
}
