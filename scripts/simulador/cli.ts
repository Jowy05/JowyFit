import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { escenariosBase, escenariosLimite } from './escenarios.ts'
import { markdown } from './informe.ts'
import { simular } from './motor.ts'
import { validarConfiguracion } from './validar.ts'
import type { Adaptador, Configuracion } from './tipos.ts'

const AYUDA = `Simulador local. No ejecuta JowyFit por defecto.

  node scripts/simulador/cli.ts --listar
  node scripts/simulador/cli.ts --demostracion --escenario casa-rodilla --semanas 12 --semillas 1,2
  node scripts/simulador/cli.ts --demostracion --config ruta/al/informe.json

Opciones:
  --ayuda             Mostrar esta ayuda, sin simular.
  --listar            Mostrar escenarios, sin simular.
  --demostracion      Usar exclusivamente un sistema ficticio, no JowyFit.
  --adaptador ruta    Módulo local que exporta crearAdaptador(). No está incluido un adaptador de JowyFit.
  --autorizar-aplicacion  Obligatorio antes de importar un adaptador externo.
  --escenario id      Uno o varios identificadores separados por comas; defecto: todos.
  --semanas n         Entre 1 y 520; defecto: 12.
  --semillas lista    Enteros uint32 separados por comas; defecto: 1; máximo: 100.
  --inicio fecha     Fecha ISO inicial; defecto fijo: 2026-01-05.
  --config ruta      Repetir la configuración de un informe JSON o cargar una configuración propia.

Resultados en .cache/simulador/<ejecucion> dentro del proyecto.
Un informe ficticio no valida la aplicación ni su eficacia fisiológica.
`

export type Opciones = {
  ayuda: boolean
  listar: boolean
  demostracion: boolean
  permitirAplicacion: boolean
  adaptador: string | null
  config: string | null
  escenarios: string[] | null
  semanas: number
  semillas: number[]
  inicio: string
}

function entero(texto: string, nombre: string): number {
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(Number(texto))) throw new Error(`${nombre}: se esperaba un entero sin signo`)
  return Number(texto)
}

export function opcionesDe(argumentos: string[]): Opciones {
  const opciones: Opciones = { ayuda: false, listar: false, demostracion: false, permitirAplicacion: false, adaptador: null, config: null, escenarios: null, semanas: 12, semillas: [1], inicio: '2026-01-05' }
  const vistas = new Set<string>()
  for (let indice = 0; indice < argumentos.length; indice++) {
    const argumento = argumentos[indice]!
    if (vistas.has(argumento)) throw new Error(`Opción repetida: ${argumento}`)
    vistas.add(argumento)
    if (argumento === '--ayuda') opciones.ayuda = true
    else if (argumento === '--listar') opciones.listar = true
    else if (argumento === '--demostracion') opciones.demostracion = true
    else if (argumento === '--autorizar-aplicacion') opciones.permitirAplicacion = true
    else {
      if (!['--adaptador', '--config', '--escenario', '--semanas', '--semillas', '--inicio'].includes(argumento)) throw new Error(`Opción desconocida: ${argumento}`)
      const valor = argumentos[++indice]
      if (!valor || valor.startsWith('--')) throw new Error(`Falta el valor de ${argumento}`)
      switch (argumento) {
        case '--adaptador': opciones.adaptador = valor; break
        case '--config': opciones.config = valor; break
        case '--escenario': opciones.escenarios = valor.split(','); break
        case '--semanas': opciones.semanas = entero(valor, 'Semanas'); break
        case '--semillas': opciones.semillas = valor.split(',').map(texto => entero(texto, 'Semilla')); break
        case '--inicio': opciones.inicio = valor; break
      }
    }
  }
  if (opciones.demostracion && opciones.adaptador) throw new Error('Elegir demostración o adaptador, no ambos')
  if (opciones.adaptador && !opciones.permitirAplicacion) throw new Error('No se importará un adaptador externo sin --autorizar-aplicacion')
  if (opciones.permitirAplicacion && !opciones.adaptador) throw new Error('La autorización solo tiene sentido con --adaptador')
  if (opciones.semillas.length > 100 || new Set(opciones.semillas).size !== opciones.semillas.length) throw new Error('Máximo 100 semillas distintas')
  if (opciones.config && ['--escenario', '--semanas', '--semillas', '--inicio'].some(opcion => vistas.has(opcion))) throw new Error('--config no se combina con opciones que cambian su configuración')
  return opciones
}

