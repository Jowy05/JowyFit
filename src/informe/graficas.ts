// Gráficas vectoriales del PDF (§4 del diseño): una gráfica de líneas o barras con ejes redondos, bandas,
// rayas de objetivo fuera del área de dibujo y marcas (último dato, récord); y las filas de zonas al estilo Fitdays.
// Se dibujan sobre el Lienzo en mm; las medidas son las de la maqueta (.cache/pdf-maqueta/generar-maqueta.mjs).
import { num } from '../dominio/calculos'
import { MESES_CORTOS, deISO, diasEntre, fechaCorta } from '../dominio/fechas'
import { C, ESTILO, fondoCab, fondoCasilla, letraCab, type Ancla, type Lienzo } from './lienzo'

export type Eje = { min: number; max: number; marcas: number[] }

export type SerieGrafica = {
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
  /** Punto hueco (p. ej. % de grasa por medidas). */
  hueco?: (i: number) => boolean
}
export type BarraGrafica = { v: number | null; color?: string; etq?: string | null; partes?: { v: number; color: string }[] }
export type BandaGrafica = { desde: number; hasta: number; color: string; texto?: string; colorTexto?: string; fuera?: boolean }
export type LineaH = { v: number; color: string; ancho?: number; raya?: number[]; texto?: string; colorTexto?: string; fuera?: boolean; izq?: boolean; fondo?: boolean }
export type MarcaGrafica = { i: number; v: number; tipo?: 'hoy' | 'record' | 'primero'; texto?: string; dx?: number; dy?: number; anc?: Ancla; tam?: number; color?: string }
export type EtiquetaX = { i: number; t: string; anc?: Ancla }

export type OpcGrafica = {
  x: number; y: number; w: number; h: number
  /** Número de huecos en x (días del periodo, sesiones, semanas…). */
  n: number
  eje: Eje
  series?: SerieGrafica[]
  barras?: BarraGrafica[] | null
  /** Ancho máximo de cada barra (mm). */
  anchoBarra?: number
  bandas?: BandaGrafica[]
  lineasH?: LineaH[]
  marcas?: MarcaGrafica[]
  etiquetasX?: EtiquetaX[]
  ml?: number; mr?: number; mt?: number; mb?: number
  fmtY?: (v: number) => string
  /** Separación de los textos de fuera (a la derecha del área de dibujo). Más si el último punto va en el borde. */
  sepFuera?: number
  /** Hueco a cada lado en las líneas (sin barras): el primer punto no pisa los números del eje ni el último la etiqueta de fuera. */
  padX?: number
  /** Las líneas usan los huecos de las barras (para compartir el eje x con una gráfica de barras de encima). */
  xBarras?: boolean
}

/**
 * Eje de una gráfica pequeña de líneas (fuerza, peso, grasa, cintura): con un rango mínimo para que un cambio pequeño
 * no parezca un salto enorme (de 11 a 12 kg), y medio paso de eje por debajo del valor más bajo (que no caiga en la raya).
 */
