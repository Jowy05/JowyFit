import { db } from '../../../src/datos/db'
import { guardarAjustes, guardarPerfil, leerAjustes, leerPerfil, rutinaActiva } from '../../../src/datos/repos'
import { guardarRevision, deshacerCambio } from '../../../src/datos/acciones/revision'
import { activarRutina } from '../../../src/datos/acciones/rutina'
import { letrasHechasDeRutina, sesionesHechas, sesionesHechasDeRutina } from '../../../src/datos/consultas'
import { ejercicio, nombreEjercicio } from '../../../src/catalogo/catalogo'
import { doloresDe } from '../../../src/dominio/salud'
import { propuestaDescarga } from '../../../src/dominio/descarga'
import { rutinaDefinitiva, tiemposReales } from '../../../src/dominio/generador'
import type { Comprobacion, ContextoDia } from '../tipos'
import { comprobar } from '../observador'
import { zonaReal } from './perfiles'

export async function revisar(contexto: ContextoDia): Promise<Comprobacion[]> {
  const perfil = (await leerPerfil())!
  const anteriores = doloresDe(perfil)
  const eventos = contexto.eventos.filter(evento => evento.tipo === 'molestia')
  const revisiones: Comprobacion[] = []
  if (eventos.length || new Date(`${contexto.fecha}T12:00:00`).getDay() === 0) {
    const nuevos = eventos.filter(evento => !anteriores.some(dolor => dolor.zona === zonaReal(evento.zona)) && evento.estado !== 'ya')
      .map(evento => ({ zona: zonaReal(evento.zona), cuanto: 'poco' as const, cuando: 'fuerza' as const, desde: 'dias' as const, inicio: contexto.fecha }))
    await guardarPerfil({ dolores: [...anteriores, ...nuevos], zonasSensibles: [] })
    const revision = await guardarRevision({
      estado: eventos.length ? 'seguimiento' : 'bien',
      zonasAntes: anteriores.map(dolor => dolor.zona),
      respuestas: eventos.map(evento => ({ zona: zonaReal(evento.zona), va: evento.estado })),
    })
    revisiones.push(comprobar('revision.persistencia', !!(await db.revisiones.get(revision.id)), `Revisión guardada; cambios: ${revision.cambios.length}`))
    if (revision.cambios.length) revisiones.push({ regla: 'revision.cambios', estado: 'aprobada', detalle: `${revision.cambios.length} cambios mediante la acción real` })
  }
  if (contexto.eventos.some(evento => evento.tipo === 'decision' && evento.valor === 'deshacer')) {
    const revisionesPrevias = await db.revisiones.toArray()
    const ultima = revisionesPrevias.reverse().find(revision => revision.cambios.some(cambio => !cambio.deshecho))
    const cambio = ultima?.cambios.find(candidato => !candidato.deshecho)
    if (ultima && cambio) {
      const hecho = await deshacerCambio(ultima.id, cambio.uid)
      const guardada = await db.revisiones.get(ultima.id)
      revisiones.push(comprobar('revision.deshacer', hecho && !!guardada?.cambios.find(candidato => candidato.uid === cambio.uid)?.deshecho, 'Deshacer mediante la acción real'))
    } else revisiones.push({ regla: 'revision.deshacer', estado: 'no-evaluable', detalle: 'No hay cambios activos que deshacer' })
  }
  return revisiones
}

export async function ofrecerDescarga(contexto: ContextoDia): Promise<Comprobacion[]> {
  const rutina = await rutinaActiva()
  if (!rutina || rutina.calibracion) return []
  const ajustes = await leerAjustes()
  const deshacer = contexto.eventos.some(evento => evento.tipo === 'decision' && evento.valor === 'deshacer')
  if (deshacer && ajustes.semanaSuave === contexto.lunes) {
    await guardarAjustes({ semanaSuave: null, suavePospuesta: contexto.lunes })
    return [comprobar('descarga.deshacer', (await leerAjustes()).semanaSuave == null, 'Vuelta a lo normal desde Ajustes')]
  }
  const propuesta = propuestaDescarga({
    hoy: contexto.fecha, sesiones: await sesionesHechas(), ejerciciosRutina: rutina.dias.flatMap(dia => dia.bloques.map(bloque => bloque.ejercicio)),
    semanaSuave: ajustes.semanaSuave ?? null, pospuesta: ajustes.suavePospuesta ?? null, nombre: nombreEjercicio,
  })
  if (!propuesta) return []
  if (contexto.decision === 'aceptar') {
    await guardarAjustes({ semanaSuave: contexto.lunes, suavePospuesta: null })
    return [comprobar('descarga.aceptar', (await leerAjustes()).semanaSuave === contexto.lunes, propuesta.motivo)]
  }
  await guardarAjustes({ suavePospuesta: contexto.lunes })
  return [comprobar('descarga.posponer', (await leerAjustes()).suavePospuesta === contexto.lunes, propuesta.motivo)]
}

export async function cerrarCalibracion(contexto: ContextoDia): Promise<Comprobacion[]> {
  const rutina = await rutinaActiva()
  if (!rutina?.calibracion || contexto.decision !== 'aceptar') return []
  const letras = await letrasHechasDeRutina(rutina.id)
  if (!rutina.dias.filter(dia => !dia.opcional).every(dia => letras.has(dia.letra))) return []
  const perfil = (await leerPerfil())!
  const propuesta = rutinaDefinitiva(rutina, {
    perfil, tiempos: tiemposReales(await sesionesHechasDeRutina(rutina.id)), compuesto: id => ejercicio(id)?.mecanica === 'compound',
  })
  const nueva = await activarRutina(propuesta)
  return [comprobar('calibracion.definitiva', nueva !== rutina.id && !(await rutinaActiva())?.calibracion, 'Todas las letras completadas; propuesta real aceptada')]
}
