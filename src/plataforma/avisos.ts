// Notificaciones locales (solo Android): permiso, canales, programar y cancelar.
import { t } from '../i18n'
import { esNativo } from './dispositivo'

/**
 * «dormir» y «pesarse» son el primero de una serie (uno por entreno o por día de pesaje).
 * El del descanso sirve también para el calentamiento: va por su propio canal, con vibración, para que llegue al reloj.
 */
export const ID_AVISO = { dormir: 100, pesarse: 200, batido: 300, creatina: 400, copia: 500, fotos: 600, domingo: 700, revision: 800, descanso: 9001 } as const

export type Aviso = { id: number; titulo: string; texto: string; cuando: Date; repetirCada?: 'day' | 'week' }

export async function permisoNotificaciones(pedir: boolean): Promise<boolean> {
  if (!esNativo()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let p = await LocalNotifications.checkPermissions()
  if (p.display !== 'granted' && pedir) p = await LocalNotifications.requestPermissions()
  return p.display === 'granted'
}

let canales = false
async function crearCanales(ln: typeof import('@capacitor/local-notifications').LocalNotifications) {
  if (canales) return
  canales = true
  await ln.createChannel({ id: 'descanso', name: t('Fin del descanso'), description: t('Avisa cuando toca la siguiente serie (también en el reloj)'), importance: 5, visibility: 1, vibration: true }).catch(() => {})
  await ln.createChannel({ id: 'recordatorios', name: t('Recordatorios'), description: t('Dormir, pesarse, suplementos, copias…'), importance: 3, visibility: 1, vibration: true }).catch(() => {})
}

// Todas las llamadas van en fila: si «Saltar» (cancelar) llega antes de que acabe de programarse el aviso de
// descanso, el aviso quedaría puesto y el reloj vibraría en mitad de la serie.
let fila: Promise<unknown> = Promise.resolve()
function enFila<T>(f: () => Promise<T>): Promise<T> {
  const r = fila.then(f, f)
  fila = r.catch(() => {})
  return r
}

export function programar(avisos: Aviso[], borrarIds: number[] = []): Promise<void> {
  return enFila(() => programarYa(avisos, borrarIds))
}

async function programarYa(avisos: Aviso[], borrarIds: number[]) {
  if (!esNativo()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  if (borrarIds.length) await LocalNotifications.cancel({ notifications: borrarIds.map(id => ({ id })) })
  if (!avisos.length) return
  if (!(await permisoNotificaciones(false))) return
  await crearCanales(LocalNotifications)
  // Solo se piden alarmas exactas si el sistema ya las permite: si no, el plugin abriría
  // la pantalla de «Alarmas y recordatorios» sin avisar. Un recordatorio inexacto llega igual.
  const exacta = await LocalNotifications.checkExactNotificationSetting().then(s => s.exact_alarm === 'granted').catch(() => false)
  await LocalNotifications.schedule({
    notifications: avisos.map(a => ({
      id: a.id, title: a.titulo, body: a.texto, isExactNotification: exacta,
      schedule: a.repetirCada ? { on: a.repetirCada === 'day' ? { hour: a.cuando.getHours(), minute: a.cuando.getMinutes() } : { weekday: a.cuando.getDay() + 1, hour: a.cuando.getHours(), minute: a.cuando.getMinutes() }, allowWhileIdle: true } : { at: a.cuando, allowWhileIdle: true },
      smallIcon: 'ic_stat_jowyfit', iconColor: '#7F26FB',
      channelId: a.id === ID_AVISO.descanso ? 'descanso' : 'recordatorios',
    })),
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
