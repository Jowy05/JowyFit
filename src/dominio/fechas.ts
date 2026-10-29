// Fechas en hora local, semanas de lunes a domingo, con los nombres en el idioma de la app.
import type { Dia } from '../datos/tipos'
import { idioma, t, type Idioma } from '../i18n'

type Siete = readonly [string, string, string, string, string, string, string]
type Doce = readonly [string, string, string, string, string, string, string, string, string, string, string, string]
type Nombres = { dias: Siete; cortos: Siete; abrev: Siete; meses: Doce; mesesCortos: Doce }

// En minúscula salvo en inglés (allí días y meses van siempre con mayúscula). Los cortos caben en un cuadradito.
const NOMBRES: Record<Idioma, Nombres> = {
  es: {
    dias: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    cortos: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    abrev: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
    meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    mesesCortos: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  },
  ca: {
    dias: ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'],
    cortos: ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'],
    abrev: ['dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.', 'dg.'],
    meses: ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'],
    mesesCortos: ['gen', 'febr', 'març', 'abr', 'maig', 'juny', 'jul', 'ag', 'set', 'oct', 'nov', 'des'],
  },
  en: {
    dias: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cortos: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    abrev: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    mesesCortos: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
}
// El idioma no cambia con la app abierta (cambiarlo recarga): se eligen una vez, al cargar.
const N = NOMBRES[idioma()]

/** Letra de cada día (L M X…; en inglés se repiten T y S: no usarlas como key de React). */
export const DIAS_CORTOS: Siete = N.cortos
export const DIAS: Siete = N.dias
/** «lun», «dl.», «Mon». */
export const DIAS_ABREV: Siete = N.abrev
export const MESES: Doce = N.meses
export const MESES_CORTOS: Doce = N.mesesCortos

const dos = (n: number) => String(n).padStart(2, '0')

export function aISO(d: Date): string {
  return `${String(d.getFullYear()).padStart(4, '0')}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}
export function deISO(s: string): Date {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(a!, (m ?? 1) - 1, d ?? 1)
}
export const hoyISO = (ahora = new Date()) => aISO(ahora)
/**
 * ¿Vale lo que da un campo de fecha? En el PC se puede teclear un año de 5 cifras («20261-01-01») y esa fecha luego
 * no deja recuperar la copia: solo AAAA-MM-DD entre 1900 y 2100.
 */
export const fechaDeCampo = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= '2100-12-31'

/** 0 = lunes … 6 = domingo */
export function diaSemana(d: Date): Dia {
  return ((d.getDay() + 6) % 7) as Dia
}

export function sumarDias(s: string, n: number): string {
  const d = deISO(s)
  d.setDate(d.getDate() + n)
  return aISO(d)
}

/**
 * El próximo aviso de algo que toca cada `dias` días contando desde `desde` (AAAA-MM-DD), a la hora `hhmm`.
 * Si ya tocaba, el siguiente de la misma serie: no se mueve por abrir la app cada día.
 */
export function proximoAviso(desde: string, dias: number, hhmm: string, ahora = new Date()): Date {
  const paso = Math.max(1, Math.round(dias))
  const a = (fecha: string) => {
    const d = deISO(fecha)
    const m = minutosDe(hhmm)
    d.setHours(Math.floor(m / 60), m % 60, 0, 0)
    return d
  }
  let fecha = sumarDias(desde, paso)
  while (a(fecha).getTime() <= ahora.getTime()) fecha = sumarDias(fecha, paso)
  return a(fecha)
}

export function lunesDe(s: string): string {
  return sumarDias(s, -diaSemana(deISO(s)))
}

export function semanaDe(s: string): string[] {
  const l = lunesDe(s)
  return Array.from({ length: 7 }, (_, i) => sumarDias(l, i))
}

export function diasEntre(a: string, b: string): number {
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86_400_000)
}

export function edad(nacimiento: string, ahora = new Date()): number {
  const n = deISO(nacimiento)
  let e = ahora.getFullYear() - n.getFullYear()
  const m = ahora.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && ahora.getDate() < n.getDate())) e--
  return e
}

export function horaActual(ahora = new Date()): string {
  return `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`
}

export function minutosDe(hhmm: string): number {
  const [h, m] = (hhmm ?? '').split(':').map(Number)
  // Una hora vacía o mal escrita cuenta como 0 en vez de NaN (NaN rompe todas las comparaciones).
  const hh = Number.isFinite(h) ? h! : 0, mm = Number.isFinite(m) ? m! : 0
  return hh * 60 + mm
}

/** «18:30»; en inglés, con AM/PM como en EE. UU. («6:30 PM»). */
export function formatoHora(hhmm: string): string {
  const [h, m] = (hhmm ?? '').split(':')
  return reloj(Number(h) || 0, (m ?? '00').padStart(2, '0'))
}
const reloj = (h: number, mm: string) => (idioma() === 'en' ? `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}` : `${h}:${mm}`)

/** «martes 13 de octubre» · «dimarts 13 d'octubre» · «Tuesday, October 13». */
export function fechaLarga(s: string): string {
  const d = deISO(s)
  const dia = DIAS[diaSemana(d)], mes = MESES[d.getMonth()]!
  if (idioma() === 'en') return `${dia}, ${mes} ${d.getDate()}`
  if (idioma() === 'ca') return `${dia} ${d.getDate()} ${/^[aeiouàèéíòóú]/i.test(mes) ? "d'" : 'de '}${mes}`
  return `${dia} ${d.getDate()} de ${mes}`
}

/** Día y mes corto en el orden del idioma: «13 oct» · «Oct 13». mes: 0 = enero. */
export function diaMes(dia: number, mes: number): string {
  const m = MESES_CORTOS[mes] ?? ''
  return idioma() === 'en' ? `${m} ${dia}` : `${dia} ${m}`
}

export function fechaCorta(s: string): string {
  const d = deISO(s)
  return diaMes(d.getDate(), d.getMonth())
}

/** Mes y año: «abril 2027» (en inglés, «April 2027»). Como etiqueta suelta, con capital(): «Abril 2027». */
export function mesAnio(s: string): string {
  const d = deISO(s)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

/** «5:31» a partir de una marca de tiempo («5:31 AM» en inglés). */
export function horaDe(ts: number): string {
  const d = new Date(ts)
  return reloj(d.getHours(), dos(d.getMinutes()))
}

/** Duración «54:12» o «1:02:05». */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return h ? `${h}:${dos(m)}:${dos(x)}` : `${m}:${dos(x)}`
}

export function saludo(ahora = new Date()): string {
  const h = ahora.getHours()
  if (h < 6) return t('Buenos días')
  if (h < 14) return t('Buenos días')
  if (h < 21) return t('Buenas tardes')
  return t('Buenas noches')
}

/** Número de semana desde una fecha de inicio (1 = la primera). */
export function numeroSemana(inicio: string, s: string): number {
  return Math.floor(diasEntre(lunesDe(inicio), lunesDe(s)) / 7) + 1
}
