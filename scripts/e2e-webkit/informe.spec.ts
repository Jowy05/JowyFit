// Informe en PDF en iPhone: se crea en el móvil y se guarda con el menú Compartir (o se descarga si no se puede),
// igual que las copias de seguridad. Si Safari no deja abrir el menú a la primera, queda listo para otro toque.
import { leerPdf } from '../leer-pdf.mjs'
import { DE_ANDROID, expect, test, type Jf } from './ayuda'

async function abrirInforme(jf: Jf) {
  await jf.deCero('2026-10-14T14:00:00')
  await jf.alta()
  await jf.pestana('Comida')
  await jf.pulsar('Añadir', '.dock')
  await jf.pulsar('Batido de proteína', '.sheet')
  await jf.pulsar(/^Normal/, '.popup')
  await jf.ver('Añadido: Batido')
  await jf.pestana('Perfil')
  await jf.pulsarSel('button[aria-label="Ajustes"]')
  await jf.pulsar('Informe en PDF')
  await jf.ver('¿De qué días?')
  await jf.ver('Del 15 sep al 14 oct de 2026')
}

test('crear el PDF y guardarlo con el menú Compartir', async ({ jf }) => {
  await abrirInforme(jf)
  await jf.revisar('Hoja del informe')
  expect(await jf.hay(DE_ANDROID)).toBe(false)
  await jf.pulsar('Crear el PDF', '.sheet')
  await jf.ver('PDF listo. Guárdalo en Archivos o envíalo', 15_000)
  const c = (await jf.registro()).compartido!
  expect(c.nombre).toBe('JowyFit-informe-ultimo-mes-2026-10-14.pdf')
  expect(c.tipo).toBe('application/pdf')
  const pdf = await leerPdf(new Uint8Array(Buffer.from(c.b64, 'base64')))
  expect(pdf.texto).toContain('Informe de progreso')
  expect(pdf.texto).toContain('Último mes · 15 sep – 14 oct 2026')
  expect(pdf.texto).toContain(`Página 1 de ${pdf.paginas}`)
  expect(pdf.texto).toContain('Batido de proteína')
  // Se puede volver a enviar sin hacerlo otra vez.
  await jf.pulsar('Compartir', '.sheet')
  await jf.ver('PDF listo')
})

test('Hoy: la página «Tu día»', async ({ jf }) => {
  await abrirInforme(jf)
  await jf.pulsar('Hoy', '.sheet')
  await jf.ver('Con un solo día, el informe compara lo de ese día con lo que sueles hacer.')
  await jf.pulsar('Crear el PDF', '.sheet')
  await jf.ver('PDF listo', 15_000)
  const c = (await jf.registro()).compartido!
  expect(c.nombre).toBe('JowyFit-informe-hoy-2026-10-14.pdf')
  const pdf = await leerPdf(new Uint8Array(Buffer.from(c.b64, 'base64')))
  expect(pdf.paginas).toBe(1)
  expect(pdf.texto).toContain('Tu día')
  expect(pdf.texto).toContain('Comida de hoy')
})

test.describe('Safari no deja abrir el menú Compartir a la primera', () => {
  test.use({ compartir: 'sin-gesto-una-vez' })
  test('queda listo y se guarda con otro toque', async ({ jf }) => {
    await abrirInforme(jf)
    await jf.pulsar('Crear el PDF', '.sheet')
    await jf.ver('Tu PDF está listo.', 15_000)
    expect((await jf.registro()).compartido).toBeNull()
    await jf.pulsar('Guardar o enviar el PDF', '.sheet')
    await jf.ver('PDF listo. Guárdalo en Archivos o envíalo')
    expect((await jf.registro()).compartido?.nombre).toBe('JowyFit-informe-ultimo-mes-2026-10-14.pdf')
  })
})

test.describe('sin menú Compartir', () => {
  test.use({ compartir: 'ninguno' })
  test('el PDF se descarga (Archivos → Descargas)', async ({ page, jf }) => {
    await abrirInforme(jf)
    const descarga = page.waitForEvent('download')
    await jf.pulsar('Crear el PDF', '.sheet')
    const d = await descarga
    expect(d.suggestedFilename()).toBe('JowyFit-informe-ultimo-mes-2026-10-14.pdf')
    await jf.ver('PDF guardado en Archivos → Descargas')
  })
})
