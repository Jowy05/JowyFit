// Cobertura de las traducciones de la app: cada texto de t()/tn()/tc()/tr()/tk() de src/ tiene que estar en los
// diccionarios de catalán y de inglés (src/i18n/ca, src/i18n/en), y los diccionarios no deben guardar textos que
// ya no se usan. La landing y la demo tienen sus propios diccionarios y no entran aquí.
//
// Las 8 zonas están traducidas: la parte estricta (faltan / sobran / duplicados) corre siempre (ESTRICTO_SIEMPRE).
// Además se buscan en los .tsx textos que se pintan sin pasar por t() (ver «textos sin envolver», abajo).
// Para mirar solo una zona: I18N_SOLO=src/pantallas/inicio (rutas separadas por comas: qué archivos se miran
// para «faltan») e I18N_ZONA=inicio (qué diccionario se mira para «sobran»). Más en docs/I18N-APP.md.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSync } from 'vite'
import { archivosApp, archivosTsx, escanear, literalesJSX, piezas, sinComentarios, type Literal, type Problema, type Uso } from './i18n-escaner'

/** Todas las zonas traducidas: la prueba completa corre siempre (con false solo corre con I18N_ESTRICTO=1). */
const ESTRICTO_SIEMPRE = true
const ESTRICTO = ESTRICTO_SIEMPRE || process.env.I18N_ESTRICTO === '1'

const RAIZ = path.resolve(import.meta.dirname, '..')
const IDIOMAS = ['ca', 'en'] as const
const rel = (p: string) => path.relative(RAIZ, p).replace(/\\/g, '/')

// Diccionarios por idioma y zona (sin el index, que solo los junta).
const modulos = import.meta.glob<Record<string, string>>('../src/i18n/{ca,en}/*.ts', { eager: true, import: 'default' })
type Zona = { idioma: string; zona: string; archivo: string; dic: Record<string, string> }
const ZONAS: Zona[] = Object.entries(modulos)
  .map(([p, dic]) => { const [, idioma, zona] = /\/(ca|en)\/(\w+)\.ts$/.exec(p)!; return { idioma: idioma!, zona: zona!, archivo: `src/i18n/${idioma}/${zona}.ts`, dic } })
  .filter(z => z.zona !== 'index')

// Todos los usos del código.
const ARCHIVOS = archivosApp(RAIZ)
const usos: Uso[] = []
const problemas: Problema[] = []
for (const f of ARCHIVOS) {
  const r = escanear(fs.readFileSync(f, 'utf8'), rel(f))
  usos.push(...r.usos)
  problemas.push(...r.problemas)
}
const usadas = new Set(usos.map(u => u.clave))

const lista = (filas: string[], max = 400) => filas.slice(0, max).join('\n') + (filas.length > max ? `\n… y ${filas.length - max} más` : '')
const corta = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s)

describe('buscador de textos (tests/i18n-escaner.ts)', () => {
  it('encuentra t, tn, tc, tr y tk con sus textos y se salta comentarios y otras funciones', () => {
    const fuente = [
      "const a = t('Hola')",
      "const b = tn(lista.length, '{n} serie', '{n} series', { x: f(1, 2) })",
      "const c = tc('máquina', \"Ocupado\")",
      "const d = <p>{tr('Toca <b>Hecho</b>', { b: s => <b>{s}</b> })}</p>",
      "const e = [tk(`Inicio`), x.t('no'), obj.tn(1, 'no', 'no')]",
      "// t('comentario')",
      "/* t('otro comentario') */ const f = t('L\\'Hospitalet')",
      "const g = t(variable)",
    ].join('\n')
    const r = escanear(fuente, 'x.tsx')
    expect(r.usos.map(u => u.clave)).toEqual(['Hola', '{n} serie', '{n} series', 'máquina|Ocupado', 'Toca <b>Hecho</b>', 'Inicio', "L'Hospitalet"])
    expect(r.usos.map(u => u.linea)).toEqual([1, 2, 2, 3, 4, 5, 7])
    expect(r.problemas).toEqual([])
  })
  it('avisa de t() con ${…} y de textos metidos en expresiones', () => {
    const r = escanear("t(`Hola ${nombre}`)\nt(si ? 'a' : 'b')\nt('a' + b)", 'x.ts')
    expect(r.usos).toEqual([])
    expect(r.problemas.map(p => p.linea)).toEqual([1, 2, 3])
  })
  it('los comentarios no mueven las líneas y las URL no son comentarios', () => {
    expect(sinComentarios("a /* x\ny */ b\nconst u = 'https://x' // fin").split('\n')).toHaveLength(3)
    expect(sinComentarios("const u = 'https://x'")).toBe("const u = 'https://x'")
  })
  it('las variables y marcas de un texto', () => {
    expect(piezas('Faltan {n} g de <b>{que}</b>')).toEqual(['<b>', '{n}', '{que}'])
  })
})

