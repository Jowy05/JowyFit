import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { IDBFactory } from 'fake-indexeddb'
import { db } from '../../../src/datos/db'
import type { Catalogo } from '../../../src/catalogo/tipos'
import type { Gimnasio, Guardado, Sesion } from '../../../src/datos/tipos'
import { usarCatalogo, usarPropios, ejercicio, hayEn } from '../../../src/catalogo/catalogo'
import { completarAlta } from '../../../src/datos/acciones/alta'
import { iniciarEntreno, descartarEntreno } from '../../../src/datos/acciones/entreno'
import { gimnasioNuevo, guardarAjustes, leerPerfil, rutinaActiva } from '../../../src/datos/repos'
import { sesionesHechasDeRutina } from '../../../src/datos/consultas'
import { colaDe } from '../../../src/dominio/cola'
import { estadoSemana } from '../../../src/dominio/semana'
import { restricciones } from '../../../src/dominio/salud'
import { rpeMaximo } from '../../../src/dominio/objetivos'
import type { Adaptador, Comprobacion, Configuracion, PlanSesion } from '../tipos'
import { comprobar } from '../observador'
import { fijarDia, restaurarReloj } from './entorno'
import { perfilSintetico, type EscenarioJowyFit } from './perfiles'
import { revisar, ofrecerDescarga, cerrarCalibracion } from './ciclo'
import { aplicarOcupado, prescripcion, registrarResultado } from './sesiones'

const rutaCatalogo = new URL('../../../public/repdb/catalogo.json', import.meta.url)

