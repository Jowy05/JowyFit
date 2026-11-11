import { expect, inject, it } from 'vitest'
import { evaluarBateria } from './bateria'
import type { Opciones } from './opciones'

declare module 'vitest' {
  export interface ProvidedContext { bateria: Opciones }
}

it('batería del simulador sin incumplimientos', async () => expect(await evaluarBateria(inject('bateria'))).toMatchObject({ fallos: 0, discrepancias: [] }))
