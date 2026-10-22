// Informe en PDF: todos los números y textos que salen en el informe, calculados a partir de las tablas y un periodo.
// Lógica pura (sin Dexie ni React): el dibujo del PDF solo pinta lo que hay aquí, sin hacer cuentas.
// Regla de oro: lo que no se sabe es null (nunca un 0 inventado). Diseño: docs/INFORME-PDF-DISENO.md (§5).
import type { Ajustes, Comida, DiaSuplementos, EjercicioSesion, Franja, Medicion, Meta, PasosDia, Perfil, Rutina, Serie, Sesion } from '../datos/tipos'
import { cinturaAltura, conUnidad, imc, kg, num, objetivos } from './calculos'
import { NOMBRE_RACION, datosQuincena, nombreFranja } from './comida'
import { basalDia, kcalPasos, kcalSesion, zancada } from './energia'
import { DIAS, DIAS_ABREV, DIAS_CORTOS, MESES, MESES_CORTOS, aISO, deISO, diaSemana, diasEntre, edad, fechaCorta, fechaLarga, formatoHora, horaActual, hoyISO, lunesDe, sumarDias } from './fechas'
import { mejorMarca, volumen } from './progresion'
import { PUNTOS_MAXIMOS, resumenSemana, type Resumen } from './resumen'
import { estadoSemana, racha, type EstadoDia, type Recolocada } from './semana'
import {
  cambioDesdeInicio, ejerciciosHechos, faltaMeta, grasaPorMedidas, hechasAsc, hitosDominadas, logros, mediasSemanales, nivelSeries,
  pendienteSemanal, pesoMaximo, progresoMeta, recordsEn, repsMaximas, seriesDe, seriesPorGrupo, serieMedida, subidas, ultimoValor,
  veredictoCinturaAltura, veredictoGrasa, veredictoImc, type Logro, type PuntoFecha, type Subida, type Tono,
} from './tendencias'
import { idioma, regionNumeros, t, tc, tk, tn } from '../i18n'
import { nombreEntreno } from './nombres'

// ================================================================ tipos

export type PeriodoInforme = 'hoy' | 'ayer' | 'semana' | 'mes' | 'todo'

/** Casillas de la hoja «Informe en PDF». El resumen (página 1) va siempre. */
export type SeccionesInforme = { entrenos: boolean; comida: boolean; cuerpo: boolean; pasos: boolean; detalle: boolean }

export const SECCIONES_POR_DEFECTO: SeccionesInforme = { entrenos: true, comida: true, cuerpo: true, pasos: true, detalle: false }
export const PERIODO_POR_DEFECTO: PeriodoInforme = 'mes'
export const ORDEN_PERIODOS: PeriodoInforme[] = ['hoy', 'ayer', 'semana', 'mes', 'todo']

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

/** Nombre que usa el diseño (§5). */
export type DatosInforme = Informe

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

// ================================================================ utilidades

const MENOS = '–'
const r1 = (v: number) => Math.round(v * 10) / 10
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const media = (xs: number[]) => (xs.length ? suma(xs) / xs.length : null)
const dia10 = (f: string) => f.slice(0, 10)
const entre = (f: string, a: string, b: string) => f >= a && f <= b
const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
const anio = (f: string) => deISO(f).getFullYear()
const trabajo = (s: Serie[]) => s.filter(x => x.hecha && !x.calentamiento)
const conRpe = (s: Serie[]) => trabajo(s).filter(x => x.rpe != null && Number.isFinite(x.rpe))
const unico = <T>(xs: T[]) => [...new Set(xs)]

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** «+1,5», «–0,7», «0» (con el menos tipográfico del PDF). */
export function conSigno(n: number, f: (v: number) => string = v => num(v)): string {
  const v = f(Math.abs(n))
  if (n === 0 || /^0([,.]0*)?$/.test(v)) return '0'
  return n > 0 ? `+${v}` : `${MENOS}${v}`
}

