import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { opcionesDe } from './cli.ts'

const raiz = path.resolve(import.meta.dirname, '../..')
const argumentos = process.argv.slice(2)
if (argumentos.includes('--ayuda')) {
  console.log(`Evaluación del generador real y acciones de JowyFit con datos sintéticos.
  node scripts/simulador/evaluar-jowyfit.mjs --semanas 52 --semillas 1,2,3
  node scripts/simulador/evaluar-jowyfit.mjs --escenario musculo-gimnasio --semanas 2 --semillas 1
  node scripts/simulador/evaluar-jowyfit.mjs --comparar .cache/simulador-jowyfit/CARPETA/indice.json
Sin opciones: todos los escenarios, 52 semanas y semillas 1 a 20.
Admite --inicio AAAA-MM-DD. --comparar repite las configuraciones del índice anterior.
Requiere el catálogo local real y las dependencias instaladas del proyecto.
Salida en .cache/simulador-jowyfit/. Código 1 ante fallos; los informes quedan guardados.`)
  process.exit(0)
}

try {
  let comparar = null
  const posicion = argumentos.indexOf('--comparar')
  if (posicion >= 0) {
    if (argumentos.length !== 2 || posicion !== 0 || !argumentos[1]) throw new Error('--comparar solo se combina con la ruta del índice previo')
    comparar = path.resolve(argumentos[1])
    argumentos.splice(0, 2)
  }
  const permitidas = new Set(['--semanas', '--semillas', '--escenario', '--inicio'])
  for (let indice = 0; indice < argumentos.length; indice += 2) if (!permitidas.has(argumentos[indice])) throw new Error(`Opción no admitida: ${argumentos[indice]}`)
  if (!argumentos.includes('--semanas')) argumentos.push('--semanas', '52')
  if (!argumentos.includes('--semillas')) argumentos.push('--semillas', Array.from({ length: 20 }, (_, indice) => indice + 1).join(','))
  const opciones = opcionesDe(argumentos)
  const salida = path.join(raiz, '.cache/simulador-jowyfit', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`)
  await mkdir(salida, { recursive: true })
  const solicitud = path.join(salida, 'solicitud.json')
  await writeFile(solicitud, `${JSON.stringify({ opciones, comparar, salida }, null, 2)}\n`, 'utf8')
  console.log(`Evaluación real de JowyFit. Informes: ${salida}`)
  const proceso = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/simulador/jowyfit/vitest.config.ts'], {
    cwd: raiz, stdio: 'inherit', env: { ...process.env, JOWYFIT_SIM_BATERIA: '1', JOWYFIT_SIM_SOLICITUD: solicitud },
  })
  if (proceso.error) throw proceso.error
  process.exitCode = proceso.status ?? 1
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
