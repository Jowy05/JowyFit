// El alta: escenarios de extremo a extremo (se registran con escenario() y los pasa correr.mjs).
import { alta, comprobar, deCero, escenario, js, noVer, pestana, pulsar, revisarAqui, t, tabla, ver } from '../ayudantes.mjs'

escenario('alta y rutina', async () => {
  await deCero('2026-10-13T05:20:00') // martes, día de entreno
  await ver('Tu fuerza y tu comida')
  await alta()
  await ver('Empezar rutina')
  // Guía para quien llega nuevo: se ve y se puede quitar.
  await ver('Primeros pasos')
  await pulsar('Ya lo sé')
  await noVer('Primeros pasos')
  await pestana('Rutina')
  await ver('Cuerpo completo')
  await ver(/Semana de (calibración|prueba)/i)
})

escenario('alta a fondo: letra grande en la bienvenida, medidas opcionales y gimnasio marcado a mano', async () => {
  await deCero('2026-10-14T18:00:00')
  await ver('Tu fuerza y tu comida')
  await revisarAqui('bienvenida')
  await t('pulsarSel', '.alta-letra')
  comprobar(await js(`return localStorage.getItem('jf-letra') === 'grande'`), '«Letra grande» no se guarda')
  await revisarAqui('bienvenida con letra grande')
  await alta({ medidas: true, gimnasioYo: true })
  const ms = await tabla('mediciones')
  comprobar(ms.some(m => m.pesoKg === 75), 'El peso del alta no se guarda')
  comprobar(ms.some(m => m.perimetros?.cintura === 95 && m.perimetros?.cuello === 38), 'Las medidas del alta no se guardan: ' + JSON.stringify(ms))
  const [g] = await tabla('gimnasios')
  comprobar(g?.nombre === 'Gimnasio del barrio' && !g.material.includes('cable'), 'El gimnasio marcado a mano no se guarda: ' + JSON.stringify([g?.nombre, g?.material]))
  // La rutina no usa poleas si el gimnasio no tiene.
  const [r] = await tabla('rutinas')
  const conPolea = r.dias.flatMap(d => d.bloques).filter(b => /cable/.test(b.ejercicio))
  comprobar(!conPolea.length, 'La rutina usa poleas que el gimnasio no tiene: ' + conPolea.map(b => b.ejercicio))
  const p = (await tabla('perfil'))[0]
  comprobar(p.altaCompleta && p.alturaCm === 175 && p.sexo === 'hombre' && JSON.stringify(p.diasFijos) === '[1,3,4]', 'El perfil del alta no es el elegido: ' + JSON.stringify([p.alturaCm, p.sexo, p.diasFijos]))
  await js(`localStorage.removeItem('jf-letra')`)
})
