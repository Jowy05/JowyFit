// Gráficas vectoriales del PDF (§4 del diseño): una gráfica de líneas o barras con ejes redondos, bandas,
// rayas de objetivo fuera del área de dibujo y marcas (último dato, récord); y las filas de zonas al estilo Fitdays.
// Se dibujan sobre el Lienzo en mm; las medidas son las de la maqueta (.cache/pdf-maqueta/generar-maqueta.mjs).
import { num } from '../../dominio/calculos'
import { DIAS_CORTOS, MESES_CORTOS, deISO, diasEntre, fechaCorta } from '../../dominio/fechas'
import { t } from '../../i18n'
import { TAM, type Ancla, type Lienzo } from './lienzo'

type Eje = { min: number; max: number; marcas: number[] }

type SerieGrafica = {
  vals: (number | null)[]
  color: string
  /** Grosor de la línea; 0 = solo puntos. */
  ancho?: number
  puntos?: boolean
  r?: number
  /** Une los puntos aunque haya huecos (días sin dato) entre medias. */
  unir?: boolean
  raya?: number[]
  colorPunto?: (i: number, v: number) => string
  /** Punto hueco (p. ej. % de grasa por medidas o día con picoteo). */
  hueco?: (i: number) => boolean
  /** Borde de los puntos huecos (por defecto, el color de la serie). */
  colorHueco?: string
}
export type BarraGrafica = { v: number | null; color?: string; etq?: string | null; partes?: { v: number; color: string }[] }
type BandaGrafica = { desde: number; hasta: number; color: string; texto?: string; colorTexto?: string; fuera?: boolean }
type LineaH = { v: number; color: string; ancho?: number; raya?: number[]; texto?: string; colorTexto?: string; fuera?: boolean; izq?: boolean; fondo?: boolean }
type MarcaGrafica = { i: number; v: number; tipo?: 'hoy' | 'record' | 'primero'; texto?: string; dx?: number; dy?: number; anc?: Ancla; tam?: number; color?: string }
export type EtiquetaX = { i: number; t: string; anc?: Ancla }

type OpcGrafica = {
  x: number; y: number; w: number; h: number
  /** Número de huecos en x (días del periodo, sesiones, semanas…). */
  n: number
  eje: Eje
  series?: SerieGrafica[]
  barras?: BarraGrafica[] | null
  /** Ancho máximo de cada barra (mm). */
  anchoBarra?: number
  /** Parte del hueco que ocupa cada barra (0,55 = barras anchas con aire entre ellas); manda sobre `anchoBarra`. */
  fraccionBarra?: number
  bandas?: BandaGrafica[]
  lineasH?: LineaH[]
  marcas?: MarcaGrafica[]
  etiquetasX?: EtiquetaX[]
  ml?: number; mr?: number; mt?: number; mb?: number
  fmtY?: (v: number) => string
  /** Textos propios del eje y (en vez de los números): «7-8 bien» en el 7,5… */
  etiquetasY?: { v: number; t: string }[]
  /** Separación de los textos de fuera (a la derecha del área de dibujo). Más si el último punto va en el borde. */
  sepFuera?: number
  /** Hueco a cada lado en las líneas (sin barras): el primer punto no pisa los números del eje ni el último la etiqueta de fuera. */
  padX?: number
  /** Las líneas usan los huecos de las barras (para compartir el eje x con una gráfica de barras de encima). */
  xBarras?: boolean
}

/**
 * Eje de una gráfica pequeña de líneas (fuerza, peso, grasa, cintura): con un rango mínimo para que un cambio pequeño
 * no parezca un salto enorme (de 11 a 12 kg), y medio paso de eje por debajo del valor más bajo (que no caiga en la raya)
 * y por encima del más alto (que su número no se salga por arriba).
 */
