// Busca en el código las llamadas a t(), tn(), tc(), tr() y tk() y saca sus textos (las claves de los diccionarios).
// Lo usa tests/i18n-cobertura.test.ts. No es un analizador de TypeScript completo: basta con las formas de docs/I18N-APP.md.
import fs from 'node:fs'
import path from 'node:path'

export type Uso = { clave: string; archivo: string; linea: number }
export type Problema = { archivo: string; linea: number; texto: string; motivo: string }

/** Qué argumentos son claves en cada función (tc junta contexto y texto: «contexto|texto»). */
const ARGS: Record<string, number[]> = { t: [0], tr: [0], tk: [0], tn: [1, 2], tc: [0, 1] }
const LLAMADA = /(?<![\w$.])(tn|tc|tr|tk|t)\s*\(/g

/** Quita los comentarios sin mover las líneas (para que los números de línea sigan valiendo); respeta las cadenas. */
export function sinComentarios(s: string): string {
  let r = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]!
    if (c === "'" || c === '"' || c === '`') {
      const { fin } = leerCadena(s, i)
      r += s.slice(i, fin)
      i = fin
    } else if (c === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) {
      const nl = s.indexOf('\n', i)
      const fin = s[i + 1] === '/' ? (nl < 0 ? s.length : nl) : (s.indexOf('*/', i + 2) + 2 || s.length)
      r += s.slice(i, fin).replace(/[^\n]/g, ' ')
      i = fin
    } else { r += c; i++ }
  }
  return r
}

/** Lee una cadena (', " o `) desde i; devuelve dónde acaba y si lleva ${…}. */
function leerCadena(s: string, i: number): { fin: number; plantilla: boolean } {
  const q = s[i]!
  let plantilla = false
  let j = i + 1
  while (j < s.length) {
    const c = s[j]!
    if (c === '\\') { j += 2; continue }
    // ' y " no pasan de línea: un apóstrofo suelto (texto JSX, expresión regular) no se come el resto del archivo.
    if (c === '\n' && q !== '`') return { fin: j, plantilla }
    if (q === '`' && c === '$' && s[j + 1] === '{') {
      plantilla = true
      j = saltarHasta(s, j + 2, '}')
      continue
    }
    if (c === q) return { fin: j + 1, plantilla }
    j++
  }
  return { fin: j, plantilla }
}

/** Avanza hasta el cierre que toca (respetando paréntesis, llaves, corchetes y cadenas); devuelve la posición tras él. */
function saltarHasta(s: string, i: number, cierre: string): number {
  const pila = [cierre]
  let j = i
  while (j < s.length && pila.length) {
    const c = s[j]!
    if (c === "'" || c === '"' || c === '`') { j = leerCadena(s, j).fin; continue }
    if (c === '(') pila.push(')')
    else if (c === '[') pila.push(']')
    else if (c === '{') pila.push('}')
    else if (c === pila[pila.length - 1]) pila.pop()
    j++
  }
  return j
}

/** Parte los argumentos de una llamada que empieza justo después de «(». */
function argumentos(s: string, i: number): string[] {
  const args: string[] = []
  let desde = i
  let j = i
  while (j < s.length) {
    const c = s[j]!
    if (c === "'" || c === '"' || c === '`') { j = leerCadena(s, j).fin; continue }
    if (c === '(' || c === '[' || c === '{') { j = saltarHasta(s, j + 1, c === '(' ? ')' : c === '[' ? ']' : '}'); continue }
    if (c === ',' || c === ')') {
      args.push(s.slice(desde, j).trim())
      if (c === ')') break
      desde = j + 1
    }
    j++
  }
  return args
}

/** Valor de una cadena del código fuente ('…', "…" o `…` sin ${}). */
export function valorCadena(lit: string): string {
  const cuerpo = lit.slice(1, -1)
  return cuerpo.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g, (_, e: string) => {
    if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16))
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16))
    if (e === 'n') return '\n'
    if (e === 't') return '\t'
    if (e === 'r') return '\r'
    if (e === '\n' || e === '\r\n') return ''
    return e
  })
}

