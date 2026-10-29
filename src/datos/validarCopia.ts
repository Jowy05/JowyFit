// Comprobación estricta de una copia antes de tocar la base: cada campo de cada tabla con su tipo (un nombre que es
// un objeto o un id 2^53 dejan la app en blanco). Si algo no cuadra se rechaza entera, sin borrar nada.
import { imagenOFF } from '../dominio/comida'
import { TABLAS, type NombreTabla } from './db'
import { TOPE_SERIE } from '../dominio/sesion'
import { t, tk } from '../i18n'

type Fila = Record<string, unknown>
/** Comprueba un valor y lo devuelve limpio. `undefined` = quitar el campo. Lanza si no vale. */
type Regla = (v: unknown, donde: string) => unknown

class CopiaNoValida extends Error {}
const mal = (donde: string, que: string): never => {
  throw new CopiaNoValida(t('La copia tiene datos que no son de JowyFit ({donde}: {que}). No se ha cambiado nada.', { donde, que }))
}

/** Mayor id que se acepta: muy lejos de lo que usa nadie y de 2^53 (que agota el contador de IndexedDB). */
const ID_MAX = 1e9
const LIMITES = {
  corto: 60, // valores tipo «hombre», «pesadas», «comida»…
  nombre: 1000,
  nota: 20_000,
  filas: 100_000,
  lista: 10_000,
}
/** Tipos de imagen que se aceptan en las fotos de una copia. Nunca SVG ni HTML (podrían llevar código). */
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

// Lo que se comprueba se dice en el idioma de la app; los nombres de los campos (› nombre, › fecha…) van tal cual.
const texto = (max: number): Regla => (v, d) => (typeof v === 'string' ? (v.length <= max ? v : mal(d, t('texto de {n} letras', { n: v.length }))) : mal(d, t('no es un texto')))
const corto = texto(LIMITES.corto)
const nombre = texto(LIMITES.nombre)
const nota = texto(LIMITES.nota)
/** Fecha (AAAA-MM-DD) que existe, entre 1900 y 2100, con o sin hora detrás («2026-10-13T07:00», ISO con zona). */
export function fechaValida(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(v)
  if (!m) return false
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const f = new Date(Date.UTC(a, mes - 1, dia))
  return a >= 1900 && a <= 2100 && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia
}
const fecha: Regla = (v, d) => (typeof v === 'string' && v.length <= 40 && fechaValida(v) ? v : mal(d, t('no es una fecha')))
/** «5:30» o «05:30», de 0:00 a 23:59. */
export const esHora = (v: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(v)
const hora: Regla = (v, d) => (typeof v === 'string' && esHora(v) ? v : mal(d, t('no es una hora')))
const num: Regla = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : mal(d, t('no es un número')))
const ent = (min: number, max: number): Regla => (v, d) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : mal(d, t('no es un número válido')))
const bool: Regla = (v, d) => (typeof v === 'boolean' ? v : mal(d, t('no es sí/no')))
const nulo = (r: Regla): Regla => (v, d) => (v === null ? null : r(v, d))
const constante = (x: string): Regla => (v, d) => (v === x ? v : mal(d, t('no es el esperado')))
/** Un número que se lleva al tope más cercano si se sale (para valores que la app pudo guardar antes de tener tope). */
const acotado = (min: number, max: number): Regla => (v, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : mal(d, t('no es un número')))
const rango = (min: number, max: number): Regla => (v, d) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : mal(d, t('número fuera de lo normal')))
/** Uno de los valores que usa la app (si no, la pantalla no sabe qué pintar y falla). */
const uno = (...valores: string[]): Regla => (v, d) => (typeof v === 'string' && valores.includes(v) ? v : mal(d, t('valor desconocido')))
/** Igual, pero un valor desconocido se quita (y se usa el de siempre): para el perfil y los ajustes. */
const unoO = (...valores: string[]): Regla => v => (typeof v === 'string' && valores.includes(v) ? v : undefined)
/** id de las tablas que lo generan solas (y referencias a ellas: rutinaId, gimnasioId…). */
const id = ent(1, ID_MAX)
const dia = ent(0, 6)