export function crearAdaptador(): Adaptador {
  const bytes = readFileSync(rutaCatalogo)
  const catalogo = JSON.parse(bytes.toString('utf8')) as Catalogo
  if (!catalogo.ejercicios?.length) throw new Error('Catálogo real vacío o no disponible')
  const version = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version as string
  let configuracion: Configuracion
  let gimnasio: Guardado<Gimnasio>
  let sesion: Guardado<Sesion> | null = null
  let plan: PlanSesion | null = null
  let comprobaciones: Comprobacion[] = []
  let sesionesAntes = 0
  let descartar = false
  let registrado = false
  let segundoGimnasio = false
  let creadaBase = false

  return {
    identidad: { nombre: 'JowyFit: acciones y dominio reales con IndexedDB temporal', version, objetivo: 'aplicacion', huellaCatalogo: createHash('sha256').update(bytes).digest('hex') },
    async iniciar(entrada) {
      if (db.name !== 'jowyfit-simulador' || !(globalThis.indexedDB instanceof IDBFactory)) throw new Error('Falta el entorno aislado del simulador; no se abrirá ninguna base')
      configuracion = entrada
      fijarDia(entrada.inicio)
      await db.delete()
      await db.open()
      creadaBase = true
      usarPropios([])
      usarCatalogo(catalogo)
      const perfil = perfilSintetico(entrada)
      const creado = await completarAlta({
        gimnasio: { ...gimnasioNuevo('Gimnasio sintético'), material: [...entrada.escenario.persona.material] },
        perfil, medicion: { fecha: entrada.inicio, origen: 'manual', pesoKg: (entrada.escenario.persona.imc ?? 24) * 1.75 ** 2 },
        medicionCambiada: true, hoy: entrada.inicio,
      })
      gimnasio = (await db.gimnasios.toArray())[0]!
      const bloqueoEsperado = entrada.escenario.persona.restricciones.includes('dolorPecho')
      comprobaciones = [comprobar('alta.bloqueo', bloqueoEsperado ? creado.rutina === null : creado.rutina !== null, bloqueoEsperado ? 'Urgencia de pecho: alta sin rutina' : 'Alta sin urgencias: rutina disponible')]
      if (entrada.escenario.persona.semanasPosparto != null) comprobaciones.push({ regla: 'requisito.posparto', estado: 'pendiente', detalle: 'El perfil actual solo distingue embarazo/posparto, no semanas ni autorización clínica. Se evalúan sus filtros actuales, no el bloqueo antiguo propuesto.' })
      if (entrada.escenario.persona.pruebaSillaSegundos != null) comprobaciones.push({ regla: 'requisito.prueba-silla', estado: 'pendiente', detalle: 'No existe un campo para el test de silla; el perfil sintético acepta modo mayor.' })
      await guardarAjustes({ entrenosASalud: false, copiaAuto: false, calentamiento: false })
    },
    async prepararDia(contexto) {
      fijarDia(contexto.fecha)
      if (contexto.indice > 0) comprobaciones = []
      sesion = null
      plan = null
      registrado = false
      descartar = false
      sesionesAntes = await db.sesiones.where('estado').equals('hecha').count()
      if (contexto.eventos.some(evento => evento.tipo === 'material')) {
        if ((configuracion.escenario as EscenarioJowyFit).jowyfit?.otroGimnasio && !segundoGimnasio) {
          const nuevo = { ...gimnasioNuevo('Segundo gimnasio sintético'), material: [...contexto.material] }
          const id = await db.gimnasios.add(nuevo)
          gimnasio = { ...nuevo, id }
          segundoGimnasio = true
        } else {
          gimnasio = { ...gimnasio, material: [...contexto.material] }
          await db.gimnasios.put(gimnasio)
        }
      }
      comprobaciones.push(...await revisar(contexto), ...await ofrecerDescarga(contexto))
    },
    async planificar(contexto) {
      const rutina = await rutinaActiva()
      if (!rutina) return null
      const perfil = (await leerPerfil())!
      const historia = await sesionesHechasDeRutina(rutina.id)
      const opcional = rutina.dias.find(dia => dia.opcional && dia.dia === ((new Date(`${contexto.fecha}T12:00:00`).getDay() + 6) % 7))
      const dia = opcional ?? (perfil.modoRutina === 'cola'
        ? colaDe(rutina, historia, contexto.fecha, perfil.diasFijos.length)?.siguiente
        : estadoSemana(rutina, historia, contexto.fecha).find(dia => dia.fecha === contexto.fecha)?.dia)
      if (!dia) return null
      const corta = contexto.eventos.some(evento => evento.tipo === 'sesion' && evento.valor === 'corta')
      const id = await iniciarEntreno({ letra: dia.letra, version: corta ? 'corta' : 'normal', gimnasioId: gimnasio.id })
      const creada = await db.sesiones.get(id)
      if (!creada) throw new Error('La acción de inicio no ha persistido la sesión')
      sesion = await aplicarOcupado(creada, contexto, gimnasio, perfil, catalogo)
      plan = await prescripcion(sesion, gimnasio)
      comprobaciones.push(comprobar('sesion.gimnasio', sesion.gimnasioId === gimnasio.id, 'La sesión conserva el gimnasio elegido'))
      if (opcional) comprobaciones.push({ regla: 'sesion.opcional', estado: 'aprobada', detalle: 'La acción real decide el contenido del día opcional según el historial' })
      if (contexto.eventos.some(evento => evento.tipo === 'ocupado')) comprobaciones.push({ regla: 'sesion.ocupado', estado: sesion.ejercicios.some(elemento => elemento.motivo === 'ocupado') ? 'aprobada' : 'no-evaluable', detalle: 'Alternativa mediante opcionesOcupado y sustituir; si no hay alternativa se conserva el ejercicio' })
      return plan
    },
    async registrar(contexto, resultado) {
      if (!sesion) throw new Error('No hay sesión real iniciada')
      descartar = resultado.estado === 'abandonada'
      await registrarResultado(sesion, resultado)
      registrado = true
      if (!descartar) comprobaciones.push(...await cerrarCalibracion(contexto))
    },
    async cerrarDia(contexto) {
      const perfil = (await leerPerfil())!
      const rutina = await rutinaActiva()
      if (perfil.urgencias?.length) comprobaciones.push(comprobar('salud.bloqueo', !rutina && (await db.sesiones.count()) === 0, 'Sin rutina ni sesiones para la urgencia de pecho'))
      if (plan && sesion) {
        const salud = restricciones(perfil)
        // Lo que el usuario recuperó con «Deshacer» en la revisión lo ha elegido él aunque sus molestias lo quitarían.
        const deshechos = new Set((await db.revisiones.toArray()).flatMap(revision => revision.cambios).filter(cambio => cambio.deshecho).map(cambio => `${cambio.uid}|${cambio.antes.ejercicio}`))
        const invalidos = sesion.ejercicios.flatMap(elemento => {
          const ficha = ejercicio(elemento.ejercicio)
          if (!ficha) return [`${elemento.ejercicio}: desconocido`]
          if (deshechos.has(`${elemento.uid}|${elemento.ejercicio}`)) return []
          const motivo = salud.fuera(ficha)
          return motivo ? [`${elemento.ejercicio}: ${motivo}`] : []
        })
        comprobaciones.push(comprobar('aplicacion.restricciones', !invalidos.length, invalidos.length ? invalidos.join('; ') : 'Ejercicios coherentes con los filtros vigentes del perfil'))
        const sinMaterial = sesion.ejercicios.filter(elemento => !hayEn(ejercicio(elemento.ejercicio)!, new Set(gimnasio.material))).map(elemento => elemento.ejercicio)
        comprobaciones.push(comprobar('sesion.accesorios', !sinMaterial.length, sinMaterial.length ? sinMaterial.join(', ') : 'Material y accesorios disponibles según catálogo real'))
        const limite = Math.min(rpeMaximo(perfil), salud.rpeMax ?? 10)
        const excesos = sesion.ejercicios.filter(elemento => elemento.rpe > limite).map(elemento => `${elemento.ejercicio}: ${elemento.rpe} > ${limite}`)
        comprobaciones.push(comprobar('sesion.esfuerzo', !excesos.length, excesos.length ? excesos.join('; ') : `Esfuerzo dentro del máximo vigente: ${limite}`))
        if (sesion.suave) comprobaciones.push(comprobar('descarga.aplicada', sesion.ejercicios.every(elemento => elemento.rpe <= 7), 'Sesión suave con esfuerzo máximo 7'))
        if (registrado) {
          const guardada = await db.sesiones.get(sesion.id)
          const correcto = descartar ? !guardada : guardada?.estado === 'hecha' && guardada.fecha === contexto.fecha
          comprobaciones.push(comprobar('sesion.persistencia', correcto, descartar ? 'Abandono descartado sin avanzar el historial' : 'Sesión terminada mediante la acción real'))
        } else {
          await descartarEntreno(sesion.id)
          comprobaciones.push({ regla: 'sesion.rechazada', estado: 'no-evaluable', detalle: 'El motor rechazó el plan; se elimina la sesión no realizada para continuar el recorrido' })
        }
      }
      const esperadas = sesionesAntes + (registrado && !descartar ? 1 : 0)
      comprobaciones.push(comprobar('historial.conteo', (await db.sesiones.where('estado').equals('hecha').count()) === esperadas, 'Solo una sesión terminada aumenta el historial'))
      return comprobaciones
    },
    async finalizar() {
      try { if (creadaBase) await db.delete() } finally { restaurarReloj() }
    },
  }
}
