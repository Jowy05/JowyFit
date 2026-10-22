// Idiomas en iPhone: la app sale en castellano aunque Safari esté en inglés; en Ajustes se cambia a Català o a
// English y todo se repinta (pestañas, Inicio, una hoja, el tutorial, Ajustes); se recuerda al volver a abrirla; y
// una copia hecha en un idioma se recupera en otro sin perder nada.
import type { Page } from '@playwright/test'
import { expect, test, type Jf } from './ayuda'

type Idioma = 'es' | 'ca' | 'en'
// Los mismos textos en cada idioma (con su traducción de src/i18n).
const IDIOMA = {
  es: { nombre: 'Español', pestanas: ['Inicio', 'Rutina', 'Comida', 'Progreso', 'Perfil'], hoy: 'Hoy te toca', empezar: 'Empezar rutina', hoja: '¿Cuánto tiempo tienes?', cerrar: 'Cerrar', ajustes: 'Ajustes', apariencia: 'Apariencia', copia: 'Copia de seguridad', tutorial: 'Ver el tutorial', tut1: 'Así funciona JowyFit', siguiente: 'Siguiente', tut2: 'Tu semana de un vistazo' },
  ca: { nombre: 'Català', pestanas: ['Inici', 'Rutina', 'Menjar', 'Progrés', 'Perfil'], hoy: 'Avui et toca', empezar: 'Començar la rutina', hoja: 'Quant de temps tens?', cerrar: 'Tancar', ajustes: 'Configuració', apariencia: 'Aparença', copia: 'Còpia de seguretat', tutorial: 'Veure el tutorial', tut1: 'Així funciona JowyFit', siguiente: 'Següent', tut2: "La teva setmana d'un cop d'ull" },
  en: { nombre: 'English', pestanas: ['Home', 'Routine', 'Food', 'Progress', 'Profile'], hoy: "Today's workout", empezar: 'Start workout', hoja: 'How much time do you have?', cerrar: 'Close', ajustes: 'Settings', apariencia: 'Appearance', copia: 'Backup', tutorial: 'Take the tour', tut1: 'How JowyFit works', siguiente: 'Next', tut2: 'Your week at a glance' },
} as const
/** Castellano que no debe quedar en Inicio con la app en otro idioma. */
const CASTELLANO_INICIO = ['Hoy te toca', 'Empezar rutina', 'Buenos días', 'Buenas tardes', 'Buenas noches', 'Primeros pasos', 'Pendientes de hoy']

/** Espera a que la app esté abierta en ese idioma: <html lang> y las pestañas ya pintadas. */
async function enIdioma(page: Page, jf: Jf, i: Idioma) {
  await expect.poll(() => page.evaluate(() => ({
    lang: document.documentElement.lang,
    tabs: [...document.querySelectorAll('.tabbar button')].map(b => b.textContent!.trim()),
  })).catch(() => null), { timeout: 15000 }).toEqual({ lang: i, tabs: [...IDIOMA[i].pestanas] })
  await jf.listo()
}

/** Abre Ajustes desde Inicio si no está ya a la vista. */
async function abrirAjustes(jf: Jf, i: Idioma) {
  if (await jf.js<boolean>(`return !!document.querySelector('[data-idioma]')`)) return
  await jf.pestana(IDIOMA[i].pestanas[0])
  await jf.pulsarSel(`button[aria-label="${IDIOMA[i].ajustes}"]`)
  await jf.ver(IDIOMA[i].apariencia)
}

/** Ajustes → Idioma → el que se pida: la app se vuelve a abrir en ese idioma. */
async function cambiarIdioma(page: Page, jf: Jf, de: Idioma, a: Idioma) {
  await abrirAjustes(jf, de)
  const recarga = page.waitForEvent('load', { timeout: 15000 })
  await page.locator('[data-idioma] button', { hasText: IDIOMA[a].nombre }).tap()
  await recarga
  await enIdioma(page, jf, a)
}

/** Inicio, una hoja, Ajustes y el tutorial en el idioma `i` (sin castellano de Inicio si no es «es»). */
async function repasar(page: Page, jf: Jf, i: Idioma) {
  const x = IDIOMA[i]
  await jf.pestana(x.pestanas[0])
  await jf.ver(x.hoy)
  await jf.ver(x.empezar)
  if (i !== 'es') for (const s of CASTELLANO_INICIO) await jf.noVer(s)
  await jf.revisar(`inicio (${i})`)
  // Una hoja: la de antes de empezar el entreno.
  await jf.pulsar(x.empezar)
  await jf.ver(x.hoja)
  await page.locator(`.sheet button[aria-label="${x.cerrar}"]`).tap()
  await expect(page.locator('.sheet')).toHaveCount(0)
  // Ajustes, con su idioma marcado.
  await jf.pulsarSel(`button[aria-label="${x.ajustes}"]`)
  await jf.ver(x.apariencia)
  await jf.ver(x.copia)
  await expect(page.locator('[data-idioma] [aria-checked="true"]')).toHaveText(x.nombre)
  await jf.revisar(`ajustes (${i})`)
  // El tutorial: dos pasos y se cierra con Esc.
  await jf.pulsar(x.tutorial)
  await jf.ver(x.tut1)
  await jf.pulsar(x.siguiente, '.tut')
  await jf.ver(x.tut2)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  await expect(page.locator('.tut')).toHaveCount(0)
  await jf.ver(x.apariencia)
}