type Arg = { tipo: 'texto'; valor: string } | { tipo: 'plantilla' } | { tipo: 'mezcla' } | { tipo: 'variable' }

function clasificar(arg: string): Arg {
  if (/^['"`]/.test(arg)) {
    const { fin, plantilla } = leerCadena(arg, 0)
    if (fin === arg.length) return plantilla ? { tipo: 'plantilla' } : { tipo: 'texto', valor: valorCadena(arg) }
    return { tipo: 'mezcla' }
  }
  // Un texto metido en una expresión (t(a ? 'x' : 'y'), t('a' + b)) no se puede comprobar.
  return /['"`]/.test(arg) ? { tipo: 'mezcla' } : { tipo: 'variable' }
}

/** Claves usadas en un archivo y las llamadas que no se pueden comprobar. */
export function escanear(fuente: string, archivo: string): { usos: Uso[]; problemas: Problema[] } {
  const s = sinComentarios(fuente)
  const usos: Uso[] = []
  const problemas: Problema[] = []
  const linea = (i: number) => s.slice(0, i).split('\n').length
  for (const m of s.matchAll(LLAMADA)) {
    const f = m[1]!
    const inicio = m.index + m[0].length
    const args = argumentos(s, inicio)
    const n = linea(m.index)
    const textos: string[] = []
    let comprobable = true
    for (const k of ARGS[f]!) {
      const a = clasificar(args[k] ?? '')
      if (a.tipo === 'texto') textos.push(a.valor)
      else {
        comprobable = false
        if (a.tipo === 'plantilla') problemas.push({ archivo, linea: n, texto: args[k]!, motivo: `${f}() con \${…} dentro: usa {variable} y pásala en vars` })
        if (a.tipo === 'mezcla') problemas.push({ archivo, linea: n, texto: args[k]!, motivo: `${f}() con un texto dentro de una expresión: pon un t() por texto (c ? t('a') : t('b'))` })
      }
    }
    if (!comprobable) continue
    if (f === 'tc') usos.push({ clave: `${textos[0]}|${textos[1]}`, archivo, linea: n })
    else for (const clave of textos) usos.push({ clave, archivo, linea: n })
  }
  return { usos, problemas }
}

/** ¿Usa este archivo las funciones de idioma? (solo se miran los que importan de src/i18n). */
export const usaIdiomas = (fuente: string) => /from\s+['"](?:\.{1,2}\/)+(?:\.\.\/)*i18n(?:\/jsx)?['"]/.test(fuente)

/** Archivos .ts/.tsx de src/ que usan t() (sin la landing, la demo ni src/i18n). */
export function archivosApp(raiz: string): string[] {
  const fuera = ['landing', 'demo', 'i18n'].map(d => path.join(raiz, 'src', d) + path.sep)
  const lista: string[] = []
  const recorrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!fuera.includes(p + path.sep)) recorrer(p) }
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) lista.push(p)
    }
  }
  recorrer(path.join(raiz, 'src'))
  return lista.filter(p => usaIdiomas(fs.readFileSync(p, 'utf8')))
}

/** Las {variables} y <marcas> de un texto, para comprobar que la traducción lleva las mismas. */
export function piezas(texto: string): string[] {
  return [...texto.matchAll(/\{(\w+)\}|<(\w+)>/g)].map(m => (m[1] != null ? `{${m[1]}}` : `<${m[2]}>`)).sort()
}

// ── Textos sin envolver en el JSX ────────────────────────────────────────────────────────────────────────────────
// Busca, con el analizador de Vite (oxc), los textos que se pintan tal cual en un .tsx sin pasar por t(): el texto
// entre etiquetas, las cadenas que van de hijo ({'…'}, {c ? 'a' : 'b'}, {`…`}) y las de los atributos que se leen.

export type Literal = { archivo: string; linea: number; texto: string; donde: string }
type Nodo = { type: string; start: number; [k: string]: unknown }

