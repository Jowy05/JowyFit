// Rutina, semana y gimnasios: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import { altaRapida, cerrarHoja, comprobar, escenario, esperar, hacerEntreno, irA, js, meter, meterSesionHecha, noVer, pestana, ponerPesoSiFalta, pulsar, recargar, revisarAqui, seg, soltarFoco, t, tabla, ver, volver } from '../ayudantes.mjs'

escenario('semana: dos entrenos, progresión y día perdido', async () => {
  await altaRapida('2026-10-12T09:00:00')
  await ver(/descansas|Próximo/i)
  // Martes: A (ya hecho, puesto en la base para no tardar). Jueves: B con la interfaz y un ejercicio sustituido.
  await meterSesionHecha('2026-10-13', 40, { calibracion: true })
  await irA('2026-10-15T05:20:00')
  await hacerEntreno({ ocupado: true, series: 6 })
  await irA('2026-10-17T09:00:00') // sábado: no se hizo C el viernes → ¿al sábado?
  await ver(/no entrenaste|Opcional|Sesión extra/i)
  await irA('2026-10-20T05:20:00') // martes siguiente: A otra vez, con la carga de la semana pasada
  await ver('Hoy te toca')
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver(/La última vez/i)
  await noVer('Primera vez: elige')
  await t('pulsarSel', '[aria-label="Lista de la sesión"]')
  await pulsar('Terminar entreno', '.sheet')
  await pulsar('Guardar')
  await pestana('Progreso')
  await seg('Fuerza')
  await ver('Historial')
  await seg('Semana')
  await ver(/entrenos/i)
})

escenario('semana de prueba completa: 3 entrenos y rutina definitiva', async () => {
  await altaRapida('2026-10-13T05:20:00') // martes: A
  // A y B ya hechos (puestos en la base, con la hora de cada serie para medir los tiempos reales).
  await meterSesionHecha('2026-10-13', 40, { calibracion: true })
  await meterSesionHecha('2026-10-15', 40, { calibracion: true }, 'B')
  await irA('2026-10-16T05:20:00') // viernes: C, el tercero de la semana de prueba (con la interfaz)
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
  await ver('Semana de prueba terminada')
  await pulsar('Guardar')
  // Se propone la definitiva: la misma rutina, con lo que cambia y sin «Otra variante».
  await ver('Tu rutina definitiva', 8000)
  await ver('Qué cambia')
  await noVer('Otra variante')
  await pulsar('Usar esta rutina')
  await ver('Definitiva', 8000)
  const rutinas = await tabla('rutinas')
  const activa = rutinas.find(r => r.activa)
  if (!activa || activa.calibracion) throw new Error('La rutina activa sigue en semana de prueba')
  if (rutinas.length !== 2) throw new Error('Debería haber 2 rutinas (la de prueba y la definitiva): ' + rutinas.length)
})

escenario('rutina: regenerar, biblioteca y gimnasio', async () => {
  await altaRapida('2026-10-14T18:00:00')
  await pestana('Rutina')
  // Rehacer la rutina está dentro de «Editar plan», con confirmación.
  await pulsar('Editar plan')
  await pulsar('Rehacer la rutina desde cero')
  await pulsar('Ver la rutina nueva', '.sheet')
  // Rehacerla durante la semana de prueba la mantiene en prueba (antes pasaba a «Definitiva»).
  await ver('Empezar con una semana de prueba')
  await pulsar('Usar esta rutina')
  await ver('Cuerpo completo', 6000)
  await ver('Semana de prueba')
  await pestana('Rutina')
  await seg('Ejercicios')
  await t('escribir', 'input[type=search]', 'press banca')
  await ver(/Press de Banca/i)
  await pulsar(/Press de Banca con Barra/i)
  await ver('Músculos que trabaja')
  await ver('Instrucciones')
  await pulsar('Favorito').catch(() => {})
  await volver()
  await pestana('Rutina')
  await seg('Gimnasios')
  await pulsar(/Editar/)
  await ver('Máquinas y material')
  await pulsar('Guardar')
})

