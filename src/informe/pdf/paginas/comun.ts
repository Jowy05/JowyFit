// Lo que comparten las páginas del informe. Color: el morado de la marca para los títulos y la serie principal;
// el gris para lo que se compara o no llega.
import { num } from '../../../dominio/calculos'
import { MESES_CORTOS, deISO, fechaCorta } from '../../../dominio/fechas'
import { regionNumeros, t, tc } from '../../../i18n'
import type { EntrenosInforme, GraficaFuerza } from '../../calculo/tipos'
import { palabraEsfuerzo } from '../../calculo/comun'
import { TAM, type Lienzo } from '../lienzo'
import type { EtiquetaX, Medir } from '../graficas'
import { chipEsfuerzo, type Flujo } from '../piezas'
import { tablaPartida, type Celda, type Columna } from '../tablas'

/** Un decimal con la coma (o el punto, en inglés) del idioma: «7,0». */
export const r1 = (v: number) => v.toFixed(1).replace('.', regionNumeros() === 'en-US' ? '.' : ',')
/** «7,0 bien» (con un decimal, como en la maqueta). */
const textoEsf = (media: number, palabra: string) => `${r1(media)} ${t(palabra)}`
/** Ancho de las etiquetas de los ejes (6,5 pt). */
export const medirEje = (l: Lienzo): Medir => s => l.ancho(s, TAM.micro)

/**
 * Etiquetas del eje x de una fila de semanas: todas si caben; hasta 9 semanas, la fecha del lunes («8 sep»); con más,
 * los meses a saltos iguales (todos, uno sí y otro no…) para que no parezca que falta alguno.
 */
export function etiquetasSemanas(l: Lienzo, semanas: { lunes: string; etiqueta: string }[], ancho: number): EtiquetaX[] {
  const n = semanas.length
  if (!n) return []
  const hueco = ancho / n
  const w = (s: string) => l.ancho(s, TAM.micro)
  if (semanas.every(x => w(x.etiqueta) + 2 < hueco)) return semanas.map((x, i) => ({ i, t: x.etiqueta }))
  if (n <= 9) {
    const cortas = semanas.map((x, i) => ({ i, t: fechaCorta(x.lunes) }))
    const cada = cortas.every(x => w(x.t) + 2 < hueco) ? 1 : 2
    return cortas.filter((_, i) => i % cada === 0)
  }
  const meses: (EtiquetaX & { cx: number })[] = []
  semanas.forEach((x, i) => {
    const d = deISO(x.lunes)
    const prev = i ? deISO(semanas[i - 1]!.lunes) : null
    if (prev && prev.getMonth() === d.getMonth()) return
    const tt = !prev || d.getMonth() === 0 ? `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}` : MESES_CORTOS[d.getMonth()]!
    meses.push({ i, t: tt, cx: (i + 0.5) * hueco })
  })
  const cabe = (xs: typeof meses) => xs.every((m, k) => !k || m.cx - xs[k - 1]!.cx >= (w(m.t) + w(xs[k - 1]!.t)) / 2 + 2)
  for (const cada of [1, 2, 3, 4, 6, 12]) {
    const xs = meses.filter((_, k) => k % cada === 0)
    if (cabe(xs)) return xs.map(({ i, t }) => ({ i, t }))
  }
  return meses.slice(0, 1).map(({ i, t }) => ({ i, t }))
}

/** Esfuerzo con su punto de color. Una media lleva un decimal («7,0 bien»); una serie suelta, no («9 duro»). */
export function celdaEsfuerzo(v: number, tam: number = TAM.peque, suelta = false): Celda {
  const p = palabraEsfuerzo(v)
  return { dibujar: (l: Lienzo, cx: number, base: number) => { chipEsfuerzo(l, cx, base, suelta ? `${num(v)} ${t(p.palabra)}` : textoEsf(v, p.palabra), p.tono, tam) } }
}

