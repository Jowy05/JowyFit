// Comprobación estricta de una copia antes de tocar la base: cada campo de cada tabla con su tipo (un nombre que es
// un objeto o un id 2^53 dejan la app en blanco). Si algo no cuadra se rechaza entera, sin borrar nada.
import { imagenOFF } from '../dominio/comida'
import { TABLAS, type NombreTabla } from './db'
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
const fecha: Regla = (v, d) => (typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : mal(d, t('no es una fecha')))
const hora: Regla = (v, d) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v : mal(d, t('no es una hora')))
const num: Regla = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : mal(d, t('no es un número')))
const ent = (min: number, max: number): Regla => (v, d) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : mal(d, t('no es un número válido')))
const bool: Regla = (v, d) => (typeof v === 'boolean' ? v : mal(d, t('no es sí/no')))
const nulo = (r: Regla): Regla => (v, d) => (v === null ? null : r(v, d))
const constante = (x: string): Regla => (v, d) => (v === x ? v : mal(d, t('no es el esperado')))
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
const FRANJA = uno('desayuno', 'comida', 'merienda', 'cena')
const macros = { hidratos: opc(num), azucares: opc(num), grasas: opc(num), sal: opc(num) }

const PERFIL = obj({
  id: req(constante('yo')), creado: opc(fecha), altaCompleta: req(bool), nombre: opc(nombre), nacimiento: opc(fecha), sexo: opc(unoO('hombre', 'mujer')), alturaCm: opc(rango(0, 300)),
  objetivo: opc(unoO('recomposicion', 'perder', 'fuerza')), prioridades: opc(lista(nombre, 100)), zonasPrioridad: opc(lista(corto, 50)), nivel: opc(unoO('empiezo', 'vuelvo', 'intermedio', 'avanzado')), referencias: opc(dic(texto(200))),
  diasFijos: opc(lista(dia, 7)), diasOpcionales: opc(lista(dia, 7)), horaEntreno: opc(hora), transporte: opc(unoO('coche', 'andando')),
  horaLimite: opc(obj({ coche: req(hora), andando: req(hora) })), minutosNormal: opc(rango(0, 600)), minutosCorta: opc(rango(0, 600)), horaDormir: opc(hora), enAyunas: opc(bool),
  sesionPerdida: opc(unoO('sabado', 'saltar')), zonasSensibles: opc(lista(unoO('rodilla', 'lumbar', 'hombro', 'muneca', 'codo'), 50)), lesiones: opc(nota), condiciones: opc(nota),
  preferencia: opc(unoO('maquinas', 'libre', 'mezcla')), reps: opc(unoO('pesadas', 'moderadas', 'mezcla')),
  superseries: opc(bool), alFallo: opc(bool), core: opc(bool), cardio: opc(unoO('nada', 'pasos', 'trote')), comidasDia: opc(rango(0, 20)), franjasHambre: opc(lista(nombre, 50)),
  bebidas: opc(lista(nombre, 100)), suplementos: opc(lista(nombre, 100)), dosisSuplementos: opc(dic(texto(200))),
  batido: opc(obj({ proteina: req(num), kcal: req(num) })), trabajo: opc(unoO('sentado', 'depie', 'fisico')), pasosObjetivo: opc(rango(0, 200_000)), diasPesaje: opc(lista(dia, 7)), fotosCadaSemanas: opc(rango(0, 520)),
})

