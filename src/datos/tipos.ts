// Modelo de datos de JowyFit. Todo se guarda en el móvil (IndexedDB).
import type { CopiasAuto } from '../dominio/copias'

export type Sexo = 'hombre' | 'mujer'
export type TipoObjetivo = 'salud' | 'perder' | 'recomposicion' | 'musculo' | 'fuerza' | 'estetica' | 'peso'
export type Nivel = 'empiezo' | 'vuelvo' | 'intermedio' | 'avanzado'
export type Reps = 'pesadas' | 'moderadas' | 'mezcla'
export type Cardio = 'nada' | 'pasos' | 'trote'
export type Transporte = 'coche' | 'andando'
export type Trabajo = 'sentado' | 'depie' | 'fisico'
export type Zona = 'rodilla' | 'lumbar' | 'hombro' | 'muneca' | 'codo'
export type Dia = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = lunes … 6 = domingo
/** Grupos de ejercicio que se pueden quitar de golpe («¿Qué no quieres hacer?»). */
export type GrupoNoQuiero = 'cardio' | 'corporal' | 'maquinas' | 'libre' | 'poleas' | 'suelo'
/** Síntomas que bloquean la rutina hasta que el médico dé el visto bueno. */
export type Urgencia = 'pecho' | 'mareo' | 'aire' | 'palpitaciones'
export type CondicionSalud = 'tension' | 'osteoporosis' | 'diabetes' | 'protesis' | 'anticoagulantes' | 'asma' | 'embarazo'
export type ZonaDolor =
  | 'cuello' | 'hombros' | 'codos' | 'munecas' | 'manos' | 'lumbar' | 'caderas' | 'rodillas' | 'tobillos' | 'pies'
  | 'pecho' | 'espalda' | 'brazo' | 'abdomen' | 'gluteo' | 'muslo' | 'isquio' | 'gemelo'
  | 'cabeza' | 'estomago' | 'hormigueo' | 'cansancio' | 'fiebre'
/** Una molestia apuntada con sus tres toques; `inicio`, cuándo se apuntó. */
export type Dolor = { zona: ZonaDolor; cuanto: 'poco' | 'regular' | 'mucho'; cuando: 'siempre' | 'fuerza' | 'aveces'; desde: 'dias' | 'semanas' | 'meses'; inicio: string }
export type TipoCardio = 'caminar' | 'bici' | 'eliptica' | 'nadar' | 'correr'

/** Fila leída de la base: el id es opcional al crearla, pero lo guardado siempre lo tiene. */
export type Guardado<T extends { id?: number }> = T & { id: number }

