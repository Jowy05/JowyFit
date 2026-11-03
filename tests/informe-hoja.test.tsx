// @vitest-environment jsdom
// Hoja del informe en el APK: si el PDF está hecho pero no se ha podido guardar en Documentos, se queda para
// enviarlo (Compartir va por la caché, que no pide permiso) y no dice «Guardado».
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const plat = vi.hoisted(() => ({ guardarArchivo: vi.fn(), compartirNativo: vi.fn() }))
vi.mock('../src/plataforma', async importOriginal => ({
  ...await importOriginal<typeof import('../src/plataforma')>(),
  capacidades: () => ({ compartirNativo: true, apple: false }),
  guardarArchivo: plat.guardarArchivo,
  compartirNativo: plat.compartirNativo,
}))
const crearPdf = vi.hoisted(() => vi.fn())
vi.mock('../src/informe/pdf', () => ({ crearPdf, nombrePdf: () => 'JowyFit-informe-hoy-2026-11-03.pdf' }))
vi.mock('../src/informe/calculo/leer', () => ({
  datosInforme: async () => ({ rango: {}, cabecera: { tituloPdf: 'Informe JowyFit · Hoy' } }),
  periodoInforme: async () => ({ hayDatos: true }),
}))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => ({ hayDatos: true, textoHoja: 'Hoy' }) }))
vi.mock('../src/datos/hooks', () => ({ useAjustes: () => ({}) }))
vi.mock('../src/datos/repos', () => ({ guardarAjustes: vi.fn() }))
vi.mock('../src/app/nav', () => ({ useNav: () => ({ hoja: vi.fn() }) }))

import { HojaInforme } from '../src/pantallas/perfil/HojaInforme'

const sinPermiso = () => Object.assign(new Error('Sin permiso para guardar en Documentos. Dalo en los ajustes del móvil: Aplicaciones → JowyFit → Permisos.'), { name: 'SinPermisoDocumentos' })

beforeEach(() => {
  plat.guardarArchivo.mockReset()
  plat.compartirNativo.mockReset().mockResolvedValue('compartido')
  crearPdf.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
})
afterEach(cleanup)

async function crear() {
  render(<HojaInforme />)
  fireEvent.click(screen.getByRole('button', { name: /Crear el PDF/ }))
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: /Crear el PDF/ }).disabled).toBe(false))
}

describe('HojaInforme en el APK', () => {
  it('guardado en Documentos: lo dice y deja compartirlo', async () => {
    plat.guardarArchivo.mockResolvedValue('file:///Documents/JowyFit/a.pdf')
    await crear()
    expect(screen.getByText('Guardado en Documentos/JowyFit.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: /Compartir/ })).toBeTruthy()
  })
  it('sin el permiso de Documentos: el error claro y el PDF para enviar', async () => {
    plat.guardarArchivo.mockRejectedValue(sinPermiso())
    await crear()
    expect(screen.getByRole('alert').textContent).toMatch(/Sin permiso para guardar en Documentos/)
    expect(screen.getByText('Tu PDF está listo.')).toBeTruthy()
    expect(screen.queryByText('Guardado en Documentos/JowyFit.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Guardar o enviar el PDF/ }))
    await waitFor(() => expect(plat.compartirNativo).toHaveBeenCalledWith('JowyFit-informe-hoy-2026-11-03.pdf', expect.any(Uint8Array), 'Informe JowyFit · Hoy'))
  })
  it('otro fallo al guardar (Android 11 no deja sobrescribir el PDF de una instalación anterior): también se puede enviar', async () => {
    plat.guardarArchivo.mockRejectedValue(new Error('EACCES (Permission denied)'))
    await crear()
    expect(screen.getByRole('alert').textContent).toMatch(/no ha dejado guardar el archivo/)
    expect(screen.getByText('Tu PDF está listo.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Guardar o enviar el PDF/ })).toBeTruthy()
  })
  it('si el PDF ni se llega a hacer, no queda nada que enviar', async () => {
    crearPdf.mockRejectedValue(new Error('roto'))
    await crear()
    expect(screen.getByRole('alert').textContent).toMatch(/No se ha podido crear el PDF/)
    expect(screen.queryByText('Tu PDF está listo.')).toBeNull()
    expect(screen.queryByRole('button', { name: /Guardar o enviar el PDF/ })).toBeNull()
    expect(plat.guardarArchivo).not.toHaveBeenCalled()
  })
})