/** Número con un número fijo de decimales: «79,0», «–0,03». */
export function fijo(v: number, d = 1): string {
  const f = 10 ** d
  const r = Math.round(v * f) / f
  return (r === 0 ? 0 : r).toLocaleString(regionNumeros(), { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Formato común de una serie: si algún valor lleva decimal, todos lo llevan («79,0» junto a «80,1»). */
export function formatoSerie(vals: number[], d = 1): (v: number) => string {
  const f = 10 ** d
  const conDecimal = vals.some(v => Math.round(v * f) % f !== 0)
  return v => (conDecimal ? fijo(v, d) : num(v, 0))
}

/** «+10 %», «–8 %». */
export const textoPct = (p: number) => conUnidad(conSigno(p, v => String(Math.round(v))), '%')

/** Porcentaje de cambio redondeado: Math.round((hoy − normal) / normal × 100). */
export const pctCambio = (valor: number, normal: number): number | null => (normal ? Math.round(((valor - normal) / Math.abs(normal)) * 100) : null)

/** «a», «a y b», «a, b y c» */
export function lista(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  // Con tres o más, contexto «3+»: en inglés lleva coma antes de «and».
  const v = { a: xs.slice(0, -1).join(', '), b: xs[xs.length - 1]! }
  return xs.length > 2 ? tc('3+', '{a} y {b}', v) : t('{a} y {b}', v)
}

/** «1 h 8 min», «59 min», «1 h», «—». */
export function textoDuracion(min: number | null): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}

/** «mar 22 sep» */
export const fechaDia = (f: string) => `${DIAS_ABREV[diaSemana(deISO(f))]} ${fechaCorta(f)}`

/** «abril 2027» */
export const mesAnio = (f: string) => `${MESES[deISO(f).getMonth()]} ${anio(f)}`

/** «21-27 sep», «28 sep-4 oct» */
export function etiquetaSemana(desde: string, hasta: string): string {
  const a = deISO(desde), b = deISO(hasta)
  if (desde === hasta) return fechaCorta(desde)
  return a.getMonth() === b.getMonth() ? t('{desde}-{hasta} {mes}', { desde: a.getDate(), hasta: b.getDate(), mes: MESES_CORTOS[b.getMonth()]! }) : `${fechaCorta(desde)}-${fechaCorta(hasta)}`
}

/** Días seguidos desde `inicio` hasta `fin` (incluidos). */
export function diasDe(inicio: string, fin: string): string[] {
  const out: string[] = []
  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) out.push(f)
  return out
}

/** Minutos de un entreno: fin − inicio; si falta, lo que dijo al terminar; si no, null. */
export function minutosSesion(s: Sesion): number | null {
  if (s.fin != null && s.fin > s.inicio) return Math.round((s.fin - s.inicio) / 60_000)
  const m = s.respuestas?.minutosReales
  return m != null && m > 0 ? Math.round(m) : null
}

// ---------------------------------------------------------------- esfuerzo

const ZONAS_ESFUERZO: { palabra: PalabraEsfuerzo; tono: TonoInforme; rango: string }[] = [
  { palabra: tk('fácil'), tono: 'azul', rango: '6' },
  { palabra: tk('bien'), tono: 'ok', rango: '7-8' },
  { palabra: tk('duro'), tono: 'warn', rango: '9' },
  { palabra: tk('al límite'), tono: 'bad', rango: '10' },
]

/** Zona del esfuerzo redondeado a 1 decimal: hasta 6,4 fácil · 6,5-8,4 bien · 8,5-9,4 duro · desde 9,5 al límite. */
export function zonaEsfuerzo(v: number): number {
  const r = r1(v)
  return r < 6.5 ? 0 : r < 8.5 ? 1 : r < 9.5 ? 2 : 3
}

export function palabraEsfuerzo(v: number): { palabra: PalabraEsfuerzo; tono: TonoInforme; rango: string; texto: string } {
  const z = ZONAS_ESFUERZO[zonaEsfuerzo(v)]!
  return { palabra: z.palabra, tono: z.tono, rango: z.rango, texto: `${num(v)} ${t(z.palabra)}` }
}

/** «Qué dice» frente al objetivo: se compara la palabra, no los decimales. */
export function queDiceEsfuerzo(mediaV: number, objetivo: number): { texto: 'lo previsto' | 'más duro' | 'más fácil'; tono: TonoInforme } {
  const a = zonaEsfuerzo(mediaV), b = zonaEsfuerzo(objetivo)
  // El texto se traduce al pintarlo (t(queDice)).
  return a === b ? { texto: tk('lo previsto'), tono: 'ok' } : a > b ? { texto: tk('más duro'), tono: 'warn' } : { texto: tk('más fácil'), tono: 'azul' }
}

/** Media de las series de trabajo con esfuerzo marcado (las vacías no cuentan). */
export function mediaEsfuerzo(series: Serie[]): number | null {
  const v = media(conRpe(series).map(x => x.rpe!))
  return v == null ? null : r1(v)
}

/** Esfuerzo de un grupo de ejercicios (una sesión, un ejercicio o todo el periodo): cada serie pesa lo mismo. */
export function esfuerzoDe(ejs: EjercicioSesion[]): EsfuerzoInforme {
  const total = suma(ejs.map(e => trabajo(e.series).length))
  const valores = ejs.flatMap(e => conRpe(e.series).map(x => x.rpe!))
  const objetivosV = ejs.filter(e => conRpe(e.series).length).map(e => e.rpe)
  const m = media(valores)
  const obj = media(objetivosV)
  const marcadas = valores.length
  const pct = total ? Math.round((marcadas / total) * 100) : null
  const p = m == null ? null : palabraEsfuerzo(m)
  return {
    media: m == null ? null : r1(m),
    palabra: p?.palabra ?? null,
    tono: p?.tono ?? 'gris',
    texto: p?.texto ?? t('sin marcar'),
    marcadas, total, pct,
    pocas: total > 0 && marcadas / total < 0.3,
    objetivo: obj == null ? null : r1(obj),
  }
}

// ---------------------------------------------------------------- fuerza

/** Cómo se mide un ejercicio en las gráficas: kg, ayuda (asistidos, menos es mejor), repeticiones o segundos. */
export function unidadFuerza(sesiones: Sesion[], id: string): UnidadFuerza {
  const series = sesiones.flatMap(s => trabajo(seriesDe(s, id)))
  if (series.some(x => x.peso != null && x.peso > 0 && (x.reps ?? 0) > 0)) return 'kg'
  if (series.some(x => x.peso != null && x.peso < 0)) return 'asistido'
  if (series.some(x => (x.reps ?? 0) > 0)) return 'reps'
  return 's'
}

/** Valor de un día según la unidad: peso máximo, ayuda mínima (en positivo), reps máximas o segundos máximos. */
export function valorFuerza(series: Serie[], unidad: UnidadFuerza): number | null {
  if (unidad === 'kg') { const p = pesoMaximo(series); return p != null && p > 0 ? p : null }
  if (unidad === 'asistido') {
    const p = trabajo(series).filter(x => x.peso != null && x.peso < 0).map(x => x.peso!)
    return p.length ? -Math.max(...p) : null
  }
  if (unidad === 'reps') return repsMaximas(series)
  const s = trabajo(series).map(x => x.segundos ?? 0).filter(x => x > 0)
  return s.length ? Math.max(...s) : null
}

/** La serie más pesada (a igualdad, la de más reps). */
function serieTop(series: Serie[]): Serie {
  return trabajo(series).reduce((a, b) => ((b.peso ?? -Infinity) > (a.peso ?? -Infinity) || ((b.peso ?? -Infinity) === (a.peso ?? -Infinity) && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a))
}

/** «55 kg», «ayuda 15 kg», «12 reps», «40 s» */
export function textoFuerza(v: number, unidad: UnidadFuerza): string {
  if (unidad === 'kg') return `${kg(v)} kg`
  if (unidad === 'asistido') return t('ayuda {kg} kg', { kg: kg(v) })
  if (unidad === 'reps') return t('{n} reps', { n: num(v, 0) })
  return `${num(v, 0)} s`
}

/** «55 kg × 6», «12 reps», «40 s», «ayuda 15 kg × 6» */
function textoSerie(series: Serie[], unidad: UnidadFuerza): string {
  if (unidad === 'kg' || unidad === 'asistido') {
    const top = serieTop(series)
    return `${unidad === 'kg' ? `${kg(top.peso!)} kg` : t('ayuda {kg} kg', { kg: kg(-top.peso!) })} × ${top.reps}`
  }
  return textoFuerza(valorFuerza(series, unidad)!, unidad)
}

const unidadCorta = (u: UnidadFuerza) => (u === 'reps' ? tc('unidad', 'reps') : u === 's' ? 's' : 'kg')

/** Puntos de un ejercicio, sesión a sesión (de más antiguo a más reciente), con su unidad. */
export function serieFuerza(sesiones: Sesion[], id: string, unidad = unidadFuerza(sesiones, id)): { fecha: string; sesionId: number | null; valor: number; series: Serie[] }[] {
  const out: { fecha: string; sesionId: number | null; valor: number; series: Serie[] }[] = []
  for (const s of hechasAsc(sesiones)) {
    const series = seriesDe(s, id)
    const v = valorFuerza(series, unidad)
    if (v != null) out.push({ fecha: s.fecha, sesionId: s.id ?? null, valor: Math.round(v * 100) / 100, series })
  }
  return out
}

// ================================================================ periodo

// Se traducen al pintarlas (t(etiqueta)): esto se evalúa antes de cargar el idioma.
const PERIODOS: Record<PeriodoInforme, { etiqueta: string }> = {
  hoy: { etiqueta: tk('Hoy') },
  ayer: { etiqueta: tk('Ayer') },
  semana: { etiqueta: tk('Última semana') },
  mes: { etiqueta: tk('Último mes') },
  todo: { etiqueta: tk('Todo') },
}

export const etiquetaPeriodo = (p: PeriodoInforme) => t(PERIODOS[p].etiqueta)

/** El periodo en el nombre del archivo, sin acentos ni espacios: «ultimo-mes», «ultim-mes», «last-month». */
export function archivoPeriodo(p: PeriodoInforme): string {
  if (p === 'hoy') return tc('archivo', 'hoy')
  if (p === 'ayer') return tc('archivo', 'ayer')
  if (p === 'semana') return tc('archivo', 'ultima-semana')
  if (p === 'mes') return tc('archivo', 'ultimo-mes')
  return tc('archivo', 'todo')
}

/** El dato más antiguo de todo lo apuntado (sesiones hechas, mediciones, comidas y pasos). */
export function primerDato(t: Pick<TablasInforme, 'sesiones' | 'mediciones' | 'comidas' | 'pasos'>): string | null {
  const fechas = [
    ...t.sesiones.filter(s => s.estado === 'hecha').map(s => s.fecha),
    ...t.mediciones.map(m => dia10(m.fecha)),
    ...t.comidas.map(c => c.fecha),
    ...t.pasos.map(p => p.fecha),
  ]
  return fechas.length ? fechas.reduce((a, b) => (b < a ? b : a)) : null
}

/** Días exactos de cada periodo (§1): Hoy, Ayer, 7 días, 30 días o desde el primer dato. */
export function rangoInforme(periodo: PeriodoInforme, ahora: Date, primer: string | null = null): RangoInforme {
  const hoy = hoyISO(ahora)
  let inicio = hoy, fin = hoy
  if (periodo === 'ayer') inicio = fin = sumarDias(hoy, -1)
  else if (periodo === 'semana') inicio = sumarDias(hoy, -6)
  else if (periodo === 'mes') inicio = sumarDias(hoy, -29)
  else if (periodo === 'todo' && primer && primer < hoy) inicio = primer
  const unDia = periodo === 'hoy' || periodo === 'ayer'
  const mismoAnio = anio(inicio) === anio(fin)
  const desde = fechaCorta(inicio), hasta = fechaCorta(fin), aI = anio(inicio), aF = anio(fin)
  const texto = inicio === fin
    ? t('{dia} {fecha} {anio}', { dia: DIAS[diaSemana(deISO(fin))], fecha: hasta, anio: aF })
    : mismoAnio ? t('{desde} – {hasta} {anio}', { desde, hasta, anio: aF }) : t('{desde} {anioDesde} – {hasta} {anio}', { desde, anioDesde: aI, hasta, anio: aF })
  const etiqueta = etiquetaPeriodo(periodo)
  let textoHoja: string
  if (unDia) textoHoja = `${etiqueta}, ${fechaLarga(fin)}`
  else if (periodo === 'todo') textoHoja = primer ? t('Desde el {fecha} de {anio}, tu primer dato', { fecha: desde, anio: aI }) : t('Aún no hay nada apuntado')
  else textoHoja = mismoAnio ? t('Del {desde} al {hasta} de {anio}', { desde, hasta, anio: aF }) : t('Del {desde} de {anioDesde} al {hasta} de {anio}', { desde, anioDesde: aI, hasta, anio: aF })
  return {
    periodo, etiqueta, inicio, fin, dias: diasEntre(inicio, fin) + 1, hoy, unDia, texto, textoHoja,
    notaHoja: unDia ? t('Con un solo día, el informe compara lo de ese día con lo que sueles hacer.') : null,
    nombreArchivo: t('JowyFit-informe-{fecha}-{periodo}.pdf', { fecha: hoy, periodo: archivoPeriodo(periodo) }),
  }
}

/** ¿Hay algo apuntado en esos días? (si no, el botón «Crear el PDF» se queda gris). */
export function hayDatosEn(t: Pick<TablasInforme, 'sesiones' | 'mediciones' | 'comidas' | 'pasos'>, inicio: string, fin: string): boolean {
  return t.sesiones.some(s => s.estado === 'hecha' && entre(s.fecha, inicio, fin))
    || t.mediciones.some(m => entre(dia10(m.fecha), inicio, fin))
    || t.comidas.some(c => entre(c.fecha, inicio, fin))
    || t.pasos.some(p => entre(p.fecha, inicio, fin))
}

// ================================================================ contexto

type PerfilInforme = Pick<Perfil, 'nombre' | 'nacimiento' | 'sexo' | 'alturaCm' | 'objetivo' | 'pasosObjetivo' | 'diasFijos' | 'trabajo'>
const PERFIL_VACIO: PerfilInforme = { nombre: '', nacimiento: '', sexo: 'hombre', alturaCm: 0, objetivo: 'recomposicion', pasosObjetivo: 10_000, diasFijos: [], trabajo: 'sentado' }

const CATALOGO_VACIO: CatalogoInforme = { nombre: id => id, patron: () => undefined, met: () => undefined }

type Ctx = {
  r: RangoInforme
  hoy: string
  inicio: string
  fin: string
  p: PerfilInforme
  hayPerfil: boolean
  ajustes: Ajustes | null | undefined
  ms: Medicion[]
  marina: PuntoFecha[]
  todas: Sesion[]
  /** Sesiones hechas hasta el fin del periodo, de la más antigua a la más reciente. */
  hechas: Sesion[]
  enPeriodo: Sesion[]
  rutina: Rutina | null | undefined
  recolocadas: Recolocada[]
  fijos: number
  comidas: Comida[]
  pasos: PasosDia[]
  suplementos: DiaSuplementos[]
  metas: Meta[]
  cat: CatalogoInforme
  obj: { kcal: number; proteina: number }
  logros: Logro[]
  subidas: Subida[]
  dias: string[]
}

/** Edad en una fecha; null si no hay fecha de nacimiento. */
export function edadEn(nacimiento: string, fecha: string): number | null {
  return /^\d{4}-\d{2}-\d{2}/.test(nacimiento) ? edad(nacimiento, deISO(fecha)) : null
}

/** Objetivo de kcal y proteína como `objetivosEnergia`, pero con el peso de la fecha del informe. */
export function objetivosInforme(p: PerfilInforme, a: Ajustes | null | undefined, peso: number | null, fecha: string): { kcal: number; proteina: number } {
  const o = objetivos({ pesoKg: peso ?? 75, alturaCm: p.alturaCm, edad: edadEn(p.nacimiento, fecha) ?? 30, sexo: p.sexo, trabajo: p.trabajo, objetivo: p.objetivo, entrenosSemana: p.diasFijos.length })
  return { kcal: a?.kcalManual ?? o.kcal, proteina: a?.proteinaManual ?? o.proteina }
}

const leerPeso = (m: Medicion) => m.pesoKg
const leerCintura = (m: Medicion) => m.perimetros?.cintura
const leerGrasaBascula = (m: Medicion) => m.bascula?.grasaPct

/** % de grasa en una fecha como la app: el de la báscula de los 4 meses anteriores o, si no, el de la cinta. */
function grasaEn(c: Pick<Ctx, 'ms' | 'marina'>, fecha: string): (PuntoFecha & { fuente: 'bascula' | 'medidas' }) | null {
  const b = ultimoValor(c.ms, leerGrasaBascula, fecha)
  if (b && b.fecha >= sumarDias(fecha, -120)) return { ...b, fuente: 'bascula' }
  const m = c.marina.filter(x => x.fecha <= fecha).at(-1)
  return m ? { ...m, fuente: 'medidas' } : null
}

function contexto(e: EntradaInforme, r: RangoInforme): Ctx {
  const p: PerfilInforme = { ...PERFIL_VACIO, ...(e.perfil ?? {}) }
  const ms = [...e.mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const hechas = hechasAsc(e.sesiones).filter(s => s.fecha <= r.fin)
  const enPeriodo = hechas.filter(s => s.fecha >= r.inicio)
  const peso = ultimoValor(ms, leerPeso, r.fin)?.valor ?? null
  const enRango = (f: string) => entre(f, r.inicio, r.fin)
  return {
    r, hoy: r.hoy, inicio: r.inicio, fin: r.fin, p, hayPerfil: !!e.perfil, ajustes: e.ajustes,
    ms, marina: grasaPorMedidas(ms, p.sexo, p.alturaCm),
    todas: e.sesiones, hechas, enPeriodo,
    rutina: e.rutina, recolocadas: e.ajustes?.recolocadas ?? [],
    fijos: e.rutina ? e.rutina.dias.filter(d => !d.opcional).length : p.diasFijos.length,
    comidas: e.comidas, pasos: e.pasos, suplementos: e.suplementos, metas: e.metas,
    cat: e.catalogo ?? CATALOGO_VACIO,
    obj: objetivosInforme(p, e.ajustes, peso, r.fin),
    logros: logros(hechas).filter(l => enRango(l.fecha)),
    subidas: subidas(hechas).filter(s => enRango(s.fecha)),
    dias: diasDe(r.inicio, r.fin),
  }
}

/** Estado de cada día (hecho, perdido, movido, descanso…) entre dos fechas, también de semanas pasadas. */
function estadosDias(c: Ctx, desde: string, hasta: string): EstadoDia[] {
  const out: EstadoDia[] = []
  for (let l = lunesDe(desde); l <= hasta; l = sumarDias(l, 7)) {
    const dom = sumarDias(l, 6)
    for (const d of estadoSemana(c.rutina, c.todas, dom < c.hoy ? dom : c.hoy, c.recolocadas)) {
      if (!entre(d.fecha, desde, hasta)) continue
      let x: EstadoDia = d
      // El domingo de una semana pasada sale como «plan» (es el «hoy» de la llamada): ya pasó.
      if (d.estado === 'plan' && d.fecha < c.hoy) {
        // Hay plan, luego hay rutina.
        x = d.fecha < aISO(new Date(c.rutina!.creada)) ? { fecha: d.fecha, estado: 'descanso', hoy: false } : { ...d, estado: c.recolocadas.some(y => y.desde === d.fecha) ? 'movido' : 'perdido' }
      }
      out.push({ ...x, hoy: x.fecha === c.hoy })
    }
  }
  return out
}

/** Entrenos de unos días: hechos en días distintos, los que tocaban (hechos en día fijo + perdidos) y los extra. */
function cuentaEntrenos(c: Ctx, desde: string, hasta: string) {
  const estados = estadosDias(c, desde, hasta)
  const dias = new Set(c.hechas.filter(s => entre(s.fecha, desde, hasta)).map(s => s.fecha))
  const enFijos = estados.filter(e => e.estado === 'hecho' && e.dia && !e.dia.opcional).length
  const perdidos = estados.filter(e => e.estado === 'perdido')
  return { estados, hechos: dias.size, enFijos, perdidos, movidos: estados.filter(e => e.estado === 'movido').length, tocaban: enFijos + perdidos.length, extra: Math.max(0, dias.size - enFijos) }
}

/** Nombres propios del catálogo que van siempre con mayúscula (Press Arnold, Máquina Smith…). */
const PROPIOS = new Set(['Arnold', 'Pallof', 'Pendlay', 'Zercher', 'Zottman', 'Scott', 'Smith', 'Jefferson', 'Svend', 'Spoto', 'Pilates', 'Landmine'])

/**
 * Nombre de ejercicio como en la maqueta: solo la primera letra en mayúscula («Press de Banca con Barra» → «Press de banca con barra»).
 * Se respetan las siglas (TRX, EZ), las letras sueltas (Z, T) y los nombres propios.
 */
export function nombreNormal(t: string): string {
  return t.split(' ').map((p, i) => {
    if (i === 0 || p.length <= 1 || PROPIOS.has(p) || /\d/.test(p) || (p.match(/\p{Lu}/gu)?.length ?? 0) >= 2) return p
    return p.toLowerCase()
  }).join(' ')
}

/** Nombre dentro de una frase: «press de banca con barra» (las siglas y los nombres propios se quedan). */
export const nombreEnFrase = (t: string) => {
  const [p, ...resto] = nombreNormal(t).split(' ')
  const primera = !p || p.length <= 1 || PROPIOS.has(p) || (p.match(/\p{Lu}/gu)?.length ?? 0) >= 2 ? p ?? '' : p.charAt(0).toLowerCase() + p.slice(1)
  return [primera, ...resto].join(' ')
}

const nombreDe = (c: Ctx, id: string) => nombreNormal(c.cat.nombre(id))

// ================================================================ semanas y meses

/** Puntuación de 0 a 100 a partir de los puntos de `resumenSemana`. */
export const puntuacionDe = (puntos: number) => Math.round((puntos / PUNTOS_MAXIMOS) * 100)

/** Palabra y color de una puntuación: desde 78 «Vas bien», desde 44 «Casi», debajo flojo. */
export function palabraPuntuacion(v: number, varias: boolean): { palabra: string; tono: TonoInforme } {
  if (v >= 78) return { palabra: t('Vas bien'), tono: 'ok' }
  if (v >= 44) return { palabra: t('Casi'), tono: 'warn' }
  return { palabra: varias ? t('Periodo flojo') : t('Semana floja'), tono: 'bad' }
}

const TONO_SEMAFORO: Record<Resumen['semaforo'], TonoInforme> = { verde: 'ok', ambar: 'warn', rojo: 'bad' }

function resumenDe(c: Ctx, lunes: string, enCurso: boolean): Resumen {
  const dom = sumarDias(lunes, 6)
  const dias = diasDe(lunes, dom)
  const diasFijos = c.rutina ? c.rutina.dias.filter(d => !d.opcional && d.dia != null).map(d => d.dia!) : c.p.diasFijos
  return resumenSemana({
    hoy: enCurso ? c.hoy : dom,
    sesiones: c.todas, fijos: c.fijos, mediciones: c.ms.filter(m => dia10(m.fecha) <= dom), comidas: c.comidas, pasos: c.pasos,
    objetivoProteina: c.obj.proteina, objetivoPasos: c.p.pasosObjetivo,
    recordsSemana: recordsEn(c.todas, dias),
    subidasSemana: new Set(c.subidas.filter(s => dias.includes(s.fecha)).map(s => s.ejercicio)).size,
    esperados: enCurso ? diasFijos.filter(d => d <= diaSemana(deISO(c.hoy))).length : undefined,
  })
}

function semanasInforme(c: Ctx): SemanaInforme[] {
  const out: SemanaInforme[] = []
  for (let l = lunesDe(c.inicio); l <= c.fin; l = sumarDias(l, 7)) {
    const dom = sumarDias(l, 6)
    const desde = l < c.inicio ? c.inicio : l, hasta = dom > c.fin ? c.fin : dom
    const enCurso = dom >= c.hoy
    const ses = c.enPeriodo.filter(s => entre(s.fecha, desde, hasta))
    const ejs = ses.flatMap(s => s.ejercicios)
    const kgV = Math.round(suma(ejs.map(e => volumen(e.series))))
    const vacia = !hayDatosEn({ sesiones: c.todas, mediciones: c.ms, comidas: c.comidas, pasos: c.pasos }, l, dom)
    const rs = vacia ? null : resumenDe(c, l, enCurso)
    const punt = rs ? puntuacionDe(rs.puntos) : null
    const hechosSem = new Set(ses.map(s => s.fecha)).size
    const circulos = enCurso ? Array.from({ length: hechosSem }, () => true) : Array.from({ length: Math.max(c.fijos, hechosSem) }, (_, i) => i < hechosSem)
    const comidasSem = c.comidas.filter(x => entre(x.fecha, desde, hasta))
    const porDia = (f: (x: Comida) => number) => [...agrupar(comidasSem, x => x.fecha).values()].map(xs => suma(xs.map(f)))
    const pasosSem = c.pasos.filter(x => entre(x.fecha, desde, hasta))
    const medida = (f: (m: Medicion) => number | undefined) => {
      const v = media(c.ms.filter(m => entre(dia10(m.fecha), desde, hasta)).map(f).filter((x): x is number => x != null))
      return v == null ? null : r1(v)
    }
    const prot = media(porDia(x => x.proteina)), kcal = media(porDia(x => x.kcal)), pas = media(pasosSem.map(x => x.pasos))
    out.push({
      lunes: l, domingo: dom, desde, hasta, etiqueta: etiquetaSemana(desde, hasta), enCurso,
      completa: !enCurso && l >= c.inicio,
      puntos: rs?.puntos ?? null, puntuacion: punt, tono: punt == null ? 'gris' : palabraPuntuacion(punt, false).tono,
      palabra: rs ? t(rs.titulo) : null, tonoPalabra: rs ? TONO_SEMAFORO[rs.semaforo] : 'gris',
      entrenos: { hechos: hechosSem, fijos: c.fijos, circulos },
      kg: kgV, toneladas: r1(kgV / 1000), series: suma(ejs.map(e => trabajo(e.series).length)),
      esfuerzo: esfuerzoDe(ejs).media,
      proteina: prot == null ? null : Math.round(prot), kcal: kcal == null ? null : Math.round(kcal), pasos: pas == null ? null : Math.round(pas),
      peso: medida(leerPeso), cintura: medida(leerCintura),
    })
  }
  return out
}

/** Media de las semanas completas con algo apuntado; si no hay ninguna, la semana en curso; si está vacía, nada. */
function puntuacionInforme(semanas: SemanaInforme[]): PuntuacionInforme | null {
  const completas = semanas.filter(s => s.completa && s.puntuacion != null)
  if (completas.length) {
    const valor = Math.round(suma(completas.map(s => s.puntuacion!)) / completas.length)
    const pal = completas.length === 1 ? { palabra: completas[0]!.palabra!, tono: completas[0]!.tonoPalabra } : palabraPuntuacion(valor, true)
    return {
      valor, ...pal, semanas: completas.length, enCurso: false,
      nota: completas.length === 1 ? t('* La semana completa del periodo. La semana en curso no cuenta hasta el domingo.') : t('* Media de las {n} semanas completas. La semana en curso no cuenta hasta el domingo.', { n: completas.length }),
    }
  }
  // El periodo acaba hoy: la semana en curso siempre está; puede no tener nada apuntado.
  const curso = semanas.find(s => s.enCurso)!
  if (curso.puntuacion == null) return null
  return { valor: curso.puntuacion, palabra: curso.palabra!, tono: curso.tonoPalabra, semanas: 0, enCurso: true, nota: t('* La semana en curso, con los entrenos que ya tocaban hasta hoy.') }
}

function agrupar<T>(xs: T[], clave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = clave(x)
    const l = m.get(k)
    if (l) l.push(x)
    else m.set(k, [x])
  }
  return m
}

function mesesInforme(c: Ctx): MesInforme[] {
  const out: MesInforme[] = []
  let f = `${c.inicio.slice(0, 7)}-01`
  while (f <= c.fin) {
    const d = deISO(f)
    const sig = aISO(new Date(d.getFullYear(), d.getMonth() + 1, 1))
    const desde = f < c.inicio ? c.inicio : f
    const hasta = sumarDias(sig, -1) > c.fin ? c.fin : sumarDias(sig, -1)
    const ses = c.enPeriodo.filter(s => entre(s.fecha, desde, hasta))
    const ejs = ses.flatMap(s => s.ejercicios)
    const cuenta = cuentaEntrenos(c, desde, hasta)
    const medida = (g: (m: Medicion) => number | undefined) => {
      const v = media(c.ms.filter(m => entre(dia10(m.fecha), desde, hasta)).map(g).filter((x): x is number => x != null))
      return v == null ? null : r1(v)
    }
    out.push({
      mes: f.slice(0, 7), etiqueta: MESES_CORTOS[d.getMonth()]!, anio: d.getFullYear(), enCurso: entre(c.hoy, f, sumarDias(sig, -1)),
      entrenos: cuenta.hechos, tocaban: cuenta.tocaban, kg: Math.round(suma(ejs.map(e => volumen(e.series)))),
      esfuerzo: esfuerzoDe(ejs).media, peso: medida(leerPeso), cintura: medida(leerCintura),
    })
    f = sig
  }
  return out
}

// ================================================================ cuerpo

const ZONAS_IMC = { cortes: [18.5, 25] as [number, number], escala: [10, 40] as [number, number], marcas: [10, 15, 18.5, 25, 30, 35, 40] }
const ZONAS_CA = { cortes: [0.4, 0.5] as [number, number], escala: [0.3, 0.8] as [number, number], marcas: [0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8] }
const zonasGrasa = (sexo: Perfil['sexo']) => sexo === 'mujer'
  ? { cortes: [14, 32] as [number, number], escala: [0, 50] as [number, number], marcas: [0, 14, 20, 25, 32, 40, 50] }
  : { cortes: [6, 25] as [number, number], escala: [0, 45] as [number, number], marcas: [0, 6, 10, 15, 20, 25, 35, 45] }
const zonaDe = (v: number, [a, b]: [number, number]) => (v < a ? 'bajo' : v < b ? 'estandar' : 'alto') as ZonaCuerpo['zona']

/** Cambio de una medida del cuerpo con su color según el objetivo (§5.4). */
export function evaluarCuerpo(delta: number, objetivo: Perfil['objetivo'], campo: 'peso' | 'grasa' | 'cintura'): Evaluacion {
  const d = r1(delta)
  // Cambios de menos de 0,2 (kg, puntos o cm) son el ruido de la báscula o de la cinta: «Estable» (como en «Tu día», §5.7).
  if (campo === 'peso' && objetivo === 'fuerza') return { texto: d >= 0.2 ? t('Sube') : d <= -0.2 ? t('Baja') : t('Estable'), tono: 'gris' }
  if (d <= -0.2) return { texto: t('Baja: bien'), tono: 'ok' }
  if (d > 0.3) return { texto: t('Sube: ojo'), tono: 'warn' }
  return { texto: t('Estable'), tono: 'gris' }
}

function cambioDe(delta: number, tono: TonoInforme, f: (v: number) => string = v => num(v)): Cambio {
  const d = Math.round(delta * 100) / 100
  return { valor: d, texto: conSigno(delta, f), direccion: d > 0 ? 'sube' : d < 0 ? 'baja' : 'igual', tono }
}

function serieCuerpo(c: Ctx, puntos: PuntoCuerpo[], leer: (m: Medicion) => number | undefined, campo: 'peso' | 'grasa' | 'cintura'): SerieCuerpo {
  const enP = puntos.filter(x => entre(x.fecha, c.inicio, c.fin))
  const antes = campo === 'grasa' ? (grasaEn(c, sumarDias(c.inicio, -1)) ?? null) : ultimoValor(c.ms, leer, sumarDias(c.inicio, -1))
  const camb = cambioDesdeInicio(enP)
  // Con un solo dato en el periodo, «al empezar» es el último de antes (si lo hay), y se avisa de que es de antes.
  const conAntes = enP.length === 1 && !!antes
  const ini = enP.length >= 2 ? camb!.inicio : conAntes ? antes!.valor : null
  const ahora = camb?.ahora ?? null
  const delta = ini != null && ahora != null ? ahora - ini : null
  return {
    puntos: enP,
    medias: campo === 'grasa' ? [] : mediasSemanales(c.ms.filter(m => entre(dia10(m.fecha), c.inicio, c.fin)), leer).map(x => ({ fecha: x.fecha, valor: Math.round(x.valor * 100) / 100 })),
    inicio: ini, ahora,
    cambio: delta == null ? null : cambioDe(delta, evaluarCuerpo(delta, c.p.objetivo, campo).tono),
    antes: antes ? { fecha: antes.fecha, valor: antes.valor } : null,
    inicioFecha: enP.length >= 2 ? enP[0]!.fecha : conAntes ? antes!.fecha : null,
    inicioAntes: conAntes,
  }
}

/** % de grasa día a día: el de la báscula y, los días sin ella, el de la cinta (método de la Marina). */
function puntosGrasa(c: Ctx): PuntoCuerpo[] {
  const bascula = serieMedida(c.ms, leerGrasaBascula)
  const dias = new Set(bascula.map(x => x.fecha))
  return [
    ...bascula.map(x => ({ ...x, fuente: 'bascula' as const })),
    ...c.marina.filter(x => !dias.has(x.fecha)).map(x => ({ ...x, fuente: 'medidas' as const })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function cuerpoInforme(c: Ctx): CuerpoInforme {
  const peso = serieCuerpo(c, serieMedida(c.ms, leerPeso), leerPeso, 'peso')
  const grasa = serieCuerpo(c, puntosGrasa(c), leerGrasaBascula, 'grasa')
  const cintura = serieCuerpo(c, serieMedida(c.ms, leerCintura), leerCintura, 'cintura')
  const h = c.p.alturaCm > 0 ? c.p.alturaCm : null
  const pAhora = ultimoValor(c.ms, leerPeso, c.fin)?.valor ?? null
  const gAhora = grasaEn(c, c.fin)
  const cAhora = ultimoValor(c.ms, leerCintura, c.fin)?.valor ?? null
  const tabla: CuerpoInforme['tabla'] = []
  // Las palabras de los veredictos son de Progreso (tendencias.ts): t() las deja igual si ya vienen traducidas.
  const ev = (v: { palabra: string; tono: Tono }): Evaluacion => ({ texto: t(v.palabra), tono: v.tono })
  if (pAhora != null) tabla.push({ medicion: t('Peso'), valor: `${fijo(pAhora)} kg`, rango: h ? `${num(18.5 * (h / 100) ** 2)}–${num(25 * (h / 100) ** 2)} kg` : '—', evaluacion: h ? ev(veredictoImc(imc(pAhora, h))) : { texto: '—', tono: 'gris' } })
  if (gAhora) {
    const z = zonasGrasa(c.p.sexo).cortes
    tabla.push({ medicion: gAhora.fuente === 'medidas' ? t('Grasa corporal (por medidas)') : t('Grasa corporal'), valor: conUnidad(fijo(gAhora.valor), '%'), rango: `${z[0]}–${z[1]} %`, evaluacion: ev(veredictoGrasa(gAhora.valor, c.p.sexo)) })
  }
  if (cAhora != null) {
    tabla.push({ medicion: t('Cintura'), valor: `${num(cAhora)} cm`, rango: h ? t('hasta {n} cm', { n: num(h * 0.5) }) : '—', evaluacion: h ? ev(veredictoCinturaAltura(cinturaAltura(cAhora, h))) : { texto: '—', tono: 'gris' } })
    if (h) tabla.push({ medicion: t('Cintura / altura'), valor: num(cinturaAltura(cAhora, h), 2), rango: `${fijo(0.4, 2)}–${fijo(0.5, 2)}`, evaluacion: ev(veredictoCinturaAltura(cinturaAltura(cAhora, h))) })
  }
  if (pAhora != null && h) {
    tabla.push({ medicion: t('IMC'), valor: fijo(imc(pAhora, h)), rango: `${num(18.5)}–25`, evaluacion: ev(veredictoImc(imc(pAhora, h))) })
    // El mismo gasto en reposo que «Otros indicadores» (el de la báscula); sin báscula, el calculado y se dice.
    const bas = basalBascula(c)
    const e = edadEn(c.p.nacimiento, c.fin)
    if (bas != null) tabla.push({ medicion: t('Gasto en reposo'), valor: `${num(bas, 0)} kcal`, rango: '—', evaluacion: { texto: '—', tono: 'gris' } })
    else if (e != null) tabla.push({ medicion: t('Gasto en reposo (calculado)'), valor: `${basalDia({ pesoKg: pAhora, alturaCm: h, edad: e, sexo: c.p.sexo, grasaPct: gAhora?.valor }).kcal} kcal`, rango: '—', evaluacion: { texto: '—', tono: 'gris' } })
  }
  return { peso, grasa, cintura, tabla, nota: h ? null : t('Falta tu altura en Perfil') }
}

/**
 * En la barra de zonas, la palabra corta de cintura/altura (la larga no cabe), con los mismos tramos que
 * veredictoCinturaAltura (tendencias.ts). Sale del número y no de la palabra larga, que puede venir ya traducida.
 */
function palabraCortaCintura(ratio: number): string {
  if (ratio < 0.4) return t('por debajo')
  if (ratio < 0.5) return t('saludable')
  if (ratio < 0.55) return t('un poco por encima')
  if (ratio < 0.6) return t('por encima')
  return t('bastante por encima')
}

function zonasInforme(c: Ctx): { zonas: ZonaCuerpo[]; subtitulo: string | null } {
  const zonas: ZonaCuerpo[] = []
  const h = c.p.alturaCm > 0 ? c.p.alturaCm : null
  const p = ultimoValor(c.ms, leerPeso, c.fin)
  const g = grasaEn(c, c.fin)
  const cin = ultimoValor(c.ms, leerCintura, c.fin)
  const tonoV = (t: Tono): TonoInforme => t
  if (p && h) {
    const v = r1(imc(p.valor, h)), w = veredictoImc(v)
    zonas.push({ nombre: t('IMC (kg/m²)'), valor: v, texto: num(v), palabra: t(w.palabra), tono: tonoV(w.tono), zona: zonaDe(v, ZONAS_IMC.cortes), ...ZONAS_IMC })
  }
  if (g) {
    const z = zonasGrasa(c.p.sexo), w = veredictoGrasa(g.valor, c.p.sexo)
    zonas.push({ nombre: g.fuente === 'medidas' ? t('Grasa corporal (%) (por medidas)') : t('Grasa corporal (%)'), valor: g.valor, texto: num(g.valor), palabra: t(w.palabra), tono: tonoV(w.tono), zona: zonaDe(g.valor, z.cortes), ...z, fuente: g.fuente })
  }
  if (cin && h) {
    const v = Math.round(cinturaAltura(cin.valor, h) * 100) / 100, w = veredictoCinturaAltura(v)
    // En la barra de zonas, la palabra corta («por encima»), como en la maqueta: la larga no cabe.
    zonas.push({ nombre: t('Cintura / altura'), valor: v, texto: num(v, 2), palabra: palabraCortaCintura(v), tono: tonoV(w.tono), zona: zonaDe(v, ZONAS_CA.cortes), ...ZONAS_CA })
  }
  const bas = ultimoValor(c.ms, leerGrasaBascula, c.fin)
  const partes = [bas && g?.fuente === 'bascula' ? t('báscula del {fecha}', { fecha: fechaCorta(bas.fecha) }) : p ? t('peso del {fecha}', { fecha: fechaCorta(p.fecha) }) : null, cin ? t('cinta del {fecha}', { fecha: fechaCorta(cin.fecha) }) : null].filter((x): x is string => !!x)
  return { zonas, subtitulo: partes.length ? partes.join(' · ') : null }
}

function controlPeso(c: Ctx): ControlPeso | null {
  const p = ultimoValor(c.ms, leerPeso, c.fin)
  if (!p) return null
  const g = grasaEn(c, c.fin)
  const metaG = c.metas.find(m => m.tipo === 'grasa' && !m.hecha)
  const meta = metaG?.objetivo ?? (c.p.sexo === 'mujer' ? 25 : 18)
  let pesoConMeta: number | null = null, sobra: number | null = null
  if (g) {
    const magra = p.valor * (1 - g.valor / 100)
    pesoConMeta = r1(magra / (1 - meta / 100))
    sobra = r1(Math.max(0, p.valor - magra / (1 - meta / 100)))
  }
  const enP = c.ms.filter(m => entre(dia10(m.fecha), c.inicio, c.fin))
  const pend = pendienteSemanal(mediasSemanales(enP, leerPeso))
  // Con 2 decimales: un ritmo de –0,03 kg/sem no es «0»; por debajo de 0,005, «estable».
  const ritmo = pend == null ? null : Math.round(pend * 100) / 100
  // Masa grasa (kg) de cada pesada con báscula: si baja, cuándo se llegaría a la meta.
  const masa = mediasSemanales(enP, m => (m.pesoKg != null && m.bascula?.grasaPct != null ? m.pesoKg * m.bascula.grasaPct / 100 : undefined))
  const pendG = masa.length >= 3 ? pendienteSemanal(masa) : null
  // Si queda a más de 2 años, no es una previsión creíble: no sale (como cuando el peso no baja).
  const semanasMeta = sobra != null && sobra > 0 && pendG != null && pendG < 0 && ritmo !== 0 ? sobra / -pendG : null
  const fechaMeta = semanasMeta != null && semanasMeta <= 104 ? mesAnio(sumarDias(c.fin, Math.round(semanasMeta * 7))) : null
  const filas = [{ nombre: t('Peso ahora'), valor: `${fijo(p.valor)} kg` }]
  if (pesoConMeta != null) filas.push({ nombre: metaG ? t('Peso con tu meta de grasa ({n} %)', { n: num(meta) }) : t('Peso con un {n} % de grasa', { n: num(meta) }), valor: `${fijo(pesoConMeta)} kg` })
  if (sobra != null) filas.push({ nombre: t('Grasa que sobra para la meta'), valor: sobra > 0 ? `${MENOS}${fijo(sobra)} kg` : t('ya estás') })
  if (ritmo != null) filas.push({ nombre: c.r.periodo === 'mes' ? t('Ritmo del mes') : t('Ritmo'), valor: ritmo === 0 ? t('estable') : t('{n} kg/sem', { n: conSigno(ritmo, v => (v < 0.1 ? fijo(v, 2) : fijo(v))) }) })
  if (fechaMeta) filas.push({ nombre: t('A este ritmo, meta de grasa'), valor: fechaMeta })
  return { peso: p.valor, pesoFecha: p.fecha, grasa: g?.valor ?? null, grasaFuente: g?.fuente ?? null, meta, metaPropia: !!metaG, pesoConMeta, sobra, ritmo, fechaMeta, filas }
}

/**
 * Título de la meta en el idioma del informe: el guardado se escribió en el idioma de aquel momento.
 * Las libres van tal cual las escribió la persona.
 */
function tituloMeta(c: Ctx, m: Meta, val: (v: number, u: string) => string): string {
  switch (m.tipo) {
    case 'cintura': return t('Cintura por debajo de {valor}', { valor: val(m.objetivo, m.unidad || 'cm') })
    case 'peso': return t('Peso: {n} {unidad}', { n: kg(m.objetivo), unidad: m.unidad || 'kg' })
    case 'grasa': return t('Grasa al {valor}', { valor: conUnidad(num(m.objetivo), '%') })
    case 'dominadas': return t('{n} dominadas estrictas', { n: m.objetivo })
    case 'ejercicio': return m.ejercicio ? t('{nombre}: {valor}', { nombre: nombreDe(c, m.ejercicio), valor: val(m.objetivo, m.unidad || 'kg') }) : m.titulo
    default: return m.titulo
  }
}

function metasInforme(c: Ctx): MetaInforme[] {
  const ses = c.hechas
  return c.metas.map(m => {
    let actual: number | null = null
    let hito: string | null = null
    if (m.tipo === 'cintura') actual = ultimoValor(c.ms, leerCintura, c.fin)?.valor ?? null
    else if (m.tipo === 'peso') actual = ultimoValor(c.ms, leerPeso, c.fin)?.valor ?? null
    else if (m.tipo === 'grasa') actual = grasaEn(c, c.fin)?.valor ?? null
    else if (m.tipo === 'dominadas') {
      const d = hitosDominadas(ses)
      actual = d.estrictas
      // El primer hito es el de las asistidas y el segundo, el de las negativas (por su sitio: el título puede ir traducido).
      const act = d.hitos.findIndex(x => x.estado === 'actual')
      hito = d.hay && act >= 0 && d.estrictas === 0 ? (act === 0 ? t('vas por las asistidas') : act === 1 ? t('vas por las negativas') : null) : null
    } else if (m.tipo === 'ejercicio' && m.ejercicio) {
      const p = ses.map(s => pesoMaximo(seriesDe(s, m.ejercicio!))).filter((v): v is number => v != null)
      actual = p.length ? Math.max(...p) : null
    }
    const libre = m.tipo === 'libre'
    const falta = libre ? null : faltaMeta(m.inicio, actual, m.objetivo)
    const conseguida = !!m.hecha || falta === 0
    const unidadFalta = m.tipo === 'grasa' ? t('puntos') : m.unidad
    const val = (v: number, u: string) => conUnidad(u === 'kg' ? kg(v) : num(v), u)
    return {
      titulo: tituloMeta(c, m, val), tipo: m.tipo, unidad: m.unidad, objetivo: m.objetivo, actual,
      actualTexto: actual != null ? val(actual, m.unidad) : libre ? (m.hecha ? t('Hecha') : t('Pendiente')) : '—',
      progreso: libre ? (m.hecha ? 1 : 0) : conseguida ? 1 : progresoMeta(m.inicio, actual, m.objetivo),
      falta,
      faltaTexto: conseguida ? t('¡Conseguida!') : hito ?? (falta != null ? t('faltan {n}', { n: val(falta, unidadFalta) }) : ''),
      conseguida, fecha: m.fecha ?? null, mes: m.fecha ? mesAnio(m.fecha) : null,
    }
  })
}

const INDICADORES: { k: keyof NonNullable<Medicion['bascula']>; nombre: string; u: string }[] = [
  { k: 'basalKcal', nombre: tk('Gasto en reposo'), u: 'kcal' },
  { k: 'masaGrasaKg', nombre: tk('Masa grasa'), u: 'kg' },
  { k: 'masaLibreKg', nombre: tk('Masa magra'), u: 'kg' },
  { k: 'musculoKg', nombre: tk('Músculo'), u: 'kg' },
  { k: 'musculoEsqKg', nombre: tk('Músculo esquelético'), u: 'kg' },
  { k: 'aguaPct', nombre: tk('Agua'), u: '%' },
  { k: 'proteinaPct', nombre: tk('Proteína'), u: '%' },
  { k: 'oseaKg', nombre: tk('Masa ósea'), u: 'kg' },
  { k: 'subcutaneaPct', nombre: tk('Grasa subcutánea'), u: '%' },
  { k: 'visceral', nombre: tk('Grasa visceral'), u: '' },
  { k: 'edadCorporal', nombre: tk('Edad corporal'), u: '' },
]

/** La última pesada con báscula del periodo (o de los 120 días anteriores al fin) que trae algún indicador. */
const ultimaBascula = (c: Ctx) => [...c.ms].reverse().find(x => dia10(x.fecha) <= c.fin && dia10(x.fecha) >= sumarDias(c.fin, -120) && INDICADORES.some(i => x.bascula?.[i.k] != null))

/** Gasto en reposo que da la báscula (el mismo de «Otros indicadores»). */
const basalBascula = (c: Ctx) => ultimaBascula(c)?.bascula?.basalKcal ?? null

function indicadores(c: Ctx): ResumenInforme['indicadores'] {
  const m = ultimaBascula(c)
  if (!m) return null
  // Kilos y porcentajes con un decimal siempre («56,0 kg» junto a «55,6 %»); kcal, visceral y edad, enteros.
  const filas = INDICADORES.filter(i => m.bascula![i.k] != null).map(i => {
    const v = m.bascula![i.k]!
    return { nombre: t(i.nombre), valor: conUnidad(i.u === 'kg' || i.u === '%' ? fijo(v) : num(v, 0), i.u ?? '') }
  })
  return { fecha: dia10(m.fecha), filas }
}

// ================================================================ resumen

function filaPrincipal(c: Ctx): FilaResumen | null {
  const enP = c.enPeriodo
  const meta = c.metas.find(m => m.tipo === 'ejercicio' && m.ejercicio && enP.some(s => trabajo(seriesDe(s, m.ejercicio!)).length))
  const id = meta?.ejercicio ?? ejerciciosHechos(enP)[0]
  if (!id) return null
  const u = unidadFuerza(c.hechas, id)
  const pts = serieFuerza(enP, id, u)
  if (!pts.length) return null
  const a = pts[0]!.valor, b = pts[pts.length - 1]!.valor
  const record = c.logros.some(l => l.ejercicio === id)
  const menos = u === 'asistido'
  const sube = b > a, baja = b < a
  const mejora = menos ? baja : sube
  const ultimaSuave = c.enPeriodo.filter(s => trabajo(seriesDe(s, id)).length).at(-1)?.suave
  const tono: TonoInforme = a === b ? 'gris' : mejora ? 'ok' : ultimaSuave ? 'gris' : 'bad'
  const ev: Evaluacion = record ? { texto: tc('evaluación', 'Récord'), tono: 'oro' } : a === b ? { texto: t('Igual'), tono: 'gris' } : mejora ? { texto: menos ? t('Menos ayuda') : t('Sube'), tono: 'ok' } : { texto: ultimaSuave ? t('Semana suave') : menos ? t('Más ayuda') : t('Baja'), tono }
  const f = (v: number) => (u === 'kg' || u === 'asistido' ? kg(v) : num(v, 0))
  return {
    dato: `${nombreDe(c, id)} (${u === 'asistido' ? t('ayuda, kg') : unidadCorta(u)})`,
    inicio: pts.length >= 2 ? f(a) : null, ahora: f(b), junto: null,
    cambio: pts.length >= 2 ? cambioDe(b - a, tono, v => f(v)) : null, cambioTexto: null, contra: null, evaluacion: ev,
    nota: pts.length === 1 ? t('Un solo entreno en estos días') : null,
  }
}

function filaCuerpo(c: Ctx, dato: string, s: SerieCuerpo, campo: 'peso' | 'grasa' | 'cintura'): FilaResumen | null {
  if (s.ahora == null && !s.antes) return null
  // Los dos valores con los mismos decimales («80,1 → 79,0»).
  const f = formatoSerie([s.inicio, s.ahora, s.antes?.valor].filter((v): v is number => v != null))
  if (s.ahora == null) {
    return { dato, inicio: f(s.antes!.valor), ahora: null, junto: null, cambio: null, cambioTexto: null, contra: null, evaluacion: { texto: t('Sin medir'), tono: 'gris' }, nota: t('último: {valor} ({fecha})', { valor: f(s.antes!.valor), fecha: fechaCorta(s.antes!.fecha) }) }
  }
  const ev = s.inicio == null ? { texto: t('Un solo dato'), tono: 'gris' as const } : evaluarCuerpo(s.ahora - s.inicio, c.p.objetivo, campo)
  return {
    dato, inicio: s.inicio == null ? null : f(s.inicio), ahora: f(s.ahora), junto: null, cambio: s.cambio, cambioTexto: null, contra: null, evaluacion: ev,
    nota: s.inicioAntes && s.inicioFecha ? t('al empezar, tu medida del {fecha} (de antes de estos días; dentro solo hay una)', { fecha: fechaCorta(s.inicioFecha) }) : null,
  }
}

function tablaResumen(c: Ctx, cuerpo: CuerpoInforme, ent: ReturnType<typeof cuentaEntrenos>, semanas: SemanaInforme[], comida: ComidaInforme | null, pasos: PasosInforme | null): FilaResumen[] {
  const filas: (FilaResumen | null)[] = [
    filaCuerpo(c, t('Peso (kg)'), cuerpo.peso, 'peso'),
    filaCuerpo(c, cuerpo.grasa.puntos.some(x => x.fuente === 'medidas') && !cuerpo.grasa.puntos.some(x => x.fuente === 'bascula') ? t('Grasa corporal (%, por medidas)') : t('Grasa corporal (%)'), cuerpo.grasa, 'grasa'),
    filaCuerpo(c, t('Cintura (cm)'), cuerpo.cintura, 'cintura'),
    filaPrincipal(c),
  ]
  // Sin ningún entreno no hay fila: lo dice la línea «Entrenos: 0 de N» del resumen.
  if (ent.hechos) {
    const pct = ent.tocaban ? Math.round((ent.enFijos / ent.tocaban) * 100) : null
    filas.push({
      dato: t('Entrenos'), inicio: null, ahora: null, junto: ent.tocaban ? t('{a} de {b}', { a: ent.enFijos, b: ent.tocaban }) : `${ent.hechos}`, cambio: null, cambioTexto: pct == null ? null : conUnidad(String(pct), '%'),
      contra: { valor: String(ent.tocaban ? ent.enFijos : ent.hechos), objetivo: ent.tocaban ? String(ent.tocaban) : '—', pct: pct == null ? null : conUnidad(String(pct), '%') },
      evaluacion: evaluarEntrenos(pct), nota: ent.extra ? t('{n} extra', { n: ent.extra }) : null,
    })
  }
  const conE = semanas.filter(s => s.esfuerzo != null)
  if (conE.length) {
    const a = conE[0]!.esfuerzo!, b = conE[conE.length - 1]!.esfuerzo!
    const total = esfuerzoDe(c.enPeriodo.flatMap(s => s.ejercicios))
    const pal = palabraEsfuerzo(total.media!)
    filas.push({
      dato: t('Esfuerzo medio'), inicio: conE.length >= 2 ? fijo(a) : null, ahora: fijo(conE.length >= 2 ? b : total.media!), junto: null,
      cambio: conE.length >= 2 ? cambioDe(b - a, 'gris', v => fijo(v)) : null, cambioTexto: null, contra: null,
      evaluacion: { texto: `${capital(t(pal.palabra))} (${pal.rango})`, tono: pal.tono }, nota: total.pocas ? t('pocas series marcadas') : null,
    })
  }
  // Media contra objetivo: «103 · 140 · 74 %».
  const contra = (media: number, obj: number) => ({ valor: num(media, 0), objetivo: num(obj, 0), pct: obj > 0 ? conUnidad(String(Math.round((media / obj) * 100)), '%') : null })
  if (comida?.proteina.media != null) filas.push({ dato: t('Proteína al día (g)'), inicio: null, ahora: null, junto: t('{n} de media', { n: num(comida.proteina.media, 0) }), cambio: null, cambioTexto: t('obj. {n}', { n: num(comida.proteina.objetivo, 0) }), contra: contra(comida.proteina.media, comida.proteina.objetivo), evaluacion: comida.proteina.evaluacion, nota: null })
  if (pasos?.media != null) {
    const r = pasos.media / pasos.objetivo
    filas.push({ dato: t('Pasos al día'), inicio: null, ahora: null, junto: t('{n} de media', { n: num(pasos.media, 0) }), cambio: null, cambioTexto: t('obj. {n}', { n: num(pasos.objetivo, 0) }), contra: contra(pasos.media, pasos.objetivo), evaluacion: r >= 1 ? { texto: t('Bien'), tono: 'ok' } : r >= 0.8 ? { texto: t('A mejorar'), tono: 'warn' } : { texto: t('Pocos'), tono: 'bad' }, nota: null })
  }
  return filas.filter((x): x is FilaResumen => !!x)
}

/** Entrenos hechos de los que tocaban: desde el 90 % «Bien», desde el 70 % «Casi», si no «Pocos». */
export function evaluarEntrenos(pct: number | null): Evaluacion {
  if (pct == null) return { texto: '—', tono: 'gris' }
  return pct >= 90 ? { texto: t('Bien'), tono: 'ok' } : pct >= 70 ? { texto: t('Casi'), tono: 'warn' } : { texto: t('Pocos'), tono: 'bad' }
}

/** Proteína media frente al objetivo: desde el 90 % «Bien», desde el 75 % «Algo corta», si no «Corta» (como Progreso). */
export function evaluarProteina(mediaV: number, objetivo: number): Evaluacion {
  return mediaV >= objetivo * 0.9 ? { texto: t('Bien'), tono: 'ok' } : mediaV >= objetivo * 0.75 ? { texto: tc('proteína', 'Algo corta'), tono: 'warn' } : { texto: tc('proteína', 'Corta'), tono: 'bad' }
}

/** Color de la proteína de un día: verde desde el 90 % del objetivo, ámbar del 70 al 90 %, rojo debajo. */
export const tonoProteinaDia = (g: number, objetivo: number): TonoInforme => (g >= objetivo * 0.9 ? 'ok' : g >= objetivo * 0.7 ? 'warn' : 'bad')

function destacado(c: Ctx, cuerpo: CuerpoInforme, rachaV: number): LineaDestacado[] {
  const out: LineaDestacado[] = []
  const nRec = c.logros.length, nSub = c.subidas.length
  if (nRec || nSub) out.push({ icono: 'estrella', tono: 'oro', texto: [nRec ? tn(nRec, '{n} récord', '{n} récords') : '', nSub ? tn(nSub, '{n} subida de peso', '{n} subidas de peso') : ''].filter(Boolean).join(' · ') })
  // El mayor salto de fuerza (en kg) de los 6 ejercicios más repetidos, del primer al último entreno de cada uno:
  // en % ganaría siempre un ejercicio ligero (de 5 a 6,25 kg es un +25 %).
  let mejor: { id: string; a: number; b: number } | null = null
  for (const id of ejerciciosHechos(c.enPeriodo).slice(0, 6)) {
    if (unidadFuerza(c.hechas, id) !== 'kg') continue
    const pts = serieFuerza(c.enPeriodo, id, 'kg')
    if (pts.length < 2) continue
    const a = pts[0]!.valor, b = pts[pts.length - 1]!.valor
    if (b > a && (!mejor || b - a > mejor.b - mejor.a)) mejor = { id, a, b }
  }
  if (mejor) out.push({ icono: 'sube', tono: 'ok', texto: t('{nombre}: de {a} a {b} kg', { nombre: nombreDe(c, mejor.id), a: kg(mejor.a), b: kg(mejor.b) }) })
  const ci = cuerpo.cintura.cambio
  if (ci) {
    const desde = cuerpo.cintura.inicioAntes && cuerpo.cintura.inicioFecha ? fechaCorta(cuerpo.cintura.inicioFecha) : null
    out.push({
      icono: ci.direccion === 'baja' ? 'baja' : ci.direccion === 'sube' ? 'sube' : 'igual', tono: ci.tono,
      texto: ci.direccion === 'igual' ? t('Cintura: igual ({n} cm)', { n: num(cuerpo.cintura.ahora!) })
        : desde ? t('Cintura: {cambio} cm desde el {fecha}', { cambio: ci.texto, fecha: desde }) : t('Cintura: {cambio} cm', { cambio: ci.texto }),
    })
  }
  if (rachaV > 0) out.push({ icono: 'igual', tono: 'tinta', texto: tn(rachaV, 'Racha: {n} semana cumplida', 'Racha: {n} semanas cumplidas') })
  return out
}

// ================================================================ entrenos

function recordsDe(c: Ctx, s: Sesion): RecordSesion[] {
  const orden = (id: string) => s.ejercicios.findIndex(e => e.ejercicio === id)
  return c.logros.filter(l => (l.sesionId != null && s.id != null ? l.sesionId === s.id : l.fecha === s.fecha))
    .sort((a, b) => orden(a.ejercicio) - orden(b.ejercicio))
    .map(l => ({ ejercicio: l.ejercicio, nombre: nombreDe(c, l.ejercicio), peso: l.peso, reps: l.reps, texto: `${nombreDe(c, l.ejercicio)} ${kg(l.peso)} × ${l.reps}` }))
}

function etiquetasDe(s: Sesion): string[] {
  return [s.calibracion && t('semana de prueba'), s.suave && t('semana suave'), s.version === 'corta' && t('corta'), s.letra === 'L' && t('libre')].filter((x): x is string => !!x)
}

function filaEntreno(c: Ctx, s: Sesion): FilaEntreno {
  const min = minutosSesion(s)
  const ejs = s.ejercicios
  const esf = esfuerzoDe(ejs)
  return {
    fecha: s.fecha, fechaTexto: fechaDia(s.fecha), sesionId: s.id ?? null, nombre: nombreEntreno(s), estado: 'hecho', minutos: min, duracion: textoDuracion(min),
    series: suma(ejs.map(e => trabajo(e.series).length)), kg: Math.round(suma(ejs.map(e => volumen(e.series)))),
    esfuerzo: esf, etiquetas: etiquetasDe(s), records: recordsDe(c, s), saltados: ejs.filter(e => e.estado === 'saltado').length,
  }
}

function evolucionEsfuerzo(c: Ctx, total: EsfuerzoInforme): EntrenosInforme['evolucionEsfuerzo'] {
  const porSesion: PuntoEsfuerzo[] = []
  for (const s of c.enPeriodo) {
    const m = esfuerzoDe(s.ejercicios).media
    if (m != null) { const p = palabraEsfuerzo(m); porSesion.push({ fecha: s.fecha, sesionId: s.id ?? null, valor: m, palabra: p.palabra, tono: p.tono }) }
  }
  let puntos = porSesion, agrupado: 'sesion' | 'semana' = 'sesion'
  if (porSesion.length > 60) {
    agrupado = 'semana'
    puntos = [...agrupar(c.enPeriodo, s => lunesDe(s.fecha)).entries()].flatMap(([l, ses]) => {
      const m = esfuerzoDe(ses.flatMap(s => s.ejercicios)).media
      if (m == null) return []
      const p = palabraEsfuerzo(m)
      return [{ fecha: l, sesionId: null, valor: m, palabra: p.palabra, tono: p.tono }]
    })
  }
  return {
    puntos, agrupado, mostrar: porSesion.length >= 2, objetivo: total.objetivo,
    nota: (total.pct != null
      ? t('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): {a} de {b} series ({pct} %).', { a: total.marcadas, b: total.total, pct: total.pct })
      : t('Media de las series con esfuerzo marcado (las que se dejan en blanco no cuentan): {a} de {b} series.', { a: total.marcadas, b: total.total }))
      + (total.pocas ? ` ${t('Pocas series marcadas.')}` : ''),
  }
}

function entrenosInforme(c: Ctx, ent: ReturnType<typeof cuentaEntrenos>): EntrenosInforme {
  const ses = c.enPeriodo
  const ejs = ses.flatMap(s => s.ejercicios)
  const mins = ses.map(minutosSesion).filter((x): x is number => x != null)
  const minutos = mins.length ? suma(mins) : null
  const total = esfuerzoDe(ejs)
  const filas: FilaEntreno[] = [
    ...ses.map(s => filaEntreno(c, s)),
    ...ent.estados.filter(e => e.estado === 'perdido' || e.estado === 'movido').map((e): FilaEntreno => ({
      fecha: e.fecha, fechaTexto: fechaDia(e.fecha), sesionId: null, nombre: nombreEntreno(e.dia!), estado: e.estado === 'perdido' ? 'perdido' : 'movido',
      minutos: null, duracion: e.estado === 'perdido' ? t('No hecho') : t('Movido'), series: null, kg: null, esfuerzo: null, etiquetas: [], records: [], saltados: 0,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const fila = (l: string, etiqueta: string, xs: Sesion[]): FilaSemanaEntrenos => {
    const m = xs.map(minutosSesion).filter((x): x is number => x != null)
    const e = xs.flatMap(s => s.ejercicios)
    return {
      lunes: l, etiqueta, entrenos: xs.length,
      minutos: m.length ? suma(m) : null, duracion: textoDuracion(m.length ? suma(m) : null),
      series: suma(e.map(x => trabajo(x.series).length)), kg: Math.round(suma(e.map(x => volumen(x.series)))),
      esfuerzo: esfuerzoDe(e).media, records: xs.reduce((t, s) => t + recordsDe(c, s).length, 0),
    }
  }
  const porSemana = ses.length > 16 ? [...agrupar(ses, s => lunesDe(s.fecha)).entries()].map(([l, xs]) => {
    const dom = sumarDias(l, 6)
    return fila(l, etiquetaSemana(l < c.inicio ? c.inicio : l, dom > c.fin ? c.fin : dom), xs)
  }) : null
  const porMes = ses.length > 16 && c.r.dias >= 180 ? [...agrupar(ses, s => s.fecha.slice(0, 7)).entries()].map(([m, xs], i) => {
    const d = deISO(`${m}-01`)
    return fila(`${m}-01`, i === 0 || d.getMonth() === 0 ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : MESES[d.getMonth()]!, xs)
  }) : null
  const lista8 = c.subidas.slice(0, 8).map((s): SubidaInforme => ({ ejercicio: s.ejercicio, nombre: nombreDe(c, s.ejercicio), antes: s.antes, ahora: s.ahora, fecha: s.fecha, record: c.logros.some(l => l.ejercicio === s.ejercicio && l.fecha === s.fecha) }))
  const porEj: EsfuerzoEjercicio[] = []
  const sinMarcar: string[] = []
  for (const id of ejerciciosHechos(ses)) {
    const e = esfuerzoDe(ejs.filter(x => x.ejercicio === id))
    if (e.media == null) { sinMarcar.push(nombreDe(c, id)); continue }
    // Con alguna serie marcada siempre hay objetivo (el del ejercicio).
    const p = palabraEsfuerzo(e.media)
    const q = queDiceEsfuerzo(e.media, e.objetivo!)
    porEj.push({ id, nombre: nombreDe(c, id), media: e.media, palabra: p.palabra, tono: p.tono, objetivo: e.objetivo!, queDice: q.texto, tonoQueDice: q.tono, marcadas: e.marcadas, total: e.total })
  }
  const perdidos = ent.perdidos.map(e => ({ fecha: e.fecha, nombre: nombreEntreno(e.dia!) }))
  const pct = ent.tocaban ? Math.round((ent.enFijos / ent.tocaban) * 100) : null
  return {
    sesiones: ses.length, hechos: ent.hechos, enFijos: ent.enFijos, tocaban: ent.tocaban, extra: ent.extra,
    texto: ent.tocaban ? t('{a} de {b}', { a: ent.enFijos, b: ent.tocaban }) : `${ent.hechos}`, pct, evaluacion: evaluarEntrenos(pct),
    perdidos,
    // Con uno se dice cuál; con varios, solo cuántos (la tabla dice cuáles).
    perdidosTexto: perdidos.length === 1 ? t('1 perdido ({fecha})', { fecha: fechaDia(perdidos[0]!.fecha) }) : perdidos.length ? t('{n} perdidos', { n: perdidos.length }) : null,
    movidos: ent.movidos,
    minutos, minutosMedia: mins.length ? Math.round(minutos! / mins.length) : null, tiempo: textoDuracion(minutos),
    series: total.total, saltados: ejs.filter(e => e.estado === 'saltado').length, kg: Math.round(suma(ejs.map(e => volumen(e.series)))),
    records: c.logros.length, subidas: c.subidas.length, esfuerzo: total,
    filas, porSemana, porMes, subidasLista: lista8, subidasMas: Math.max(0, c.subidas.length - 8),
    esfuerzoPorEjercicio: porEj, sinMarcar,
    evolucionEsfuerzo: evolucionEsfuerzo(c, total),
  }
}

// ================================================================ fuerza

function graficaFuerza(c: Ctx, id: string): GraficaFuerza | null {
  const unidad = unidadFuerza(c.hechas, id)
  const pts = serieFuerza(c.enPeriodo, id, unidad)
  if (!pts.length) return null
  const recs = new Set(c.logros.filter(l => l.ejercicio === id).map(l => l.fecha))
  const desde = pts[0]!.valor, hasta = pts[pts.length - 1]!.valor
  const cambio = r1(hasta - desde)
  const menosEsMejor = unidad === 'asistido'
  const direccion: Direccion = cambio > 0 ? 'sube' : cambio < 0 ? 'baja' : 'igual'
  const mejora = menosEsMejor ? direccion === 'baja' : direccion === 'sube'
  const tono: TonoInforme = direccion === 'igual' ? 'gris' : mejora ? 'ok' : 'bad'
  const u = unidadCorta(unidad)
  const f = (v: number) => (u === 'kg' ? kg(v) : num(v, 0))
  // El primer valor siempre es mayor que 0 (kg, ayuda, reps o segundos), así que hay porcentaje.
  const pct = pctCambio(hasta, desde)!
  return {
    id, nombre: nombreDe(c, id), unidad, menosEsMejor,
    puntos: pts.map(p => ({ fecha: p.fecha, valor: p.valor, record: recs.has(p.fecha) })),
    desde, hasta, cambio, pct, veces: pts.length, direccion, tono,
    titulo: pts.length === 1 ? `${f(hasta)} ${u}` : direccion === 'igual' ? t('{valor} {u}, igual', { valor: f(hasta), u }) : t('de {a} a {b} {u}', { a: f(desde), b: f(hasta), u }),
    pie: `${pts.length >= 2 ? (cambio === 0 ? '' : `${conSigno(cambio, f)} ${u} (${textoPct(pct)}) · `) : ''}${tn(pts.length, '{n} vez', '{n} veces')}`,
    unSolo: pts.length === 1 ? textoSerie(pts[0]!.series, unidad) : null,
  }
}

function mejoresSeries(c: Ctx): MejorSerie[] {
  const out: MejorSerie[] = []
  const antesIni = sumarDias(c.inicio, -c.r.dias), antesFin = sumarDias(c.inicio, -1)
  const previas = c.hechas.filter(s => entre(s.fecha, antesIni, antesFin))
  for (const id of ejerciciosHechos(c.enPeriodo).slice(0, 8)) {
    const series = c.enPeriodo.flatMap(s => seriesDe(s, id))
    const m = mejorMarca(series)
    if (!m) continue
    // La sesión de esa marca y, entre sus series iguales, la que tenga el esfuerzo marcado.
    const s = c.enPeriodo.find(x => trabajo(seriesDe(x, id)).some(y => y.peso === m.peso && y.reps === m.reps))!
    const iguales = trabajo(seriesDe(s, id)).filter(y => y.peso === m.peso && y.reps === m.reps)
    const serie = iguales.find(y => y.rpe != null) ?? iguales[0]!
    const prev = mejorMarca(previas.flatMap(x => seriesDe(x, id)))
    const contra = prev ? pctCambio(m.e1rm, prev.e1rm) : null
    const pe = serie.rpe != null ? palabraEsfuerzo(serie.rpe) : null
    out.push({
      id, nombre: nombreDe(c, id), peso: m.peso, reps: m.reps, e1rm: Math.round(m.e1rm), fecha: s.fecha,
      rpe: serie.rpe, esfuerzo: pe?.texto ?? t('sin marcar'), tono: pe?.tono ?? 'gris',
      record: c.logros.some(l => l.ejercicio === id), contraAnterior: contra, contraTexto: contra == null ? '—' : textoPct(contra),
    })
  }
  return out
}

/**
 * Si los datos empiezan a mitad del periodo anterior (el de «contra el mes anterior»), la comparación es con pocos días:
 * «El mes anterior está a medias: tus entrenos empiezan el 8 sep.» Null si está entero o si no hay nada en él.
 */
function anteriorIncompleto(c: Ctx, fechas: string[]): string | null {
  const antesIni = sumarDias(c.inicio, -c.r.dias), antesFin = sumarDias(c.inicio, -1)
  const enAnterior = fechas.filter(f => entre(f, antesIni, antesFin))
  if (!enAnterior.length) return null
  const primero = fechas.reduce((a, b) => (b < a ? b : a))
  if (primero <= antesIni) return null
  const fecha = fechaCorta(primero)
  if (c.r.periodo === 'mes') return t('El mes anterior está a medias: tus entrenos empiezan el {fecha}.', { fecha })
  if (c.r.periodo === 'semana') return t('La semana anterior está a medias: tus entrenos empiezan el {fecha}.', { fecha })
  return t('El periodo anterior está a medias: tus entrenos empiezan el {fecha}.', { fecha })
}

function fuerzaInforme(c: Ctx, semanas: SemanaInforme[], meses: MesInforme[] | null): FuerzaInforme {
  const nSem = Math.max(1, c.r.dias / 7)
  const grupos = seriesPorGrupo(c.enPeriodo, c.dias, id => c.cat.patron(id)).map(g => {
    const v = r1(g.v / nSem)
    const nivel = nivelSeries(v, g.zona)
    return { n: g.n, v, zona: g.zona, nivel, tono: (nivel === 'bien' ? 'ok' : 'warn') as TonoInforme }
  })
  return {
    ejercicios: ejerciciosHechos(c.enPeriodo).slice(0, 6).map(id => graficaFuerza(c, id)).filter((x): x is GraficaFuerza => !!x),
    semanas: semanas.map(s => ({ lunes: s.lunes, etiqueta: s.etiqueta, kg: s.kg, toneladas: s.toneladas, enCurso: s.enCurso })),
    grupos, mejores: mejoresSeries(c), contraNota: anteriorIncompleto(c, c.hechas.map(s => s.fecha)), meses,
  }
}

// ================================================================ comida

function filaComida(x: Comida): ComidaFila {
  return {
    hora: x.hora, franja: x.franja, franjaTexto: nombreFranja(x.franja), nombre: x.nombre, racion: t(NOMBRE_RACION[x.racion]),
    picoteo: x.tipo === 'picoteo', kcal: Math.round(x.kcal), proteina: Math.round(x.proteina), cafeina: x.cafeina ? Math.round(x.cafeina) : null,
  }
}

const totalDe = (xs: Comida[]) => ({ kcal: Math.round(suma(xs.map(x => x.kcal))), proteina: Math.round(suma(xs.map(x => x.proteina))), cafeina: Math.round(suma(xs.map(x => x.cafeina ?? 0))) })

function comidaInforme(c: Ctx, detalle: boolean): ComidaInforme {
  const enP = c.comidas.filter(x => entre(x.fecha, c.inicio, c.fin))
  const porDia = agrupar(enP, x => x.fecha)
  const limite = c.ajustes?.cafeinaLimite ?? 400
  const objP = c.obj.proteina, objK = c.obj.kcal
  const totales = [...porDia.entries()].map(([f, xs]) => ({ fecha: f, ...totalDe(xs), picoteo: xs.some(x => x.tipo === 'picoteo') }))
  const diasAp = totales.length
  // La sección solo se calcula si hay algún día apuntado: las medias existen.
  const medias = (k: 'kcal' | 'proteina' | 'cafeina') => Math.round(media(totales.map(t => t[k]))!)
  // Media de la semana para la línea de energía (tramos horizontales): solo los días apuntados.
  const kcalSemana = new Map([...agrupar(totales, t => lunesDe(t.fecha)).entries()].map(([l, ts]) => [l, Math.round(media(ts.map(t => t.kcal))!)]))
  const dias: DiaComidaInforme[] = c.dias.map(f => {
    const t = totales.find(x => x.fecha === f)
    return {
      fecha: f, apuntado: !!t, kcal: t?.kcal ?? null, proteina: t?.proteina ?? null, cafeina: t ? t.cafeina : null, picoteo: !!t?.picoteo,
      tonoProteina: t ? tonoProteinaDia(t.proteina, objP) : 'gris', kcalSemana: kcalSemana.get(lunesDe(f)) ?? null,
    }
  })
  const antesIni = sumarDias(c.inicio, -c.r.dias), antesFin = sumarDias(c.inicio, -1)
  const antes = c.comidas.filter(x => entre(x.fecha, antesIni, antesFin))
  const picoteo = totales.filter(t => t.picoteo).length
  const picoteoAnt = antes.length ? new Set(antes.filter(x => x.tipo === 'picoteo').map(x => x.fecha)).size : null
  const nombreAnterior = c.r.periodo === 'mes' ? t('el mes anterior') : c.r.periodo === 'semana' ? t('la semana anterior') : t('antes')
  // Si las comidas empiezan a mitad del periodo anterior, se dice con cuántos días se compara.
  const diasAnt = new Set(antes.map(x => x.fecha)).size
  const primeraComida = c.comidas.reduce<string | null>((a, x) => (a == null || x.fecha < a ? x.fecha : a), null)
  const aMedias = picoteoAnt != null && primeraComida != null && primeraComida > antesIni
  const contar = new Map<string, { nombre: string; veces: number }>()
  for (const x of enP) {
    const k = x.nombre.trim().toLowerCase()
    const v = contar.get(k)
    if (v) v.veces++
    else contar.set(k, { nombre: x.nombre.trim(), veces: 1 })
  }
  const conMacros = enP.filter(x => x.hidratos != null || x.azucares != null || x.grasas != null || x.sal != null)
  const sumaM = (k: 'hidratos' | 'azucares' | 'grasas' | 'sal') => { const v = conMacros.filter(x => x[k] != null).map(x => x[k]!); return v.length ? r1(suma(v)) : null }
  const macros = conMacros.length ? (() => {
    const m = { hidratos: sumaM('hidratos'), azucares: sumaM('azucares'), grasas: sumaM('grasas'), sal: sumaM('sal') }
    const partes = [m.hidratos != null && t('hidratos {n} g', { n: num(m.hidratos, 0) }), m.azucares != null && t('azúcares {n} g', { n: num(m.azucares, 0) }), m.grasas != null && t('grasas {n} g', { n: num(m.grasas, 0) }), m.sal != null && t('sal {n} g', { n: num(m.sal) })].filter(Boolean)
    return { ...m, comidas: conMacros.length, texto: t('De lo escaneado: {partes} (solo productos con etiqueta).', { partes: partes.join(', ') }) }
  })() : null
  const protMedia = medias('proteina')
  const sup = new Map<string, number>()
  for (const d of c.suplementos) if (entre(d.fecha, c.inicio, c.fin)) for (const s of unico(d.tomados)) sup.set(s, (sup.get(s) ?? 0) + 1)
  return {
    diasApuntados: diasAp, diasPeriodo: c.r.dias, texto: tn(c.r.dias, '{a} de {n} día apuntado', '{a} de {n} días apuntados', { a: diasAp }),
    objetivoNota: c.r.periodo === 'todo' ? t('Los objetivos de proteína y energía son los de hoy; pueden haber cambiado con tu peso.') : null,
    proteina: { media: protMedia, objetivo: objP, diasCumplidos: totales.filter(t => t.proteina >= objP * 0.9).length, evaluacion: evaluarProteina(protMedia, objP) },
    kcal: { media: medias('kcal'), objetivo: objK, franja: [Math.round(objK * 0.9), Math.round(objK * 1.1)] },
    picoteo: { dias: picoteo, anterior: picoteoAnt, texto: picoteoAnt == null ? t('{antes}: sin datos', { antes: nombreAnterior }) : aMedias ? tn(diasAnt, '{antes}: {v} (en {n} día)', '{antes}: {v} (en {n} días)', { antes: nombreAnterior, v: picoteoAnt }) : `${nombreAnterior}: ${picoteoAnt}` },
    cafeina: { media: medias('cafeina'), limite, diasPorEncima: totales.filter(t => t.cafeina > limite).length },
    dias,
    porFranja: (['desayuno', 'comida', 'merienda', 'cena'] as Franja[]).map(f => {
      const xs = enP.filter(x => x.franja === f)
      return { franja: f, nombre: nombreFranja(f), kcal: Math.round(suma(xs.map(x => x.kcal)) / diasAp), proteina: Math.round(suma(xs.map(x => x.proteina)) / diasAp) }
    }).filter(x => enP.some(y => y.franja === x.franja)),
    top: [...contar.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 5),
    macros,
    consejo: protMedia < objP * 0.9 ? { titulo: t('Para la proteína'), texto: t('Un batido o la versión con pollo o atún de lo que ya comes.') } : null,
    suplementos: [...sup.entries()].map(([nombre, d]) => ({ nombre, dias: d })).sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre, 'es')),
    detalle: detalle ? [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, xs]) => ({ fecha, filas: [...xs].sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(filaComida), total: totalDe(xs) })) : null,
  }
}

// ================================================================ pasos y gasto

/** Gasto de un día con el peso y el % de grasa de ESE día (no los de hoy). Null si falta el peso o la altura. */
export function gastoEnDia(c: Pick<Ctx, 'ms' | 'marina' | 'p' | 'pasos' | 'todas' | 'cat'>, fecha: string): GastoDiaInforme | null {
  const peso = ultimoValor(c.ms, leerPeso, fecha)?.valor
  const e = edadEn(c.p.nacimiento, fecha)
  if (peso == null || !(c.p.alturaCm > 0) || e == null) return null
  const g = grasaEn(c, fecha)
  const b = basalDia({ pesoKg: peso, alturaCm: c.p.alturaCm, edad: e, sexo: c.p.sexo, grasaPct: g?.valor })
  const d = c.pasos.find(x => x.fecha === fecha)
  const pasos = d ? kcalPasos(d.pasos, peso, c.p.alturaCm, d.troteKm ?? 0) : 0
  const entreno = suma(c.todas.filter(s => s.fecha === fecha && s.estado !== 'cancelada').map(s => kcalSesion(s, peso, id => c.cat.met(id)).hecho))
  return { fecha, reposo: b.kcal, pasos, entreno, total: b.kcal + pasos + entreno, formula: b.formula }
}

function pasosInforme(c: Ctx): PasosInforme {
  const obj = c.p.pasosObjetivo
  const enP = new Map(c.pasos.filter(x => entre(x.fecha, c.inicio, c.fin)).map(x => [x.fecha, x]))
  const dias = c.dias.map(f => {
    const d = enP.get(f)
    const troteKm = d?.troteKm ?? 0
    return { fecha: f, pasos: d ? d.pasos : null, troteKm, pasosTrote: d ? Math.min(d.pasos, Math.round(troteKm * 1300)) : 0, cumple: !!d && d.pasos >= obj }
  })
  const con = dias.filter(d => d.pasos != null)
  // La sección solo se calcula si hay algún día con pasos.
  const m = media(con.map(d => d.pasos!))!
  const h = c.p.alturaCm
  const conEntreno = new Set(c.todas.filter(s => s.estado !== 'cancelada' && entre(s.fecha, c.inicio, c.fin)).map(s => s.fecha))
  const gastoDias = c.dias.filter(f => enP.has(f) || conEntreno.has(f)).map(f => gastoEnDia(c, f)).filter((x): x is GastoDiaInforme => !!x)
  const gm = (k: 'reposo' | 'pasos' | 'entreno' | 'total') => Math.round(media(gastoDias.map(g => g[k]))!)
  return {
    dias, media: Math.round(m), objetivo: obj, diasConDato: con.length, diasCumplidos: con.filter(d => d.cumple).length,
    km: h > 0 ? r1(suma(con.map(d => d.pasos!)) * zancada(h) / 1000) : r1(suma(con.map(d => d.pasos!)) * 0.75 / 1000),
    troteKm: r1(suma(dias.map(d => d.troteKm))), diasTrote: dias.filter(d => d.troteKm > 0).length,
    gasto: gastoDias.length ? { reposo: gm('reposo'), pasos: gm('pasos'), entreno: gm('entreno'), total: gm('total'), dias: gastoDias.length } : null,
    gastoDias,
  }
}

// ================================================================ «Tu día»

/** Comparación de «más es mejor» (proteína, pasos) contra lo normal, con un umbral de igualdad en %. */
function comparar(valor: number | null, normal: number | null, umbralPct: number, unidad: string, f: (v: number) => string = v => num(v, 0)): Comparacion {
  const normalTexto = normal == null ? t('lo normal: —') : t('lo normal: {valor}', { valor: conUnidad(f(normal), unidad ?? '') })
  if (valor == null || normal == null) return { valor, normal, diferencia: null, pct: null, direccion: null, juicio: null, tono: 'gris', texto: '', normalTexto }
  const pct = pctCambio(valor, normal)
  const crudo = normal ? ((valor - normal) / Math.abs(normal)) * 100 : 0
  const direccion: Direccion = Math.abs(crudo) < umbralPct ? 'igual' : crudo > 0 ? 'sube' : 'baja'
  const juicio: Juicio = direccion === 'igual' ? 'igual' : direccion === 'sube' ? 'mejor' : 'peor'
  return { valor, normal, diferencia: valor - normal, pct, direccion, juicio, tono: juicio === 'mejor' ? 'ok' : juicio === 'peor' ? 'bad' : 'tinta', texto: pct == null ? '' : textoPct(pct), normalTexto }
}

function filaHoyNormal(c: Ctx, id: string, delDia: Sesion[], antes: Sesion[]): FilaHoyNormal | null {
  // La unidad la marca lo de ese día (si hoy fue con peso, se compara en kg con las veces que hubo peso).
  const unidad = unidadFuerza(delDia, id)
  const hoySeries = delDia.flatMap(s => seriesDe(s, id))
  const hoy = valorFuerza(hoySeries, unidad)
  // Una serie hecha sin nada apuntado (ni peso, ni reps, ni segundos) no se puede comparar.
  if (hoy == null) return null
  const previas = serieFuerza(antes, id, unidad).slice(-4)
  const vals = previas.map(p => p.valor)
  const normal = mediana(vals)
  const suave = delDia.some(s => s.suave && s.ejercicios.some(e => e.ejercicio === id))
  const record = c.logros.some(l => l.ejercicio === id && delDia.some(s => s.fecha === l.fecha))
  const menos = unidad === 'asistido'
  const tf = (v: number) => textoFuerza(v, unidad)
  let juicio: Juicio = 'neutro', direccion: Direccion | null = null, frase: string, pct: number | null = null, por: FilaHoyNormal['por'] = null
  if (normal == null) frase = t('Primera vez: aún no hay con qué comparar')
  else {
    pct = pctCambio(hoy, normal)
    const crudo = ((hoy - normal) / Math.abs(normal)) * 100
    direccion = Math.abs(crudo) < 2 ? 'igual' : crudo > 0 ? 'sube' : 'baja'
    if (direccion !== 'igual') {
      juicio = (direccion === 'sube') !== menos ? 'mejor' : 'peor'
      por = 'peso'
      frase = t('{hoy} · lo normal: {normal} · {pct}', { hoy: tf(hoy), normal: tf(normal), pct: textoPct(pct!) })
    } else {
      juicio = 'igual'
      frase = t('{hoy} · igual que lo normal', { hoy: tf(hoy) })
      if (unidad === 'kg' && hoy === normal) {
        // Mismo peso: se mira si hoy salieron más repeticiones con ese peso que lo normal.
        const repsA = (series: Serie[]) => Math.max(...trabajo(series).filter(x => x.peso === hoy).map(x => x.reps!))
        const repsNormal = mediana(previas.filter(p => p.valor === hoy).map(p => repsA(p.series)))
        const d = repsNormal == null ? 0 : repsA(hoySeries) - repsNormal
        if (Math.abs(d) >= 1) {
          juicio = d > 0 ? 'mejor' : 'peor'
          por = 'reps'
          const n = Math.round(Math.abs(d))
          frase = d > 0 ? tn(n, 'Mismo peso, {n} rep más que lo normal', 'Mismo peso, {n} reps más que lo normal') : tn(n, 'Mismo peso, {n} rep menos que lo normal', 'Mismo peso, {n} reps menos que lo normal')
        }
      }
    }
    if (suave) {
      if (juicio === 'peor') frase = t('semana suave: –10 % previsto')
      juicio = 'neutro'
    }
  }
  const tono: TonoInforme = normal == null ? 'azul' : juicio === 'mejor' ? 'ok' : juicio === 'peor' ? 'bad' : juicio === 'igual' ? 'tinta' : 'gris'
  // Esfuerzo: hoy contra la media de sus 4 últimas sesiones con esfuerzo marcado (o contra el objetivo).
  const eHoy = mediaEsfuerzo(hoySeries)
  // Cada serie pesa lo mismo (como en el resto del informe, §5.6), no la media de las medias de cada sesión.
  const conE = hechasAsc(antes).map(s => conRpe(seriesDe(s, id)).map(x => x.rpe!)).filter(xs => xs.length).slice(-4).flat()
  const eNormal = conE.length ? r1(media(conE)!) : null
  const obj = delDia.flatMap(s => s.ejercicios).find(e => e.ejercicio === id)!.rpe
  const ref = eNormal ?? obj
  const mismoPeso = normal != null && hoy === normal
  const costo = eHoy != null && eNormal != null && mismoPeso && Math.abs(eHoy - eNormal) >= 1 ? (eHoy > eNormal ? 'más' : 'menos') : null
  const pe = eHoy == null ? null : palabraEsfuerzo(eHoy)
  return {
    id, nombre: nombreDe(c, id), unidad, hoyTexto: c.r.periodo === 'ayer' ? t('ayer {serie}', { serie: textoSerie(hoySeries, unidad) }) : t('hoy {serie}', { serie: textoSerie(hoySeries, unidad) }), hoy, normal,
    min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, pct, juicio, direccion, tono, frase, por, record, primera: normal == null, suave,
    esfuerzo: {
      // Una media lleva un decimal, como en el resto del informe («9,0 duro»).
      hoy: eHoy, normal: ref, deObjetivo: eNormal == null, texto: pe ? `${fijo(eHoy!)} ${t(pe.palabra)}` : t('sin marcar'), tono: pe?.tono ?? 'gris',
      normalTexto: eNormal != null ? t('lo normal: {valor}', { valor: fijo(eNormal) }) : t('objetivo: {n}', { n: num(obj) }),
      costo,
    },
  }
}

function tuDiaInforme(c: Ctx): TuDiaInforme {
  const dia = c.fin
  const palabra = c.r.periodo === 'ayer' ? 'ayer' : 'hoy'
  const antes = c.hechas.filter(s => s.fecha < dia)
  const delDia = c.hechas.filter(s => s.fecha === dia)
  const desde = sumarDias(dia, -28), hasta = sumarDias(dia, -1)
  const primerDia = !antes.length && !c.ms.some(m => dia10(m.fecha) < dia) && !c.comidas.some(x => x.fecha < dia) && !c.pasos.some(x => x.fecha < dia)
  const ids = unico(delDia.flatMap(s => s.ejercicios.filter(e => trabajo(e.series).length).map(e => e.ejercicio)))
  const ejercicios = ids.map(id => filaHoyNormal(c, id, delDia, antes)).filter((x): x is FilaHoyNormal => !!x)
  // Proteína y pasos contra la media de los 28 días anteriores con dato.
  const comidasDia = c.comidas.filter(x => x.fecha === dia)
  const total = comidasDia.length ? totalDe(comidasDia) : null
  const protAntes = [...agrupar(c.comidas.filter(x => entre(x.fecha, desde, hasta)), x => x.fecha).values()].map(xs => suma(xs.map(x => x.proteina)))
  const proteina = comparar(total?.proteina ?? null, protAntes.length ? Math.round(media(protAntes)!) : null, 5, 'g')
  const pasosDia = c.pasos.find(x => x.fecha === dia)?.pasos ?? null
  const pasosAntes = c.pasos.filter(x => entre(x.fecha, desde, hasta)).map(x => x.pasos)
  const pasos = comparar(pasosDia, pasosAntes.length ? Math.round(media(pasosAntes)!) : null, 5, '')
  // Peso: el del día contra la media de las pesadas de los 7 días anteriores; cambios de menos de 0,2 kg = igual.
  const pesoDia = ultimoValor(c.ms.filter(m => dia10(m.fecha) === dia), leerPeso)?.valor ?? null
  const pesosAntes = c.ms.filter(m => entre(dia10(m.fecha), sumarDias(dia, -7), hasta) && m.pesoKg != null).map(m => m.pesoKg!)
  const pesoNormal = pesosAntes.length ? r1(media(pesosAntes)!) : null
  const peso = compararPeso(pesoDia, pesoNormal, c.p.objetivo)
  const kcal = compararKcal(total?.kcal ?? null, c.obj.kcal)
  // Entreno: minutos contra la media de las 4 últimas sesiones del mismo día de rutina (no se juzga).
  const estado = estadosDias(c, dia, dia)[0]
  const s0 = delDia[0]
  const minutos = delDia.length ? (delDia.map(minutosSesion).some(x => x != null) ? suma(delDia.map(minutosSesion).filter((x): x is number => x != null)) : null) : null
  const mismas = s0 ? antes.filter(s => s.letra === s0.letra).map(minutosSesion).filter((x): x is number => x != null).slice(-4) : []
  const normalMin = mismas.length ? Math.round(media(mismas)!) : null
  const difMin = minutos != null && normalMin != null ? minutos - normalMin : null
  const entreno: TuDiaInforme['entreno'] = s0
    ? {
      estado: 'hecho', nombre: nombreEntreno(s0), minutos, normal: normalMin, diferencia: difMin, texto: difMin == null ? textoDuracion(minutos) : `${conSigno(difMin, v => String(v))} min`,
      normalTexto: normalMin != null
        ? (palabra === 'ayer' ? t('lo normal: {n} min · ayer {serie}', { n: normalMin, serie: textoDuracion(minutos) }) : t('lo normal: {n} min · hoy {serie}', { n: normalMin, serie: textoDuracion(minutos) }))
        : (palabra === 'ayer' ? t('ayer {serie}', { serie: textoDuracion(minutos) }) : t('hoy {serie}', { serie: textoDuracion(minutos) })),
    }
    : { estado: estado?.estado === 'perdido' || estado?.estado === 'plan' ? 'no hecho' : 'descanso', nombre: estado?.dia ? nombreEntreno(estado.dia) : null, minutos: null, normal: null, diferencia: null, texto: estado?.estado === 'perdido' || estado?.estado === 'plan' ? t('No hecho') : t('Descanso'), normalTexto: '' }
  const cuentan = [...ejercicios.map(e => e.juicio), proteina.juicio, pasos.juicio, peso.juicio].filter((j): j is Juicio => j === 'mejor' || j === 'peor' || j === 'igual')
  const recuento = primerDia ? null : { mejor: cuentan.filter(j => j === 'mejor').length, peor: cuentan.filter(j => j === 'peor').length, igual: cuentan.filter(j => j === 'igual').length }
  // Ejercicio principal: el de la meta, o el más repetido de los de ese día (o de siempre, si descansó).
  const meta = c.metas.find(m => m.tipo === 'ejercicio' && m.ejercicio && c.hechas.some(s => trabajo(seriesDe(s, m.ejercicio!)).length))?.ejercicio
  const idP = meta ?? ejerciciosHechos(c.hechas).find(id => !ids.length || ids.includes(id))
  let principal: TuDiaInforme['principal'] = null
  if (idP) {
    const u = unidadFuerza(c.hechas, idP)
    const pts = serieFuerza(c.hechas, idP, u).slice(-12)
    const recs = new Set(logros(c.hechas).filter(l => l.ejercicio === idP).map(l => l.fecha))
    const previos = (pts.at(-1)?.fecha === dia ? pts.slice(0, -1) : pts).slice(-4).map(p => p.valor)
    principal = {
      id: idP, nombre: nombreDe(c, idP), unidad: u, titulo: tn(pts.length, '{nombre}, tus últimas {n} vez', '{nombre}, tus últimas {n} veces', { nombre: nombreDe(c, idP) }),
      puntos: pts.map(p => ({ fecha: p.fecha, valor: p.valor, record: recs.has(p.fecha) })),
      banda: previos.length ? { min: Math.min(...previos), max: Math.max(...previos), mediana: mediana(previos)! } : null,
    }
  }
  const g = gastoEnDia(c, dia)
  let gasto: TuDiaInforme['gasto'] = null
  if (g) {
    const comido = total?.kcal ?? null
    const dif = comido == null ? null : comido - g.total
    const r10 = dif == null ? 0 : Math.round(Math.abs(dif) / 10) * 10
    gasto = {
      ...g, comido, diferencia: dif,
      texto: dif == null ? null : r10 === 0 ? t('lo mismo que lo gastado') : dif < 0 ? t('unas {n} menos de lo gastado', { n: r10 }) : t('unas {n} más de lo gastado', { n: r10 }),
      tono: dif == null ? 'gris' : dif <= 0 ? 'ok' : 'warn',
    }
  }
  const limite = c.ajustes?.cafeinaLimite ?? 400
  const cafe = total ? total.cafeina : null
  return {
    fecha: dia, palabra, primerDia, recuento,
    frase: primerDia ? t('Es tu primer día con datos: a partir de ahora el informe te comparará contigo mismo.') : fraseDia(ejercicios, proteina, pasos, peso, palabra),
    entreno, proteina, pasos, peso, kcal,
    cafeina: { valor: cafe, limite, tono: cafe == null ? 'gris' : cafe > limite ? 'bad' : 'tinta' },
    ejercicios, principal, gasto,
    comidas: [...comidasDia].sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(filaComida), total,
    tonoProteina: total ? (total.proteina >= c.obj.proteina * 0.9 ? 'ok' : total.proteina >= c.obj.proteina * 0.75 ? 'warn' : 'bad') : 'gris',
    cuerpo: cuerpoDelDia(c, dia, palabra),
  }
}

/** Peso del día contra lo normal según el objetivo: perder o recomposición, bajar es mejor; fuerza, no se juzga. */
export function compararPeso(valor: number | null, normal: number | null, objetivo: Perfil['objetivo']): Comparacion {
  const f = (v: number) => kg(v)
  const normalTexto = normal == null ? t('lo normal: —') : t('media de los 7 días antes: {n} kg', { n: f(normal) })
  if (valor == null || normal == null) return { valor, normal, diferencia: null, pct: null, direccion: null, juicio: null, tono: 'gris', texto: '', normalTexto }
  const d = r1(valor - normal)
  const direccion: Direccion = Math.abs(d) < 0.2 ? 'igual' : d > 0 ? 'sube' : 'baja'
  const juicio: Juicio = objetivo === 'fuerza' ? 'neutro' : direccion === 'igual' ? 'igual' : direccion === 'baja' ? 'mejor' : 'peor'
  return { valor, normal, diferencia: d, pct: pctCambio(valor, normal), direccion, juicio, tono: juicio === 'mejor' ? 'ok' : juicio === 'peor' ? 'bad' : juicio === 'igual' ? 'tinta' : 'gris', texto: `${conSigno(d)} kg`, normalTexto }
}

/** kcal del día frente al objetivo ±10 %: dentro, bien; fuera, ámbar (nunca rojo: son orientativas). */
export function compararKcal(valor: number | null, objetivo: number): Comparacion {
  const normalTexto = t('objetivo: {n} kcal', { n: num(objetivo, 0) })
  if (valor == null) return { valor, normal: objetivo, diferencia: null, pct: null, direccion: null, juicio: null, tono: 'gris', texto: '', normalTexto }
  const pct = pctCambio(valor, objetivo)
  const dentro = valor >= objetivo * 0.9 && valor <= objetivo * 1.1
  return { valor, normal: objetivo, diferencia: valor - objetivo, pct, direccion: dentro ? 'igual' : valor > objetivo ? 'sube' : 'baja', juicio: 'neutro', tono: dentro ? 'ok' : 'warn', texto: dentro ? t('dentro del objetivo') : textoPct(pct!), normalTexto }
}

function fraseDia(ejs: FilaHoyNormal[], prot: Comparacion, pasos: Comparacion, peso: Comparacion, palabra: string): string {
  const comparables = ejs.filter(e => e.juicio === 'mejor' || e.juicio === 'peor' || e.juicio === 'igual')
  const nMejor = comparables.filter(e => e.juicio === 'mejor').length, nPeor = comparables.filter(e => e.juicio === 'peor').length
  const inicio = !ejs.length ? t('Día sin entreno.') : !comparables.length ? t('Día de entreno.') : nMejor >= nPeor ? t('Buen día de fuerza.') : t('Día flojo de fuerza.')
  const min = nombreEnFrase
  const bien: string[] = []
  for (const e of ejs.filter(x => x.record)) bien.push(t('récord en {nombre} ({valor})', { nombre: min(e.nombre), valor: textoFuerza(e.hoy, e.unidad) }))
  const masPeso = ejs.filter(e => !e.record && e.juicio === 'mejor' && e.por === 'peso').map(e => min(e.nombre))
  const masReps = ejs.filter(e => !e.record && e.juicio === 'mejor' && e.por === 'reps').map(e => min(e.nombre))
  if (masPeso.length) bien.push(ejs.some(e => e.unidad === 'asistido' && masPeso.includes(min(e.nombre))) ? t('mejor en {lista}', { lista: lista(masPeso) }) : t('más peso en {lista}', { lista: lista(masPeso) }))
  if (masReps.length) bien.push(t('más repeticiones en {lista}', { lista: lista(masReps) }))
  if (prot.juicio === 'mejor') bien.push(t('más proteína'))
  if (pasos.juicio === 'mejor') bien.push(t('más pasos'))
  if (peso.juicio === 'mejor') bien.push(t('bajas de peso'))
  const peor = [
    ...ejs.filter(e => e.juicio === 'peor').map(e => min(e.nombre)),
    ...(prot.juicio === 'peor' ? [t('la proteína')] : []),
    ...(pasos.juicio === 'peor' ? [t('los pasos')] : []),
    ...(peso.juicio === 'peor' ? [t('el peso (sube)')] : []),
  ]
  const partes = [inicio]
  if (bien.length) partes.push(`${capital(lista(bien))}.`)
  if (peor.length) partes.push(t('Peor: {lista}.', { lista: lista(peor) }))
  if (!bien.length && !peor.length && ejs.length) partes.push(palabra === 'ayer' ? t('Ayer, como lo normal.') : t('Hoy, como lo normal.'))
  return partes.join(' ')
}

function cuerpoDelDia(c: Ctx, dia: string, palabra: string): string | null {
  const delDia = c.ms.filter(m => dia10(m.fecha) === dia)
  if (!delDia.length) return null
  const peso = ultimoValor(delDia, leerPeso)?.valor
  const grasaB = ultimoValor(delDia, leerGrasaBascula)?.valor
  const grasaM = c.marina.find(x => x.fecha === dia)?.valor
  const cin = ultimoValor(delDia, leerCintura)?.valor
  const ultCin = ultimoValor(c.ms, leerCintura, dia)
  const partes = [
    peso != null ? `${fijo(peso)} kg` : t('peso sin apuntar'),
    grasaB != null ? conUnidad(num(grasaB), '%') : grasaM != null ? t('{n} % (por medidas)', { n: num(grasaM) }) : null,
    cin != null ? t('cintura {n} cm', { n: num(cin) }) : ultCin ? t('cintura sin medir (última: {n} cm el {fecha})', { n: num(ultCin.valor), fecha: fechaCorta(ultCin.fecha) }) : t('cintura sin medir'),
  ].filter((x): x is string => !!x)
  return palabra === 'ayer' ? t('Cuerpo ayer: {partes}', { partes: partes.join(' · ') }) : t('Cuerpo hoy: {partes}', { partes: partes.join(' · ') })
}

// ================================================================ anexo «una a una»

function detalleEntrenos(c: Ctx): DetalleEntreno[] {
  return c.enPeriodo.map(s => {
    const recs = new Set(c.logros.filter(l => l.fecha === s.fecha).map(l => `${l.ejercicio}|${l.peso}|${l.reps}`))
    const min = minutosSesion(s)
    return {
      fecha: s.fecha,
      titulo: [fechaDia(s.fecha), nombreEntreno(s), min != null ? textoDuracion(min) : null].filter(Boolean).join(' · '),
      ejercicios: s.ejercicios.map(e => ({
        id: e.ejercicio, nombre: nombreDe(c, e.ejercicio), saltado: e.estado === 'saltado',
        enVezDe: e.planificado && e.planificado !== e.ejercicio ? nombreDe(c, e.planificado) : null,
        motivo: e.motivo === 'ocupado' ? 'ocupado' : e.motivo === 'cambio' ? 'cambio' : null,
        // Las series de trabajo se numeran desde 1 (los calentamientos no cuentan).
        series: e.series.map((x, i): DetalleSerie => ({
          n: x.calentamiento ? 0 : e.series.slice(0, i + 1).filter(y => !y.calentamiento).length, peso: x.peso, reps: x.reps, segundos: x.segundos ?? null, rpe: x.rpe, calentamiento: x.calentamiento, hecha: x.hecha,
          record: !!x.record && recs.has(`${e.ejercicio}|${x.peso}|${x.reps}`), nota: x.nota ?? null,
        })),
      })),
    }
  })
}

// ================================================================ todo junto

/** Calcula todo lo que sale en el informe. Las tablas llegan enteras; aquí se filtra por el periodo. */
export function calcularInforme(e: EntradaInforme): Informe {
  const r = rangoInforme(e.periodo, e.ahora, primerDato(e))
  const c = contexto(e, r)
  const secciones: SeccionesInforme = { ...SECCIONES_POR_DEFECTO, ...e.secciones }
  const semanas = r.unDia ? [] : semanasInforme(c)
  const meses = r.periodo === 'todo' && r.dias >= 60 ? mesesInforme(c) : null
  const ent = cuentaEntrenos(c, r.inicio, r.fin)
  const hayComidas = c.comidas.some(x => entre(x.fecha, r.inicio, r.fin))
  const hayPasos = c.pasos.some(x => entre(x.fecha, r.inicio, r.fin))
  const hayCuerpo = c.ms.some(m => entre(dia10(m.fecha), r.inicio, r.fin))
  const cuerpo = cuerpoInforme(c)
  const comidaD = hayComidas ? comidaInforme(c, secciones.detalle) : null
  const pasosD = hayPasos ? pasosInforme(c) : null
  const lineas: Evaluacion[] = []
  const ult = cuerpo.peso.antes
  const ultV = ult ? { peso: fijo(ult.valor), fecha: fechaCorta(ult.fecha) } : null
  if (r.unDia) {
    // Un solo día: frases con «hoy»/«ayer». Lo del entreno ya lo dice su ficha («Descanso», «No hecho»).
    const ayer = r.periodo === 'ayer'
    if (secciones.comida && !hayComidas) lineas.push({ texto: ayer ? t('Ayer no has apuntado comidas') : t('Hoy no has apuntado comidas'), tono: 'gris' })
    if (secciones.cuerpo && !hayCuerpo) {
      const texto = ultV
        ? (ayer ? t('Ayer no te has pesado (último peso: {peso} kg, {fecha})', ultV) : t('Hoy no te has pesado (último peso: {peso} kg, {fecha})', ultV))
        : (ayer ? t('Ayer no te has pesado') : t('Hoy no te has pesado'))
      lineas.push({ texto, tono: 'gris' })
    }
    if (secciones.pasos && !hayPasos) lineas.push({ texto: ayer ? t('Ayer no has apuntado pasos') : t('Hoy no has apuntado pasos'), tono: 'gris' })
  } else {
    if (secciones.entrenos && !c.enPeriodo.length) lineas.push(ent.tocaban ? { texto: t('Entrenos: 0 de {n}', { n: ent.tocaban }), tono: 'bad' } : { texto: t('Entrenos: no hay entrenos de estos días'), tono: 'gris' })
    if (secciones.comida && !hayComidas) lineas.push({ texto: t('Comida: no hay comidas apuntadas de estos días'), tono: 'gris' })
    if (secciones.cuerpo && !hayCuerpo) lineas.push({ texto: ultV ? t('Cuerpo: no te has pesado ni medido estos días (último peso: {peso} kg, {fecha})', ultV) : t('Cuerpo: no te has pesado ni medido estos días'), tono: 'gris' })
    if (secciones.pasos && !hayPasos) lineas.push({ texto: t('Pasos: no hay pasos apuntados de estos días'), tono: 'gris' })
  }
  if (c.hayPerfil && !(c.p.alturaCm > 0)) lineas.push({ texto: t('Falta tu altura en Perfil'), tono: 'warn' })
  const z = zonasInforme(c)
  const rachaV = racha(c.rutina, c.todas, sumarDias(r.fin, 1))
  const q = c.ms.length || c.comidas.length ? datosQuincena({ hoy: r.fin, mediciones: c.ms.filter(m => dia10(m.fecha) <= r.fin), comidas: c.comidas.filter(x => x.fecha <= r.fin), objetivoProteina: c.obj.proteina, objetivo: c.p.objetivo }) : null
  const metasFechas = unico(c.metas.filter(m => m.fecha).map(m => mesAnio(m.fecha!)))
  const sexo = c.hayPerfil ? (c.p.sexo === 'mujer' ? t('Mujer') : t('Hombre')) : null
  const nombre = c.p.nombre?.trim() || null
  // «20/10/2026»; en inglés (EE. UU.), el mes delante: «10/20/2026».
  const dd = String(e.ahora.getDate()).padStart(2, '0'), mm = String(e.ahora.getMonth() + 1).padStart(2, '0')
  const creado = idioma() === 'en' ? `${mm}/${dd}/${e.ahora.getFullYear()}` : `${dd}/${mm}/${e.ahora.getFullYear()}`
  const hora = formatoHora(horaActual(e.ahora))
  const resumen: ResumenInforme = {
    tabla: tablaResumen(c, cuerpo, ent, semanas, comidaD, pasosD),
    zonas: z.zonas, zonasSubtitulo: z.subtitulo,
    zonasNota: c.p.sexo === 'mujer'
      ? t('Zonas de la app: IMC de la OMS, grasa de la ACE para mujeres (14-32 %), cintura/altura saludable entre {a} y {b}.', { a: fijo(0.4, 2), b: fijo(0.5, 2) })
      : t('Zonas de la app: IMC de la OMS, grasa de la ACE para hombres (6-25 %), cintura/altura saludable entre {a} y {b}.', { a: fijo(0.4, 2), b: fijo(0.5, 2) }),
    puntuacion: r.unDia ? null : puntuacionInforme(semanas),
    casillas: r.periodo === 'semana' ? estadosDias(c, r.inicio, r.fin).map((d): CasillaDia => {
      const com = c.comidas.filter(x => x.fecha === d.fecha)
      const prot = com.length ? Math.round(suma(com.map(x => x.proteina))) : null
      const pas = c.pasos.find(x => x.fecha === d.fecha)?.pasos ?? null
      const pes = ultimoValor(c.ms.filter(m => dia10(m.fecha) === d.fecha), leerPeso)?.valor ?? null
      return {
        fecha: d.fecha, inicial: DIAS_CORTOS[diaSemana(deISO(d.fecha))], estado: d.estado, nombre: d.dia?.nombre ?? null,
        proteina: prot, tonoProteina: prot == null ? 'gris' : tonoProteinaDia(prot, c.obj.proteina), pasos: pas, cumplePasos: pas != null && pas >= c.p.pasosObjetivo, peso: pes,
      }
    }) : null,
    controlPeso: controlPeso(c),
    metas: metasInforme(c), metasFecha: metasFechas.length === 1 ? metasFechas[0]! : null,
    indicadores: indicadores(c),
    destacado: destacado(c, cuerpo, rachaV), racha: rachaV,
    consejo: q ? { texto: q.consejo, tono: q.tono === 'ok' ? 'ok' : q.tono === 'warn' ? 'warn' : 'gris', etiqueta: q.etiqueta } : null,
    lineas,
  }
  return {
    periodo: r.periodo, rango: r, secciones,
    cabecera: {
      titulo: r.unDia ? t('Tu día') : t('Informe de progreso'), nombre, sexo, edad: edadEn(c.p.nacimiento, r.fin), alturaCm: c.p.alturaCm > 0 ? c.p.alturaCm : null,
      periodo: `${r.etiqueta} · ${r.texto}`, creado: `${creado} ${hora}`, creadoPie: t('Creado el {fecha} a las {hora}', { fecha: creado, hora }),
      tituloPdf: t('Informe JowyFit · {periodo}', { periodo: r.etiqueta }), autor: nombre ?? '', comparado: r.unDia ? t('Comparado con tus últimas 4 semanas') : null,
    },
    hayDatos: hayDatosEn(e, r.inicio, r.fin),
    resumen, semanas, meses,
    entrenos: secciones.entrenos && c.enPeriodo.length ? entrenosInforme(c, ent) : null,
    fuerza: secciones.entrenos && c.enPeriodo.length ? fuerzaInforme(c, semanas, meses) : null,
    comida: secciones.comida ? comidaD : null,
    cuerpo: secciones.cuerpo && hayCuerpo ? cuerpo : null,
    pasos: secciones.pasos ? pasosD : null,
    tuDia: r.unDia ? tuDiaInforme(c) : null,
    detalleEntrenos: secciones.detalle && secciones.entrenos && c.enPeriodo.length ? detalleEntrenos(c) : null,
  }
}