export type Perfil = {
  id: 'yo'
  creado: string
  altaCompleta: boolean
  nombre: string
  nacimiento: string // AAAA-MM-DD
  sexo: Sexo
  alturaCm: number
  // objetivo
  objetivo: TipoObjetivo
  /** Hasta 2 objetivos más: suman sin cambiar el principal (cardio, calorías, zonas…). */
  objetivosExtra?: TipoObjetivo[]
  prioridades: string[] // texto libre ordenado: «Quitar barriga», «Press de banca»…
  zonasPrioridad: string[] // hasta 3: pecho, espalda, hombros, brazos, abdomen, gluteo, piernas, gemelos
  /** Las de zonasPrioridad con «Mucho más» (las demás son «Un poco más»). */
  zonasMucho?: string[]
  // experiencia
  nivel: Nivel
  referencias: Record<string, string> // banca: «40 kg × 8»…
  // horario
  diasFijos: Dia[]
  diasOpcionales: Dia[]
  horaEntreno: string // «05:30»
  transporte: Transporte
  horaLimite: Record<Transporte, string> // hora a la que hay que irse del gimnasio
  minutosNormal: number
  minutosCorta: number
  horaDormir: string // «22:00»
  enAyunas: boolean
  sesionPerdida: 'sabado' | 'saltar'
  // salud y gustos
  zonasSensibles: Zona[]
  lesiones: string
  condiciones: string
  /** Síntomas de urgencia marcados: mientras haya alguno, no hay rutina. */
  urgencias?: Urgencia[]
  dolores?: Dolor[]
  condicionesSalud?: CondicionSalud[]
  /** Lo que no quiere hacer nunca (filtro duro, como el material que no hay). */
  noQuiero?: GrupoNoQuiero[]
  /** Modo mayor: se propone, nunca se impone. `rechazado`: fecha del «Ahora no» (no se insiste hasta que cambie algo). */
  modoMayor?: { activo: boolean; propuesto?: string; rechazado?: string }
  /** En orden (toca la siguiente, sea el día que sea) o por días fijos de la semana. */
  modoRutina?: 'cola' | 'dias'
  preferencia: 'maquinas' | 'libre' | 'mezcla'
  reps: Reps
  superseries: boolean
  alFallo: boolean
  core: boolean
  cardio: Cardio
  // comida y vida
  comidasDia: number
  franjasHambre: string[]
  bebidas: string[]
  suplementos: string[]
  /** Cuánto toma de cada suplemento, escrito por el dueño («10 g», «2 cápsulas»). Si falta, se enseña lo habitual. */
  dosisSuplementos?: Record<string, string>
  /** Lo que lleva su batido de proteína: al marcarlo en Comida se apunta y suma al día. */
  batido?: { proteina: number; kcal: number }
  trabajo: Trabajo
  pasosObjetivo: number
  /** Minutos de cardio a la semana que toca ahora (sube poco a poco), qué tipo y cuándo. */
  cardioMin?: number
  cardioTipos?: TipoCardio[]
  cardioCuando?: 'despues' | 'otro'
  /** Lo que se sube poco a poco: desde cuándo (lunes) va la meta de pasos y de cardio actual. */
  progresoMovimiento?: string
  // datos extra, opcionales y poco a poco
  sueno?: 'poco' | 'normal' | 'mucho'
  deportes?: string[]
  /** Día de su partido o deporte (no se cargan las piernas la víspera). */
  diaDeporte?: Dia | null
  experienciaPrevia?: 'nunca' | 'hace-anos' | 'hace-meses' | 'ahora'
  // seguimiento
  diasPesaje: Dia[]
  fotosCadaSemanas: number
}

export type OrigenMedicion = 'casa' | 'gimnasio' | 'cinta' | 'manual' | 'otra'

export type Bascula = Partial<{
  grasaPct: number
  masaGrasaKg: number
  masaLibreKg: number
  musculoKg: number
  musculoEsqKg: number
  aguaPct: number
  proteinaPct: number
  oseaKg: number
  visceral: number
  subcutaneaPct: number
  basalKcal: number
  edadCorporal: number
}>

export type Medicion = {
  id?: number
  fecha: string // ISO con hora
  origen: OrigenMedicion
  pesoKg?: number
  perimetros?: Partial<Record<'cintura' | 'cuello' | 'cadera' | 'pecho' | 'brazo' | 'brazoContraido' | 'muslo', number>>
  bascula?: Bascula
  /** Traída de Health Connect: sus ids (para no traerla dos veces) y la app que la escribió (la de la báscula). */
  hc?: string[]
  fuente?: string
}

export type Foto = { id?: number; fecha: string; pose: 'frente' | 'perfil' | 'espalda'; imagen: Blob }

export type Tramo = { desde: number; hasta: number; paso: number }

export type MaquinaPropia = { id: string; nombre: string; parecida: string | null; foto?: Blob; notas?: string }

export type Gimnasio = {
  id?: number
  nombre: string
  notas: string
  material: string[] // claves de material de RepDB
  propias: MaquinaPropia[]
  mancuernas: Tramo[]
  discos: number[]
  barraKg: number
  creado: string
}

export type MarcaEjercicio = {
  id: string // id de RepDB
  favorito?: boolean
  odiado?: boolean
  duele?: boolean
  notas?: string
  ajustes?: string // «Asiento 4 · respaldo 2»
}

export type TipoRegistro = 'peso' | 'mancuerna' | 'asistido' | 'corporal' | 'tiempo' | 'cardio'