export function ejeHolgado(valores: number[], rangoMin: number, marcasDeseadas = 3): Eje {
  const vs = valores.filter(Number.isFinite)
  if (!vs.length) return ejeDe(vs, marcasDeseadas)
  let lo = Math.min(...vs), hi = Math.max(...vs)
  if (hi - lo < rangoMin) { const c = (lo + hi) / 2; lo = c - rangoMin / 2; hi = c + rangoMin / 2 }
  let e = ejeDe([lo, hi], marcasDeseadas)
  const paso = (e.marcas[1] ?? e.max) - (e.marcas[0] ?? e.min) || 1
  const minimo = Math.min(...vs), maximo = Math.max(...vs)
  const abajo = minimo - e.min < paso / 2 ? minimo - paso / 2 : e.min
  const arriba = e.max - maximo < paso / 2 ? maximo + paso / 2 : e.max
  if (abajo !== e.min || arriba !== e.max) e = ejeDe([abajo, arriba], marcasDeseadas)
  // Los pesos y las medidas nunca bajan de 0.
  if (e.min < 0 && minimo >= 0) e = ejeDe([0, arriba], marcasDeseadas)
  return e
}

/** Escala con números redondos (como ejeRedondo de dominio/tendencias.ts) y siempre con hueco arriba y abajo. */
export function ejeDe(valores: number[], marcasDeseadas = 3, desdeCero = false, ajustado = false): Eje {
  const vs = valores.filter(Number.isFinite)
  let lo = vs.length ? Math.min(...vs) : 0, hi = vs.length ? Math.max(...vs) : 1
  if (desdeCero) lo = Math.min(0, lo)
  if (hi === lo) { const m = Math.max(Math.abs(lo) * 0.04, 0.5); lo = desdeCero ? lo : lo - m; hi += m }
  const bruto = (hi - lo) / Math.max(1, marcasDeseadas - 1)
  const pot = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map(f => f * pot).find(p => p >= bruto - 1e-12) ?? 10 * pot
  const red = (x: number) => Math.round(x * 1e9) / 1e9
  const min = red(Math.floor(lo / paso + 1e-9) * paso)
  // Ajustado: el tope se queda a medio paso por encima del dato más alto (las barras llenan más el alto).
  let max = ajustado ? red(Math.ceil(hi / (paso / 2) - 1e-9) * (paso / 2)) : red(Math.ceil(hi / paso - 1e-9) * paso)
  if (max <= min) max = red(min + paso)
  const marcas: number[] = []
  for (let v = min; v <= max + 1e-9; v = red(v + paso)) marcas.push(v)
  return { min, max, marcas }
}

type Geometria = { X: (i: number) => number; Y: (v: number) => number; x0: number; x1: number; y0: number; y1: number }

