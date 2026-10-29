// Copias de seguridad en iPhone: guardar con el menú Compartir (o descarga si no se puede) y recuperar con el
// selector de archivos, también desde la bienvenida («Tengo una copia») tras borrarlo todo.
import { expect, test, type Jf } from './ayuda'

async function conAlgo(jf: Jf) {
  await jf.deCero('2026-10-14T14:00:00')
  await jf.alta()
  await jf.pestana('Comida')
  await jf.pulsar('Añadir', '.dock')
  await jf.pulsar('Batido de proteína', '.sheet')
  await jf.pulsar(/^Normal/, '.popup')
  await jf.ver('Añadido: Batido')
  await jf.pestana('Perfil')
  await jf.pulsarSel('button[aria-label="Ajustes"]')
  await jf.ver('Copia de seguridad')
}

test('guardar con el menú Compartir, borrar todo y recuperarla', async ({ page, jf }) => {
  await conAlgo(jf)
  await jf.ver('Guárdala en Archivos o envíatela')
  await jf.pulsar('Hacer copia ahora')
  await jf.ver('Copia hecha')
  const c = (await jf.registro()).compartido!
  expect(c.nombre).toMatch(/^jowyfit-\d{4}-\d{2}-\d{2}.*\.jowyfit$/i)
  expect((await jf.tabla<{ ultimaCopia?: string }>('ajustes'))[0]!.ultimaCopia).toBeTruthy()
  const archivo = jf.archivo(c.nombre, Buffer.from(c.b64, 'base64'))

  // Borrar todo (dos confirmaciones) y recuperar desde la bienvenida.
  await jf.pulsar('Borrar todos los datos')
  await jf.pulsar(/^Borrar todo/, '.sheet')
  await jf.ver('Sí, borrarlo todo')
  // Al borrarlo todo la app se recarga sola (empieza de cero, sin nada en memoria).
  const recargaBorrar = page.waitForEvent('load', { timeout: 15000 })
  await jf.pulsar('Sí, borrarlo todo', '.sheet').catch(() => {})
  await recargaBorrar
  await jf.ver('Tu fuerza y tu comida', 15000)
  const fc = page.waitForEvent('filechooser')
  await jf.pulsar(/Tengo una copia/)
  const elegir = await fc
  // En iPhone se deja elegir cualquier archivo: Archivos no sabe qué es «.jowyfit» y lo pondría en gris.
  expect(await elegir.element().getAttribute('accept')).toBe('')
  await elegir.setFiles(archivo)
  await jf.ver(/Buenas|Hoy te toca|descansas/, 15000)
  await jf.pestana('Comida')
  await jf.ver('Batido de proteína')
})

test('recuperar desde Ajustes', async ({ page, jf }) => {
  await conAlgo(jf)
  await jf.pulsar('Hacer copia ahora')
  await jf.ver('Copia hecha')
  const c = (await jf.registro()).compartido!
  const archivo = jf.archivo('recuperar-' + c.nombre, Buffer.from(c.b64, 'base64'))
  const fc = page.waitForEvent('filechooser')
  await jf.pulsar('Recuperar una copia')
  await (await fc).setFiles(archivo)
  await jf.ver('¿Recuperar')
  // Al recuperarla, la app se vuelve a abrir sola con los datos de la copia.
  const recarga = page.waitForEvent('load')
  await jf.pulsar(/^Recuperar$/)
  await recarga
  await jf.ver(/Buenas|Hoy te toca|descansas/, 15000)
})

test('con contraseña: la copia sale cifrada y se recupera desde Ajustes con la contraseña', async ({ page, jf }) => {
  await conAlgo(jf)
  await jf.pulsarSel('button[aria-label="Proteger con contraseña"]')
  await jf.escribir('.sheet input[name="contrasena"]', 'mesa azul 7')
  await jf.escribir('.sheet input[name="repetida"]', 'mesa azul 7')
  await jf.pulsar(/^Poner contraseña$/, '.sheet')
  await jf.ver('Contraseña puesta')
  await jf.pulsar('Hacer copia ahora')
  await jf.ver('Copia hecha')
  const c = (await jf.registro()).compartido!
  expect(c.nombre).toMatch(/-cifrada\.jowyfit$/)
  const bytes = Buffer.from(c.b64, 'base64')
  expect(bytes.subarray(0, 17).toString()).toBe('JOWYFIT-CIFRADA-1')
  const fc = page.waitForEvent('filechooser')
  await jf.pulsar('Recuperar una copia')
  await (await fc).setFiles(jf.archivo('recuperar-' + c.nombre, bytes))
  await jf.ver('Esta copia tiene contraseña')
  await jf.escribir('.sheet input', 'mesa azul 8')
  await jf.pulsar(/^Abrir$/, '.sheet')
  await jf.ver('No es esta contraseña', 10000)
  await jf.escribir('.sheet input', 'mesa azul 7')
  await jf.pulsar(/^Abrir$/, '.sheet')
  await jf.ver('Contraseña correcta.', 10000)
  const recarga = page.waitForEvent('load')
  await jf.pulsar(/^Recuperar$/, '.sheet')
  await recarga
  await jf.ver(/Buenas|Hoy te toca|descansas/, 15000)
})

test.describe('Safari no deja abrir el menú Compartir a la primera', () => {
  test.use({ compartir: 'sin-gesto-una-vez' })
  test('queda lista y se guarda con otro toque', async ({ jf }) => {
    await conAlgo(jf)
    await jf.pulsar('Hacer copia ahora')
    await jf.ver('Guardar la copia')
    await jf.ver('Está lista: toca para elegir dónde guardarla')
    expect((await jf.tabla<{ ultimaCopia?: string }>('ajustes'))[0]!.ultimaCopia).toBeFalsy()
    await jf.pulsar('Guardar la copia')
    await jf.ver('Copia hecha')
    expect((await jf.registro()).compartido).toBeTruthy()
    await jf.ver('Hacer copia ahora')
  })
})

test.describe('sin menú Compartir', () => {
  test.use({ compartir: 'ninguno' })
  test('la copia se descarga (Archivos → Descargas)', async ({ page, jf }) => {
    await conAlgo(jf)
    const descarga = page.waitForEvent('download')
    await jf.pulsar('Hacer copia ahora')
    const d = await descarga
    expect(d.suggestedFilename()).toMatch(/\.jowyfit$/)
    await jf.ver('Copia guardada en Archivos → Descargas')
  })
})
