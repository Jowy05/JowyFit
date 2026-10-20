// Fechas y horas en español: textos que se ven en la app (fecha larga y corta, duración, saludo…)
// y casos límite (cambio de hora, medianoche, fin de mes, bisiestos, datos raros).
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import {
  DIAS, DIAS_CORTOS, MESES, MESES_CORTOS, aISO, deISO, diaSemana, diasEntre, duracion, edad, fechaCorta, fechaLarga, formatoHora,
  horaActual, horaDe, hoyISO, lunesDe, minutosDe, numeroSemana, saludo, semanaDe, sumarDias,
} from '../src/dominio/fechas'

describe('nombres de días y meses', () => {
  it('7 días empezando en lunes y 12 meses, en minúscula', () => {
    expect(DIAS).toHaveLength(7)
    expect(DIAS[0]).toBe('lunes')
    expect(DIAS[6]).toBe('domingo')
    expect(DIAS_CORTOS.join('')).toBe('LMXJVSD')
    expect(MESES).toHaveLength(12)
    expect(MESES_CORTOS).toHaveLength(12)
    expect(MESES[9]).toBe('octubre')
    expect(MESES_CORTOS[11]).toBe('dic')
  })
})

describe('hoy, aISO y deISO', () => {
  it('hoyISO usa la hora local, no la UTC (a las 00:30 de Madrid sigue siendo hoy)', () => {
    // 00:30 en Madrid = 22:30 UTC del día anterior.
    expect(hoyISO(new Date(2026, 9, 14, 0, 30))).toBe('2026-10-14')
    expect(hoyISO(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13')
    expect(aISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('deISO acepta fechas con hora y fechas incompletas sin romper', () => {
    expect(aISO(deISO('2026-10-13T07:05'))).toBe('2026-10-13')
    expect(aISO(deISO('2026-10'))).toBe('2026-10-01')
    expect(deISO('2026-10-13').getHours()).toBe(0)
  })
  it('bisiestos y fin de mes', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(sumarDias('2027-02-28', 1)).toBe('2027-03-01')
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(sumarDias('2026-10-13', 0)).toBe('2026-10-13')
  })
  it('diasEntre al revés da negativo y en el mismo día 0', () => {
    expect(diasEntre('2026-10-20', '2026-10-13')).toBe(-7)
    expect(diasEntre('2026-10-13', '2026-10-13')).toBe(0)
    // Con hora en la cadena solo cuenta el día.
    expect(diasEntre('2026-10-13T23:59', '2026-10-14T00:01')).toBe(1)
  })
  it('lunes de una semana del cambio de hora y un domingo', () => {
    expect(lunesDe('2026-10-25')).toBe('2026-10-19') // domingo del cambio de hora
    expect(lunesDe('2026-03-29')).toBe('2026-03-23')
    expect(lunesDe('2026-10-19')).toBe('2026-10-19')
    expect(semanaDe('2026-10-25')[6]).toBe('2026-10-25')
    expect(diaSemana(new Date(2026, 9, 25))).toBe(6)
  })
  it('número de semana: misma semana = 1, y antes del inicio da ≤ 0', () => {
    expect(numeroSemana('2026-10-14', '2026-10-18')).toBe(1)
    expect(numeroSemana('2026-10-14', '2026-10-12')).toBe(1) // el mismo lunes
    expect(numeroSemana('2026-10-14', '2026-10-05')).toBe(0)
  })
})

describe('edad', () => {
  it('cumple hoy, mañana o ayer', () => {
    const hoy = new Date(2026, 9, 13)
    expect(edad('2005-10-13', hoy)).toBe(21)
    expect(edad('2005-10-14', hoy)).toBe(20)
    expect(edad('2005-10-12', hoy)).toBe(21)
    expect(edad('2005-11-01', hoy)).toBe(20)
  })
  it('nacido un 29 de febrero: hasta el 1 de marzo no cumple en años normales', () => {
    expect(edad('2004-02-29', new Date(2025, 1, 28))).toBe(20)
    expect(edad('2004-02-29', new Date(2025, 2, 1))).toBe(21)
    expect(edad('2004-02-29', new Date(2028, 1, 29))).toBe(24)
  })
})

describe('horas', () => {
  it('horaActual con dos cifras', () => {
    expect(horaActual(new Date(2026, 9, 13, 5, 7))).toBe('05:07')
    expect(horaActual(new Date(2026, 9, 13, 23, 59))).toBe('23:59')
    expect(horaActual(new Date(2026, 9, 13, 0, 0))).toBe('00:00')
  })
  it('minutosDe: medianoche, final del día y valores raros', () => {
    expect(minutosDe('00:00')).toBe(0)
    expect(minutosDe('23:59')).toBe(1439)
    expect(minutosDe('5:30')).toBe(330)
    expect(minutosDe('7')).toBe(420)
    expect(minutosDe(undefined as unknown as string)).toBe(0)
    expect(minutosDe(':30')).toBe(30)
  })
  it('formatoHora quita el cero de delante y respeta los minutos', () => {
    expect(formatoHora('00:05')).toBe('0:05')
    expect(formatoHora('12:00')).toBe('12:00')
    expect(formatoHora(undefined as unknown as string)).toBe('0:00')
    expect(formatoHora('6:5')).toBe('6:05')
  })
  it('horaDe: la hora de una marca de tiempo, sin cero delante en la hora', () => {
    expect(horaDe(new Date(2026, 9, 13, 5, 31).getTime())).toBe('5:31')
    expect(horaDe(new Date(2026, 9, 13, 17, 3).getTime())).toBe('17:03')
    // El día del cambio de hora (25/10: a las 3 vuelven a ser las 2).
    expect(horaDe(new Date(2026, 9, 25, 12, 0).getTime())).toBe('12:00')
  })
})

describe('duración', () => {
  it('minutos y segundos o, pasada la hora, con horas', () => {
    expect(duracion(0)).toBe('0:00')
    expect(duracion(59)).toBe('0:59')
    expect(duracion(60)).toBe('1:00')
    expect(duracion(54 * 60 + 12)).toBe('54:12')
    expect(duracion(3600)).toBe('1:00:00')
    expect(duracion(3725)).toBe('1:02:05')
  })
  it('redondea y nunca sale negativa ni NaN raro', () => {
    expect(duracion(59.6)).toBe('1:00')
    expect(duracion(-30)).toBe('0:00')
  })
})

describe('textos de fecha', () => {
  it('fecha larga y corta en español', () => {
    expect(fechaLarga('2026-10-13')).toBe('martes 13 de octubre')
    expect(fechaLarga('2026-10-25')).toBe('domingo 25 de octubre')
    expect(fechaLarga('2027-01-01')).toBe('viernes 1 de enero')
    expect(fechaCorta('2026-10-13')).toBe('13 oct')
    expect(fechaCorta('2026-03-01T08:00')).toBe('1 mar')
  })
})

describe('saludo', () => {
  it('días hasta las 14, tardes hasta las 21 y noches después (de madrugada, «Buenos días» para el entreno de las 5)', () => {
    expect(saludo(new Date(2026, 9, 13, 5, 20))).toBe('Buenos días')
    expect(saludo(new Date(2026, 9, 13, 0, 10))).toBe('Buenos días')
    expect(saludo(new Date(2026, 9, 13, 13, 59))).toBe('Buenos días')
    expect(saludo(new Date(2026, 9, 13, 14, 0))).toBe('Buenas tardes')
    expect(saludo(new Date(2026, 9, 13, 20, 59))).toBe('Buenas tardes')
    expect(saludo(new Date(2026, 9, 13, 21, 0))).toBe('Buenas noches')
  })
})
