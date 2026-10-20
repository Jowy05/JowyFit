// Alta completa y repaso de las 5 pestañas, sus pantallas y hojas en iPhone (claro y oscuro): nada roto,
// nada fuera de la pantalla y nada de Android.
import { DE_ANDROID, expect, test } from './ayuda'

test('alta completa', async ({ page, jf }) => {
  await jf.deCero('2026-10-13T05:20:00')
  await jf.ver('Tu fuerza y tu comida')
  await jf.revisar('bienvenida')
  await jf.alta()
  await jf.ver('Empezar rutina')
  await jf.ver('Primeros pasos')
  await jf.pulsar('Ya lo sé')
  await jf.noVer('Primeros pasos')
  const [perfil] = await jf.tabla<{ altaCompleta: boolean; nombre: string }>('perfil')
  expect(perfil!.altaCompleta).toBe(true)
  // La barra de pestañas, a la vista y con las cinco.
  await expect(page.locator('.tabbar button')).toHaveCount(5)
  await jf.pestana('Rutina')
  await jf.ver('Cuerpo completo')
  await jf.ver(/Semana de (calibración|prueba)/i)
})

for (const tema of ['light', 'dark'] as const) {
  test(`las 5 pestañas y sus apartados · ${tema === 'light' ? 'claro' : 'oscuro'}`, async ({ page, jf }) => {
    await page.emulateMedia({ colorScheme: tema })
    await jf.deCero('2026-10-15T18:00:00')
    await jf.alta()
    for (const p of ['Inicio', 'Rutina', 'Comida', 'Progreso', 'Perfil']) {
      await jf.pestana(p)
      const segs = await jf.js<string[]>(`return [...document.querySelectorAll('.screen .seg button')].map(b => b.textContent.trim())`)
      for (const s of segs.length ? segs : [null]) {
        if (s) await jf.seg(s)
        await jf.revisar(`${p}${s ? ' / ' + s : ''}`)
        await jf.noVer(DE_ANDROID)
      }
    }
  })
}

test('pantallas y hojas de Rutina', async ({ jf }) => {
  await jf.deCero('2026-10-14T18:00:00')
  await jf.alta()
  await jf.pestana('Rutina')
  await jf.pulsar(/Cuerpo completo A/)
  await jf.listo()
  await jf.revisar('detalle del día')
  await jf.volver()
  await jf.pulsar('Editar plan')
  await jf.listo()
  await jf.revisar('Editar plan')
  await jf.pulsar(/Añadir ejercicio/).catch(() => {})
  if (await jf.hay(/Buscar/)) { await jf.revisar('hoja elegir ejercicio'); await jf.cerrarHoja() }
  await jf.pulsar('Rehacer la rutina desde cero')
  await jf.revisar('hoja rehacer')
  await jf.pulsar('Ver la rutina nueva', '.sheet')
  await jf.listo()
  await jf.revisar('Generar rutina')
  await jf.pulsar('Usar esta rutina')
  await jf.pestana('Rutina')
  await jf.seg('Ejercicios')
  await jf.escribir('input[type=search]', 'press banca')
  await jf.pulsar(/Press de Banca con Barra/i)
  await jf.ver('Músculos que trabaja')
  await jf.revisar('ficha de ejercicio')
  await jf.volver()
  await jf.pestana('Rutina')
  await jf.seg('Gimnasios')
  await jf.pulsar(/Editar/)
  await jf.ver('Máquinas y material')
  await jf.revisar('editor de gimnasio')
  await jf.pulsar('Añadir una máquina que no sale')
  await jf.revisar('hoja máquina')
  await jf.cerrarHoja()
  await jf.pulsar('Guardar')
})
