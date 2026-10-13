// Lecturas en vivo de la base de datos local para las pantallas.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../datos/db'
import { ajustesPorDefecto, perfilPorDefecto } from '../datos/repos'
import type { Ajustes, Gimnasio, MarcaEjercicio, Perfil, Rutina, Sesion } from '../datos/tipos'

export function usePerfil(): Perfil {
  return useLiveQuery(() => db.perfil.get('yo'), []) ?? perfilPorDefecto()
}

export function useAjustes(): Ajustes {
  const a = useLiveQuery(() => db.ajustes.get('app'), [])
  return a ? { ...ajustesPorDefecto(), ...a, noti: { ...ajustesPorDefecto().noti, ...a.noti } } : ajustesPorDefecto()
}

export function useGimnasios(): Gimnasio[] {
  return useLiveQuery(() => db.gimnasios.toArray(), []) ?? []
}

export function useGimnasio(): Gimnasio | undefined {
  return useLiveQuery(async () => {
    const a = await db.ajustes.get('app')
    if (a?.gimnasioActivo != null) {
      const g = await db.gimnasios.get(a.gimnasioActivo)
      if (g) return g
    }
    return db.gimnasios.toCollection().first()
  }, [])
}

export function useRutina(): Rutina | undefined | null {
  // undefined = cargando · null = no hay
  const r = useLiveQuery(async () => (await db.rutinas.filter(x => x.activa).last()) ?? null, [])
  return r
}

export function useSesionEnCurso(): Sesion | undefined | null {
  return useLiveQuery(async () => (await db.sesiones.where('estado').equals('curso').last()) ?? null, [])
}

export function useMarcas(): Map<string, MarcaEjercicio> {
  const lista = useLiveQuery(() => db.marcas.toArray(), []) ?? []
  return new Map(lista.map(m => [m.id, m]))
}
