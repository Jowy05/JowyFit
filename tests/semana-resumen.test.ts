// Semana y «¿Voy bien?»: cada estado de un día, la tarjeta «Hoy te toca», la racha, el semáforo
// con sus cifras y el consejo quincenal en todas sus ramas.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import { estadoSemana, racha, tarjetaHoy } from '../src/dominio/semana'
import { consejoQuincenal, resumenSemana } from '../src/dominio/resumen'
import { datosQuincena } from '../src/dominio/comida'
import type { Comida, DiaRutina, Medicion, PasosDia, Rutina, Sesion } from '../src/datos/tipos'

const dia = (letra: string, d: number | null, opcional = false): DiaRutina => ({ letra, nombre: `Día ${letra}`, dia: d as DiaRutina['dia'], opcional, bloques: [] })
const rutina = (creada = '2026-09-01T10:00:00.000Z'): Rutina => ({ id: 1, creada, activa: true, estructura: 'Cuerpo completo · 3 días', porque: [], calibracion: false, gimnasioId: null, dias: [dia('A', 1), dia('B', 3), dia('C', 4), dia('S', 5, true)] })
const sesion = (fecha: string, x: Partial<Sesion> = {}): Sesion => ({ id: Number(fecha.replace(/-/g, '')), fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: new Date(`${fecha}T05:30`).getTime(), version: 'normal', estado: 'hecha', calibracion: false, ejercicios: [], ...x })
// Semana del lunes 12 al domingo 18 de octubre de 2026.