function lista(r: Regla, max = LIMITES.lista): Regla {
  return (v, d) => {
    if (!Array.isArray(v)) return mal(d, t('no es una lista'))
    if (v.length > max) return mal(d, t('lista de {n}', { n: v.length }))
    // Lo que una regla quita (undefined) no entra en la lista.
    return v.map((x, i) => r(x, `${d} ${i + 1}`)).filter(x => x !== undefined)
  }
}

const esObjeto = (v: unknown): v is Fila => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Blob)

/** Diccionario libre (referencias, dosis): claves de texto corto y valores con su regla. */
function dic(r: Regla, max = 200): Regla {
  return (v, d) => {
    if (!esObjeto(v)) return mal(d, t('no es una lista de valores'))
    const e = Object.entries(v)
    if (e.length > max) return mal(d, t('demasiados valores'))
    const out: Fila = {}
    for (const [k, x] of e) {
      if (k.length > LIMITES.nombre) mal(d, t('nombre demasiado largo'))
      // defineProperty: una clave «__proto__» queda como dato normal, sin cambiar el prototipo.
      Object.defineProperty(out, k, { value: r(x, `${d} › ${k}`), enumerable: true, writable: true, configurable: true })
    }
    return out
  }
}

type Campos = Record<string, { r: Regla; opc?: boolean }>
const req = (r: Regla) => ({ r })
const opc = (r: Regla) => ({ r, opc: true })

/** Objeto con sus campos: los que faltan y son obligatorios rechazan; los desconocidos se quitan. */
function obj(campos: Campos): Regla {
  return (v, d) => {
    if (!esObjeto(v)) return mal(d, t('no es un registro'))
    const out: Fila = {}
    for (const [k, c] of Object.entries(campos)) {
      const x = Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined
      if (x === undefined) { if (!c.opc) mal(d, t('falta «{campo}»', { campo: k })); continue }
      const limpio = c.r(x, `${d} › ${k}`)
      if (limpio !== undefined) out[k] = limpio
    }
    return out
  }
}

export type RefArchivo = { __archivo: string; tipo: string }
/**
 * Una foto de la copia: referencia a un archivo del zip. Si su tipo no es de imagen (SVG, HTML…) se descarta:
 * abierta en otra pestaña podría ejecutar código con los datos de la app.
 */
const archivo: Regla = (v, d) => {
  if (!esObjeto(v) || typeof v.__archivo !== 'string' || typeof v.tipo !== 'string') return mal(d, t('no es una foto'))
  if (!/^archivos\/[A-Za-z0-9._-]{1,100}$/.test(v.__archivo) || v.__archivo.includes('..')) return mal(d, t('nombre de archivo raro'))
  const tipo = v.tipo.trim().toLowerCase()
  if (!(TIPOS_FOTO as readonly string[]).includes(tipo)) return undefined
  return { __archivo: v.__archivo, tipo } satisfies RefArchivo
}

const REGISTRO = uno('peso', 'mancuerna', 'asistido', 'corporal', 'tiempo', 'cardio')
const ZONA_DOLOR = uno('cuello', 'hombros', 'codos', 'munecas', 'manos', 'lumbar', 'caderas', 'rodillas', 'tobillos', 'pies', 'pecho', 'espalda', 'brazo', 'abdomen', 'gluteo', 'muslo', 'isquio', 'gemelo', 'cabeza', 'estomago', 'hormigueo', 'cansancio', 'fiebre')
const FRANJA = uno('desayuno', 'comida', 'merienda', 'cena')
const macros = { hidratos: opc(num), azucares: opc(num), grasas: opc(num), sal: opc(num) }