/** Dibuja una gráfica y devuelve sus funciones de posición (para añadir cosas encima). */
export function grafica(l: Lienzo, o: OpcGrafica): Geometria {
  const { n, eje } = o
  const ml = o.ml ?? 8, mr = o.mr ?? 3, mt = o.mt ?? 3, mb = o.mb ?? 5
  const x0 = o.x + ml, x1 = o.x + o.w - mr, y0 = o.y + mt, y1 = o.y + o.h - mb
  const barras = o.barras ?? null
  const rango = eje.max - eje.min || 1
  const px = o.padX ?? 0
  const X = (i: number) => (n <= 1 ? (x0 + x1) / 2 : barras || o.xBarras ? x0 + ((i + 0.5) * (x1 - x0)) / n : x0 + px + (i * (x1 - x0 - 2 * px)) / (n - 1))
  const Y = (v: number) => y1 - ((Math.min(eje.max, Math.max(eje.min, v)) - eje.min) / rango) * (y1 - y0)
  const fmtY = o.fmtY ?? ((v: number) => num(v, 2))
  for (const b of o.bandas ?? []) {
    const ya = Y(Math.min(b.hasta, eje.max)), yb = Y(Math.max(b.desde, eje.min))
    l.rect(x0, ya, x1 - x0, yb - ya, b.color)
    if (b.texto) {
      if (b.fuera) l.texto(x1 + (o.sepFuera ?? 1), (ya + yb) / 2 + 0.9, b.texto, { tam: TAM.micro, color: b.colorTexto ?? l.c.gris, peso: 'negrita' })
      else l.texto(x1 - 0.8, ya + 2.4, b.texto, { tam: TAM.micro, color: b.colorTexto ?? l.c.gris, anc: 'end' })
    }
  }
  for (const m of eje.marcas) {
    l.linea(x0, Y(m), x1, Y(m), l.c.rejilla, 0.2)
    if (!o.etiquetasY) l.texto(x0 - 1.2, Y(m) + 0.9, fmtY(m), { tam: TAM.micro, color: l.c.gris, anc: 'end' })
  }
  for (const e of o.etiquetasY ?? []) l.texto(x0 - 1.2, Y(e.v) + 0.9, e.t, { tam: TAM.micro, color: l.c.gris, anc: 'end' })
  l.linea(x0, y1, x1, y1, l.c.linea, 0.3)
  for (const e of o.etiquetasX ?? []) l.texto(X(e.i), o.y + o.h - 1.2, e.t, { tam: TAM.micro, color: l.c.gris, anc: e.anc ?? 'middle' })
  if (barras) {
    const hueco = (x1 - x0) / Math.max(1, n)
    const bw = o.fraccionBarra ? hueco * o.fraccionBarra : Math.min(o.anchoBarra ?? 4.5, hueco * (hueco < 1.6 ? 0.8 : 0.62))
    barras.forEach((b, i) => {
      if (b.v == null) { l.rect(X(i) - bw / 2, y1 - 0.6, bw, 0.6, l.c.linea); return }
      if (b.partes) {
        let base = Math.max(0, eje.min)
        for (const p of b.partes) { if (p.v > 0) l.rect(X(i) - bw / 2, Y(base + p.v), bw, Y(base) - Y(base + p.v), p.color); base += p.v }
      } else l.rect(X(i) - bw / 2, Y(b.v), bw, y1 - Y(b.v), b.color ?? l.c.azul)
    })
  }
  for (const r of o.lineasH ?? []) {
    if (r.v < eje.min || r.v > eje.max) continue
    if (r.color !== 'none') l.linea(x0, Y(r.v), x1, Y(r.v), r.color, r.ancho ?? 0.3, r.raya ?? [1.2, 0.8])
  }
  // El valor de cada barra, encima de la raya del objetivo (con su fondo blanco, para que la raya no lo tape).
  barras?.forEach((b, i) => {
    if (!b.etq || b.v == null) return
    const w = l.ancho(b.etq, TAM.micro, 'negrita')
    l.rect(X(i) - w / 2 - 0.4, Y(b.v) - 3.4, w + 0.8, 2.6, l.c.blanco)
    l.texto(X(i), Y(b.v) - 1.2, b.etq, { tam: TAM.micro, color: l.c.tinta, anc: 'middle', peso: 'negrita' })
  })
  for (const s of o.series ?? []) {
    if (s.ancho !== 0) {
      const pts: ({ x: number; y: number } | null)[] = []
      s.vals.forEach((v, i) => {
        if (v == null) { if (!s.unir) pts.push(null); return }
        pts.push({ x: X(i), y: Y(v) })
      })
      l.polilinea(pts, s.color, s.ancho ?? 0.5, s.raya)
    }
    if (s.puntos) {
      s.vals.forEach((v, i) => {
        if (v == null) return
        if (s.hueco?.(i)) l.circulo(X(i), Y(v), s.r ?? 0.75, l.c.blanco, s.colorHueco ?? s.color, 0.35)
        else l.circulo(X(i), Y(v), s.r ?? 0.75, s.colorPunto?.(i, v) ?? s.color, l.c.blanco, 0.25)
      })
    }
  }
  for (const r of o.lineasH ?? []) {
    if (!r.texto || r.v < eje.min || r.v > eje.max) continue
    if (r.fuera) { l.texto(x1 + (o.sepFuera ?? 1), Y(r.v) + 0.9, r.texto, { tam: TAM.micro, color: r.colorTexto ?? r.color, peso: 'negrita' }); continue }
    const tx = r.izq ? x0 + 2.6 : x1 - 0.8
    if (r.fondo) {
      const w = l.ancho(r.texto, TAM.micro, 'negrita')
      l.rect(r.izq ? tx - 0.8 : tx - w - 0.8, Y(r.v) - 3.3, w + 1.6, 2.8, l.c.blanco, 0.6)
    }
    l.texto(tx, Y(r.v) - 0.9, r.texto, { tam: TAM.micro, color: r.colorTexto ?? r.color, anc: r.izq ? 'start' : 'end', peso: 'negrita' })
  }
  for (const m of o.marcas ?? []) {
    if (m.tipo === 'record') l.estrella(X(m.i), Y(m.v), 1.5)
    if (m.tipo === 'hoy') l.circulo(X(m.i), Y(m.v), 1.25, l.c.azul, l.c.blanco, 0.35)
    if (m.tipo === 'primero') l.circulo(X(m.i), Y(m.v), 1.25, l.c.azul, l.c.blanco, 0.35)
    if (m.texto) {
      // El valor no se sale de la gráfica por arriba ni por los lados.
      let anc = m.anc ?? 'middle'
      const tx = X(m.i) + (m.dx ?? 0)
      const w = l.ancho(m.texto, m.tam ?? TAM.micro, 'negrita')
      if (anc === 'middle' && tx + w / 2 > o.x + o.w) anc = 'end'
      if (anc === 'middle' && tx - w / 2 < x0) anc = 'start'
      const ty = Math.max(o.y + 2.4, Y(m.v) + (m.dy ?? -2.2))
      l.texto(anc === 'end' && tx > o.x + o.w ? o.x + o.w : tx, ty, m.texto, { tam: m.tam ?? TAM.micro, color: m.color ?? l.c.tinta, anc, peso: 'negrita' })
    }
  }
  return { X, Y, x0, x1, y0, y1 }
}