describe('estado de cada día de la semana', () => {
  it('hecho, plan, perdido, opcional y descanso', () => {
    const s = estadoSemana(rutina(), [sesion('2026-10-13')], '2026-10-15')
    expect(s.map(d => d.estado)).toEqual(['descanso', 'hecho', 'descanso', 'plan', 'plan', 'opcional', 'descanso'])
    expect(s[3]!.hoy).toBe(true)
    expect(s[1]!.sesion?.fecha).toBe('2026-10-13')
    const viernes = estadoSemana(rutina(), [], '2026-10-16')
    expect(viernes[1]!.estado).toBe('perdido')
  })
  it('una sesión cancelada no cuenta como hecha', () => {
    const s = estadoSemana(rutina(), [sesion('2026-10-13', { estado: 'cancelada' })], '2026-10-14')
    expect(s[1]!.estado).toBe('perdido')
  })
  it('recolocada: el sábado pasa a tener el día B y el jueves sale como «movido»', () => {
    const rec = [{ fecha: '2026-10-17', letra: 'B', desde: '2026-10-15' }]
    const s = estadoSemana(rutina(), [], '2026-10-16', rec)
    expect(s[3]!.estado).toBe('movido')
    expect(s[5]).toMatchObject({ estado: 'plan', dia: { letra: 'B' } })
  })
  it('sin rutina: toda la semana descanso (o hecho si entrenó libre)', () => {
    const s = estadoSemana(null, [sesion('2026-10-14', { letra: 'L' })], '2026-10-15')
    expect(s.filter(d => d.estado === 'descanso')).toHaveLength(6)
    expect(s[2]!.estado).toBe('hecho')
  })
  it('semana del cambio de hora (25 de octubre): siete días seguidos', () => {
    const s = estadoSemana(rutina(), [], '2026-10-25')
    expect(s.map(d => d.fecha)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
  })
})

describe('tarjeta «Hoy te toca»', () => {
  const r = rutina()
  it('entreno en curso manda sobre todo', () => {
    expect(tarjetaHoy(r, estadoSemana(r, [], '2026-10-13'), '2026-10-13', true, true).tipo).toBe('curso')
  })
  it('sin rutina: «sin»', () => expect(tarjetaHoy(null, [], '2026-10-13', false, true).tipo).toBe('sin'))
  it('día de entreno: «hoy» con su día', () => {
    const t = tarjetaHoy(r, estadoSemana(r, [], '2026-10-13'), '2026-10-13', false, true)
    expect(t).toMatchObject({ tipo: 'hoy', dia: { letra: 'A' } })
  })
  it('ya entrenó hoy: «hecho» con el próximo', () => {
    const sem = estadoSemana(r, [sesion('2026-10-13')], '2026-10-13')
    const t = tarjetaHoy(r, sem, '2026-10-13', false, true)
    expect(t.tipo).toBe('hecho')
    expect(t.tipo === 'hecho' && t.proximo?.fecha).toBe('2026-10-15')
  })
  it('día de descanso: el próximo de esta semana o, si no hay, el de la que viene', () => {
    const sem = estadoSemana(r, [sesion('2026-10-13')], '2026-10-14')
    expect(tarjetaHoy(r, sem, '2026-10-14', false, true)).toMatchObject({ tipo: 'descanso', proximo: { fecha: '2026-10-15' } })
    const domingo = estadoSemana(r, [sesion('2026-10-13'), sesion('2026-10-15'), sesion('2026-10-16')], '2026-10-18')
    const prox = { fecha: '2026-10-20', estado: 'plan' as const, hoy: false }
    expect(tarjetaHoy(r, domingo, '2026-10-18', false, true, prox)).toMatchObject({ tipo: 'descanso', proximo: { fecha: '2026-10-20' } })
  })
  it('perdió una y queda el sábado: propone recolocarla (si quiere pasarlas al sábado)', () => {
    const sem = estadoSemana(r, [sesion('2026-10-13'), sesion('2026-10-15')], '2026-10-17')
    expect(tarjetaHoy(r, sem, '2026-10-17', false, true)).toMatchObject({ tipo: 'perdida', perdido: { fecha: '2026-10-16' }, destino: '2026-10-17' })
    // «Saltar» las perdidas: el sábado es solo opcional.
    expect(tarjetaHoy(r, sem, '2026-10-17', false, false).tipo).toBe('opcional')
  })
  it('una semana que no contiene hoy no rompe', () => {
    const sem = estadoSemana(r, [], '2026-10-13')
    expect(tarjetaHoy(r, sem, '2026-10-30', false, true).tipo).toBe('descanso')
  })
})

describe('racha de semanas', () => {
  const r = rutina()
  const semanaCompleta = (lunes: string) => [1, 3, 4].map(d => sesion(new Date(new Date(`${lunes}T12:00`).getTime() + d * 86_400_000).toISOString().slice(0, 10)))
  it('cuenta semanas seguidas cumplidas hasta la anterior y se corta en la primera floja', () => {
    const ss = [...semanaCompleta('2026-10-05'), ...semanaCompleta('2026-09-28'), ...semanaCompleta('2026-09-14')]
    expect(racha(r, ss, '2026-10-14')).toBe(2)
  })
  it('dos entrenos el mismo día cuentan como un día', () => {
    const ss = [sesion('2026-10-06'), sesion('2026-10-06'), sesion('2026-10-06')]
    expect(racha(r, ss, '2026-10-14')).toBe(0)
  })
  it('sin rutina o sin días fijos: 0', () => {
    expect(racha(null, [], '2026-10-14')).toBe(0)
    expect(racha({ ...r, dias: [dia('S', 5, true)] }, [], '2026-10-14')).toBe(0)
  })
  it('la semana del cambio de hora no rompe la cuenta', () => {
    const ss = [...semanaCompleta('2026-10-19'), ...semanaCompleta('2026-10-12')]
    expect(racha(r, ss, '2026-10-28')).toBe(2)
  })
})

describe('resumen semanal «¿Voy bien?»', () => {
  const med = (fecha: string, x: Partial<Medicion>): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', ...x })
  const com = (fecha: string, x: Partial<Comida> = {}): Comida => ({ fecha, hora: '14:00', franja: 'comida', nombre: 'x', kcal: 2000, proteina: 140, racion: 'N', tipo: 'nota', ...x })
  const paso = (fecha: string, pasos: number): PasosDia => ({ fecha, pasos, fuente: 'manual' })
  const base = { hoy: '2026-10-18', fijos: 3, objetivoProteina: 140, objetivoPasos: 8000, recordsSemana: 0, subidasSemana: 0 }

  it('semana redonda: verde con todas las cifras', () => {
    const r = resumenSemana({
      ...base, recordsSemana: 2, subidasSemana: 1,
      sesiones: [sesion('2026-10-13'), sesion('2026-10-15'), sesion('2026-10-16'), sesion('2026-10-17'), sesion('2026-10-08')],
      mediciones: [med('2026-10-05', { perimetros: { cintura: 99 }, pesoKg: 80 }), med('2026-10-13', { pesoKg: 79.5 }), med('2026-10-16', { perimetros: { cintura: 98 }, pesoKg: 79 })],
      comidas: [com('2026-10-13'), com('2026-10-14', { proteina: 150 }), com('2026-10-14', { tipo: 'picoteo', kcal: 300, proteina: 0 })],
      pasos: ['13', '14', '15', '16', '17'].map(d => paso(`2026-10-${d}`, 9000)),
    })
    expect(r.semaforo).toBe('verde')
    expect(r.titulo).toBe('Vas bien')
    expect(r.entrenos).toBe(3)
    expect(r.extra).toBe(1)
    expect(r.cintura).toEqual({ actual: 98, delta: -1 })
    expect(r.peso.media).toBeCloseTo(79.25)
    expect(r.peso.delta).toBeCloseTo(-0.75) // frente a los 80 kg de la semana anterior
    expect(r.proteina.media).toBe(145)
    expect(r.kcal.media).toBe(2150)
    expect(r.pasos).toEqual({ media: 9000, diasCumplidos: 5, objetivo: 8000 })
    expect(r.picoteo).toEqual({ dias: 1, anterior: 0 })
    expect(r.frase).toContain('3/3 entrenos')
    expect(r.frase).toContain('2 récords')
    expect(r.frase).toContain('-1 cm de cintura')
  })
  it('semana floja: rojo con lo que hay que mejorar', () => {
    const r = resumenSemana({
      ...base, sesiones: [],
      mediciones: [med('2026-10-05', { perimetros: { cintura: 97 } }), med('2026-10-15', { perimetros: { cintura: 98.5 } })],
      comidas: [com('2026-10-13', { proteina: 60 })], pasos: [paso('2026-10-13', 3000)],
    })
    expect(r.semaforo).toBe('rojo')
    expect(r.titulo).toBe('Semana floja')
    expect(r.frase).toContain('A mejorar: 0/3 entrenos, proteína baja, +1,5 cm de cintura')
  })
  it('falta uno: ámbar; con un récord sale en «Bien»', () => {
    const r = resumenSemana({ ...base, recordsSemana: 1, sesiones: [sesion('2026-10-13'), sesion('2026-10-15')], mediciones: [med('2026-10-08', { perimetros: { cintura: 98 } }), med('2026-10-15', { perimetros: { cintura: 98 } })], comidas: [com('2026-10-13', { proteina: 50 })], pasos: [] })
    expect(r.semaforo).toBe('ambar')
    expect(r.titulo).toBe('Casi')
    expect(r.frase).toMatch(/^Bien: cintura estable, 1 récord\. A mejorar: 2\/3 entrenos, proteína baja\.$/)
  })
  it('sin días fijos y sin datos: no es roja', () => {
    const r = resumenSemana({ ...base, fijos: 0, sesiones: [], mediciones: [], comidas: [], pasos: [] })
    expect(r.semaforo).not.toBe('rojo')
    expect(r.proteina.media).toBeNull()
    expect(r.pasos.media).toBeNull()
  })
  it('fallaba: la rutina y un entreno libre el mismo día contaban como «2 de 3» entrenos', () => {
    const r = resumenSemana({ ...base, hoy: '2026-10-14', esperados: 1, sesiones: [sesion('2026-10-13'), sesion('2026-10-13', { letra: 'L', inicio: 2 })], mediciones: [], comidas: [], pasos: [] })
    expect(r.entrenos).toBe(1)
    expect(r.extra).toBe(0)
    // Semana completa más una sesión de más: 3 de 3 y 1 extra.
    const llena = resumenSemana({ ...base, sesiones: ['13', '13', '15', '16'].map(d => sesion(`2026-10-${d}`)), mediciones: [], comidas: [], pasos: [] })
    expect([llena.entrenos, llena.extra]).toEqual([3, 1])
  })
  it('el peso compara con la media de la semana anterior', () => {
    const r = resumenSemana({ ...base, sesiones: [], mediciones: [med('2026-10-06', { pesoKg: 80 }), med('2026-10-08', { pesoKg: 81 }), med('2026-10-14', { pesoKg: 80 })], comidas: [], pasos: [] })
    expect(r.peso.delta).toBeCloseTo(-0.5)
  })
})

describe('consejo quincenal: todas las ramas', () => {
  const c = (x: Partial<Parameters<typeof consejoQuincenal>[0]>) => consejoQuincenal({ cinturaDelta: 0, pesoDelta: 0, picoteoDias: 0, proteinaMedia: null, objetivoProteina: 140, objetivo: 'recomposicion', ...x })
  it('sin datos de cintura ni peso: pide medirse', () => expect(c({ cinturaDelta: null, pesoDelta: null })).toMatch(/^Pésate/))
  it('proteína corta (< 80 %) va primero', () => expect(c({ proteinaMedia: 100, cinturaDelta: -2 })).toMatch(/proteína va corta/))
  it('objetivo fuerza: sube de peso o estable', () => {
    expect(c({ objetivo: 'fuerza', pesoDelta: 0.5 })).toMatch(/^Subes de peso/)
    expect(c({ objetivo: 'fuerza', pesoDelta: 0.1 })).toMatch(/come un poco más/)
  })
  it('baja la cintura: sigue igual', () => expect(c({ cinturaDelta: -0.5 })).toMatch(/cintura baja/))
  it('sube el peso o la cintura: picoteo o cenas', () => {
    expect(c({ pesoDelta: 0.5, picoteoDias: 3 })).toMatch(/menos picoteo/)
    expect(c({ cinturaDelta: 0.5 })).toMatch(/recorta un poco las cenas/)
  })
  it('estable: con picoteo, quitarlo; sin él, seguir así', () => {
    expect(c({ picoteoDias: 2 })).toMatch(/^Todo estable\. Para bajar/)
    expect(c({})).toMatch(/^Todo estable\. Sigue así/)
  })
  it('justo en los bordes (−0,3 cm y +0,4 kg) es estable', () => {
    expect(c({ cinturaDelta: -0.3, pesoDelta: 0.4 })).toMatch(/^Todo estable/)
  })
})

describe('consejo quincenal con tono y etiqueta', () => {
  const med = (fecha: string, x: Partial<Medicion>): Medicion => ({ fecha: `${fecha}T07:00`, origen: 'casa', ...x })
  it('sin datos: neutral «Faltan datos»; cintura que baja: «Vas bien»; cintura que sube: «Un ajuste»', () => {
    const o = { hoy: '2026-10-18', comidas: [], objetivoProteina: 140, objetivo: 'recomposicion' as const }
    expect(datosQuincena({ ...o, mediciones: [] })).toMatchObject({ tono: 'neutral', etiqueta: 'Faltan datos' })
    expect(datosQuincena({ ...o, mediciones: [med('2026-10-01', { perimetros: { cintura: 99 } }), med('2026-10-17', { perimetros: { cintura: 97.96 } })] }))
      .toMatchObject({ tono: 'ok', etiqueta: 'Vas bien', cinturaDelta: -1 })
    expect(datosQuincena({ ...o, mediciones: [med('2026-10-01', { perimetros: { cintura: 97 } }), med('2026-10-17', { perimetros: { cintura: 98 } })] }))
      .toMatchObject({ tono: 'warn', etiqueta: 'Un ajuste' })
  })
})
