// Modelo de datos de JowyFit. Todo se guarda en el móvil (IndexedDB).

export type Sexo = 'hombre' | 'mujer'
export type TipoObjetivo = 'recomposicion' | 'perder' | 'fuerza'
export type Nivel = 'empiezo' | 'vuelvo' | 'intermedio' | 'avanzado'
export type Reps = 'pesadas' | 'moderadas' | 'mezcla'
export type Cardio = 'nada' | 'pasos' | 'trote'
export type Transporte = 'coche' | 'andando'
export type Trabajo = 'sentado' | 'depie' | 'fisico'
export type Zona = 'rodilla' | 'lumbar' | 'hombro' | 'muneca' | 'codo'
export type Dia = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = lunes … 6 = domingo

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
  prioridades: string[] // texto libre ordenado: «Quitar barriga», «Press de banca»…
  zonasPrioridad: string[] // brazos, pecho, espalda, hombros, piernas, gluteo, abdomen
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
  trabajo: Trabajo
  pasosObjetivo: number
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
}

export type Serie = {
  n: number
  peso: number | null
  reps: number | null
  segundos?: number | null
  rpe: number | null
  calentamiento: boolean
  hecha: boolean
  ts?: number // fin de la serie (marca de tiempo)
  nota?: string
  record?: boolean
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
  version: 'normal' | 'corta'
  estado: 'curso' | 'hecha' | 'cancelada'
  ejercicios: EjercicioSesion[]
  /** Fin del descanso en curso (marca de tiempo) y su duración total, para el temporizador. */
  descansoHasta?: number
  descansoTotal?: number
  respuestas?: { minutosReales?: number; descansos?: 'cortos' | 'bien' | 'largos'; molestia?: string; ocupado?: string; nota?: string }
  calibracion: boolean
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

export type PasosDia = { fecha: string; pasos: number; fuente: 'auto' | 'manual'; troteKm?: number }

export type DiaSuplementos = { fecha: string; tomados: string[] }

export type Meta = {
  id?: number
  tipo: 'cintura' | 'ejercicio' | 'dominadas' | 'grasa' | 'peso' | 'libre'
  titulo: string
  objetivo: number
  unidad: string
  fecha?: string
  ejercicio?: string
  inicio?: number
  hecha?: boolean
}

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
  }
  copiaAuto: boolean
  ultimaCopia: string | null
  ultimoAjusteEnergia: string | null
  /** Sesiones perdidas que se pasaron a otro día. */
  recolocadas: { fecha: string; letra: string; desde: string }[]
  /** Fecha de inicio (para «semana N»). */
  inicio: string | null
}