/** Ancho de una etiqueta (mm); sin Lienzo, una estimación a 6,5 pt. */
export type Medir = (s: string) => number
const estimar: Medir = s => s.length * 1.1
/** Hueco mínimo entre dos etiquetas del eje x (mm). */
const SEP_ETQ = 3

/** ¿Ninguna etiqueta pisa a la anterior? `pos` da la x de cada índice. */
function sinPisarse(xs: EtiquetaX[], pos: (i: number) => number, medir: Medir): boolean {
  const ext = (e: EtiquetaX): [number, number] => {
    const w = medir(e.t), x = pos(e.i)
    return e.anc === 'start' ? [x, x + w] : e.anc === 'end' ? [x - w, x] : [x - w / 2, x + w / 2]
  }
  return xs.every((e, k) => !k || ext(e)[0] >= ext(xs[k - 1]!)[1] + SEP_ETQ)
}

/**
 * Etiquetas del eje x para días seguidos: la primera, la última y alguna en medio, medidas para que no se pisen.
 * Una semana: cada día («X 14») o, si no caben, solo la letra («X»). Hasta 2 meses: cada 7 días («21 sep», «28 sep»…);
 * con más: el primer día de cada mes («oct», «nov»…, y el año en enero), a saltos iguales.
 */
export function etiquetasFechas(dias: string[], anchoMm: number, o: { medir?: Medir; barras?: boolean } = {}): EtiquetaX[] {
  const medir = o.medir ?? estimar, barras = !!o.barras
  const n = dias.length
  if (!n) return []
  if (n === 1) return [{ i: 0, t: fechaCorta(dias[0]!) }]
  const pos = (i: number) => (barras ? ((i + 0.5) * anchoMm) / n : (i * anchoMm) / (n - 1))
  const cabe = (xs: EtiquetaX[]) => sinPisarse(xs, pos, medir)
  if (n <= 8) {
    const anc = (i: number): Ancla => (barras || (i > 0 && i < n - 1) ? 'middle' : i === 0 ? 'start' : 'end')
    const letra = (f: string) => DIAS_CORTOS[(deISO(f).getDay() + 6) % 7]!
    const conDia = dias.map((f, i) => ({ i, t: `${letra(f)} ${deISO(f).getDate()}`, anc: anc(i) }))
    if (cabe(conDia)) return conDia
    const letras = dias.map((f, i) => ({ i, t: letra(f), anc: anc(i) }))
    if (cabe(letras)) return letras
    return letras.filter(e => e.i % 2 === 0 || e.i === n - 1)
  }
  const largo = n > 62
  const cand: EtiquetaX[] = []
  dias.forEach((f, i) => {
    if (i === 0 || i === n - 1) return
    if (largo) {
      const d = deISO(f)
      if (d.getDate() !== 1) return
      cand.push({ i, t: d.getMonth() === 0 ? `${MESES_CORTOS[0]} ${d.getFullYear()}` : MESES_CORTOS[d.getMonth()]! })
    } else if (i % 7 === 0) cand.push({ i, t: fechaCorta(f) })
  })
  const primera: EtiquetaX = { i: 0, t: largo ? `${fechaCorta(dias[0]!)} ${deISO(dias[0]!).getFullYear()}` : fechaCorta(dias[0]!), anc: 'start' }
  const ultima: EtiquetaX = { i: n - 1, t: fechaCorta(dias[n - 1]!), anc: 'end' }
  // Fuera las que pisan la primera o la última; de las demás, todas o una de cada k (siempre a saltos iguales).
  const libres = cand.filter(c => cabe([primera, c]) && cabe([c, ultima]))
  for (const k of [1, 2, 3, 4, 6, 12]) {
    const xs = [primera, ...libres.filter((_, j) => j % k === 0), ultima]
    if (cabe(xs)) return xs
  }
  return cabe([primera, ultima]) ? [primera, ultima] : [primera]
}

