// Tablas del PDF: de lista (con su cabecera, que se parten entre páginas) y al estilo Fitdays (resumen y cuerpo).
import { TAM, type Lienzo, type Medidor, type Peso } from './lienzo'
import type { Flujo } from './piezas'

/** Celda de tabla: texto (con su estilo) o un dibujo propio. */
export type Celda = string | null | {
  t?: string
  peso?: Peso
  color?: string
  /** Dibujo propio en la celda; `base` es la línea base del texto. */
  dibujar?: (l: Lienzo, x: number, base: number, w: number) => void
  /** Si no cabe, se parte en dos líneas (nombres de ejercicios) en vez de cortarse. */
  partir?: boolean
  /** Estrella de récord delante del texto. */
  estrella?: boolean
}
export type Columna = { t: string; w: number; der?: boolean; centro?: boolean }
export type FilaTabla = {
  celdas: Celda[]
  estilo?: 'perdido' | 'total' | 'gris'
  /** Fondo gris de la fila (si no se dice, filas alternas). Sirve para alternar por grupos (cada ejercicio del anexo). */
  fondo?: boolean
  /** Si la tabla se parte justo antes de esta fila, su primera celda vacía lleva este texto («Curl (sigue)»). */
  sigue?: string
}

/** Separación entre las dos líneas de una celda o una cabecera partida. */
const INTER_CELDA = 3
const SANGRIA_ESTRELLA = 3.4

const altoCabecera = (compacta: boolean, lineas = 1) => (compacta ? 5.6 : 5.9) + (lineas - 1) * 2.7
const altoFila = (compacta: boolean, lineas = 1) => (compacta ? 5.4 : 5.8) + (lineas - 1) * INTER_CELDA

/** La palabra más ancha de la cabecera de una columna (ninguna palabra se corta: la columna crece lo justo). */
function palabraMasAncha(l: Medidor, texto: string): number {
  const vs = l.estilo.versalitas
  const txt = vs ? texto.toUpperCase() : texto
  return Math.max(0, ...txt.split(' ').map(p => l.ancho(p, vs ? TAM.micro : TAM.peque, vs ? 'negrita' : 'normal')))
}

/** Ajusta los anchos de las columnas al ancho de la tabla (la primera sin ancho se lleva lo que sobre). */
function anchosDe(cols: Columna[], w: number, l?: Medidor): Columna[] {
  const ancho = (c: Columna) => (c.w > 0 && l && c.t ? Math.max(c.w, palabraMasAncha(l, c.t) + 3.4) : c.w)
  const fijo = cols.reduce((s, c) => s + (c.w > 0 ? ancho(c) : 0), 0)
  const libres = cols.filter(c => !(c.w > 0)).length
  const resto = Math.max(10, (w - fijo) / Math.max(1, libres))
  const out = cols.map(c => ({ ...c, w: c.w > 0 ? ancho(c) : resto }))
  const total = out.reduce((s, c) => s + c.w, 0)
  return total > w + 0.01 ? out.map(c => ({ ...c, w: (c.w * w) / total })) : out
}

/** Hasta dos líneas de `w` mm (lo que no quepa en la segunda se corta con «…»). */
export function dosLineas(l: Medidor, texto: string, w: number, tam: number, peso: Peso = 'normal'): string[] {
  const ls = l.partir(texto, w, tam, peso)
  if (ls.length <= 2) return ls
  return [ls[0]!, l.cortar(ls.slice(1).join(' '), w, tam, peso)]
}

/** Texto de una cabecera de tabla: en una línea (con o sin espaciado) o, si no cabe, en dos, siempre a 6,5 pt. */
function textoCab(l: Medidor, texto: string, w: number): { lineas: string[]; espaciado: number } {
  const vs = l.estilo.versalitas
  const txt = vs ? texto.toUpperCase() : texto
  const tam = vs ? TAM.micro : TAM.peque, peso: Peso = vs ? 'negrita' : 'normal'
  if (vs && l.ancho(txt, tam, peso, 0.25) <= w) return { lineas: [txt], espaciado: 0.25 }
  if (l.ancho(txt, tam, peso) <= w) return { lineas: [txt], espaciado: 0 }
  return { lineas: dosLineas(l, txt, w, tam, peso), espaciado: 0 }
}

/** Líneas de la cabecera (1 o 2). */
const lineasCabecera = (l: Medidor, cols: Columna[]) => Math.max(1, ...cols.map(c => (c.t ? textoCab(l, c.t, c.w - 3.2).lineas.length : 1)))

