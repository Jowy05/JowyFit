import { describe, expect, it } from 'vitest'
import { estadoInicial, queHaceAtras, reducirNav } from '../src/ui/nav'

describe('botón atrás del móvil', () => {
  it('en el entreno pregunta si acabarlo en vez de salir sin más', () => {
    const entreno = reducirNav(estadoInicial(), { t: 'completa', ruta: { p: 'entreno' } })
    expect(queHaceAtras(entreno)).toBe('preguntar-entreno')
    // Con una hoja abierta encima (la lista, «Ocupado»…), atrás cierra la hoja.
    expect(queHaceAtras(reducirNav(entreno, { t: 'hoja', ruta: { p: 'sheet-lista' } }))).toBe('atras')
  })
  it('fuera del entreno vuelve atrás, y en Inicio deja minimizar la app', () => {
    expect(queHaceAtras(estadoInicial())).toBe('minimizar-app')
    expect(queHaceAtras(reducirNav(estadoInicial(), { t: 'pestana', pestana: 'com' }))).toBe('atras')
    expect(queHaceAtras(reducirNav(estadoInicial(), { t: 'completa', ruta: { p: 'ses-fin', d: { id: 1 } } }))).toBe('atras')
  })
})
