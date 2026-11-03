// Perfil y Ajustes: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import * as fsx from 'node:fs'
import path from 'node:path'
import { ajustesBD, altaRapida, cdp, comprobar, entorno, escenario, js, leerHasta, perfilBD, pestana, pulsar, RAIZ, revisarAqui, soltarFoco, t, tabla, tema, ver, volver } from '../ayudantes.mjs'
import { trasCarga } from '../navegador.mjs'

escenario('perfil y ajustes', async () => {
  await altaRapida('2026-10-13T19:00:00')
  await pestana('Perfil')
  await ver('Tus números')
  await pulsar('Datos personales')
  await t('escribir', 'input[aria-label="Nombre"], input', 'Ana')
  await js(`document.activeElement?.blur()`)
  await volver()
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await ver('Apariencia')
  await pulsar('Oscuro').catch(() => {})
  await pulsar('Grande').catch(() => {})
  await pulsar('Créditos y aviso legal')
  await ver('RepDB')
  await ver('Open Food Facts')
})

escenario('ajustes a fondo: letra, tema, cada interruptor, descansos, cafeína y recuperar una copia', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await ver('Apariencia')
  await revisarAqui('ajustes')
  // Letra grande y tema oscuro: se aplican a la página y se ven bien.
  await pulsar(/Grande$/)
  await pulsar('Oscuro')
  await leerHasta(() => js(`const d = document.documentElement; return { ...d.dataset, clase: d.className, tema: localStorage.getItem('jf-tema'), letra: localStorage.getItem('jf-letra') }`),
    pagina => pagina.theme === 'dark' && pagina.tema === 'oscuro' && pagina.letra === 'grande', pagina => 'La letra o el tema no se aplican: ' + JSON.stringify(pagina))
  await revisarAqui('ajustes con letra grande y tema oscuro')
  await pulsar('Más ajustes')
  await revisarAqui('más ajustes (oscuro, grande)')
  // Cada interruptor cambia su ajuste en la base.
  const campos = { 'Vibrar al acabar el descanso': 'vibrar', 'Sonido al acabar el descanso': 'sonido', 'Pantalla siempre encendida': 'pantallaEncendida', 'Calentamiento sugerido': 'calentamiento', 'Avisos de seguridad': 'avisosSeguridad', 'Mostrar calorías': 'mostrarKcal' }
  for (const [etq, campo] of Object.entries(campos)) {
    if (!(await js(`return !!document.querySelector('[role=switch][aria-label=${JSON.stringify(etq)}]')`))) continue
    const antes = (await ajustesBD())[campo]
    await t('pulsarSel', `[role=switch][aria-label="${etq}"]`)
    await leerHasta(ajustesBD, a => a[campo] === !antes, `«${etq}» no cambia ${campo}`)
  }
  // Descansos y cafeína.
  const a0 = await ajustesBD()
  await t('pulsarSel', '[aria-label="Descanso de compuestos"] button[aria-label="Más"]')
  await t('pulsarSel', '[aria-label="Descanso de aislamiento"] button[aria-label="Menos"]')
  await t('pulsarSel', '[aria-label="Límite de cafeína"] button[aria-label="Menos"]')
  await leerHasta(ajustesBD, a1 => a1.descansoCompuesto === a0.descansoCompuesto + 15 && a1.descansoAislamiento === a0.descansoAislamiento - 15 && a1.cafeinaLimite === a0.cafeinaLimite - 50,
    a1 => 'Descansos o cafeína no se guardan: ' + JSON.stringify([a1.descansoCompuesto, a1.descansoAislamiento, a1.cafeinaLimite]))
  // Recuperar una copia desde Ajustes (pide confirmar antes de sustituir nada).
  const copia = path.join(RAIZ, '.cache', 'e2e-copia-ajustes.jowyfit')
  fsx.writeFileSync(copia, JSON.stringify({ app: 'JowyFit', version: 1, datos: { perfil: (await tabla('perfil')).map(p => ({ ...p, nombre: 'Copiado' })), ajustes: await tabla('ajustes'), plantillas: [], rutinas: await tabla('rutinas'), gimnasios: await tabla('gimnasios') } }))
  entorno.archivoParaElegir = copia
  await pulsar('Recuperar una copia')
  await ver(/Recuperar/)
  // Al recuperarla, la app avisa y se recarga sola: se espera a la recarga (si no, cae en el escenario siguiente).
  await trasCarga(cdp, () => js(`
    sessionStorage.removeItem('__e2e_aviso')
    new MutationObserver((_, o) => { if (document.body.innerText.includes('Copia recuperada')) { sessionStorage.setItem('__e2e_aviso', '1'); o.disconnect() } })
      .observe(document.body, { childList: true, subtree: true, characterData: true })
    void __t.pulsar(/^Recuperar$/)`), 'recuperar la copia')
  comprobar(await js(`return sessionStorage.getItem('__e2e_aviso')`) === '1', 'No salió «Copia recuperada» antes de recargar')
  entorno.archivoParaElegir = null
  comprobar((await tabla('perfil'))[0]?.nombre === 'Copiado', 'La copia recuperada no sustituye los datos')
  // Vuelta a claro y letra normal para lo siguiente.
  await pulsar(/^Normal$/).catch(() => {})
  await pulsar(/^Claro$/).catch(() => {})
})

