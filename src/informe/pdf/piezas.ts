// Piezas que se repiten en el PDF (§2 del diseño): páginas con su cabecera y pie, el flujo que pasa de página
// cuando un bloque no cabe, títulos, notas, fichas, chips de esfuerzo, el logo y la caja de consejo.
import type { PDFDocument, PDFImage } from 'pdf-lib'
import type { Informe, TonoInforme } from '../calculo/tipos'
import { ALTO_A4, ANCHO_A4, Lienzo, MM, TAM, type Ancla, type Fuentes, type Medidor, type Tema, type Trozo } from './lienzo'
import { t, tc } from '../../i18n'

type PdfLib = typeof import('pdf-lib')

/** Márgenes (mm): 14 a los lados; el contenido acaba a 18 mm del borde de abajo. */
export const IZQ = 14
const DER = ANCHO_A4 - 14
export const ANCHO = DER - IZQ
/** Hasta dónde llega el contenido: 3 mm por encima de la raya del pie (una nota al final no la roza). */
const FONDO = 281.5
/** Dónde empieza el contenido en las páginas con la cabecera de una línea. */
const ARRIBA = 19.1

/** Mezcla un color con blanco (fondo de chips y etiquetas). */
export function claro(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const m = (c: number) => Math.round(255 - (255 - c) * a).toString(16).padStart(2, '0')
  return `#${m((n >> 16) & 255)}${m((n >> 8) & 255)}${m(n & 255)}`
}

export class Maqueta {
  readonly paginas: Lienzo[] = []

  /** `icono`: el de la app ya metido en el PDF; sin él, el logo se dibuja. */
  constructor(readonly lib: PdfLib, readonly doc: PDFDocument, readonly fuentes: Fuentes, readonly inf: Informe, readonly tema: Tema, readonly icono: PDFImage | null) {}

  private nueva(): Lienzo {
    const p = this.doc.addPage([ANCHO_A4 * MM, ALTO_A4 * MM])
    const l = new Lienzo(this.lib, p, this.fuentes, this.tema)
    this.paginas.push(l)
    return l
  }

  /** Portada al estilo Fitdays: título enorme, la marca a la derecha y la banda gris con los datos. Devuelve dónde sigue. */
  portada(): { l: Lienzo; y: number } {
    const l = this.nueva()
    const cab = this.inf.cabecera
    if (l.estilo.portada === 'franja') l.rect(0, 0, ANCHO_A4, 3.2, l.estilo.acento)
    l.texto(IZQ, 20.6, cab.titulo, { tam: TAM.h1, peso: 'titulo', color: l.c.titulo })
    const wMarca = l.ancho('JowyFit', TAM.h2)
    l.texto(DER, 18.6, 'JowyFit', { tam: TAM.h2, color: l.c.titulo, anc: 'end' })
    logo(l, this.icono, DER - wMarca - 2 - 8, 12.4, 8)
    // Banda: los datos repartidos de lado a lado; lo último, más pequeño y en gris.
    const y0 = 25, h = 7.7
    if (l.estilo.portada === 'rayas') {
      l.linea(IZQ, y0, DER, y0, l.c.titulo, 0.5)
      l.linea(IZQ, y0 + h, DER, y0 + h, l.c.linea, 0.25)
    } else l.rect(IZQ, y0, ANCHO, h, l.c.banda)
    const items: Trozo[][] = []
    if (cab.nombre) items.push([{ t: `${t('Nombre:')} ` }, { t: cab.nombre, peso: 'negrita' }])
    if (cab.sexo) items.push([{ t: cab.sexo }])
    if (cab.edad != null) items.push([{ t: tc('pdf', '{n} años', { n: cab.edad }) }])
    if (cab.alturaCm != null) items.push([{ t: `${cab.alturaCm} cm` }])
    items.push([{ t: `${t('Periodo:')} ` }, { t: cab.periodo, peso: 'negrita' }])
    // La fecha de creación ya va en el pie de cada página: aquí solo «Comparado con…» (Hoy y Ayer).
    const ultimo = cab.comparado ?? ''
    let tam: number = TAM.cuerpo
    const tamUlt = () => (tam === TAM.cuerpo ? TAM.peque : TAM.micro)
    const anchos = () => items.map(it => it.reduce((s, tr) => s + l.ancho(tr.t, tam, tr.peso), 0))
    const wUlt = () => l.ancho(ultimo, tamUlt())
    if (anchos().reduce((a, b) => a + b, 0) + wUlt() + 4 * items.length > ANCHO - 8) tam = TAM.peque
    const ws = anchos()
    const libre = ANCHO - 8 - ws.reduce((a, b) => a + b, 0) - wUlt()
    const hueco = libre / Math.max(1, items.length - (ultimo ? 0 : 1))
    let x = IZQ + (l.estilo.portada === 'rayas' ? 0 : 4)
    const base = y0 + h / 2 + 1.1
    items.forEach((it, i) => {
      let xx = x
      for (const tr of it) xx += l.texto(xx, base, tr.t, { tam, peso: tr.peso, color: l.c.titulo })
      x += ws[i]! + hueco
    })
    if (ultimo) l.texto(DER - (l.estilo.portada === 'rayas' ? 0 : 4), base, ultimo, { tam: tamUlt(), color: l.c.gris, anc: 'end' })
    return { l, y: y0 + h + 3 }
  }