/** Ejercicio creado por el usuario (lo que no está en RepDB). Su nombre es el suyo: no se traduce. */
export type EjercicioPropio = {
  id: string // «mio-…»
  nombre: string
  grupo: 'pecho' | 'espalda' | 'hombro' | 'brazo' | 'abdomen' | 'gluteo' | 'pierna' | 'completo'
  material: 'corporal' | 'barra' | 'mancuernas' | 'maquina' | 'polea' | 'otro'
  /** Con mancuernas, «peso» se apunta como los kg de cada una. */
  registro: 'peso' | 'corporal' | 'tiempo' | 'cardio'
  /** Se hace con un lado cada vez (una pierna o un brazo): las repeticiones se apuntan por lado. */
  unilateral?: boolean
  foto?: Blob
  notas?: string
  /** La rutina automática puede proponerlo (si no, solo sale donde lo pone el usuario). */
  rutinaAuto: boolean
  creado: string
  /** Fecha en que se borró: se queda para que el historial y el informe sigan teniendo su nombre. */
  borrado?: string
}

export type Bloque = {
  uid: string
  ejercicio: string // id RepDB (A)
  alternativas: string[] // B, C
  series: number
  repsMin: number
  repsMax: number
  rpe: number
  descanso: number // segundos
  superserie?: string // uid del bloque con el que va en superserie (A1/A2)
  fueraEnCorta?: boolean
  registro: TipoRegistro
  /** Peso rebajado por una molestia (0,8 = −20 %), puesto por la revisión semanal. */
  cargaPct?: number
}

export type DiaRutina = {
  letra: string // A, B, C, S (sábado)
  nombre: string // «Cuerpo completo A»
  dia: Dia | null // null = opcional
  opcional: boolean
  bloques: Bloque[]
}

export type Rutina = {
  id?: number
  creada: string
  activa: boolean
  estructura: string // «Cuerpo completo · 3 días»
  porque: string[]
  calibracion: boolean
  gimnasioId: number | null
  dias: DiaRutina[]
  /** Modo mayor: minutos del bloque de equilibrio al final de cada entreno. */
  equilibrio?: number
  /** Lo que la rutina no pudo cubrir (grupos quitados sin otro ejercicio posible), para avisar. */
  sinCubrir?: string[]
}

export type Serie = {
  n: number
  /** Kilos. En los asistidos va en negativo (la ayuda); en los de peso corporal, el lastre que se cuelga (o null). */
  peso: number | null
  reps: number | null
  segundos?: number | null
  rpe: number | null
  calentamiento: boolean
  hecha: boolean
  ts?: number // fin de la serie (marca de tiempo)
  nota?: string
  record?: boolean
  /**
   * Ejercicios de un lado cada vez (zancadas, remo a una mano…): repeticiones de cada lado. `reps` es el lado que
   * menos hizo, para que la progresión y los récords no se pasen; el volumen suma los dos.
   */
  izq?: number | null
  der?: number | null
  /** Cardio: kilómetros, si se saben (los minutos van en `reps`). */
  km?: number | null
}

export type EjercicioSesion = {
  uid: string // del bloque
  ejercicio: string // el hecho de verdad (puede ser la alternativa)
  planificado: string
  motivo?: 'ocupado' | 'cambio'
  estado: 'pendiente' | 'curso' | 'hecho' | 'saltado'
  series: Serie[]
  inicio?: number
  fin?: number
  repsMin: number
  repsMax: number
  rpe: number
  descanso: number
  superserie?: string
  registro: TipoRegistro
  /** Se hizo con el peso rebajado por una molestia (revisión semanal): no cuenta para el peso que toca después. */
  cargaPct?: number
  /** Molestó en este entreno («Me duele» o «¿Alguna molestia?» al acabar): varias seguidas proponen cambiarlo. */
  molestia?: boolean
  /** Se quita al pasar a la versión corta. Solo en el sábado armado, cuyos ejercicios no están en la rutina. */
  fueraEnCorta?: boolean
}

export type Sesion = {
  id?: number
  fecha: string // AAAA-MM-DD
  rutinaId: number | null
  letra: string // A, B, C, S o L (libre)
  nombre: string
  gimnasioId: number | null
  inicio: number
  fin?: number
  horaLimite?: string
  version: 'normal' | 'corta' | 'minima'
  estado: 'curso' | 'hecha' | 'cancelada'
  ejercicios: EjercicioSesion[]
  /** Fin del descanso en curso (marca de tiempo) y su duración total, para el temporizador. */
  descansoHasta?: number
  descansoTotal?: number
  respuestas?: { minutosReales?: number; descansos?: 'cortos' | 'bien' | 'largos'; molestia?: string; ocupado?: string; nota?: string }
  calibracion: boolean
  /** Semana suave (descarga): 1 serie menos y −10 %. No cuenta para la progresión. */
  suave?: boolean
}

