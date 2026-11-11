// Aviso del fin del descanso (y del calentamiento), con su cuenta atrás mientras dura.
import { registerPlugin } from '@capacitor/core'
import { t } from '../i18n'
import { esAndroid, esNativo } from './dispositivo'
import { enFila, permisoNotificaciones, programarEnCanal, type Canal } from './avisos'

/**
 * En Android lo programa un plugin propio (android/app/…/AvisoDescanso.java) como alarma de reloj, con un servicio en
 * primer plano para la cuenta atrás: con la app en segundo plano o el móvil en reposo, las alarmas del plugin de
 * notificaciones llegaban tarde o no llegaban. El plugin pone también los canales, los ids y el color.
 */
type PluginDescanso = {
  programar(o: { hasta: number; titulo: string; texto: string; durante: string }): Promise<void>
  cancelar(): Promise<void>
  segundoPlano(): Promise<{ permitido: boolean }>
  pedirSegundoPlano(): Promise<void>
}
const plugin = registerPlugin<PluginDescanso>('AvisoDescanso')

/**
 * Reserva para un APK antiguo con la web nueva (sin el plugin): el aviso va por el de notificaciones, sin cuenta
 * atrás. Este id es solo de la reserva; fuera de los de ID_AVISO.
 */
const ID_RESERVA = 9001
const canalReserva = (): Canal => ({ id: 'descanso', name: t('Fin del descanso'), description: t('Avisa cuando toca la siguiente serie (también en el reloj)'), importance: 5, visibility: 1, vibration: true })

/** `durante`: título de la cuenta atrás que se ve hasta `hasta` («Descansando», «Calentando»). Sustituye al anterior. */
export type AvisoDescanso = { hasta: number; titulo: string; texto: string; durante: string }

export function avisarDescanso(a: AvisoDescanso): Promise<void> {
  return enFila(async () => {
    if (!(await permisoNotificaciones(false))) return
    if (esAndroid() && (await plugin.programar(a).then(() => true, () => false))) return
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: ID_RESERVA }] })
    await programarEnCanal(LocalNotifications, canalReserva(), [{ id: ID_RESERVA, titulo: a.titulo, texto: a.texto, cuando: new Date(a.hasta) }])
  })
}

/** Quita la cuenta atrás, la alarma y el aviso si ya ha salido. */
export function quitarAvisoDescanso(): Promise<void> {
  return enFila(async () => {
    if (!esNativo()) return
    if (esAndroid()) await plugin.cancelar().catch(() => {})
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: ID_RESERVA }] })
  })
}

/**
 * Si la app está fuera del ahorro de batería de Android: si no, algunos móviles (Nubia, Xiaomi…) la duermen con la
 * pantalla bloqueada y los avisos no llegan. null = no aplica (no es Android o el APK no tiene el plugin).
 */
export async function avisosEnReposo(): Promise<boolean | null> {
  if (!esAndroid()) return null
  return plugin.segundoPlano().then(r => r.permitido, () => null)
}

export async function pedirAvisosEnReposo(): Promise<void> {
  if (esAndroid()) await plugin.pedirSegundoPlano().catch(() => {})
}
