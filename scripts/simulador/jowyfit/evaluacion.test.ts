import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { simular } from '../motor'
import { markdown } from '../informe'
import { validarConfiguracion } from '../validar'
import type { Configuracion, Resumen } from '../tipos'
import type { Opciones } from '../cli'
import { crearAdaptador } from './adaptador'
import { escenariosJowyFit } from './perfiles'

type Caso = { configuracion: Configuracion; sha256: string; dias: number; resumen: Resumen; archivo: string }
type Indice = { casos: Caso[]; huellaCatalogo: string | null; huellaCodigo: string }

async function huellaCodigo(directorio: string): Promise<string> {
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

it('evalúa todas las configuraciones solicitadas y conserva los hallazgos', async () => {
  const ruta = process.env.JOWYFIT_SIM_SOLICITUD
  if (!ruta) throw new Error('Usar el lanzador evaluar-jowyfit.mjs para crear la solicitud')
  const solicitud = JSON.parse(await readFile(ruta, 'utf8')) as { opciones: Opciones; comparar: string | null; salida: string }
  const previo = solicitud.comparar ? JSON.parse(await readFile(solicitud.comparar, 'utf8')) as Indice : null
  const escenarios = escenariosJowyFit()
  const opciones = solicitud.opciones
  const configuraciones: Configuracion[] = previo ? previo.casos.map(caso => caso.configuracion) : (opciones.escenarios ?? escenarios.map(escenario => escenario.id)).flatMap(id => {
    const escenario = escenarios.find(escenario => escenario.id === id)
    if (!escenario) throw new Error(`Escenario desconocido: ${id}`)
    return opciones.semillas.map(semilla => ({ version: 1 as const, escenario, semilla, semanas: opciones.semanas, inicio: opciones.inicio }))
  })
  if (!configuraciones.length || configuraciones.reduce((dias, configuracion) => dias + configuracion.semanas * 7, 0) > 2_000_000) throw new Error('Tamaño de batería no permitido')
  const claves = configuraciones.map(configuracion => `${configuracion.escenario.id}-${configuracion.semilla}`)
  if (new Set(claves).size !== claves.length) throw new Error('Configuraciones repetidas')
  for (const configuracion of configuraciones) validarConfiguracion(configuracion)
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const diff = execFileSync('git', ['diff', 'HEAD', '--binary'], { maxBuffer: 32 * 1024 * 1024 })
  const codigo = await huellaCodigo('scripts/simulador')
  const casos: Caso[] = []
  const discrepancias: string[] = []
  let catalogo: string | null = null
  for (const configuracion of configuraciones) {
    const adaptador = crearAdaptador()
    catalogo ??= adaptador.identidad.huellaCatalogo
    expect(adaptador.identidad.huellaCatalogo).toBe(catalogo)
    if (previo) {
      expect(catalogo, 'El catálogo ha cambiado respecto a la ejecución a reproducir').toBe(previo.huellaCatalogo)
      expect(codigo, 'El código del simulador ha cambiado respecto a la ejecución a reproducir').toBe(previo.huellaCodigo)
    }
    const informe = await simular(configuracion, adaptador, { permitirAplicacion: true })
    const texto = JSON.stringify(informe)
    const sha256 = createHash('sha256').update(texto).digest('hex')
    const archivo = `${configuracion.escenario.id}-${configuracion.semilla}`
    const anterior = previo?.casos.find(caso => caso.archivo === archivo)
    if (previo && anterior?.sha256 !== sha256) discrepancias.push(archivo)
    await writeFile(path.join(solicitud.salida, `${archivo}.json`), `${texto}\n`, { encoding: 'utf8', flag: 'wx' })
    await writeFile(path.join(solicitud.salida, `${archivo}.md`), markdown(informe), { encoding: 'utf8', flag: 'wx' })
    casos.push({ configuracion, sha256, dias: informe.pasos.length, resumen: informe.resumen, archivo })
    const siguiente = configuraciones[casos.length]
    if (!siguiente || siguiente.escenario.id !== configuracion.escenario.id) {
      const grupo = casos.filter(caso => caso.configuracion.escenario.id === configuracion.escenario.id)
      console.log(`${configuracion.escenario.id}: ${grupo.length} recorridos; ${grupo.reduce((suma, caso) => suma + caso.resumen.contratos.fallida, 0)} incumplimientos`)
    }
  }
  const fallos = casos.reduce((suma, caso) => suma + caso.resumen.contratos.fallida, 0)
  const indice = {
    objetivo: 'JowyFit real', commit, huellaDiff: createHash('sha256').update(diff).digest('hex'), huellaCodigo: codigo, huellaCatalogo: catalogo,
    node: process.version, zona: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ejecuciones: casos.length, dias: casos.reduce((suma, caso) => suma + caso.dias, 0), fallos, discrepancias,
    comparadoCon: solicitud.comparar, casos,
  }
  await writeFile(path.join(solicitud.salida, 'indice.json'), `${JSON.stringify(indice, null, 2)}\n`, 'utf8')
  console.log(`Índice: ${path.join(solicitud.salida, 'indice.json')}`)
  expect(discrepancias, 'Recorridos no reproducidos').toEqual([])
  expect(fallos, `Hallazgos guardados en ${solicitud.salida}`).toBe(0)
})
