// Recorrido E2E estilo User Stories durante una semana entera (lunes 12 oct → domingo 18 oct 2026)
// avanzando el reloj del navegador día a día y comprobando todas las funciones reales en Chromium.
import * as fsx from 'node:fs'
import {
  ajustesBD, altaRapida, cerrarHoja, comprobar, descargado, DESCARGAS, escenario, esperar,
  hacerEntreno, irA, js, pestana, ponerPesoSiFalta, pulsar, revisarAqui, seg, t, tabla, ver, volver,
} from '../ayudantes.mjs'

escenario('semana entera (user stories lunes→domingo): rutina, plantillas, comida, metas, retos, ajustes, CSV/JSON y PDF', async () => {
  // ── LUNES 12 OCT · Inicio de semana: meta con nota, comidas, 1º reto y pasos ──
  await altaRapida('2026-10-12T08:00:00')

  // US-1: Crear meta de 10 dominadas y apuntar primer avance con nota
  await pestana('Progreso')
  await seg('Metas')
  await pulsar('Crear una meta')
  await pulsar('Dominadas', '.sheet')
  for (let i = 0; i < 5; i++) await t('pulsarSel', '.sheet [aria-label="Objetivo"] button[aria-label="Más"]')
  await pulsar('Crear meta', '.sheet')
  await ver('10 dominadas estrictas')
  await pulsar('Apuntar avance')
  await pulsar('+2', '.sheet')
  await pulsar('+2', '.sheet')
  await t('escribir', '.sheet input[placeholder*="técnica"]', 'sin balanceo')
  await pulsar('Guardar avance', '.sheet')
  await ver('Avance guardado')
  const [mLunes] = await tabla('metas')
  comprobar(mLunes.actual === 4 && mLunes.historial?.length === 1 && mLunes.historial[0].nota === 'sin balanceo', 'No guardó el avance inicial con nota')

  // US-2: Apuntar desayuno y comida del lunes
  await pestana('Comida')
  await pulsar('Añadir', '.dock')
  await pulsar('Batido de proteína', '.sheet')
  await pulsar(/^Normal/, '.popup')
  await ver('Añadido: Batido')
  await pulsar('Añadir', '.dock')
  await pulsar('Escribir lo que he comido', '.sheet')
  await t('escribir', '.nota-r input', 'Pollo con arroz')
  await pulsar(/^Apuntar$/, '.sheet')
  await ver('Pollo con arroz')

  // US-3: Hacer reto diario (flexiones 60 s en modo manual: 3 reps → primer récord)
  await pestana('Rutina')
  await seg('Retos')
  await pulsar('Empezar reto')
  await pulsar('Manual')
  await pulsar('Empezar ahora')
  for (let i = 0; i < 3; i++) await pulsar('+1 repetición')
  await pulsar('Terminar')
  await ver('¡Nuevo récord personal!')
  await pulsar('Guardar')
  await ver('Hoy: supera 3 reps', 6000)

  // US-4: Apuntar pasos + trote del lunes
  await pestana('Inicio')
  if (await t('hay', 'Primeros pasos')) await pulsar('Ya lo sé')
  await t('pulsarSel', '.kpi.steps')
  await ver('Últimos 7 días')
  await t('pulsarSel', '[aria-label="Pasos"] button[aria-label="Más"]')
  await pulsar('Guardar pasos')
  await pulsar('+ Trote / carrera')
  await pulsar(/^Añadir$/, '.sheet')
  await ver(/Añadido: trote/)

  // ── MARTES 13 OCT · Día A de rutina + Guardar plantilla libre + Repetir día de ayer + batir reto ──
  await irA('2026-10-13T05:25:00')

  // US-5: En Comida, repetir todo el día de ayer en 1 toque
  await pestana('Comida')
  await ver(/Repetir día de ayer/)
  await pulsar(/Repetir día de ayer/)
  await ver(/Copiadas 2 comidas de ayer/)
  await ver('Pollo con arroz')
  await revisarAqui('Comida martes tras repetir día de ayer')

  // US-6: Completar entreno Día A y guardar la sesión como plantilla libre «Express semanal»
  await pestana('Inicio')
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  let vueltas = 0
  while (!(await t('hay', 'Entreno terminado')) && vueltas++ < 90) {
    if (await t('hay', /Saltar/)) await pulsar(/^Saltar$/).catch(() => {})
    await ponerPesoSiFalta()
    await pulsar(/^Hecho$/)
    await esperar(120)
  }
  await ver('Entreno terminado')
  await pulsar('Guardar como plantilla libre')
  await t('escribir', 'input[aria-label="Nombre de la plantilla"]', 'Express semanal')
  await pulsar(/^Guardar$/, 'details.fold')
  await ver('Plantilla guardada: Express semanal')
  await pulsar(/^Guardar$/, '.dock')
  await ver(/hecho/i, 8000)
  comprobar((await ajustesBD()).entrenosLibres?.some(p => p.nombre === 'Express semanal'), 'No se guardó la plantilla libre en ajustes')

  // US-7: Superar el reto del lunes (5 reps → ¡nuevo récord!, racha 2 días)
  await pestana('Rutina')
  await seg('Retos')
  await pulsar('Superar marca')
  await pulsar('Manual')
  await pulsar('Empezar ahora')
  for (let i = 0; i < 5; i++) await pulsar('+1 repetición')
  await pulsar('Terminar')
  await ver('¡Nuevo récord personal!')
  await pulsar('Guardar')
  await ver('Hoy: supera 5 reps', 6000)
  await ver('2 días')

  // ── MIÉRCOLES 14 OCT · Repetir franja de ayer + +1 en meta (sparkline + historial) + Plantilla libre y Cuenta atrás ──
  await irA('2026-10-14T11:00:00')

  // US-8: Repetir solo una franja vacía de ayer en Comida
  await pestana('Comida')
  await ver(/Repetir .* de ayer/)
  await pulsar(/Repetir .* de ayer/)
  await ver(/Copiado .* de ayer/)

  // US-9: Sumar +1 en la meta → ahora tiene 2 registros y aparece el sparkline + historial
  await pestana('Progreso')
  await seg('Metas')
  await t('pulsarSel', 'button[aria-label="Sumar 1 a 10 dominadas estrictas"]')
  await ver('5 reps / 10 reps')
  comprobar(await js(`return !!document.querySelector('.goal-spark polyline')`), 'No aparece el sparkline con 2 registros en la meta')
  await pulsar('Apuntar avance')
  await ver('Histórico de avances')
  await ver('sin balanceo')
  await cerrarHoja()

  // US-10: Lanzar plantilla libre «Express semanal» desde Rutina y probar Cuenta atrás en Plancha
  await pestana('Rutina')
  await pulsar('Otras formas de entrenar')
  await ver('Tus plantillas libres')
  await pulsar('Express semanal')
  await ver('Hecho', 8000)
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Añadir ejercicio', '.sheet')
  await t('escribir', '.sheet input[type="search"]', 'Plancha')
  await esperar(250)
  await pulsar(/Plancha/, '.sheet .list')
  // Si el ejercicio actual no es Plancha, ir a Plancha desde la lista
  if (!(await t('hay', 'Cuenta atrás'))) {
    await t('pulsarSel', '[aria-label="Lista de la sesión"]')
    await pulsar(/Plancha/, '.sheet .list')
  }
  await ver('Cuenta atrás', 6000)
  await pulsar('Cuenta atrás')
  await ver('Objetivo (segundos)')
  await revisarAqui('Entreno libre con cuenta atrás')
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Descartar entreno', '.sheet')
  await pulsar('Descartar', '.sheet')
  await ver(/Mi plan|Días/, 6000)

  // ── JUEVES 15 OCT · Día B de rutina ──
  await irA('2026-10-15T05:25:00')
  await pestana('Inicio')
  await hacerEntreno()

  // ── VIERNES 16 OCT · Día C (cierra semana de prueba → Rutina definitiva) + Progreso → Fuerza ──
  await irA('2026-10-16T05:25:00')
  await pestana('Inicio')
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Hecho', 8000)
  vueltas = 0
  while (!(await t('hay', 'Entreno terminado')) && vueltas++ < 90) {
    if (await t('hay', /Saltar/)) await pulsar(/^Saltar$/).catch(() => {})
    await ponerPesoSiFalta()
    await pulsar(/^Hecho$/)
    await esperar(120)
  }
  await ver('Semana de prueba terminada')
  await pulsar(/^Guardar$/, '.dock')
  await ver('Tu rutina definitiva', 8000)
  await pulsar('Usar esta rutina')
  await ver('Definitiva', 8000)
  await pestana('Progreso')
  await seg('Fuerza')
  await ver('Historial')
  await revisarAqui('Progreso Fuerza tras 3 entrenos')

  // ── SÁBADO 17 OCT · Peso y medidas ──
  await irA('2026-10-17T09:30:00')
  await pestana('Progreso')
  await seg('Cuerpo')
  await pulsar(/Registrar/)
  await t('pulsarSel', '[aria-label="Peso"] button[aria-label="Menos"]')
  await t('pulsarSel', '.dock .btn')
  await ver('Medidas guardadas')

  // ── DOMINGO 18 OCT · Revisión semanal, Semáforo, Exportación CSV/JSON e Informe PDF de la semana ──
  await irA('2026-10-18T19:30:00')
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Cuerpo y salud')
  await pulsar('Revisión de la semana')
  await ver('¿Qué tal estás?')
  await pulsar('Todo bien')
  await ver('Apuntado. ¡Buena semana!')
  await pulsar(/^Vale$/)

  // Comprobar Progreso → Semana (semana completa con 3 de 3 entrenos)
  await pestana('Progreso')
  await seg('Semana')
  await ver('Entrenos hechos: 3 de 3')
  await revisarAqui('Progreso Semana domingo')

  // US-11: Exportación ligera CSV y JSON desde Ajustes → Datos y copias
  await pestana('Perfil')
  await t('pulsarSel', 'button[aria-label="Ajustes"]')
  await pulsar('Datos y copias')
  await ver('Exportar para hoja de cálculo')
  await revisarAqui('Ajustes Datos y copias con exportación ligera')

  let antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Entrenos (.csv)')
  const csvE = await descargado(f => f.startsWith('JowyFit-entrenos-') && f.endsWith('.csv'), antes)
  comprobar(!!csvE, 'No se descargó el CSV de entrenos')
  const tieneBom = b => b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF
  const txtCsvE = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csvE.bytes)
  comprobar(tieneBom(csvE.bytes) && txtCsvE.split('\n').length > 3, 'CSV de entrenos vacío o sin BOM')

  antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Comidas (.csv)')
  const csvC = await descargado(f => f.startsWith('JowyFit-comidas-') && f.endsWith('.csv'), antes)
  comprobar(!!csvC && tieneBom(csvC.bytes) && new TextDecoder().decode(csvC.bytes).includes('Pollo con arroz'), 'CSV de comidas incompleto')

  antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Medidas y peso (.csv)')
  const csvM = await descargado(f => f.startsWith('JowyFit-medidas-') && f.endsWith('.csv'), antes)
  comprobar(!!csvM && tieneBom(csvM.bytes) && new TextDecoder().decode(csvM.bytes).split('\n').length >= 3, 'CSV de medidas incompleto')

  antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Todo en JSON ligero (.json)')
  const jsonF = await descargado(f => f.startsWith('JowyFit-datos-') && f.endsWith('.json'), antes)
  comprobar(!!jsonF, 'No se descargó el JSON ligero')
  const jsonObj = JSON.parse(new TextDecoder().decode(jsonF.bytes))
  comprobar(jsonObj.formato === 'ligero' && jsonObj.datos.sesiones.length === 3 && jsonObj.datos.retos.length === 2, 'JSON ligero no cuadra con la semana')

  // US-12: Generar Informe PDF de la Última semana y verificar todas las secciones nuevas
  await volver()
  await pulsar('Informe en PDF')
  await ver('¿De qué días?')
  await pulsar('Última semana', '.sheet')
  antes = new Set(fsx.readdirSync(DESCARGAS))
  await pulsar('Crear el PDF', '.sheet')
  const pdf = await descargado(f => f.endsWith('.pdf'), antes)
  comprobar(!!pdf, 'No se descargó el PDF de la semana')
  const { leerPdf } = await import('../../leer-pdf.mjs')
  const leido = await leerPdf(pdf.bytes)
  comprobar(leido.paginas >= 3, `El PDF semanal tiene pocas páginas: ${leido.paginas}`)
  for (const esperado of [
    'Informe de progreso',
    'Resumen del periodo',
    'Entrenos',
    'Retos diarios',
    '5 reps',
    'Comida',
    'Cuerpo',
    'Pasos y gasto',
    'Perfil y objetivo',
    'Express semanal',
    'sin balanceo',
  ]) {
    comprobar(leido.texto.includes(esperado), `Falta «${esperado}» en el PDF semanal`)
  }
  comprobar(/(Flexiones|Sentadillas) en 60 s/.test(leido.texto), 'Falta el reto completado en el PDF semanal')
  comprobar(!/NaN|Infinity|undefined/.test(leido.texto), 'Texto roto en el PDF semanal')
})
