// Lecturas en vivo de la base de datos local para las pantallas.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { ajustesPorDefecto, gimnasioActivo, perfilPorDefecto, rutinaActiva } from './repos'
import { leerMediciones, sesionesEntre } from './consultas'
import { colaDe, DIAS_COLA, enCola, letrasCola, type Cola } from '../dominio/cola'
import { sumarDias } from '../dominio/fechas'
import type { Ajustes, Gimnasio, Guardado, MarcaEjercicio, Medicion, Perfil, Rutina, Sesion } from './tipos'

/**
 * Perfil (o el de por defecto mientras carga). El de por defecto se crea una sola vez por pantalla:
 * así no cambia en cada render y no relanza las consultas que dependen de él.
 */
export function usePerfil(): Perfil {
  const [defecto] = useState(perfilPorDefecto)
  return useLiveQuery(() => db.perfil.get('yo'), []) ?? defecto
}

/** Perfil guardado: undefined mientras carga (para no rellenar formularios con valores por defecto). */
export function usePerfilCargado(): Perfil | undefined {
  const p = useLiveQuery(async () => (await db.perfil.get('yo')) ?? null, [])
  const [defecto] = useState(perfilPorDefecto)
  return p === undefined ? undefined : p ?? defecto
}

export function useAjustes(): Ajustes {
  const a = useLiveQuery(() => db.ajustes.get('app'), [])
  // Mismo objeto mientras no cambien los ajustes: se puede usar como dependencia.
  return useMemo(() => (a ? { ...ajustesPorDefecto(), ...a, noti: { ...ajustesPorDefecto().noti, ...a.noti } } : ajustesPorDefecto()), [a])
}

export function useGimnasios(): Guardado<Gimnasio>[] {
  return useLiveQuery(() => db.gimnasios.toArray(), []) ?? []
}

export function useGimnasio(): Guardado<Gimnasio> | undefined {
  return useLiveQuery(gimnasioActivo, [])
}

/** undefined = cargando · null = no hay */
export function useRutina(): Guardado<Rutina> | undefined | null {
  return useLiveQuery(async () => (await rutinaActiva()) ?? null, [])
}

/** La cola de hoy si la rutina va en orden; null si va por días o no hay rutina; undefined mientras carga. */
export function useCola(hoy: string): Cola | null | undefined {
  return useLiveQuery(async () => {
    const [p, r] = await Promise.all([db.perfil.get('yo'), rutinaActiva()])
    if (!p || !r || !enCola(p)) return null
    const sesiones = await sesionesEntre(sumarDias(hoy, -DIAS_COLA), hoy)
    return colaDe(r, sesiones, hoy, letrasCola(r).length)
  }, [hoy])
}

export function useSesionEnCurso(): Guardado<Sesion> | undefined | null {
  return useLiveQuery(async () => (await db.sesiones.where('estado').equals('curso').last()) ?? null, [])
}

/** Todas las mediciones, sin ordenar; undefined mientras carga. */
export function useMediciones(): Guardado<Medicion>[] | undefined {
  return useLiveQuery(leerMediciones, [])
}

export function useMarcas(): Map<string, MarcaEjercicio> {
  const lista = useLiveQuery(() => db.marcas.toArray(), [])
  // El mapa solo cambia cuando cambian las marcas (si no, los useMemo que dependen de él se recalculan en cada render).
  return useMemo(() => new Map((lista ?? []).map(m => [m.id, m])), [lista])
}
