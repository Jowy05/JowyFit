// Piezas que se repiten en el PDF (§2 del diseño): páginas con su cabecera y pie, el flujo que pasa de página
// cuando un bloque no cabe, títulos, notas, fichas, tablas (Fitdays y de lista), chips de esfuerzo y el logo.
import type { PDFDocument, PDFImage } from 'pdf-lib'
import type { Informe, TonoInforme } from '../dominio/informe'
import { ALTO_A4, ANCHO_A4, C, ESTILO, Lienzo, MM, fondoCab, fondoCasilla, letraCab, type Ancla, type Fuentes, type Peso, type Trozo } from './lienzo'

type PdfLib = typeof import('pdf-lib')

/** Márgenes (mm): 14 a los lados; el contenido acaba a 18 mm del borde de abajo. */
export const IZQ = 14
export const DER = ANCHO_A4 - 14
export const ANCHO = DER - IZQ
/** Hasta dónde llega el contenido: 1 mm por encima de la raya del pie (como la maqueta). */
export const FONDO = 283.6
/** Dónde empieza el contenido en las páginas con la cabecera de una línea. */
export const ARRIBA = 19.1

/** Color de cada tono del informe. */
export const TONO: Record<TonoInforme, string> = {
  get ok() { return C.verde }, get warn() { return C.ambar }, get bad() { return C.rojo }, get gris() { return C.gris },
  get tinta() { return C.tinta }, get oro() { return C.oro }, get azul() { return C.facil },
}

