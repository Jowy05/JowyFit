// Cada fase del día contra JowyFit: alta, revisiones y descargas, inicio de la sesión con las acciones reales,
// registro de lo que hizo la persona virtual y comprobaciones al cerrar el día.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { IDBFactory } from 'fake-indexeddb'
import { db } from '../../../src/datos/db'
import type { Catalogo } from '../../../src/catalogo/tipos'
import type { Gimnasio, Guardado, Sesion } from '../../../src/datos/tipos'
import { usarCatalogo, usarPropios } from '../../../src/catalogo/catalogo'
import { completarAlta } from '../../../src/datos/acciones/alta'
import { iniciarEntreno, descartarEntreno } from '../../../src/datos/acciones/entreno'
import { gimnasioNuevo, guardarAjustes, leerPerfil, rutinaActiva } from '../../../src/datos/repos'
import { sesionesHechasDeRutina } from '../../../src/datos/consultas'
import { colaDe } from '../../../src/dominio/cola'
import { estadoSemana } from '../../../src/dominio/semana'
import { restricciones } from '../../../src/dominio/salud'
import { comprobar } from '../observador'
import type { Comprobacion, Configuracion, ContextoDia, Informe, PlanSesion, ResultadoSesion } from '../tipos'
import { fijarDia, restaurarReloj } from './entorno'
import { perfilSintetico } from './perfil'
import { revisar, ofrecerDescarga, cerrarCalibracion } from './ciclo'
import { aplicarOcupado, prescripcion, registrarResultado } from './sesiones'
import { bloqueoPorUrgencia, descargaAplicada, esfuerzoPermitido, historialCoherente, materialDisponible, restriccionesRespetadas, sesionGuardada } from './comprobaciones'

type EstadoDia = {
  sesion: Guardado<Sesion> | null
  plan: PlanSesion | null
  comprobaciones: Comprobacion[]
  sesionesAntes: number
  registrada: boolean
  descartada: boolean
}

export type Recorrido = {
  configuracion: Configuracion
  gimnasio: Guardado<Gimnasio>
  segundoGimnasio: boolean
  dia: EstadoDia
}

function diaNuevo(comprobaciones: Comprobacion[] = []): EstadoDia {
  return { sesion: null, plan: null, comprobaciones, sesionesAntes: 0, registrada: false, descartada: false }
}

let aplicacionCargada: { catalogo: Catalogo } & Informe['aplicacion'] | null = null

function aplicacionReal() {
  if (!aplicacionCargada) {
    const bytes = readFileSync(new URL('../../../public/repdb/catalogo.json', import.meta.url))
    const catalogo = JSON.parse(bytes.toString('utf8')) as Catalogo
    if (!catalogo.ejercicios?.length) throw new Error('Catálogo real vacío o no disponible')
    const version = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { version: string }).version
    aplicacionCargada = { catalogo, version, huellaCatalogo: createHash('sha256').update(bytes).digest('hex') }
  }
  return aplicacionCargada
}

export function identidad(): Informe['aplicacion'] {
  const { version, huellaCatalogo } = aplicacionReal()
  return { version, huellaCatalogo }
}

function entornoAislado(): boolean {
  return db.name === 'jowyfit-simulador' && globalThis.indexedDB instanceof IDBFactory
}

export async function iniciar(configuracion: Configuracion): Promise<Recorrido> {
  if (!entornoAislado()) throw new Error('Falta el entorno aislado del simulador; no se abrirá ninguna base')
  const { catalogo } = aplicacionReal()
  const persona = configuracion.escenario.persona
  fijarDia(configuracion.inicio)
  await db.delete()
  await db.open()
  usarPropios([])
  usarCatalogo(catalogo)
  const creado = await completarAlta({
    gimnasio: { ...gimnasioNuevo('Gimnasio sintético'), material: [...persona.material] },
    perfil: perfilSintetico(configuracion),
    medicion: { fecha: configuracion.inicio, origen: 'manual', pesoKg: (persona.imc ?? 24) * 1.75 ** 2 },
    medicionCambiada: true, hoy: configuracion.inicio,
  })
  const bloqueoEsperado = persona.urgencias.length > 0
  const comprobaciones = [comprobar('alta.bloqueo', bloqueoEsperado ? creado.rutina === null : creado.rutina !== null, bloqueoEsperado ? 'Urgencia de pecho: alta sin rutina' : 'Alta sin urgencias: rutina disponible')]
  if (persona.semanasPosparto != null) comprobaciones.push({ regla: 'requisito.posparto', estado: 'pendiente', detalle: 'El perfil actual solo distingue embarazo/posparto, no semanas ni autorización clínica. Se evalúan sus filtros actuales, no el bloqueo antiguo propuesto.' })
  if (persona.pruebaSillaSegundos != null) comprobaciones.push({ regla: 'requisito.prueba-silla', estado: 'pendiente', detalle: 'No existe un campo para el test de silla; el perfil sintético acepta modo mayor.' })
  await guardarAjustes({ entrenosASalud: false, copiaAuto: false, calentamiento: false })
  return { configuracion, gimnasio: (await db.gimnasios.toArray())[0]!, segundoGimnasio: false, dia: diaNuevo(comprobaciones) }
}

async function cambiarMaterial(recorrido: Recorrido, material: string[]): Promise<void> {
  if (recorrido.configuracion.escenario.otroGimnasio && !recorrido.segundoGimnasio) {
    const nuevo = { ...gimnasioNuevo('Segundo gimnasio sintético'), material: [...material] }
    recorrido.gimnasio = { ...nuevo, id: await db.gimnasios.add(nuevo) }
    recorrido.segundoGimnasio = true
  } else {
    recorrido.gimnasio = { ...recorrido.gimnasio, material: [...material] }
    await db.gimnasios.put(recorrido.gimnasio)
  }
}