/** Cabecera de una tabla de lista (banda clara u oscura según el estilo). Las que no caben van en dos líneas. */
function cabeceraTabla(l: Lienzo, x: number, y: number, cols: Columna[], compacta: boolean): number {
  const n = lineasCabecera(l, cols)
  const h = altoCabecera(compacta, n)
  const wTotal = cols.reduce((s, c) => s + c.w, 0)
  if (l.estilo.cabTabla === 'raya') l.linea(x, y + h - 0.2, x + wTotal, y + h - 0.2, l.c.titulo, 0.45)
  else l.rect(x, y, wTotal, h, l.fondoCab())
  const vs = l.estilo.versalitas
  const o = { tam: vs ? TAM.micro : TAM.peque, color: l.letraCab(), peso: (vs ? 'negrita' : 'normal') as Peso }
  let cx = x
  for (const c of cols) {
    const { lineas, espaciado } = textoCab(l, c.t, c.w - 3.2)
    // Las de una línea, centradas en la banda; las de dos, de arriba abajo.
    const base0 = y + h / 2 + 0.95 - ((lineas.length - 1) * 2.7) / 2
    lineas.forEach((tx, i) => {
      const oc = { ...o, espaciado }
      const base = base0 + i * 2.7
      if (c.der) l.texto(cx + c.w - 1.6, base, tx, { ...oc, anc: 'end' })
      else if (c.centro) l.texto(cx + c.w / 2, base, tx, { ...oc, anc: 'middle' })
      else l.texto(cx + 1.6, base, tx, oc)
    })
    cx += c.w
  }
  return h
}

const TAM_FILA = TAM.peque

/** Peso con que se escribe una celda de texto en su fila. */
const pesoCelda = (fila: FilaTabla, o: Exclude<Celda, string | null>): Peso => (fila.estilo === 'perdido' ? 'cursiva' : fila.estilo === 'total' ? 'negrita' : o.peso ?? 'normal')

/** Líneas de una celda: las que se pueden partir, hasta dos; las demás, una (cortada si no cabe). */
function lineasCelda(l: Medidor, c: Columna, cel: Celda, fila: FilaTabla): string[] {
  if (cel == null) return []
  const o = typeof cel === 'string' ? { t: cel } : cel
  if (!o.t || o.dibujar) return []
  const w = c.w - 3.2 - (o.estrella ? SANGRIA_ESTRELLA : 0)
  const peso = pesoCelda(fila, o)
  return o.partir ? dosLineas(l, o.t, w, TAM_FILA, peso) : [l.cortar(o.t, w, TAM_FILA, peso)]
}

/** Alto de una fila (más alta si algún nombre va en dos líneas). */
function altoFilaDe(l: Medidor, cols: Columna[], fila: FilaTabla, compacta: boolean): number {
  const n = Math.max(1, ...cols.map((c, i) => lineasCelda(l, c, fila.celdas[i] ?? null, fila).length))
  return altoFila(compacta, n)
}

/** Una fila de una tabla de lista (filas alternas blanco / gris claro). */
function filaTabla(l: Lienzo, x: number, y: number, cols: Columna[], fila: FilaTabla, par: boolean, compacta: boolean): number {
  const h = altoFilaDe(l, cols, fila, compacta)
  const wTotal = cols.reduce((s, c) => s + c.w, 0)
  if (fila.estilo === 'total') {
    l.linea(x, y + 0.15, x + wTotal, y + 0.15, l.c.titulo, 0.3)
  } else {
    if (par && l.estilo.cebra) l.rect(x, y, wTotal, h, l.c.celda)
    l.linea(x, y + h - 0.1, x + wTotal, y + h - 0.1, l.estilo.cebra ? l.c.rejilla : l.c.linea, 0.2)
  }
  const base = y + h / 2 + 1
  let cx = x
  cols.forEach((c, i) => {
    const cel = fila.celdas[i]
    if (cel == null) { cx += c.w; return }
    const o = typeof cel === 'string' ? { t: cel } : cel
    if (o.dibujar) o.dibujar(l, cx + 1.6, base, c.w - 3.2)
    else if (o.t) {
      const peso = pesoCelda(fila, o)
      // En una fila gris, una celda con su propio color lo mantiene (el nombre del ejercicio en el anexo).
      const color = fila.estilo === 'perdido' ? l.c.grisSuave : fila.estilo === 'gris' ? o.color ?? l.c.gris : o.color ?? l.c.tinta
      const lineas = lineasCelda(l, c, cel, fila)
      const b0 = base - ((lineas.length - 1) * INTER_CELDA) / 2
      const sangria = o.estrella ? SANGRIA_ESTRELLA : 0
      if (o.estrella) l.estrella(cx + 1.6 + 1.2, b0 - 1.1, 1.3)
      lineas.forEach((tx, k) => {
        const b = b0 + k * INTER_CELDA
        if (c.der) l.texto(cx + c.w - 1.6, b, tx, { tam: TAM_FILA, peso, color, anc: 'end' })
        else if (c.centro) l.texto(cx + c.w / 2, b, tx, { tam: TAM_FILA, peso, color, anc: 'middle' })
        else l.texto(cx + 1.6 + sangria, b, tx, { tam: TAM_FILA, peso, color })
      })
    }
    cx += c.w
  })
  return h
}