describe('diccionarios de la app', () => {
  it('cada zona tiene su archivo en catalán y en inglés', () => {
    const nombres = (i: string) => ZONAS.filter(z => z.idioma === i).map(z => z.zona).sort()
    expect(nombres('ca')).toEqual(['comida', 'comun', 'entreno', 'informe', 'inicio', 'perfil', 'progreso', 'rutina'])
    expect(nombres('en')).toEqual(nombres('ca'))
  })
  it('las traducciones son textos y llevan las mismas {variables} y <marcas> que el castellano', () => {
    const mal: string[] = []
    for (const z of ZONAS) {
      for (const [clave, valor] of Object.entries(z.dic)) {
        if (typeof valor !== 'string') { mal.push(`${z.archivo}: «${corta(clave)}» no es un texto`); continue }
        const es = piezas(clave.includes('|') ? clave.slice(clave.indexOf('|') + 1) : clave)
        if (valor && es.join() !== piezas(valor).join()) mal.push(`${z.archivo}: «${corta(clave)}» lleva ${es.join(' ') || 'nada'} y la traducción ${piezas(valor).join(' ') || 'nada'}`)
      }
    }
    if (mal.length) throw new Error(`Traducciones con variables o marcas distintas del castellano:\n${lista(mal)}`)
  })
  it('las llamadas se pueden comprobar (sin ${…} ni textos dentro de expresiones)', () => {
    if (problemas.length) throw new Error(`Llamadas que no se pueden traducir bien:\n${lista(problemas.map(p => `${p.archivo}:${p.linea}  ${corta(p.texto)}\n    → ${p.motivo}`))}`)
  })
})

