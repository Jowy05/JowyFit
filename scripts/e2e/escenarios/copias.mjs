// Copias de seguridad: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import * as fsx from 'node:fs'
import path from 'node:path'
import { altaRapida, cdp, compilada, DESCARGAS, entorno, escenario, esperar, js, pestana, pulsar, t, ver } from '../ayudantes.mjs'
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
