// Batería de recorridos: un informe JSON y otro Markdown por escenario y semilla, más indice.json con la procedencia.
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { escenarios } from './escenarios'
import { markdown } from './informe'
import { simular } from './motor'
import { identidad } from './jowyfit/recorrido'
import { validarConfiguracion } from './validar'
import type { Opciones } from './opciones'
import type { Configuracion, Resumen } from './tipos'

type Caso = { configuracion: Configuracion; sha256: string; dias: number; resumen: Resumen; archivo: string }
type Indice = { casos: Caso[]; huellaCatalogo: string; huellaCodigo: string }
export type ResultadoBateria = { salida: string; fallos: number; discrepancias: string[] }

const directorio = path.dirname(fileURLToPath(import.meta.url))
const raiz = path.resolve(directorio, '../..')

async function huellaCodigo(): Promise<string> {
  const hash = createHash('sha256')
  async function agregar(carpeta: string) {
    for (const entrada of (await readdir(carpeta, { withFileTypes: true })).sort((primero, segundo) => primero.name.localeCompare(segundo.name))) {
      const ruta = path.join(carpeta, entrada.name)
      if (entrada.isDirectory()) await agregar(ruta)
      else if (/\.(ts|mjs|json)$/.test(entrada.name)) hash.update(path.relative(directorio, ruta)).update(await readFile(ruta))
    }
  }
  await agregar(directorio)
  return hash.digest('hex')
}

function procedenciaGit() {
  const git = (...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  return { commit: git('rev-parse', 'HEAD').toString('utf8').trim(), huellaDiff: createHash('sha256').update(git('diff', 'HEAD', '--binary')).digest('hex') }
}

function configuracionesDe(opciones: Opciones, previo: Indice | null): Configuracion[] {
  if (previo) return previo.casos.map(caso => caso.configuracion)
  const disponibles = escenarios()
  return (opciones.escenarios ?? disponibles.map(escenario => escenario.id)).flatMap(id => {
    const escenario = disponibles.find(candidato => candidato.id === id)
    if (!escenario) throw new Error(`Escenario desconocido: ${id}`)
    return opciones.semillas.map(semilla => ({ version: 2 as const, escenario, semilla, semanas: opciones.semanas, inicio: opciones.inicio }))
  })
}

export async function evaluarBateria(opciones: Opciones): Promise<ResultadoBateria> {
  const previo = opciones.comparar ? JSON.parse(await readFile(opciones.comparar, 'utf8')) as Indice : null
  const configuraciones = configuracionesDe(opciones, previo)
  if (!configuraciones.length || configuraciones.reduce((dias, configuracion) => dias + configuracion.semanas * 7, 0) > 2_000_000) throw new Error('Tamaño de batería no permitido')
  for (const configuracion of configuraciones) validarConfiguracion(configuracion)
  const codigo = await huellaCodigo()
  const { huellaCatalogo } = identidad()
  if (previo && codigo !== previo.huellaCodigo) throw new Error('El código del simulador ha cambiado respecto a la ejecución a reproducir')
  if (previo && huellaCatalogo !== previo.huellaCatalogo) throw new Error('El catálogo ha cambiado respecto a la ejecución a reproducir')

  const salida = path.join(raiz, '.cache/simulador-jowyfit', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`)
  await mkdir(salida, { recursive: true })
  console.log(`Evaluación de JowyFit: ${configuraciones.length} recorridos. Informes: ${salida}`)
  const casos: Caso[] = []
  const discrepancias: string[] = []
  for (const [posicion, configuracion] of configuraciones.entries()) {
    const informe = await simular(configuracion)
    const texto = JSON.stringify(informe)
    const sha256 = createHash('sha256').update(texto).digest('hex')
    const archivo = `${configuracion.escenario.id}-${configuracion.semilla}`
    if (previo && previo.casos.find(caso => caso.archivo === archivo)?.sha256 !== sha256) discrepancias.push(archivo)
    await writeFile(path.join(salida, `${archivo}.json`), `${texto}\n`, { encoding: 'utf8', flag: 'wx' })
    await writeFile(path.join(salida, `${archivo}.md`), markdown(informe), { encoding: 'utf8', flag: 'wx' })
    casos.push({ configuracion, sha256, dias: informe.pasos.length, resumen: informe.resumen, archivo })
    if (configuraciones[posicion + 1]?.escenario.id !== configuracion.escenario.id) {
      const grupo = casos.filter(caso => caso.configuracion.escenario.id === configuracion.escenario.id)
      console.log(`${configuracion.escenario.id}: ${grupo.length} recorridos; ${grupo.reduce((suma, caso) => suma + caso.resumen.contratos.fallida, 0)} incumplimientos`)
    }
  }

  const fallos = casos.reduce((suma, caso) => suma + caso.resumen.contratos.fallida, 0)
  const indice = {
    objetivo: 'JowyFit real', ...procedenciaGit(), huellaCodigo: codigo, huellaCatalogo,
    node: process.version, zona: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ejecuciones: casos.length, dias: casos.reduce((suma, caso) => suma + caso.dias, 0), fallos, discrepancias,
    comparadoCon: opciones.comparar, casos,
  }
  await writeFile(path.join(salida, 'indice.json'), `${JSON.stringify(indice, null, 2)}\n`, 'utf8')
  console.log(`${fallos} incumplimientos${previo ? `; ${discrepancias.length} recorridos distintos del anterior` : ''}. Índice: ${path.join(salida, 'indice.json')}`)
  return { salida, fallos, discrepancias }
}