describe.skipIf(!ESTRICTO)('cobertura completa (interruptor I18N_ESTRICTO)', () => {
  const solo = (process.env.I18N_SOLO ?? '').split(',').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
  const zona = process.env.I18N_ZONA?.trim()

  for (const idioma of IDIOMAS) {
    it(`no falta ningún texto en ${idioma}`, () => {
      const dic: Record<string, string> = {}
      for (const z of ZONAS.filter(x => x.idioma === idioma)) Object.assign(dic, z.dic)
      const faltan = usos
        .filter(u => !solo.length || solo.some(s => u.archivo.startsWith(s)))
        .filter(u => !(Object.hasOwn(dic, u.clave) && dic[u.clave]))
      // Agrupado por archivo, cada texto una vez por archivo.
      const porArchivo = new Map<string, Map<string, number>>()
      for (const u of faltan) {
        const m = porArchivo.get(u.archivo) ?? new Map<string, number>()
        if (!m.has(u.clave)) m.set(u.clave, u.linea)
        porArchivo.set(u.archivo, m)
      }
      const filas = [...porArchivo].flatMap(([a, m]) => [`${a}:`, ...[...m].map(([c, l]) => `  ${l}: ${JSON.stringify(c)}`)])
      const total = [...porArchivo.values()].reduce((s, m) => s + m.size, 0)
      if (total) throw new Error(`Faltan ${total} textos en src/i18n/${idioma}/ (clave = el castellano exacto):\n${lista(filas)}`)
    })
    it(`no sobra ningún texto en ${idioma} (claves que ya no se usan)`, () => {
      const sobran = ZONAS.filter(z => z.idioma === idioma && (!zona || z.zona === zona))
        .flatMap(z => Object.keys(z.dic).filter(c => !usadas.has(c)).map(c => `${z.archivo}: ${JSON.stringify(c)}`))
      if (sobran.length) throw new Error(`Claves que ya no se usan en el código (bórralas o corrige el castellano):\n${lista(sobran)}`)
    })
    it(`un mismo texto se traduce igual en todas las zonas (${idioma})`, () => {
      const vistos = new Map<string, { valor: string; archivo: string }>()
      const choques: string[] = []
      for (const z of ZONAS.filter(x => x.idioma === idioma)) {
        for (const [c, v] of Object.entries(z.dic)) {
          const antes = vistos.get(c)
          if (antes && antes.valor !== v) choques.push(`${JSON.stringify(c)}: ${antes.archivo} = ${JSON.stringify(antes.valor)} · ${z.archivo} = ${JSON.stringify(v)}`)
          else if (!antes) vistos.set(c, { valor: v, archivo: z.archivo })
        }
      }
      // Si de verdad deben ser distintos según dónde salen, usa tc('contexto', 'texto').
      if (choques.length) throw new Error(`Mismo castellano con traducciones distintas (al juntar zonas gana la última):\n${lista(choques)}`)
    })
  }
  it('el buscador ve textos en el código', () => {
    expect(usos.length).toBeGreaterThan(0)
  })
  // Una carpeta movida o un import de i18n por alias saca archivos del escaneo sin que nada falle.
  // Si se borran archivos a propósito, baja estos números a los nuevos.
  it('el buscador sigue mirando todos los archivos', () => {
    expect(ARCHIVOS.length).toBeGreaterThanOrEqual(87 - 2)
    expect(archivosTsx(RAIZ).length).toBeGreaterThanOrEqual(60 - 2)
  })
})

// ── Textos sin envolver ──────────────────────────────────────────────────────────────────────────────────────────
// Lo que se pinta en un .tsx sin t() sale en castellano en todos los idiomas. Se aceptan solo textos sin letras
// (números, signos) o hechos de palabras que no se traducen (glosario: unidades, marcas, licencias).

/** Palabras que no se traducen: unidades, marcas y nombres de bibliotecas y licencias (Créditos). */
const NO_SE_TRADUCEN = [
  'kg', 'g', 'kcal', 'cm', 'km', 'min', 'h', 's', 'ml', 'mg', 'KB', 'MB', // unidades
  'JowyFit', 'JOWYFIT', 'Health Connect', 'Open Food Facts', 'RepDB', 'EAN', // marcas y el código de barras
  'Phosphor', 'Barlow', 'JetBrains Mono', 'React', 'Capacitor', 'fflate', 'Workbox', // Créditos: bibliotecas…
  'SIL OFL', 'MIT', 'Apache', 'MPL', 'ODbL', // …y sus licencias
  'Aa', // muestra del botón «Letra grande»
]
// Cada palabra solo suelta (la «s» de «+15 s», no la de «Sigma»); son letras y espacios: no hace falta escaparlas.
const PALABRA = new RegExp(`(?<![\\p{L}\\d])(?:${NO_SE_TRADUCEN.join('|')})(?![\\p{L}\\d])`, 'gu')
/** Direcciones (jowy05.github.io, repdb.co): tampoco se traducen. */
const DOMINIO = /\b[\w-]+(?:\.[\w-]+)*\.(?:io|co|com|org|net)\b/g

