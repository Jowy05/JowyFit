// Fotos, horarios, historial de energía y metas de repeticiones a 360 px.
import path from 'node:path'
import { test, expect, RAIZ } from './ayuda'
import type { Ajustes, Meta } from '../../src/datos/tipos'

test.use({ viewport: { width: 360, height: 740 }, actionTimeout: 15_000 })

test('cámara sin permiso: explica el fallo y permite guardar con el selector', async ({ jf, page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new DOMException('Denegado', 'NotAllowedError') } } })
  })
  await jf.deCero('2026-11-04T18:00:00')
  await jf.alta()
  await jf.pestana('Progreso')
  await jf.seg('Fotos')
  await jf.pulsar('Hacer la primera foto')
  await jf.ver('No hay permiso para usar la cámara.')
  await jf.revisar('Cámara sin permiso')
  const selector = page.waitForEvent('filechooser')
  await jf.pulsar('Abrir la cámara del móvil')
  await (await selector).setFiles(path.join(RAIZ, 'public/iconos/icono-512.png'))
  await jf.ver('Foto guardada')
  expect(await jf.tabla('fotos')).toHaveLength(1)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await jf.ver('Comparador')
})

test('horas de comida: guarda al salir, rechaza el orden y restaura valores', async ({ jf, page }) => {
  await jf.deCero('2026-11-04T18:00:00')
  await jf.alta()
  await jf.pestana('Perfil')
  await jf.pulsarSel('button[aria-label="Ajustes"]')
  await jf.pulsar('Más ajustes')
  const hora = page.locator('input[type="time"][aria-label="Hora de desayuno"]')
  await hora.fill('06:30')
  await hora.blur()
  await expect.poll(async () => (await jf.tabla<Ajustes>('ajustes'))[0]!.franjasHoras?.desayuno).toBe('06:30')
  await hora.fill('23:00')
  await hora.blur()
  await jf.ver('Cada comida tiene que empezar más tarde que la anterior')
  expect((await jf.tabla<Ajustes>('ajustes'))[0]!.franjasHoras?.desayuno).toBe('06:30')
  await jf.pulsar('Volver a las de siempre')
  await expect(hora).toHaveValue('05:00')
  await jf.revisar('Franjas horarias')
})

test('historial de energía y meta de repeticiones aparecen en sus pantallas', async ({ jf, page }) => {
  await jf.deCero('2026-11-04T18:00:00')
  await jf.alta()
  const a = (await jf.tabla<Ajustes>('ajustes'))[0]!
  await jf.meter('ajustes', [{ ...a, ultimoAjusteEnergia: '2026-11-04', historialEnergia: [{ fecha: '2026-11-04', antes: null, despues: { kcal: 2250, proteina: 145, peso: 80 }, porque: 'inicio' }] }])
  await jf.meter('metas', [{ id: 77, tipo: 'reps', titulo: 'Doce seguidas', ejercicio: 'bench-press', inicio: 6, objetivo: 12, unidad: 'reps' } satisfies Meta])
  await page.reload()
  await jf.abierta()
  await jf.pestana('Comida')
  await page.getByRole('button', { name: /Tu objetivo de energía/ }).click()
  await jf.ver('Punto de partida: calculado con tu peso, tu altura y tu actividad.')
  await jf.revisar('Historial de energía')
  await jf.pestana('Progreso')
  await jf.seg('Metas')
  await jf.ver('Doce seguidas')
  await jf.pulsar('Crear otra meta')
  await jf.pulsar('Repeticiones', '.sheet')
  await jf.ver('Cuenta tu mejor serie: las repeticiones seguidas sin parar.')
  await jf.revisar('Meta de repeticiones')
})
