import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { opcionesDe } from '../../scripts/simulador/cli.ts'
import type { Informe } from '../../scripts/simulador/tipos.ts'

const raiz = path.resolve(import.meta.dirname, '../..')
const cli = path.join(raiz, 'scripts/simulador/cli.ts')
const temporales: string[] = []

function ejecutar(...argumentos: string[]) {
  return spawnSync(process.execPath, [cli, ...argumentos], { cwd: raiz, encoding: 'utf8', timeout: 30_000 })
}

afterAll(() => {
  const cache = path.join(raiz, '.cache')
  for (const directorio of temporales) {
    const relativo = path.relative(cache, path.resolve(directorio))
    if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) throw new Error('Limpieza fuera de la carpeta temporal del proyecto')
    rmSync(directorio, { recursive: true, force: true })
  }
})

describe('CLI sin acceso a JowyFit', () => {
  it.each([
    ['--desconocido'], ['--semanas'], ['--semillas', '1,1'], ['--semillas', '-1'],
    ['--adaptador', 'cualquiera.ts'], ['--autorizar-aplicacion'], ['--demostracion', '--adaptador', 'otro.ts'],
    ['--config', 'informe.json', '--semanas', '4'], ['--demostracion', '--demostracion'],
  ])('rechaza argumentos inválidos %j', (...argumentos) => {
    expect(() => opcionesDe(argumentos)).toThrow()
  })

  it('sin argumentos solo informa y no simula', () => {
    const salida = ejecutar()
    expect(salida.status).toBe(0)
    expect(salida.stdout).toContain('No ejecuta JowyFit por defecto')
    expect(salida.stdout).not.toContain('Informes:')
  })

  it('lista los trece perfiles y cuatro escenarios adicionales sin simular', () => {
    const salida = ejecutar('--listar')
    expect(salida.status).toBe(0)
    expect(salida.stdout.trim().split('\n')).toHaveLength(17)
    expect(salida.stdout).not.toContain('Informes:')
  })

  it('no importa módulos externos antes de recibir autorización', () => {
    mkdirSync(path.join(raiz, '.cache'), { recursive: true })
    const temporal = mkdtempSync(path.join(raiz, '.cache/simulador-modulo-'))
    temporales.push(temporal)
    const marcador = path.join(temporal, 'importado.txt')
    const modulo = path.join(temporal, 'adaptador.mjs')
    writeFileSync(modulo, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marcador)}, 'no debería ejecutarse');`)
    const salida = ejecutar('--adaptador', modulo)
    expect(salida.status).toBe(1)
    expect(salida.stderr).toContain('No se importará')
    expect(existsSync(marcador)).toBe(false)
  })

  it('rechaza una batería inválida antes de crear informes', () => {
    for (const argumentos of [['--semanas', '0'], ['--semillas', '4294967296'], ['--escenario', '../fuera'], ['--inicio', '2026-02-30']]) {
      const salida = ejecutar('--demostracion', ...argumentos)
      expect(salida.status).toBe(1)
      expect(salida.stdout).not.toContain('Informes:')
    }
  })

  it('escribe informes ficticios y reproduce el JSON en procesos limpios', () => {
    const primera = ejecutar('--demostracion', '--escenario', 'casa-rodilla', '--semanas', '2', '--semillas', '42')
    expect(primera.status, primera.stderr).toBe(0)
    expect(primera.stdout).toContain('JowyFit no ejecutado')
    const salidaPrimera = primera.stdout.trim().split('Informes: ')[1]!
    temporales.push(salidaPrimera)
    const rutaInforme = path.join(salidaPrimera, 'casa-rodilla-42.json')
    const informePrimero = JSON.parse(readFileSync(rutaInforme, 'utf8')) as Informe
    expect(readFileSync(path.join(salidaPrimera, 'casa-rodilla-42.md'), 'utf8')).toContain('No se ha probado JowyFit')
    expect(readdirSync(salidaPrimera).sort()).toEqual(['casa-rodilla-42.json', 'casa-rodilla-42.md', 'indice.json'])
    const segunda = ejecutar('--demostracion', '--config', rutaInforme)
    expect(segunda.status, segunda.stderr).toBe(0)
    const salidaSegunda = segunda.stdout.trim().split('Informes: ')[1]!
    temporales.push(salidaSegunda)
    expect(JSON.parse(readFileSync(path.join(salidaSegunda, 'casa-rodilla-42.json'), 'utf8'))).toEqual(informePrimero)
  })

  it('mantiene las mismas decisiones entre UTC y Madrid en procesos independientes', () => {
    const codigo = `import { simular } from './scripts/simulador/motor.ts'; import { crearAdaptador } from './scripts/simulador/demostracion.ts'; import { escenariosBase } from './scripts/simulador/escenarios.ts'; console.log(JSON.stringify(await simular({version:1,escenario:escenariosBase()[0],semilla:7,semanas:3,inicio:'2026-10-19'},crearAdaptador())));`
    const enZona = (zona: string) => execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: raiz, encoding: 'utf8', env: { ...process.env, TZ: zona }, timeout: 10_000 })
    expect(JSON.parse(enZona('UTC'))).toEqual(JSON.parse(enZona('Europe/Madrid')))
  })

  it('los módulos del simulador no importan la aplicación ni IndexedDB', () => {
    const directorio = path.join(raiz, 'scripts/simulador')
    for (const archivo of readdirSync(directorio).filter(nombre => nombre.endsWith('.ts'))) {
      const codigo = readFileSync(path.join(directorio, archivo), 'utf8')
      expect(codigo).not.toMatch(/(?:from\s*|import\s*\()['"][^'"]*(?:src\/|fake-indexeddb|dexie)/)
    }
  })
})
