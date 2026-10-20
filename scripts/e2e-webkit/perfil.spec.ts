// Perfil y Ajustes en iPhone: todo lo que funciona, y nada de Android (Health Connect, recordatorios, vibrar…).
import { DE_ANDROID, expect, test } from './ayuda'

test('perfil, ficha y ajustes sin nada de Android', async ({ page, jf }) => {
  await jf.deCero('2026-10-13T19:00:00')
  await jf.alta()
  await jf.pestana('Perfil')
  await jf.ver('Tus números')
  await jf.revisar('Perfil')
  await jf.pulsar('Datos personales')
  await jf.listo()
  await jf.revisar('Datos personales')
  await jf.volver()
  await jf.pulsarSel('button[aria-label="Ajustes"]')
  await jf.ver('Apariencia')
  await jf.pulsar('Más ajustes')
  await jf.ver('Descanso entre series')
  const texto = await page.locator('.screen').innerText()
  expect(texto).not.toMatch(DE_ANDROID)
  expect(texto).not.toMatch(/Reloj y báscula|Copias guardadas en el móvil|No disponible/)
  // Lo que sí está en iPhone.
  for (const t of ['Tamaño de letra', 'Tema', 'Cómo ponerla en la pantalla de inicio', 'Hacer copia ahora', 'Recuperar una copia',
    'Sonido al acabar el descanso', 'Pantalla siempre encendida', 'Mostrar calorías', 'De dónde salen los pasos', 'Gimnasios', 'Cámara']) await jf.ver(t)
  await jf.ver('míralos en la app Salud')
  await jf.revisar('Ajustes')
  // Tema oscuro y letra grande.
  await jf.pulsar('Oscuro')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await jf.pulsar(/^Aa\s*Grande$/)
  await expect(page.locator('.app').first()).toHaveAttribute('data-letra', 'grande')
  await jf.revisar('Ajustes oscuro y letra grande')
  // Créditos sin las piezas que solo lleva el APK.
  await jf.pulsar('Créditos y aviso legal')
  await jf.ver('RepDB')
  await jf.ver('Open Food Facts')
  expect(await page.locator('.screen').innerText()).not.toMatch(/ML Kit|capacitor-health/)
})

test('Inicio, Pasos y Cuerpo tampoco hablan de Android (ni con una copia traída de Android)', async ({ jf }) => {
  await jf.deCero('2026-10-13T19:00:00')
  await jf.alta()
  // Como si la copia viniera de Android con Health Connect activado y una pesada de la báscula.
  const [a] = await jf.tabla('ajustes')
  await jf.meter('ajustes', [{ ...a, fuentePasos: 'auto', fuenteBascula: 'auto' }])
  await jf.meter('mediciones', [{ fecha: '2026-10-12T07:00:00', pesoKg: 79.1, bascula: { grasaPct: 24.2 }, origen: 'casa', hc: ['x1'], fuente: 'com.fitdays.fitdays' }])
  await jf.page.reload()
  await jf.ver(/Buenas|Hoy te toca|descansas/, 15000)
  await jf.noVer(DE_ANDROID)
  await jf.pestana('Progreso')
  await jf.seg('Cuerpo')
  await jf.ver('79,1')
  await jf.noVer(DE_ANDROID)
  await jf.pestana('Inicio')
  await jf.pulsarSel('.kpi.steps')
  await jf.ver('Apuntar pasos')
  await jf.noVer(DE_ANDROID)
})
