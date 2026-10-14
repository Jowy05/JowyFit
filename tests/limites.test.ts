// Casos límite de fechas (cambio de hora en Europa/Madrid, fin de año), cálculos, tiempos,
// sesión en curso y semana. Cada bloque «fallaba» marca un error que se arregló.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { aISO, deISO, diaSemana, diasEntre, formatoHora, lunesDe, minutosDe, numeroSemana, semanaDe, sumarDias } from '../src/dominio/fechas'
import { epley, grasaMarina, imc, kg, num } from '../src/dominio/calculos'
import { estadoHora, restanteEjercicio, restanteSesion } from '../src/dominio/tiempos'
import { anadirCalentamiento, crearSesion, hecha, mover, quitarSerie, saltar, sustituir } from '../src/dominio/sesion'
import { estadoSemana, racha, tarjetaHoy } from '../src/dominio/semana'
import type { Bloque, DiaRutina, EjercicioSesion, Rutina, Sesion } from '../src/datos/tipos'

describe('fechas en Europa/Madrid', () => {
  it('la zona horaria del test es la de Madrid (si no, los tests de cambio de hora no prueban nada)', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120)
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60)
  })
  it('cambio de hora de marzo y de octubre: sumar días y días entre fechas', () => {
    expect(sumarDias('2026-03-28', 1)).toBe('2026-03-29')
    expect(sumarDias('2026-03-29', 1)).toBe('2026-03-30')
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26')
    expect(sumarDias('2026-10-26', -1)).toBe('2026-10-25')
    expect(diasEntre('2026-03-29', '2026-03-30')).toBe(1)
    expect(diasEntre('2026-10-25', '2026-10-26')).toBe(1)
    expect(diasEntre('2026-01-01', '2027-01-01')).toBe(365)
    expect(diasEntre('2028-01-01', '2029-01-01')).toBe(366)
  })
  it('semanas que cruzan el año y número de semana', () => {
    expect(semanaDe('2026-12-31')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
    expect(lunesDe('2027-01-03')).toBe('2026-12-28')
    expect(numeroSemana('2026-12-28', '2027-01-04')).toBe(2)
    expect(numeroSemana('2026-10-19', '2026-10-26')).toBe(2) // semana del cambio de hora
  })
  it('propiedad: todos los días de 2026-2028 encadenan bien (sin saltos ni repeticiones)', () => {
    let d = '2026-01-01'
    for (let i = 0; i < 365 * 3; i++) {
      const s = sumarDias(d, 1)
      expect(diasEntre(d, s)).toBe(1)
      expect(diaSemana(deISO(s))).toBe((diaSemana(deISO(d)) + 1) % 7)
      const sem = semanaDe(d)
      expect(diaSemana(deISO(sem[0]!))).toBe(0)
      expect(sem).toContain(d)
      expect(aISO(deISO(d))).toBe(d)
      d = s
    }
    expect(d).toBe('2028-12-31')
  })
  it('fallaba: horas vacías o mal escritas daban NaN o «5:undefined»', () => {
    expect(minutosDe('')).toBe(0)
    expect(minutosDe('abc')).toBe(0)
    expect(minutosDe('06:45')).toBe(405)
    expect(formatoHora('05:30')).toBe('5:30')
    expect(formatoHora('7')).toBe('7:00')
    expect(formatoHora('')).toBe('0:00')
  })
  it('hora límite el día del cambio de hora (29 de marzo)', () => {
    const inicio = new Date(2026, 2, 29, 5, 0).getTime()
    const s: Sesion = { fecha: '2026-03-29', rutinaId: null, letra: 'A', nombre: 'A', gimnasioId: null, inicio, horaLimite: '06:45', version: 'normal', estado: 'curso', calibracion: false, ejercicios: [] }
    const e = estadoHora(s, inicio)!
    expect(e.minutosTarde).toBe(-105)
  })
})

