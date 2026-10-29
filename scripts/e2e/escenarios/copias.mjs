// Copias de seguridad: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import * as fsx from 'node:fs'
import path from 'node:path'
import { altaRapida, cdp, compilada, comprobar, DESCARGAS, descargado, entorno, escenario, esperar, js, pestana, pulsar, soltarFoco, t, ver } from '../ayudantes.mjs'
import { trasCarga } from '../navegador.mjs'

if (!compilada) escenario('copia de seguridad: exportar e importar', async () => {
  await altaRapida('2026-10-13T14:10:00')
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  // Exporta con la función real de la app, borra todo e importa. Si copias.ts o db.ts se mueven, el import falla y el escenario también.
  const r = await js(`
    const m = await import('/src/datos/copias.ts')
    const bytes = await m.exportar()
    const { db } = await import('/src/datos/db.ts')
    const antes = await db.comidas.count()
    await Promise.all(db.tables.map(t => t.clear()))
    await m.importar(bytes)
    return antes + '/' + (await db.comidas.count()) + '/' + (await db.perfil.count())
  `)
  if (r !== '1/1/1') throw new Error(`Copia: ${r}`)
})

escenario('copia desde la interfaz: descargar, borrar todo e importar', async () => {
  await altaRapida('2026-10-14T14:00:00')
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Hacer copia ahora')
  let archivo = null
  for (let i = 0; i < 40 && !archivo; i++) { await esperar(250); archivo = fsx.readdirSync(DESCARGAS).find(f => f.endsWith('.jowyfit')) }
  if (!archivo) throw new Error('No se descargó la copia')
  await pulsar('Borrar todos los datos')
  // Se confirma dos veces: la primera solo cambia el botón a «Sí, borrarlo todo».
  await pulsar(/^Borrar todo/, '.sheet')
  await ver('Sí, borrarlo todo')
  // La app se recarga sola: el toque puede no volver (eso, y solo eso, no es un fallo).
  await trasCarga(cdp, () => pulsar('Sí, borrarlo todo', '.sheet').catch(e => { if (!/navigated|destroyed/i.test(e.message)) throw e }), '«Borrar todo»')
  await ver('Tu fuerza y tu comida', 10000)
  entorno.archivoParaElegir = path.join(DESCARGAS, archivo)
  await pulsar(/Tengo una copia/)
  await esperar(1500)
  if (await t('hay', /¿Restaurar/)) await pulsar(/^Restaurar/)
  await ver(/Buenos|Buenas|Hoy te toca|descansas/, 15000)
  await pestana('Comida')
  await ver('Batido de proteína')
  entorno.archivoParaElegir = null
})

/** Cuántas claves de copias hay guardadas (su base aparte, la que no entra en la copia). */
const clavesGuardadas = () => js(`return await new Promise(ok => { const q = indexedDB.open('jowyfit-claves'); q.onerror = () => ok(0); q.onsuccess = () => { const b = q.result; if (!b.objectStoreNames.contains('claves')) { b.close(); ok(0); return } const c = b.transaction('claves').objectStore('claves').count(); c.onsuccess = () => { b.close(); ok(c.result) } } })`)

escenario('copia con contraseña: ponerla, descargar, borrar todo y recuperarla en la bienvenida', async () => {
  await altaRapida('2026-10-14T14:00:00')
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await t('pulsarSel', 'button[aria-label="Proteger con contraseña"]')
  await ver('Si la olvidas, nadie puede abrir esas copias')
  const campo = n => `.sheet input[name="${n === 1 ? 'contrasena' : 'repetida'}"]`
  await t('escribir', campo(1), 'corta')
  await t('escribir', campo(2), 'cor')
  await soltarFoco()
  await ver('Mínimo 8: llevas 5')
  await t('escribir', campo(1), 'mesa azul 7')
  await t('escribir', campo(2), 'mesa azul 8')
  await soltarFoco()
  await ver('No coinciden')
  await t('escribir', campo(2), 'mesa azul 7')
  await pulsar(/^Poner contraseña$/, '.sheet')
  await ver('Contraseña puesta')
  await ver('Cambiar o quitar la contraseña')
  const antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Hacer copia ahora')
  const copia = await descargado(f => f.endsWith('-cifrada.jowyfit'), antes)
  comprobar(copia, 'No se descargó la copia con contraseña')
  const bytes = Buffer.from(copia.bytes)
  comprobar(bytes.subarray(0, 17).toString() === 'JOWYFIT-CIFRADA-1', 'La copia no va cifrada')
  comprobar(!bytes.includes(Buffer.from('Batido')), 'Se lee la comida dentro de la copia cifrada')
  await pulsar('Borrar todos los datos')
  await pulsar(/^Borrar todo/, '.sheet')
  await ver('Sí, borrarlo todo')
  await trasCarga(cdp, () => pulsar('Sí, borrarlo todo', '.sheet').catch(e => { if (!/navigated|destroyed/i.test(e.message)) throw e }), '«Borrar todo»')
  await ver('Tu fuerza y tu comida', 10000)
  // «Borrar todo» quita también la contraseña.
  comprobar(await clavesGuardadas() === 0, 'La contraseña sigue tras borrar todo')
  entorno.archivoParaElegir = path.join(DESCARGAS, copia.nombre)
  await pulsar(/Tengo una copia/)
  await ver('Esta copia tiene contraseña')
  await pulsar(/^Abrir$/, '.sheet')
  await ver('Escribe la contraseña de esta copia')
  await t('escribir', '.sheet input', 'mesa azul 8')
  await pulsar(/^Abrir$/, '.sheet')
  await ver('No es esta contraseña', 8000)
  await t('escribir', '.sheet input', 'mesa azul 7')
  await pulsar(/^Abrir$/, '.sheet')
  await ver(/¿Restaurar|Buenos|Buenas|Hoy te toca|descansas/, 15000)
  if (await t('hay', /¿Restaurar/)) await pulsar(/^Restaurar/)
  await ver(/Buenos|Buenas|Hoy te toca|descansas/, 15000)
  entorno.archivoParaElegir = null
  await pestana('Comida')
  await ver('Batido de proteína')
  // La contraseña se queda puesta para las copias siguientes.
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await ver('Puesta · todas tus copias nuevas la llevan')
  // Desde Ajustes, la misma copia: contraseña y luego «¿Recuperar…?» antes de cambiar nada.
  entorno.archivoParaElegir = path.join(DESCARGAS, copia.nombre)
  await pulsar('Recuperar una copia')
  await ver('Esta copia tiene contraseña')
  await t('escribir', '.sheet input', 'mesa azul 7')
  await pulsar(/^Abrir$/, '.sheet')
  await ver('Contraseña correcta.', 8000)
  await trasCarga(cdp, () => pulsar(/^Recuperar$/, '.sheet').catch(e => { if (!/navigated|destroyed/i.test(e.message)) throw e }), '«Recuperar»')
  entorno.archivoParaElegir = null
  await ver(/Buenos|Buenas|Hoy te toca|descansas/, 15000)
  // Quitar la contraseña: dos toques, y las copias nuevas vuelven a ir sin ella.
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Cambiar o quitar la contraseña')
  await pulsar(/^Quitar la contraseña$/, '.sheet')
  await pulsar(/^¿Seguro\? Quitar la contraseña$/, '.sheet')
  await ver('Contraseña quitada')
  await ver('Cualquiera que tenga el archivo puede abrirla')
  comprobar(await clavesGuardadas() === 0, 'La contraseña sigue tras quitarla')
})
