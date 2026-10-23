// Recordatorios del móvil (solo Android): se vuelven a programar al abrir la app y al cambiar lo que los mueve
// (horarios y seguimiento del perfil, los avisos de Ajustes).
import { db } from '../db'
import type { Ajustes, Perfil } from '../tipos'
import { guardarAjustes, guardarPerfil, leerAjustes, leerPerfil, rutinaActiva } from '../repos'
import { deISO, diaSemana, hoyISO, minutosDe, sumarDias } from '../../dominio/fechas'
import { estadoSemana } from '../../dominio/semana'
import { dosisDe } from '../../dominio/comida'
import { cancelar, esNativo, ID_AVISO, programar, type Aviso } from '../../plataforma'
import { t } from '../../i18n'

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
  const [a, p, r] = await Promise.all([leerAjustes(), leerPerfil(), rutinaActiva()])
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
