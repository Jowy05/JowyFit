// «Tu rutina y tu salud» del informe: el perfil en palabras, la rutina que toca (en orden o por días) con el último
// peso, las marcas del primer al último entreno, las molestias con su historial y las revisiones.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { Bloque, Perfil, Revision, Rutina } from '../src/datos/tipos'
import { calcularInforme } from '../src/informe/calculo/index'
import { S, E, SES, PERFIL, AJUSTES, entrada, idsDesde } from './informe-ejemplo'

const B = (uid: string, ejercicio: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const RUT: Rutina = {
  id: 1, creada: '2026-09-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null, equilibrio: 6,
  dias: [
    { letra: 'A', nombre: 'Cuerpo completo A', dia: 1, opcional: false, bloques: [B('a1', 'leg-press'), B('a2', 'bench-press')] },
    { letra: 'B', nombre: 'Cuerpo completo B', dia: 3, opcional: false, bloques: [B('b1', 'push-up', { registro: 'corporal' })] },
  ],
}
const perfil = (x: Partial<Perfil> = {}) => ({
  ...PERFIL, zonasPrioridad: ['piernas'], zonasMucho: ['piernas'], zonasSensibles: [], objetivo: 'salud', objetivosExtra: ['perder'],
  noQuiero: ['poleas'], condicionesSalud: ['tension'], cardioMin: 60, cardioTipos: ['bici', 'caminar'], sueno: 'normal', modoRutina: 'cola',
  dolores: [{ zona: 'rodillas', cuanto: 'regular', cuando: 'fuerza', desde: 'semanas', inicio: '2026-10-01' }], ...x,
}) as Perfil
const revisiones: Revision[] = [
  { id: 2, fecha: '2026-10-18', estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'mejor' }], cambios: [] },
  { id: 1, fecha: '2026-10-11', estado: 'seguimiento', respuestas: [{ zona: 'rodillas', va: 'peor' }], cambios: [{ uid: 'a1', letra: 'A', zona: 'rodillas', antes: B('a1', 'leg-press'), despues: B('a1', 'leg-press', { cargaPct: 0.8 }) }] },
]

function informe(p = perfil(), x = {}) {
  idsDesde(1)
  // Lunes 5 y 12 de octubre (A) y miércoles 14 (B).
  const sesiones = [
    SES('2026-10-05', [E('leg-press', [S(40, 10), S(40, 9)]), E('bench-press', [S(30, 10)])], { letra: 'A' }),
    SES('2026-10-12', [E('leg-press', [S(45, 10), S(45, 12)]), E('bench-press', [S(30, 9)])], { letra: 'A' }),
    SES('2026-10-14', [E('push-up', [S(null, 12), S(null, 15)], { registro: 'corporal' })], { letra: 'B' }),
  ]
  return calcularInforme(entrada({ perfil: p, rutina: RUT, sesiones, revisiones, ...x })).rutinaSalud
}

describe('Tu rutina y tu salud', () => {
  it('el perfil en palabras', () => {
    const datos = Object.fromEntries(informe()!.perfil.map(d => [d.nombre, d.valor]))
    expect(datos).toMatchObject({
      'Objetivo': 'Salud y moverte mejor · también perder grasa',
      'Más trabajo en': 'Piernas (mucho más)',
      'Modo': 'Rutina en orden',
      'No quiere': 'poleas',
      'Salud': 'Tensión alta',
      'Movimiento': '10.000 pasos al día · 60 min de cardio a la semana (bici, caminar)',
      'Calorías': '1850 kcal al día (puesto a mano)',
    })
  })
  it('en orden: la siguiente primero, con el último peso; el equilibrio al final', () => {
    const r = informe()!.rutina!
    expect(r.subtitulo).toBe('en orden · 2 a la semana')
    // La última fue la B: toca la A.
    expect(r.filas.map(f => [f.entreno, f.ejercicio, f.peso])).toEqual([
      ['A (siguiente)', 'Prensa de piernas', '45 kg'], ['', 'Press de banca', '30 kg'], ['B', 'Flexiones', 'su peso'], ['Todos', 'Equilibrio junto a la pared', '—'],
    ])
  })
  it('por días: cada entreno con su día', () => {
    expect(informe(perfil({ modoRutina: 'dias' }))!.rutina!.filas.map(f => f.entreno).filter(Boolean)).toEqual(['Martes', 'Jueves', 'Todos'])
  })
  it('marcas: la mejor serie del primer entreno y del último, y el cambio', () => {
    expect(informe()!.marcas).toEqual([
      { ejercicio: 'Prensa de piernas', antes: '40 kg × 10', ahora: '45 kg × 12', cambio: '+5 kg', tono: 'ok' },
      { ejercicio: 'Press de banca', antes: '30 kg × 10', ahora: '30 kg × 9', cambio: '=', tono: 'gris' },
      { ejercicio: 'Flexiones', antes: '15 veces', ahora: '15 veces', cambio: '=', tono: 'gris' },
    ])
  })
  it('molestias con su historial por fecha y lo que cambió', () => {
    expect(informe()!.molestias).toEqual([{
      zona: 'Rodillas', detalle: 'regular · al hacer fuerza · desde hace semanas',
      historial: [{ fecha: '11 oct', va: 'peor', tono: 'bad' }, { fecha: '18 oct', va: 'mejor', tono: 'ok' }],
      notas: ['11 oct: Prensa de piernas: peso al 80 %'],
    }])
  })
  it('revisiones: cuántas, la última, «Antes de entrenar» y el sueño', () => {
    expect(informe()!.revisiones).toEqual([
      { nombre: 'Hechas', valor: '2 · la última, el 18 oct' },
      { nombre: 'Antes de entrenar', valor: 'Sin avisos', tono: 'ok' },
      { nombre: 'Sueño', valor: '6 o 7 h' },
    ])
    const urg = informe(perfil({ urgencias: ['pecho'] }))!.revisiones[1]!
    expect(urg.tono).toBe('bad')
  })
  it('sin la casilla de entrenos, en un solo día o sin perfil, no sale', () => {
    expect(calcularInforme(entrada({ perfil: perfil(), rutina: RUT, secciones: { entrenos: false } })).rutinaSalud).toBeNull()
    expect(calcularInforme(entrada({ perfil: perfil(), rutina: RUT, periodo: 'hoy' })).rutinaSalud).toBeNull()
    expect(calcularInforme(entrada({ perfil: null, ajustes: AJUSTES, rutina: RUT })).rutinaSalud).toBeNull()
  })
})