const PERFIL = obj({
  id: req(constante('yo')), creado: opc(fecha), altaCompleta: req(bool), nombre: opc(nombre), nacimiento: opc(fecha), sexo: opc(unoO('hombre', 'mujer')), alturaCm: opc(rango(0, 300)),
  objetivo: opc(unoO('salud', 'perder', 'recomposicion', 'musculo', 'fuerza', 'estetica', 'peso')), objetivosExtra: opc(lista(unoO('salud', 'perder', 'recomposicion', 'musculo', 'fuerza', 'estetica', 'peso'), 6)), prioridades: opc(lista(nombre, 100)), zonasPrioridad: opc(lista(corto, 50)), zonasMucho: opc(lista(corto, 50)), nivel: opc(unoO('empiezo', 'vuelvo', 'intermedio', 'avanzado')), referencias: opc(dic(texto(200))),
  diasFijos: opc(lista(dia, 7)), diasOpcionales: opc(lista(dia, 7)), horaEntreno: opc(hora), transporte: opc(unoO('coche', 'andando')),
  horaLimite: opc(obj({ coche: req(hora), andando: req(hora) })), minutosNormal: opc(rango(0, 600)), minutosCorta: opc(rango(0, 600)), horaDormir: opc(hora), enAyunas: opc(bool),
  sesionPerdida: opc(unoO('sabado', 'saltar')), zonasSensibles: opc(lista(unoO('rodilla', 'lumbar', 'hombro', 'muneca', 'codo'), 50)), lesiones: opc(nota), condiciones: opc(nota),
  urgencias: opc(lista(unoO('pecho', 'mareo', 'aire', 'palpitaciones'), 10)),
  dolores: opc(lista(obj({ zona: req(ZONA_DOLOR), cuanto: req(uno('poco', 'regular', 'mucho')), cuando: req(uno('siempre', 'fuerza', 'aveces')), desde: req(uno('dias', 'semanas', 'meses')), inicio: req(fecha) }), 50)),
  condicionesSalud: opc(lista(unoO('tension', 'osteoporosis', 'diabetes', 'protesis', 'anticoagulantes', 'asma', 'embarazo'), 20)),
  noQuiero: opc(lista(unoO('cardio', 'corporal', 'maquinas', 'libre', 'poleas', 'suelo'), 10)),
  modoMayor: opc(obj({ activo: req(bool), propuesto: opc(fecha), rechazado: opc(fecha) })), modoRutina: opc(unoO('cola', 'dias')),
  preferencia: opc(unoO('maquinas', 'libre', 'mezcla')), reps: opc(unoO('pesadas', 'moderadas', 'mezcla')),
  superseries: opc(bool), alFallo: opc(bool), core: opc(bool), cardio: opc(unoO('nada', 'pasos', 'trote')), comidasDia: opc(rango(0, 20)), franjasHambre: opc(lista(nombre, 50)),
  bebidas: opc(lista(nombre, 100)), suplementos: opc(lista(nombre, 100)), dosisSuplementos: opc(dic(texto(200))),
  batido: opc(obj({ proteina: req(num), kcal: req(num) })), trabajo: opc(unoO('sentado', 'depie', 'fisico')), pasosObjetivo: opc(rango(0, 200_000)), cardioMin: opc(rango(0, 10_000)), cardioTipos: opc(lista(unoO('caminar', 'bici', 'eliptica', 'nadar', 'correr'), 10)), cardioCuando: opc(unoO('despues', 'otro')), progresoMovimiento: opc(fecha),
  sueno: opc(unoO('poco', 'normal', 'mucho')), deportes: opc(lista(corto, 20)), diaDeporte: opc(nulo(dia)), experienciaPrevia: opc(unoO('nunca', 'hace-anos', 'hace-meses', 'ahora')), diasPesaje: opc(lista(dia, 7)), fotosCadaSemanas: opc(rango(0, 520)),
})

const AJUSTES = obj({
  id: req(constante('app')), gimnasioActivo: opc(nulo(id)), descansoCompuesto: opc(rango(0, 36_000)), descansoAislamiento: opc(rango(0, 36_000)), vibrar: opc(bool), sonido: opc(bool),
  pantallaEncendida: opc(bool), calentamiento: opc(bool), avisosSeguridad: opc(bool), mostrarKcal: opc(bool), kcalManual: opc(nulo(num)), proteinaManual: opc(nulo(num)),
  cafeinaLimite: opc(num), cafeinaHoraTope: opc(hora), fuentePasos: opc(unoO('auto', 'manual')), fuenteBascula: opc(unoO('auto', 'manual')), hcIgnorados: opc(lista(texto(300))),
  noti: opc(obj({
    dormir: opc(bool), pesarse: opc(bool), pesarseHora: opc(hora), batido: opc(bool), batidoHora: opc(hora), creatina: opc(bool), creatinaHora: opc(hora),
    copia: opc(bool), fotos: opc(bool), domingo: opc(bool), revision: opc(bool), revisionHora: opc(hora),
  })),
  copiaAuto: opc(bool), ultimaCopia: opc(nulo(fecha)), ultimoAjusteEnergia: opc(nulo(fecha)),
  recolocadas: opc(lista(obj({ fecha: req(fecha), letra: req(corto), desde: req(fecha) }), 1000)),
  inicio: opc(nulo(fecha)), semanaSuave: opc(nulo(fecha)), suavePospuesta: opc(nulo(fecha)),
  informe: opc(obj({
    periodo: opc(unoO('hoy', 'ayer', 'semana', 'mes', 'todo')),
    secciones: opc(obj({ entrenos: opc(bool), comida: opc(bool), cuerpo: opc(bool), pasos: opc(bool), detalle: opc(bool) })),
  })),
})

