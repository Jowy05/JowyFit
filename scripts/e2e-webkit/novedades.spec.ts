// Integración de molestias, gimnasio de la sesión y resumen de Inicio en Safari.
import { test, expect, type Jf } from './ayuda'
import type { Ajustes, Bloque, Gimnasio, Rutina, Sesion } from '../../src/datos/tipos'

test.use({ viewport: { width: 360, height: 740 }, actionTimeout: 15_000 })

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })

const bloque = (uid: string, ejercicio: string): Bloque => ({ uid, ejercicio, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso' })

async function preparar(jf: Jf) {
  await jf.deCero('2026-11-03T05:20:00')
  await jf.alta()
  const r = (await jf.tabla<Rutina>('rutinas'))[0]!
  const rutina: Rutina = { ...r, calibracion: false, dias: [
    { letra: 'A', nombre: 'Cuerpo completo A', dia: 1, opcional: false, bloques: [bloque('a1', 'squat'), bloque('a2', 'bench-press'), bloque('a3', 'seated-cable-row'), bloque('a4', 'barbell-curl')] },
    { letra: 'S', nombre: 'Sesión extra', dia: 5, opcional: true, bloques: [bloque('s1', 'barbell-curl')] },
  ] }
  await jf.meter('rutinas', [rutina])
  await jf.page.reload()
  await jf.abierta()
  return rutina
}

function hecha(r: Rutina, id: number, fecha: string, molestia = false): Sesion {
  const inicio = Date.parse(`${fecha}T06:00:00`)
  return { id, rutinaId: r.id!, gimnasioId: r.gimnasioId, letra: 'A', nombre: 'Cuerpo completo A', fecha, inicio, fin: inicio + 1800000,
    estado: 'hecha', version: 'normal', calibracion: false,
    ejercicios: [{ ...r.dias[0]!.bloques[0]!, planificado: 'squat', estado: 'hecho', molestia,
      series: [{ n: 1, peso: 40, reps: 8, rpe: 8, hecha: true, calentamiento: false }] }],
  }
}

test('molestias repetidas: seguir igual, deshacer y cambiar desde Inicio', async ({ jf, page }) => {
  const r = await preparar(jf)
  await jf.meter('sesiones', [hecha(r, 101, '2026-10-29', true), hecha(r, 102, '2026-10-30', true)])
  await page.reload()
  await jf.ver('te molesta')
  await jf.pulsar('Seguir igual')
  await expect(page.getByRole('button', { name: 'Seguir igual' })).toHaveCount(0)
  await jf.pulsar('Deshacer')
  await jf.ver('te molesta')
  await jf.pulsar(/^(Cambiarlo|Quitarlo)$/)
  await expect.poll(async () => (await jf.tabla<Rutina>('rutinas'))[0]!.dias.flatMap(d => d.bloques).some(b => b.ejercicio === 'squat')).toBe(false)
  await jf.pulsar('Deshacer')
  await expect.poll(async () => (await jf.tabla<Rutina>('rutinas'))[0]!.dias[0]!.bloques[0]!.ejercicio).toBe('squat')
})

test('gimnasio de hoy: adapta el material y «Me duele» se puede deshacer', async ({ jf, page }) => {
  const r = await preparar(jf)
  const [gym] = await jf.tabla<Gimnasio>('gimnasios')
  await jf.meter('gimnasios', [{ ...gym, id: 500, nombre: 'En casa', material: ['dumbbell'] }])
  await page.reload()
  await jf.pulsar('Empezar rutina')
  await jf.ver('¿Dónde entrenas hoy?')
  await jf.pulsar('En casa', '.sheet')
  await jf.ver(/harás otr[oa]s? parecid/)
  await jf.pulsar(/^Empezar$/, '.sheet')
  await expect.poll(async () => (await jf.tabla<Sesion>('sesiones')).some(s => s.estado === 'curso')).toBe(true)
  await expect(page.getByRole('button', { name: 'Hecho', exact: true })).toBeVisible()
  const antes = (await jf.tabla<Sesion>('sesiones')).find(s => s.estado === 'curso')!
  expect(antes.gimnasioId).toBe(500)
  expect((await jf.tabla<Rutina>('rutinas'))[0]!.dias).toEqual(r.dias)
  await jf.pulsarSel('[aria-label="Herramientas"]')
  await jf.pulsar('Me duele', '.sheet')
  await expect.poll(async () => (await jf.tabla('marcas')).some(m => m.id === antes.ejercicios[0]!.ejercicio && m.duele)).toBe(true)
  await jf.pulsar('Deshacer')
  await expect.poll(async () => (await jf.tabla<Sesion>('sesiones')).find(s => s.id === antes.id)).toEqual(antes)
})

for (const version of ['normal', 'corta', 'minima'] as const) {
test(`sábado: la hoja y el entreno usan el día armado en versión ${version}`, async ({ jf, page }) => {
  const r = await preparar(jf)
  await jf.meter('sesiones', [hecha(r, 101, '2026-11-03')])
  await jf.irA('2026-11-07T05:20:00')
  await jf.ver('Lo que te falta esta semana')
  await jf.pulsar(/^Empezar$/)
  const subtitulo = await page.locator('.sheet .sub').first().innerText()
  const cantidad = Number(subtitulo.match(/(\d+) ejercicios/)?.[1])
  expect(cantidad).toBeGreaterThan(1)
  await page.getByRole('radio', { name: new RegExp(version === 'minima' ? 'Mínima' : version === 'corta' ? 'Corta' : 'Normal') }).tap()
  await jf.pulsar(/^Empezar$/, '.sheet')
  await expect.poll(async () => (await jf.tabla<Sesion>('sesiones')).some(s => s.estado === 'curso')).toBe(true)
  await expect(page.getByRole('button', { name: 'Hecho', exact: true })).toBeVisible()
  const s = (await jf.tabla<Sesion>('sesiones')).find(s => s.estado === 'curso')!
  expect(s.version).toBe(version)
  if (version === 'normal') expect(s.ejercicios.length).toBe(cantidad)
  expect(s.ejercicios.length).toBeLessThanOrEqual(cantidad)
  expect(s.ejercicios.map(e => e.ejercicio)).not.toEqual(r.dias[1]!.bloques.map(b => b.ejercicio))
})
}

test('Inicio: resumen de días, meta visible y celebración que no se repite', async ({ jf, page }) => {
  const r = await preparar(jf)
  const [a] = await jf.tabla<Ajustes>('ajustes')
  await jf.meter('ajustes', [{ ...a, celebradas: [] }])
  await jf.meter('sesiones', [hecha(r, 101, '2026-11-03')])
  await jf.meter('metas', [{ id: 500, tipo: 'ejercicio', titulo: 'Sentadilla: 60 kg', ejercicio: 'squat', objetivo: 60, unidad: 'kg', inicio: 0, hecha: false }])
  await page.reload()
  await jf.ver('¡Primer entreno hecho!')
  await expect(page.locator('.celeb')).toContainText('Lo más difícil')
  await page.locator('.celeb').getByRole('button', { name: 'Cerrar' }).tap()
  await jf.ver('Tu meta')
  await expect(page.getByRole('button', { name: /Sentadilla: 60 kg/ })).toContainText(/40\s*\/ 60 kg/)
  await page.locator('.week button').nth(1).tap()
  await jf.ver('Comida y pasos')
  await expect(page.locator('.sheet')).toContainText('Cuerpo completo A')
  await jf.cerrarHoja()
  await page.locator('.week button').nth(6).tap()
  await jf.ver('La comida y los pasos de este día se verán cuando llegue.')
  await jf.cerrarHoja()
  await page.reload()
  await jf.abierta()
  await expect(page.locator('.celeb')).toHaveCount(0)
})


test('editar plan: descanso y esfuerzo se guardan, y el catálogo muestra barras y accesorios', async ({ jf, page }) => {
  await preparar(jf)
  await jf.pestana('Rutina')
  await jf.pulsar('Editar plan')
  const tarjeta = page.locator('.edr.card').first()
  await tarjeta.getByRole('button', { name: 'Más opciones' }).tap()
  await tarjeta.getByRole('group', { name: 'Descanso entre series' }).getByRole('button', { name: 'Más', exact: true }).tap()
  await tarjeta.getByRole('group', { name: 'Esfuerzo', exact: true }).getByRole('button', { name: 'Menos' }).tap()
  await expect.poll(async () => (await jf.tabla<Rutina>('rutinas'))[0]!.dias[0]!.bloques[0]!.descanso).toBe(105)
  await expect.poll(async () => (await jf.tabla<Rutina>('rutinas'))[0]!.dias[0]!.bloques[0]!.rpe).toBe(7)
  await jf.volver()
  await jf.seg('Gimnasios')
  await jf.pulsar('Añadir otro gimnasio')
  await jf.ver('Editor de gimnasio')
  await jf.escribir('input[aria-label="Nombre del gimnasio"]', 'Material de prueba')
  const buscar = page.getByRole('searchbox', { name: 'Buscar en el catálogo' })
  await buscar.fill('Barra')
  await jf.ver('Barras')
  await jf.ver('Barra olímpica (la larga)')
  await jf.ver('Barra Z (EZ)')
  await buscar.fill('Tobilleras')
  await jf.ver('Tobilleras')
  const grupo = page.locator('.grp-h').filter({ hasText: 'Poleas' })
  await grupo.getByRole('button', { name: 'Quitar todo' }).tap()
  await expect(grupo.getByRole('button', { name: 'Marcar todo' })).toBeVisible()
  await grupo.getByRole('button', { name: 'Marcar todo' }).tap()
  await expect(grupo.getByRole('button', { name: 'Quitar todo' })).toBeVisible()
  await grupo.getByRole('button', { name: 'Quitar todo' }).tap()
  await expect(grupo.getByRole('button', { name: 'Marcar todo' })).toBeVisible()
})