  /** Página con la cabecera de una línea (logo + JowyFit · Informe de progreso … nombre · periodo). */
  corrida(): Lienzo {
    const l = this.nueva()
    const cab = this.inf.cabecera
    if (l.estilo.portada === 'franja') l.rect(0, 0, ANCHO_A4, 1.6, l.estilo.acento)
    logo(l, this.icono, IZQ, 10.9, 5)
    const x = IZQ + 6.5
    const w1 = l.texto(x, 14.9, 'JowyFit', { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo })
    const w2 = l.texto(x + w1 + 1.2, 14.9, `· ${cab.titulo}`, { tam: TAM.peque, color: l.c.gris })
    const derecha = [cab.nombre, cab.periodo].filter(Boolean).join(' · ')
    l.texto(DER, 14.9, l.cortar(derecha, DER - (x + w1 + w2 + 8), TAM.peque), { tam: TAM.peque, color: l.c.gris, anc: 'end' })
    l.linea(IZQ, 18.1, DER, 18.1, l.c.linea, 0.25)
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
      l.linea(IZQ, 284.6, DER, 284.6, l.c.linea, 0.25)
      const w = l.texto(IZQ, 288.4, 'JowyFit', { tam: TAM.micro, peso: 'negrita', color: l.c.naranja })
      l.texto(IZQ + w, 288.4, ` · ${cab.creadoPie} · ${t('Tus datos solo están en tu móvil')}`, { tam: TAM.micro, color: l.c.gris })
      l.texto(DER, 288.4, t('Página {n} de {total}', { n: i + 1, total }), { tam: TAM.micro, color: l.c.gris, anc: 'end' })
    })
  }
}

/** Una columna que va bajando por las páginas: si un bloque no cabe, pasa entero a la siguiente. */
export class Flujo {
  /** Dónde empezó la columna en la página actual. */
  private inicio: number
  /** Lo que se repite arriba de cada página nueva de la columna (el título de la sección con «(sigue)»). Devuelve su alto. */
  alSaltar: ((l: Lienzo, y: number) => number) | null = null

  constructor(readonly maq: Maqueta, public pag: number, public y: number, readonly x = IZQ, readonly w = ANCHO, readonly arriba = ARRIBA) {
    this.inicio = y
  }