describe('cálculos con datos raros', () => {
  it('fallaba: IMC con altura 0 daba Infinity («∞»)', () => {
    expect(Number.isNaN(imc(80, 0))).toBe(true)
    expect(num(imc(80, 0))).toBe('—')
  })
  it('fallaba: % de grasa con altura 0 daba −450', () => {
    expect(grasaMarina('hombre', 0, 98, 37)).toBeNull()
    expect(grasaMarina('mujer', 0, 80, 32, 100)).toBeNull()
  })
  it('fallaba: «-0» al formatear (asistencia 0 kg, deltas de −0,04)', () => {
    expect(num(-0)).toBe('0')
    expect(num(-0.04)).toBe('0')
    expect(kg(-0)).toBe('0')
    expect(num(Infinity)).toBe('—')
    expect(kg(47.5)).toBe('47,5')
    expect(kg(-22.5)).toBe('-22,5')
    expect(num(1234.56)).toBe('1234,6')
  })
  it('Epley con datos no numéricos da 0', () => {
    expect(epley(Number.NaN, 5)).toBe(0)
    expect(epley(50, Number.NaN)).toBe(0)
  })
})

const ej = (uid: string, extra: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid, ejercicio: uid, planificado: uid, estado: 'pendiente', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso',
  series: [1, 2, 3].map(n => ({ n, peso: 40, reps: 8, rpe: null, calentamiento: false, hecha: false })), ...extra,
})
const sesion = (ejercicios: EjercicioSesion[]): Sesion => ({ fecha: '2026-10-14', rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: 0, version: 'normal', estado: 'curso', calibracion: false, ejercicios })

describe('tiempo restante', () => {
  it('fallaba: superserie con el compañero ya quitado de la sesión restaba el descanso igualmente', () => {
    const solo = ej('a', { superserie: 'no-esta' })
    expect(restanteSesion(sesion([solo]))).toBe(restanteEjercicio(solo))
  })
  it('superserie: el segundo del par solo suma el tiempo de sus series', () => {
    const a = ej('a', { superserie: 'b' }), b = ej('b', { superserie: 'a' })
    expect(restanteSesion(sesion([a, b]))).toBe(restanteEjercicio(a) + 3 * 45)
    // Si el primero ya está hecho, el segundo cuenta entero (con sus descansos).
    const ah = { ...a, estado: 'hecho' as const }
    expect(restanteSesion(sesion([ah, b]))).toBe(restanteEjercicio(b))
  })
})

