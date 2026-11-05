// Escrituras del entreno: la sesión en curso, sus descansos (con el aviso del móvil) y el final.
import { db } from '../db'
import type { Bloque, DiaRutina, Gimnasio, MarcaEjercicio, Perfil, Serie, Sesion } from '../tipos'
import { gimnasioActivo, leerAjustes, leerPerfil, perfilPorDefecto, rutinaActiva } from '../repos'
import { historialDe, loQueFalta, sugerenciasDia, ultimaMedicion } from '../consultas'
import { catalogoCargado, ejercicio, hayEn, nombreEjercicio } from '../../catalogo/catalogo'
import { tipoRegistro } from '../../catalogo/clasificacion'
import { pesoReinicio, seriesSuave } from '../../dominio/descarga'
import { pesosPara } from '../../dominio/pesos'
import { esRecord } from '../../dominio/progresion'
import { apuntarSerie, bloquesDeVersion, cambiosPorMaterial, conCambio, corregirSerie, crearSesion, indiceActual, recortarACorta, type CambioMaterial, type DatosSerie } from '../../dominio/sesion'
import { diaMinimo } from '../../dominio/cola'
import { deISO, diaSemana, hoyISO, lunesDe, sumarDias } from '../../dominio/fechas'
import { alternativasDe, bloqueNuevo, patronGenerador } from '../../dominio/generador'
import { ZONA_DE_PATRON } from '../../dominio/volumen'
import { kcalSesion } from '../../dominio/energia'
import { nombreEntreno } from '../../dominio/nombres'
import { borrarEntrenoDeSalud, cancelar, guardarEntrenoEnSalud, ID_AVISO, programar } from '../../plataforma'
import { t } from '../../i18n'

const ID = ID_AVISO.descanso

/** Aviso del móvil al acabar el descanso (llega con la pantalla bloqueada); sustituye al anterior. */
function avisarFin(hasta: number, titulo: string, texto: string) {
  void programar([{ id: ID, titulo, texto, cuando: new Date(hasta) }], [ID])
}

const avisarFinDeSerie = (s: Sesion, hasta: number) =>
  avisarFin(hasta, t('Descanso terminado'), t('{ejercicio} · siguiente serie', { ejercicio: nombreEjercicio(s.ejercicios[indiceActual(s)]?.ejercicio) }))

/** Al abrir la app o volver a ella: el aviso del descanso en marcha, otra vez (Android lo borra si cierra la app a la fuerza). */
export async function reponerAvisoDescanso() {
  const s = await db.sesiones.where('estado').equals('curso').first()
  if (!s?.descansoHasta || s.descansoHasta <= Date.now()) return
  const calentando = !s.ejercicios.some(e => e.series.some(x => x.hecha))
  if (calentando) avisarFin(s.descansoHasta, t('Calentamiento terminado'), t('A por la primera serie'))
  else avisarFinDeSerie(s, s.descansoHasta)
}

export async function guardarSesion(s: Sesion) {
  await db.sesiones.put(s)
}

const PIERNA = new Set(['piernas', 'gluteo', 'gemelos'])

/** La víspera de su deporte (un partido, por ejemplo), la pierna va suave: una serie menos y esfuerzo cómodo. */
function piernaSuaveSiManana(d: DiaRutina, p: Perfil | undefined, hoy: string): DiaRutina {
  if (p?.diaDeporte == null || p.diaDeporte !== diaSemana(deISO(sumarDias(hoy, 1)))) return d
  const esPierna = (id: string) => { const e = ejercicio(id); return !!e && PIERNA.has(ZONA_DE_PATRON[patronGenerador(e)] ?? '') }
  return { ...d, bloques: d.bloques.map(b => (esPierna(b.ejercicio) ? { ...b, series: seriesSuave(b.series), rpe: Math.min(b.rpe, 7) } : b)) }
}