/** Abre una sección de «Tu ficha» en Perfil (las de «Más secciones» están plegadas). */
async function seccion(nombre) {
  await pestana('Perfil')
  if (!(await js(`return [...document.querySelectorAll('.screen button.it b')].some(b => b.innerText.trim() === ${JSON.stringify(nombre)} && b.getBoundingClientRect().width > 0)`))) await pulsar('Más secciones')
  await pulsar(nombre)
  await ver(nombre)
  await t('listo')
  await revisarAqui(`perfil: ${nombre}`)
}

escenario('perfil a fondo: cada sección de la ficha cambia el perfil guardado', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Perfil')
  await revisarAqui('perfil')
  await t('pulsarSel', 'button[aria-label="¿Qué es esto?"]')
  let p0 = await perfilBD()
  // Datos personales: sexo y altura.
  await seccion('Datos personales')
  await pulsar('Mujer')
  await t('pulsarSel', '[aria-label="Altura"] button[aria-label="Más"]')
  await leerHasta(perfilBD, p => p.sexo === 'mujer' && p.alturaCm === p0.alturaCm + 1, p => 'Datos personales no se guardan: ' + JSON.stringify([p.sexo, p.alturaCm]))
  await pulsar('Hombre')
  await seccion('Peso y medidas')
  // Objetivos: otro objetivo y una zona a reforzar.
  await seccion('Objetivos')
  // La tarjeta del objetivo (no el chip de «¿Algo más?», que dice lo mismo) y una zona de «Afinar».
  await pulsar('Ganar fuerza', '.opts')
  await js(`[...document.querySelectorAll('.screen button.mq')].find(c => /pecho/i.test(c.innerText))?.click()`)
  await leerHasta(perfilBD, p => p.objetivo === 'fuerza' && JSON.stringify(p.zonasPrioridad) !== JSON.stringify(p0.zonasPrioridad), p => 'Objetivos no se guardan: ' + JSON.stringify([p.objetivo, p.zonasPrioridad]))
  // Horario: el lunes pasa a fijo, la hora y el transporte.
  await seccion('Horario')
  await js(`[...document.querySelectorAll('.screen .chip.day')][0].click()`)
  await pulsar('Coche')
  await t('escribir', 'input[aria-label="Otra hora"]', '06:15')
  const p = await leerHasta(perfilBD, p => p.transporte === 'coche' && p.horaEntreno === '06:15', p => 'Horario no se guarda: ' + JSON.stringify([p.transporte, p.horaEntreno]))
  comprobar(JSON.stringify(p.diasFijos) !== JSON.stringify(p0.diasFijos) || JSON.stringify(p.diasOpcionales) !== JSON.stringify(p0.diasOpcionales), 'El día no cambia')
  // Salud: una zona sensible y las lesiones (se guardan al salir del campo).
  await seccion('Salud y molestias')
  // Una molestia con sus tres toques (la hoja de la zona) y el texto libre.
  await js(`[...document.querySelectorAll('.screen button.mq')].find(b => /hombros/i.test(b.innerText))?.click()`)
  await pulsar(/^Regular$/, '.sheet')
  await pulsar(/^Guardar$/, '.sheet')
  await t('escribir', 'textarea[placeholder^="Por ejemplo"]', 'Hombro derecho')
  await soltarFoco()
  await leerHasta(perfilBD, p => p.dolores?.some(d => d.zona === 'hombros' && d.cuanto === 'regular') && p.lesiones === 'Hombro derecho', p => 'Salud no se guarda: ' + JSON.stringify([p.dolores, p.lesiones]))
  // Preferencias: dos seguidos y abdominales.
  await seccion('Preferencias de entreno')
  await t('pulsarSel', '[role=switch][aria-label="Dos seguidos"]')
  await t('pulsarSel', '[role=switch][aria-label="Abdominales"]')
  await leerHasta(perfilBD, p => p.superseries === !p0.superseries && p.core === !p0.core, 'Preferencias no se guardan')
  // Tu nivel: un peso de referencia.
  await seccion('Tu nivel')
  await t('escribir', 'input[aria-label="Press de banca"]', '50 kg × 8')
  await soltarFoco()
  await leerHasta(perfilBD, p => p.referencias.banca === '50 kg × 8', p => 'La referencia no se guarda: ' + JSON.stringify(p.referencias))
  // Pesarte y fotos: semanas entre fotos.
  await seccion('Pesarte y fotos')
  await t('pulsarSel', '[aria-label="Semanas entre fotos"] button[aria-label="Más"]')
  await leerHasta(perfilBD, p => p.fotosCadaSemanas === p0.fotosCadaSemanas + 1, 'Las semanas entre fotos no cambian')
  // Suplementos: marcar uno.
  await seccion('Suplementos')
  await js(`document.querySelector('.screen .chips .chip').click()`)
  await leerHasta(perfilBD, p => p.suplementos.length !== p0.suplementos.length, 'Los suplementos no cambian')
  // Tu trabajo.
  await seccion('Tu trabajo')
  await pulsar('De pie')
  await leerHasta(perfilBD, p => p.trabajo === 'depie', 'El trabajo no cambia')
  // Regenerar desde una sección que afecta a la rutina.
  await seccion('Objetivos')
  await pulsar('Regenerar la rutina')
  await ver('Usar esta rutina')
})
