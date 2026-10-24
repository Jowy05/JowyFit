// Idiomas: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import * as fsx from 'node:fs'
import path from 'node:path'
import { altaRapida, cdp, comprobar, deCero, descargado, DESCARGAS, entorno, escenario, esperar, js, meter, noVer, pestana, pulsar, revisarAqui, seg, t, tabla, ver, volcar } from '../ayudantes.mjs'
import { trasCarga } from '../navegador.mjs'

// Lo que se comprueba en cada idioma: el nombre de las pestañas y unos textos de Inicio, de una hoja, del tutorial
// y de Ajustes (los mismos que en castellano, con su traducción de src/i18n).
const IDIOMA = {
  es: { nombre: 'Español', pestanas: ['Inicio', 'Rutina', 'Comida', 'Progreso', 'Perfil'], hoy: 'Hoy te toca', empezar: 'Empezar rutina', hoja: '¿Cuánto tiempo tienes?', cerrar: 'Cerrar', ajustes: 'Ajustes', apariencia: 'Apariencia', copia: 'Copia de seguridad', tutorial: 'Ver el tutorial', tut1: 'Así funciona JowyFit', siguiente: 'Siguiente', tut2: 'Tu semana de un vistazo' },
  ca: { nombre: 'Català', pestanas: ['Inici', 'Rutina', 'Menjar', 'Progrés', 'Perfil'], hoy: 'Avui et toca', empezar: 'Començar la rutina', hoja: 'Quant de temps tens?', cerrar: 'Tancar', ajustes: 'Configuració', apariencia: 'Aparença', copia: 'Còpia de seguretat', tutorial: 'Veure el tutorial', tut1: 'Així funciona JowyFit', siguiente: 'Següent', tut2: "La teva setmana d'un cop d'ull" },
  en: { nombre: 'English', pestanas: ['Home', 'Routine', 'Food', 'Progress', 'Profile'], hoy: "Today's workout", empezar: 'Start workout', hoja: 'How much time do you have?', cerrar: 'Close', ajustes: 'Settings', apariencia: 'Appearance', copia: 'Backup', tutorial: 'Take the tour', tut1: 'How JowyFit works', siguiente: 'Next', tut2: 'Your week at a glance' },
}

/** JSON con las claves de cada objeto en orden (la base puede devolver los campos en otro orden tras recuperar). */
const canonico = v => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))

/** Castellano que no debe quedar en Inicio cuando la app está en otro idioma. */
const CASTELLANO_INICIO = ['Hoy te toca', 'Empezar rutina', 'Buenos días', 'Buenas tardes', 'Buenas noches', 'Primeros pasos']

/** Nombres de las pestañas tal como se ven. */
const pestanasVistas = () => js(`return [...document.querySelectorAll('.tabbar button')].map(b => b.textContent.trim())`)

/** Espera a que la app (re)abierta esté en ese idioma: <html lang> y las pestañas ya pintadas. */
async function esperarIdioma(i, ms = 15000) {
  const fin = Date.now() + ms
  let ultimo = null
  while (Date.now() < fin) {
    // Mientras se recarga, la página puede no responder: se reintenta.
    ultimo = await js(`return { lang: document.documentElement.lang, tabs: [...document.querySelectorAll('.tabbar button')].map(b => b.textContent.trim()) }`).catch(() => null)
    if (ultimo?.lang === i && JSON.stringify(ultimo.tabs) === JSON.stringify(IDIOMA[i].pestanas)) { await t('listo'); return }
    await esperar(200)
  }
  throw new Error(`La app no queda en «${i}»: ${JSON.stringify(ultimo)}`)
}

/** Abre Ajustes (desde Inicio) si no está ya a la vista. */
async function abrirAjustes(i) {
  if (await js(`return !!document.querySelector('[data-idioma]')`)) return
  await pestana(IDIOMA[i].pestanas[0])
  await t('pulsarSel', `button[aria-label="${IDIOMA[i].ajustes}"]`)
  await ver(IDIOMA[i].apariencia)
}

