// Tipos del informe en PDF: lo que calcula informe/calculo y pinta informe/pdf.
import type { Ajustes, Comida, DiaSuplementos, Franja, Medicion, Meta, PasosDia, Perfil, Rutina, Sesion } from '../../datos/tipos'
import type { EstadoDia } from '../../dominio/semana'
import type { PuntoFecha, Tono } from '../../dominio/tendencias'

export type PeriodoInforme = 'hoy' | 'ayer' | 'semana' | 'mes' | 'todo'

/** Casillas de la hoja «Informe en PDF». El resumen (página 1) va siempre. */
export type SeccionesInforme = { entrenos: boolean; comida: boolean; cuerpo: boolean; pasos: boolean; detalle: boolean }

/** Colores del PDF: ok verde, warn ámbar, bad rojo, gris (no se juzga), tinta, oro (récord), azul (fácil, primera vez). */
export type TonoInforme = Tono | 'gris' | 'tinta' | 'oro' | 'azul'
export type Direccion = 'sube' | 'baja' | 'igual'
export type Juicio = 'mejor' | 'peor' | 'igual' | 'neutro'

export type Evaluacion = { texto: string; tono: TonoInforme }
/** Flecha de cambio: la dirección es la del número; el color, si es bueno. */
export type Cambio = { valor: number; texto: string; direccion: Direccion; tono: TonoInforme }

export type RangoInforme = {
  periodo: PeriodoInforme
  /** «Último mes» */
  etiqueta: string
  /** AAAA-MM-DD, los dos incluidos. */
  inicio: string
  fin: string
  dias: number
  hoy: string
  /** Hoy o Ayer: el informe es la página «Tu día». */
  unDia: boolean
  /** «21 sep – 20 oct 2026» · «martes 20 oct 2026» */
  texto: string
  /** Debajo de los botones de la hoja: «Del 21 sep al 20 oct de 2026», «Desde el 12 oct de 2026, tu primer dato». */
  textoHoja: string
  notaHoja: string | null
  /** JowyFit-informe-2026-10-20-ultimo-mes.pdf (sin el nombre de la persona). */
  nombreArchivo: string
}

export type CabeceraInforme = {
  /** «Informe de progreso» o «Tu día» (ya en el idioma de la app). */
  titulo: string
  nombre: string | null
  sexo: string | null
  edad: number | null
  alturaCm: number | null
  /** «Último mes · 21 sep – 20 oct 2026» */
  periodo: string
  /** «20/10/2026 22:30» */
  creado: string
  /** Para el pie: «Creado el 20/10/2026 a las 22:30» */
  creadoPie: string
  /** Metadatos del PDF. */
  tituloPdf: string
  autor: string
  /** En «Tu día»: «Comparado con tus últimas 4 semanas». */
  comparado: string | null
}

export type EsfuerzoInforme = {
  /** Media de las series con esfuerzo marcado (1 decimal). Null: ninguna marcada. */
  media: number | null
  palabra: PalabraEsfuerzo | null
  tono: TonoInforme
  /** «8,2 bien» o «sin marcar» */
  texto: string
  marcadas: number
  /** Series de trabajo hechas. */
  total: number
  pct: number | null
  /** Menos del 30 % de series marcadas. */
  pocas: boolean
  /** Media de los esfuerzos objetivo de los ejercicios con series marcadas. */
  objetivo: number | null
}

export type PalabraEsfuerzo = 'fácil' | 'bien' | 'duro' | 'al límite'

export type FilaResumen = {
  /** «Peso (kg)» */
  dato: string
  inicio: string | null
  ahora: string | null
  /** Celda que junta «Al empezar» y «Ahora»: «12 de 13», «128 de media». */
  junto: string | null
  cambio: Cambio | null
  /** Columna «Cambio» sin flecha: «92 %», «obj. 140». */
  cambioTexto: string | null
  /** Filas que se miden contra un objetivo (entrenos, proteína, pasos): van en su propia tabla del PDF. */
  contra: { valor: string; objetivo: string; pct: string | null } | null
  evaluacion: Evaluacion
  nota: string | null
}