escenario('semana suave tras 6 semanas', async () => {
  await altaRapida('2026-10-19T09:00:00')
  // 6 semanas con dos entrenos cada una (como si se hubieran hecho), con los ejercicios del día A.
  const [rutina] = await tabla('rutinas')
  const dia = rutina.dias[0]
  const sesiones = []
  let id = 1000
  for (let sem = 6; sem >= 1; sem--) for (const dd of [1, 3]) {
    const f = new Date(2026, 9, 19 - sem * 7 + dd)
    const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    sesiones.push({ id: id++, fecha, rutinaId: rutina.id, letra: dia.letra, nombre: dia.nombre, gimnasioId: null, inicio: f.getTime() + 5.5 * 3600e3, version: 'normal', estado: 'hecha', calibracion: false,
      ejercicios: dia.bloques.map(b => ({ uid: b.uid, ejercicio: b.ejercicio, planificado: b.ejercicio, estado: 'hecho', repsMin: b.repsMin, repsMax: b.repsMax, rpe: b.rpe, descanso: b.descanso, registro: b.registro,
        series: Array.from({ length: b.series }, (_, i) => ({ n: i + 1, peso: b.registro === 'peso' ? 20 + (6 - sem) * 2.5 : null, reps: b.repsMin, rpe: 8, calentamiento: false, hecha: true })) })) })
  }
  await meter('sesiones', sesiones)
  await meter('rutinas', [{ ...rutina, calibracion: false }])
  await recargar()
  await ver('¿Semana suave?', 8000)
  await pulsar('Ahora no')
  await noVer('¿Semana suave?')
  // Sigue entrenando la semana aplazada (si no, la racha se corta y ya no hace falta semana suave).
  await meter('sesiones', [{ ...sesiones[sesiones.length - 1], id: id++, fecha: '2026-10-20', inicio: new Date(2026, 9, 20, 5, 30).getTime() }])
  await irA('2026-10-26T09:00:00') // la semana siguiente vuelve a salir
  await ver('¿Semana suave?', 8000)
  await pulsar('Sí, esta semana')
  await ver('Semana suave.', 5000)
  await irA('2026-10-27T05:20:00') // martes: día A, más ligero
  await pulsar('Empezar rutina')
  await pulsar('Empezar', '.sheet')
  await ver('Semana suave: 1 serie menos', 8000)
  const s = (await tabla('sesiones')).find(x => x.estado === 'curso')
  if (!s.suave) throw new Error('La sesión no está marcada como suave')
  const b0 = dia.bloques[0]
  const e0 = s.ejercicios[0]
  if (e0.series.length !== Math.max(2, b0.series - 1)) throw new Error(`Series: ${e0.series.length} (plan ${b0.series})`)
  if (b0.registro === 'peso' && !(e0.series[0].peso < 32.5)) throw new Error('El peso no baja en la semana suave: ' + e0.series[0].peso)
})

/** La rutina activa y el día A tal como están en la base. */
const rutinaActiva = async () => (await tabla('rutinas')).find(r => r.activa)

const diaA = async () => (await rutinaActiva()).dias.find(d => d.letra === 'A')

/** Pulsa un botón por su texto dentro de la tarjeta n de Editar plan. */
const enTarjeta = (n, texto) => js(`const c = document.querySelectorAll('.edr.card')[${n}]; const b = [...c.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(${JSON.stringify(texto)})); if (!b) throw new Error('No hay «' + ${JSON.stringify(texto)} + '» en la tarjeta ${n}'); b.click(); await new Promise(r => setTimeout(r, 350))`)