const NUMEROS = <K extends string>(claves: readonly K[]) => obj(Object.fromEntries(claves.map(k => [k, opc(num)])) as Campos)
const MEDICION = obj({
  id: opc(id), fecha: req(fecha), origen: req(uno('casa', 'gimnasio', 'cinta', 'manual', 'otra')), pesoKg: opc(num),
  perimetros: opc(NUMEROS(['cintura', 'cuello', 'cadera', 'pecho', 'brazo', 'brazoContraido', 'muslo'])),
  bascula: opc(NUMEROS(['grasaPct', 'masaGrasaKg', 'masaLibreKg', 'musculoKg', 'musculoEsqKg', 'aguaPct', 'proteinaPct', 'oseaKg', 'visceral', 'subcutaneaPct', 'basalKcal', 'edadCorporal'])),
  hc: opc(lista(texto(300), 1000)), fuente: opc(nombre),
})

const FOTO = obj({ id: opc(id), fecha: req(fecha), pose: req(uno('frente', 'perfil', 'espalda')), imagen: opc(archivo) })

const GIMNASIO = obj({
  id: opc(id), nombre: req(nombre), notas: req(nota), material: req(lista(texto(200), 2000)),
  propias: req(lista(obj({ id: req(texto(200)), nombre: req(nombre), parecida: req(nulo(texto(200))), foto: opc(archivo), notas: opc(nota) }), 500)),
  mancuernas: req(lista(obj({ desde: req(rango(0, 1000)), hasta: req(rango(0, 1000)), paso: req(rango(0.01, 1000)) }), 100)), discos: req(lista(rango(0, 1000), 200)),
  barraKg: req(rango(0, 1000)), creado: req(fecha),
})

const PROPIO = obj({
  id: req((v, d) => (typeof v === 'string' && /^mio-[\w-]{1,100}$/.test(v) ? v : mal(d, t('no es el esperado')))), nombre: req(nombre),
  grupo: req(uno('pecho', 'espalda', 'hombro', 'brazo', 'abdomen', 'gluteo', 'pierna', 'completo')),
  material: req(uno('corporal', 'barra', 'mancuernas', 'maquina', 'polea', 'otro')), registro: req(uno('peso', 'corporal', 'tiempo', 'cardio')),
  foto: opc(archivo), notas: opc(nota), rutinaAuto: req(bool), creado: req(fecha), borrado: opc(fecha),
})

const MARCA = obj({ id: req(texto(200)), favorito: opc(bool), odiado: opc(bool), duele: opc(bool), notas: opc(nota), ajustes: opc(nombre) })

const BLOQUE = obj({
  uid: req(texto(200)), ejercicio: req(texto(200)), alternativas: req(lista(texto(200), 50)), series: req(ent(0, 50)), repsMin: req(rango(0, 10_000)), repsMax: req(rango(0, 10_000)),
  rpe: req(rango(0, 10)), descanso: req(rango(0, 36_000)), superserie: opc(texto(200)), fueraEnCorta: opc(bool), registro: req(REGISTRO),
  cargaPct: opc(rango(0.1, 1)),
})
const RUTINA = obj({
  id: opc(id), creada: req(fecha), activa: req(bool), estructura: req(nombre), porque: req(lista(nombre, 100)), calibracion: req(bool), gimnasioId: req(nulo(id)),
  dias: req(lista(obj({ letra: req(corto), nombre: req(nombre), dia: req(nulo(dia)), opcional: req(bool), bloques: req(lista(BLOQUE, 100)) }), 14)),
  equilibrio: opc(rango(0, 120)), sinCubrir: opc(lista(corto, 50)),
})

