// Informe en PDF (el dibujo): que salga un PDF de verdad, con las páginas que tocan según las casillas y el periodo,
// con el texto que se espera, y que no falle ni con datos vacíos ni con años de datos.
process.env.TZ = 'Europe/Madrid'
import { describe, expect, it } from 'vitest'
import type { Ajustes, Comida, EjercicioSesion, Medicion, Meta, PasosDia, Perfil, Rutina, Serie, Sesion } from '../src/datos/tipos'
import type { CatalogoInforme, EntradaInforme, PeriodoInforme, SeccionesInforme } from '../src/informe/calculo/tipos'
import { calcularInforme } from '../src/informe/calculo/index'
import { aISO, sumarDias } from '../src/dominio/fechas'
import { crearPdf, nombrePdf } from '../src/informe/pdf'
import { enWinAnsi, textoPdf } from '../src/informe/pdf/texto'
import { ejeDe, etiquetasFechas } from '../src/informe/pdf/graficas'
import { contenidos, leerPdf } from '../scripts/leer-pdf.mjs'

// ---------------------------------------------------------------- datos de prueba

const NOMBRES: Record<string, string> = {
  'bench-press': 'Press de banca', 'leg-press': 'Prensa de piernas', 'lat-pulldown': 'Jalón al pecho', 'seated-cable-row': 'Remo sentado en polea',
  'bicep-curl': 'Curl de bíceps', 'assisted-pull-up': 'Dominada asistida', plank: 'Plancha', 'push-up': 'Flexiones',
}
const CAT: CatalogoInforme = { nombre: id => NOMBRES[id] ?? id, patron: id => (id === 'bench-press' ? 'empuje-h' : id === 'leg-press' ? 'rodilla' : undefined), met: () => 5 }
const PERFIL = {
  id: 'yo', creado: '2024-01-01', altaCompleta: true, nombre: 'Joel', nacimiento: '2005-03-23', sexo: 'hombre', alturaCm: 177, objetivo: 'recomposicion',
  pasosObjetivo: 10_000, diasFijos: [1, 3, 4], trabajo: 'sentado',
} as Perfil
const AJUSTES = { id: 'app', cafeinaLimite: 400, kcalManual: 1850, proteinaManual: 140, recolocadas: [] } as unknown as Ajustes
const RUTINA: Rutina = {
  id: 1, creada: '2024-01-01T10:00:00.000Z', activa: true, estructura: 'Cuerpo completo · 3 días', porque: [], calibracion: false, gimnasioId: null,
  dias: [{ letra: 'A', nombre: 'Cuerpo completo A', dia: 1, opcional: false, bloques: [] }, { letra: 'B', nombre: 'Cuerpo completo B', dia: 3, opcional: false, bloques: [] }, { letra: 'C', nombre: 'Cuerpo completo C', dia: 4, opcional: false, bloques: [] }],
}
const AHORA = new Date('2026-10-20T22:30:00')
const HOY = aISO(AHORA)

const S = (peso: number | null, reps: number | null, rpe: number | null = null, x: Partial<Serie> = {}): Serie => ({ n: 1, peso, reps, rpe, calentamiento: false, hecha: true, ...x })
const E = (id: string, series: Serie[], x: Partial<EjercicioSesion> = {}): EjercicioSesion => ({
  uid: id, ejercicio: id, planificado: id, estado: 'hecho', series: series.map((s, i) => ({ ...s, n: i + 1 })), repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x,
})
let sid = 1
const diaSem = (f: string) => (new Date(`${f}T12:00:00`).getDay() + 6) % 7

