// Tareas que corren mientras la app está abierta: recordatorios, pasos y copia automática.
import { db } from '../datos/db'
import { exportar, nombreCopia } from '../datos/copias'
import { guardarAjustes, leerAjustes, leerPerfil } from '../datos/repos'
import { DIAS, deISO, diaSemana, hoyISO, minutosDe, sumarDias } from '../dominio/fechas'
import { estadoSemana } from '../dominio/semana'
import { PASOS_POR_KM } from '../dominio/tendencias'
import { alVolverAPrimerPlano, esNativo, guardarArchivo, leerPasos, pasosDisponibles, programar, cancelar, type Aviso } from '../plataforma'

// Identificadores fijos de los recordatorios (el de fin de descanso es el 9001).
const ID = { dormir: 100, pesarse: 200, batido: 300, creatina: 400, copia: 500, fotos: 600, domingo: 700 }
const TODOS = [...Array.from({ length: 14 }, (_, i) => ID.dormir + i), ...Array.from({ length: 7 }, (_, i) => ID.pesarse + i), ID.batido, ID.creatina, ID.copia, ID.fotos, ID.domingo]

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
      if (cuando.getTime() > ahora) avisos.push({ id: ID.dormir + i, titulo: `Mañana: ${d.dia!.nombre}`, texto: `A las ${p.horaEntreno.replace(/^0/, '')}. En 1 h, a dormir 😴`, cuando })
    })
  }
  if (a.noti.pesarse) p.diasPesaje.forEach((dia, i) => {
    const hoyD = diaSemana(deISO(hoy))
    const fecha = sumarDias(hoy, (dia - hoyD + 7) % 7 || (enFecha(hoy, a.noti.pesarseHora).getTime() < ahora ? 7 : 0))
    avisos.push({ id: ID.pesarse + i, titulo: 'Hoy toca pesarse', texto: 'En ayunas y después del baño', cuando: enFecha(fecha, a.noti.pesarseHora), repetirCada: 'week' })
  })
  if (a.noti.batido) avisos.push({ id: ID.batido, titulo: '¿Batido de proteína?', texto: 'Te ayuda a llegar a tu proteína del día', cuando: enFecha(hoy, a.noti.batidoHora), repetirCada: 'day' })
  if (a.noti.creatina) avisos.push({ id: ID.creatina, titulo: 'La creatina de hoy', texto: '3-5 g, a cualquier hora', cuando: enFecha(hoy, a.noti.creatinaHora), repetirCada: 'day' })
  if (a.noti.copia) avisos.push({ id: ID.copia, titulo: 'Copia de seguridad', texto: 'Hace una semana de la última copia. Tus datos solo están en este móvil.', cuando: enFecha(sumarDias(hoy, 7), '20:00') })
  if (a.noti.domingo) {
    const hoyD = diaSemana(deISO(hoy))
    avisos.push({ id: ID.domingo, titulo: '¿Voy bien?', texto: 'Tu semana, en 10 segundos', cuando: enFecha(sumarDias(hoy, (6 - hoyD + 7) % 7 || 7), '19:00'), repetirCada: 'week' })
  }
  if (a.noti.fotos && p.fotosCadaSemanas > 0) avisos.push({ id: ID.fotos, titulo: 'Foto de progreso', texto: 'Misma pose y misma luz que la última', cuando: enFecha(sumarDias(hoy, p.fotosCadaSemanas * 7), '19:30') })
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

/** Copia automática semanal en Documentos/JowyFit (Android). */
export async function copiaAutomatica(): Promise<boolean> {
  const a = await leerAjustes()
  if (!a.copiaAuto || !esNativo()) return false
  if (a.ultimaCopia && Date.now() - new Date(a.ultimaCopia).getTime() < 7 * 86_400_000) return false
  if (!(await db.perfil.get('yo'))?.altaCompleta) return false
  try {
    await guardarArchivo(nombreCopia(), await exportar())
    await guardarAjustes({ ultimaCopia: new Date().toISOString() })
    return true
  } catch { return false }
}

export async function hacerCopiaAhora(): Promise<string> {
  const bytes = await exportar()
  const ruta = await guardarArchivo(nombreCopia(), bytes, 'application/zip')
  await guardarAjustes({ ultimaCopia: new Date().toISOString() })
  return ruta
}

export const NOMBRES_DIAS = DIAS

let arrancado = false
export function arrancarServicios(): () => void {
  if (arrancado) return () => {}
  arrancado = true
  const tarea = () => { void sincronizarPasos(); void copiaAutomatica(); void reprogramarNotificaciones() }
  tarea()
  let quitar = () => {}
  void alVolverAPrimerPlano(tarea).then(f => { quitar = f })
  return () => { quitar(); arrancado = false }
}
