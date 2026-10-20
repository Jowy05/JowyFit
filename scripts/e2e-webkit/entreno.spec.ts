// Entreno de principio a fin en iPhone: series, descanso con sonido y destello (no hay vibración), pantalla
// encendida, Ocupado, saltar ejercicio, botón atrás de la app, resumen y volver al entreno.
import { expect, test } from './ayuda'

test('entreno de principio a fin', async ({ page, jf }) => {
  await jf.deCero('2026-10-13T05:20:00') // martes, día de entreno
  await jf.alta()
  // Sonido al acabar el descanso (en Más ajustes). En iPhone no se ofrece vibrar.
  await jf.pulsarSel('button[aria-label="Ajustes"]')
  await jf.pulsar('Más ajustes')
  await jf.ver('Sonido al acabar el descanso')
  await jf.noVer('Vibrar al acabar el descanso')
  // En iPhone el sonido viene encendido de serie (no hay vibración ni aviso con el móvil bloqueado).
  await expect(page.locator('[role=switch][aria-label="Sonido al acabar el descanso"]')).toHaveAttribute('aria-checked', 'true')
  await jf.pestana('Inicio')
  // El sonido se abre con el primer toque (en iPhone, si no, el pitido no suena).
  expect((await jf.registro()).audio.resumes).toBeGreaterThan(0)

  await jf.pulsar('Empezar rutina')
  await jf.ver('Empezar', 5000)
  await jf.revisar('hoja Empezar')
  await jf.pulsar('Empezar', '.sheet')
  await jf.ver('Hecho', 8000)
  // Pantalla encendida durante el entreno.
  await expect.poll(async () => (await jf.registro()).wl).toContain('screen')

  // Primera serie → descanso. Se adelanta el reloj hasta el final: suena y la pantalla destella.
  await jf.ponerPesoSiFalta()
  await jf.pulsar(/^Hecho$/)
  await jf.ver('Próxima', 5000)
  const curso = (await jf.tabla<{ estado: string; descansoHasta?: number }>('sesiones')).find(s => s.estado === 'curso')!
  expect(curso.descansoHasta).toBeTruthy()
  const ahora = await page.evaluate(() => Date.now())
  const osc = (await jf.registro()).audio.osc
  await jf.adelantar(curso.descansoHasta! - ahora + 300)
  await expect(page.locator('.destello')).toBeVisible({ timeout: 4000 })
  await expect(page.locator('.destello')).toContainText('Siguiente serie')
  expect((await jf.registro()).audio.osc).toBeGreaterThanOrEqual(osc + 3)
  await expect(page.locator('.destello')).toBeHidden({ timeout: 4000 })
  // Pantalla completa: el marco no se ha desplazado (Safari lo movía al llevar un botón a la vista) y la barra de
  // pestañas sigue escondida debajo, sin asomar.
  expect(await jf.js<number>(`return document.querySelector('.app').scrollTop + document.querySelector('.screens').scrollTop`)).toBe(0)
  expect(await jf.js<boolean>(`return document.querySelector('.tabbar').getBoundingClientRect().top >= innerHeight`)).toBe(true)

  // Hojas del entreno: Más, cómo se hace, nota de la serie, lista.
  await jf.pulsarSel('button[aria-label="Herramientas"]')
  await jf.ver('Cómo se hace')
  await jf.revisar('hoja Más')
  if (await jf.hay('Calculadora de discos')) { await jf.pulsar('Calculadora de discos', '.sheet'); await jf.ver(/por lado|discos/i); await jf.cerrarHoja(); await jf.pulsarSel('button[aria-label="Herramientas"]') }
  if (await jf.hay('Calentamiento sugerido')) { await jf.pulsar('Calentamiento sugerido', '.sheet'); await jf.ver(/Calentamiento/); await jf.cerrarHoja(); await jf.pulsarSel('button[aria-label="Herramientas"]') }
  await jf.pulsar('Apuntar una nota', '.sheet')
  await jf.escribir('.sheet textarea', 'Agarre raro')
  await jf.pulsar('Guardar', '.sheet')
  await jf.ver('Nota guardada')
  await jf.pulsarSel('button[aria-label="Herramientas"]')
  await jf.pulsar('Cómo se hace', '.sheet')
  await jf.ver(/Instrucciones|Cómo se hace/)
  await jf.cerrarHoja()

  // Ocupado: otra máquina parecida o hacer otro ejercicio antes.
  await jf.pulsar(/^Ocupado$/)
  await jf.ver(/Hacer esta|Hacerlo ahora|Esperar/)
  await jf.revisar('hoja Ocupado')
  await jf.pulsar(/Hacer esta|Hacerlo ahora/, '.sheet')
  await jf.ver('Hecho', 6000)

  // Saltar un ejercicio entero.
  await jf.pulsar('Saltar este ejercicio')
  await jf.ver('Saltado:')
  expect((await jf.tabla<{ estado: string; ejercicios: { estado: string }[] }>('sesiones')).find(s => s.estado === 'curso')!.ejercicios.some(e => e.estado === 'saltado')).toBe(true)

  // El botón atrás (en iPhone, el de la app) pregunta si acabar; «Continuar» sigue.
  await page.evaluate(() => (window as unknown as { __jfAtras: () => boolean }).__jfAtras())
  await jf.ver('Estás entrenando')
  await jf.revisar('hoja salir del entreno')
  await jf.pulsar('Continuar', '.sheet')
  await jf.ver('Hecho')

  // El resto de series hasta el final.
  for (let i = 0; i < 90 && !(await jf.hay('Entreno terminado')); i++) {
    if (await jf.hay(/Saltar/)) await jf.pulsar(/^Saltar$/).catch(() => {})
    await jf.ponerPesoSiFalta()
    await jf.pulsar(/^Hecho$/).catch(() => {})
  }
  await jf.ver('Entreno terminado', 8000)
  await jf.revisar('resumen')
  // Volver al entreno desde el resumen y terminar desde la lista.
  await jf.pulsarSel('button[aria-label="Volver al entreno"]')
  await jf.ver('Has hecho todos los ejercicios')
  await jf.pulsarSel('[aria-label="Lista de la sesión"]')
  await jf.revisar('hoja Lista')
  await jf.pulsar('Terminar entreno', '.sheet')
  await jf.ver('Entreno terminado')
  await jf.pulsar('Guardar')
  await jf.ver(/hecho/i, 8000)
  expect((await jf.tabla<{ estado: string }>('sesiones')).filter(s => s.estado === 'hecha')).toHaveLength(1)
  // Al salir del entreno se suelta la pantalla encendida.
  await expect.poll(async () => (await jf.registro()).wlSueltos).toBeGreaterThan(0)
})

test('entreno libre: el botón atrás de la app lo cierra sin guardar', async ({ jf }) => {
  await jf.deCero('2026-10-13T05:20:00')
  await jf.alta()
  await jf.pestana('Rutina')
  await jf.pulsar('Otras formas de entrenar')
  await jf.pulsar('Entreno libre')
  await jf.ver('Añade el primer ejercicio', 8000)
  await jf.pulsar('Añadir ejercicio')
  await jf.ver(/Buscar|ejercicio/i)
  await jf.revisar('hoja elegir ejercicio')
  await jf.cerrarHoja()
  await jf.page.evaluate(() => (window as unknown as { __jfAtras: () => boolean }).__jfAtras())
  await jf.ver('Estás en un entreno libre')
  await jf.pulsar('Acabar', '.sheet')
  await jf.ver('Entreno libre cerrado')
  expect((await jf.tabla<{ estado: string }>('sesiones')).some(s => s.estado === 'curso')).toBe(false)
})
