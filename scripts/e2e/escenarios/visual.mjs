// Repaso visual, rendimiento y sin conexión: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import { altaRapida, cdp, cerrarHoja, compilada, comprobar, escenario, esperar, js, meterSesionHecha, movil, pestana, pulsar, revisarAqui, seg, t, tema, ver } from '../ayudantes.mjs'

for (const [ancho, alto] of [[360, 740], [390, 844], [412, 915]]) escenario(`repaso visual de todas las pestañas a ${ancho} px`, async () => {
  await altaRapida('2026-10-15T18:00:00')
  {
    await movil(ancho, alto)
    for (const tm of ['light', 'dark']) {
      await tema(tm)
      for (const p of ['Inicio', 'Rutina', 'Comida', 'Progreso', 'Perfil']) {
        await pestana(p)
        const segs = await js(`return [...document.querySelectorAll('.screen .seg button')].map(b=>b.textContent.trim())`)
        for (const s of segs.length ? segs : [null]) {
          if (s) { await pulsar(s, '.seg'); await t('listo') }
          const fallo = await t('revisar')
          if (fallo) throw new Error(`${ancho}px ${tm} ${p}${s ? '/' + s : ''}: ${fallo}`)
        }
      }
    }
  }
  await movil(390, 844)
  await tema('light')
})

escenario('rendimiento de carga', async () => {
  await altaRapida('2026-10-13T05:20:00')
  const ms = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    await cdp.enviar('Page.reload', {})
    await esperar(50)
    await t('ver', 'Hoy te toca', 15000).catch(async () => { await esperar(300); await t('ver', 'Hoy te toca', 15000) })
    ms.push(Date.now() - t0)
  }
  const m = await cdp.enviar('Performance.getMetrics').catch(() => null)
  console.log(`    carga hasta «Hoy te toca»: ${ms.join(' / ')} ms`)
  if (m) { const h = m.metrics.find(x => x.name === 'JSHeapUsedSize'); if (h) console.log(`    memoria JS: ${(h.value / 1048576).toFixed(1)} MB`) }
})

if (compilada) escenario('sin conexión (versión compilada)', async () => {
  await altaRapida('2026-10-13T05:20:00')
  // Que el service worker termine de guardar toda la app (incluidas las imágenes).
  await js(`for (let i = 0; i < 240; i++) { let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length; if (navigator.serviceWorker.controller && n > 2000) return n; await new Promise(r => setTimeout(r, 500)) } throw new Error('El service worker no terminó de guardar la app')`)
  await cdp.enviar('Network.enable')
  await cdp.enviar('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await cdp.enviar('Page.reload', {})
  await ver('Hoy te toca', 15000)
  await pestana('Rutina')
  await pulsar(/Cuerpo completo A/)
  const img = await js(`await new Promise(r=>setTimeout(r,1500)); const i=[...document.querySelectorAll('img')]; return i.length+'/'+i.filter(x=>x.complete&&x.naturalWidth>0).length`)
  const [a, b] = img.split('/')
  if (a === '0' || a !== b) throw new Error(`Imágenes sin conexión: ${img}`)
  await cdp.enviar('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
})

escenario('tema oscuro y letra grande en todas las pestañas', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await js(`localStorage.setItem('jf-tema', 'oscuro'); localStorage.setItem('jf-letra', 'grande')`)
  await meterSesionHecha('2026-10-12', 40)
  await tema('dark')
  const revisar = async (donde) => { await t('listo').catch(() => {}); await revisarAqui(`oscuro y grande · ${donde}`) }
  const pantallas = [
    ['Inicio', null], ['Rutina', null], ['Rutina', 'Ejercicios'], ['Rutina', 'Gimnasios'], ['Comida', null], ['Comida', 'Mis comidas'],
    ['Progreso', null], ['Progreso', 'Fuerza'], ['Progreso', 'Cuerpo'], ['Progreso', 'Fotos'], ['Progreso', 'Metas'], ['Perfil', null],
  ]
  for (const [p, s] of pantallas) { await pestana(p); if (s) await seg(s); await revisar(`${p}${s ? '/' + s : ''}`) }
  comprobar(await js(`return document.documentElement.dataset.theme === 'dark'`), 'El tema oscuro no se aplica')
  await tema('light')
})

escenario('tema oscuro y letra grande en las pantallas de dentro, el entreno y las hojas', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await js(`localStorage.setItem('jf-tema', 'oscuro'); localStorage.setItem('jf-letra', 'grande')`)
  await meterSesionHecha('2026-10-12', 40)
  await tema('dark')
  const revisar = async (donde) => { await t('listo').catch(() => {}); await revisarAqui(`oscuro y grande · ${donde}`) }
  await pestana('Rutina'); await seg('Mi plan'); await pulsar(/Cuerpo completo A/); await revisar('detalle del día')
  await pulsar('Editar'); await revisar('editar plan')
  await pestana('Rutina'); await seg('Ejercicios'); await pulsar(/Press de Banca con Barra/i); await revisar('ficha')
  await pestana('Comida'); await seg('Día'); await t('pulsarSel', '.card.pd.adj'); await revisar('objetivo de energía')
  await pestana('Comida'); await seg('Día'); await pulsar('Añadir', '.dock'); await revisar('hoja añadir'); await pulsar('Crear comida nueva', '.sheet'); await revisar('hoja crear comida'); await cerrarHoja()
  await pestana('Progreso'); await seg('Cuerpo'); await pulsar(/Registrar/); await revisar('registrar medidas')
  await pestana('Progreso'); await seg('Fuerza'); await t('pulsarSel', '.screen .list button.it'); await revisar('detalle del entreno')
  await pestana('Progreso'); await seg('Metas'); await pulsar('Crear una meta'); await revisar('hoja meta'); await cerrarHoja()
  await pestana('Perfil'); await t('pulsarSel', 'button[aria-label="Ajustes"]'); await revisar('ajustes')
  await pulsar('Créditos y aviso legal'); await revisar('créditos')
  await pestana('Inicio'); await pulsar('+ Peso'); await revisar('hoja peso'); await cerrarHoja()
  await pulsar('Empezar rutina'); await revisar('hoja empezar'); await pulsar(/^Empezar$/, '.sheet'); await ver('Hecho', 8000); await revisar('entreno')
  await t('pulsarSel', 'button[aria-label="Herramientas"]'); await revisar('hoja más'); await cerrarHoja()
  await t('pulsarSel', '[aria-label="Lista de la sesión"]'); await revisar('hoja lista'); await cerrarHoja()
  await pulsar('Ocupado'); await revisar('hoja ocupado'); await js('window.__jfAtras()')
  await tema('light')
})
