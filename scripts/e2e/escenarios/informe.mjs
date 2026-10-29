// El informe en PDF: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import * as fsx from 'node:fs'
import path from 'node:path'
import { ajustesBD, altaRapida, comprobar, deCero, descargado, DESCARGAS, entorno, escenario, esperar, js, pestana, pulsar, RAIZ, revisarAqui, t, ver } from '../ayudantes.mjs'

escenario('informe en PDF desde Ajustes: elegir días y casillas, crear y descargar', async () => {
  await altaRapida('2026-10-14T14:00:00')
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Informe en PDF')
  await ver('¿De qué días?')
  // Por defecto: Último mes, con las cuatro primeras casillas marcadas y la de «una a una» sin marcar.
  comprobar(await js(`return document.querySelector('.sheet [role=radio][aria-checked=true]')?.innerText`) === 'Último mes', 'El periodo por defecto no es «Último mes»')
  const marcadas = () => js(`return [...document.querySelectorAll('.sheet [role=checkbox]')].map(b => b.getAttribute('aria-checked') === 'true')`)
  comprobar(JSON.stringify(await marcadas()) === '[true,true,true,true,false]', 'Las casillas por defecto no son las del diseño')
  await ver('Del 15 sep al 14 oct de 2026')
  await ver('El PDF se hace en tu móvil. No se envía a ningún sitio.')
  await revisarAqui('Hoja del informe')
  // Con Hoy sale la nota de «Tu día»; con Ayer (sin nada apuntado) el botón se queda gris.
  await pulsar('Hoy', '.sheet')
  await ver('Con un solo día, el informe compara lo de ese día con lo que sueles hacer.')
  await pulsar('Ayer', '.sheet')
  await ver('No hay nada apuntado de esos días. Prueba con otro periodo.')
  comprobar(await js(`return [...document.querySelectorAll('.sheet button')].find(b => /Crear el PDF/.test(b.innerText))?.disabled`) === true, 'Sin datos, «Crear el PDF» no se queda gris')
  // Último mes sin pasos: se crea y se descarga.
  await pulsar('Último mes', '.sheet')
  await pulsar('Pasos y gasto', '.sheet')
  comprobar(JSON.stringify(await marcadas()) === '[true,true,true,false,false]', 'La casilla de pasos no se desmarca')
  const antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Crear el PDF', '.sheet')
  const pdf = await descargado(f => f.endsWith('.pdf'), antes)
  if (!pdf) throw new Error('No se descargó el PDF')
  comprobar(pdf.nombre === 'JowyFit-informe-ultimo-mes-2026-10-14.pdf', `Nombre del PDF: ${pdf.nombre}`)
  const { leerPdf } = await import('../../leer-pdf.mjs')
  comprobar(new TextDecoder().decode(pdf.bytes.slice(0, 5)) === '%PDF-', 'No es un PDF')
  const leido = await leerPdf(pdf.bytes)
  // Resumen, comida y, con la casilla de entrenos, «Tu rutina y tu salud» (aunque aún no haya entrenos).
  comprobar(leido.paginas >= 3, `El PDF tiene ${leido.paginas} páginas (resumen, comida y tu rutina y tu salud)`)
  for (const t of ['Informe de progreso', 'Último mes · 15 sep – 14 oct 2026', 'Resumen del periodo', 'Comida', 'Batido de proteína', 'Perfil y objetivo', 'La rutina que toca', `Página 1 de ${leido.paginas}`]) comprobar(leido.texto.includes(t), `Falta «${t}» en el PDF`)
  comprobar(!leido.texto.includes('Pasos y gasto'), 'Lleva los pasos aunque la casilla está desmarcada')
  await ver('PDF descargado')
  await ver('Descargado.')
  // Recuerda lo elegido la próxima vez.
  const a = await ajustesBD()
  comprobar(a.informe?.periodo === 'mes' && a.informe?.secciones?.pasos === false, 'No se recuerda lo elegido en el informe')
  await pulsar('Cerrar', '.sheet')
  await pulsar('Informe en PDF')
  await ver('¿De qué días?')
  await esperar(300)
  comprobar(JSON.stringify(await marcadas()) === '[true,true,true,false,false]', 'Al volver a abrir, no salen las casillas elegidas')
  await revisarAqui('Hoja del informe al volver')
})

escenario('informe en PDF con la copia real del dueño', async () => {
  const copia = path.join(RAIZ, '.cache', 'JowyFit-mis-datos.jowyfit')
  if (!fsx.existsSync(copia)) { console.log('    (sin .cache/JowyFit-mis-datos.jowyfit: se salta)'); return }
  await deCero('2026-10-20T21:30:00')
  entorno.archivoParaElegir = copia
  await pulsar(/Tengo una copia/)
  await esperar(1500)
  if (await t('hay', /¿Restaurar/)) await pulsar(/^Restaurar/)
  await ver(/Buenos|Buenas|Hoy te toca|descansas/, 15000)
  entorno.archivoParaElegir = null
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Informe en PDF')
  await ver('¿De qué días?')
  await pulsar('Todo', '.sheet')
  await ver('Desde el 13 oct de 2026, tu primer dato')
  const antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Crear el PDF', '.sheet')
  const pdf = await descargado(f => f.endsWith('.pdf'), antes)
  if (!pdf) throw new Error('No se descargó el PDF')
  const { leerPdf } = await import('../../leer-pdf.mjs')
  const leido = await leerPdf(pdf.bytes)
  comprobar(leido.paginas >= 2, `El PDF tiene ${leido.paginas} páginas`)
  for (const t of ['Informe de progreso', 'Todo · 13 oct – 20 oct 2026', 'Cómo está tu cuerpo', 'Control de peso', 'Metas', 'Cuerpo', 'Página 1 de']) comprobar(leido.texto.includes(t), `Falta «${t}» en el PDF`)
  comprobar(!/NaN|Infinity|undefined/.test(leido.texto), 'Texto roto en el PDF')
})
