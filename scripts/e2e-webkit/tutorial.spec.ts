// Tutorial en iPhone: se ofrece la primera vez (después de las instrucciones para instalarla), explica lo adaptado
// (pendientes, pasos a mano, copia con Compartir, pitido y destello) y no enseña nada que en iPhone no funcione.
import { expect, test } from './ayuda'

test.describe('tutorial en iPhone sin instalar', () => {
  test.use({ instalada: false })

  test('se ofrece una vez y el paseo entero es el de iPhone, sin tapar lo que señala', async ({ page, jf }) => {
    await jf.deCero('2026-10-13T05:20:00', 'app.html', 'Ponla en tu pantalla de inicio')
    await page.getByRole('button', { name: 'Seguir en el navegador' }).tap()
    await jf.alta()
    // Las demás pruebas lo dan por ofrecido; esta lo quiere ver.
    await page.evaluate(() => { sessionStorage.setItem('__e2e_tutorial', '1'); localStorage.removeItem('jf-tutorial-ofrecido') })
    await page.reload()
    const oferta = page.getByRole('dialog').filter({ hasText: '¿Te enseño cómo funciona JowyFit?' })
    await expect(oferta).toBeVisible({ timeout: 10000 })
    await oferta.getByRole('button', { name: /Sí, enséñamelo/ }).tap()

    const tarjeta = page.locator('[data-tut-tarjeta]')
    const vistos: string[] = []
    for (let k = 0; k < 25; k++) {
      await page.waitForTimeout(1300)
      const m = await page.evaluate(() => {
        const fo = document.querySelector('[data-tut-foco]')?.getBoundingClientRect()
        const c = document.querySelector('[data-tut-tarjeta]')!.getBoundingClientRect()
        return {
          t: document.querySelector('[data-tut-tarjeta] h2')?.textContent ?? '',
          texto: document.querySelector('[data-tut-tarjeta] p')?.textContent ?? '',
          tapa: fo ? !(c.right < fo.left + 4 || c.left > fo.right - 4 || c.bottom < fo.top + 4 || c.top > fo.bottom - 4) : false,
        }
      })
      vistos.push(m.t)
      expect(m.tapa, `la tarjeta tapa lo señalado en «${m.t}»`).toBe(false)
      if (m.t === 'Durante el entreno') expect(m.texto).toContain('destella')
      if (m.t === 'Tu día en números') expect(m.texto).toContain('app Salud')
      if (m.t === 'Copias de seguridad') expect(m.texto).toContain('menú Compartir')
      const boton = tarjeta.locator('.tut-btns .btn').last()
      const ultimo = /Terminar/.test(await boton.textContent() ?? '')
      await boton.tap()
      if (ultimo) break
    }
    expect(vistos).toEqual([
      'Así funciona JowyFit', 'Tu semana de un vistazo', 'Lo que te toca hoy', 'Durante el entreno', 'Apunta en un toque',
      'Tu día en números', 'Tus pendientes de hoy', 'Tu rutina, hecha para ti', 'Apunta lo que comes', 'La proteína del día',
      'Cómo vas', 'Ponla en tu pantalla de inicio', 'Copias de seguridad', 'Tu informe en PDF', '¡Listo! A entrenar',
    ])
    await expect(page.locator('.tut')).toHaveCount(0)
    // Vuelve a donde estaba (Inicio) y no se vuelve a ofrecer.
    await jf.ver(/Buenos|Buenas/)
    await page.reload()
    await page.waitForTimeout(3200)
    await expect(oferta).toHaveCount(0)
  })
})
