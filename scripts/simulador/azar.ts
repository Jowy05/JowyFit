import type { Dia } from '../../src/datos/tipos'

export function huella(texto: string): number {
  let valor = 2166136261
  for (const caracter of texto) {
    valor ^= caracter.codePointAt(0)!
    valor = Math.imul(valor, 16777619)
  }
  return valor >>> 0
}

export function azar(semilla: number, ...claves: (number | string)[]): number {
  let valor = huella(JSON.stringify([semilla, ...claves]))
  valor = Math.imul(valor ^ (valor >>> 16), 2246822507)
  valor = Math.imul(valor ^ (valor >>> 13), 3266489909)
  return ((valor ^ (valor >>> 16)) >>> 0) / 4294967296
}

export function fechaEn(inicio: string, desplazamiento: number): string {
  const fecha = new Date(`${inicio}T12:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() + desplazamiento)
  return fecha.toISOString().slice(0, 10)
}

export function diaSemana(fecha: string): Dia {
  return ((new Date(`${fecha}T12:00:00.000Z`).getUTCDay() + 6) % 7) as Dia
}
