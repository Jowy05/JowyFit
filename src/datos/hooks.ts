// Lecturas en vivo de la base de datos local para las pantallas.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { ajustesPorDefecto, gimnasioActivo, perfilPorDefecto, rutinaActiva } from './repos'
import type { Ajustes, Gimnasio, MarcaEjercicio, Perfil, Rutina, Sesion } from './tipos'

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

export function useGimnasios(): Gimnasio[] {
  return useLiveQuery(() => db.gimnasios.toArray(), []) ?? []
}

export function useGimnasio(): Gimnasio | undefined {
  return useLiveQuery(gimnasioActivo, [])
}

/** undefined = cargando · null = no hay */
export function useRutina(): Rutina | undefined | null {
  return useLiveQuery(async () => (await rutinaActiva()) ?? null, [])
}

export function useSesionEnCurso(): Sesion | undefined | null {
  return useLiveQuery(async () => (await db.sesiones.where('estado').equals('curso').last()) ?? null, [])
}

export function useMarcas(): Map<string, MarcaEjercicio> {
  const lista = useLiveQuery(() => db.marcas.toArray(), [])
  // El mapa solo cambia cuando cambian las marcas (si no, los useMemo que dependen de él se recalculan en cada render).
  return useMemo(() => new Map((lista ?? []).map(m => [m.id, m])), [lista])
}
