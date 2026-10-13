// Crear y guardar un entreno en curso a partir de la rutina activa (o uno libre).
import { db } from '../../../datos/db'
import { gimnasioActivo, leerPerfil } from '../../../datos/repos'
import { sugerenciasDia } from '../../../datos/consultas'
import { crearSesion } from '../../../dominio/sesion'
import { hoyISO } from '../../../dominio/fechas'
import type { Sesion } from '../../../datos/tipos'

export async function iniciarEntreno(o: { letra?: string; version?: 'normal' | 'corta'; horaLimite?: string; libre?: boolean }): Promise<number> {
  const ya = await db.sesiones.where('estado').equals('curso').first()
  if (ya?.id) return ya.id
  const g = await gimnasioActivo()
  const perfil = await leerPerfil()
  const r = await db.rutinas.filter(x => x.activa).last()
  const horaLimite = o.horaLimite ?? (perfil ? perfil.horaLimite[perfil.transporte] : undefined)
  let s: Sesion
  if (o.libre || !r) {
    s = { fecha: hoyISO(), rutinaId: r?.id ?? null, letra: 'L', nombre: 'Entreno libre', gimnasioId: g?.id ?? null, inicio: Date.now(), horaLimite, version: 'normal', estado: 'curso', calibracion: false, ejercicios: [] }
  } else {
    const dia = r.dias.find(d => d.letra === o.letra) ?? r.dias[0]!
    const sug = await sugerenciasDia(dia, g)
    s = crearSesion(dia, {
      rutinaId: r.id ?? null, gimnasioId: g?.id ?? null, version: o.version ?? 'normal', horaLimite, calibracion: r.calibracion,
      sugerencias: new Map([...sug].map(([k, v]) => [k, { peso: v.peso, reps: v.reps }])),
    })
  }
  return (await db.sesiones.add(s)) as number
}
