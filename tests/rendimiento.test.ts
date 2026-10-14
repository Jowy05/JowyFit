// Rendimiento de las funciones que se llaman en cada render (Progreso, Inicio, resumen semanal)
// con un historial grande: ~3 años de entrenos, mediciones diarias y comidas.
import { describe, expect, it } from 'vitest'
import { ejerciciosHechos, evolucion, grasaPorMedidas, hitosDominadas, logros, mediasSemanales, serieMedida, subidas, datosQuincena } from '../src/dominio/tendencias'
import { resumenSemana } from '../src/dominio/resumen'
import { tendenciaPeso } from '../src/dominio/peso'
import { estadoSemana, racha } from '../src/dominio/semana'
import { sumarDias } from '../src/dominio/fechas'
import type { Comida, Medicion, Rutina, Serie, Sesion } from '../src/datos/tipos'
import { epley } from '../src/dominio/calculos'

const IDS = ['bench-press', 'squat', 'lat-pulldown', 'seated-cable-row', 'bicep-curl', 'tricep-pushdown', 'assisted-pull-ups', 'plank']
const sesiones: Sesion[] = []
const mediciones: Medicion[] = []
const comidas: Comida[] = []
let fecha = '2024-01-01'
for (let i = 0; i < 1100; i++) {
  if (i % 7 === 0 || i % 7 === 2 || i % 7 === 4) {
    sesiones.push({ id: sesiones.length + 1, fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: 1, inicio: i * 86_400_000, fin: i * 86_400_000 + 3_600_000, version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: IDS.map((id, k) => ({ uid: `${i}-${k}`, ejercicio: id, planificado: id, estado: 'hecho', repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: id === 'assisted-pull-ups' ? 'asistido' : 'peso',
        series: [1, 2, 3, 4].map(n => ({ n, peso: id === 'assisted-pull-ups' ? -40 + Math.floor(i / 40) : 20 + Math.floor(i / 20) * 2.5, reps: 8 + ((i + n) % 5), rpe: 8, calentamiento: false, hecha: true, record: n === 1 && i % 21 === 0 })) })) })
  }
  mediciones.push({ fecha: `${fecha}T07:00`, origen: 'casa', pesoKg: 80 - i * 0.004, perimetros: i % 7 === 0 ? { cintura: 98 - i * 0.003, cuello: 38, cadera: 100 } : undefined })
  for (const [k, franja] of (['desayuno', 'comida', 'cena'] as const).entries()) comidas.push({ fecha, hora: `${8 + k * 6}:00`, franja, nombre: 'x', kcal: 600, proteina: 40, racion: 'N', tipo: k === 2 && i % 3 === 0 ? 'picoteo' : 'plantilla' })
  fecha = sumarDias(fecha, 1)
}
const hoy = fecha
const rutina: Rutina = { creada: '2024-01-01T00:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: 1, dias: [0, 2, 4].map((d, i) => ({ letra: 'ABC'[i]!, nombre: '', dia: d as 0, opcional: false, bloques: [] })) }

function medir(nombre: string, f: () => unknown, veces = 5): number {
  f()
  const t0 = performance.now()
  for (let i = 0; i < veces; i++) f()
  const ms = (performance.now() - t0) / veces
  console.log(`${nombre}: ${ms.toFixed(2)} ms`)
  return ms
}

describe('rendimiento con ~3 años de datos', () => {
  it(`${sesiones.length} sesiones, ${mediciones.length} mediciones, ${comidas.length} comidas: cada cálculo de render < 50 ms`, () => {
    const tiempos = {
      logros: medir('logros', () => logros(sesiones)),
      subidas: medir('subidas', () => subidas(sesiones)),
      evolucion: medir('evolucion', () => evolucion(sesiones, 'bench-press', 'e1rm')),
      ejerciciosHechos: medir('ejerciciosHechos', () => ejerciciosHechos(sesiones)),
      hitos: medir('hitosDominadas', () => hitosDominadas(sesiones)),
      grasa: medir('grasaPorMedidas', () => grasaPorMedidas(mediciones, 'hombre', 178)),
      medias: medir('mediasSemanales', () => mediasSemanales(mediciones, m => m.pesoKg)),
      serie: medir('serieMedida', () => serieMedida(mediciones, m => m.pesoKg)),
      tendencia: medir('tendenciaPeso', () => tendenciaPeso(mediciones, hoy)),
      quincena: medir('datosQuincena', () => datosQuincena({ domingo: hoy, mediciones, comidas })),
      resumen: medir('resumenSemana', () => resumenSemana({ hoy, sesiones, fijos: 3, mediciones, comidas, pasos: [], objetivoProteina: 140, objetivoPasos: 8000, recordsSemana: 0, subidasSemana: 0 })),
      semana: medir('estadoSemana', () => estadoSemana(rutina, sesiones, hoy)),
      racha: medir('racha', () => racha(rutina, sesiones, hoy)),
    }
    for (const [k, ms] of Object.entries(tiempos)) expect(ms, k).toBeLessThan(50)
  }, 60_000)

  it('los resultados siguen siendo coherentes con muchos datos', () => {
    expect(racha(rutina, sesiones, hoy)).toBeGreaterThan(50)
    expect(grasaPorMedidas(mediciones, 'hombre', 178).length).toBe(mediciones.filter(m => m.perimetros?.cintura).length)
    expect(logros(sesiones).length).toBeGreaterThan(0)
    expect(mediasSemanales(mediciones, m => m.pesoKg).length).toBeGreaterThan(150)
  })

  it('logros (versión rápida) da lo mismo que la versión anterior, cuadrática, con datos variados', () => {
    // Implementación anterior, como referencia.
    const trabajo = (ss: Serie[]) => ss.filter(x => x.hecha && !x.calentamiento)
    const referencia = (ses: Sesion[]) => {
      const historial = new Map<string, Serie[]>()
      const out: unknown[] = []
      for (const s of ses.filter(x => x.estado === 'hecha').sort((a, b) => a.inicio - b.inicio)) {
        for (const id of new Set(s.ejercicios.map(e => e.ejercicio))) {
          const series = s.ejercicios.filter(e => e.ejercicio === id).flatMap(e => e.series)
          const prev = trabajo(historial.get(id) ?? []).filter(x => x.peso != null && x.reps != null)
          const recs = trabajo(series).filter(x => x.record && x.peso != null && x.reps != null)
          if (recs.length) {
            const mejor = recs.reduce((a, b) => (epley(b.peso!, b.reps!) > epley(a.peso!, a.reps!) ? b : a))
            const base = { ejercicio: id, fecha: s.fecha, sesionId: s.id, peso: mejor.peso!, reps: mejor.reps! }
            if (!prev.length) out.push({ ...base, tipo: 'primero', mejora: 0 })
            else {
              const maxPeso = Math.max(...prev.map(x => x.peso!))
              if (mejor.peso! > maxPeso) out.push({ ...base, tipo: 'peso', mejora: mejor.peso! - maxPeso })
              else {
                const mismas = prev.filter(x => x.peso === mejor.peso).map(x => x.reps!)
                out.push({ ...base, tipo: 'reps', mejora: mismas.length ? Math.max(1, mejor.reps! - Math.max(...mismas)) : 1 })
              }
            }
          }
          historial.set(id, [...(historial.get(id) ?? []), ...series])
        }
      }
      return out.reverse()
    }
    expect(logros(sesiones)).toEqual(referencia(sesiones))
    // Datos variados: pesos nulos, calentamientos, series sin hacer, récords sueltos, ejercicios repetidos.
    let semilla = 7
    const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
    const variadas: Sesion[] = Array.from({ length: 200 }, (_, i) => ({ ...sesiones[0]!, id: i, inicio: i, fecha: sumarDias('2026-01-01', i), estado: azar() < 0.9 ? 'hecha' : 'cancelada',
      ejercicios: Array.from({ length: 3 }, (_, k) => ({ ...sesiones[0]!.ejercicios[0]!, ejercicio: ['a', 'b', 'c'][Math.floor(azar() * 3)]!, uid: `${i}-${k}`,
        series: Array.from({ length: 3 }, (_, n) => ({ n, peso: azar() < 0.1 ? null : Math.round(azar() * 8) * 2.5 - 5, reps: azar() < 0.1 ? null : Math.floor(azar() * 12), rpe: 8, calentamiento: azar() < 0.15, hecha: azar() < 0.9, record: azar() < 0.3 })) })) }))
    expect(logros(variadas)).toEqual(referencia(variadas))
  })
})
