// Navegación de la app: 5 pestañas, cada una con su pila de pantallas, hojas inferiores
// y pantallas completas (alta de usuario, entreno en curso). Sin dependencias: es un reducer.
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'

export type Pestana = 'ini' | 'rut' | 'com' | 'pro' | 'per'
export const PESTANAS: Pestana[] = ['ini', 'rut', 'com', 'pro', 'per']

export type Ruta = { p: string; d?: Record<string, unknown> }

export type EstadoNav = {
  pestana: Pestana
  pilas: Record<Pestana, Ruta[]>
  hoja: Ruta | null
  completa: Ruta | null
  /** Pantalla completa minimizada (el entreno sigue en curso y se ve la mini barra). */
  minimizada: Ruta | null
}

export const RAIZ: Record<Pestana, Ruta> = {
  ini: { p: 'ini' },
  rut: { p: 'rut' },
  com: { p: 'com' },
  pro: { p: 'pro-sem' },
  per: { p: 'per' },
}

export const estadoInicial = (): EstadoNav => ({
  pestana: 'ini',
  pilas: { ini: [RAIZ.ini], rut: [RAIZ.rut], com: [RAIZ.com], pro: [RAIZ.pro], per: [RAIZ.per] },
  hoja: null,
  completa: null,
  minimizada: null,
})

export type AccionNav =
  | { t: 'pestana'; pestana: Pestana }
  | { t: 'ir'; ruta: Ruta; pestana?: Pestana }
  | { t: 'reemplazar'; ruta: Ruta }
  | { t: 'atras' }
  | { t: 'hoja'; ruta: Ruta | null }
  | { t: 'completa'; ruta: Ruta | null }
  | { t: 'minimizar' }
  | { t: 'restaurar' }
  | { t: 'raiz'; pestana: Pestana }

export function reducirNav(s: EstadoNav, a: AccionNav): EstadoNav {
  switch (a.t) {
    case 'pestana': {
      // Tocar la pestaña activa vuelve a su raíz.
      if (a.pestana === s.pestana) return { ...s, hoja: null, pilas: { ...s.pilas, [a.pestana]: [RAIZ[a.pestana]] } }
      return { ...s, pestana: a.pestana, hoja: null }
    }
    case 'raiz':
      return { ...s, pestana: a.pestana, hoja: null, completa: null, pilas: { ...s.pilas, [a.pestana]: [RAIZ[a.pestana]] } }
    case 'ir': {
      const pestana = a.pestana ?? s.pestana
      return { ...s, pestana, hoja: null, pilas: { ...s.pilas, [pestana]: [...s.pilas[pestana], a.ruta] } }
    }
    case 'reemplazar': {
      const pila = s.pilas[s.pestana]
      return { ...s, hoja: null, pilas: { ...s.pilas, [s.pestana]: [...pila.slice(0, -1), a.ruta] } }
    }
    case 'atras': {
      if (s.hoja) return { ...s, hoja: null }
      if (s.completa) return s.completa.p === 'entreno' ? { ...s, completa: null, minimizada: s.completa } : { ...s, completa: null }
      const pila = s.pilas[s.pestana]
      if (pila.length > 1) return { ...s, pilas: { ...s.pilas, [s.pestana]: pila.slice(0, -1) } }
      if (s.pestana !== 'ini') return { ...s, pestana: 'ini' }
      return s
    }
    case 'hoja':
      return { ...s, hoja: a.ruta }
    case 'completa':
      return { ...s, hoja: null, completa: a.ruta, minimizada: a.ruta ? null : s.minimizada }
    case 'minimizar':
      return s.completa ? { ...s, completa: null, hoja: null, minimizada: s.completa } : s
    case 'restaurar':
      return s.minimizada ? { ...s, completa: s.minimizada, minimizada: null, hoja: null } : s
  }
}

/** ¿Queda algo a lo que volver con «atrás»? Si no, Android minimiza la app. */
export function puedeVolver(s: EstadoNav): boolean {
  return !!s.hoja || !!s.completa || s.pilas[s.pestana].length > 1 || s.pestana !== 'ini'
}

type Nav = {
  estado: EstadoNav
  ir: (p: string, d?: Record<string, unknown>, pestana?: Pestana) => void
  reemplazar: (p: string, d?: Record<string, unknown>) => void
  atras: () => void
  pestana: (t: Pestana) => void
  raiz: (t: Pestana) => void
  hoja: (p: string | null, d?: Record<string, unknown>) => void
  completa: (p: string | null, d?: Record<string, unknown>) => void
  minimizar: () => void
  restaurar: () => void
  actual: Ruta
}

const Ctx = createContext<Nav | null>(null)

export function ProveedorNav({ children, inicial }: { children: ReactNode; inicial?: EstadoNav }) {
  const [estado, d] = useReducer(reducirNav, inicial ?? estadoInicial())
  const ir = useCallback((p: string, datos?: Record<string, unknown>, pestana?: Pestana) => d({ t: 'ir', ruta: { p, d: datos }, pestana }), [])
  const reemplazar = useCallback((p: string, datos?: Record<string, unknown>) => d({ t: 'reemplazar', ruta: { p, d: datos } }), [])
  const atras = useCallback(() => d({ t: 'atras' }), [])
  const pestana = useCallback((t: Pestana) => d({ t: 'pestana', pestana: t }), [])
  const raiz = useCallback((t: Pestana) => d({ t: 'raiz', pestana: t }), [])
  const hoja = useCallback((p: string | null, datos?: Record<string, unknown>) => d({ t: 'hoja', ruta: p ? { p, d: datos } : null }), [])
  const completa = useCallback((p: string | null, datos?: Record<string, unknown>) => d({ t: 'completa', ruta: p ? { p, d: datos } : null }), [])
  const minimizar = useCallback(() => d({ t: 'minimizar' }), [])
  const restaurar = useCallback(() => d({ t: 'restaurar' }), [])
  const pila = estado.pilas[estado.pestana]
  const actual = estado.completa ?? pila[pila.length - 1]!
  const valor = useMemo<Nav>(() => ({ estado, ir, reemplazar, atras, pestana, raiz, hoja, completa, minimizar, restaurar, actual }),
    [estado, ir, reemplazar, atras, pestana, raiz, hoja, completa, minimizar, restaurar, actual])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useNav(): Nav {
  const n = useContext(Ctx)
  if (!n) throw new Error('useNav fuera de ProveedorNav')
  return n
}
