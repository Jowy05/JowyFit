// Recordatorios del móvil (solo Android): se vuelven a programar al abrir la app y al cambiar lo que los mueve
// (horarios y seguimiento del perfil, los avisos de Ajustes).
import { db } from '../db'
import type { Ajustes, DiaRutina, Perfil, Rutina } from '../tipos'
import { guardarAjustes, guardarPerfil, leerAjustes, leerPerfil, rutinaActiva } from '../repos'
import { aISO, deISO, diaSemana, hoyISO, minutosDe, proximoAviso, sumarDias } from '../../dominio/fechas'
import { entrenosPrevistos, estadoSemana } from '../../dominio/semana'
import { colaDe, DIAS_COLA, enCola, letrasCola } from '../../dominio/cola'
import { dosisDe } from '../../dominio/comida'
import { cancelar, esNativo, ID_AVISO, programar, type Aviso } from '../../plataforma'
import { t } from '../../i18n'

// Todos los recordatorios: hasta 14 noches antes de entrenar y un día de pesaje por día de la semana.
const TODOS = [...Array.from({ length: 14 }, (_, i) => ID_AVISO.dormir + i), ...Array.from({ length: 7 }, (_, i) => ID_AVISO.pesarse + i), ID_AVISO.batido, ID_AVISO.creatina, ID_AVISO.copia, ID_AVISO.fotos, ID_AVISO.domingo, ID_AVISO.revision]

/**
 * En cola, la víspera de cada día de entreno dice la que toca por orden: la siguiente de la cola, o la de después si
 * hoy también toca y aún no se ha hecho (se cuenta con que se hará hoy).
 */
async function nombresEnCola(r: Rutina, hoy: string, n: number): Promise<DiaRutina[]> {
  const sesiones = await db.sesiones.where('fecha').between(sumarDias(hoy, -DIAS_COLA), hoy, true, true).toArray()
  const cola = colaDe(r, sesiones, hoy, letrasCola(r).length)
  if (!cola) return []
  const orden = letrasCola(r)
  const hoyToca = estadoSemana(r, sesiones, hoy).find(d => d.fecha === hoy)?.estado === 'plan'
  const desde = orden.indexOf(cola.siguiente) + (hoyToca ? 1 : 0)
  return Array.from({ length: n }, (_, k) => orden[(desde + k) % orden.length]!)
}

function enFecha(fecha: string, hhmm: string): Date {
  const d = deISO(fecha)
  const m = minutosDe(hhmm)
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d
}

