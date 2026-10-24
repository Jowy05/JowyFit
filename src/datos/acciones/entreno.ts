// Escrituras del entreno: la sesión en curso, sus descansos (con el aviso del móvil) y el final.
import { db } from '../db'
import type { Serie, Sesion } from '../tipos'
import { gimnasioActivo, leerAjustes, leerPerfil, rutinaActiva } from '../repos'
import { historialDe, sugerenciasDia } from '../consultas'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { tipoRegistro } from '../../catalogo/clasificacion'
import { pesoReinicio, seriesSuave } from '../../dominio/descarga'
import { pesosPara } from '../../dominio/pesos'
import { esRecord } from '../../dominio/progresion'
import { apuntarSerie, corregirSerie, crearSesion, indiceActual, recortarACorta } from '../../dominio/sesion'
import { hoyISO, lunesDe } from '../../dominio/fechas'
import { cancelar, ID_AVISO, programar } from '../../plataforma'
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

/** Crea el entreno en curso desde la rutina activa (o uno libre). Si ya hay uno en curso, devuelve ese. */
export async function iniciarEntreno(o: { letra?: string; version?: 'normal' | 'corta'; horaLimite?: string; libre?: boolean }): Promise<number> {
  const ya = await db.sesiones.where('estado').equals('curso').first()
  if (ya?.id) return ya.id
  const g = await gimnasioActivo()
  const perfil = await leerPerfil()
  const r = await rutinaActiva()
  const horaLimite = o.horaLimite ?? (perfil ? perfil.horaLimite[perfil.transporte] : undefined)
  let s: Sesion
  if (o.libre || !r) {
    s = { fecha: hoyISO(), rutinaId: r?.id ?? null, letra: 'L', nombre: t('Entreno libre'), gimnasioId: g?.id ?? null, inicio: Date.now(), horaLimite, version: 'normal', estado: 'curso', calibracion: false, ejercicios: [] }
  } else {
    const base = r.dias.find(d => d.letra === o.letra) ?? r.dias[0]!
    // Semana suave aceptada en Inicio: mismos ejercicios, 1 serie menos y −10 % de peso.
    const suave = !r.calibracion && (await leerAjustes()).semanaSuave === lunesDe(hoyISO())
    const dia = suave ? { ...base, bloques: base.bloques.map(b => ({ ...b, series: seriesSuave(b.series) })) } : base
    const sug = await sugerenciasDia(base, g)
    const pesoDe = (id: string, peso: number | null) => {
      if (!suave || peso == null || peso <= 0) return peso
      // Si ya tocaba bajar por estancamiento (−10 %), la semana suave no baja otra vez encima.
      if (sug.get(id)?.accion === 'bajar') return peso
      const e = ejercicio(id)
      return pesoReinicio(peso, pesosPara(e?.material ?? null, e ? tipoRegistro(e) : 'peso', g))
    }
    s = crearSesion(dia, {
      rutinaId: r.id ?? null, gimnasioId: g?.id ?? null, version: o.version ?? 'normal', horaLimite, calibracion: r.calibracion,
      sugerencias: new Map([...sug].map(([k, v]) => [k, { peso: pesoDe(k, v.peso), reps: v.reps }])),
    })
    if (suave) s.suave = true
  }
  // Mirar y crear a la vez: dos toques a la vez no dejan dos entrenos en curso.
  return db.transaction('rw', db.sesiones, async () => {
    const otro = await db.sesiones.where('estado').equals('curso').first()
    return otro?.id ?? ((await db.sesiones.add(s)) as number)
  })
}

/** «Hecho» en la serie que toca: guarda, programa el aviso del descanso y devuelve el récord si lo es. */
export async function apuntarHecha(s: Sesion, idx: number, datos: Pick<Serie, 'peso' | 'reps' | 'rpe' | 'segundos'>, previas: Serie[]) {
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
}

export async function borrarSesion(id: number) {
  await db.sesiones.delete(id)
}

/** Corrige una serie ya hecha y vuelve a mirar si es récord frente a lo anterior. */
export async function corregirHecha(s: Sesion, idx: number, k: number, d: Pick<Serie, 'peso' | 'reps' | 'segundos'>) {
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