/** Mezcla un color con blanco (fondo de chips y etiquetas). */
export function claro(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const m = (c: number) => Math.round(255 - (255 - c) * a).toString(16).padStart(2, '0')
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`
}

// ---------------------------------------------------------------- páginas y flujo

export class Maqueta {
  readonly paginas: Lienzo[] = []

  constructor(readonly lib: PdfLib, readonly doc: PDFDocument, readonly fuentes: Fuentes, readonly inf: Informe) {}

  private nueva(): Lienzo {
    const p = this.doc.addPage([ANCHO_A4 * MM, ALTO_A4 * MM])
    const l = new Lienzo(this.lib, p, this.fuentes)
    this.paginas.push(l)
    return l
  }

  /** Portada al estilo Fitdays: título enorme, la marca a la derecha y la banda gris con los datos. Devuelve dónde sigue. */
  portada(): { l: Lienzo; y: number } {
    const l = this.nueva()
    const cab = this.inf.cabecera
    if (ESTILO.portada === 'franja') l.rect(0, 0, ANCHO_A4, 3.2, ESTILO.acento)
    l.texto(IZQ, 20, cab.titulo, { tam: ESTILO.titulos === 'times' ? 27 : 25, peso: 'titulo', color: C.titulo })
    const wMarca = l.ancho('JowyFit', 15)
    l.texto(DER, 18.6, 'JowyFit', { tam: 15, color: C.titulo, anc: 'end' })
    logo(l, DER - wMarca - 2 - 8, 12.4, 8)
    // Banda: los datos repartidos de lado a lado; lo último, más pequeño y en gris.
    const y0 = 25, h = 7.7
    if (ESTILO.portada === 'rayas') {
      l.linea(IZQ, y0, DER, y0, C.titulo, 0.5)
      l.linea(IZQ, y0 + h, DER, y0 + h, C.linea, 0.25)
    } else l.rect(IZQ, y0, ANCHO, h, C.banda)
    const items: Trozo[][] = []
    if (cab.nombre) items.push([{ t: 'Nombre: ' }, { t: cab.nombre, peso: 'negrita' }])
    if (cab.sexo) items.push([{ t: cab.sexo }])
    if (cab.edad != null) items.push([{ t: `${cab.edad} años` }])
    if (cab.alturaCm != null) items.push([{ t: `${cab.alturaCm} cm` }])
    items.push([{ t: 'Periodo: ' }, { t: cab.periodo, peso: 'negrita' }])
    const ultimo = cab.comparado ?? `Creado: ${cab.creado}`
    let tam = 8.5
    const anchos = () => items.map(it => it.reduce((s, tr) => s + l.ancho(tr.t, tam, tr.peso), 0))
    const wUlt = () => l.ancho(ultimo, tam - 1.5)
    while (tam > 6.5 && anchos().reduce((a, b) => a + b, 0) + wUlt() + 4 * (items.length) > ANCHO - 8) tam -= 0.5
    const ws = anchos()
    const libre = ANCHO - 8 - ws.reduce((a, b) => a + b, 0) - wUlt()
    const hueco = libre / Math.max(1, items.length)
    let x = IZQ + (ESTILO.portada === 'rayas' ? 0 : 4)
    const base = y0 + h / 2 + 1.1
    items.forEach((it, i) => {
      let xx = x
      for (const tr of it) xx += l.texto(xx, base, tr.t, { tam, peso: tr.peso, color: C.titulo })
      x += ws[i]! + hueco
    })
    l.texto(DER - (ESTILO.portada === 'rayas' ? 0 : 4), base, ultimo, { tam: tam - 1.5, color: C.gris, anc: 'end' })
    return { l, y: y0 + h + 3 }
  }

  /** Página con la cabecera de una línea (logo + JowyFit · Informe de progreso … nombre · periodo). */
  corrida(): Lienzo {
    const l = this.nueva()
    const cab = this.inf.cabecera
    if (ESTILO.portada === 'franja') l.rect(0, 0, ANCHO_A4, 1.6, ESTILO.acento)
    logo(l, IZQ, 10.9, 5)
    const x = IZQ + 6.5
    const w1 = l.texto(x, 14.9, 'JowyFit', { tam: 9.5, peso: 'negrita', color: C.titulo })
    const w2 = l.texto(x + w1 + 1.2, 14.9, `· ${cab.titulo}`, { tam: 8, color: C.gris })
    const derecha = [cab.nombre, cab.periodo].filter(Boolean).join(' · ')
    l.texto(DER, 14.9, l.cortar(derecha, DER - (x + w1 + w2 + 8), 8), { tam: 8, color: C.gris, anc: 'end' })
    l.linea(IZQ, 18.1, DER, 18.1, C.linea, 0.25)
    return l
  }

  /** La página n (si aún no existe, se crean las que falten con su cabecera). */
  pagina(n: number): Lienzo {
    while (this.paginas.length <= n) this.corrida()
    return this.paginas[n]!
  }

  /** Un flujo de ancho completo que empieza en una página nueva. */
  flujo(): Flujo {
    const n = this.paginas.length
    this.corrida()
    return new Flujo(this, n, ARRIBA)
  }

  /** Pie de todas las páginas (al final, cuando ya se sabe cuántas hay). */
  pies() {
    const total = this.paginas.length
    const cab = this.inf.cabecera
    this.paginas.forEach((l, i) => {
      l.linea(IZQ, 284.6, DER, 284.6, C.linea, 0.25)
      const w = l.texto(IZQ, 288.4, 'JowyFit', { tam: 7, peso: 'negrita', color: C.naranja })
      l.texto(IZQ + w, 288.4, ` · ${cab.creadoPie} · Tus datos solo están en tu móvil`, { tam: 7, color: C.gris })
      l.texto(DER, 288.4, `Página ${i + 1} de ${total}`, { tam: 7, color: C.gris, anc: 'end' })
    })
  }
}

/** Una columna que va bajando por las páginas: si un bloque no cabe, pasa entero a la siguiente. */
export class Flujo {
  /** Dónde empezó la columna en la página actual. */
  private inicio: number

  constructor(readonly maq: Maqueta, public pag: number, public y: number, readonly x = IZQ, readonly w = ANCHO, readonly arriba = ARRIBA) {
    this.inicio = y
  }

  get l(): Lienzo { return this.maq.pagina(this.pag) }
  /** ¿No hay nada aún en esta página de la columna? (un título ahí lleva menos margen arriba) */
  get alPrincipio(): boolean { return this.y <= this.inicio + 0.01 }
  /** Margen de arriba de un título: menos al principio de la columna. */
  margen(normal = 4.2): number { return this.alPrincipio ? (this.inicio > ARRIBA + 1 ? 1 : 3) : normal }
  cabe(h: number): boolean { return this.y + h <= FONDO }
  saltar() { this.pag++; this.maq.pagina(this.pag); this.y = this.arriba; this.inicio = this.arriba }
  /** Reserva `h` mm (en esta página o en la siguiente) y dice dónde dibujar. */
  sitio(h: number): { l: Lienzo; y: number } {
    if (!this.cabe(h) && !this.alPrincipio) this.saltar()
    const r = { l: this.l, y: this.y }
    this.y += h
    return r
  }
  espacio(h: number) { this.y += h }
  /** Si no quedan `h` mm en esta página, pasa a la siguiente (para no dejar un título solo al final). */
  asegurar(h: number) { if (!this.cabe(h) && !this.alPrincipio) this.saltar() }
  /**
   * Un bloque que empieza con un título: su alto depende del margen de arriba (menos al principio de la página).
   * Si no cabe, pasa entero a la página siguiente.
   */
  bloque(alto: (margen: number) => number, dibujar: (l: Lienzo, y: number, margen: number) => void) {
    let m = this.margen()
    if (!this.cabe(alto(m)) && !this.alPrincipio) { this.saltar(); m = this.margen() }
    const h = alto(m)
    dibujar(this.l, this.y, m)
    this.y += h
  }
}

// ---------------------------------------------------------------- títulos y notas

/** Alto de un título de sección (h2) con su raya. `primero`: arriba de la página o de la columna. */
export const altoH2 = (margen: number) => margen + 4.2 + 2.9 + 2.1

/** Título de sección (13,5 pt) con un subtítulo pequeño al lado y la raya fina debajo. Devuelve su alto. */
export function h2(l: Lienzo, x: number, y: number, w: number, texto: string, sub: string | null = null, margen = 4.2): number {
  const base = y + margen + 4.2
  let tam = ESTILO.titulos === 'times' ? 15 : 13.5
  const sangria = adorno(l, x, base, tam, ESTILO.h2)
  const wDisp = w - sangria
  while (tam > 11 && l.ancho(texto, tam, 'titulo') > wDisp) tam -= 0.5
  const wt = sangria + l.texto(x + sangria, base, l.cortar(texto, wDisp, tam, 'titulo'), { tam, peso: 'titulo', color: C.titulo })
  if (sub && w - wt - 2.2 > 12) l.texto(x + wt + 2.2, base, l.cortar(sub, w - wt - 2.2, 7), { tam: 7, color: C.gris })
  raya(l, x, base + 2.9, w, wt)
  return altoH2(margen)
}

export const altoH3 = (margen: number) => margen + 3.6 + 2.3 + 1.8

/** Título del lateral (11,5 pt). */
export function h3(l: Lienzo, x: number, y: number, w: number, texto: string, sub: string | null = null, margen = 3.6): number {
  const base = y + margen + 3.6
  const tam = ESTILO.titulos === 'times' ? 13 : 11.5
  const sangria = adorno(l, x, base, tam, ESTILO.h2)
  const wt = sangria + l.texto(x + sangria, base, l.cortar(texto, w - sangria, tam, 'titulo'), { tam, peso: 'titulo', color: C.titulo })
  if (sub) l.texto(x + wt + 2, base, l.cortar(sub, w - wt - 2, 7), { tam: 7, color: C.gris })
  raya(l, x, base + 2.3, w, wt)
  return altoH3(margen)
}

/** Adorno delante de un título según el estilo (barrita o cuadrito de color). Devuelve cuánto se corre el texto. */
function adorno(l: Lienzo, x: number, base: number, tam: number, tipo: typeof ESTILO.h2): number {
  const alto = tam * 0.3528 * 0.74
  if (tipo === 'barra') { l.rect(x, base - alto, 1.1, alto + 0.2, ESTILO.acento); return 2.8 }
  if (tipo === 'cuadro') { const t = alto * 0.52; l.rect(x, base - alto / 2 - t / 2, t, t, ESTILO.acento, 0.3); return t + 2 }
  return 0
}

/** Raya debajo de un título: fina, o fina con un tramo grueso de color bajo el texto («gruesa»). */
function raya(l: Lienzo, x: number, y: number, w: number, wTexto: number) {
  l.linea(x, y, x + w, y, C.linea, 0.25)
  if (ESTILO.h2 === 'gruesa') l.rect(x, y - 0.45, Math.min(w, wTexto), 0.9, ESTILO.acento)
}

const INTER_NOTA = 6.8 * 0.3528 * 1.35

/** Alto de una nota pequeña en gris. */
export function altoNota(l: Lienzo, texto: string, w: number, sangria = 0): number {
  return 1.2 + l.partir(texto, w - sangria, 6.8).length * INTER_NOTA + 0.6
}

/** Nota pequeña en gris (6,8 pt). Con `estrella`, empieza con la estrella de récord dibujada. */
export function nota(l: Lienzo, x: number, y: number, w: number, texto: string, o: { color?: string; estrella?: boolean } = {}): number {
  const sangria = o.estrella ? 3 : 0
  const lineas = l.partir(texto, w - sangria, 6.8)
  if (o.estrella) l.estrella(x + 1.2, y + 1.2 + 1.7, 1.2)
  lineas.forEach((t, i) => l.texto(x + sangria, y + 1.2 + 2.4 + i * INTER_NOTA, t, { tam: 6.8, color: o.color ?? C.gris }))
  return 1.2 + lineas.length * INTER_NOTA + 0.6
}

/** Título pequeño de una gráfica (8 pt negrita) con leyenda a la derecha. */
export function tituloGrafica(l: Lienzo, x: number, y: number, w: number, texto: string, leyenda: { t: string; color: string; forma?: 'cuadro' | 'linea' | 'punto' }[] = [], derecha?: string): number {
  const base = y + 1.6 + 2.6
  l.texto(x, base, texto, { tam: 8, peso: 'negrita', color: C.titulo })
  let xx = x + w
  if (derecha) l.texto(xx, base, derecha, { tam: 6.5, color: C.gris, anc: 'end' })
  for (const it of [...leyenda].reverse()) {
    const wt = l.ancho(it.t, 6.5)
    xx -= wt
    l.texto(xx, base, it.t, { tam: 6.5, color: C.gris })
    xx -= 0.8
    if (it.forma === 'linea') { l.rect(xx - 3, base - 1.2, 3, 0.6, it.color); xx -= 3 }
    else if (it.forma === 'punto') { l.circulo(xx - 1, base - 0.9, 1, it.color); xx -= 2 }
    else { l.rect(xx - 2, base - 1.9, 2, 2, it.color); xx -= 2 }
    xx -= 1.6
  }
  return 1.6 + 2.6 + 1.2
}

// ---------------------------------------------------------------- logo, chips y flechas

let ICONO: PDFImage | null = null
/** El icono de la app ya metido en el PDF (o null para volver al dibujado). */
export function ponerIcono(img: PDFImage | null) { ICONO = img }

/** El logo de la app: el icono (PNG) si está; si no, el cuadrado de color con la mancuerna, dibujado con rectángulos. */
export function logo(l: Lienzo, x: number, y: number, t: number) {
  if (ICONO) { l.imagen(ICONO, x, y, t, t); return }
  const s = t / 512
  l.rect(x, y, t, t, C.logo, 112 * s)
  for (const [rx, ry, rw, rh, rr] of [[128, 241, 256, 30, 10], [116, 168, 44, 176, 14], [76, 204, 34, 104, 12], [352, 168, 44, 176, 14], [402, 204, 34, 104, 12]] as const) {
    l.rect(x + rx * s, y + ry * s, rw * s, rh * s, C.blanco, rr * s)
  }
}

/** Chip con fondo claro del mismo color («Vas bien»). Devuelve el ancho. */
export function chip(l: Lienzo, x: number, y: number, texto: string, color: string, tam = 9): number {
  const w = l.ancho(texto, tam, 'negrita') + 5
  const h = tam * 0.3528 + 2.2
  l.rect(x, y, w, h, claro(color, 0.12), h / 2)
  l.texto(x + 2.5, y + h / 2 + tam * 0.3528 * 0.36, texto, { tam, peso: 'negrita', color })
  return w
}

/** Etiqueta pequeña azul («semana de prueba»). Devuelve el ancho. */
export function etiqueta(l: Lienzo, x: number, base: number, texto: string): number {
  const w = l.ancho(texto, 6.3) + 2.4
  l.rect(x, base - 2.5, w, 3.3, claro(C.azul, 0.08), 1)
  l.texto(x + 1.2, base, texto, { tam: 6.3, color: C.azul })
  return w
}

/** Esfuerzo con su punto de color: «● 8,2 bien». Devuelve el ancho. */
export function chipEsfuerzo(l: Lienzo, x: number, base: number, texto: string, tono: TonoInforme, tam = 7.9, anc: Ancla = 'start'): number {
  const color = TONO[tono]
  const w = 2.8 + l.ancho(texto, tam, 'negrita')
  const x0 = anc === 'end' ? x - w : x
  l.circulo(x0 + 0.9, base - 1.05, 0.9, color)
  l.texto(x0 + 2.8, base, texto, { tam, peso: 'negrita', color })
  return w
}

// ---------------------------------------------------------------- fichas (KPI)

export type Ficha = {
  etq: string
  grande: string
  peque?: string
  color?: string
  /** Valor de texto (nombre del entreno): más pequeño. */
  txt?: boolean
  cambio?: { dir: 'sube' | 'baja' | 'igual'; texto: string; color: string } | null
  sub?: string
}

export const altoFichas = (conCambio: boolean) => (conCambio ? 20.3 : 16.3)

/** Fila de fichas grises con etiqueta en mayúsculas, número grande y una línea de contexto. */
export function fichas(l: Lienzo, x: number, y: number, w: number, fs: Ficha[], gap = 2): number {
  const conCambio = fs.some(f => f.cambio !== undefined)
  const h = altoFichas(conCambio)
  const wf = (w - gap * (fs.length - 1)) / fs.length
  fs.forEach((f, i) => {
    const fx = x + i * (wf + gap)
    if (ESTILO.fichas === 'relleno') l.rect(fx, y, wf, h, C.celda, 1.5)
    else if (ESTILO.fichas === 'borde') l.marco(fx, y, wf, h, ESTILO.borde, 0.3, 1.5)
    else { l.marco(fx, y, wf, h, ESTILO.borde, 0.3); l.rect(fx, y, wf, 0.9, ESTILO.acento) }
    const pad = 2.5, ancho = wf - 2 * pad
    l.texto(fx + pad, y + 4.3, l.cortar(f.etq.toUpperCase(), ancho, 6.5, 'negrita'), { tam: 6.5, peso: 'negrita', color: C.gris, espaciado: 0.3 })
    const tam = f.txt ? 10.5 : 14
    const grande = l.cortar(f.grande, ancho - (f.peque ? l.ancho(` ${f.peque}`, 8) : 0), tam, 'negrita')
    const wg = l.texto(fx + pad, y + 10.1, grande, { tam, peso: 'negrita', color: f.color ?? C.tinta })
    if (f.peque) l.texto(fx + pad + wg + 1, y + 10.1, l.cortar(f.peque, ancho - wg - 1, 8), { tam: 8, color: C.gris })
    let ys = y + 13.9
    if (conCambio) {
      if (f.cambio) {
        const wfl = l.flecha(fx + pad, y + 14.2, f.cambio.dir, f.cambio.color, 1.1)
        l.texto(fx + pad + wfl + 1.2, y + 14.2, f.cambio.texto, { tam: 8.5, peso: 'negrita', color: f.cambio.color })
      }
      ys = y + 17.8
    }
    if (f.sub) l.texto(fx + pad, ys, l.cortar(f.sub, ancho, 6.5), { tam: 6.5, color: C.gris })
  })
  return h
}

// ---------------------------------------------------------------- lista nombre ↔ valor

export const FILA_KV = 4.9

/** Lista nombre ↔ valor del lateral (Control de peso, Otros indicadores). */
export function kv(l: Lienzo, x: number, y: number, w: number, filas: { nombre: string; valor: string; color?: string }[], tam = 8): number {
  filas.forEach((f, i) => {
    const base = y + 3 + i * FILA_KV
    const wv = l.texto(x + w, base, f.valor, { tam, peso: 'negrita', color: f.color ?? C.tinta, anc: 'end' })
    l.texto(x, base, l.cortar(f.nombre, w - wv - 2, tam), { tam, color: C.titulo })
  })
  return filas.length * FILA_KV
}

// ---------------------------------------------------------------- tablas

/** Celda de tabla: texto (con su estilo) o un dibujo propio. */
export type Celda = string | null | {
  t?: string
  peso?: Peso
  color?: string
  /** Dibujo propio en la celda; `base` es la línea base del texto. */
  dibujar?: (l: Lienzo, x: number, base: number, w: number) => void
  /** Si no cabe, se escribe un poco más pequeño antes de cortarlo (nombres de ejercicios). */
  encoger?: boolean
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

export const altoCabecera = (compacta: boolean) => (compacta ? 5.6 : 5.9)
export const altoFila = (compacta: boolean) => (compacta ? 5.4 : 5.8)

/** Ajusta los anchos de las columnas al ancho de la tabla (la primera sin ancho se lleva lo que sobre). */
export function anchosDe(cols: Columna[], w: number): Columna[] {
  const fijo = cols.reduce((s, c) => s + (c.w > 0 ? c.w : 0), 0)
  const libres = cols.filter(c => !(c.w > 0)).length
  const resto = Math.max(10, (w - fijo) / Math.max(1, libres))
  const out = cols.map(c => ({ ...c, w: c.w > 0 ? c.w : resto }))
  const total = out.reduce((s, c) => s + c.w, 0)
  return total > w + 0.01 ? out.map(c => ({ ...c, w: (c.w * w) / total })) : out
}

/** Cabecera oscura de una tabla de lista. */
export function cabeceraTabla(l: Lienzo, x: number, y: number, cols: Columna[], compacta: boolean): number {
  const h = altoCabecera(compacta)
  const wTotal = cols.reduce((s, c) => s + c.w, 0)
  if (ESTILO.cabTabla === 'raya') l.linea(x, y + h - 0.2, x + wTotal, y + h - 0.2, C.titulo, 0.45)
  else l.rect(x, y, wTotal, h, fondoCab())
  const vs = ESTILO.versalitas
  const o = { tam: vs ? 6.4 : 7.5, color: letraCab(), peso: (vs ? 'negrita' : 'normal') as Peso, espaciado: vs ? 0.25 : 0 }
  let cx = x
  for (const c of cols) {
    const base = y + h / 2 + 0.95
    // En mayúsculas ocupan más: antes de cortar con «…», se quita el espaciado y se encoge un poco la letra.
    const oc = { ...o }
    const txt = vs ? c.t.toUpperCase() : c.t
    if (vs) while (oc.tam > 5.4 && l.ancho(txt, oc.tam, oc.peso, oc.espaciado) > c.w - 3.2) { oc.espaciado = 0; oc.tam -= 0.2 }
    const t = l.cortar(txt, c.w - 3.2, oc.tam, oc.peso)
    if (c.der) l.texto(cx + c.w - 1.6, base, t, { ...oc, anc: 'end' })
    else if (c.centro) l.texto(cx + c.w / 2, base, t, { ...oc, anc: 'middle' })
    else l.texto(cx + 1.6, base, t, oc)
    cx += c.w
  }
  return h
}

/** Una fila de una tabla de lista (filas alternas blanco / gris claro). */
export function filaTabla(l: Lienzo, x: number, y: number, cols: Columna[], fila: FilaTabla, par: boolean, compacta: boolean): number {
  const h = altoFila(compacta)
  const wTotal = cols.reduce((s, c) => s + c.w, 0)
  const tam = compacta ? 7.7 : 7.9
  if (fila.estilo === 'total') {
    l.linea(x, y + 0.15, x + wTotal, y + 0.15, C.titulo, 0.3)
  } else {
    if (par && ESTILO.cebra) l.rect(x, y, wTotal, h, C.celda)
    l.linea(x, y + h - 0.1, x + wTotal, y + h - 0.1, ESTILO.cebra ? C.rejilla : C.linea, 0.2)
  }
  const base = y + h / 2 + 1
  let cx = x
  cols.forEach((c, i) => {
    const cel = fila.celdas[i]
    if (cel == null) { cx += c.w; return }
    const o = typeof cel === 'string' ? { t: cel } : cel
    if (o.dibujar) o.dibujar(l, cx + 1.6, base, c.w - 3.2)
    else if (o.t) {
      const peso: Peso = fila.estilo === 'perdido' ? 'cursiva' : fila.estilo === 'total' ? 'negrita' : o.peso ?? 'normal'
      // En una fila gris, una celda con su propio color lo mantiene (el nombre del ejercicio en el anexo).
      const color = fila.estilo === 'perdido' ? C.grisSuave : fila.estilo === 'gris' ? o.color ?? C.gris : o.color ?? C.tinta
      const tt = o.encoger && l.ancho(o.t, tam, peso) > c.w - 3.2 ? tam - 0.7 : tam
      const t = l.cortar(o.t, c.w - 3.2, tt, peso)
      if (c.der) l.texto(cx + c.w - 1.6, base, t, { tam: tt, peso, color, anc: 'end' })
      else if (c.centro) l.texto(cx + c.w / 2, base, t, { tam: tt, peso, color, anc: 'middle' })
      else l.texto(cx + 1.6, base, t, { tam: tt, peso, color })
    }
    cx += c.w
  })
  return h
}

/** Tabla de lista en un sitio fijo (no se parte). Devuelve el alto. */
export function tabla(l: Lienzo, x: number, y: number, w: number, cols: Columna[], filas: FilaTabla[], o: { compacta?: boolean; sinCabecera?: boolean } = {}): number {
  const compacta = !!o.compacta
  const cs = anchosDe(cols, w)
  let yy = y
  if (!o.sinCabecera) yy += cabeceraTabla(l, x, yy, cs, compacta)
  filas.forEach((f, i) => { yy += filaTabla(l, x, yy, cs, f, f.fondo ?? i % 2 === 1, compacta) })
  return yy - y
}

export const altoTabla = (filas: number, compacta: boolean, sinCabecera = false) => (sinCabecera ? 0 : altoCabecera(compacta)) + filas * altoFila(compacta)

/**
 * Tabla larga que se parte por filas entre páginas, repitiendo la cabecera oscura. Antes va `titulo` (si lo hay):
 * el título, la cabecera y las primeras filas van siempre juntos.
 */
export function tablaPartida(f: Flujo, cols: Columna[], filas: FilaTabla[], o: { compacta?: boolean; titulo?: { alto: number; dibujar: (l: Lienzo, y: number, sigue: boolean) => void }; minFilas?: number } = {}) {
  const compacta = !!o.compacta
  const cs = anchosDe(cols, f.w)
  const hc = altoCabecera(compacta), hf = altoFila(compacta)
  const primeras = Math.min(filas.length, o.minFilas ?? 3)
  const inicio = (o.titulo?.alto ?? 0) + hc + primeras * hf
  if (!f.cabe(inicio) && !f.alPrincipio) f.saltar()
  if (o.titulo) { o.titulo.dibujar(f.l, f.y, false); f.y += o.titulo.alto }
  f.y += cabeceraTabla(f.l, f.x, f.y, cs, compacta)
  filas.forEach((fila, i) => {
    let fl = fila
    // Las filas de una tabla larga dejan 2 mm libres antes del pie.
    if (!f.cabe(hf + 2)) {
      f.saltar()
      if (o.titulo) { o.titulo.dibujar(f.l, f.y, true); f.y += o.titulo.alto }
      f.y += cabeceraTabla(f.l, f.x, f.y, cs, compacta)
      if (fila.sigue && fila.celdas[0] == null) fl = { ...fila, celdas: [{ t: fila.sigue, peso: 'negrita', color: C.tinta }, ...fila.celdas.slice(1)] }
    }
    f.y += filaTabla(f.l, f.x, f.y, cs, fl, fila.fondo ?? i % 2 === 1, compacta)
  })
}

// ---------------------------------------------------------------- tabla Fitdays (resumen y cuerpo)

export type FilaFitdays = { etq: string; celdas: (Celda | { junta: string })[]; evaluacion: { texto: string; color: string } }

const FD_CAB = 6.2, FD_FILA = 6.5, FD_HUECO = 0.5

export const altoFitdays = (filas: number, fila = FD_FILA) => FD_CAB + filas * (fila + FD_HUECO) + FD_HUECO

/**
 * Tabla al estilo Fitdays: cabecera oscura, primera columna gris más oscuro, celdas grises con huecos blancos,
 * valores centrados y la evaluación en negrita y en color. Una celda `{ junta }` ocupa dos columnas.
 */
export function tablaFitdays(l: Lienzo, x: number, y: number, anchos: number[], titulos: string[], filas: FilaFitdays[], FD_FILA = 6.5): number {
  let cx = x
  anchos.forEach((w, i) => {
    if (ESTILO.cabTabla === 'raya') l.linea(cx, y + FD_CAB - 0.2, cx + w, y + FD_CAB - 0.2, C.titulo, 0.45)
    else l.rect(cx, y, w, FD_CAB, fondoCab())
    const vs = ESTILO.versalitas
    if (titulos[i]) l.texto(cx + w / 2, y + FD_CAB / 2 + 1, l.cortar(vs ? titulos[i]!.toUpperCase() : titulos[i]!, w - 2, vs ? 6.6 : 8, vs ? 'negrita' : 'normal'), { tam: vs ? 6.6 : 8, peso: vs ? 'negrita' : 'normal', espaciado: vs ? 0.25 : 0, color: letraCab(), anc: 'middle' })
    cx += w + FD_HUECO
  })
  filas.forEach((f, k) => {
    const yy = y + FD_CAB + FD_HUECO + k * (FD_FILA + FD_HUECO)
    const base = yy + FD_FILA / 2 + 1.1
    casilla(l, x, yy, anchos[0]!, FD_FILA, C.celdaEtq)
    // Abiertas: una raya fina debajo de cada fila, de lado a lado.
    if (ESTILO.casillas === 'rayas') l.linea(x, yy + FD_FILA + FD_HUECO / 2, x + anchos.reduce((s, w) => s + w, 0) + FD_HUECO * (anchos.length - 1), yy + FD_FILA + FD_HUECO / 2, C.linea, 0.2)
    const wEtq = anchos[0]! - 3
    if (l.ancho(f.etq, 8.5) <= wEtq) l.texto(x + 1.8, base, f.etq, { tam: 8.5, color: C.titulo })
    else {
      // Nombres largos («Press de banca con barra (kg)»): a la misma letra que las demás filas, cortando el nombre y no la unidad.
      const m = / \([^)]*\)$/.exec(f.etq)
      const cola = m ? m[0] : ''
      const cabeza = cola ? f.etq.slice(0, -cola.length) : f.etq
      l.texto(x + 1.8, base, `${l.cortar(cabeza, wEtq - l.ancho(cola, 8.5), 8.5)}${cola}`, { tam: 8.5, color: C.titulo })
    }
    let col = 1
    let xx = x + anchos[0]! + FD_HUECO
    for (const cel of f.celdas) {
      if (col >= anchos.length - 1) break
      const junta = cel != null && typeof cel === 'object' && 'junta' in cel
      const w = junta ? anchos[col]! + FD_HUECO + anchos[col + 1]! : anchos[col]!
      casilla(l, xx, yy, w, FD_FILA, C.celda)
      if (junta) l.texto(xx + w / 2, base, l.cortar((cel as { junta: string }).junta, w - 2, 8.5), { tam: 8.5, anc: 'middle' })
      else if (cel != null) {
        const o = typeof cel === 'string' ? { t: cel } : (cel as Exclude<Celda, string | null>)
        if (o.dibujar) o.dibujar(l, xx + w / 2, base, w - 2)
        else if (o.t) l.texto(xx + w / 2, base, l.cortar(o.t, w - 2, 8.5, o.peso), { tam: 8.5, anc: 'middle', peso: o.peso, color: o.color ?? C.tinta })
      }
      xx += w + FD_HUECO
      col += junta ? 2 : 1
    }
    const we = anchos[anchos.length - 1]!
    casilla(l, xx, yy, we, FD_FILA, C.celda)
    l.texto(xx + we / 2, base, l.cortar(f.evaluacion.texto, we - 2, 8.5, 'negrita'), { tam: 8.5, peso: 'negrita', color: f.evaluacion.color, anc: 'middle' })
  })
  return altoFitdays(filas.length, FD_FILA)
}

function casilla(l: Lienzo, x: number, y: number, w: number, h: number, color: string) {
  const c = fondoCasilla(color)
  if (c) l.rect(x, y, w, h, c)
}

// ---------------------------------------------------------------- caja de consejo

export function altoConsejo(l: Lienzo, texto: string, w: number): number {
  return 2.2 + 3 + l.partir(texto, w - 5, 8).length * 3.6 + 1.8
}

/** Caja «Consejo»: fondo naranja muy claro, raya naranja a la izquierda y título en mayúsculas. */
export function consejo(l: Lienzo, x: number, y: number, w: number, titulo: string, texto: string): number {
  const h = altoConsejo(l, texto, w)
  l.rect(x, y, w, h, C.fondoNaranja)
  l.rect(x, y, 0.9, h, C.naranja)
  l.texto(x + 3.2, y + 2.2 + 2.4, titulo.toUpperCase(), { tam: 7.2, peso: 'negrita', color: C.naranja, espaciado: 0.3 })
  l.partir(texto, w - 5, 8).forEach((t, i) => l.texto(x + 3.2, y + 2.2 + 3 + 2.9 + i * 3.6, t, { tam: 8, color: C.tinta }))
  return h
}

/** Frase con la primera oración en negrita («**Buen día de fuerza.** Récord en…»). */
export function fraseConNegrita(texto: string): Trozo[] {
  const i = texto.indexOf('. ')
  if (i < 0) return [{ t: texto, peso: 'negrita' }]
  return [{ t: texto.slice(0, i + 1), peso: 'negrita' }, { t: texto.slice(i + 1) }]
}
