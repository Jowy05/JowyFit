// Tareas que corren mientras la app está abierta: recordatorios, pasos y copia automática.
import { db } from '../datos/db'
import { exportar, nombreCopia } from '../datos/copias'
import { guardarAjustes, leerAjustes, leerPerfil } from '../datos/repos'
import { deISO, diaSemana, hoyISO, minutosDe, sumarDias } from '../dominio/fechas'
import { estadoSemana } from '../dominio/semana'
import { PASOS_POR_KM } from '../dominio/tendencias'
import { alVolverAPrimerPlano, compartirArchivo, copiasGuardadas, esNativo, guardarArchivo, leerBascula, leerPasos, pasosDisponibles, pedirPermisoBascula, pedirPermisosSalud, permisosSalud, programar, cancelar, ID_AVISO, type Aviso } from '../plataforma'
import { fechaLocal, grasaTardia, juntarBascula, lecturasNuevas, medicionDeLectura, nombreFuente } from '../dominio/bascula'
import { dosisDe } from '../dominio/comida'
import { regionNumeros, t, tn } from '../i18n'

// Todos los recordatorios: hasta 14 noches antes de entrenar y un día de pesaje por día de la semana.
const TODOS = [...Array.from({ length: 14 }, (_, i) => ID_AVISO.dormir + i), ...Array.from({ length: 7 }, (_, i) => ID_AVISO.pesarse + i), ID_AVISO.batido, ID_AVISO.creatina, ID_AVISO.copia, ID_AVISO.fotos, ID_AVISO.domingo]

function enFecha(fecha: string, hhmm: string): Date {
  const d = deISO(fecha)
  const m = minutosDe(hhmm)
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d
}

/** Vuelve a programar todos los recordatorios según el perfil, la rutina y los ajustes (solo Android). */
export async function reprogramarNotificaciones(): Promise<void> {
  if (!esNativo()) return
  const [a, p, r] = await Promise.all([leerAjustes(), leerPerfil(), db.rutinas.filter(x => x.activa).last()])
  await cancelar(TODOS)
  if (!p) return
  const avisos: Aviso[] = []
  const ahora = Date.now()
  const hoy = hoyISO()
  // 1 h antes de dormir, la víspera de cada entreno de las dos próximas semanas.
  if (a.noti.dormir && r) {
    const dias = [...estadoSemana(r, [], hoy, a.recolocadas), ...estadoSemana(r, [], sumarDias(hoy, 7), a.recolocadas)].filter(d => d.estado === 'plan' && d.fecha > hoy && d.dia)
    dias.slice(0, 14).forEach((d, i) => {
      const vispera = sumarDias(d.fecha, -1)
      const cuando = enFecha(vispera, p.horaDormir)
      cuando.setHours(cuando.getHours() - 1)
      if (cuando.getTime() > ahora) avisos.push({ id: ID_AVISO.dormir + i, titulo: t('Mañana: {dia}', { dia: d.dia!.nombre }), texto: t('A las {hora}. En 1 h, a dormir 😴', { hora: p.horaEntreno.replace(/^0/, '') }), cuando })
    })
  }
  if (a.noti.pesarse) p.diasPesaje.forEach((dia, i) => {
    const hoyD = diaSemana(deISO(hoy))
    const fecha = sumarDias(hoy, (dia - hoyD + 7) % 7 || (enFecha(hoy, a.noti.pesarseHora).getTime() < ahora ? 7 : 0))
    avisos.push({ id: ID_AVISO.pesarse + i, titulo: t('Hoy toca pesarse'), texto: t('En ayunas y después del baño'), cuando: enFecha(fecha, a.noti.pesarseHora), repetirCada: 'week' })
  })
  if (a.noti.batido) avisos.push({ id: ID_AVISO.batido, titulo: t('¿Batido de proteína?'), texto: t('Te ayuda a llegar a tu proteína del día'), cuando: enFecha(hoy, a.noti.batidoHora), repetirCada: 'day' })
  if (a.noti.creatina) avisos.push({ id: ID_AVISO.creatina, titulo: t('La creatina de hoy'), texto: t('{dosis}, a cualquier hora', { dosis: dosisDe(p.dosisSuplementos, 'Creatina') || t('Tu dosis') }), cuando: enFecha(hoy, a.noti.creatinaHora), repetirCada: 'day' })
  if (a.noti.copia) avisos.push({ id: ID_AVISO.copia, titulo: t('Copia de seguridad'), texto: t('Hace una semana de la última copia. Tus datos solo están en este móvil.'), cuando: enFecha(sumarDias(hoy, 7), '20:00') })
  if (a.noti.domingo) {
    const hoyD = diaSemana(deISO(hoy))
    avisos.push({ id: ID_AVISO.domingo, titulo: t('¿Voy bien?'), texto: t('Tu semana, en 10 segundos'), cuando: enFecha(sumarDias(hoy, (6 - hoyD + 7) % 7 || 7), '19:00'), repetirCada: 'week' })
  }
  if (a.noti.fotos && p.fotosCadaSemanas > 0) avisos.push({ id: ID_AVISO.fotos, titulo: t('Foto de progreso'), texto: t('Misma pose y misma luz que la última'), cuando: enFecha(sumarDias(hoy, p.fotosCadaSemanas * 7), '19:30') })
  await programar(avisos.filter(x => x.cuando.getTime() > ahora || x.repetirCada))
}