/** Tabla de entrenos por semana o por mes (con muchos entrenos). */
export function tablaResumida(f: Flujo, filas: NonNullable<EntrenosInforme['porSemana']>, columna: string, titulo: string) {
  const cols: Columna[] = [{ t: columna, w: 0 }, { t: tc('columna', 'Entrenos'), w: 18, centro: true }, { t: t('Tiempo'), w: 26 }, { t: t('Series'), w: 16, der: true }, { t: t('Kg movidos'), w: 24, der: true }, { t: t('Esfuerzo'), w: 28 }, { t: t('Récords'), w: 18, der: true }]
  tablaPartida(f, cols, filas.map(x => ({
    celdas: [x.etiqueta, String(x.entrenos), x.duracion, String(x.series), num(x.kg, 0),
      x.esfuerzo != null ? celdaEsfuerzo(x.esfuerzo) : { t: t('sin marcar'), color: f.l.c.grisSuave },
      x.records ? { dibujar: (l, cx, base, w) => { l.estrella(cx + w - l.ancho(String(x.records), TAM.peque) - 2, base - 1.1, 1.3); l.texto(cx + w, base, String(x.records), { tam: TAM.peque, anc: 'end' }) } } : { t: '—', color: f.l.c.grisSuave }],
  })), { titulo: { alto: 6.5, dibujar: (l, y, sigue) => { l.texto(f.x, y + 4, sigue ? t('{titulo} (sigue)', { titulo }) : titulo, { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo }) } } })
}

/** Color de un punto de esfuerzo: el de la serie; ámbar solo por encima de 9 (duro de verdad). */
export const colorEsfuerzo = (l: Lienzo, v: number) => (v > 9 ? l.c.ambar : l.c.azul)

/** Rango mínimo del eje de fuerza: 5 kg (2,5 si pesa menos de 20), 2 reps o 5 segundos. */
export function rangoFuerza(u: GraficaFuerza['unidad'], vals: number[]): number {
  if (u === 'reps') return 2
  if (u === 's') return 5
  return Math.max(...vals) < 20 ? 2.5 : 5
}

/** Tonos de las partes del gasto: un solo color de la marca en tres claridades (reposo, pasos, entreno). */
const tonosGasto = (l: Lienzo) => [l.c.cab, l.c.azul, l.c.azulSuave]

/**
 * Barra apilada del gasto con cada parte rotulada debajo, alineada con su parte y con su muestra de color
 * (si un rótulo pisa al de antes, baja una línea). Devuelve el alto usado.
 */
export function barraGasto(l: Lienzo, x: number, y: number, w: number, partes: { v: number; t: string }[], max: number): number {
  const tonos = tonosGasto(l)
  const esc = w / Math.max(1, max)
  let xx = x
  const desde: number[] = []
  partes.forEach((p, i) => {
    const wp = p.v * esc
    desde.push(xx)
    if (wp > 0) l.rect(xx, y, Math.max(0.3, wp - (i < partes.length - 1 ? 0.3 : 0)), 5, tonos[i]!)
    xx += wp
  })
  const finFila: number[] = []
  partes.forEach((p, i) => {
    if (p.v <= 0) return
    const wt = 2.2 + l.ancho(p.t, TAM.micro)
    const x0 = Math.max(x, Math.min(desde[i]!, x + w - wt))
    let fila = 0
    while (finFila[fila] != null && x0 < finFila[fila]! + 2) fila++
    finFila[fila] = x0 + wt
    const base = y + 8.2 + fila * 3
    l.rect(x0, base - 1.75, 1.6, 1.6, tonos[i]!, 0.3)
    l.texto(x0 + 2.2, base, p.t, { tam: TAM.micro, color: l.c.tinta })
  })
  return 5 + 1.5 + Math.max(1, finFila.length) * 3
}

/** Columnas de las tablas de comida (anexo y «Tu día»). */
export const comidaCols = (): Columna[] => [{ t: t('Hora'), w: 13 }, { t: t('Franja'), w: 19 }, { t: t('Qué'), w: 0 }, { t: t('Cuánto'), w: 20 }, { t: 'kcal', w: 15, der: true }, { t: t('Proteína'), w: 18, der: true }, { t: t('Cafeína'), w: 18, der: true }]