export async function prepararDia(recorrido: Recorrido, contexto: ContextoDia): Promise<void> {
  fijarDia(contexto.fecha)
  // Las comprobaciones del alta se cuentan en el primer día.
  recorrido.dia = diaNuevo(contexto.indice === 0 ? recorrido.dia.comprobaciones : [])
  recorrido.dia.sesionesAntes = await db.sesiones.where('estado').equals('hecha').count()
  if (contexto.eventos.some(evento => evento.tipo === 'material')) await cambiarMaterial(recorrido, contexto.material)
  recorrido.dia.comprobaciones.push(...await revisar(contexto), ...await ofrecerDescarga(contexto))
}

export async function planificar(recorrido: Recorrido, contexto: ContextoDia): Promise<PlanSesion | null> {
  const rutina = await rutinaActiva()
  if (!rutina) return null
  const perfil = (await leerPerfil())!
  const historia = await sesionesHechasDeRutina(rutina.id)
  const opcional = rutina.dias.find(dia => dia.opcional && dia.dia === ((new Date(`${contexto.fecha}T12:00:00`).getDay() + 6) % 7))
  const dia = opcional ?? (perfil.modoRutina === 'cola'
    ? colaDe(rutina, historia, contexto.fecha, perfil.diasFijos.length)?.siguiente
    : estadoSemana(rutina, historia, contexto.fecha).find(dia => dia.fecha === contexto.fecha)?.dia)
  if (!dia) return null
  const { gimnasio, dia: estado } = recorrido
  const corta = contexto.eventos.some(evento => evento.tipo === 'sesion' && evento.valor === 'corta')
  const id = await iniciarEntreno({ letra: dia.letra, version: corta ? 'corta' : 'normal', gimnasioId: gimnasio.id })
  const creada = await db.sesiones.get(id)
  if (!creada) throw new Error('La acción de inicio no ha persistido la sesión')
  const sesion = await aplicarOcupado(creada, contexto, gimnasio, perfil, aplicacionReal().catalogo)
  estado.sesion = sesion
  estado.plan = await prescripcion(sesion, gimnasio)
  estado.comprobaciones.push(comprobar('sesion.gimnasio', sesion.gimnasioId === gimnasio.id, 'La sesión conserva el gimnasio elegido'))
  if (opcional) estado.comprobaciones.push({ regla: 'sesion.opcional', estado: 'aprobada', detalle: 'La acción real decide el contenido del día opcional según el historial' })
  if (contexto.eventos.some(evento => evento.tipo === 'ocupado')) {
    estado.comprobaciones.push({ regla: 'sesion.ocupado', estado: sesion.ejercicios.some(elemento => elemento.motivo === 'ocupado') ? 'aprobada' : 'no-evaluable', detalle: 'Alternativa mediante opcionesOcupado y sustituir; si no hay alternativa se conserva el ejercicio' })
  }
  return estado.plan
}

export async function registrar(recorrido: Recorrido, contexto: ContextoDia, resultado: ResultadoSesion): Promise<void> {
  const estado = recorrido.dia
  if (!estado.sesion) throw new Error('No hay sesión real iniciada')
  estado.descartada = resultado.estado === 'abandonada'
  await registrarResultado(estado.sesion, resultado)
  estado.registrada = true
  if (!estado.descartada) estado.comprobaciones.push(...await cerrarCalibracion(contexto))
}

export async function cerrarDia(recorrido: Recorrido, contexto: ContextoDia): Promise<Comprobacion[]> {
  const { dia: estado, gimnasio } = recorrido
  const resultado = estado.comprobaciones
  const perfil = (await leerPerfil())!
  if (perfil.urgencias?.length) resultado.push(bloqueoPorUrgencia(!!await rutinaActiva(), await db.sesiones.count()))
  const sesion = estado.sesion
  if (estado.plan && sesion) {
    const salud = restricciones(perfil)
    const deshechos = new Set((await db.revisiones.toArray()).flatMap(revision => revision.cambios).filter(cambio => cambio.deshecho).map(cambio => `${cambio.uid}|${cambio.antes.ejercicio}`))
    resultado.push(restriccionesRespetadas(sesion, salud, deshechos), materialDisponible(sesion, gimnasio.material), esfuerzoPermitido(sesion, perfil, salud))
    const descarga = descargaAplicada(sesion)
    if (descarga) resultado.push(descarga)
    if (estado.registrada) {
      resultado.push(sesionGuardada(await db.sesiones.get(sesion.id), estado.descartada, contexto.fecha))
    } else {
      await descartarEntreno(sesion.id)
      resultado.push({ regla: 'sesion.rechazada', estado: 'no-evaluable', detalle: 'El motor rechazó el plan; se elimina la sesión no realizada para continuar el recorrido' })
    }
  }
  const esperadas = estado.sesionesAntes + (estado.registrada && !estado.descartada ? 1 : 0)
  resultado.push(historialCoherente(await db.sesiones.where('estado').equals('hecha').count(), esperadas))
  return resultado
}

/** Borra la base temporal y devuelve el reloj real; se llama siempre, también tras un error. */
export async function finalizar(): Promise<void> {
  try { if (entornoAislado()) await db.delete() } finally { restaurarReloj() }
}