/** Trae los pasos de Health Connect de los últimos 7 días (si está activado). */
export async function sincronizarPasos(): Promise<boolean> {
  const a = await leerAjustes()
  if (a.fuentePasos !== 'auto' || !(await pasosDisponibles())) return false
  try {
    const hoy = hoyISO()
    const datos = await leerPasos(sumarDias(hoy, -6), hoy)
    for (const [fecha, pasos] of Object.entries(datos)) {
      const prev = await db.pasos.get(fecha)
      // Health Connect da los pasos andados; el trote apuntado a mano se suma aparte.
      const trote = prev?.troteKm ? Math.round(prev.troteKm * PASOS_POR_KM) : 0
      await db.pasos.put({ fecha, pasos: pasos + trote, fuente: 'auto', troteKm: prev?.troteKm })
    }
    return true
  } catch { return false }
}

/**
 * Trae el peso y el % de grasa de la báscula desde Health Connect (si está activado): los últimos 30 días
 * la primera vez y luego las dos últimas semanas. Devuelve cuántas pesadas nuevas ha guardado.
 */
async function sincronizarBascula(): Promise<number> {
  const a = await leerAjustes()
  if (a.fuenteBascula !== 'auto' || !(await pasosDisponibles())) return 0
  try {
    const mediciones = await db.mediciones.toArray()
    const primeraVez = !mediciones.some(m => m.hc?.length)
    const desde = new Date(Date.now() - (primeraVez ? 30 : 14) * 86_400_000)
    const { pesos, grasas } = await leerBascula(desde)
    const lecturas = juntarBascula(pesos, grasas)
    const nuevas = lecturasNuevas(lecturas, mediciones, a.hcIgnorados)
    if (nuevas.length) await db.mediciones.bulkAdd(nuevas.map(medicionDeLectura))
    // La grasa que llega más tarde que el peso se añade a su pesada.
    for (const g of grasaTardia(lecturas, mediciones)) {
      await db.mediciones.where('id').equals(g.id).modify(m => { m.bascula = { ...m.bascula, grasaPct: g.grasaPct }; m.hc = [...(m.hc ?? []), ...g.ids] })
    }
    return nuevas.length
  } catch { return 0 }
}

/** Conecta la báscula: pide permiso, lo deja activado y trae lo que haya. Devuelve el aviso para el usuario. */
export async function activarBascula(): Promise<string> {
  if (!(await pedirPermisoBascula())) return t('Sin permiso de Health Connect: el peso se apunta a mano')
  await guardarAjustes({ fuenteBascula: 'auto' })
  const n = await sincronizarBascula()
  return n ? t('Báscula conectada: {pesadas}', { pesadas: pesadasTraidas(n) }) : t('Báscula conectada. Aún no hay pesadas en Health Connect: actívalo en la app de tu báscula')
}

/** Conecta Health Connect de una vez: pasos del reloj y peso y grasa de la báscula. Devuelve el aviso. */
export async function conectarSalud(): Promise<string> {
  const ok = await pedirPermisosSalud()
  const pasos = ok.includes('steps'), bascula = ok.includes('weight') || ok.includes('bodyFat')
  if (!pasos && !bascula) return t('Sin permiso de Health Connect: los pasos y el peso se apuntan a mano')
  await guardarAjustes({ ...(pasos ? { fuentePasos: 'auto' as const } : {}), ...(bascula ? { fuenteBascula: 'auto' as const } : {}) })
  if (pasos) await sincronizarPasos()
  const n = bascula ? await sincronizarBascula() : 0
  const que = pasos && bascula ? t('pasos y báscula') : pasos ? t('pasos') : t('báscula')
  return `${t('Health Connect conectado: {que}', { que })}${n ? ` · ${pesadasTraidas(n)}` : ''}`
}

const pesadasTraidas = (n: number) => tn(n, '1 pesada traída', '{n} pesadas traídas')