export type Franja = 'desayuno' | 'comida' | 'merienda' | 'cena'

export type Comida = {
  id?: number
  fecha: string // AAAA-MM-DD
  hora: string // HH:MM
  franja: Franja
  nombre: string
  kcal: number
  proteina: number
  cafeina?: number
  racion: 'P' | 'N' | 'G'
  tipo: 'plantilla' | 'producto' | 'nota' | 'foto' | 'picoteo' | 'bebida'
  plantillaId?: number
  codigo?: string
  foto?: Blob
  /** Apuntado al marcar un suplemento (el batido): al desmarcarlo se quita. */
  suplemento?: string
  /** Gramos, solo si se saben (escaneados): hidratos, de ellos azúcares, grasas y sal. */
  hidratos?: number
  azucares?: number
  grasas?: number
  sal?: number
}

export type Plantilla = {
  id?: number
  nombre: string
  kcal: number
  proteina: number
  cafeina?: number
  franja?: Franja
  tipo: 'comida' | 'picoteo' | 'bebida'
  usos: number
  foto?: Blob
  codigo?: string
  /** Gramos, solo si se saben (de un escaneado): hidratos, de ellos azúcares, grasas y sal. */
  hidratos?: number
  azucares?: number
  grasas?: number
  sal?: number
}

export type Producto = {
  codigo: string
  nombre: string
  marca: string
  imagen?: string
  kcal100: number | null
  proteina100: number | null
  hidratos100?: number | null
  grasas100?: number | null
  azucares100?: number | null
  sal100?: number | null
  /** mg por 100 g */
  cafeina100?: number | null
  racionG: number | null
  kcalRacion: number | null
  proteinaRacion: number | null
  guardado: string
  /** Escaneado sin conexión: se busca al volver a tener cobertura. */
  pendiente?: boolean
  /** Creado a mano porque no estaba en Open Food Facts. */
  manual?: boolean
}

export type PasosDia = { fecha: string; pasos: number; fuente: 'auto' | 'manual'; troteKm?: number; cardio?: { tipo: TipoCardio; min: number }[] }

export type DiaSuplementos = { fecha: string; tomados: string[] }

export type Meta = {
  id?: number
  /** «ejercicio»: los kg de un ejercicio; «reps»: las repeticiones seguidas en una serie de un ejercicio. */
  tipo: 'cintura' | 'ejercicio' | 'reps' | 'dominadas' | 'grasa' | 'peso' | 'libre'
  titulo: string
  objetivo: number
  unidad: string
  fecha?: string
  ejercicio?: string
  inicio?: number
  hecha?: boolean
}

/**
 * Qué consejo de la quincena tocó (sin depender del idioma: la frase se saca al pintarlo).
 * La lista la usa también validarCopia: un consejo nuevo se añade solo aquí.
 */
export const TIPOS_CONSEJO = ['faltan-datos', 'proteina', 'sube-peso', 'peso-estable', 'baja-cintura', 'menos-picoteo', 'recorta-cenas', 'estable-picoteo', 'estable'] as const
export type TipoConsejo = typeof TIPOS_CONSEJO[number]

/** El objetivo del día en un momento: kcal, proteína y el peso con el que se calculó. */
export type ObjetivoDia = { kcal: number; proteina: number; peso: number | null }

/**
 * Un ajuste de cada 2 semanas: el objetivo de antes y el de después, y por qué (el consejo de la quincena).
 * El primero es el punto de partida (`antes` null, `porque` «inicio»). `manual`: el objetivo lo había puesto la persona.
 */
export type AjusteEnergia = { fecha: string; antes: ObjetivoDia | null; despues: ObjetivoDia; porque: TipoConsejo | 'inicio'; manual?: boolean }