escenario('rutina a fondo: día, editar plan (series, reps, prisa, dos seguidos, mover, si está ocupado, cambiar, quitar, añadir)', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await pulsar(/Cuerpo completo A/)
  await ver('Empezar este entreno')
  await revisarAqui('detalle del día')
  await pulsar('Editar')
  await ver('Editar plan')
  await t('listo')
  await revisarAqui('editar plan')
  let a = await diaA()
  const b0 = a.bloques[0]
  // Series: + 1.
  await js(`document.querySelectorAll('.edr.card')[0].querySelector('[aria-label="Series"] button[aria-label="Más"]').click()`)
  await esperar(350)
  a = await diaA()
  comprobar(a.bloques[0].series === b0.series + 1, 'El + de series no cambia la rutina')
  // Reps: tocar el chip pasa al siguiente rango.
  await js(`document.querySelectorAll('.edr.card')[0].querySelector('.ux-rut-reps')?.click()`)
  await esperar(350)
  a = await diaA()
  comprobar(b0.registro === 'tiempo' || a.bloques[0].repsMin !== b0.repsMin || a.bloques[0].repsMax !== b0.repsMax, 'Tocar las reps no cambia el rango')
  // Más opciones: fuera si hay prisa, dos seguidos y separar, bajar.
  await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Fuera si hay prisa')
  a = await diaA()
  comprobar(a.bloques[0].fueraEnCorta === !b0.fueraEnCorta, '«Fuera si hay prisa» no cambia')
  const libre = a.bloques.findIndex((b, i) => i < a.bloques.length - 1 && !b.superserie && !a.bloques[i + 1].superserie)
  if (libre >= 0) {
    if (libre !== 0) await enTarjeta(libre, 'Más opciones')
    await enTarjeta(libre, 'Dos seguidos')
    a = await diaA()
    comprobar(a.bloques[libre].superserie === a.bloques[libre + 1].uid, '«Dos seguidos» no los junta')
    // El «Separar» de esta pareja (puede haber otras parejas antes).
    const antes = a.bloques.slice(0, libre).filter(b => b.superserie && a.bloques.findIndex(x => x.uid === b.superserie) > a.bloques.indexOf(b)).length
    await js(`document.querySelectorAll('.ss-head button.lnk')[${antes}].click()`)
    await ver('Ya no van seguidos')
    a = await diaA()
    comprobar(!a.bloques[libre].superserie, '«Separar» no los separa')
  }
  const orden = (await diaA()).bloques.map(b => b.uid)
  if (!(await js(`return [...document.querySelectorAll('.edr.card')[0].querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Bajar'))`))) await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Bajar')
  a = await diaA()
  comprobar(a.bloques[1].uid === orden[0] && a.bloques[0].uid === orden[1], '«Bajar» no baja el ejercicio')
  // Si está ocupado: elegir una alternativa.
  if (!(await js(`return [...document.querySelectorAll('.edr.card')[0].querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Si está ocupado'))`))) await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Si está ocupado')
  await ver('Qué hacer si')
  const alt = await js(`const b = document.querySelector('.sheet .list button.it'); const n = b.querySelector('b')?.innerText; b.click(); return n`)
  await ver('Si está ocupado:')
  a = await diaA()
  comprobar(a.bloques[0].alternativas.length > 0, 'La alternativa no se guarda')
  // Cambiar ejercicio.
  const antes = a.bloques[0].ejercicio
  await enTarjeta(0, 'Cambiar ejercicio')
  await ver('En lugar de')
  await js(`document.querySelector('.sheet .list button.it').click()`)
  await ver('Cambiado por')
  a = await diaA()
  comprobar(a.bloques[0].ejercicio !== antes, 'No se cambia el ejercicio del plan (' + alt + ')')
  // Quitar y deshacer.
  const n = a.bloques.length
  if (!(await js(`return [...document.querySelectorAll('.edr.card')[0].querySelectorAll('button')].some(b => b.innerText.trim().startsWith('Quitar'))`))) await enTarjeta(0, 'Más opciones')
  await enTarjeta(0, 'Quitar')
  await ver('Ejercicio quitado')
  comprobar((await diaA()).bloques.length === n - 1, 'No se quita el ejercicio')
  await pulsar('Deshacer')
  await esperar(400)
  comprobar((await diaA()).bloques.length === n, '«Deshacer» no lo devuelve')
  // Añadir un ejercicio al día.
  await pulsar('Añadir ejercicio')
  await t('escribir', '.sheet input[type=search]', 'plancha')
  await esperar(300)
  await js(`document.querySelector('.sheet .list button.it').click()`)
  await ver('Añadido:')
  comprobar((await diaA()).bloques.length === n + 1, 'No se añade el ejercicio al día')
  // Otro día en Editar plan.
  await js(`[...document.querySelectorAll('.screen .chips .chip')].find(c => /^J|jue/i.test(c.innerText.trim()))?.click()`)
  await esperar(300)
  await revisarAqui('editar plan, otro día')
})