describe('sesión en curso', () => {
  it('fallaba: marcar una serie de calentamiento cambiaba el peso de todas las de trabajo', () => {
    let s = sesion([ej('a', { estado: 'curso' })])
    s = anadirCalentamiento(s, 0, [{ peso: 20, reps: 10 }, { peso: 30, reps: 5 }])
    s = hecha(s, 0, { peso: 20, reps: 10, rpe: null }).sesion
    const trabajo = s.ejercicios[0]!.series.filter(x => !x.calentamiento)
    expect(trabajo.map(x => x.peso)).toEqual([40, 40, 40])
    // Una serie de trabajo sí arrastra su peso a las siguientes.
    s = hecha(s, 0, { peso: 30, reps: 5, rpe: null }).sesion
    s = hecha(s, 0, { peso: 42.5, reps: 8, rpe: 8 }).sesion
    expect(s.ejercicios[0]!.series.filter(x => !x.calentamiento).map(x => x.peso)).toEqual([42.5, 42.5, 42.5])
  })
  it('fallaba: quitar serie con todo el trabajo hecho borraba una de calentamiento pendiente', () => {
    let s = sesion([ej('a', { estado: 'curso', series: [{ n: 1, peso: 40, reps: 8, rpe: 8, calentamiento: false, hecha: true }, { n: 2, peso: 40, reps: 8, rpe: 8, calentamiento: false, hecha: true }] })])
    s = anadirCalentamiento(s, 0, [{ peso: 20, reps: 10 }])
    const r = quitarSerie(s, 0)
    expect(r.ejercicios[0]!.series.filter(x => x.calentamiento)).toHaveLength(1)
    expect(r.ejercicios[0]!.series).toHaveLength(3)
  })
  it('fallaba: mover con índices fuera de rango metía un hueco vacío en la sesión', () => {
    const s = sesion([ej('a'), ej('b')])
    expect(mover(s, 5, 0).ejercicios.map(e => e.uid)).toEqual(['a', 'b'])
    expect(mover(s, 0, 9).ejercicios.map(e => e.uid)).toEqual(['b', 'a'])
    expect(mover(s, -1, 0).ejercicios.every(Boolean)).toBe(true)
  })
  it('fallaba: cambiar a un ejercicio por tiempo dejaba «reps» y ningún segundo', () => {
    const s = sustituir(sesion([ej('a', { estado: 'curso' })]), 0, 'plank', 'cambio', { peso: null, reps: 40 }, 'tiempo')
    for (const x of s.ejercicios[0]!.series) { expect(x.segundos).toBe(40); expect(x.reps).toBeNull(); expect(x.peso).toBeNull() }
    const c = sustituir(sesion([ej('a')]), 0, 'push-up', 'cambio', { peso: 40, reps: null }, 'corporal')
    for (const x of c.ejercicios[0]!.series) { expect(x.peso).toBeNull(); expect(x.reps).toBe(8) }
  })
  it('índices que no existen no revientan (hecha, saltar, quitar serie)', () => {
    const s = sesion([ej('a')])
    expect(hecha(s, 7, { peso: 1, reps: 1, rpe: null }).descanso).toBe(0)
    expect(saltar(s, 7).ejercicios).toHaveLength(1)
    expect(quitarSerie(s, 7).ejercicios).toHaveLength(1)
  })
  it('una sesión a medias de una rutina sin días/bloques no rompe', () => {
    const dia: DiaRutina = { letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques: [] }
    const s = crearSesion(dia, { rutinaId: 1, gimnasioId: null, version: 'corta', calibracion: false, ahora: 0 })
    expect(s.ejercicios).toEqual([])
    expect(restanteSesion(s)).toBe(0)
  })
  it('propiedad: hacer todas las series de una sesión con superseries termina la sesión y deja un solo «curso» cada vez', () => {
    const bloques: Bloque[] = ['a', 'b', 'c', 'd'].map(uid => ({ uid, ejercicio: uid, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 60, registro: 'peso' }))
    bloques[1]!.superserie = 'c'; bloques[2]!.superserie = 'b'
    let s = crearSesion({ letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques }, { rutinaId: 1, gimnasioId: null, version: 'normal', calibracion: false, ahora: 0 })
    for (let paso = 0; paso < 20; paso++) {
      const i = s.ejercicios.findIndex(e => e.estado === 'curso')
      if (i < 0) break
      s = hecha(s, i, { peso: 40, reps: 10, rpe: 8 }, paso).sesion
      expect(s.ejercicios.filter(e => e.estado === 'curso').length).toBeLessThanOrEqual(1)
    }
    expect(s.ejercicios.every(e => e.estado === 'hecho')).toBe(true)
  })
})

describe('semana', () => {
  const rutina: Rutina = { creada: '2026-01-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null, dias: [
    { letra: 'A', nombre: 'A', dia: 0, opcional: false, bloques: [] },
    { letra: 'B', nombre: 'B', dia: 2, opcional: false, bloques: [] },
  ] }
  const hechaEl = (fecha: string): Sesion => ({ ...sesion([]), fecha, estado: 'hecha' })
  it('fallaba: la tarjeta de hoy reventaba si la semana no contenía hoy', () => {
    const semana = estadoSemana(rutina, [], '2026-10-14')
    expect(() => tarjetaHoy(rutina, semana, '2026-10-20', false, false)).not.toThrow()
  })
  it('fallaba: dos entrenos el mismo día contaban como dos días cumplidos en la racha', () => {
    expect(racha(rutina, [hechaEl('2026-10-05'), hechaEl('2026-10-05')], '2026-10-14')).toBe(0)
    expect(racha(rutina, [hechaEl('2026-10-05'), hechaEl('2026-10-07')], '2026-10-14')).toBe(1)
  })
  it('racha que cruza el fin de año', () => {
    const ses = ['2026-12-21', '2026-12-23', '2026-12-28', '2026-12-30'].map(hechaEl)
    expect(racha(rutina, ses, '2027-01-05')).toBe(2)
  })
  it('rutina sin días: todo descanso y racha 0', () => {
    const vacia = { ...rutina, dias: [] }
    expect(estadoSemana(vacia, [], '2026-10-14').every(d => d.estado === 'descanso')).toBe(true)
    expect(racha(vacia, [], '2026-10-14')).toBe(0)
  })
})