const CAMBIO = obj({ uid: req(texto(200)), letra: req(corto), zona: req(ZONA_DOLOR), antes: req(BLOQUE), despues: req(BLOQUE), deshecho: opc(bool), vuelta: opc(bool) })
const REVISION = obj({
  id: opc(id), fecha: req(fecha), estado: req(uno('bien', 'molestia', 'lesion', 'seguimiento')),
  respuestas: req(lista(obj({ zona: req(ZONA_DOLOR), va: req(uno('mejor', 'igual', 'peor', 'ya')) }), 50)), cambios: req(lista(CAMBIO, 200)),
})

const SERIE = obj({
  // Números absurdos (1e300) se recortan a los topes del entreno: la gráfica de fuerza y el PDF se quedaban sin memoria,
  // y rechazar la copia entera dejaba sin recuperar la de quien tecleó un cero de más.
  n: req(num), peso: req(nulo(acotado(-TOPE_SERIE.peso, TOPE_SERIE.peso))), reps: req(nulo(acotado(0, TOPE_SERIE.reps))),
  segundos: opc(nulo(acotado(0, TOPE_SERIE.segundos))), rpe: req(nulo(acotado(0, 10))),
  calentamiento: req(bool), hecha: req(bool), ts: opc(num), nota: opc(nota), record: opc(bool),
})
const EJ_SESION = obj({
  uid: req(texto(200)), ejercicio: req(texto(200)), planificado: req(texto(200)), motivo: opc(uno('ocupado', 'cambio')), estado: req(uno('pendiente', 'curso', 'hecho', 'saltado')), series: req(lista(SERIE, 100)),
  inicio: opc(num), fin: opc(num), repsMin: req(rango(0, 10_000)), repsMax: req(rango(0, 10_000)), rpe: req(rango(0, 10)), descanso: req(rango(0, 36_000)), superserie: opc(texto(200)),
  registro: req(REGISTRO), cargaPct: opc(rango(0.1, 1)),
})
const SESION = obj({
  id: opc(id), fecha: req(fecha), rutinaId: req(nulo(id)), letra: req(corto), nombre: req(nombre), gimnasioId: req(nulo(id)), inicio: req(num), fin: opc(num),
  horaLimite: opc(hora), version: req(uno('normal', 'corta', 'minima')), estado: req(uno('curso', 'hecha', 'cancelada')), ejercicios: req(lista(EJ_SESION, 200)), descansoHasta: opc(num), descansoTotal: opc(num),
  respuestas: opc(obj({ minutosReales: opc(num), descansos: opc(uno('cortos', 'bien', 'largos')), molestia: opc(nota), ocupado: opc(nota), nota: opc(nota) })),
  calibracion: req(bool), suave: opc(bool),
})

const COMIDA = obj({
  id: opc(id), fecha: req(fecha), hora: req(hora), franja: req(FRANJA), nombre: req(nombre), kcal: req(num), proteina: req(num), cafeina: opc(num),
  racion: req(uno('P', 'N', 'G')), tipo: req(uno('plantilla', 'producto', 'nota', 'foto', 'picoteo', 'bebida')), plantillaId: opc(id), codigo: opc(texto(100)), foto: opc(archivo), suplemento: opc(nombre), ...macros,
})
const PLANTILLA = obj({
  id: opc(id), nombre: req(nombre), kcal: req(num), proteina: req(num), cafeina: opc(num), franja: opc(FRANJA), tipo: req(uno('comida', 'picoteo', 'bebida')), usos: req(num),
  foto: opc(archivo), codigo: opc(texto(100)), ...macros,
})
/** La imagen de un producto solo puede venir de Open Food Facts (https): cualquier otra se quita. */
const imagenProducto: Regla = (v, d) => imagenOFF(texto(2000)(v, d) as string)
const PRODUCTO = obj({
  codigo: req(texto(100)), nombre: req(nombre), marca: req(nombre), imagen: opc(imagenProducto), kcal100: opc(nulo(num)), proteina100: opc(nulo(num)),
  hidratos100: opc(nulo(num)), grasas100: opc(nulo(num)), azucares100: opc(nulo(num)), sal100: opc(nulo(num)), cafeina100: opc(nulo(num)),
  racionG: opc(nulo(num)), kcalRacion: opc(nulo(num)), proteinaRacion: opc(nulo(num)), guardado: req(fecha), pendiente: opc(bool), manual: opc(bool),
})
const PASOS = obj({
  fecha: req(fecha), pasos: req(num), fuente: req(uno('auto', 'manual')), troteKm: opc(num),
  cardio: opc(lista(obj({ tipo: req(uno('caminar', 'bici', 'eliptica', 'nadar', 'correr')), min: req(rango(0, 1440)) }), 50)),
})
const SUPLEMENTOS = obj({ fecha: req(fecha), tomados: req(lista(nombre, 100)) })
const META = obj({
  id: opc(id), tipo: req(uno('cintura', 'ejercicio', 'dominadas', 'grasa', 'peso', 'libre')), titulo: req(nombre), objetivo: req(num), unidad: req(texto(100)), fecha: opc(fecha), ejercicio: opc(texto(200)),
  inicio: opc(num), hecha: opc(bool),
})

