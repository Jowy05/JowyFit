// Lanzador de la batería: lee las opciones y pide a Vitest que ejecute evaluarBateria(opciones) en su entorno aislado.
import path from 'node:path'
import { startVitest } from 'vitest/node'
import { AYUDA, opcionesDe } from './opciones.ts'

const raiz = path.resolve(import.meta.dirname, '../..')

try {
  const opciones = opcionesDe(process.argv.slice(2))
  if (!opciones) {
    console.log(AYUDA)
  } else {
    if (opciones.comparar) opciones.comparar = path.resolve(opciones.comparar)
    const vitest = await startVitest('test', [], {
      root: raiz, config: path.join(raiz, 'scripts/simulador/vitest.config.ts'), watch: false, silent: false, provide: { bateria: opciones },
    })
    await vitest.close()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