export function ejeHolgado(valores: number[], rangoMin: number, marcasDeseadas = 3): Eje {
  const vs = valores.filter(Number.isFinite)
  if (!vs.length) return ejeDe(vs, marcasDeseadas)
  let lo = Math.min(...vs), hi = Math.max(...vs)
  if (hi - lo < rangoMin) { const c = (lo + hi) / 2; lo = c - rangoMin / 2; hi = c + rangoMin / 2 }
  let e = ejeDe([lo, hi], marcasDeseadas)
  const paso = (e.marcas[1] ?? e.max) - (e.marcas[0] ?? e.min) || 1
  const minimo = Math.min(...vs)
  if (minimo - e.min < paso / 2) e = ejeDe([minimo - paso / 2, hi], marcasDeseadas)
  // Los pesos y las medidas nunca bajan de 0.
  if (e.min < 0 && minimo >= 0) e = ejeDe([0, hi], marcasDeseadas)
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

export type Geometria = { X: (i: number) => number; Y: (v: number) => number; x0: number; x1: number; y0: number; y1: number }

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
      if (b.fuera) l.texto(x1 + (o.sepFuera ?? 1), (ya + yb) / 2 + 0.9, b.texto, { tam: 6, color: b.colorTexto ?? C.gris, peso: 'negrita' })
      else l.texto(x1 - 0.8, ya + 2.2, b.texto, { tam: 5.5, color: b.colorTexto ?? C.gris, anc: 'end' })
    }
  }
  for (const m of eje.marcas) {
    l.linea(x0, Y(m), x1, Y(m), C.rejilla, 0.2)
    l.texto(x0 - 1.2, Y(m) + 0.9, fmtY(m), { tam: 6, color: C.gris, anc: 'end' })
  }
  l.linea(x0, y1, x1, y1, C.linea, 0.3)
  for (const e of o.etiquetasX ?? []) l.texto(X(e.i), o.y + o.h - 1.2, e.t, { tam: 6, color: C.gris, anc: e.anc ?? 'middle' })
  if (barras) {
    const hueco = (x1 - x0) / Math.max(1, n)
    const bw = Math.min(o.anchoBarra ?? 4.5, hueco * (hueco < 1.6 ? 0.8 : 0.62))
    barras.forEach((b, i) => {
      if (b.v == null) { l.rect(X(i) - bw / 2, y1 - 0.6, bw, 0.6, C.linea); return }
      if (b.partes) {
        let base = Math.max(0, eje.min)
        for (const p of b.partes) { if (p.v > 0) l.rect(X(i) - bw / 2, Y(base + p.v), bw, Y(base) - Y(base + p.v), p.color); base += p.v }
      } else l.rect(X(i) - bw / 2, Y(b.v), bw, y1 - Y(b.v), b.color ?? C.azul)
      if (b.etq) l.texto(X(i), Y(b.v) - 1, b.etq, { tam: 6, color: C.tinta, anc: 'middle', peso: 'negrita' })
    })
  }
  for (const r of o.lineasH ?? []) {
    if (r.v < eje.min || r.v > eje.max) continue
    if (r.color !== 'none') l.linea(x0, Y(r.v), x1, Y(r.v), r.color, r.ancho ?? 0.3, r.raya ?? [1.2, 0.8])
  }
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
        if (s.hueco?.(i)) l.circulo(X(i), Y(v), s.r ?? 0.75, C.blanco, s.color, 0.35)
        else l.circulo(X(i), Y(v), s.r ?? 0.75, s.colorPunto?.(i, v) ?? s.color, C.blanco, 0.25)
      })
    }
  }
  for (const r of o.lineasH ?? []) {
    if (!r.texto || r.v < eje.min || r.v > eje.max) continue
    if (r.fuera) { l.texto(x1 + (o.sepFuera ?? 1), Y(r.v) + 0.9, r.texto, { tam: 5.8, color: r.colorTexto ?? r.color, peso: 'negrita' }); continue }
    const tx = r.izq ? x0 + 2.6 : x1 - 0.8
    if (r.fondo) {
      const w = l.ancho(r.texto, 5.8, 'negrita')
      l.rect(r.izq ? tx - 0.8 : tx - w - 0.8, Y(r.v) - 3.2, w + 1.6, 2.7, C.blanco, 0.6)
    }
    l.texto(tx, Y(r.v) - 0.9, r.texto, { tam: 5.8, color: r.colorTexto ?? r.color, anc: r.izq ? 'start' : 'end', peso: 'negrita' })
  }
  for (const m of o.marcas ?? []) {
    if (m.tipo === 'record') l.estrella(X(m.i), Y(m.v), 1.5)
    if (m.tipo === 'hoy') l.circulo(X(m.i), Y(m.v), 1.25, C.naranja, C.blanco, 0.35)
    if (m.tipo === 'primero') l.circulo(X(m.i), Y(m.v), 1.25, C.azul, C.blanco, 0.35)
    if (m.texto) {
      // El valor no se sale de la gráfica por arriba ni por los lados.
      let anc = m.anc ?? 'middle'
      const tx = X(m.i) + (m.dx ?? 0)
      const w = l.ancho(m.texto, m.tam ?? 6.5, 'negrita')
      if (anc === 'middle' && tx + w / 2 > o.x + o.w) anc = 'end'
      if (anc === 'middle' && tx - w / 2 < x0) anc = 'start'
      const ty = Math.max(o.y + 2.2, Y(m.v) + (m.dy ?? -2.2))
      l.texto(anc === 'end' && tx > o.x + o.w ? o.x + o.w : tx, ty, m.texto, { tam: m.tam ?? 6.5, color: m.color ?? C.tinta, anc, peso: 'negrita' })
    }
  }
  return { X, Y, x0, x1, y0, y1 }
}