export type ZonaCuerpo = {
  nombre: string
  valor: number
  texto: string
  palabra: string
  tono: TonoInforme
  zona: 'bajo' | 'estandar' | 'alto'
  /** Límites de la zona «Estándar». */
  cortes: [number, number]
  escala: [number, number]
  marcas: number[]
  fuente?: 'bascula' | 'medidas'
}

export type SemanaInforme = {
  lunes: string
  domingo: string
  /** Los días de esa semana dentro del periodo. */
  desde: string
  hasta: string
  /** «21-27 sep», «28 sep-4 oct», «19-20 oct» */
  etiqueta: string
  enCurso: boolean
  /** Semana entera (lunes a domingo) dentro del periodo y ya terminada: cuenta para la puntuación. */
  completa: boolean
  /**
   * Puntos de «¿Voy bien?» (0 a 4,5) y su puntuación sobre 100. Null si esa semana no hay nada apuntado
   * (como «Tu semana aún está vacía» en Progreso): no se pinta barra ni cuenta para la media.
   */
  puntos: number | null
  puntuacion: number | null
  /** Color de la barra según la puntuación (verde desde 78, ámbar desde 44, rojo debajo). */
  tono: TonoInforme
  /** Palabra del semáforo de esa semana («Vas bien», «Casi», «Semana floja») y su color. */
  palabra: string | null
  tonoPalabra: TonoInforme
  entrenos: { hechos: number; fijos: number; circulos: boolean[] }
  kg: number
  toneladas: number
  series: number
  esfuerzo: number | null
  proteina: number | null
  kcal: number | null
  pasos: number | null
  peso: number | null
  cintura: number | null
}

export type MesInforme = {
  mes: string
  /** «oct» y el año aparte para el eje. */
  etiqueta: string
  anio: number
  enCurso: boolean
  entrenos: number
  tocaban: number
  kg: number
  esfuerzo: number | null
  peso: number | null
  cintura: number | null
}

export type PuntuacionInforme = { valor: number; palabra: string; tono: TonoInforme; semanas: number; enCurso: boolean; nota: string }

export type ControlPeso = {
  peso: number
  pesoFecha: string
  grasa: number | null
  grasaFuente: 'bascula' | 'medidas' | null
  meta: number
  /** false: no hay meta de grasa y se usa el tramo alto de «normal» (18 % hombre, 25 % mujer). */
  metaPropia: boolean
  pesoConMeta: number | null
  sobra: number | null
  ritmo: number | null
  /** «abril 2027» (solo si la masa grasa baja con 3 semanas o más de datos). */
  fechaMeta: string | null
  filas: { nombre: string; valor: string }[]
}

export type MetaInforme = {
  titulo: string
  tipo: Meta['tipo']
  unidad: string
  objetivo: number
  actual: number | null
  actualTexto: string
  progreso: number
  falta: number | null
  /** «faltan 10 cm», «¡Conseguida!», «vas por las asistidas» */
  faltaTexto: string
  conseguida: boolean
  fecha: string | null
  /** «junio 2027» */
  mes: string | null
}

export type CasillaDia = {
  fecha: string
  inicial: string
  estado: EstadoDia['estado']
  nombre: string | null
  proteina: number | null
  tonoProteina: TonoInforme
  pasos: number | null
  cumplePasos: boolean
  peso: number | null
}

export type LineaDestacado = { icono: 'estrella' | 'sube' | 'baja' | 'igual'; texto: string; tono: TonoInforme }