  get l(): Lienzo { return this.maq.pagina(this.pag) }
  /** ¿No hay nada aún en esta página de la columna? (un título ahí lleva menos margen arriba) */
  get alPrincipio(): boolean { return this.y <= this.inicio + 0.01 }
  /** Margen de arriba de un título: menos al principio de la columna. */
  margen(normal = 4.2): number { return this.alPrincipio ? (this.inicio > ARRIBA + 1 ? 1 : 3) : normal }
  cabe(h: number): boolean { return this.y + h <= FONDO }
  saltar() {
    this.pag++
    this.maq.pagina(this.pag)
    this.y = this.arriba
    if (this.alSaltar) this.y += this.alSaltar(this.l, this.y)
    this.inicio = this.y
  }
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

/** Alto de un título de sección (h2) con su raya. */
export const altoH2 = (margen: number) => margen + 4.2 + 2.9 + 2.1

/** Título de sección (14 pt; 11 si no cabe) con un subtítulo pequeño al lado y la raya fina debajo. Devuelve su alto. */
export function h2(l: Lienzo, x: number, y: number, w: number, texto: string, sub: string | null = null, margen = 4.2): number {
  const base = y + margen + 4.2
  const sangria = adorno(l, x, base, TAM.h2)
  const wDisp = w - sangria
  const tam = l.ancho(texto, TAM.h2, 'titulo') <= wDisp ? TAM.h2 : TAM.h3
  const wt = sangria + l.texto(x + sangria, base, l.cortar(texto, wDisp, tam, 'titulo'), { tam, peso: 'titulo', color: l.c.titulo })
  if (sub && w - wt - 2.2 > 12) l.texto(x + wt + 2.2, base, l.cortar(sub, w - wt - 2.2, TAM.peque), { tam: TAM.peque, color: l.c.gris })
  raya(l, x, base + 2.9, w, wt)
  return altoH2(margen)
}

export const altoH3 = (margen: number) => margen + 3.6 + 2.3 + 1.8

/** Título del lateral (11 pt). */
export function h3(l: Lienzo, x: number, y: number, w: number, texto: string, sub: string | null = null, margen = 3.6): number {
  const base = y + margen + 3.6
  const sangria = adorno(l, x, base, TAM.h3)
  const wt = sangria + l.texto(x + sangria, base, l.cortar(texto, w - sangria, TAM.h3, 'titulo'), { tam: TAM.h3, peso: 'titulo', color: l.c.titulo })
  if (sub) l.texto(x + wt + 2, base, l.cortar(sub, w - wt - 2, TAM.peque), { tam: TAM.peque, color: l.c.gris })
  raya(l, x, base + 2.3, w, wt)
  return altoH3(margen)
}

/** Adorno delante de un título según el estilo (barrita o cuadrito de color). Devuelve cuánto se corre el texto. */
function adorno(l: Lienzo, x: number, base: number, tam: number): number {
  const alto = tam * 0.3528 * 0.74
  if (l.estilo.h2 === 'barra') { l.rect(x, base - alto, 1.1, alto + 0.2, l.estilo.acento); return 2.8 }
  if (l.estilo.h2 === 'cuadro') { const t = alto * 0.52; l.rect(x, base - alto / 2 - t / 2, t, t, l.estilo.acento, 0.3); return t + 2 }
  return 0
}

/** Raya debajo de un título: fina, o fina con un tramo grueso de color bajo el texto («gruesa»). */
function raya(l: Lienzo, x: number, y: number, w: number, wTexto: number) {
  l.linea(x, y, x + w, y, l.c.linea, 0.25)
  if (l.estilo.h2 === 'gruesa') l.rect(x, y - 0.45, Math.min(w, wTexto), 0.9, l.estilo.acento)
}

const INTER_NOTA = TAM.micro * 0.3528 * 1.4

export function altoNota(l: Medidor, texto: string, w: number, sangria = 0): number {
  return 1.2 + l.partir(texto, w - sangria, TAM.micro).length * INTER_NOTA + 0.6
}

/** Nota pequeña en gris (6,5 pt). Con `estrella`, empieza con la estrella de récord dibujada. */
export function nota(l: Lienzo, x: number, y: number, w: number, texto: string, o: { color?: string; estrella?: boolean } = {}): number {
  const sangria = o.estrella ? 3 : 0
  const lineas = l.partir(texto, w - sangria, TAM.micro)
  if (o.estrella) l.estrella(x + 1.2, y + 1.2 + 1.7, 1.2)
  lineas.forEach((t, i) => l.texto(x + sangria, y + 1.2 + 2.4 + i * INTER_NOTA, t, { tam: TAM.micro, color: o.color ?? l.c.gris }))
  return 1.2 + lineas.length * INTER_NOTA + 0.6
}

type FormaLeyenda = 'cuadro' | 'linea' | 'raya' | 'punto' | 'anillo'

/** Título pequeño de una gráfica (8,5 pt negrita) con leyenda a la derecha. */
export function tituloGrafica(l: Lienzo, x: number, y: number, w: number, texto: string, leyenda: { t: string; color: string; forma?: FormaLeyenda }[] = [], derecha?: string): number {
  const base = y + 1.6 + 2.6
  l.texto(x, base, texto, { tam: TAM.cuerpo, peso: 'negrita', color: l.c.titulo })
  let xx = x + w
  if (derecha) l.texto(xx, base, derecha, { tam: TAM.micro, color: l.c.gris, anc: 'end' })
  for (const it of [...leyenda].reverse()) {
    const wt = l.ancho(it.t, TAM.micro)
    xx -= wt
    l.texto(xx, base, it.t, { tam: TAM.micro, color: l.c.gris })
    xx -= 0.8
    if (it.forma === 'linea') { l.rect(xx - 3, base - 1.2, 3, 0.6, it.color); xx -= 3 }
    else if (it.forma === 'raya') { l.linea(xx - 3.4, base - 0.9, xx, base - 0.9, it.color, 0.3, [0.9, 0.6]); xx -= 3.4 }
    else if (it.forma === 'punto') { l.circulo(xx - 1, base - 0.9, 0.85, it.color); xx -= 2 }
    else if (it.forma === 'anillo') { l.circulo(xx - 1, base - 0.9, 0.8, l.c.blanco, it.color, 0.35); xx -= 2 }
    else { l.rect(xx - 2, base - 1.9, 2, 2, it.color); xx -= 2 }
    xx -= 1.6
  }
  return 1.6 + 2.6 + 1.2
}

/** El logo de la app: el icono (PNG) si está; si no, el cuadrado de color con la mancuerna, dibujado con rectángulos. */
function logo(l: Lienzo, icono: PDFImage | null, x: number, y: number, t: number) {
  if (icono) { l.imagen(icono, x, y, t, t); return }
  const s = t / 512
  l.rect(x, y, t, t, l.c.logo, 112 * s)
  for (const [rx, ry, rw, rh, rr] of [[128, 241, 256, 30, 10], [116, 168, 44, 176, 14], [76, 204, 34, 104, 12], [352, 168, 44, 176, 14], [402, 204, 34, 104, 12]] as const) {
    l.rect(x + rx * s, y + ry * s, rw * s, rh * s, l.c.blanco, rr * s)
  }
}

/** Chip con fondo claro del mismo color («Vas bien»). Devuelve el ancho. */
export function chip(l: Lienzo, x: number, y: number, texto: string, color: string, tam: number = TAM.cuerpo): number {
  const w = l.ancho(texto, tam, 'negrita') + 5
  const h = tam * 0.3528 + 2.2
  l.rect(x, y, w, h, claro(color, 0.12), h / 2)
  l.texto(x + 2.5, y + h / 2 + tam * 0.3528 * 0.36, texto, { tam, peso: 'negrita', color })
  return w
}

const anchoChip = (l: Medidor, texto: string, tam: number = TAM.micro) => l.ancho(texto, tam, 'negrita') + 5

/** Etiqueta pequeña de color («semana de prueba»). Devuelve el ancho. */
export function etiqueta(l: Lienzo, x: number, base: number, texto: string): number {
  const w = l.ancho(texto, TAM.micro) + 2.4
  l.rect(x, base - 2.5, w, 3.3, claro(l.c.azul, 0.1), 1)
  l.texto(x + 1.2, base, texto, { tam: TAM.micro, color: l.c.azul })
  return w
}

/** Esfuerzo con su punto de color: «● 8,2 bien». Devuelve el ancho. */
export function chipEsfuerzo(l: Lienzo, x: number, base: number, texto: string, tono: TonoInforme, tam: number = TAM.peque, anc: Ancla = 'start'): number {
  const color = l.tono[tono]
  const w = 2.8 + l.ancho(texto, tam, 'negrita')
  const x0 = anc === 'end' ? x - w : x
  l.circulo(x0 + 0.9, base - 1.05, 0.9, color)
  l.texto(x0 + 2.8, base, texto, { tam, peso: 'negrita', color })
  return w
}

export type Ficha = {
  etq: string
  grande: string
  peque?: string
  /** Cómo está, con su palabra en un chip de color («bien», «Corta»): el color nunca va solo. */
  estado?: { texto: string; color: string } | null
  /** Valor de texto (nombre del entreno): más pequeño. */
  txt?: boolean
  cambio?: { dir: 'sube' | 'baja' | 'igual'; texto: string; color: string } | null
  sub?: string
}

export const altoFichas = (conCambio: boolean) => (conCambio ? 20.6 : 16.6)

/** Fila de fichas con borde: etiqueta en mayúsculas, número grande en tinta, su estado en un chip y una línea de contexto. */
export function fichas(l: Lienzo, x: number, y: number, w: number, fs: Ficha[], gap = 2): number {
  const conCambio = fs.some(f => f.cambio !== undefined)
  const h = altoFichas(conCambio)
  const wf = (w - gap * (fs.length - 1)) / fs.length
  fs.forEach((f, i) => {
    const fx = x + i * (wf + gap)
    if (l.estilo.fichas === 'relleno') l.rect(fx, y, wf, h, l.c.celda, 1.5)
    else if (l.estilo.fichas === 'borde') l.marco(fx, y, wf, h, l.estilo.borde, 0.3, 1.5)
    else { l.marco(fx, y, wf, h, l.estilo.borde, 0.3); l.rect(fx, y, wf, 0.9, l.estilo.acento) }
    const pad = 2.5, ancho = wf - 2 * pad
    const tam = f.txt ? TAM.h3 : TAM.kpi
    const base = y + 10.6
    const wPeque = f.peque ? l.ancho(` ${f.peque}`, TAM.cuerpo) : 0
    const grande = l.cortar(f.grande, ancho - wPeque, tam, 'negrita')
    const wg = l.ancho(grande, tam, 'negrita')
    // El chip del estado: junto al número si cabe; si no, arriba a la derecha (y la etiqueta se acorta).
    const wChip = f.estado ? anchoChip(l, f.estado.texto) : 0
    const chipAlLado = !!f.estado && wg + wPeque + 1.5 + wChip <= ancho
    if (f.estado) {
      if (chipAlLado) chip(l, fx + pad + wg + wPeque + 1.5, base - 3.4, f.estado.texto, f.estado.color, TAM.micro)
      else chip(l, fx + wf - pad - wChip, y + 1.6, f.estado.texto, f.estado.color, TAM.micro)
    }
    const wEtq = f.estado && !chipAlLado ? ancho - wChip - 1.5 : ancho
    l.texto(fx + pad, y + 4.3, l.cortar(f.etq.toUpperCase(), wEtq, TAM.micro, 'negrita'), { tam: TAM.micro, peso: 'negrita', color: l.c.gris, espaciado: 0.3 })
    l.texto(fx + pad, base, grande, { tam, peso: 'negrita', color: l.c.tinta })
    if (f.peque) l.texto(fx + pad + wg + 1, base, l.cortar(f.peque, ancho - wg - 1, TAM.cuerpo), { tam: TAM.cuerpo, color: l.c.gris })
    let ys = y + 14.3
    if (conCambio) {
      if (f.cambio) {
        const wfl = l.flecha(fx + pad, y + 14.6, f.cambio.dir, f.cambio.color, 1.1)
        l.texto(fx + pad + wfl + 1.2, y + 14.6, l.cortar(f.cambio.texto, ancho - wfl - 1.2, TAM.cuerpo, 'negrita'), { tam: TAM.cuerpo, peso: 'negrita', color: f.cambio.color })
      }
      ys = y + 18.3
    }
    if (f.sub) l.texto(fx + pad, ys, l.cortar(f.sub, ancho, TAM.micro), { tam: TAM.micro, color: l.c.gris })
  })
  return h
}

export const FILA_KV = 4.9

/** Lista nombre ↔ valor del lateral (Control de peso, Otros indicadores): nombre en tinta, valor en negrita. */
export function kv(l: Lienzo, x: number, y: number, w: number, filas: { nombre: string; valor: string; color?: string }[], tam: number = TAM.peque): number {
  filas.forEach((f, i) => {
    const base = y + 3 + i * FILA_KV
    const wv = l.texto(x + w, base, f.valor, { tam, peso: 'negrita', color: f.color ?? l.c.tinta, anc: 'end' })
    l.texto(x, base, l.cortar(f.nombre, w - wv - 2, tam), { tam, color: l.c.tinta })
  })
  return filas.length * FILA_KV
}

const INTER_CONSEJO = 3.8

export function altoConsejo(l: Medidor, texto: string, w: number): number {
  return 2.2 + 3 + l.partir(texto, w - 6, TAM.cuerpo).length * INTER_CONSEJO + 1.8
}

/** Caja «Consejo»: fondo de color muy claro y título en mayúsculas del color de la marca. */
export function consejo(l: Lienzo, x: number, y: number, w: number, titulo: string, texto: string): number {
  const h = altoConsejo(l, texto, w)
  l.rect(x, y, w, h, l.c.fondoNaranja, 1.2)
  l.texto(x + 3, y + 2.2 + 2.4, titulo.toUpperCase(), { tam: TAM.micro, peso: 'negrita', color: l.c.naranja, espaciado: 0.3 })
  l.partir(texto, w - 6, TAM.cuerpo).forEach((t, i) => l.texto(x + 3, y + 2.2 + 3 + 3.1 + i * INTER_CONSEJO, t, { tam: TAM.cuerpo, color: l.c.tinta }))
  return h
}

/** Frase con la primera oración en negrita («**Buen día de fuerza.** Récord en…»). */
export function fraseConNegrita(texto: string): Trozo[] {
  const i = texto.indexOf('. ')
  if (i < 0) return [{ t: texto, peso: 'negrita' }]
  return [{ t: texto.slice(0, i + 1), peso: 'negrita' }, { t: texto.slice(i + 1) }]
}