/** Vuelve a programar todos los recordatorios según el perfil, la rutina y los ajustes (solo Android). */
export async function reprogramarNotificaciones(): Promise<void> {
  if (!esNativo()) return
  const [a, p, r] = await Promise.all([leerAjustes(), leerPerfil(), rutinaActiva()])
  await cancelar(TODOS)
  if (!p) return
  const avisos: Aviso[] = []
  const ahora = Date.now()
  const hoy = hoyISO()
  // 1 h antes de dormir, la víspera de cada entreno de las dos próximas semanas.
  if (a.noti.dormir && r) {
    const dias = entrenosPrevistos(r, hoy, a.recolocadas).filter(d => d.dia).slice(0, 14)
    const enOrden = enCola(p) ? await nombresEnCola(r, hoy, dias.length) : []
    dias.forEach((d, i) => {
      const vispera = sumarDias(d.fecha, -1)
      const cuando = enFecha(vispera, p.horaDormir)
      cuando.setHours(cuando.getHours() - 1)
      if (cuando.getTime() > ahora) avisos.push({ id: ID_AVISO.dormir + i, titulo: t('Mañana: {dia}', { dia: (enOrden[i] ?? d.dia!).nombre }), texto: t('A las {hora}. En 1 h, a dormir 😴', { hora: p.horaEntreno.replace(/^0/, '') }), cuando })
    })
  }
  if (a.noti.pesarse) p.diasPesaje.forEach((dia, i) => {
    const hoyD = diaSemana(deISO(hoy))
    const fecha = sumarDias(hoy, (dia - hoyD + 7) % 7 || (enFecha(hoy, a.noti.pesarseHora).getTime() < ahora ? 7 : 0))
    avisos.push({ id: ID_AVISO.pesarse + i, titulo: t('Hoy toca pesarse'), texto: t('En ayunas y después del baño'), cuando: enFecha(fecha, a.noti.pesarseHora), repetirCada: 'week' })
  })
  if (a.noti.batido) avisos.push({ id: ID_AVISO.batido, titulo: t('¿Batido de proteína?'), texto: t('Te ayuda a llegar a tu proteína del día'), cuando: enFecha(hoy, a.noti.batidoHora), repetirCada: 'day' })
  if (a.noti.creatina) avisos.push({ id: ID_AVISO.creatina, titulo: t('La creatina de hoy'), texto: t('{dosis}, a cualquier hora', { dosis: dosisDe(p.dosisSuplementos, 'Creatina') || t('Tu dosis') }), cuando: enFecha(hoy, a.noti.creatinaHora), repetirCada: 'day' })
  // La copia y la foto cuentan desde la última (o desde el alta): reprogramar al abrir la app no las aplaza.
  const alta = aISO(new Date(p.creado))
  if (a.noti.copia) {
    const desde = a.ultimaCopia ? aISO(new Date(a.ultimaCopia)) : alta
    const texto = a.ultimaCopia ? t('Hace una semana de la última copia. Tus datos solo están en este móvil.') : t('Aún no has hecho ninguna copia. Tus datos solo están en este móvil.')
    avisos.push({ id: ID_AVISO.copia, titulo: t('Copia de seguridad'), texto, cuando: proximoAviso(desde, 7, '20:00', new Date(ahora)) })
  }
  // Los dos del domingo: el resumen a las 19:00 y la revisión de molestias a su hora (19:00 si no se ha cambiado).
  const domingo = (hora: string) => {
    const fecha = sumarDias(hoy, (6 - diaSemana(deISO(hoy)) + 7) % 7)
    return enFecha(enFecha(fecha, hora).getTime() > ahora ? fecha : sumarDias(fecha, 7), hora)
  }
  if (a.noti.domingo) avisos.push({ id: ID_AVISO.domingo, titulo: t('¿Voy bien?'), texto: t('Tu semana, en 10 segundos'), cuando: domingo('19:00'), repetirCada: 'week' })
  if (a.noti.revision) avisos.push({ id: ID_AVISO.revision, titulo: t('¿Qué tal tus molestias?'), texto: t('Revisión de la semana: 20 segundos.'), cuando: domingo(a.noti.revisionHora ?? '19:00'), repetirCada: 'week' })
  if (a.noti.fotos && p.fotosCadaSemanas > 0) {
    const ultima = await db.fotos.orderBy('fecha').last()
    const desde = ultima ? ultima.fecha.slice(0, 10) : alta
    avisos.push({ id: ID_AVISO.fotos, titulo: t('Foto de progreso'), texto: t('Misma pose y misma luz que la última'), cuando: proximoAviso(desde, p.fotosCadaSemanas * 7, '19:30', new Date(ahora)) })
  }
  await programar(avisos.filter(x => x.cuando.getTime() > ahora || x.repetirCada))
}

/** Guarda cambios del perfil que mueven recordatorios (horarios, días de pesaje, fotos…) y los vuelve a programar. */
export async function guardarPerfilYAvisos(cambios: Partial<Perfil>) {
  await guardarPerfil(cambios)
  await reprogramarNotificaciones()
}

/** Enciende o apaga recordatorios (Ajustes) y los vuelve a programar. Leer y guardar, en una transacción. */
export async function guardarAvisos(cambios: Partial<Ajustes['noti']>) {
  await db.transaction('rw', db.ajustes, async () => {
    await guardarAjustes({ noti: { ...(await leerAjustes()).noti, ...cambios } })
  })
  await reprogramarNotificaciones()
}