/** Ajustes → Idioma → el que se pida (la app se vuelve a abrir en ese idioma). */
async function cambiarIdioma(de, a) {
  await abrirAjustes(de)
  // La app se recarga al tocarlo: el toque va en diferido para que la llamada vuelva antes de recargar.
  let hay = false
  await trasCarga(cdp, async () => {
    hay = await js(`const b = [...document.querySelectorAll('[data-idioma] button')].find(b => b.textContent.trim() === ${JSON.stringify(IDIOMA[a].nombre)}); if (b) setTimeout(() => b.click(), 50); return !!b`)
    comprobar(hay, `No está «${IDIOMA[a].nombre}» en Ajustes → Idioma`)
  })
  await esperarIdioma(a)
}

/** Inicio, una hoja, el tutorial y Ajustes, en el idioma `i` (y sin el castellano de Inicio si no es «es»). */
async function repasarIdioma(i) {
  const x = IDIOMA[i]
  comprobar(JSON.stringify(await pestanasVistas()) === JSON.stringify(x.pestanas), `Pestañas en ${i}: ${await pestanasVistas()}`)
  await pestana(x.pestanas[0])
  await ver(x.hoy)
  await ver(x.empezar)
  if (i !== 'es') for (const s of CASTELLANO_INICIO) await noVer(s)
  await revisarAqui(`inicio (${i})`)
  // Una hoja: «Empezar rutina» abre la de antes de empezar.
  await pulsar(x.empezar)
  await ver(x.hoja)
  if (i !== 'es') await noVer('¿Cuánto tiempo tienes?')
  await t('pulsarSel', `.sheet button[aria-label="${x.cerrar}"]`)
  await esperar(300)
  comprobar(!(await js(`return !!document.querySelector('.sheet')`)), `La hoja no se cierra con «${x.cerrar}»`)
  // Ajustes y el tutorial (dos pasos y Esc).
  await t('pulsarSel', `button[aria-label="${x.ajustes}"]`)
  await ver(x.apariencia)
  await ver(x.copia)
  comprobar(await js(`return document.querySelector('[data-idioma] [aria-checked="true"]')?.textContent`) === x.nombre, `En Ajustes no sale marcado «${x.nombre}»`)
  await revisarAqui(`ajustes (${i})`)
  await pulsar(x.tutorial)
  await ver(x.tut1)
  await pulsar(x.siguiente, '.tut')
  await ver(x.tut2)
  if (i !== 'es') await noVer('Tu semana de un vistazo')
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await esperar(400)
  comprobar(!(await js(`return !!document.querySelector('.tut')`)), `Esc no cierra el tutorial (${i})`)
  await ver(x.apariencia)
}