/** Excepciones con su motivo: el texto exacto (ya sin lo de arriba) y el archivo. Que sean pocas. */
const EXCEPCIONES: { archivo: string; texto: string; por: string }[] = [
  { archivo: 'src/pantallas/perfil/Creditos.tsx', texto: 'Exercise data by ()', por: 'atribución que pide la licencia de RepDB, en inglés tal cual' },
  { archivo: 'src/pantallas/rutina/Ficha.tsx', texto: 'Exercise data by', por: 'atribución de RepDB (licencia)' },
  { archivo: 'src/pantallas/rutina/Biblioteca.tsx', texto: 'Exercise data by ()', por: 'atribución de RepDB (licencia)' },
  { archivo: 'src/pantallas/entreno/HojasEntreno.tsx', texto: 'Exercise data by ()', por: 'atribución de RepDB (licencia)' },
]

/** Lo que queda de un texto al quitarle lo que no se traduce; si aún tiene letras, falta un t(). */
const restoTraducible = (texto: string) => texto.replace(DOMINIO, '').replace(PALABRA, '').replace(/\s+/g, ' ').trim()

const parse = (archivo: string, fuente: string) => parseSync(archivo, fuente, { lang: 'tsx' })

describe('textos sin envolver en los .tsx', () => {
  it('el buscador ve el texto entre etiquetas, las cadenas de hijo y los atributos que se leen', () => {
    const fuente = [
      'const A = () => <div title="Hola" className="caja">',
      "  Buenos días <b>{t('Hecho')}</b> {'Cadena'} {si ? 'Sí' : t('No')} {n && `Faltan ${n}`}",
      "  <Ico n=\"check\" aria-label={t('Bien')} /> {12} kg &lt; 5 <input placeholder={x || 'Buscar'} />",
      '</div>',
    ].join('\n')
    const r = literalesJSX(fuente, 'x.tsx', parse)
    expect(r.map(l => [l.linea, l.donde, l.texto])).toEqual([
      [1, 'title', 'Hola'], [2, 'texto', 'Buenos días'], [2, 'texto', 'Cadena'], [2, 'texto', 'Sí'], [2, 'texto', 'Faltan'],
      [3, 'texto', 'kg < 5'], [3, 'placeholder', 'Buscar'],
    ])
  })
  it('lo que no se traduce se queda fuera: unidades, marcas y direcciones', () => {
    expect(restoTraducible('kg ×')).toBe('×')
    expect(restoTraducible('+15 s')).toBe('+15')
    expect(restoTraducible('Exercise data by RepDB (repdb.co)')).toBe('Exercise data by ()')
    expect(restoTraducible('jowy05.github.io')).toBe('')
    expect(restoTraducible('Calentamiento 5 min')).toBe('Calentamiento 5')
    expect(restoTraducible('Sigma')).toBe('Sigma') // «s» y «g» solo como palabra suelta
  })
  it('ningún .tsx pinta castellano sin t()', () => {
    const malos: Literal[] = []
    const usadas = new Set<(typeof EXCEPCIONES)[number]>()
    for (const f of archivosTsx(RAIZ)) {
      for (const l of literalesJSX(fs.readFileSync(f, 'utf8'), rel(f), parse)) {
        const resto = restoTraducible(l.texto)
        if (!/\p{L}/u.test(resto)) continue
        const ex = EXCEPCIONES.find(e => e.archivo === l.archivo && e.texto === resto)
        if (ex) usadas.add(ex)
        else malos.push(l)
      }
    }
    if (malos.length) throw new Error(`Textos que se pintan sin t() (envuélvelos y tradúcelos; si de verdad no se traducen, a NO_SE_TRADUCEN o EXCEPCIONES con su motivo):\n${lista(malos.map(l => `${l.archivo}:${l.linea}  [${l.donde}] ${JSON.stringify(corta(l.texto))}`))}`)
    // Una excepción que ya no hace falta, fuera (para que la lista no crezca sola).
    const sobran = EXCEPCIONES.filter(e => !usadas.has(e))
    expect(sobran.map(e => `${e.archivo}: ${e.texto}`)).toEqual([])
  })
})