/** Tabla de lista en un sitio fijo (no se parte). Devuelve el alto. */
export function tabla(l: Lienzo, x: number, y: number, w: number, cols: Columna[], filas: FilaTabla[], o: { compacta?: boolean; sinCabecera?: boolean } = {}): number {
  const compacta = !!o.compacta
  const cs = anchosDe(cols, w, l)
  let yy = y
  if (!o.sinCabecera) yy += cabeceraTabla(l, x, yy, cs, compacta)
  filas.forEach((f, i) => { yy += filaTabla(l, x, yy, cs, f, f.fondo ?? i % 2 === 1, compacta) })
  return yy - y
}

/** Alto exacto de una tabla: con las cabeceras y los nombres que van en dos líneas. */
export function altoTablaDe(l: Medidor, w: number, cols: Columna[], filas: FilaTabla[], o: { compacta?: boolean; sinCabecera?: boolean } = {}): number {
  const compacta = !!o.compacta
  const cs = anchosDe(cols, w, l)
  return (o.sinCabecera ? 0 : altoCabecera(compacta, lineasCabecera(l, cs))) + filas.reduce((s, f) => s + altoFilaDe(l, cs, f, compacta), 0)
}

/** Alto hasta el que una tabla se mantiene entera (mm). */
const TABLA_CORTA = 60

/**
 * Tabla larga que se parte por filas entre páginas, repitiendo la cabecera. Antes va `titulo` (si lo hay):
 * el título, la cabecera y las primeras filas van siempre juntos.
 */
export function tablaPartida(f: Flujo, cols: Columna[], filas: FilaTabla[], o: { compacta?: boolean; titulo?: { alto: number; dibujar: (l: Lienzo, y: number, sigue: boolean) => void }; minFilas?: number } = {}) {
  const compacta = !!o.compacta
  const cs = anchosDe(cols, f.w, f.l)
  const hc = altoCabecera(compacta, lineasCabecera(f.l, cs))
  const altos = filas.map(fl => altoFilaDe(f.l, cs, fl, compacta))
  const primeras = altos.slice(0, Math.min(filas.length, o.minFilas ?? 3)).reduce((s, h) => s + h, 0)
  const inicio = (o.titulo?.alto ?? 0) + hc + primeras
  // Una tabla corta (una comida del anexo) no se parte: si no cabe entera, pasa entera a la página siguiente.
  const entera = (o.titulo?.alto ?? 0) + hc + altos.reduce((s, h) => s + h, 0)
  if (!f.alPrincipio && (!f.cabe(inicio) || (entera <= TABLA_CORTA && !f.cabe(entera)))) f.saltar()
  if (o.titulo) { o.titulo.dibujar(f.l, f.y, false); f.y += o.titulo.alto }
  f.y += cabeceraTabla(f.l, f.x, f.y, cs, compacta)
  filas.forEach((fila, i) => {
    let fl = fila
    // Las filas de una tabla larga dejan 2 mm libres antes del pie.
    if (!f.cabe(altos[i]! + 2)) {
      f.saltar()
      if (o.titulo) { o.titulo.dibujar(f.l, f.y, true); f.y += o.titulo.alto }
      f.y += cabeceraTabla(f.l, f.x, f.y, cs, compacta)
      if (fila.sigue && fila.celdas[0] == null) fl = { ...fila, celdas: [{ t: fila.sigue, peso: 'negrita', color: f.l.c.tinta, partir: true }, ...fila.celdas.slice(1)] }
    }
    f.y += filaTabla(f.l, f.x, f.y, cs, fl, fila.fondo ?? i % 2 === 1, compacta)
  })
}

type FilaFitdays = { etq: string; celdas: (Celda | { junta: string })[]; evaluacion: { texto: string; color: string } }

const FD_CAB = 6.2, FD_FILA = 6.5, FD_HUECO = 0.5, FD_INTER = 3.4

/** Líneas del nombre de una fila (hasta dos: «Press de banca con / barra (kg)»). */
const lineasEtq = (l: Medidor, etq: string, w: number) => dosLineas(l, etq, w - 3, TAM.cuerpo)
const lineasTitulo = (l: Medidor, titulo: string, w: number) => (titulo ? textoCab(l, titulo, w - 2).lineas : [])