export type ResumenInforme = {
  tabla: FilaResumen[]
  zonas: ZonaCuerpo[]
  /** «báscula del 20 oct · cinta del 20 oct» */
  zonasSubtitulo: string | null
  zonasNota: string
  /** Null con Hoy o Ayer (va el recuento de «Tu día»). */
  puntuacion: PuntuacionInforme | null
  /** Periodo «Última semana»: las 7 casillas con su estado y lo de cada día (proteína, pasos y peso). */
  casillas: CasillaDia[] | null
  controlPeso: ControlPeso | null
  metas: MetaInforme[]
  /** «junio 2027» si todas las metas con fecha comparten mes. */
  metasFecha: string | null
  indicadores: { fecha: string; filas: { nombre: string; valor: string }[] } | null
  destacado: LineaDestacado[]
  racha: number
  consejo: { texto: string; tono: TonoInforme; etiqueta: string } | null
  /** Secciones marcadas sin datos: una línea en el resumen. */
  lineas: Evaluacion[]
}

export type RecordSesion = { ejercicio: string; nombre: string; peso: number; reps: number; texto: string }

export type FilaEntreno = {
  fecha: string
  /** «mar 22 sep» */
  fechaTexto: string
  sesionId: number | null
  nombre: string
  estado: 'hecho' | 'perdido' | 'movido'
  minutos: number | null
  /** «1 h 8 min», «No hecho», «Movido» */
  duracion: string
  series: number | null
  kg: number | null
  esfuerzo: EsfuerzoInforme | null
  etiquetas: string[]
  records: RecordSesion[]
  saltados: number
}

export type FilaSemanaEntrenos = { lunes: string; etiqueta: string; entrenos: number; minutos: number | null; duracion: string; series: number; kg: number; esfuerzo: number | null; records: number }

export type SubidaInforme = { ejercicio: string; nombre: string; antes: number; ahora: number; fecha: string; record: boolean }

export type EsfuerzoEjercicio = {
  id: string
  nombre: string
  media: number
  palabra: PalabraEsfuerzo
  tono: TonoInforme
  objetivo: number
  queDice: 'lo previsto' | 'más duro' | 'más fácil'
  tonoQueDice: TonoInforme
  marcadas: number
  total: number
}

export type PuntoEsfuerzo = { fecha: string; sesionId: number | null; valor: number; palabra: PalabraEsfuerzo; tono: TonoInforme }

export type EntrenosInforme = {
  sesiones: number
  /** Días distintos con entreno. */
  hechos: number
  enFijos: number
  tocaban: number
  extra: number
  /** «12 de 13» o «4» si no hay rutina. */
  texto: string
  pct: number | null
  evaluacion: Evaluacion
  perdidos: { fecha: string; nombre: string }[]
  /** «1 perdido (vie 2 oct)» */
  perdidosTexto: string | null
  movidos: number
  minutos: number | null
  minutosMedia: number | null
  tiempo: string
  series: number
  saltados: number
  kg: number
  records: number
  subidas: number
  esfuerzo: EsfuerzoInforme
  filas: FilaEntreno[]
  /** Más de 16 entrenos: una fila por semana. */
  porSemana: FilaSemanaEntrenos[] | null
  /** 6 meses o más: una fila por mes en la página de entrenos (la de semanas pasa al anexo). */
  porMes: FilaSemanaEntrenos[] | null
  subidasLista: SubidaInforme[]
  subidasMas: number
  esfuerzoPorEjercicio: EsfuerzoEjercicio[]
  /** Ejercicios sin ninguna serie con esfuerzo marcado. */
  sinMarcar: string[]
  evolucionEsfuerzo: { puntos: PuntoEsfuerzo[]; agrupado: 'sesion' | 'semana'; mostrar: boolean; objetivo: number | null; nota: string }
}

export type UnidadFuerza = 'kg' | 'asistido' | 'reps' | 's'

export type PuntoFuerza = { fecha: string; valor: number; record: boolean }

export type GraficaFuerza = {
  id: string
  nombre: string
  unidad: UnidadFuerza
  /** Asistidos: menos ayuda es mejor (el color de mejora va al revés). */
  menosEsMejor: boolean
  puntos: PuntoFuerza[]
  desde: number
  hasta: number
  cambio: number
  pct: number
  veces: number
  direccion: Direccion
  tono: TonoInforme
  /** «de 40 a 55 kg» */
  titulo: string
  /** «+15 kg (+38 %) · 12 veces» */
  pie: string
  /** Con un solo dato: «40 kg × 8». */
  unSolo: string | null
}