/**
 * Etiquetas de puntos sueltos (una sesión en cada hueco): la primera, la última y las de en medio a saltos iguales,
 * con la fecha corta de todas las gráficas («22 sep») y sin pisarse.
 */
export function etiquetasPuntos(fechas: string[], anchoMm: number, medir: Medir): EtiquetaX[] {
  const n = fechas.length
  if (!n) return []
  if (n === 1) return [{ i: 0, t: fechaCorta(fechas[0]!) }]
  const pos = (i: number) => (i * anchoMm) / (n - 1)
  const e = (i: number): EtiquetaX => ({ i, t: fechaCorta(fechas[i]!), anc: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' })
  for (let paso = 1; paso < n; paso++) {
    const xs = [e(0)]
    for (let i = paso; i < n - 1; i += paso) if (n - 1 - i >= paso * 0.6) xs.push(e(i))
    xs.push(e(n - 1))
    if (sinPisarse(xs, pos, medir)) return xs
  }
  return sinPisarse([e(0), e(n - 1)], pos, medir) ? [e(0), e(n - 1)] : [e(n - 1)]
}

/** Índice de una fecha dentro de los días del periodo. */
export const indiceDia = (inicio: string, fecha: string) => diasEntre(inicio, fecha)

export type FilaZonas = { etq: string; valor: number; texto: string; cortes: [number, number]; dominio: [number, number]; palabra: string; tono: string }

/** Altura de las filas de zonas. */
export const altoZonas = (filas: number) => 5.5 + 0.6 + filas * (10.5 + 0.6)

/**
 * Filas de zonas (Bajo / Estándar / Alto o Poco / Bien / Mucho): la escala es por tramos para que cada zona ocupe
 * siempre lo mismo. Cada fila sombrea sus zonas (la sana en claro de la marca, las otras en gris), marca el valor con
 * un punto y encima escribe el número y la palabra de la app en su color; debajo, solo los límites entre zonas.
 */
export function filasZonas(l: Lienzo, x: number, y: number, o: { w: number; filas: FilaZonas[]; nombres?: string[]; anchos?: number[]; col?: number }) {
  const nombres = o.nombres ?? [t('Bajo'), t('Estándar'), t('Alto')]
  const anchos = o.anchos ?? [0.24, 0.32, 0.44]
  const col = o.col ?? 34, w = o.w
  const fh = 10.5, hh = 5.5, gap = 0.6
  const pista0 = x + col + 2, pista1 = x + w - 2
  const pw = pista1 - pista0
  l.rect(x, y, col, hh, l.fondoCab())
  let acc = 0
  nombres.forEach((nm, i) => {
    const xa = pista0 + acc * pw, wa = anchos[i]! * pw
    // La primera y la última caja llegan hasta donde llegan las filas de debajo.
    const desde = i === 0 ? x + col + 0.5 : xa, hasta = i === nombres.length - 1 ? x + w : xa + wa - 0.5
    l.rect(desde, y, hasta - desde, hh, i === 1 ? l.fondoCab() : l.c.zonaClara)
    l.texto(xa + wa / 2, y + hh - 1.6, nm, { tam: TAM.peque, color: i === 1 ? l.letraCab() : l.c.gris, anc: 'middle' })
    acc += anchos[i]!
  })
  o.filas.forEach((f, k) => {
    const yy = y + hh + gap + k * (fh + gap)
    const fEtq = l.fondoCasilla(l.c.celdaEtq), fPista = l.fondoCasilla(l.c.celda)
    if (fEtq) l.rect(x, yy, col, fh, fEtq)
    if (l.estilo.casillas === 'rayas') l.linea(x, yy + fh + gap / 2, x + w, yy + fh + gap / 2, l.c.linea, 0.2)
    const etq = l.partir(f.etq, col - 3, TAM.cuerpo)
    etq.slice(0, 2).forEach((tx, j) => l.texto(x + 2, yy + fh / 2 + 1 + (j - (Math.min(2, etq.length) - 1) / 2) * 3.4, tx, { tam: TAM.cuerpo, color: l.c.tinta }))
    if (fPista) l.rect(x + col + 0.5, yy, w - col - 0.5, fh, fPista)
    const [a, b] = f.cortes, [mn, mx] = f.dominio
    const tramo: [number, number][] = [[mn, a], [a, b], [b, mx]]
    const X = (v: number) => {
      let base = 0
      for (let i = 0; i < 3; i++) {
        const [p, q] = tramo[i]!
        if (v <= q || i === 2) return pista0 + (base + anchos[i]! * Math.min(1, Math.max(0, q > p ? (v - p) / (q - p) : 1))) * pw
        base += anchos[i]!
      }
      return pista1
    }
    // Las tres zonas sombreadas dentro de la pista, con un hilo blanco entre ellas.
    const ty = yy + 4.6, th = 2.2
    let xa = pista0
    anchos.forEach((an, i) => {
      const wa = an * pw
      const iz = i ? 0.25 : 0, de = i < anchos.length - 1 ? 0.25 : 0
      l.rect(xa + iz, ty, wa - iz - de, th, i === 1 ? l.c.zonaSana : l.c.zonaClara)
      xa += wa
    })
    // Solo los límites entre zonas, debajo.
    const ta = num(a, 2), tb = num(b, 2)
    const xa1 = X(a), xb1 = X(b)
    l.texto(xa1, yy + fh - 0.9, ta, { tam: TAM.micro, color: l.c.gris, anc: 'middle' })
    if (xb1 - xa1 > (l.ancho(ta, TAM.micro) + l.ancho(tb, TAM.micro)) / 2 + 1) l.texto(xb1, yy + fh - 0.9, tb, { tam: TAM.micro, color: l.c.gris, anc: 'middle' })
    // El valor: un punto en la pista y, encima, el número y su palabra (el color nunca va solo).
    const xv = X(f.valor)
    l.circulo(xv, ty + th / 2, 1.35, l.c.cab, l.c.blanco, 0.4)
    const wNum = l.ancho(f.texto, TAM.cuerpo, 'negrita'), wPal = l.ancho(f.palabra, TAM.peque, 'negrita')
    const x0 = Math.min(Math.max(xv - wNum / 2, pista0 - 1), x + w - (wNum + 1.4 + wPal))
    l.texto(x0, yy + 3.4, f.texto, { tam: TAM.cuerpo, color: l.c.tinta, peso: 'negrita' })
    l.texto(x0 + wNum + 1.4, yy + 3.4, f.palabra, { tam: TAM.peque, color: f.tono, peso: 'negrita' })
  })
  return altoZonas(o.filas.length)
}