/** `dias` días hasta hoy: entreno martes, jueves y viernes (subiendo poco a poco), comidas, pasos y una pesada a la semana. */
function historial(dias: number, o: { extra?: boolean } = {}) {
  sid = 1
  const sesiones: Sesion[] = [], comidas: Comida[] = [], pasos: PasosDia[] = [], mediciones: Medicion[] = []
  let n = 0
  for (let f = sumarDias(HOY, -(dias - 1)); f <= HOY; f = sumarDias(f, 1)) {
    const d = diaSem(f)
    if (d === 1 || d === 3 || d === 4) {
      const p = 40 + Math.floor(n / 3) * 2.5
      const inicio = new Date(`${f}T05:30:00`).getTime()
      const ejercicios = [
        E('bench-press', [S(p / 2, 10, null, { calentamiento: true }), S(p, 8, 8), S(p, 7, 9, { record: n % 3 === 0 }), S(p, 6, null)]),
        E('leg-press', [S(p * 2, 10, 7), S(p * 2, 10, 8)]),
        E('lat-pulldown', [S(p, 10, 8), S(p, 9, null)]),
      ]
      if (o.extra) {
        ejercicios.push(E('assisted-pull-up', [S(-20 + Math.min(15, n / 4), 6, 9)]))
        ejercicios.push(E('plank', [S(null, null, 8, { segundos: 30 + (n % 5) * 5 })], { registro: 'tiempo' }))
        ejercicios.push(E('seated-cable-row', [S(50, 8, null, { hecha: false })], { estado: 'saltado' }))
      }
      sesiones.push({ id: sid++, fecha: f, rutinaId: 1, letra: d === 1 ? 'A' : d === 3 ? 'B' : 'C', nombre: `Cuerpo completo ${d === 1 ? 'A' : d === 3 ? 'B' : 'C'}`, gimnasioId: null, inicio, fin: inicio + 58 * 60_000, version: 'normal', estado: 'hecha', calibracion: n < 3, ejercicios })
      n++
    }
    comidas.push({ fecha: f, hora: '07:00', franja: 'desayuno', nombre: 'Café', kcal: 5, proteina: 0, cafeina: 80, racion: 'N', tipo: 'bebida' })
    comidas.push({ fecha: f, hora: '14:00', franja: 'comida', nombre: 'Pollo teriyaki (Mercadona)', kcal: 520, proteina: 35, racion: 'N', tipo: 'plantilla' })
    comidas.push({ fecha: f, hora: '17:00', franja: 'merienda', nombre: 'Batido de proteína', kcal: 120, proteina: 24, racion: 'N', tipo: 'plantilla' })
    if (d === 5) comidas.push({ fecha: f, hora: '18:00', franja: 'merienda', nombre: 'Quicos (bolsa)', kcal: 150, proteina: 3, racion: 'P', tipo: 'picoteo', hidratos: 20, grasas: 6, sal: 0.5 })
    comidas.push({ fecha: f, hora: '21:00', franja: 'cena', nombre: 'Arroz con atún o pollo', kcal: 550 + (d * 37) % 200, proteina: 35, racion: 'N', tipo: 'plantilla' })
    pasos.push({ fecha: f, pasos: 6000 + ((d * 1931 + n * 577) % 6000), fuente: 'manual', ...(d === 6 ? { troteKm: 3 } : {}) })
    if (d === 1) {
      mediciones.push({ fecha: `${f}T07:00`, origen: 'casa', pesoKg: 82 - n * 0.05, bascula: { grasaPct: 26 - n * 0.02, basalKcal: 1665, aguaPct: 55.6, visceral: 7 } })
      mediciones.push({ fecha: `${f}T07:05`, origen: 'cinta', perimetros: { cintura: 100 - n * 0.03, cuello: 38 } })
    }
  }
  return { sesiones, comidas, pasos, mediciones }
}

const METAS: Meta[] = [
  { id: 1, tipo: 'cintura', titulo: 'Cintura por debajo de 88 cm', objetivo: 88, unidad: 'cm', fecha: '2027-06-21', inicio: 98 },
  { id: 2, tipo: 'ejercicio', titulo: 'Press de banca: 65 kg × 5', objetivo: 65, unidad: 'kg', fecha: '2027-06-21', ejercicio: 'bench-press', inicio: 40 },
]

function entrada(periodo: PeriodoInforme, h: ReturnType<typeof historial>, x: Partial<EntradaInforme> = {}): EntradaInforme {
  return { perfil: PERFIL, ajustes: AJUSTES, rutina: RUTINA, suplementos: [], metas: METAS, ...h, periodo, ahora: AHORA, catalogo: CAT, ...x }
}

async function pdfDe(periodo: PeriodoInforme, h = historial(45), secciones?: Partial<SeccionesInforme>, x: Partial<EntradaInforme> = {}) {
  const inf = calcularInforme({ ...entrada(periodo, h, x), secciones })
  const bytes = await crearPdf(inf, { version: '9.9.9', creado: AHORA })
  return { inf, bytes, pdf: await leerPdf(bytes) }
}