const ESQUEMA: Record<NombreTabla, Regla> = {
  perfil: PERFIL, ajustes: AJUSTES, mediciones: MEDICION, fotos: FOTO, gimnasios: GIMNASIO, marcas: MARCA, rutinas: RUTINA, sesiones: SESION,
  comidas: COMIDA, plantillas: PLANTILLA, productos: PRODUCTO, pasos: PASOS, suplementos: SUPLEMENTOS, metas: META, propios: PROPIO, revisiones: REVISION,
}
// Con tk(): se traducen al usarlos (validarDatos), no al importar.
const NOMBRE_TABLA: Record<NombreTabla, string> = {
  perfil: tk('perfil'), ajustes: tk('ajustes'), mediciones: tk('medidas'), fotos: tk('fotos'), gimnasios: tk('gimnasios'), marcas: tk('notas de ejercicios'), rutinas: tk('rutinas'),
  sesiones: tk('entrenos'), comidas: tk('comidas'), plantillas: tk('mis comidas'), productos: tk('productos'), pasos: tk('pasos'), suplementos: tk('suplementos'), metas: tk('metas'),
  propios: tk('tus ejercicios'), revisiones: tk('revisiones'),
}

/** Versión del formato de la copia que entiende esta app (2: ejercicios propios; 3: generador v2, salud y revisiones). */
export const VERSION_COPIA = 3

const OBJETIVOS_V1 = ['recomposicion', 'perder', 'fuerza']
const CAMPOS_V3 = ['objetivosExtra', 'zonasMucho', 'urgencias', 'dolores', 'condicionesSalud', 'noQuiero', 'modoMayor', 'modoRutina', 'cardioMin', 'cardioTipos', 'cardioCuando', 'progresoMovimiento', 'sueno', 'deportes', 'diaDeporte', 'experienciaPrevia']
const filas = (datos: Record<string, unknown[]>, tabla: string) => (datos[tabla] ?? []) as Fila[]
const filasDe = (x: unknown) => (Array.isArray(x) ? (x as Fila[]) : [])
/** Lo que una copia de la versión 2 no entiende (fuera del perfil): sesión mínima, cardio, equilibrio, peso rebajado. */
function datosV3(datos: Record<string, unknown[]>): boolean {
  const noti = (filas(datos, 'ajustes')[0]?.noti ?? {}) as Fila
  return !!filas(datos, 'revisiones').length
    || filas(datos, 'sesiones').some(s => s.version === 'minima' || filasDe(s.ejercicios).some(e => e.cargaPct != null))
    || filas(datos, 'pasos').some(p => filasDe(p.cardio).length > 0)
    || filas(datos, 'rutinas').some(r => r.equilibrio != null || r.sinCubrir != null || filasDe(r.dias).some(d => filasDe(d.bloques).some(b => b.cargaPct != null)))
    || noti.revision !== undefined || noti.revisionHora !== undefined
}

/**
 * La versión más baja que entiende estos datos: una app anterior pide actualizar en vez de perder sin avisar lo que
 * no conoce (los ejercicios propios, las molestias, las revisiones…).
 */