escenario('rutina a fondo: ficha (no me gusta, me duele, ajustes, notas, al plan), filtros de la biblioteca y otra variante', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await seg('Ejercicios')
  await revisarAqui('biblioteca')
  // Filtros: favoritos (sin ninguno), en mi gimnasio, más filtros y quitar filtros.
  const cuenta = () => js(`return Number(document.querySelector('.count b')?.innerText || 0)`)
  const total = await cuenta()
  // «En mi gimnasio» viene puesto; con el gimnasio completo del alta la lista es la misma, solo cambia el chip.
  await t('pulsarSel', '.chip[aria-pressed="true"]:has(.ck)')
  comprobar(await js(`return [...document.querySelectorAll('.chip')].find(c => c.innerText.trim() === 'En mi gimnasio')?.getAttribute('aria-pressed') === 'false'`), '«En mi gimnasio» no se quita')
  const todos = await cuenta()
  comprobar(todos >= total, 'Sin «En mi gimnasio» salen menos ejercicios')
  await pulsar('Más filtros')
  await t('elegir', 'select[aria-label="Equipamiento"]', 'dumbbell')
  await esperar(300)
  comprobar((await cuenta()) < todos, 'El filtro de equipamiento no filtra')
  await pulsar('Quitar filtros').catch(() => pulsar(/^Quitar/))
  await esperar(300)
  // Calistenia y cardio: no son solo máquinas y pesas (dominadas, flexiones, correr, comba…).
  await pulsar(/^Calistenia$/)
  await esperar(300)
  const nCal = await cuenta()
  comprobar(nCal > 30 && nCal < todos, 'El filtro «Calistenia» no filtra bien: ' + nCal)
  await ver('Dominadas')
  await pulsar(/^Cardio$/)
  await esperar(300)
  const nCar = await cuenta()
  comprobar(nCar > 5 && nCar < nCal, 'El filtro «Cardio» no filtra bien: ' + nCar)
  await ver('Burpees')
  await pulsar(/^Cardio$/)
  await esperar(300)
  comprobar((await cuenta()) === todos, 'Quitar «Cardio» no vuelve a la lista entera')
  await t('escribir', 'input[aria-label="Buscar ejercicio"]', 'calistenia')
  await esperar(300)
  // Al buscar también salen los estiramientos (la lista sin buscar los esconde), así que son los mismos o más.
  comprobar((await cuenta()) >= nCal, 'Buscar «calistenia» da menos que el filtro')
  await ver('Dominadas')
  await t('escribir', 'input[aria-label="Buscar ejercicio"]', 'press banca')
  await pulsar(/Press de Banca con Barra/i)
  await ver('Músculos que trabaja')
  await revisarAqui('ficha')
  await pulsar('No me gusta')
  await pulsar('Me duele')
  await esperar(300)
  let m = (await tabla('marcas')).find(x => x.odiado)
  const idFicha = m?.id
  comprobar(m?.odiado && m.duele, '«No me gusta» y «Me duele» no se guardan: ' + JSON.stringify(m))
  await pulsar('Me duele')
  await pulsar('Escribir')
  await t('escribir', 'input[placeholder^="Asiento 4"]', 'Banco 3')
  await soltarFoco()
  await t('escribir', 'textarea[placeholder^="Escápulas"]', 'Codos a 45 grados')
  await soltarFoco()
  await esperar(300)
  m = (await tabla('marcas')).find(x => x.id === idFicha)
  comprobar(m?.ajustes === 'Banco 3' && m.notas === 'Codos a 45 grados' && !m.duele, 'Ajustes y notas no se guardan: ' + JSON.stringify(m))
  await pulsar('Listo')
  await ver('Banco 3')
  // Añadir a mi plan (al día B).
  const nB = (await rutinaActiva()).dias.find(d => d.letra === 'B').bloques.length
  await pulsar('Añadir a mi plan')
  await js(`[...document.querySelectorAll('.chips .chip')].find(c => /B|jueves/i.test(c.innerText) && !/Cancelar/.test(c.innerText))?.click()`)
  await ver('Añadido a tu plan')
  comprobar((await rutinaActiva()).dias.find(d => d.letra === 'B').bloques.length === nB + 1, '«Añadir a mi plan» no lo añade')
  // Galería: tocar la imagen cambia de pose (no rompe).
  await js(`document.querySelector('.gal-it')?.click()`)
  await volver()
  // Rehacer la rutina: otra variante.
  await pestana('Rutina')
  await pulsar('Editar plan')
  await pulsar('Rehacer la rutina desde cero')
  await pulsar('Ver la rutina nueva', '.sheet')
  await ver('Usar esta rutina')
  await revisarAqui('rutina nueva')
  await pulsar('Otra variante')
  await ver(/Variante \d de 3 lista/)
})