export type MejorSerie = { id: string; nombre: string; peso: number; reps: number; e1rm: number; fecha: string; rpe: number | null; esfuerzo: string; tono: TonoInforme; record: boolean; contraAnterior: number | null; contraTexto: string }

export type FuerzaInforme = {
  ejercicios: GraficaFuerza[]
  semanas: { lunes: string; etiqueta: string; kg: number; toneladas: number; enCurso: boolean }[]
  grupos: { n: string; v: number; zona: [number, number]; nivel: 'poco' | 'bien' | 'mucho'; tono: TonoInforme }[]
  mejores: MejorSerie[]
  /** «Contra el … anterior» con el periodo anterior a medias (los datos empiezan dentro de él): se avisa. */
  contraNota: string | null
  meses: MesInforme[] | null
}

export type DiaComidaInforme = { fecha: string; apuntado: boolean; kcal: number | null; proteina: number | null; cafeina: number | null; picoteo: boolean; tonoProteina: TonoInforme; kcalSemana: number | null }

export type ComidaFila = { hora: string; franja: Franja; franjaTexto: string; nombre: string; racion: string; picoteo: boolean; kcal: number; proteina: number; cafeina: number | null }

export type ComidaInforme = {
  diasApuntados: number
  diasPeriodo: number
  texto: string
  objetivoNota: string | null
  /** Medias de los días apuntados (la sección solo sale si hay alguno). */
  proteina: { media: number; objetivo: number; diasCumplidos: number; evaluacion: Evaluacion }
  kcal: { media: number; objetivo: number; franja: [number, number] }
  picoteo: { dias: number; anterior: number | null; texto: string }
  cafeina: { media: number; limite: number; diasPorEncima: number }
  dias: DiaComidaInforme[]
  porFranja: { franja: Franja; nombre: string; kcal: number; proteina: number }[]
  top: { nombre: string; veces: number }[]
  macros: { hidratos: number | null; azucares: number | null; grasas: number | null; sal: number | null; comidas: number; texto: string } | null
  consejo: { titulo: string; texto: string } | null
  suplementos: { nombre: string; dias: number }[]
  detalle: { fecha: string; filas: ComidaFila[]; total: { kcal: number; proteina: number; cafeina: number } }[] | null
}

export type PuntoCuerpo = { fecha: string; valor: number; fuente?: 'bascula' | 'medidas' }

export type SerieCuerpo = {
  puntos: PuntoCuerpo[]
  medias: PuntoFecha[]
  inicio: number | null
  ahora: number | null
  cambio: Cambio | null
  /** Último valor anterior al periodo (para «último peso: 79,1 kg (13 oct)»). */
  antes: PuntoFecha | null
  /** Fecha del valor de «Al empezar». */
  inicioFecha: string | null
  /** «Al empezar» es la última medida de antes del periodo (dentro solo hay una): se avisa. */
  inicioAntes: boolean
}

export type CuerpoInforme = {
  peso: SerieCuerpo
  grasa: SerieCuerpo
  cintura: SerieCuerpo
  tabla: { medicion: string; valor: string; rango: string; evaluacion: Evaluacion }[]
  nota: string | null
}

export type GastoDiaInforme = { fecha: string; reposo: number; pasos: number; entreno: number; total: number; formula: 'katch' | 'mifflin' }

export type PasosInforme = {
  dias: { fecha: string; pasos: number | null; troteKm: number; pasosTrote: number; cumple: boolean }[]
  /** Media de los días con dato (la sección solo sale si hay alguno). */
  media: number
  objetivo: number
  diasConDato: number
  diasCumplidos: number
  km: number
  troteKm: number
  diasTrote: number
  gasto: { reposo: number; pasos: number; entreno: number; total: number; dias: number } | null
  gastoDias: GastoDiaInforme[]
}

