import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { db } from '../../../../src/datos/db'
import { simular } from '../../motor'
import type { Configuracion } from '../../tipos'
import { crearAdaptador } from '../adaptador'
import { escenariosJowyFit, perfilSintetico } from '../perfiles'

function configuracion(id: string, semanas = 2): Configuracion {
  const escenario = escenariosJowyFit().find(escenario => escenario.id === id)!
  return { version: 1, escenario, inicio: '2026-01-05', semanas, semilla: 1 }
}

describe('adaptador de acciones reales de JowyFit', () => {
  it('traduce urgencias, condiciones y posparto a campos reales sin inventar bloqueos', () => {
    expect(perfilSintetico(configuracion('bloqueo-pecho')).urgencias).toEqual(['pecho'])
    expect(perfilSintetico(configuracion('condiciones')).condicionesSalud).toEqual(['tension', 'osteoporosis'])
    expect(perfilSintetico(configuracion('posparto')).condicionesSalud).toEqual(['embarazo'])
    expect(perfilSintetico(configuracion('posparto')).urgencias).toEqual([])
    expect(perfilSintetico(configuracion('sabado-opcional')).diasFijos).toEqual([0, 2, 4])
    expect(perfilSintetico(configuracion('sabado-opcional')).diasOpcionales).toEqual([5])
  })

  it('rechaza restricciones sin traducción en vez de omitirlas', () => {
    const entrada = configuracion('casa-rodilla')
    entrada.escenario.persona.restricciones = ['inventada']
    expect(() => perfilSintetico(entrada)).toThrow('sin correspondencia')
  })

  it('usa una base temporal con catálogo real y la elimina al terminar', async () => {
    expect(db.name).toBe('jowyfit-simulador')
    expect(globalThis.indexedDB).toBeInstanceOf(IDBFactory)
    const adaptador = crearAdaptador()
    expect(adaptador.identidad.objetivo).toBe('aplicacion')
    expect(adaptador.identidad.huellaCatalogo).toMatch(/^[a-f0-9]{64}$/)
    const informe = await simular(configuracion('musculo-gimnasio'), adaptador, { permitirAplicacion: true })
    expect(informe.resumen.contratos.fallida, JSON.stringify(informe.pasos.flatMap(paso => paso.comprobaciones.filter(regla => regla.estado === 'fallida')))).toBe(0)
    expect(informe.resumen.sesiones.completas).toBe(8)
    expect(informe.resumen.reglas['calibracion.definitiva']!.aprobada).toBe(1)
    expect(informe.resumen.reglas['sesion.persistencia']!.aprobada).toBe(8)
    expect(informe.resumen.reglas['aplicacion.restricciones']!.pendiente).toBe(0)
    expect(db.isOpen()).toBe(false)
  })

  it('la urgencia de pecho bloquea el alta real y todas las sesiones', async () => {
    const informe = await simular(configuracion('bloqueo-pecho'), crearAdaptador(), { permitirAplicacion: true })
    expect(informe.resumen.contratos.fallida).toBe(0)
    expect(informe.resumen.sesiones.completas).toBe(0)
    expect(informe.resumen.reglas['alta.bloqueo']!.aprobada).toBe(1)
    expect(informe.resumen.reglas['salud.bloqueo']!.aprobada).toBe(14)
  })

  it('normaliza los identificadores volátiles al repetir el mismo recorrido', async () => {
    const entrada = configuracion('musculo-gimnasio')
    const primera = await simular(entrada, crearAdaptador(), { permitirAplicacion: true })
    const segunda = await simular(entrada, crearAdaptador(), { permitirAplicacion: true })
    expect(segunda).toEqual(primera)
  })

  it('descartar un entrenamiento no lo termina ni avanza la cola real', async () => {
    const entrada = configuracion('musculo-gimnasio', 1)
    entrada.escenario.eventos = [{ dia: 0, tipo: 'sesion', valor: 'abandonada' }]
    const informe = await simular(entrada, crearAdaptador(), { permitirAplicacion: true })
    expect(informe.pasos[0]!.plan!.letra).toBe(informe.pasos[1]!.plan!.letra)
    expect(informe.resumen.sesiones.abandonadas).toBe(1)
    expect(informe.resumen.reglas['sesion.persistencia']!.aprobada).toBe(4)
    expect(informe.resumen.contratos.fallida).toBe(0)
  })

  it('aplica la progresión y las descargas a partir del historial real', async () => {
    const informe = await simular(configuracion('progresion-facil', 8), crearAdaptador(), { permitirAplicacion: true })
    expect(informe.resumen.acciones.subir).toBeGreaterThan(0)
    expect(informe.resumen.reglas['descarga.aceptar']!.aprobada).toBeGreaterThan(0)
    expect(informe.resumen.reglas['descarga.aplicada']!.aprobada).toBeGreaterThan(0)
    expect(informe.resumen.contratos.fallida).toBe(0)
  })
})
