// Dibujo del PDF en milímetros con el origen arriba a la izquierda (como la maqueta), sobre pdf-lib.
// Las formas van como trazos SVG (pdf-lib les da la vuelta al eje y); el texto, con la Helvetica estándar.
import type { PDFFont, PDFPage } from 'pdf-lib'
import { textoPdf } from './texto'

type PdfLib = typeof import('pdf-lib')

/** 1 mm en puntos PDF. */
export const MM = 72 / 25.4
export const ANCHO_A4 = 210
export const ALTO_A4 = 297
/** 1 pt en mm (para pasar tamaños de letra a alturas). */
export const PT = 25.4 / 72

/** Paleta del diseño (§2), sacada de tokens.css en tema claro. El PDF siempre sale en claro. */
export const C = {
  tinta: '#16202B', titulo: '#3D4752', gris: '#6B7785', grisSuave: '#9AA5B1', linea: '#D9E0E8', rejilla: '#E8ECF1',
  banda: '#E9ECF0', celda: '#F3F5F8', celdaEtq: '#E9EDF1', cab: '#3B4654',
  azul: '#0A74B9', azulSuave: '#CFE3F2', naranja: '#EE6A0E', logo: '#FF7A1A', verde: '#3F8F1E', ambar: '#B7790B', rojo: '#C93A32', oro: '#A97D12',
  zonaClara: '#E3E7EC', normal: '#E6EAEF', facil: '#5E9FD0', blanco: '#FFFFFF',
  fondoNaranja: '#FDF1E9', fondoAzul: '#E7F1F8', fondoVerde: '#E9F2E4',
} as const

export type Peso = 'normal' | 'negrita' | 'cursiva'
export type Ancla = 'start' | 'middle' | 'end'
export type OpcTexto = { tam?: number; color?: string; peso?: Peso; anc?: Ancla; espaciado?: number }
export type Fuentes = Record<Peso, PDFFont>

const f2 = (n: number) => (Math.round(n * 1000) / 1000).toString()

/** Medidas de texto (no necesitan página). */
export class Medidor {
  constructor(readonly fuentes: Fuentes) {}

  /** Ancho en mm. `espaciado` en pt entre letras. */
  ancho(s: string, tam: number, peso: Peso = 'normal', espaciado = 0): number {
    const t = textoPdf(s)
    if (!t) return 0
    return this.fuentes[peso].widthOfTextAtSize(t, tam) / MM + (espaciado * Math.max(0, [...t].length - 1)) / MM
  }

  /** Corta con «…» lo que no quepa en `w` mm. */
  cortar(s: string, w: number, tam: number, peso: Peso = 'normal'): string {
    if (this.ancho(s, tam, peso) <= w) return s
    const letras = [...s]
    let lo = 0, hi = letras.length
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2)
      if (this.ancho(`${letras.slice(0, m).join('').trimEnd()}…`, tam, peso) <= w) lo = m
      else hi = m - 1
    }
    return `${letras.slice(0, lo).join('').trimEnd()}…`
  }

  /** Parte un texto en líneas de como mucho `w` mm. */
  partir(s: string, w: number, tam: number, peso: Peso = 'normal'): string[] {
    const palabras = textoPdf(s).split(' ').filter(Boolean)
    const lineas: string[] = []
    let actual = ''
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p
      if (!actual || this.ancho(prueba, tam, peso) <= w) actual = prueba
      else { lineas.push(actual); actual = p }
    }
    if (actual) lineas.push(actual)
    return lineas.map(l => (this.ancho(l, tam, peso) > w ? this.cortar(l, w, tam, peso) : l))
  }
}

/** Trozo de texto con su letra y color (para frases con partes en negrita). */
export type Trozo = { t: string; peso?: Peso; color?: string }
export type LineaRica = { trozos: (Trozo & { x: number })[]; ancho: number }