/**
 * En un gimnasio sin el material de algún ejercicio (otro gimnasio, o el activo tras quitarle algo): uid del bloque →
 * la alternativa que sí se puede hacer, buscada con el material de ese gimnasio. Sin catálogo, ningún cambio. Los
 * bloques son los de la versión que se hace (`bloquesDeVersion`): la misma cuenta sirve para el aviso de «Empezar».
 */
export function cambiosEnGimnasio(bloques: readonly Bloque[], g: Gimnasio, perfil: Perfil | undefined, marcas: Map<string, MarcaEjercicio>): Map<string, CambioMaterial> {
  const c = catalogoCargado()
  if (!c) return new Map()
  const material = new Set(g.material)
  const sePuede = (id: string) => { const x = ejercicio(id); return x ? hayEn(x, material) : null }
  const entrada = { perfil: perfil ?? perfilPorDefecto(), gimnasio: g, marcas, ejercicios: c.ejercicios }
  const ids = cambiosPorMaterial(bloques, sePuede, b => alternativasDe(b.ejercicio, entrada))
  const deUid = new Map(bloques.map(b => [b.uid, b]))
  return new Map([...ids].map(([uid, id]) => {
    const registro = tipoRegistro(ejercicio(id)!)
    if (registro === deUid.get(uid)?.registro) return [uid, { ejercicio: id, registro }]
    // Se apunta distinto (segundos en lugar de repeticiones): sus reps y descanso, como si se añadiera a mano.
    const { repsMin, repsMax, descanso } = bloqueNuevo(id, entrada)
    return [uid, { ejercicio: id, registro, pauta: { repsMin, repsMax, descanso } }]
  }))
}

/**
 * Crea el entreno en curso desde la rutina activa (o uno libre), en el gimnasio elegido (si no, el activo). Si ya hay
 * uno en curso, devuelve ese.
 */
export async function iniciarEntreno(o: { letra?: string; version?: Sesion['version']; horaLimite?: string; libre?: boolean; gimnasioId?: number | null }): Promise<number> {
  const ya = await db.sesiones.where('estado').equals('curso').first()
  if (ya?.id) return ya.id
  const g = (o.gimnasioId != null ? await db.gimnasios.get(o.gimnasioId) : undefined) ?? (await gimnasioActivo())
  const perfil = await leerPerfil()
  const r = await rutinaActiva()
  const horaLimite = o.horaLimite ?? (perfil ? perfil.horaLimite[perfil.transporte] : undefined)
  let s: Sesion
  if (o.libre || !r) {
    s = { fecha: hoyISO(), rutinaId: r?.id ?? null, letra: 'L', nombre: t('Entreno libre'), gimnasioId: g?.id ?? null, inicio: Date.now(), horaLimite, version: 'normal', estado: 'curso', calibracion: false, ejercicios: [] }
  } else {
    const delPlan = r.dias.find(d => d.letra === o.letra) ?? r.dias[0]!
    // El día opcional se arma con lo que falta de la semana; si no falta nada, el de la rutina.
    const elegido = delPlan.opcional ? (await loQueFalta(delPlan, r))?.dia ?? delPlan : delPlan
    // Sesión mínima: lo más importante de la que toca, a 2 series.
    const base = piernaSuaveSiManana(o.version === 'minima' ? diaMinimo(elegido) : elegido, perfil, hoyISO())
    // Semana suave aceptada en Inicio: mismos ejercicios, 1 serie menos, −10 % de peso y esfuerzo cómodo (RPE ≤ 7:
    // la descarga baja el cansancio, no solo el peso; §4.9).
    const suave = !r.calibracion && (await leerAjustes()).semanaSuave === lunesDe(hoyISO())
    const dia = suave ? { ...base, bloques: base.bloques.map(b => ({ ...b, series: seriesSuave(b.series), rpe: Math.min(b.rpe, 7) })) } : base
    // Lo que no hay en este gimnasio se cambia por su alternativa, y el peso sugerido es el de la alternativa.
    const marcas = new Map((await db.marcas.toArray()).map(m => [m.id, m]))
    // (La mínima ya viene recortada en `base`; volver a pasarla por bloquesDeVersion la deja igual.)
    const cambios = g ? cambiosEnGimnasio(bloquesDeVersion(base, o.version ?? 'normal'), g, perfil, marcas) : new Map<string, CambioMaterial>()
    const conCambios = cambios.size ? { ...base, bloques: base.bloques.map(b => { const c = cambios.get(b.uid); return c ? conCambio(b, c) : b }) } : base
    const sug = await sugerenciasDia(conCambios, g)
    const pesoDe = (id: string, peso: number | null) => {
      if (!suave || peso == null || peso <= 0) return peso
      // Si ya tocaba bajar por estancamiento (−10 %), la semana suave no baja otra vez encima.
      if (sug.get(id)?.accion === 'bajar') return peso
      const e = ejercicio(id)
      return pesoReinicio(peso, pesosPara(e?.material ?? null, e ? tipoRegistro(e) : 'peso', g))
    }
    s = crearSesion(dia, {
      rutinaId: r.id ?? null, gimnasioId: g?.id ?? null, version: o.version ?? 'normal', horaLimite, calibracion: r.calibracion, cambios,
      sugerencias: new Map([...sug].map(([k, v]) => [k, { peso: pesoDe(k, v.peso), reps: v.reps }])),
    })
    if (suave) s.suave = true
    // El sábado armado no está en la rutina: lo que se quita en la corta se apunta en la sesión para poder pasar a ella.
    if (elegido !== delPlan && s.version !== 'corta') {
      const fuera = new Set(dia.bloques.filter(b => b.fueraEnCorta).map(b => b.uid))
      for (const e of s.ejercicios) if (fuera.has(e.uid)) e.fueraEnCorta = true
    }
  }
  // Mirar y crear a la vez: dos toques a la vez no dejan dos entrenos en curso.
  return db.transaction('rw', db.sesiones, async () => {
    const otro = await db.sesiones.where('estado').equals('curso').first()
    return otro?.id ?? ((await db.sesiones.add(s)) as number)
  })
}

