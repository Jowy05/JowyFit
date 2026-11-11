import { db } from '../../../src/datos/db'
import { ejercicio, hayEn } from '../../../src/catalogo/catalogo'
import type { Catalogo } from '../../../src/catalogo/tipos'
import type { Gimnasio, Guardado, Perfil, Sesion } from '../../../src/datos/tipos'
import { guardarSesion, apuntarHecha, terminarEntreno, descartarEntreno } from '../../../src/datos/acciones/entreno'
import { historialDe, sugerenciaPara } from '../../../src/datos/consultas'
import { tipoRegistro } from '../../../src/catalogo/clasificacion'
import { alternativasDe, duracionDia, patronGenerador } from '../../../src/dominio/generador'
import { ZONA_DE_PATRON } from '../../../src/dominio/volumen'
import { pesosPara } from '../../../src/dominio/pesos'
import { opcionesOcupado, sustituir } from '../../../src/dominio/sesion'
import type { ContextoDia, PlanSesion, ResultadoSesion } from '../tipos'
import { fijarMomento } from './entorno'

export async function aplicarOcupado(sesion: Guardado<Sesion>, contexto: ContextoDia, gimnasio: Gimnasio, perfil: Perfil, catalogo: Catalogo): Promise<Guardado<Sesion>> {
  const eventos = contexto.eventos.filter(evento => evento.tipo === 'ocupado')
  for (const evento of eventos) {
    const indice = evento.ejercicio === 'primero' ? 0 : sesion.ejercicios.findIndex(elemento => elemento.ejercicio === evento.ejercicio)
    const actual = sesion.ejercicios[indice]
    if (!actual) continue
    const marcas = new Map((await db.marcas.toArray()).map(marca => [marca.id, marca]))
    const rutina = sesion.rutinaId ? await db.rutinas.get(sesion.rutinaId) : undefined
    const entrada = { perfil, gimnasio, marcas, ejercicios: catalogo.ejercicios }
    const bloque = rutina?.dias.flatMap(dia => dia.bloques).find(elemento => elemento.uid === actual.uid)
    const alternativas = bloque?.alternativas.length ? bloque.alternativas : alternativasDe(actual.planificado, entrada)
    const opciones = opcionesOcupado(actual, alternativas, new Set(sesion.ejercicios.filter((_, posicion) => posicion !== indice).map(elemento => elemento.ejercicio)),
      id => { const candidato = ejercicio(id); return !!candidato && !marcas.get(id)?.duele && hayEn(candidato, new Set(gimnasio.material)) },
      () => alternativasDe(actual.ejercicio, entrada))
    const otra = opciones.find(id => id !== actual.ejercicio)
    if (!otra) continue
    const sugerencia = await sugerenciaPara(otra, actual, gimnasio, sesion.id)
    sesion = { ...sustituir(sesion, indice, otra, 'ocupado', sugerencia, tipoRegistro(ejercicio(otra)!)), id: sesion.id }
    await guardarSesion(sesion)
  }
  return sesion
}

export async function prescripcion(sesion: Guardado<Sesion>, gimnasio: Gimnasio): Promise<PlanSesion> {
  const ejercicios: PlanSesion['ejercicios'] = []
  for (const [indice, elemento] of sesion.ejercicios.entries()) {
    const ficha = ejercicio(elemento.ejercicio)
    if (!ficha) throw new Error(`Ejercicio fuera de catálogo: ${elemento.ejercicio}`)
    const historia = await historialDe(elemento.ejercicio, sesion.id)
    const ultima = historia[0]?.series.find(serie => serie.hecha && !serie.calentamiento)
    const peso = elemento.series[0]?.peso ?? null
    const zona = ZONA_DE_PATRON[patronGenerador(ficha)]
    ejercicios.push({
      id: `bloque-${indice}`, ejercicio: elemento.ejercicio, registro: elemento.registro,
      series: elemento.series.length, minimo: elemento.repsMin, maximo: elemento.repsMax, esfuerzo: elemento.rpe, descanso: elemento.descanso,
      peso, pesos: pesosPara(ficha.material, elemento.registro, gimnasio), material: ficha.material ? [ficha.material] : [], zonas: zona ? [zona] : [],
      accion: !ultima ? 'primera' : peso != null && ultima.peso != null && peso > ultima.peso ? 'subir' : peso != null && ultima.peso != null && peso < ultima.peso ? 'bajar' : 'mantener',
    })
  }
  return { letra: sesion.letra, ejercicios, minutosEstimados: duracionDia(sesion.ejercicios.map(elemento => ({ ...elemento, series: elemento.series.length, alternativas: [] })), false) / 60 }
}

export async function registrarResultado(sesion: Guardado<Sesion>, resultado: ResultadoSesion): Promise<void> {
  if (resultado.estado === 'abandonada') {
    await descartarEntreno(sesion.id)
    return
  }
  const hechas = resultado.ejercicios.flatMap(elemento => elemento.series).filter(serie => serie.hecha).length
  const intervalo = Math.max(1000, resultado.minutos * 60_000 / Math.max(1, hechas))
  let momento = sesion.inicio
  for (const [indice, elemento] of resultado.ejercicios.entries()) {
    if (elemento.ejercicio !== sesion.ejercicios[indice]?.ejercicio) throw new Error('Resultado ajeno a la sesión iniciada')
    const previas = (await historialDe(elemento.ejercicio, sesion.id)).flatMap(hecho => hecho.series)
    for (const serie of elemento.series.filter(candidata => candidata.hecha)) {
      momento += intervalo
      fijarMomento(momento)
      const actual = await db.sesiones.get(sesion.id)
      if (!actual) throw new Error('Sesión desaparecida antes de registrar')
      await apuntarHecha(actual, indice, { peso: serie.peso, reps: serie.repeticiones, segundos: serie.segundos, rpe: serie.esfuerzo }, previas)
    }
  }
  const actual = await db.sesiones.get(sesion.id)
  if (!actual) throw new Error('Sesión desaparecida al finalizar')
  await terminarEntreno(actual, sesion.inicio + resultado.minutos * 60_000, { minutosReales: resultado.minutos })
}