const AJUSTES = obj({
  id: req(constante('app')), gimnasioActivo: opc(nulo(id)), descansoCompuesto: opc(rango(0, 36_000)), descansoAislamiento: opc(rango(0, 36_000)), vibrar: opc(bool), sonido: opc(bool),
  pantallaEncendida: opc(bool), calentamiento: opc(bool), avisosSeguridad: opc(bool), mostrarKcal: opc(bool), kcalManual: opc(nulo(num)), proteinaManual: opc(nulo(num)),
  cafeinaLimite: opc(num), cafeinaHoraTope: opc(hora), fuentePasos: opc(unoO('auto', 'manual')), fuenteBascula: opc(unoO('auto', 'manual')), hcIgnorados: opc(lista(texto(300))),
  noti: opc(obj({
    dormir: opc(bool), pesarse: opc(bool), pesarseHora: opc(hora), batido: opc(bool), batidoHora: opc(hora), creatina: opc(bool), creatinaHora: opc(hora),
    copia: opc(bool), fotos: opc(bool), domingo: opc(bool),
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

const MARCA = obj({ id: req(texto(200)), favorito: opc(bool), odiado: opc(bool), duele: opc(bool), notas: opc(nota), ajustes: opc(nombre) })

const BLOQUE = obj({
  uid: req(texto(200)), ejercicio: req(texto(200)), alternativas: req(lista(texto(200), 50)), series: req(ent(0, 50)), repsMin: req(rango(0, 10_000)), repsMax: req(rango(0, 10_000)),
  rpe: req(rango(0, 10)), descanso: req(rango(0, 36_000)), superserie: opc(texto(200)), fueraEnCorta: opc(bool), registro: req(REGISTRO),
})
const RUTINA = obj({
  id: opc(id), creada: req(fecha), activa: req(bool), estructura: req(nombre), porque: req(lista(nombre, 100)), calibracion: req(bool), gimnasioId: req(nulo(id)),
  dias: req(lista(obj({ letra: req(corto), nombre: req(nombre), dia: req(nulo(dia)), opcional: req(bool), bloques: req(lista(BLOQUE, 100)) }), 14)),
})

const SERIE = obj({
  n: req(num), peso: req(nulo(num)), reps: req(nulo(num)), segundos: opc(nulo(num)), rpe: req(nulo(num)), calentamiento: req(bool), hecha: req(bool),
  ts: opc(num), nota: opc(nota), record: opc(bool),
})
const EJ_SESION = obj({
  uid: req(texto(200)), ejercicio: req(texto(200)), planificado: req(texto(200)), motivo: opc(uno('ocupado', 'cambio')), estado: req(uno('pendiente', 'curso', 'hecho', 'saltado')), series: req(lista(SERIE, 100)),
  inicio: opc(num), fin: opc(num), repsMin: req(rango(0, 10_000)), repsMax: req(rango(0, 10_000)), rpe: req(rango(0, 10)), descanso: req(rango(0, 36_000)), superserie: opc(texto(200)),
  registro: req(REGISTRO),
})
const SESION = obj({
  id: opc(id), fecha: req(fecha), rutinaId: req(nulo(id)), letra: req(corto), nombre: req(nombre), gimnasioId: req(nulo(id)), inicio: req(num), fin: opc(num),
  horaLimite: opc(hora), version: req(uno('normal', 'corta')), estado: req(uno('curso', 'hecha', 'cancelada')), ejercicios: req(lista(EJ_SESION, 200)), descansoHasta: opc(num), descansoTotal: opc(num),
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
const PASOS = obj({ fecha: req(fecha), pasos: req(num), fuente: req(uno('auto', 'manual')), troteKm: opc(num) })
const SUPLEMENTOS = obj({ fecha: req(fecha), tomados: req(lista(nombre, 100)) })
const META = obj({
  id: opc(id), tipo: req(uno('cintura', 'ejercicio', 'dominadas', 'grasa', 'peso', 'libre')), titulo: req(nombre), objetivo: req(num), unidad: req(texto(100)), fecha: opc(fecha), ejercicio: opc(texto(200)),
  inicio: opc(num), hecha: opc(bool),
})

const ESQUEMA: Record<NombreTabla, Regla> = {
  perfil: PERFIL, ajustes: AJUSTES, mediciones: MEDICION, fotos: FOTO, gimnasios: GIMNASIO, marcas: MARCA, rutinas: RUTINA, sesiones: SESION,
  comidas: COMIDA, plantillas: PLANTILLA, productos: PRODUCTO, pasos: PASOS, suplementos: SUPLEMENTOS, metas: META,
}
// Con tk(): se traducen al usarlos (validarDatos), no al importar.
const NOMBRE_TABLA: Record<NombreTabla, string> = {
  perfil: tk('perfil'), ajustes: tk('ajustes'), mediciones: tk('medidas'), fotos: tk('fotos'), gimnasios: tk('gimnasios'), marcas: tk('notas de ejercicios'), rutinas: tk('rutinas'),
  sesiones: tk('entrenos'), comidas: tk('comidas'), plantillas: tk('mis comidas'), productos: tk('productos'), pasos: tk('pasos'), suplementos: tk('suplementos'), metas: tk('metas'),
}

/** Versión del formato de la copia que entiende esta app. */
export const VERSION_COPIA = 1

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
export function validarDatos(datos: unknown): { tablas: Record<NombreTabla, Fila[]>; archivos: Set<string> } {
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
  const archivos = new Set<string>()
  const buscar = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(buscar); return }
    if (!esObjeto(v)) return
    if (typeof v.__archivo === 'string' && typeof v.tipo === 'string') { archivos.add(v.__archivo); return }
    Object.values(v).forEach(buscar)
  }
  buscar(tablas)
  return { tablas, archivos }
}
