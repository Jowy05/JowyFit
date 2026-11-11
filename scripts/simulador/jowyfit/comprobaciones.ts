// Reglas que se comprueban al cerrar cada día sobre la sesión que ha preparado la app. Sin acceso a la base:
// reciben lo ya leído y devuelven el veredicto.
import { ejercicio, hayEn } from '../../../src/catalogo/catalogo'
import type { Perfil, Sesion } from '../../../src/datos/tipos'
import { rpeMaximo } from '../../../src/dominio/objetivos'
import { restricciones } from '../../../src/dominio/salud'
import { comprobar } from '../observador'
import type { Comprobacion } from '../tipos'

type Salud = ReturnType<typeof restricciones>

export function bloqueoPorUrgencia(hayRutina: boolean, sesiones: number): Comprobacion {
  return comprobar('salud.bloqueo', !hayRutina && sesiones === 0, 'Sin rutina ni sesiones para la urgencia de pecho')
}

/** `deshechos`: «uid|ejercicio» recuperados con «Deshacer» en una revisión; los eligió el usuario aunque sus molestias los quitarían. */
export function restriccionesRespetadas(sesion: Sesion, salud: Salud, deshechos: Set<string>): Comprobacion {
  const invalidos = sesion.ejercicios.flatMap(elemento => {
    const ficha = ejercicio(elemento.ejercicio)
    if (!ficha) return [`${elemento.ejercicio}: desconocido`]
    if (deshechos.has(`${elemento.uid}|${elemento.ejercicio}`)) return []
    const motivo = salud.fuera(ficha)
    return motivo ? [`${elemento.ejercicio}: ${motivo}`] : []
  })
  return comprobar('aplicacion.restricciones', !invalidos.length, invalidos.length ? invalidos.join('; ') : 'Ejercicios coherentes con los filtros vigentes del perfil')
}

export function materialDisponible(sesion: Sesion, material: string[]): Comprobacion {
  const hay = new Set(material)
  const faltan = sesion.ejercicios.filter(elemento => { const ficha = ejercicio(elemento.ejercicio); return !ficha || !hayEn(ficha, hay) }).map(elemento => elemento.ejercicio)
  return comprobar('sesion.accesorios', !faltan.length, faltan.length ? faltan.join(', ') : 'Material y accesorios disponibles según catálogo real')
}

export function esfuerzoPermitido(sesion: Sesion, perfil: Perfil, salud: Salud): Comprobacion {
  const limite = Math.min(rpeMaximo(perfil), salud.rpeMax ?? 10)
  const excesos = sesion.ejercicios.filter(elemento => elemento.rpe > limite).map(elemento => `${elemento.ejercicio}: ${elemento.rpe} > ${limite}`)
  return comprobar('sesion.esfuerzo', !excesos.length, excesos.length ? excesos.join('; ') : `Esfuerzo dentro del máximo vigente: ${limite}`)
}

export function descargaAplicada(sesion: Sesion): Comprobacion | null {
  return sesion.suave ? comprobar('descarga.aplicada', sesion.ejercicios.every(elemento => elemento.rpe <= 7), 'Sesión suave con esfuerzo máximo 7') : null
}

export function sesionGuardada(guardada: Sesion | undefined, descartada: boolean, fecha: string): Comprobacion {
  const correcto = descartada ? !guardada : guardada?.estado === 'hecha' && guardada.fecha === fecha
  return comprobar('sesion.persistencia', correcto, descartada ? 'Abandono descartado sin avanzar el historial' : 'Sesión terminada mediante la acción real')
}

export function historialCoherente(hechas: number, esperadas: number): Comprobacion {
  return comprobar('historial.conteo', hechas === esperadas, 'Solo una sesión terminada aumenta el historial')
}