/** Para probar en el móvil: qué ve la app en Health Connect (permisos, pasos de hoy y la última pesada). */
export async function comprobarSalud(): Promise<string[]> {
  if (!(await pasosDisponibles())) return [t('Health Connect no está en este móvil (o no está instalado).')]
  const permisos = await permisosSalud()
  const si = (k: string) => (permisos.includes(k) ? t('sí') : t('no'))
  const lineas = [t('Permisos · pasos: {pasos} · peso: {peso} · grasa: {grasa}', { pasos: si('steps'), peso: si('weight'), grasa: si('bodyFat') })]
  if (permisos.includes('steps')) {
    try {
      const hoy = hoyISO()
      const p = (await leerPasos(hoy, hoy))[hoy]
      lineas.push(t('Pasos de hoy en Health Connect: {pasos}', { pasos: p == null ? t('ninguno todavía') : p.toLocaleString(regionNumeros()) }))
    } catch { lineas.push(t('No se han podido leer los pasos.')) }
  }
  if (permisos.includes('weight') || permisos.includes('bodyFat')) {
    const { pesos, grasas } = await leerBascula(new Date(Date.now() - 30 * 86_400_000))
    const l = juntarBascula(pesos, grasas).pop()
    // Solo para probar en el móvil: el número va con la coma o el punto del idioma.
    const dec = (v: number) => (regionNumeros() === 'en-US' ? String(v) : String(v).replace('.', ','))
    lineas.push(l
      ? t('Última pesada: {datos} ({fecha}, {fuente})', {
        datos: `${l.pesoKg != null ? `${dec(l.pesoKg)} kg` : ''}${l.grasaPct != null ? ` · ${t('{n} % grasa', { n: dec(l.grasaPct) })}` : ''}`,
        fecha: fechaLocal(l.fecha).slice(0, 10).split('-').reverse().join('/'),
        fuente: nombreFuente(l.fuente),
      })
      : t('No hay pesadas en Health Connect de los últimos 30 días.'))
  }
  return lineas
}

/**
 * Nombre libre para una copia nueva en Documentos/JowyFit: con la hora y, si ya existe, con «-2», «-3»…
 * Antes era uno por día y la copia automática (tras recuperar otra) pisaba la que se había hecho a mano.
 */
async function nombreCopiaLibre(fecha = new Date()): Promise<string> {
  const existentes = esNativo() ? (await copiasGuardadas()).map(c => c.nombre) : []
  return nombreCopia(fecha, existentes)
}

/** Copia automática semanal en Documentos/JowyFit (Android). */
export async function copiaAutomatica(): Promise<boolean> {
  const a = await leerAjustes()
  if (!a.copiaAuto || !esNativo()) return false
  if (a.ultimaCopia && Date.now() - new Date(a.ultimaCopia).getTime() < 7 * 86_400_000) return false
  if (!(await db.perfil.get('yo'))?.altaCompleta) return false
  try {
    await guardarArchivo(await nombreCopiaLibre(), await exportar())
    await guardarAjustes({ ultimaCopia: new Date().toISOString() })
    return true
  } catch { return false }
}

/** Hace la copia y devuelve el nombre del archivo (el que sale en el aviso: lleva la hora y, si hace falta, «-2»). */
export async function hacerCopiaAhora(): Promise<string> {
  const bytes = await exportar()
  const nombre = await nombreCopiaLibre()
  await guardarArchivo(nombre, bytes, 'application/zip')
  await guardarAjustes({ ultimaCopia: new Date().toISOString() })
  return nombre
}

export type CopiaPreparada = { nombre: string; bytes: Uint8Array }
/**
 * Web de Apple: la copia se guarda con el menú Compartir («Guardar en Archivos», AirDrop…) y, si el navegador no
 * comparte archivos, se descarga. Si Safari no deja abrir el menú (se tardó en preparar la copia tras el toque),
 * devuelve 'sin-gesto' con la copia ya hecha: se vuelve a llamar con ella al tocar otra vez.
 * La fecha de la última copia solo se apunta si de verdad se ha guardado o enviado.
 */
export async function copiaCompartiendo(lista?: CopiaPreparada): Promise<{ resultado: 'compartido' | 'descargado' | 'cancelado' | 'sin-gesto'; copia: CopiaPreparada }> {
  const copia = lista ?? { nombre: nombreCopia(), bytes: await exportar() }
  const r = await compartirArchivo(copia.nombre, copia.bytes, 'application/zip')
  if (r === 'cancelado' || r === 'sin-gesto') return { resultado: r, copia }
  if (r === 'no-se-puede') await guardarArchivo(copia.nombre, copia.bytes, 'application/zip')
  await guardarAjustes({ ultimaCopia: new Date().toISOString() })
  return { resultado: r === 'compartido' ? 'compartido' : 'descargado', copia }
}

let arrancado = false
export function arrancarServicios(): () => void {
  if (arrancado) return () => {}
  arrancado = true
  const tarea = () => { void sincronizarPasos(); void sincronizarBascula(); void copiaAutomatica(); void reprogramarNotificaciones() }
  tarea()
  let quitar = () => {}
  void alVolverAPrimerPlano(tarea).then(f => { quitar = f })
  return () => { quitar(); arrancado = false }
}