/** «Hecho» en la serie que toca: guarda, programa el aviso del descanso y devuelve el récord si lo es. */
export async function apuntarHecha(s: Sesion, idx: number, datos: DatosSerie, previas: Serie[]) {
  const r = apuntarSerie(s, idx, datos, previas)
  if (!r) return null
  const { sesion } = r
  if (sesion.descansoHasta) avisarFinDeSerie(sesion, sesion.descansoHasta)
  await guardarSesion(sesion)
  return r.record
}

/** Cinco minutos de calentamiento antes de la primera serie, con su aviso. */
export async function calentarAntes(id: number) {
  const s = await db.sesiones.get(id)
  if (!s) return
  const hasta = Date.now() + 300_000
  await guardarSesion({ ...s, descansoHasta: hasta, descansoTotal: 300 })
  avisarFin(hasta, t('Calentamiento terminado'), t('A por la primera serie'))
}

/** +15 s al descanso en marcha (y el aviso, a la nueva hora). */
export async function alargarDescanso(s: Sesion, segundos = 15) {
  if (!s.descansoHasta) return
  const hasta = s.descansoHasta + segundos * 1000
  await guardarSesion({ ...s, descansoHasta: hasta, descansoTotal: (s.descansoTotal ?? 0) + segundos })
  avisarFin(hasta, t('Descanso terminado'), t('Siguiente serie'))
}

/** Saltar el descanso: fuera la cuenta atrás y su aviso. */
export async function quitarDescanso(s: Sesion) {
  await guardarSesion({ ...s, descansoHasta: undefined })
  void cancelar([ID])
}

/** El descanso llegó a cero: el aviso ya salió (o está saliendo), no se cancela. */
export async function descansoCumplido(s: Sesion) {
  await guardarSesion({ ...s, descansoHasta: undefined })
}