const NINGUNA: Partial<SeccionesInforme> = { entrenos: false, comida: false, cuerpo: false, pasos: false, detalle: false }

// ---------------------------------------------------------------- pruebas

describe('textoPdf: solo lo que se puede escribir con la Helvetica del PDF', () => {
  it('cambia lo que tiene equivalente', () => {
    expect(textoPdf('−1,5 kg')).toBe('–1,5 kg')
    expect(textoPdf('⅓ de la bolsa')).toBe('1/3 de la bolsa')
    expect(textoPdf('≥ 126 g')).toBe('desde 126 g')
    expect(textoPdf('≤ 98 g')).toBe('hasta 98 g')
    expect(textoPdf('sep → oct')).toBe('sep a oct')
    expect(textoPdf('10 000')).toBe('10 000')
  })
  it('deja las tildes, la ñ y los signos del español', () => {
    const t = '¿Qué tal? ¡Año récord! «Cañón» · 55 kg × 6 — 24,3 % … ½ €'
    expect(textoPdf(t)).toBe(t)
  })
  it('quita estrellas, flechas y emojis (se dibujan aparte) y deja la letra sin el acento raro', () => {
    expect(textoPdf('★ Récord ▲▼ 💪')).toBe(' Récord ')
    expect(textoPdf('Bucureşti')).toBe('Bucuresti')
    for (const c of textoPdf('ℝ∑漢字😀 hola')) expect(enWinAnsi(c)).toBe(true)
  })
})

describe('piezas de las gráficas', () => {
  it('ejes con números redondos y el tope a medio paso si se pide', () => {
    expect(ejeDe([0, 151], 5, true, true)).toEqual({ min: 0, max: 175, marcas: [0, 50, 100, 150] })
    expect(ejeDe([79.1, 80.6], 3)).toEqual({ min: 79, max: 81, marcas: [79, 80, 81] })
    // Un solo valor: el eje se abre alrededor.
    const e = ejeDe([55], 3)
    expect(e.min).toBeLessThan(55)
    expect(e.max).toBeGreaterThan(55)
  })
  it('etiquetas de fechas: primera y última siempre, y sin pisarse', () => {
    const dias = Array.from({ length: 30 }, (_, i) => sumarDias('2026-09-21', i))
    const e = etiquetasFechas(dias, 100)
    expect(e[0]).toMatchObject({ i: 0, t: '21 sep' })
    expect(e.at(-1)).toMatchObject({ i: 29, t: '20 oct' })
    for (let i = 1; i < e.length; i++) expect((e[i]!.i - e[i - 1]!.i) * (100 / 29)).toBeGreaterThanOrEqual(13)
    const anio = Array.from({ length: 365 }, (_, i) => sumarDias('2025-10-21', i))
    const ea = etiquetasFechas(anio, 100)
    expect(ea[0]!.t).toBe('21 oct 2025')
    expect(ea.some(x => x.t === 'ene 2026')).toBe(true)
    expect(etiquetasFechas(['2026-10-20'], 50)).toEqual([{ i: 0, t: '20 oct' }])
  })
})

