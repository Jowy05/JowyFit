// Capas de la app. Las pantallas (src/pantallas), los componentes (src/ui) y el armazón (src/app):
// - no leen ni escriben la base directamente: pasan por datos/consultas, datos/hooks, datos/repos y datos/acciones;
// - no preguntan en qué plataforma están (esAndroid, esNativo…): preguntan qué se puede hacer, con capacidades().
// Si de verdad hace falta una excepción, va en la lista de su regla con el motivo.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(import.meta.dirname, '..')
const CARPETAS = ['src/pantallas', 'src/ui', 'src/app']
const rel = (p: string) => path.relative(RAIZ, p).replace(/\\/g, '/')

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? archivos(p) : /\.tsx?$/.test(e.name) ? [p] : []
  })
}

/** `todo`: `import * as x` (trae el módulo entero, también las preguntas por la plataforma). */
type Import = { modulo: string; nombres: string[]; todo: boolean }

/** Los import (también `export … from`, `import type` e `import()`) de un archivo, con los nombres que trae. */
function importsDe(fuente: string): Import[] {
  const out: Import[] = []
  const estatico = /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g
  for (const m of fuente.matchAll(estatico)) {
    const llaves = /\{([^}]*)\}/.exec(m[1]!)?.[1] ?? ''
    const nombres = llaves.split(',').map(x => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim()).filter(Boolean)
    out.push({ modulo: m[2]!, nombres, todo: /\*/.test(m[1]!) })
  }
  for (const m of fuente.matchAll(/(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ modulo: (m[1] ?? m[2])!, nombres: [], todo: false })
  return out
}

/** La ruta (desde la raíz, sin extensión) a la que apunta un import relativo; null si es de un paquete. */
const destino = (archivo: string, modulo: string) => (modulo.startsWith('.') ? rel(path.resolve(path.dirname(archivo), modulo)).replace(/\.(tsx?|js)$/, '') : null)

const TODOS = CARPETAS.flatMap(c => archivos(path.join(RAIZ, c)))

describe('el buscador de imports', () => {
  it('ve import, import type, export … from e import() con sus nombres', () => {
    const f = [
      "import { db } from '../../datos/db'",
      "import type { Sesion } from '../datos/tipos'",
      "import { esAndroid as android, capacidades } from '../../plataforma'",
      "export { x } from './y'",
      "const m = await import('../plataforma/escanerWeb')",
      "import './estilos.css'",
      "import * as plat from '../plataforma'",
    ].join('\n')
    expect(importsDe(f).map(i => [i.modulo, i.nombres.join(','), i.todo])).toEqual([
      ['../../datos/db', 'db', false], ['../datos/tipos', 'Sesion', false], ['../../plataforma', 'esAndroid,capacidades', false], ['./y', 'x', false],
      ['../plataforma', '', true], ['../plataforma/escanerWeb', '', false], ['./estilos.css', '', false],
    ])
  })
  // Una carpeta movida sacaría archivos de la prueba sin que nada falle. Si se borran a propósito, baja el número.
  it('mira todos los archivos de pantallas, ui y app', () => {
    expect(TODOS.length).toBeGreaterThanOrEqual(70)
  })
})

describe('las pantallas no tocan la base directamente', () => {
  /** Archivos que sí pueden importar datos/db, con su motivo. Ninguno por ahora. */
  const EXCEPCIONES: Record<string, string> = {}
  it('nadie en pantallas, ui ni app importa datos/db', () => {
    const malos = TODOS.filter(f => !EXCEPCIONES[rel(f)])
      .flatMap(f => importsDe(fs.readFileSync(f, 'utf8')).filter(i => destino(f, i.modulo) === 'src/datos/db').map(i => `${rel(f)} → ${i.modulo}`))
    if (malos.length) throw new Error(`Importan la base directamente (usa datos/consultas, datos/hooks o una acción de datos/acciones):\n${malos.join('\n')}`)
  })
})

describe('las pantallas preguntan qué se puede hacer, no en qué plataforma están', () => {
  const PREGUNTAS = ['esAndroid', 'esNativo', 'esIPhone', 'esWebApple', 'dispositivoApple', 'puedeVibrar', 'estaInstalada']
  /** Archivos que sí pueden mirar la plataforma, con su motivo. Ninguno por ahora. */
  const EXCEPCIONES: Record<string, string> = {}
  const pantallas = TODOS.filter(f => /^src\/(pantallas|ui)\//.test(rel(f)))
  it('ni pantallas ni ui importan esAndroid, esNativo, dispositivoApple… (usa capacidades())', () => {
    const malos = pantallas.filter(f => !EXCEPCIONES[rel(f)]).flatMap(f => importsDe(fs.readFileSync(f, 'utf8'))
      .filter(i => /^src\/plataforma(\/|$)/.test(destino(f, i.modulo) ?? ''))
      .flatMap(i => (i.todo ? ['* (todo el módulo)'] : i.nombres.filter(n => PREGUNTAS.includes(n))).map(n => `${rel(f)} → ${n}`)))
    if (malos.length) throw new Error(`Preguntan por la plataforma (añade lo que hace falta a capacidades() en plataforma/dispositivo.ts):\n${malos.join('\n')}`)
  })
})