escenario('gimnasios a fondo: otro gimnasio, nombre y notas, material, mancuernas, discos, máquina propia, usar y borrar', async () => {
  await altaRapida('2026-10-13T05:20:00')
  await pestana('Rutina')
  await seg('Gimnasios')
  await revisarAqui('gimnasios')
  const n = (await tabla('gimnasios')).length
  await pulsar('Añadir otro gimnasio')
  await ver('Editor de gimnasio')
  await t('listo')
  await t('escribir', 'input[aria-label="Nombre del gimnasio"]', 'Gimnasio del barrio')
  await t('escribir', 'textarea[aria-label="Notas"]', 'Poca gente a las 6')
  // Material: marcar o quitar una máquina.
  const mat0 = (await tabla('gimnasios')).at(-1).material.length
  await js(`document.querySelector('button.mq')?.click()`)
  // Mancuernas: un tramo más y su «hasta».
  await pulsar('+ Añadir tramo')
  await t('pulsarSel', '[aria-label="Tramo 1: hasta"] button[aria-label="Más"]')
  // Discos: quitar el de 0,5 y barra de 15.
  await js(`[...document.querySelectorAll('.sec .chips .chip')].find(c => c.innerText.trim() === '0,5')?.click()`)
  await js(`[...document.querySelectorAll('.sec .chips .chip')].find(c => c.innerText.trim() === '15 kg')?.click()`)
  await revisarAqui('editor de gimnasio')
  // Máquina propia (se guarda antes el gimnasio).
  await pulsar('Añadir una máquina que no sale')
  await ver('Máquina propia')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Ponle un nombre')
  await t('escribir', '.sheet input[aria-label="Nombre de la máquina"]', 'Remo T con apoyo')
  await t('escribir', '.sheet textarea[aria-label="Notas de la máquina"]', 'Al fondo')
  await pulsar(/^Guardar$/, '.sheet')
  await ver('Máquina propia guardada')
  await ver('Remo T con apoyo')
  await t('pulsarSel', '.dock .result button')
  await ver('Gimnasio guardado')
  const gs = await tabla('gimnasios')
  comprobar(gs.length === n + 1, 'No se crea el gimnasio')
  const g = gs.find(x => x.nombre === 'Gimnasio del barrio')
  comprobar(g, 'No se guarda el nombre: ' + gs.map(x => x.nombre))
  comprobar(g.notas === 'Poca gente a las 6', 'No se guardan las notas')
  comprobar(g.material.length !== mat0, 'No cambia el material')
  comprobar(g.mancuernas.length === 3, 'No se añade el tramo de mancuernas: ' + JSON.stringify(g.mancuernas))
  comprobar(!g.discos.includes(0.5) && g.barraKg === 15, 'No cambian los discos ni la barra: ' + JSON.stringify([g.discos, g.barraKg]))
  comprobar(g.propias.some(p => p.nombre === 'Remo T con apoyo' && p.notas === 'Al fondo'), 'No se guarda la máquina propia')
  // Usar este gimnasio: pregunta si rehacer la rutina; «Cancelar» la deja como está.
  await t('listo')
  await pulsar('Usar este gimnasio')
  await ver('Ahora usas «Gimnasio del barrio»')
  comprobar((await tabla('ajustes'))[0].gimnasioActivo === g.id, 'No cambia el gimnasio activo')
  await cerrarHoja().catch(() => {})
  // Borrar el gimnasio (con confirmación).
  await pulsar(/^Editar gimnasio$|^Editar$/)
  await t('listo')
  await pulsar('Borrar gimnasio')
  await ver('¿Borrar «')
  await pulsar(/^Borrar$/, '.sheet')
  await esperar(600)
  comprobar((await tabla('gimnasios')).length === n, 'No se borra el gimnasio')
})

