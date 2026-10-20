// Instrucciones para instalarla en la pantalla de inicio, y el enrutador de la landing (index.html).
import { expect, test } from './ayuda'

test.describe('sin instalar (Safari)', () => {
  test.use({ instalada: false })

  test('con ?instalar=1 salen las instrucciones y «Seguir en el navegador» las cierra', async ({ page, jf }) => {
    await jf.deCero('2026-10-13T09:00:00', 'app.html?instalar=1', 'Ponla en tu pantalla de inicio')
    const capa = page.getByRole('dialog', { name: 'Ponla en tu pantalla de inicio' })
    await expect(capa).toBeVisible()
    await expect(capa).toContainText('Toca el botón Compartir')
    await expect(capa).toContainText('«Añadir a pantalla de inicio»')
    await expect(capa).toContainText('«Añadir»')
    await expect(capa).toContainText('Instálala antes de empezar')
    await capa.getByRole('button', { name: 'Seguir en el navegador' }).tap()
    await expect(capa).toBeHidden()
    // Se quita «?instalar=1»: al recargar no vuelven a salir solas.
    expect(page.url()).not.toContain('instalar')
    await page.reload()
    await jf.ver('Tu fuerza y tu comida', 10000)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Debajo está la bienvenida, que funciona normal.
    await jf.ver('Tengo una copia')
  })

  test('la primera vez salen solas; luego se pueden volver a ver desde Ajustes', async ({ page, jf }) => {
    await jf.deCero('2026-10-13T09:00:00', 'app.html', 'Ponla en tu pantalla de inicio')
    await page.getByRole('button', { name: 'Seguir en el navegador' }).tap()
    await jf.alta()
    await jf.pulsarSel('button[aria-label="Ajustes"]')
    await jf.pulsar('Cómo ponerla en la pantalla de inicio')
    const capa = page.getByRole('dialog', { name: 'Ponla en tu pantalla de inicio' })
    await expect(capa).toBeVisible()
    // Con datos ya apuntados en Safari, avisa de que la app instalada empieza vacía.
    await expect(capa).toContainText('Ya tienes datos aquí, en Safari')
    await capa.getByRole('button', { name: 'Seguir en el navegador' }).tap()
    await expect(capa).toBeHidden()
    await jf.ver('Apariencia')
  })
})

test('instalada (pantalla de inicio): no salen al empezar', async ({ page, jf }) => {
  await jf.deCero('2026-10-13T09:00:00', 'app.html?instalar=1', 'Tu fuerza y tu comida')
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await jf.noVer('Ponla en tu pantalla de inicio')
})

test.describe('Android (navegador)', () => {
  test.use({ instalada: false, userAgent: 'Mozilla/5.0 (Linux; Android 15; NX809J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' })
  test('ni con ?instalar=1 salen las instrucciones de Apple', async ({ page, jf }) => {
    await jf.deCero('2026-10-13T09:00:00', 'app.html?instalar=1', 'Tu fuerza y tu comida')
    await page.waitForTimeout(500)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('landing (index.html)', () => {
  test.use({ instalada: false })

  test('en iPhone se ve «Abrir JowyFit», que lleva a la app con las instrucciones', async ({ page }) => {
    await page.goto('index.html')
    await expect(page.locator('html')).toHaveAttribute('data-plataforma', 'apple')
    const cta = page.locator('#cta-app')
    await expect(cta).toBeVisible()
    await expect(page.locator('#cta-apk')).toBeHidden()
    await expect(cta).toHaveAttribute('href', /app\.html\?instalar=1/)
    await cta.tap()
    await page.waitForURL(/app\.html\?instalar=1/)
    await expect(page.getByRole('dialog', { name: 'Ponla en tu pantalla de inicio' })).toBeVisible({ timeout: 15000 })
  })

  test.describe('con un móvil Android', () => {
    test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 15; NX809J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' })
    test('se ve «Descargar para Android» y no el botón de Apple', async ({ page }) => {
      await page.goto('index.html')
      await expect(page.locator('html')).toHaveAttribute('data-plataforma', 'otro')
      await expect(page.locator('#cta-apk')).toBeVisible()
      await expect(page.locator('#cta-app')).toBeHidden()
    })
  })

  test.describe('instalada', () => {
    test.use({ instalada: true })
    test('la app de la pantalla de inicio va directa a la app', async ({ page, jf }) => {
      await page.goto('index.html')
      await page.waitForURL(/app\.html/)
      await jf.ver('Tu fuerza y tu comida', 15000)
    })
  })
})
