// Opciones del lanzador. Sin dependencias de la app: Node lo carga directamente desde evaluar-jowyfit.mjs.

export type Opciones = {
  /** null: todos los escenarios. */
  escenarios: string[] | null
  semanas: number
  semillas: number[]
  inicio: string
  /** Ruta de un indice.json anterior: repite sus configuraciones y compara los resultados. */
  comparar: string | null
}

export const AYUDA = `Recorre JowyFit (acciones y dominio reales, IndexedDB temporal) con personas sintéticas.

  node scripts/simulador/evaluar-jowyfit.mjs
  node scripts/simulador/evaluar-jowyfit.mjs --escenario musculo-gimnasio,turnos --semanas 2 --semillas 1
  node scripts/simulador/evaluar-jowyfit.mjs --comparar .cache/simulador-jowyfit/CARPETA/indice.json

Opciones:
  --ayuda              Esta ayuda.
  --escenario a,b      Identificadores separados por comas; por defecto, todos.
  --semanas n          Entre 1 y 520; por defecto, 52.
  --semillas lista     Enteros uint32 distintos separados por comas (máximo 100); por defecto, 1 a 20.
  --inicio AAAA-MM-DD  Primer día; por defecto, 2026-01-05.
  --comparar ruta      Repite las configuraciones de un indice.json anterior; no se combina con las demás.

Sin opciones tarda más de una hora. Informes en .cache/simulador-jowyfit/<ejecución>/.
Código 1 ante incumplimientos o diferencias con --comparar; los informes quedan guardados.
Evaluación de software: no demuestra eficacia fisiológica.`

function entero(texto: string, nombre: string): number {
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(Number(texto))) throw new Error(`${nombre}: se esperaba un entero sin signo`)
  return Number(texto)
}

/** Devuelve null si se ha pedido la ayuda. */
export function opcionesDe(argumentos: string[]): Opciones | null {
  if (argumentos.includes('--ayuda')) return null
  const opciones: Opciones = { escenarios: null, semanas: 52, semillas: Array.from({ length: 20 }, (_, indice) => indice + 1), inicio: '2026-01-05', comparar: null }
  const vistas = new Set<string>()
  for (let indice = 0; indice < argumentos.length; indice += 2) {
    const [opcion, valor] = [argumentos[indice]!, argumentos[indice + 1]]
    if (!['--escenario', '--semanas', '--semillas', '--inicio', '--comparar'].includes(opcion)) throw new Error(`Opción desconocida: ${opcion}`)
    if (vistas.has(opcion)) throw new Error(`Opción repetida: ${opcion}`)
    if (!valor || valor.startsWith('--')) throw new Error(`Falta el valor de ${opcion}`)
    vistas.add(opcion)
    switch (opcion) {
      case '--escenario': opciones.escenarios = valor.split(','); break
      case '--semanas': opciones.semanas = entero(valor, 'Semanas'); break
      case '--semillas': opciones.semillas = valor.split(',').map(texto => entero(texto, 'Semilla')); break
      case '--inicio': opciones.inicio = valor; break
      case '--comparar': opciones.comparar = valor; break
    }
  }
  if (opciones.comparar && vistas.size > 1) throw new Error('--comparar no se combina con otras opciones')
  if (opciones.semillas.length > 100 || new Set(opciones.semillas).size !== opciones.semillas.length) throw new Error('Máximo 100 semillas distintas')
  if (opciones.escenarios && new Set(opciones.escenarios).size !== opciones.escenarios.length) throw new Error('Escenarios repetidos')
  return opciones
}