export type Ajustes = {
  id: 'app'
  gimnasioActivo: number | null
  descansoCompuesto: number
  descansoAislamiento: number
  vibrar: boolean
  sonido: boolean
  pantallaEncendida: boolean
  calentamiento: boolean
  avisosSeguridad: boolean
  mostrarKcal: boolean
  kcalManual: number | null
  proteinaManual: number | null
  cafeinaLimite: number
  cafeinaHoraTope: string
  fuentePasos: 'auto' | 'manual'
  /** Peso y % de grasa de la báscula: se traen solos de Health Connect o se apuntan a mano. */
  fuenteBascula?: 'auto' | 'manual'
  /** Pesadas de Health Connect que se borraron en la app: no se vuelven a traer. */
  hcIgnorados?: string[]
  /** Cada entreno terminado se guarda en Health Connect como sesión de fuerza (solo Android; apagado si falta). */
  entrenosASalud?: boolean
  noti: {
    dormir: boolean
    pesarse: boolean
    pesarseHora: string
    batido: boolean
    batidoHora: string
    creatina: boolean
    creatinaHora: string
    copia: boolean
    fotos: boolean
    domingo: boolean
    /** Revisión semanal de molestias: el domingo a la hora de `revisionHora`. */
    revision?: boolean
    revisionHora?: string
  }
  copiaAuto: boolean
  /** Copias automáticas que se guardan (las más nuevas; 0 = todas). */
  copiasAuto: CopiasAuto
  ultimaCopia: string | null
  /** Día del último ajuste de cada 2 semanas (el último de `historialEnergia`). */
  ultimoAjusteEnergia: string | null
  /** Los ajustes de cada 2 semanas, del más viejo al más nuevo (los últimos HISTORIAL_MAX). */
  historialEnergia?: AjusteEnergia[]
  /** Explicar en el entreno qué significa cada número del esfuerzo. */
  ayudaEsfuerzo?: boolean
  /** A qué hora empieza cada comida del día: con ellas se elige sola la franja al apuntar. */
  franjasHoras?: Record<Franja, string>
  /** Pasos que cuenta 1 km de trote o carrera. */
  pasosPorKm?: number
  /** Sesiones perdidas que se pasaron a otro día. */
  recolocadas: { fecha: string; letra: string; desde: string }[]
  /** Fecha de inicio (para «semana N»). */
  inicio: string | null
  /** Lunes de la última semana suave (descarga) aceptada. */
  semanaSuave?: string | null
  /** «Ahora no» a la semana suave: no se vuelve a proponer hasta pasado este lunes. */
  suavePospuesta?: string | null
  /** «Seguir igual» a cambiar un ejercicio que molesta: no se vuelve a proponer hasta otra molestia en un entreno posterior. */
  molestiasVistas?: { ejercicio: string; sesion: number }[]
  /**
   * Celebraciones de Inicio ya enseñadas (claves de dominio/celebraciones). null: aún no se ha mirado nunca; la
   * primera vez lo que ya había se da por visto, para no celebrar de golpe cosas de hace meses.
   */
  celebradas?: string[] | null
  /** Lo último que se eligió en «Informe en PDF» (de qué días y qué lleva). */
  informe?: {
    periodo: 'hoy' | 'ayer' | 'semana' | 'mes' | 'todo'
    secciones: { entrenos: boolean; comida: boolean; cuerpo: boolean; pasos: boolean; detalle: boolean }
  }
  /** Lo último que se eligió al hacer las fotos de progreso: qué cámara y si se esperan 5 segundos. */
  fotos?: { camara: 'delantera' | 'trasera'; esperar: boolean }
}

/** Revisión semanal: qué tal cada molestia, qué hay de nuevo y qué cambió en los entrenos que quedan. */
export type Revision = {
  id?: number
  fecha: string // AAAA-MM-DD
  estado: 'bien' | 'molestia' | 'lesion' | 'seguimiento'
  respuestas: { zona: ZonaDolor; va: 'mejor' | 'igual' | 'peor' | 'ya' }[]
  cambios: CambioRevision[]
}
/** Un cambio en un bloque del plan por una molestia, con el bloque de antes para deshacerlo o volver a lo normal. */
/** Un cambio de la revisión. `vuelta`: devuelve el bloque hacia lo normal (no suaviza, así que no se «devuelve» otra vez). */
export type CambioRevision = { uid: string; letra: string; zona: ZonaDolor; antes: Bloque; despues: Bloque; deshecho?: boolean; vuelta?: boolean }