escenario('idioma: catalán e inglés desde Ajustes, se recuerda al recargar, castellano por defecto y copia entre idiomas', async () => {
  // 1. La app nueva sale en castellano aunque el navegador esté en inglés.
  const original = await js(`return { ua: navigator.userAgent, idiomas: navigator.languages.join(',') }`)
  try {
    await cdp.enviar('Emulation.setLocaleOverride', { locale: 'en-US' })
    await cdp.enviar('Emulation.setUserAgentOverride', { userAgent: original.ua, acceptLanguage: 'en-US,en' })
    await deCero('2026-10-13T05:20:00')
    comprobar(await js(`return navigator.language`) === 'en-US', 'El navegador no queda en inglés')
    await ver('Tu fuerza y tu comida')
    comprobar(await js(`return document.documentElement.lang`) === 'es', '<html lang> no es «es» en una app nueva')
  } finally {
    await cdp.enviar('Emulation.setLocaleOverride', { locale: 'es-ES' })
    await cdp.enviar('Emulation.setUserAgentOverride', { userAgent: original.ua, acceptLanguage: original.idiomas })
  }

  // 2. En castellano todo como siempre; a catalán desde Ajustes: se repinta todo.
  await altaRapida('2026-10-13T05:20:00')
  await esperarIdioma('es')
  await repasarIdioma('es')
  await cambiarIdioma('es', 'ca')
  await repasarIdioma('ca')
  // Se recuerda al recargar.
  await trasCarga(cdp, () => cdp.enviar('Page.reload', { ignoreCache: true }))
  await esperarIdioma('ca')
  await ver(IDIOMA.ca.hoy)
  // Los ejercicios, también en catalán (si la compilación tiene su traducción: va cifrada, con clave).
  if (await js(`return await fetch('repdb/catalogo.ca.json').then(r => r.ok && /json/.test(r.headers.get('content-type') ?? '')).catch(() => false)`)) {
    await ver(/Esquat/)
    await noVer(/Sentadilla/)
  }

  // 3. Algo apuntado en catalán (un peso, con coma) y una copia.
  await pestana('Inici')
  await pulsar('+ Pes')
  await ver('Apuntar el pes')
  await t('pulsarSel', '.sheet [aria-label="Pes"] button[aria-label="Més"]')
  comprobar(await js(`return document.querySelector('.sheet input[aria-label="Pes en kg"]')?.value`) === '75,5', 'El peso en catalán no lleva coma')
  // El aviso dura unos segundos: se apunta en cuanto sale (con el equipo lento podría irse antes de mirarlo).
  await js(`window.__avisos = new Set(); new MutationObserver(() => { for (const a of document.body.innerText.match(/Desat: [^\\n]*/g) ?? []) window.__avisos.add(a) }).observe(document.body, { childList: true, subtree: true, characterData: true })`)
  await pulsar('Desar', '.sheet')
  for (let i = 0; i < 40 && !(await js(`return [...window.__avisos].some(a => a.startsWith('Desat: 75,5 kg'))`)); i++) await esperar(150)
  comprobar(await js(`return [...window.__avisos].some(a => a.startsWith('Desat: 75,5 kg'))`), 'No sale el aviso «Desat: 75,5 kg»: ' + JSON.stringify(await js(`return [...window.__avisos]`)))
  await abrirAjustes('ca')
  const yaHabia = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Fer una còpia ara')
  const archivo = (await descargado(f => f.endsWith('.jowyfit'), yaHabia))?.nombre
  if (!archivo) throw new Error('No se descargó la copia hecha en catalán')
  const antes = await volcar()
  comprobar(antes.mediciones.some(m => m.pesoKg === 75.5), 'El peso apuntado en catalán no está en la base')

  // 4. A inglés: se repinta todo y la copia de catalán se recupera sin problemas.
  await cambiarIdioma('ca', 'en')
  await repasarIdioma('en')
  // Se cambia algo para ver que la copia lo sustituye de verdad.
  const [perfil] = await tabla('perfil')
  await meter('perfil', [{ ...perfil, nombre: 'Cambiado' }])
  await meter('mediciones', [{ id: 999, fecha: '2026-10-13T05:00', origen: 'casa', pesoKg: 90 }])
  entorno.archivoParaElegir = path.join(DESCARGAS, archivo)
  await abrirAjustes('en')
  await pulsar('Restore a backup')
  await ver(/Restore jowyfit-[\d-]+\.jowyfit\?/)
  // Al restaurar, la app avisa y se recarga sola enseguida: el aviso lo apunta la propia página (sessionStorage
  // sobrevive a la recarga) para no tener que verlo a tiempo desde fuera.
  await trasCarga(cdp, () => js(`
    sessionStorage.removeItem('__e2e_aviso')
    new MutationObserver((_, o) => { if (document.body.innerText.includes('Backup restored')) { sessionStorage.setItem('__e2e_aviso', '1'); o.disconnect() } })
      .observe(document.body, { childList: true, subtree: true, characterData: true })
    // Sin esperar a que vuelva: el toque es inmediato y la recarga llega después.
    void __t.pulsar(/^Restore$/)`), 'restaurar la copia')
  comprobar(await js(`return sessionStorage.getItem('__e2e_aviso')`) === '1', 'No salió «Backup restored» antes de recargar')
  entorno.archivoParaElegir = null
  await esperarIdioma('en')
  const despues = await volcar()
  for (const tb of Object.keys(antes)) {
    // «ajustes» guarda cuándo se hizo la última copia: la copia es de justo antes, sin esa fecha.
    if (tb === 'ajustes') continue
    comprobar(canonico(despues[tb]) === canonico(antes[tb]), `La copia de catalán no deja igual «${tb}» al recuperarla en inglés`)
  }
  comprobar(despues.perfil[0]?.nombre !== 'Cambiado', 'La copia no sustituye los datos')
  // Lo de la copia se ve en inglés (con punto decimal) y la app sigue en inglés.
  await pestana('Progress')
  await seg('Body')
  await ver('75.5')
  await noVer('75,5')
  await revisarAqui('progreso → cuerpo (en)')

  // 5. Y de vuelta al castellano, como siempre.
  await cambiarIdioma('en', 'es')
  await repasarIdioma('es')
  await trasCarga(cdp, () => cdp.enviar('Page.reload', { ignoreCache: true }))
  await esperarIdioma('es')
  await ver('Hoy te toca')
})