// ---------------------------------------------------------------- etiquetas de fechas

/**
 * Etiquetas del eje x para días seguidos: la primera, la última y alguna en medio sin pisarse.
 * Hasta 2 meses: cada 7 días («21 sep», «28 sep»…); con más: el primer día de cada mes («oct», «nov»…, y el año en enero).
 */
export function etiquetasFechas(dias: string[], anchoMm: number, minGap = 13, barras = false): EtiquetaX[] {
  const n = dias.length
  if (!n) return []
  if (n === 1) return [{ i: 0, t: fechaCorta(dias[0]!) }]
  // Una semana: cada día con su letra («X 14», «J 15»…); si no caben todos, uno sí y otro no.
  if (n <= 8) {
    const hueco = barras ? anchoMm / n : anchoMm / (n - 1)
    const cada = hueco >= 7 ? 1 : 2
    return dias.flatMap((f, i) => (i % cada ? [] : [{ i, t: `${'LMXJVSD'[(deISO(f).getDay() + 6) % 7]} ${deISO(f).getDate()}`, anc: barras || (i > 0 && i < n - 1) ? 'middle' as const : i === 0 ? 'start' as const : 'end' as const }]))
  }
  const paso = anchoMm / (n - 1)
  const largo = n > 62
  const cand: EtiquetaX[] = []
  // Con meses: todos, o uno sí y otro no (o cada 3…), siempre a saltos iguales para que no parezca que falta alguno.
  const cada = largo ? [1, 2, 3, 4, 6, 12].find(k => k * 30.4 * paso >= minGap) ?? 12 : 1
  let k = 0
  dias.forEach((f, i) => {
    if (i === 0 || i === n - 1) return
    if (largo) {
      const d = deISO(f)
      if (d.getDate() !== 1) return
      if (k++ % cada) return
      cand.push({ i, t: d.getMonth() === 0 ? `${MESES_CORTOS[0]} ${d.getFullYear()}` : MESES_CORTOS[d.getMonth()]! })
    } else if (i % 7 === 0) cand.push({ i, t: fechaCorta(f) })
  })
  const primera: EtiquetaX = { i: 0, t: largo ? `${fechaCorta(dias[0]!)} ${deISO(dias[0]!).getFullYear()}` : fechaCorta(dias[0]!), anc: 'start' }
  const ultima: EtiquetaX = { i: n - 1, t: fechaCorta(dias[n - 1]!), anc: 'end' }
  const out: EtiquetaX[] = [primera]
  const gapIni = largo ? minGap + 5 : minGap
  for (const c of cand) {
    if ((c.i - out[out.length - 1]!.i) * paso < (out.length === 1 ? gapIni : minGap)) continue
    if ((n - 1 - c.i) * paso < minGap) continue
    out.push(c)
  }
  out.push(ultima)
  return out
}

/** Índice de una fecha dentro de los días del periodo. */
export const indiceDia = (inicio: string, fecha: string) => diasEntre(inicio, fecha)

// ---------------------------------------------------------------- zonas al estilo Fitdays

export type FilaZonas = { etq: string; valor: number; texto: string; cortes: [number, number]; dominio: [number, number]; marcas: number[]; palabra: string; tono: string }