test.describe('Safari en inglés', () => {
  test.use({ locale: 'en-US' })
  test('la app nueva sale en castellano', async ({ page, jf }) => {
    await jf.deCero('2026-10-13T05:20:00', 'app.html', 'Tu fuerza y tu comida')
    expect(await page.evaluate(() => navigator.language)).toMatch(/^en/)
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('es')
    await jf.alta()
    await enIdioma(page, jf, 'es')
    await jf.ver('Hoy te toca')
  })
})

test('a catalán y a inglés desde Ajustes: todo se repinta y se recuerda al volver a abrirla', async ({ page, jf }) => {
  await jf.deCero('2026-10-13T05:20:00')
  await jf.alta()
  await enIdioma(page, jf, 'es')
  await cambiarIdioma(page, jf, 'es', 'ca')
  await repasar(page, jf, 'ca')
  await page.reload()
  await enIdioma(page, jf, 'ca')
  await jf.ver(IDIOMA.ca.hoy)
  await cambiarIdioma(page, jf, 'ca', 'en')
  await repasar(page, jf, 'en')
  await page.reload()
  await enIdioma(page, jf, 'en')
  // Y de vuelta al castellano, como siempre.
  await cambiarIdioma(page, jf, 'en', 'es')
  await repasar(page, jf, 'es')
})

test('una copia hecha en catalán se recupera con la app en inglés', async ({ page, jf }) => {
  await jf.deCero('2026-10-13T05:20:00')
  await jf.alta()
  await cambiarIdioma(page, jf, 'es', 'ca')
  // Un peso apuntado en catalán (con coma decimal).
  await jf.pestana('Inici')
  await jf.pulsar('+ Pes')
  await jf.ver('Apuntar el pes')
  await jf.pulsarSel('.sheet [aria-label="Pes"] button[aria-label="Més"]')
  await expect(page.locator('.sheet input[aria-label="Pes en kg"]')).toHaveValue('75,5')
  await jf.pulsar('Desar', '.sheet')
  await expect.poll(async () => (await jf.tabla<{ pesoKg?: number }>('mediciones')).some(m => m.pesoKg === 75.5)).toBe(true)
  // La copia, con el menú Compartir.
  await abrirAjustes(jf, 'ca')
  await jf.pulsar('Fer una còpia ara')
  await jf.ver('Còpia feta')
  const c = (await jf.registro()).compartido!
  const archivo = jf.archivo('idioma-' + c.nombre, Buffer.from(c.b64, 'base64'))
  const tablas = ['perfil', 'mediciones', 'rutinas', 'gimnasios', 'sesiones', 'comidas']
  const antes = await Promise.all(tablas.map(tb => jf.tabla(tb)))

  // A inglés; se cambia algo para ver que la copia lo sustituye de verdad.
  await cambiarIdioma(page, jf, 'ca', 'en')
  const [perfil] = await jf.tabla('perfil')
  await jf.meter('perfil', [{ ...perfil, nombre: 'Cambiado' }])
  await abrirAjustes(jf, 'en')
  const fc = page.waitForEvent('filechooser')
  await jf.pulsar('Restore a backup')
  await (await fc).setFiles(archivo)
  await jf.ver(/Restore idioma-jowyfit-[\d-]+\.jowyfit\?/)
  const recarga = page.waitForEvent('load')
  await jf.pulsar(/^Restore$/)
  await recarga
  await enIdioma(page, jf, 'en')
  // Todo como estaba al hacer la copia (las claves de cada fila pueden venir en otro orden).
  const ordenar = (v: unknown) => JSON.stringify(v, (_, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))
  const despues = await Promise.all(tablas.map(tb => jf.tabla(tb)))
  tablas.forEach((tb, k) => expect(ordenar(despues[k]), `tabla ${tb}`).toBe(ordenar(antes[k])))
  // Y se ve en inglés, con punto decimal.
  await jf.pestana('Progress')
  await jf.seg('Body')
  await jf.ver('75.5')
  await jf.noVer('75,5')
  await jf.revisar('progreso → cuerpo (en)')
})