export function versionNecesaria(datos: Record<string, unknown[]>): number {
  const perfil = filas(datos, 'perfil')[0]
  const v3 = datosV3(datos) || (!!perfil && (CAMPOS_V3.some(k => perfil[k] !== undefined) || !OBJETIVOS_V1.includes(String(perfil.objetivo))))
  if (v3) return 3
  return datos.propios?.length ? 2 : 1
}

/** Comprueba la cabecera (app y versión). */
export function comprobarCabecera(obj: unknown): asserts obj is { app: 'JowyFit'; version: number; datos: unknown } {
  if (!esObjeto(obj) || obj.app !== 'JowyFit') throw new CopiaNoValida(t('El archivo no es una copia de JowyFit'))
  const v = obj.version
  if (typeof v === 'number' && Number.isInteger(v) && v > VERSION_COPIA) throw new CopiaNoValida(t('La copia es de una versión más nueva de JowyFit: actualiza la app'))
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new CopiaNoValida(t('La copia es de una versión desconocida de JowyFit'))
}

/**
 * Comprueba todos los datos de la copia. Devuelve las tablas limpias (sin campos desconocidos ni fotos de tipo raro)
 * y los archivos del zip que hacen falta. Lanza `CopiaNoValida` si algo no cuadra.
 */
/** Las tablas limpias y cuántas filas usan cada archivo de imagen (para medir lo que ocupará de verdad). */
export function validarDatos(datos: unknown): { tablas: Record<NombreTabla, Fila[]>; archivos: Map<string, number> } {
  if (!esObjeto(datos)) throw new CopiaNoValida(t('La copia está dañada: no tiene datos'))
  if (!TABLAS.some(tb => Array.isArray(datos[tb]))) throw new CopiaNoValida(t('La copia está dañada: no tiene ninguna tabla de JowyFit'))
  const tablas = {} as Record<NombreTabla, Fila[]>
  for (const tb of TABLAS) {
    const v = Object.prototype.hasOwnProperty.call(datos, tb) ? datos[tb] : undefined
    if (v == null) { tablas[tb] = []; continue }
    const nombreTabla = t(NOMBRE_TABLA[tb])
    if (!Array.isArray(v)) throw new CopiaNoValida(t('La copia está dañada ({tabla})', { tabla: nombreTabla }))
    if (v.length > LIMITES.filas) throw new CopiaNoValida(t('La copia tiene demasiados datos ({tabla})', { tabla: nombreTabla }))
    tablas[tb] = v.map((f, i) => ESQUEMA[tb](f, `${nombreTabla} ${i + 1}`) as Fila)
  }
  // Sin un perfil con el alta hecha, restaurar dejaría el móvil vacío (borra todo y no pone nada).
  if (tablas.perfil.length !== 1 || tablas.perfil[0]!.altaCompleta !== true) {
    throw new CopiaNoValida(t('La copia está vacía o incompleta: no trae tu perfil. No se ha cambiado nada.'))
  }
  if (tablas.ajustes.length > 1) throw new CopiaNoValida(t('La copia está dañada ({tabla})', { tabla: t(NOMBRE_TABLA.ajustes) }))
  // Las fotos sin imagen válida (tipo raro o archivo que falta) no se restauran: la pantalla de fotos falla con ellas.
  tablas.fotos = tablas.fotos.filter(f => f.imagen !== undefined)
  // Dos tarjetas con la misma clave (la misma zona o la misma letra) se pisan en pantalla: fuera las repetidas.
  for (const p of tablas.perfil) if (Array.isArray(p.dolores)) p.dolores = (p.dolores as Fila[]).filter((d, i, ds) => ds.findIndex(x => x.zona === d.zona) === i)
  for (const [i, r] of tablas.rutinas.entries()) {
    const letras = (r.dias as Fila[]).map(d => d.letra)
    if (new Set(letras).size !== letras.length) mal(`${t(NOMBRE_TABLA.rutinas)} ${i + 1} › dias`, t('días repetidos'))
  }
  const archivos = new Map<string, number>()
  const buscar = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(buscar); return }
    if (!esObjeto(v)) return
    if (typeof v.__archivo === 'string' && typeof v.tipo === 'string') { archivos.set(v.__archivo, (archivos.get(v.__archivo) ?? 0) + 1); return }
    Object.values(v).forEach(buscar)
  }
  buscar(tablas)
  return { tablas, archivos }
}