/** Parte un texto con trozos de distinto estilo en líneas de como mucho `w` mm. */
export function partirRico(m: Medidor, trozos: Trozo[], w: number, tam: number): LineaRica[] {
  // Cada palabra sabe si lleva un espacio delante (los trozos pueden cortar una palabra: «55» + « kg»).
  const palabras: (Trozo & { espacio: boolean })[] = []
  let espacio = false
  for (const tr of trozos) {
    textoPdf(tr.t).split(' ').forEach((p, i) => {
      if (i > 0) espacio = true
      if (!p) return
      palabras.push({ ...tr, t: p, espacio })
      espacio = false
    })
  }
  const lineas: LineaRica[] = []
  let actual: LineaRica = { trozos: [], ancho: 0 }
  const hueco = m.ancho(' ', tam)
  for (const p of palabras) {
    const wp = m.ancho(p.t, tam, p.peso)
    const sep = actual.trozos.length && p.espacio ? hueco : 0
    if (actual.trozos.length && actual.ancho + sep + wp > w) {
      lineas.push(actual)
      actual = { trozos: [], ancho: 0 }
      actual.trozos.push({ t: p.t, peso: p.peso, color: p.color, x: 0 })
      actual.ancho = wp
      continue
    }
    actual.trozos.push({ t: p.t, peso: p.peso, color: p.color, x: actual.ancho + sep })
    actual.ancho += sep + wp
  }
  if (actual.trozos.length) lineas.push(actual)
  return lineas
}

/** Una página del PDF en mm. */
export class Lienzo extends Medidor {
  private readonly colores = new Map<string, ReturnType<PdfLib['rgb']>>()

  constructor(private readonly lib: PdfLib, readonly pagina: PDFPage, fuentes: Fuentes) {
    super(fuentes)
    // Uniones redondeadas en todas las líneas (sin picos en los giros bruscos de las gráficas).
    pagina.pushOperators(lib.setLineJoin(lib.LineJoinStyle.Round))
  }

  private color(hex: string) {
    let c = this.colores.get(hex)
    if (!c) {
      const n = Number.parseInt(hex.slice(1), 16)
      c = this.lib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
      this.colores.set(hex, c)
    }
    return c
  }

  /** Un trazo SVG en mm (y hacia abajo). */
  ruta(d: string, o: { relleno?: string; borde?: string; grosor?: number; raya?: number[]; redondo?: boolean }) {
    if (!d) return
    this.pagina.drawSvgPath(d, {
      x: 0, y: ALTO_A4 * MM, scale: MM,
      color: o.relleno ? this.color(o.relleno) : undefined,
      borderColor: o.borde ? this.color(o.borde) : undefined,
      borderWidth: o.borde ? (o.grosor ?? 0.25) : undefined,
      borderDashArray: o.raya,
      borderLineCap: o.redondo ? this.lib.LineCapStyle.Round : undefined,
    })
  }

  rect(x: number, y: number, w: number, h: number, relleno: string, r = 0) {
    if (w <= 0 || h <= 0) return
    this.ruta(rutaRect(x, y, w, h, r), { relleno })
  }

  marco(x: number, y: number, w: number, h: number, borde: string, grosor = 0.25, r = 0) {
    this.ruta(rutaRect(x + grosor / 2, y + grosor / 2, w - grosor, h - grosor, Math.max(0, r - grosor / 2)), { borde, grosor })
  }

  linea(x1: number, y1: number, x2: number, y2: number, color: string, grosor = 0.25, raya?: number[]) {
    this.ruta(`M${f2(x1)} ${f2(y1)} L${f2(x2)} ${f2(y2)}`, { borde: color, grosor, raya })
  }

  /** Línea que une puntos; los null cortan la línea. */
  polilinea(pts: ({ x: number; y: number } | null)[], color: string, grosor = 0.5, raya?: number[]) {
    let d = '', abierto = false, n = 0
    for (const p of pts) {
      if (!p) { abierto = false; continue }
      d += `${abierto ? 'L' : 'M'}${f2(p.x)} ${f2(p.y)} `
      abierto = true
      n++
    }
    if (n >= 2) this.ruta(d, { borde: color, grosor, raya, redondo: true })
  }

  circulo(x: number, y: number, r: number, relleno: string | null, borde?: string, grosor = 0.3) {
    const k = 0.5523 * r
    const d = `M${f2(x - r)} ${f2(y)} C${f2(x - r)} ${f2(y - k)} ${f2(x - k)} ${f2(y - r)} ${f2(x)} ${f2(y - r)} C${f2(x + k)} ${f2(y - r)} ${f2(x + r)} ${f2(y - k)} ${f2(x + r)} ${f2(y)} C${f2(x + r)} ${f2(y + k)} ${f2(x + k)} ${f2(y + r)} ${f2(x)} ${f2(y + r)} C${f2(x - k)} ${f2(y + r)} ${f2(x - r)} ${f2(y + k)} ${f2(x - r)} ${f2(y)} Z`
    this.ruta(d, { relleno: relleno ?? undefined, borde, grosor: borde ? grosor : undefined })
  }