/** Cierra el entreno sin guardarlo; si había un descanso en marcha, su aviso ya no tiene sentido. */
export async function descartarEntreno(id: number) {
  await db.sesiones.delete(id)
  void cancelar([ID])
}

export async function terminarEntreno(s: Sesion, fin: number, respuestas: Sesion['respuestas']) {
  await guardarSesion({ ...s, estado: 'hecha', fin, descansoHasta: undefined, respuestas })
  void cancelar([ID])
  // Sin esperar: Health Connect puede tardar y el entreno ya está guardado en la app.
  void entrenoASalud({ ...s, fin }).catch(() => {})
}

/**
 * Id del entreno en Health Connect. Lleva el inicio además del id de Dexie: tras «Borrar todos los datos» o al
 * reinstalar, los ids vuelven a empezar por 1 y, sin el inicio, un entreno nuevo sobrescribiría uno viejo.
 */
export const idEnSalud = (s: Pick<Sesion, 'id' | 'inicio'>) => `jowyfit-sesion-${s.id}-${s.inicio}`

/**
 * Si está activado en Ajustes, el entreno terminado va a Health Connect como sesión de fuerza, con las kcal de las
 * series hechas si se sabe el peso. El id sale de la sesión: si se manda dos veces, Health Connect no lo duplica.
 */
const enviosSalud = new Map<string, Promise<boolean>>()

export function entrenoASalud(s: Sesion & { fin: number }): Promise<boolean> {
  const id = idEnSalud(s)
  const enCurso = enviosSalud.get(id)
  if (enCurso) return enCurso
  const envio = enviarASalud(s).finally(() => { enviosSalud.delete(id) })
  enviosSalud.set(id, envio)
  return envio
}

async function enviarASalud(s: Sesion & { fin: number }): Promise<boolean> {
  if (s.id == null || !(await leerAjustes()).entrenosASalud) return false
  const peso = (await ultimaMedicion('peso'))?.pesoKg
  const kcal = peso ? kcalSesion(s, peso, id => ejercicio(id)?.met).hecho : 0
  return guardarEntrenoEnSalud({ id: idEnSalud(s), inicio: s.inicio, fin: s.fin, titulo: nombreEntreno(s), ...(kcal > 0 ? { kcal } : {}) })
}

export async function borrarSesion(id: number) {
  const s = await db.sesiones.get(id)
  await db.sesiones.delete(id)
  // Si ya estaba en Health Connect, sus kcal seguirían sumando en el reloj: se quita también allí, sin esperar.
  if (s?.estado === 'hecha') void quitarDeSalud(s).catch(() => {})
}

async function quitarDeSalud(s: Sesion) {
  const id = idEnSalud(s)
  await enviosSalud.get(id)?.catch(() => {})
  await borrarEntrenoDeSalud(id)
}

/** Corrige una serie ya hecha y vuelve a mirar si es récord frente a lo anterior. */
export async function corregirHecha(s: Sesion, idx: number, k: number, d: Omit<DatosSerie, 'rpe'>) {
  const e = s.ejercicios[idx]
  const x = e?.series[k]
  if (!e || !x || !x.hecha) return
  const hist = await historialDe(e.ejercicio, s.id)
  const previas = [...hist.flatMap(h => h.series), ...e.series.filter((y, j) => y.hecha && j < k)]
  const rec = !x.calentamiento ? esRecord({ ...x, ...d, hecha: true }, previas) : null
  await guardarSesion(corregirSerie(s, idx, k, { ...d, record: !!rec }))
}

/** Pasa el entreno a la versión corta de su día de la rutina. */
export async function pasarACorta(s: Sesion) {
  await db.transaction('rw', [db.rutinas, db.sesiones], async () => {
    const r = await db.rutinas.get(s.rutinaId ?? -1)
    await guardarSesion(recortarACorta(s, r?.dias.find(d => d.letra === s.letra)))
  })
}