/** Alto de una tabla Fitdays: la cabecera y las filas crecen si algo va en dos líneas. */
export function altoFitdays(l: Medidor, anchos: number[], titulos: string[], etqs: string[], fila = FD_FILA): number {
  const nCab = Math.max(1, ...titulos.map((tt, i) => lineasTitulo(l, tt, anchos[i]!).length))
  return FD_CAB + (nCab - 1) * 2.7 + etqs.reduce((s, e) => s + fila + (lineasEtq(l, e, anchos[0]!).length - 1) * FD_INTER + FD_HUECO, 0) + FD_HUECO
}

/**
 * Tabla al estilo Fitdays: cabecera de color, primera columna con el nombre (en dos líneas si es largo), valores
 * centrados y la evaluación en negrita y en color. Una celda `{ junta }` ocupa dos columnas.
 */
export function tablaFitdays(l: Lienzo, x: number, y: number, anchos: number[], titulos: string[], filas: FilaFitdays[], fila = FD_FILA): number {
  const nCab = Math.max(1, ...titulos.map((tt, i) => lineasTitulo(l, tt, anchos[i]!).length))
  const hCab = FD_CAB + (nCab - 1) * 2.7
  const wTotal = anchos.reduce((s, w) => s + w, 0) + FD_HUECO * (anchos.length - 1)
  const vs = l.estilo.versalitas
  let cx = x
  anchos.forEach((w, i) => {
    if (l.estilo.cabTabla === 'raya') l.linea(cx, y + hCab - 0.2, cx + w, y + hCab - 0.2, l.c.titulo, 0.45)
    else l.rect(cx, y, w, hCab, l.fondoCab())
    const tt = titulos[i]
    if (tt) {
      const { lineas, espaciado } = textoCab(l, tt, w - 2)
      const b0 = y + hCab / 2 + 1 - ((lineas.length - 1) * 2.7) / 2
      // La primera columna (el nombre de la tabla) va a la izquierda, como los nombres de las filas.
      lineas.forEach((ln, k) => l.texto(i === 0 ? cx + 1.8 : cx + w / 2, b0 + k * 2.7, ln, { tam: vs ? TAM.micro : TAM.peque, peso: vs ? 'negrita' : 'normal', espaciado, color: l.letraCab(), anc: i === 0 ? 'start' : 'middle' }))
    }
    cx += w + FD_HUECO
  })
  let yy = y + hCab + FD_HUECO
  for (const f of filas) {
    const etq = lineasEtq(l, f.etq, anchos[0]!)
    const fh = fila + (etq.length - 1) * FD_INTER
    const base = yy + fh / 2 + 1.1
    casilla(l, x, yy, anchos[0]!, fh, l.c.celdaEtq)
    // Abiertas: una raya fina debajo de cada fila, de lado a lado.
    if (l.estilo.casillas === 'rayas') l.linea(x, yy + fh + FD_HUECO / 2, x + wTotal, yy + fh + FD_HUECO / 2, l.c.linea, 0.2)
    etq.forEach((ln, k) => l.texto(x + 1.8, base + (k - (etq.length - 1) / 2) * FD_INTER, ln, { tam: TAM.cuerpo, color: l.c.tinta }))
    let col = 1
    let xx = x + anchos[0]! + FD_HUECO
    for (const cel of f.celdas) {
      if (col >= anchos.length - 1) break
      const junta = cel != null && typeof cel === 'object' && 'junta' in cel
      const w = junta ? anchos[col]! + FD_HUECO + anchos[col + 1]! : anchos[col]!
      casilla(l, xx, yy, w, fh, l.c.celda)
      if (junta) l.texto(xx + w / 2, base, l.cortar((cel as { junta: string }).junta, w - 2, TAM.cuerpo), { tam: TAM.cuerpo, anc: 'middle' })
      else if (cel != null) {
        const o = typeof cel === 'string' ? { t: cel } : (cel as Exclude<Celda, string | null>)
        if (o.dibujar) o.dibujar(l, xx + w / 2, base, w - 2)
        else if (o.t) l.texto(xx + w / 2, base, l.cortar(o.t, w - 2, TAM.cuerpo, o.peso), { tam: TAM.cuerpo, anc: 'middle', peso: o.peso, color: o.color ?? l.c.tinta })
      }
      xx += w + FD_HUECO
      col += junta ? 2 : 1
    }
    const we = anchos[anchos.length - 1]!
    casilla(l, xx, yy, we, fh, l.c.celda)
    l.texto(xx + we / 2, base, l.cortar(f.evaluacion.texto, we - 2, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: f.evaluacion.color, anc: 'middle' })
    yy += fh + FD_HUECO
  }
  return yy + FD_HUECO - y
}

function casilla(l: Lienzo, x: number, y: number, w: number, h: number, color: string) {
  const c = l.fondoCasilla(color)
  if (c) l.rect(x, y, w, h, c)
}
