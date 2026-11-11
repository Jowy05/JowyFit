// Notificaciones locales (solo Android): permiso, canales, programar y cancelar.
import { t } from '../i18n'
import { esNativo } from './dispositivo'

type LN = typeof import('@capacitor/local-notifications').LocalNotifications
export type Canal = Parameters<LN['createChannel']>[0]

/** «dormir» y «pesarse» son el primero de una serie (uno por entreno o por día de pesaje). El del descanso va aparte (avisoDescanso.ts). */
export const ID_AVISO = { dormir: 100, pesarse: 200, batido: 300, creatina: 400, copia: 500, fotos: 600, domingo: 700, revision: 800 } as const

export type Aviso = { id: number; titulo: string; texto: string; cuando: Date; repetirCada?: 'day' | 'week' }

export async function permisoNotificaciones(pedir: boolean): Promise<boolean> {
  if (!esNativo()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let p = await LocalNotifications.checkPermissions()
  if (p.display !== 'granted' && pedir) p = await LocalNotifications.requestPermissions()
  return p.display === 'granted'
}

// Todas las llamadas (también las del descanso) van en fila: si «Saltar» llega antes de que acabe de programarse el
// aviso del descanso, el aviso quedaría puesto y el reloj vibraría en mitad de la serie.
let fila: Promise<unknown> = Promise.resolve()
export function enFila<T>(f: () => Promise<T>): Promise<T> {
  const r = fila.then(f, f)
  fila = r.catch(() => {})
  return r
}

const canalesCreados = new Set<string>()

/** Programa los avisos por su canal (lo crea la primera vez). Sin permiso de notificaciones no hace nada. */
export async function programarEnCanal(ln: LN, canal: Canal, avisos: Aviso[]) {
  if (!avisos.length || !(await permisoNotificaciones(false))) return
  if (!canalesCreados.has(canal.id)) {
    canalesCreados.add(canal.id)
    await ln.createChannel(canal).catch(() => {})
  }
  // Solo se piden alarmas exactas si el sistema ya las permite: si no, el plugin abriría
  // la pantalla de «Alarmas y recordatorios» sin avisar. Un recordatorio inexacto llega igual.
  const exacta = await ln.checkExactNotificationSetting().then(s => s.exact_alarm === 'granted').catch(() => false)
  await ln.schedule({
    notifications: avisos.map(a => ({
      id: a.id, title: a.titulo, body: a.texto, isExactNotification: exacta,
      schedule: a.repetirCada ? { on: a.repetirCada === 'day' ? { hour: a.cuando.getHours(), minute: a.cuando.getMinutes() } : { weekday: a.cuando.getDay() + 1, hour: a.cuando.getHours(), minute: a.cuando.getMinutes() }, allowWhileIdle: true } : { at: a.cuando, allowWhileIdle: true },
      // El morado del logo (en Android, R.color.morado).
      smallIcon: 'ic_stat_jowyfit', iconColor: '#7F26FB',
      channelId: canal.id,
    })),
  })
}

const recordatorios = (): Canal => ({ id: 'recordatorios', name: t('Recordatorios'), description: t('Dormir, pesarse, suplementos, copias…'), importance: 3, visibility: 1, vibration: true })

export function programar(avisos: Aviso[], borrarIds: number[] = []): Promise<void> {
  return enFila(async () => {
    if (!esNativo()) return
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (borrarIds.length) await LocalNotifications.cancel({ notifications: borrarIds.map(id => ({ id })) })
    await programarEnCanal(LocalNotifications, recordatorios(), avisos)
  })
}

export function cancelar(ids: number[]): Promise<void> {
  return enFila(async () => {
    if (!esNativo() || !ids.length) return
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) })
  })
}

/** Al tocar un aviso: `fn` recibe su id (para abrir lo suyo). Devuelve cómo dejar de escuchar. */
export async function alTocarAviso(fn: (id: number) => void): Promise<() => void> {
  if (!esNativo()) return () => {}
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const h = await LocalNotifications.addListener('localNotificationActionPerformed', a => fn(a.notification.id))
  return () => { void h.remove() }
}