  poligono(pts: [number, number][], relleno: string, borde?: string, grosor = 0.2) {
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`).join(' ') + ' Z'
    this.ruta(d, { relleno, borde, grosor: borde ? grosor : undefined })
  }

  /** Estrella de récord: 5 puntas en oro con borde blanco. */
  estrella(cx: number, cy: number, r: number, color: string = C.oro) {
    const pts: [number, number][] = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 ? r * 0.45 : r
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
    }
    this.poligono(pts, color, C.blanco, 0.2)
  }

  /** Triángulo de cambio: arriba (sube) o abajo (baja). `t` = media anchura. */
  triangulo(cx: number, cy: number, t: number, arriba: boolean, color: string) {
    this.poligono(arriba
      ? [[cx - t, cy + t * 0.8], [cx + t, cy + t * 0.8], [cx, cy - t * 0.9]]
      : [[cx - t, cy - t * 0.8], [cx + t, cy - t * 0.8], [cx, cy + t * 0.9]], color)
  }

  /** Flecha pequeña junto a un texto: triángulo o «=» dibujado. (x, y) = esquina izquierda sobre la línea base. Devuelve el ancho. */
  flecha(x: number, base: number, dir: 'sube' | 'baja' | 'igual', color: string, t = 1): number {
    const cy = base - 1.1 * t
    if (dir === 'igual') {
      this.rect(x, cy - 0.65 * t, 2.2 * t, 0.42 * t, color)
      this.rect(x, cy + 0.25 * t, 2.2 * t, 0.42 * t, color)
    } else this.triangulo(x + 1.1 * t, cy, 1.05 * t, dir === 'sube', color)
    return 2.2 * t
  }

  /** Texto con su línea base en `y`. Devuelve el ancho en mm. */
  texto(x: number, y: number, s: string, o: OpcTexto = {}): number {
    const t = textoPdf(s)
    if (!t) return 0
    const tam = o.tam ?? 8.5, peso = o.peso ?? 'normal', esp = o.espaciado ?? 0
    const w = this.ancho(t, tam, peso, esp)
    const x0 = o.anc === 'middle' ? x - w / 2 : o.anc === 'end' ? x - w : x
    if (esp) this.pagina.pushOperators(this.lib.setCharacterSpacing(esp))
    this.pagina.drawText(t, { x: x0 * MM, y: (ALTO_A4 - y) * MM, size: tam, font: this.fuentes[peso], color: this.color(o.color ?? C.tinta) })
    if (esp) this.pagina.pushOperators(this.lib.setCharacterSpacing(0))
    return w
  }

  /** Líneas con trozos de distinto estilo (de partirRico). Devuelve la altura usada. */
  textoRico(x: number, y: number, lineas: LineaRica[], tam: number, interlinea: number, colorBase: string = C.tinta) {
    lineas.forEach((l, i) => {
      for (const tr of l.trozos) this.texto(x + tr.x, y + i * interlinea, tr.t, { tam, peso: tr.peso, color: tr.color ?? colorBase })
    })
    return lineas.length * interlinea
  }
}

/** Rectángulo (con esquinas redondeadas si r > 0) como trazo SVG. */
export function rutaRect(x: number, y: number, w: number, h: number, r = 0): string {
  if (w <= 0 || h <= 0) return ''
  const rr = Math.min(r, w / 2, h / 2)
  if (rr <= 0) return `M${f2(x)} ${f2(y)} H${f2(x + w)} V${f2(y + h)} H${f2(x)} Z`
  const k = rr * 0.4477
  return `M${f2(x + rr)} ${f2(y)} H${f2(x + w - rr)} C${f2(x + w - k)} ${f2(y)} ${f2(x + w)} ${f2(y + k)} ${f2(x + w)} ${f2(y + rr)} `
    + `V${f2(y + h - rr)} C${f2(x + w)} ${f2(y + h - k)} ${f2(x + w - k)} ${f2(y + h)} ${f2(x + w - rr)} ${f2(y + h)} `
    + `H${f2(x + rr)} C${f2(x + k)} ${f2(y + h)} ${f2(x)} ${f2(y + h - k)} ${f2(x)} ${f2(y + h - rr)} `
    + `V${f2(y + rr)} C${f2(x)} ${f2(y + k)} ${f2(x + k)} ${f2(y)} ${f2(x + rr)} ${f2(y)} Z`
}