escenario('ejercicios propios: crear, «Tuyo», al plan, editar y borrar con deshacer', async () => {
  await altaRapida('2026-10-14T18:00:00')
  await pestana('Rutina')
  await seg('Ejercicios')
  // Una búsqueda que no encuentra nada ofrece crearlo con ese nombre.
  await t('escribir', 'input[type=search]', 'press con goma')
  await pulsar('Crear «press con goma»')
  await ver('Solo el nombre es obligatorio.')
  await cerrarHoja()
  await t('escribir', 'input[type=search]', '')
  await pulsar('Crear un ejercicio')
  await t('escribir', '.sheet input.pr-nombre', 'Remo con goma elástica')
  await pulsar('Espalda', '.sheet')
  await pulsar('Guardar ejercicio', '.sheet')
  await ver(/Guardado: Remo con goma elástica/)
  const [p] = await tabla('propios')
  comprobar(p?.nombre === 'Remo con goma elástica' && p.grupo === 'espalda' && p.material === 'otro' && p.registro === 'peso' && !p.rutinaAuto, 'Ejercicio propio mal guardado: ' + JSON.stringify(p))

  await pulsar(/^Tuyos/)
  await ver('Tuyo')
  await pulsar(/Remo con goma elástica/)
  await ver('Tus datos')
  await ver('Ejercicio creado por ti')
  await noVer('Instrucciones')
  await pulsar('Añadir a mi plan')
  await js(`const p = [...document.querySelectorAll('p')].find(x => x.innerText.includes('¿A qué día lo añado?')); p.nextElementSibling.querySelector('button').click(); await new Promise(r => setTimeout(r, 400))`)
  await ver(/Añadido a tu plan/)
  const enPlan = async () => (await tabla('rutinas')).find(r => r.activa).dias.some(d => d.bloques.some(b => b.ejercicio === p.id))
  comprobar(await enPlan(), 'El ejercicio propio no está en el plan')

  await pulsar('Editar')
  await ver('Editar ejercicio')
  await pulsar('Solo repeticiones', '.sheet')
  await pulsar('Guardar cambios', '.sheet')
  await ver('Cambios guardados')
  comprobar((await tabla('propios'))[0].registro === 'corporal', 'No se guardó el cambio de cómo se apunta')

  await pulsar('Borrar este ejercicio')
  await ver(/Está en tu plan/)
  await pulsar('Sí, borrar', '.sheet')
  await ver('Ejercicio borrado')
  comprobar(!(await enPlan()), 'Borrado, pero sigue en el plan')
  comprobar(!!(await tabla('propios'))[0].borrado, 'No queda marcado como borrado')
  await pulsar('Deshacer')
  await esperar(400)
  comprobar(await enPlan(), '«Deshacer» no lo devolvió al plan')
  comprobar(!(await tabla('propios'))[0].borrado, '«Deshacer» no lo recuperó')
  await revisarAqui('ejercicios propios')
})
