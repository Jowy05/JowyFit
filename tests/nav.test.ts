import { describe, expect, it } from 'vitest'
import { estadoInicial, queHaceAtras, reducirNav } from '../src/app/nav'

describe('botón atrás del móvil', () => {
  it('en el entreno pregunta si acabarlo en vez de salir sin más', () => {
    const entreno = reducirNav(estadoInicial(), { t: 'completa', ruta: { p: 'entreno' } })
    expect(queHaceAtras(entreno)).toBe('preguntar-entreno')
    // Con una hoja abierta encima (la lista, «Ocupado»…), atrás cierra la hoja.
    expect(queHaceAtras(reducirNav(entreno, { t: 'hoja', ruta: { p: 'hoja-lista' } }))).toBe('atras')
  })
  it('volver al entreno: lo restaura si se minimizó; si no (la app se cerró a mitad), lo abre', () => {
    const entreno = reducirNav(estadoInicial(), { t: 'completa', ruta: { p: 'entreno' } })
    const minimizado = reducirNav(reducirNav(entreno, { t: 'minimizar' }), { t: 'hoja', ruta: { p: 'hoja-peso' } })
    const vuelto = reducirNav(minimizado, { t: 'abrirEntreno' })
    expect([vuelto.completa?.p, vuelto.minimizada, vuelto.hoja]).toEqual(['entreno', null, null])
    const abierto = reducirNav(reducirNav(estadoInicial(), { t: 'hoja', ruta: { p: 'hoja-lista' } }), { t: 'abrirEntreno' })
    expect([abierto.completa?.p, abierto.hoja]).toEqual(['entreno', null])
  })
  it('fuera del entreno vuelve atrás, y en Inicio deja minimizar la app', () => {
    expect(queHaceAtras(estadoInicial())).toBe('minimizar-app')
    expect(queHaceAtras(reducirNav(estadoInicial(), { t: 'pestana', pestana: 'com' }))).toBe('atras')
    expect(queHaceAtras(reducirNav(estadoInicial(), { t: 'completa', ruta: { p: 'fin-entreno', d: { id: 1 } } }))).toBe('atras')
  })
})