export type Comparacion = {
  valor: number | null
  normal: number | null
  diferencia: number | null
  pct: number | null
  direccion: Direccion | null
  juicio: Juicio | null
  tono: TonoInforme
  /** «–12 %», «–0,2 kg» */
  texto: string
  /** «lo normal: 131 g» */
  normalTexto: string
}

export type FilaHoyNormal = {
  id: string
  nombre: string
  unidad: UnidadFuerza
  /** «hoy 55 kg × 6» */
  hoyTexto: string
  hoy: number
  normal: number | null
  min: number | null
  max: number | null
  pct: number | null
  juicio: Juicio
  direccion: Direccion | null
  tono: TonoInforme
  /** «55 kg · lo normal: 50 kg · +10 %» */
  frase: string
  /** «más peso» o «más reps» con el mismo peso. */
  por: 'peso' | 'reps' | null
  record: boolean
  primera: boolean
  suave: boolean
  esfuerzo: { hoy: number | null; normal: number | null; deObjetivo: boolean; texto: string; tono: TonoInforme; normalTexto: string; costo: 'más' | 'menos' | null }
}

export type TuDiaInforme = {
  fecha: string
  palabra: 'hoy' | 'ayer'
  primerDia: boolean
  recuento: { mejor: number; peor: number; igual: number } | null
  frase: string
  entreno: { estado: 'hecho' | 'descanso' | 'no hecho'; nombre: string | null; minutos: number | null; normal: number | null; diferencia: number | null; texto: string; normalTexto: string }
  proteina: Comparacion
  pasos: Comparacion
  peso: Comparacion
  kcal: Comparacion
  cafeina: { valor: number | null; limite: number; tono: TonoInforme }
  ejercicios: FilaHoyNormal[]
  principal: { id: string; nombre: string; unidad: UnidadFuerza; titulo: string; puntos: PuntoFuerza[]; banda: { min: number; max: number; mediana: number } | null } | null
  gasto: (GastoDiaInforme & { comido: number | null; diferencia: number | null; texto: string | null; tono: TonoInforme }) | null
  comidas: ComidaFila[]
  total: { kcal: number; proteina: number; cafeina: number } | null
  tonoProteina: TonoInforme
  cuerpo: string | null
}

export type DetalleSerie = { n: number; peso: number | null; reps: number | null; segundos: number | null; rpe: number | null; calentamiento: boolean; hecha: boolean; record: boolean; nota: string | null }
export type DetalleEntreno = {
  fecha: string
  /** «mar 20 oct · Cuerpo completo A · 58 min» */
  titulo: string
  ejercicios: { id: string; nombre: string; saltado: boolean; enVezDe: string | null; motivo: string | null; series: DetalleSerie[] }[]
}

export type Informe = {
  periodo: PeriodoInforme
  rango: RangoInforme
  secciones: SeccionesInforme
  cabecera: CabeceraInforme
  /** Si no hay nada apuntado en esos días, el botón se queda gris. */
  hayDatos: boolean
  resumen: ResumenInforme
  semanas: SemanaInforme[]
  meses: MesInforme[] | null
  entrenos: EntrenosInforme | null
  fuerza: FuerzaInforme | null
  comida: ComidaInforme | null
  cuerpo: CuerpoInforme | null
  pasos: PasosInforme | null
  tuDia: TuDiaInforme | null
  detalleEntrenos: DetalleEntreno[] | null
}

/** Lo que el informe necesita del catálogo de ejercicios (RepDB), para no depender de él aquí. */
export type CatalogoInforme = { nombre: (id: string) => string; patron: (id: string) => string | undefined; met: (id: string) => number | null | undefined }

export type TablasInforme = {
  perfil: Perfil | null | undefined
  ajustes: Ajustes | null | undefined
  mediciones: Medicion[]
  sesiones: Sesion[]
  rutina: Rutina | null | undefined
  comidas: Comida[]
  suplementos: DiaSuplementos[]
  pasos: PasosDia[]
  metas: Meta[]
}

export type EntradaInforme = TablasInforme & { periodo: PeriodoInforme; ahora: Date; secciones?: Partial<SeccionesInforme>; catalogo?: CatalogoInforme }
