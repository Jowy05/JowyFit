// Fechas en hora local, semanas de lunes a domingo, en español.
import type { Dia } from '../datos/tipos'

export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

const dos = (n: number) => String(n).padStart(2, '0')

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}
export function deISO(s: string): Date {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(a!, (m ?? 1) - 1, d ?? 1)
}
export const hoyISO = (ahora = new Date()) => aISO(ahora)

/** 0 = lunes … 6 = domingo */
export function diaSemana(d: Date): Dia {
  return ((d.getDay() + 6) % 7) as Dia
}

export function sumarDias(s: string, n: number): string {
  const d = deISO(s)
  d.setDate(d.getDate() + n)
  return aISO(d)
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
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function formatoHora(hhmm: string): string {
  const [h, m] = hhmm.split(':')
  return `${Number(h)}:${m}`
}

export function fechaLarga(s: string): string {
  const d = deISO(s)
  return `${DIAS[diaSemana(d)]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export function fechaCorta(s: string): string {
  const d = deISO(s)
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

/** «5:31» a partir de una marca de tiempo. */
export function horaDe(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours()}:${dos(d.getMinutes())}`
}

/** Duración «54:12» o «1:02:05». */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return h ? `${h}:${dos(m)}:${dos(x)}` : `${m}:${dos(x)}`
}

export function saludo(ahora = new Date()): string {
  const h = ahora.getHours()
  if (h < 6) return 'Buenos días'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Número de semana desde una fecha de inicio (1 = la primera). */
export function numeroSemana(inicio: string, s: string): number {
  return Math.floor(diasEntre(lunesDe(inicio), lunesDe(s)) / 7) + 1
}