async function procedencia(raiz: string) {
  const huella = createHash('sha256')
  for (const archivo of (await readdir(path.join(raiz, 'scripts/simulador'))).filter(nombre => nombre.endsWith('.ts')).sort()) {
    huella.update(archivo).update(await readFile(path.join(raiz, 'scripts/simulador', archivo)))
  }
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    const diff = execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: raiz, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    const sinSeguimiento = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: raiz, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').split('\0').filter(Boolean).sort()
    const cambios = createHash('sha256').update(diff)
    for (const archivo of sinSeguimiento) cambios.update(archivo).update(await readFile(path.join(raiz, archivo)))
    return { commit, huellaCambios: cambios.digest('hex'), huellaSimulador: huella.digest('hex'), node: process.version }
  } catch {
    return { commit: null, huellaCambios: null, huellaSimulador: huella.digest('hex'), node: process.version }
  }
}

async function configuracionesDe(opciones: Opciones): Promise<Configuracion[]> {
  if (opciones.config) {
    const contenido = JSON.parse(await readFile(path.resolve(opciones.config), 'utf8')) as { configuracion?: Configuracion }
    const configuracion = (contenido.configuracion ?? contenido) as Configuracion
    validarConfiguracion(configuracion)
    return [configuracion]
  }
  const escenarios = [...escenariosBase(), ...escenariosLimite()]
  const seleccion = opciones.escenarios ?? escenarios.map(escenario => escenario.id)
  if (new Set(seleccion).size !== seleccion.length) throw new Error('Escenarios repetidos')
  return seleccion.flatMap(id => {
    const escenario = escenarios.find(candidato => candidato.id === id)
    if (!escenario) throw new Error(`Escenario desconocido: ${id}`)
    return opciones.semillas.map(semilla => {
      const configuracion: Configuracion = { version: 1, escenario, semilla, semanas: opciones.semanas, inicio: opciones.inicio }
      validarConfiguracion(configuracion)
      return configuracion
    })
  })
}

export async function ejecutar(argumentos: string[]): Promise<number> {
  const opciones = opcionesDe(argumentos)
  if (opciones.ayuda || !argumentos.length) { console.log(AYUDA); return 0 }
  if (opciones.listar) {
    for (const escenario of [...escenariosBase(), ...escenariosLimite()]) console.log(`${escenario.id}: ${escenario.nombre}`)
    return 0
  }
  if (!opciones.demostracion && !opciones.adaptador) throw new Error('Elegir --demostracion o un adaptador autorizado; no se ejecuta nada por defecto')
  const configuraciones = await configuracionesDe(opciones)
  if (configuraciones.reduce((dias, configuracion) => dias + configuracion.semanas * 7, 0) > 2_000_000) throw new Error('Batería demasiado grande: dividir en varias ejecuciones')
  const modulo = opciones.adaptador
    ? await import(pathToFileURL(path.resolve(opciones.adaptador)).href) as { crearAdaptador?: () => Adaptador | Promise<Adaptador> }
    : await import('./demostracion.ts')
  if (typeof modulo.crearAdaptador !== 'function') throw new Error('El módulo debe exportar crearAdaptador()')
  const raiz = path.resolve(import.meta.dirname, '../..')
  const salida = path.join(raiz, '.cache/simulador', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`)
  const origen = await procedencia(raiz)
  await mkdir(salida, { recursive: true })
  let fallos = 0
  const indice = []
  for (const configuracion of configuraciones) {
    const adaptador = await modulo.crearAdaptador()
    if (opciones.demostracion && adaptador.identidad.objetivo !== 'ficticio') throw new Error('La demostración solo admite un sistema ficticio')
    const informe = await simular(configuracion, adaptador, { permitirAplicacion: opciones.permitirAplicacion })
    const nombre = `${configuracion.escenario.id}-${configuracion.semilla}`
    await writeFile(path.join(salida, `${nombre}.json`), `${JSON.stringify({ ...informe, procedencia: origen }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await writeFile(path.join(salida, `${nombre}.md`), markdown(informe), { encoding: 'utf8', flag: 'wx' })
    indice.push({ escenario: configuracion.escenario.id, semilla: configuracion.semilla, objetivo: informe.adaptador.objetivo, resumen: informe.resumen })
    fallos += informe.resumen.contratos.fallida
  }
  await writeFile(path.join(salida, 'indice.json'), `${JSON.stringify({ procedencia: origen, ejecuciones: indice }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log(`${opciones.demostracion ? 'Demostración ficticia; JowyFit no ejecutado.' : 'Adaptador externo autorizado.'} ${configuraciones.length} ejecuciones; ${fallos} incumplimientos. Informes: ${salida}`)
  return fallos ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  ejecutar(process.argv.slice(2)).then(codigo => { process.exitCode = codigo }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
