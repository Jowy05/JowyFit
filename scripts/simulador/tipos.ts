import type { CondicionSalud, Dia, Nivel, Perfil, Sexo, TipoObjetivo, TipoRegistro, Urgencia, Zona, ZonaDolor } from '../../src/datos/tipos'

export type Conducta = 'normal' | 'facil' | 'dificil' | 'estancado' | 'sin-esfuerzo'
export type Decision = 'aceptar' | 'posponer' | 'rechazar' | 'deshacer'

/** Lo que se sabe de la persona virtual: los campos de salud usan el vocabulario del perfil real. */
export type Persona = {
  edad: number
  imc?: number
  mesesSinEntrenar?: number
  semanasPosparto?: number
  pruebaSillaSegundos?: number
  sexo: Sexo
  nivel: Nivel
  objetivo: TipoObjetivo
  sesiones: number
  minutos: number
  modo: NonNullable<Perfil['modoRutina']>
  material: string[]
  zonasSensibles: Zona[]
  urgencias: Urgencia[]
  condicionesSalud: CondicionSalud[]
  /** Probabilidad de ir un día previsto (0-1). */
  asistencia: number
  /** Ruido relativo del rendimiento (0-0,5). */
  variabilidad: number
}

export type Evento =
  | { dia: number; tipo: 'ausencia'; hasta: number }
  | { dia: number; tipo: 'conducta'; valor: Conducta }
  | { dia: number; tipo: 'sesion'; valor: 'corta' | 'abandonada' }
  | { dia: number; tipo: 'material'; quitar: string[] }
  | { dia: number; tipo: 'ocupado'; ejercicio: string }
  | { dia: number; tipo: 'molestia'; zona: ZonaDolor; estado: 'mejor' | 'igual' | 'peor' | 'ya' }
  | { dia: number; tipo: 'decision'; valor: Decision }

export type Escenario = {
  id: string
  nombre: string
  persona: Persona
  dias: Dia[]
  /** Días de `dias` que van como opcionales en el perfil. */
  diasOpcionales?: Dia[]
  /** Al retirar material, la persona se apunta a otro gimnasio en vez de cambiar el suyo. */
  otroGimnasio?: boolean
  eventos: Evento[]
}

export type Configuracion = {
  version: 2
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
  registro: TipoRegistro
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
  version: 3
  modelo: 'guiones-1'
  configuracion: Configuracion
  /** Versión de JowyFit (package.json) y huella SHA-256 del catálogo usado. */
  aplicacion: { version: string; huellaCatalogo: string }
  resumen: Resumen
  pasos: Paso[]
}
