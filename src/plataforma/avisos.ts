// Notificaciones locales (solo Android): permiso, canales, programar y cancelar.
import { registerPlugin } from '@capacitor/core'
import { t } from '../i18n'
import { esAndroid, esNativo } from './dispositivo'

/**
 * «dormir» y «pesarse» son el primero de una serie (uno por entreno o por día de pesaje).
 * El del descanso sirve también para el calentamiento: va por su propio canal, con vibración, para que llegue al reloj.
 */
export const ID_AVISO = { dormir: 100, pesarse: 200, batido: 300, creatina: 400, copia: 500, fotos: 600, domingo: 700, revision: 800, descanso: 9001 } as const

/** `durante`: título de la cuenta atrás que se ve mientras tanto (solo el del descanso, en Android). */
export type Aviso = { id: number; titulo: string; texto: string; cuando: Date; repetirCada?: 'day' | 'week'; durante?: string }

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
  await ln.createChannel({ id: 'descanso_curso', name: t('Descanso en curso'), description: t('Cuenta atrás del descanso, sin sonido'), importance: 2, visibility: 1, vibration: false }).catch(() => {})
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

/**
 * En Android el del descanso lo programa un plugin propio (android/app/…/AvisoDescanso.java) como alarma de reloj:
 * con la app en segundo plano o el móvil en reposo, las alarmas del plugin de notificaciones llegaban tarde o no
 * llegaban. Usa el mismo id, así que cancelar cualquiera de los dos quita también la notificación ya salida.
 */
type PluginDescanso = {
  programar(o: { hasta: number; titulo: string; texto: string; durante: string }): Promise<void>
  cancelar(): Promise<void>
  segundoPlano(): Promise<{ permitido: boolean }>
  pedirSegundoPlano(): Promise<void>
}
const AvisoDescanso = registerPlugin<PluginDescanso>('AvisoDescanso')
const porAlarmaDeReloj = () => esAndroid()

async function programarYa(avisos: Aviso[], borrarIds: number[]) {
  if (!esNativo()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  if (borrarIds.length) await quitar(LocalNotifications, borrarIds)
  if (!avisos.length) return
  if (!(await permisoNotificaciones(false))) return
  await crearCanales(LocalNotifications)
  const descanso = porAlarmaDeReloj() ? avisos.find(a => a.id === ID_AVISO.descanso) : undefined
  if (descanso) {
    const ok = await AvisoDescanso.programar({ hasta: descanso.cuando.getTime(), titulo: descanso.titulo, texto: descanso.texto, durante: descanso.durante ?? '' }).then(() => true, () => false)
    // Si el plugin no está (un APK antiguo con la web nueva), va por el camino de siempre.
    if (ok) avisos = avisos.filter(a => a !== descanso)
    if (!avisos.length) return
  }
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
    await quitar((await import('@capacitor/local-notifications')).LocalNotifications, ids)
  })
}

async function quitar(ln: typeof import('@capacitor/local-notifications').LocalNotifications, ids: number[]) {
  if (porAlarmaDeReloj() && ids.includes(ID_AVISO.descanso)) await AvisoDescanso.cancelar().catch(() => {})
  await ln.cancel({ notifications: ids.map(id => ({ id })) })
}

/**
 * Si la app está fuera del ahorro de batería de Android: si no, algunos móviles (Nubia, Xiaomi…) la duermen con la
 * pantalla bloqueada y los avisos no llegan. null = no aplica (no es Android o el APK no tiene el plugin).
 */
export async function avisosEnReposo(): Promise<boolean | null> {
  if (!porAlarmaDeReloj()) return null
  return AvisoDescanso.segundoPlano().then(r => r.permitido, () => null)
}

export async function pedirAvisosEnReposo(): Promise<void> {
  if (porAlarmaDeReloj()) await AvisoDescanso.pedirSegundoPlano().catch(() => {})
}

/** Al tocar un aviso: `fn` recibe su id (para abrir lo suyo). Devuelve cómo dejar de escuchar. */
export async function alTocarAviso(fn: (id: number) => void): Promise<() => void> {
  if (!esNativo()) return () => {}
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const h = await LocalNotifications.addListener('localNotificationActionPerformed', a => fn(a.notification.id))
  return () => { void h.remove() }
}
