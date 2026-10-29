// Tareas que corren mientras la app está abierta: recordatorios, pasos y copia automática.
import { guardarLecturasBascula, guardarPasosAuto, subirMovimiento } from '../datos/acciones/cuerpo'
import { reprogramarNotificaciones } from '../datos/acciones/avisos'
import { reponerAvisoDescanso } from '../datos/acciones/entreno'
import { copiaAutomatica } from './copias'
import { buscarPendientes } from '../datos/acciones/comida'
import { leerMediciones } from '../datos/consultas'
import { guardarAjustes, leerAjustes } from '../datos/repos'
import { hoyISO, sumarDias } from '../dominio/fechas'
import { alVolverAPrimerPlano, leerBascula, leerPasos, pasosDisponibles, pedirPermisoBascula, pedirPermisosSalud, permisosSalud } from '../plataforma'
import { fechaLocal, grasaTardia, juntarBascula, lecturasNuevas, medicionDeLectura, nombreFuente } from '../dominio/bascula'
import { decimal, miles } from '../dominio/formato'
import { t, tn } from '../i18n'

/** Trae los pasos de Health Connect de los últimos 7 días (si está activado). */
export async function sincronizarPasos(): Promise<boolean> {
  const a = await leerAjustes()
  if (a.fuentePasos !== 'auto' || !(await pasosDisponibles())) return false
  try {
    const hoy = hoyISO()
    const datos = await leerPasos(sumarDias(hoy, -6), hoy)
    await guardarPasosAuto(datos)
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
    const mediciones = await leerMediciones()
    const primeraVez = !mediciones.some(m => m.hc?.length)
    const desde = new Date(Date.now() - (primeraVez ? 30 : 14) * 86_400_000)
    const { pesos, grasas } = await leerBascula(desde)
    const lecturas = juntarBascula(pesos, grasas)
    const nuevas = lecturasNuevas(lecturas, mediciones, a.hcIgnorados)
    // La grasa que llega más tarde que el peso se añade a su pesada.
    await guardarLecturasBascula(nuevas.map(medicionDeLectura), grasaTardia(lecturas, mediciones))
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
      lineas.push(t('Pasos de hoy en Health Connect: {pasos}', { pasos: p == null ? t('ninguno todavía') : miles(p) }))
    } catch { lineas.push(t('No se han podido leer los pasos.')) }
  }
  if (permisos.includes('weight') || permisos.includes('bodyFat')) {
    const { pesos, grasas } = await leerBascula(new Date(Date.now() - 30 * 86_400_000))
    const l = juntarBascula(pesos, grasas).pop()
    // Solo para probar en el móvil: el número tal cual llega, con la coma o el punto del idioma.
    lineas.push(l
      ? t('Última pesada: {datos} ({fecha}, {fuente})', {
        datos: `${l.pesoKg != null ? `${decimal(l.pesoKg)} kg` : ''}${l.grasaPct != null ? ` · ${t('{n} % grasa', { n: decimal(l.grasaPct) })}` : ''}`,
        fecha: fechaLocal(l.fecha).slice(0, 10).split('-').reverse().join('/'),
        fuente: nombreFuente(l.fuente),
      })
      : t('No hay pesadas en Health Connect de los últimos 30 días.'))
  }
  return lineas
}

let arrancado = false
export function arrancarServicios(): () => void {
  if (arrancado) return () => {}
  arrancado = true
  // Los escaneados sin conexión se buscan al abrir la app, al volver a ella y en cuanto vuelve la cobertura.
  const pendientes = () => { if (navigator.onLine) void buscarPendientes().catch(() => {}) }
  const tarea = () => {
    void sincronizarPasos(); void sincronizarBascula(); void reponerAvisoDescanso(); void subirMovimiento(); pendientes()
    // La copia automática va antes que los avisos: el de la copia cuenta desde ella.
    void copiaAutomatica().finally(() => { void reprogramarNotificaciones() })
  }
  tarea()
  addEventListener('online', pendientes)
  let quitar = () => {}
  void alVolverAPrimerPlano(tarea).then(f => { quitar = f })
  return () => { quitar(); removeEventListener('online', pendientes); arrancado = false }
}