/** Altura de las filas de zonas. */
export const altoZonas = (filas: number) => 5.5 + 0.6 + filas * (10.5 + 0.6)

/**
 * Filas de zonas (Bajo / Estándar / Alto o Poco / Bien / Mucho): la escala es por tramos para que cada zona ocupe
 * siempre lo mismo; una barra oscura hasta el valor, el número en negrita y la palabra de la app en su color.
 */
export function filasZonas(l: Lienzo, x: number, y: number, o: { w: number; filas: FilaZonas[]; nombres?: string[]; anchos?: number[]; col?: number }) {
  const nombres = o.nombres ?? ['Bajo', 'Estándar', 'Alto']
  const anchos = o.anchos ?? [0.24, 0.32, 0.44]
  const col = o.col ?? 34, w = o.w
  const fh = 10.5, hh = 5.5, gap = 0.6
  const pista0 = x + col + 1.5, pista1 = x + w - 2
  const pw = pista1 - pista0
  l.rect(x, y, col, hh, fondoCab())
  let acc = 0
  nombres.forEach((nm, i) => {
    const xa = pista0 + acc * pw, wa = anchos[i]! * pw
    // La primera y la última caja llegan hasta donde llegan las filas de debajo.
    const desde = i === 0 ? x + col + 0.5 : xa, hasta = i === nombres.length - 1 ? x + w : xa + wa - 0.5
    l.rect(desde, y, hasta - desde, hh, i === 1 ? fondoCab() : C.zonaClara)
    l.texto(xa + wa / 2, y + hh - 1.6, nm, { tam: 7.5, color: i === 1 ? letraCab() : C.titulo, anc: 'middle' })
    acc += anchos[i]!
  })
  o.filas.forEach((f, k) => {
    const yy = y + hh + gap + k * (fh + gap)
    const fEtq = fondoCasilla(C.celdaEtq), fPista = fondoCasilla(C.celda)
    if (fEtq) l.rect(x, yy, col, fh, fEtq)
    if (ESTILO.casillas === 'rayas') l.linea(x, yy + fh + gap / 2, x + w, yy + fh + gap / 2, C.linea, 0.2)
    const etq = l.partir(f.etq, col - 3, 8)
    etq.slice(0, 2).forEach((t, j) => l.texto(x + 2, yy + fh / 2 + 1 + (j - (Math.min(2, etq.length) - 1) / 2) * 3.3, t, { tam: 8, color: C.titulo }))
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
    const ty = yy + 3
    let ultimaX = -Infinity
    for (const m of f.marcas) {
      const t = num(m, 2)
      const mx2 = X(m)
      l.linea(mx2, ty + 0.6, mx2, ty + 1.4, C.grisSuave, 0.2)
      // Marcas muy juntas (15 y 18,5 en el IMC): se escribe solo la que no pisa a la anterior.
      const wt = l.ancho(t, 5.5)
      if (mx2 - wt / 2 > ultimaX + 0.6) { l.texto(mx2, ty, t, { tam: 5.5, color: C.grisSuave, anc: 'middle' }); ultimaX = mx2 + wt / 2 }
    }
    l.linea(pista0, ty + 1.4, pista1, ty + 1.4, C.grisSuave, 0.2)
    const by = yy + fh - 4.2
    const wNum = l.ancho(f.texto, 8.5, 'negrita'), wPal = l.ancho(f.palabra, 7, 'negrita')
    const fin = Math.min(X(f.valor), x + w - 1 - wNum - wPal - 3.6)
    l.rect(pista0, by, Math.max(0.8, fin - pista0), 2.1, C.cab, 0.6)
    l.texto(fin + 1.2, by + 2, f.texto, { tam: 8.5, color: C.tinta, peso: 'negrita' })
    l.texto(fin + 1.2 + wNum + 2.2, by + 2, f.palabra, { tam: 7, color: f.tono, peso: 'negrita' })
  })
  return altoZonas(o.filas.length)
}