const esNodo = (x: unknown): x is Nodo => typeof x === 'object' && x !== null && typeof (x as Nodo).type === 'string'

/** Atributos (de HTML y de nuestros componentes) cuyo texto ve o escucha el usuario. */
export const ATRIBUTOS_VISIBLES = new Set(['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'placeholder', 'title', 'alt', 'label', 'titulo', 'subtitulo', 'texto', 'etiqueta', 'sufijo', 'vacia'])

/** Textos de JSX de un archivo que no pasan por t() (con letras o sin ellas: el filtro va aparte). */
export function literalesJSX(fuente: string, archivo: string, parse: (archivo: string, fuente: string) => { program: unknown; errors: { message: string }[] }): Literal[] {
  const { program, errors } = parse(archivo, fuente)
  if (errors.length) throw new Error(`${archivo}: no se puede leer (${errors[0]!.message})`)
  const salida: (Literal & { i: number })[] = []
  const linea = (i: number) => fuente.slice(0, i).split('\n').length
  // La línea es la de la primera letra (el texto entre etiquetas suele empezar con el salto de línea de antes).
  const poner = (n: Nodo, texto: string, donde: string) => {
    const i = n.start + texto.length - texto.trimStart().length
    if (texto.trim()) salida.push({ archivo, linea: linea(i), texto: texto.trim().replace(/\s+/g, ' '), donde, i })
  }
  // Lo que acaba en pantalla de una expresión: las ramas de ?:, || y ??, y lo de la derecha de &&.
  const expresion = (e: unknown, donde: string) => {
    if (!esNodo(e)) return
    if (e.type === 'ConditionalExpression') { expresion(e.consequent, donde); expresion(e.alternate, donde) }
    else if (e.type === 'LogicalExpression') { expresion(e.right, donde); if (e.operator !== '&&') expresion(e.left, donde) }
    else if (e.type === 'ParenthesizedExpression') expresion(e.expression, donde)
    else if (e.type === 'Literal' && typeof e.value === 'string') poner(e, e.value, donde)
    else if (e.type === 'TemplateLiteral') poner(e, (e.quasis as { value: { cooked: string } }[]).map(q => q.value.cooked).join(' '), donde)
  }
  const recorrer = (n: unknown) => {
    if (Array.isArray(n)) { for (const x of n) recorrer(x); return }
    if (!esNodo(n)) return
    if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
      for (const h of n.children as unknown[]) {
        if (!esNodo(h)) continue
        if (h.type === 'JSXText') poner(h, entidades(String(h.value)), 'texto')
        else if (h.type === 'JSXExpressionContainer') expresion(h.expression, 'texto')
      }
    } else if (n.type === 'JSXAttribute') {
      const nombre = esNodo(n.name) && n.name.type === 'JSXIdentifier' ? String(n.name.name) : ''
      if (ATRIBUTOS_VISIBLES.has(nombre)) {
        const v = n.value
        if (esNodo(v) && v.type === 'Literal') poner(v, String(v.value), nombre)
        else if (esNodo(v) && v.type === 'JSXExpressionContainer') expresion(v.expression, nombre)
      }
    }
    for (const [k, v] of Object.entries(n)) if (k !== 'type' && typeof v === 'object') recorrer(v)
  }
  recorrer(program)
  return salida.sort((a, b) => a.i - b.i).map(({ i: _, ...l }) => l)
}

/** El texto de JSX llega tal cual está escrito: &lt; y compañía, a su letra. */
const ENTIDADES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }
const entidades = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (todo, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTIDADES[e] ?? todo))

/** Todos los .tsx de src/ (sin la landing, la demo ni src/i18n), usen o no t(). */
export function archivosTsx(raiz: string): string[] {
  const fuera = ['landing', 'demo', 'i18n'].map(d => path.join(raiz, 'src', d))
  const lista: string[] = []
  const recorrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!fuera.includes(p)) recorrer(p) }
      else if (e.name.endsWith('.tsx')) lista.push(p)
    }
  }
  recorrer(path.join(raiz, 'src'))
  return lista
}