describe('crearPdf', () => {
  it('es un PDF A4 vertical con sus metadatos', async () => {
    const { bytes, pdf } = await pdfDe('mes')
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(pdf.tamanos.every(t => Math.abs(t.width - 595.28) < 0.1 && Math.abs(t.height - 841.89) < 0.1)).toBe(true)
    expect(pdf.titulo).toBe('Informe JowyFit · Último mes')
    expect(pdf.autor).toBe('Joel')
    expect(pdf.productor).toBe('JowyFit 9.9.9')
  })

  it('Último mes con todo marcado: resumen, entrenos, fuerza y comida-cuerpo-pasos', async () => {
    const { pdf } = await pdfDe('mes')
    expect(pdf.paginas).toBe(4)
    expect(pdf.textos[0]).toContain('Informe de progreso')
    expect(pdf.textos[0]).toContain('Último mes · 21 sep – 20 oct 2026')
    expect(pdf.textos[0]).toContain('Resumen del periodo')
    expect(pdf.textos[0]).toContain('Puntuación del periodo')
    expect(pdf.textos[1]).toContain('Entrenos')
    expect(pdf.textos[1]).toContain('Cómo te ha costado cada entreno')
    expect(pdf.textos[2]).toContain('Progreso de fuerza')
    expect(pdf.textos[2]).toContain('Tu mejor serie en cada ejercicio')
    expect(pdf.textos[3]).toContain('Comida')
    expect(pdf.textos[3]).toContain('Pasos y gasto')
    pdf.textos.forEach((t, i) => expect(t).toContain(`Página ${i + 1} de 4`))
    expect(pdf.texto).toContain('Tus datos solo están en tu móvil')
  })

  it('el resumen va siempre; cada casilla añade solo lo suyo', async () => {
    const h = historial(45)
    expect((await pdfDe('mes', h, NINGUNA)).pdf.paginas).toBe(1)
    const ent = (await pdfDe('mes', h, { ...NINGUNA, entrenos: true })).pdf
    expect(ent.paginas).toBe(3)
    expect(ent.texto).not.toContain('Pasos y gasto')
    const com = (await pdfDe('mes', h, { ...NINGUNA, comida: true })).pdf
    expect(com.paginas).toBe(2)
    expect(com.textos[1]).toContain('Comida')
    expect(com.texto).not.toContain('Progreso de fuerza')
    // Comida, cuerpo y pasos comparten página.
    expect((await pdfDe('mes', h, { ...NINGUNA, comida: true, cuerpo: true, pasos: true })).pdf.paginas).toBe(2)
  })

  it('una casilla marcada sin datos no ocupa página: sale una línea en el resumen', async () => {
    const h = historial(45)
    const { pdf } = await pdfDe('mes', { ...h, comidas: [] })
    expect(pdf.texto).toContain('Comida: no hay comidas apuntadas de estos días')
    expect(pdf.texto).not.toContain('Lo que más apuntas')
  })

  it('«una a una» añade el anexo con cada serie y cada comida', async () => {
    const { pdf } = await pdfDe('semana', historial(45), { detalle: true })
    expect(pdf.texto).toContain('Cada serie, una a una')
    expect(pdf.texto).toContain('Cada comida, una a una')
    expect(pdf.texto).toContain('calentamiento')
    const sinAnexo = (await pdfDe('semana', historial(45))).pdf
    expect(pdf.paginas).toBeGreaterThan(sinAnexo.paginas)
  })

  it('Hoy: la página «Tu día» con lo de hoy contra lo normal', async () => {
    const { pdf } = await pdfDe('hoy')
    expect(pdf.paginas).toBe(1)
    expect(pdf.textos[0]).toContain('Tu día')
    expect(pdf.textos[0]).toContain('Hoy · martes 20 oct 2026')
    expect(pdf.textos[0]).toContain('Comparado con tus últimas 4 semanas')
    expect(pdf.textos[0]).toContain('Fuerza: hoy contra lo normal')
    expect(pdf.textos[0]).toMatch(/lo normal: [\d,]+ kg/)
    expect(pdf.textos[0]).toContain('Comida de hoy')
    expect(pdf.texto).not.toContain('Resumen del periodo')
  })

  it('Ayer: lo mismo con «ayer» en los textos', async () => {
    const { pdf } = await pdfDe('ayer')
    expect(pdf.textos[0]).toContain('Ayer · lunes 19 oct 2026')
    expect(pdf.textos[0]).toContain('Comida de ayer')
  })

  it('Hoy con «una a una» añade el detalle de las series del día', async () => {
    const { pdf } = await pdfDe('hoy', historial(45), { detalle: true })
    expect(pdf.paginas).toBeGreaterThanOrEqual(2)
    expect(pdf.texto).toContain('Cada serie, una a una')
  })

  it('sin ningún dato (app recién instalada) sale igual, sin fallar', async () => {
    const vacio = { sesiones: [], comidas: [], pasos: [], mediciones: [] }
    for (const p of ['hoy', 'ayer', 'semana', 'mes', 'todo'] as PeriodoInforme[]) {
      const { pdf } = await pdfDe(p, vacio, undefined, { perfil: null, ajustes: null, rutina: null, metas: [] })
      expect(pdf.paginas).toBeGreaterThanOrEqual(1)
      expect(pdf.textos[0]).toContain(p === 'hoy' || p === 'ayer' ? 'Tu día' : 'Informe de progreso')
      expect(pdf.texto).not.toMatch(/NaN|Infinity|undefined|null/)
    }
  })

  it('con un solo dato de cada cosa', async () => {
    const h = historial(1)
    for (const p of ['semana', 'mes', 'todo'] as PeriodoInforme[]) {
      const { pdf } = await pdfDe(p, h)
      expect(pdf.texto).not.toMatch(/NaN|Infinity|undefined/)
      // Con menos de 3 días no hay gráfica de fuerza: el ejercicio sale en «Tu mejor serie».
      expect(pdf.texto).not.toContain('Progreso de fuerza')
      expect(pdf.texto).toContain('Tu mejor serie en cada ejercicio')
    }
  })

  it('ejercicios asistidos, de tiempo y saltados no rompen nada', async () => {
    const { pdf } = await pdfDe('mes', historial(45, { extra: true }), { detalle: true })
    expect(pdf.texto).toContain('saltado')
    expect(pdf.texto).toMatch(/ayuda [\d,]+ kg/)
    expect(pdf.texto).not.toMatch(/NaN|Infinity|undefined/)
  })

  it('sin catálogo (sin conexión): los ids como nombres', async () => {
    const { pdf } = await pdfDe('mes', historial(45), undefined, { catalogo: undefined })
    expect(pdf.texto).toContain('bench-press')
  })

  it('nombres con emojis y letras raras no rompen el PDF', async () => {
    const h = historial(10)
    h.comidas.push({ fecha: HOY, hora: '12:00', franja: 'comida', nombre: '🍕 Pizza ½ «casera» ★', kcal: 500, proteina: 20, racion: 'N', tipo: 'nota' })
    const { pdf } = await pdfDe('hoy', h, undefined, { perfil: { ...PERFIL, nombre: 'Jōel 😀' } })
    expect(pdf.texto).toContain('Pizza ½ «casera»')
    expect(pdf.texto).toContain('Joel')
  })

  it('«Todo» con dos años de datos: entrenos semana a semana, mes a mes y sin pasarse de páginas', async () => {
    const h = historial(730)
    const t0 = Date.now()
    const { pdf } = await pdfDe('todo', h, { detalle: false })
    expect(Date.now() - t0).toBeLessThan(15_000)
    expect(pdf.texto).toContain('Mes a mes')
    expect(pdf.texto).toContain('Semana a semana')
    expect(pdf.paginas).toBeLessThanOrEqual(12)
    expect(pdf.texto).not.toMatch(/NaN|Infinity|undefined/)
  }, 30_000)

  it('el anexo de dos años se parte en muchas páginas repitiendo la cabecera', async () => {
    const { pdf } = await pdfDe('todo', historial(400), { detalle: true })
    expect(pdf.paginas).toBeGreaterThan(30)
    expect(pdf.texto).toContain('(sigue)')
    pdf.textos.forEach((t, i) => expect(t).toContain(`Página ${i + 1} de ${pdf.paginas}`))
  }, 60_000)

  it('ningún texto se sale de la hoja (todo se escribe dentro del A4)', async () => {
    const { bytes } = await pdfDe('mes', historial(45, { extra: true }))
    let textos = 0
    for (const s of await contenidos(bytes)) {
      for (const m of s.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)) {
        const x = Number(m[1]), y = Number(m[2])
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(595.28)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(841.89)
        textos++
      }
    }
    expect(textos).toBeGreaterThan(300)
  })
})

describe('nombre del archivo', () => {
  it('JowyFit-informe-<periodo>-<AAAA-MM-DD>.pdf, sin el nombre de la persona', () => {
    expect(nombrePdf({ periodo: 'mes', hoy: '2026-10-20' })).toBe('JowyFit-informe-ultimo-mes-2026-10-20.pdf')
    expect(nombrePdf({ periodo: 'semana', hoy: '2026-10-20' })).toBe('JowyFit-informe-ultima-semana-2026-10-20.pdf')
    expect(nombrePdf({ periodo: 'hoy', hoy: '2026-10-20' })).toBe('JowyFit-informe-hoy-2026-10-20.pdf')
    expect(nombrePdf({ periodo: 'ayer', hoy: '2026-10-20' })).toBe('JowyFit-informe-ayer-2026-10-20.pdf')
    expect(nombrePdf({ periodo: 'todo', hoy: '2026-10-20' })).toBe('JowyFit-informe-todo-2026-10-20.pdf')
  })
})
