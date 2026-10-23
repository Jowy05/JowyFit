// El tutorial: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import { altaRapida, escenario, esperar, js, noVer, pulsar, recargar, t, ver } from '../ayudantes.mjs'

escenario('tutorial: se ofrece una vez, «Ahora no», desde Ajustes, Atrás, Esc, botón atrás y entero sin tapar nada', async () => {
  await altaRapida('2026-10-13T05:20:00')
  // Las demás pruebas lo dan por ofrecido; esta lo quiere ver: la primera vez, con Inicio a la vista, sale solo.
  await js(`sessionStorage.setItem('__e2e_tutorial', '1'); localStorage.removeItem('jf-tutorial-ofrecido')`)
  await recargar()
  await ver('¿Te enseño cómo funciona JowyFit?', 8000)
  await pulsar('Ahora no', '.sheet')
  await noVer('¿Te enseño cómo funciona JowyFit?')
  // Una sola vez: al volver a entrar ya no sale.
  await recargar()
  await esperar(3200)
  await noVer('¿Te enseño cómo funciona JowyFit?')

  // Desde Ajustes, cuando se quiera. Siguiente y Atrás fijan su pantalla; Esc lo cierra y deja Ajustes como estaba.
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Ver el tutorial')
  await ver('Así funciona JowyFit')
  await pulsar('Siguiente', '.tut'); await ver('Tu semana de un vistazo')
  await pulsar('Siguiente', '.tut'); await ver('Lo que te toca hoy')
  await pulsar('Atrás', '.tut'); await ver('Tu semana de un vistazo')
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await esperar(400)
  if (await js(`return !!document.querySelector('.tut')`)) throw new Error('Esc no cierra el tutorial')
  await ver('Apariencia')
  // El botón atrás del móvil también lo cierra (y no saca de la pantalla).
  await pulsar('Ver el tutorial'); await ver('Así funciona JowyFit')
  await js(`window.__jfAtras()`); await esperar(400)
  if (await js(`return !!document.querySelector('.tut')`)) throw new Error('El botón atrás no cierra el tutorial')
  await ver('Apariencia')

  // Entero: ningún paso saltado, la tarjeta nunca tapa lo que señala y al terminar se vuelve a Ajustes.
  await pulsar('Ver el tutorial'); await ver('Así funciona JowyFit')
  const vistos = []
  for (let k = 0; k < 25; k++) {
    await esperar(1300)
    const m = await js(`
      const t = document.querySelector('[data-tut-tarjeta] h2')?.textContent
      const fo = document.querySelector('[data-tut-foco]')?.getBoundingClientRect()
      const c = document.querySelector('[data-tut-tarjeta]').getBoundingClientRect()
      const tapa = fo ? !(c.right < fo.left + 4 || c.left > fo.right - 4 || c.bottom < fo.top + 4 || c.top > fo.bottom - 4) : false
      const ultimo = /Terminar/.test(document.querySelector('[data-tut-tarjeta] .tut-btns .btn:last-child')?.textContent || '')
      return { t, tapa, ultimo, n: document.querySelector('.tut-n')?.textContent }`)
    vistos.push(m.t)
    if (m.tapa) throw new Error(`La tarjeta tapa lo señalado en «${m.t}»`)
    if (m.ultimo) { await js(`document.querySelector('[data-tut-tarjeta] .tut-btns .btn:last-child').click()`); break }
    await js(`document.querySelector('[data-tut-tarjeta] .tut-btns .btn:last-child').click()`)
  }
  const esperados = ['Así funciona JowyFit', 'Tu semana de un vistazo', 'Lo que te toca hoy', 'Durante el entreno', 'Apunta en un toque', 'Tu día en números', 'Tu rutina, hecha para ti', 'Apunta lo que comes', 'La proteína del día', 'Cómo vas', 'Copias de seguridad', 'Tu informe en PDF', '¡Listo! A entrenar']
  if (JSON.stringify(vistos) !== JSON.stringify(esperados)) throw new Error(`Pasos: ${vistos.join(' | ')}`)
  await esperar(400)
  if (await js(`return !!document.querySelector('.tut')`)) throw new Error('«Terminar» no cierra el tutorial')
  await ver('Apariencia')
})
