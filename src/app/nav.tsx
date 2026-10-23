// Navegación de la app: 5 pestañas, cada una con su pila de pantallas, hojas inferiores
// y pantallas completas (alta de usuario, entreno en curso). Sin dependencias (solo tipos): es un reducer.
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { Franja, Meta } from '../datos/tipos'

export type Pestana = 'ini' | 'rut' | 'com' | 'pro' | 'per'

/** Secciones de Perfil que se abren como pantalla (los textos de cada una están en pantallas/perfil/textos). */
export type ClaveSeccion = 'datos' | 'cuerpo' | 'objetivos' | 'salud' | 'experiencia' | 'preferencias' | 'horario' | 'alimentacion' | 'vida' | 'seguimiento'

/** Id de algo guardado: Dexie lo tipa opcional, pero lo leído de la base siempre lo tiene. */
type Id = number | undefined

/** Datos que lleva cada pantalla y cada hoja (`undefined`: ninguno). Las hojas empiezan por «sheet-». */
export type Rutas = {
  ini: undefined
  rut: undefined
  'rut-dia': { letra: string }
  'rut-gen': { definitiva: boolean } | undefined
  'rut-edit': { letra: string } | undefined
  'rut-ej': { filtro: 'evitados' } | undefined
  'rut-ficha': { id: string }
  'rut-gym': undefined
  'rut-gym-edit': { id: Id }
  entreno: undefined
  'ses-fin': { id: Id }
  com: undefined
  'com-scan': { fecha?: string; franja?: Franja } | undefined
  'com-prod': { codigo: string; fecha?: string; franja?: Franja }
  'com-plant': undefined
  'com-guard': undefined
  'com-energia': undefined
  'pro-sem': undefined
  'pro-fuerza': undefined
  'pro-entreno': { id: Id }
  'pro-cuerpo': undefined
  'pro-reg': undefined
  'pro-fotos': undefined
  'pro-obj': undefined
  'pro-pasos': undefined
  per: undefined
  'per-sec': { s: ClaveSeccion }
  aju: { seccion: 'datos' | 'comida' } | undefined
  creditos: undefined
  'sheet-peso': undefined
  'sheet-ses1': { letra: string; version?: 'normal' | 'corta' }
  'sheet-ocup': { idx: number }
  'sheet-lista': undefined
  'sheet-salir-entreno': undefined
  'sheet-tools': { idx: number }
  'sheet-discos': { idx: number }
  'sheet-cal': { idx: number }
  'sheet-instr': { id: string }
  'sheet-nota-serie': { idx: number; n: number }
  'sheet-add': { fecha?: string; franja?: Franja; nota?: boolean } | undefined
  'sheet-plant': { id?: number; fecha?: string; franja?: Franja }
  'sheet-comida': { id: Id }
  'sheet-supl': { nombre: string }
  'sheet-maq': { gym: Id; id?: string }
  'sheet-elegir':
    | { modo: 'anadir'; letra: string }
    | { modo: 'cambiar' | 'alternativa'; letra: string; uid: string; id: string }
    | { modo: 'sesion-anadir' }
    | { modo: 'sesion-cambiar'; idx: number; id?: string }
  'sheet-meta': { id?: number; tipo?: Meta['tipo'] } | undefined
  'sheet-trote': undefined
  'sheet-confirmar': DatosConfirmar
  'sheet-informe': undefined
  'sheet-tutorial': undefined
}

/** Hoja de confirmación: los textos y qué se hace al aceptar (con el id de lo que se borra). */
type DatosConfirmar = { titulo: string; texto?: string; si?: string; no?: string; peligro?: boolean } & (
  | { accion: 'regenerar' | 'borrar-todo' }
  | { accion: 'borrar-gimnasio' | 'borrar-sesion' | 'cancelar-entreno' | 'borrar-medicion' | 'borrar-foto'; id: Id }
)

export type CodigoRuta = keyof Rutas
export type CodigoHoja = Extract<CodigoRuta, `sheet-${string}`>
export type CodigoPantalla = Exclude<CodigoRuta, CodigoHoja>
/** Pantallas y hojas que se abren sin datos. */
export type SinDatos<C extends CodigoRuta = CodigoRuta> = { [K in C]: undefined extends Rutas[K] ? K : never }[C]

export type Ruta<C extends CodigoRuta = CodigoRuta> = { [K in C]: undefined extends Rutas[K] ? { p: K; d?: Rutas[K] } : { p: K; d: Rutas[K] } }[C]
/** Los datos de la ruta, obligatorios u opcionales según la pantalla. */
type Datos<C extends CodigoRuta, Mas extends unknown[] = []> = undefined extends Rutas[C] ? [d?: Rutas[C], ...Mas] : [d: Rutas[C], ...Mas]

type EstadoNav = {
  pestana: Pestana
  pilas: Record<Pestana, Ruta<CodigoPantalla>[]>
  hoja: Ruta<CodigoHoja> | null
  completa: Ruta<CodigoPantalla> | null
  /** Pantalla completa minimizada (el entreno sigue en curso y se ve la mini barra). */
  minimizada: Ruta<CodigoPantalla> | null
}

export const RAIZ: Record<Pestana, Ruta<SinDatos<CodigoPantalla>>> = {
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

type AccionNav =
  | { t: 'pestana'; pestana: Pestana }
  | { t: 'ir'; ruta: Ruta<CodigoPantalla>; pestana?: Pestana }
  | { t: 'reemplazar'; ruta: Ruta<CodigoPantalla> }
  | { t: 'atras' }
  | { t: 'hoja'; ruta: Ruta<CodigoHoja> | null }
  | { t: 'completa'; ruta: Ruta<CodigoPantalla> | null }
  | { t: 'minimizar' }
  | { t: 'restaurar' }
  /** Vuelve al entreno en curso: lo restaura si se minimizó en esta visita; si la app se cerró a mitad, lo abre de nuevo. */
  | { t: 'abrirEntreno' }
  | { t: 'raiz'; pestana: Pestana }
  /** Vuelve a un estado guardado (el tutorial deja la app como la encontró). */
  | { t: 'poner'; estado: EstadoNav }

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
    case 'abrirEntreno':
      return reducirNav(s, s.minimizada ? { t: 'restaurar' } : { t: 'completa', ruta: { p: 'entreno' } })
    case 'poner':
      return a.estado
  }
}

/** ¿Queda algo a lo que volver con «atrás»? Si no, Android minimiza la app. */
function puedeVolver(s: EstadoNav): boolean {
  return !!s.hoja || !!s.completa || s.pilas[s.pestana].length > 1 || s.pestana !== 'ini'
}

/**
 * Qué hace el botón atrás del móvil: en el entreno (sin ninguna hoja abierta) pregunta si acabarlo, para no
 * salir sin querer; si no, vuelve atrás o, sin nada a lo que volver, Android minimiza la app.
 */
export function queHaceAtras(s: EstadoNav): 'preguntar-entreno' | 'atras' | 'minimizar-app' {
  if (s.completa?.p === 'entreno' && !s.hoja) return 'preguntar-entreno'
  return puedeVolver(s) ? 'atras' : 'minimizar-app'
}

type Nav = {
  estado: EstadoNav
  ir: <C extends CodigoPantalla>(p: C, ...d: Datos<C, [pestana?: Pestana]>) => void
  reemplazar: <C extends CodigoPantalla>(p: C, ...d: Datos<C>) => void
  atras: () => void
  pestana: (t: Pestana) => void
  raiz: (t: Pestana) => void
  hoja: { (p: null): void; <C extends CodigoHoja>(p: C, ...d: Datos<C>): void }
  completa: { (p: null): void; <C extends CodigoPantalla>(p: C, ...d: Datos<C>): void }
  minimizar: () => void
  restaurar: () => void
  abrirEntreno: () => void
  poner: (estado: EstadoNav) => void
  actual: Ruta<CodigoPantalla>
}

const Ctx = createContext<Nav | null>(null)

export function ProveedorNav({ children, inicial }: { children: ReactNode; inicial?: EstadoNav }) {
  const [estado, d] = useReducer(reducirNav, inicial ?? estadoInicial())
  // Los tipos de Nav emparejan cada código con sus datos; aquí dentro ya no se puede comprobar.
  const ir = useCallback((p: CodigoPantalla, datos?: unknown, pestana?: Pestana) => d({ t: 'ir', ruta: { p, d: datos } as Ruta<CodigoPantalla>, pestana }), []) as Nav['ir']
  const reemplazar = useCallback((p: CodigoPantalla, datos?: unknown) => d({ t: 'reemplazar', ruta: { p, d: datos } as Ruta<CodigoPantalla> }), []) as Nav['reemplazar']
  const atras = useCallback(() => d({ t: 'atras' }), [])
  const pestana = useCallback((t: Pestana) => d({ t: 'pestana', pestana: t }), [])
  const raiz = useCallback((t: Pestana) => d({ t: 'raiz', pestana: t }), [])
  const hoja = useCallback((p: CodigoHoja | null, datos?: unknown) => d({ t: 'hoja', ruta: p ? { p, d: datos } as Ruta<CodigoHoja> : null }), []) as Nav['hoja']
  const completa = useCallback((p: CodigoPantalla | null, datos?: unknown) => d({ t: 'completa', ruta: p ? { p, d: datos } as Ruta<CodigoPantalla> : null }), []) as Nav['completa']
  const minimizar = useCallback(() => d({ t: 'minimizar' }), [])
  const restaurar = useCallback(() => d({ t: 'restaurar' }), [])
  const abrirEntreno = useCallback(() => d({ t: 'abrirEntreno' }), [])
  const poner = useCallback((e: EstadoNav) => d({ t: 'poner', estado: e }), [])
  const pila = estado.pilas[estado.pestana]
  const actual = estado.completa ?? pila[pila.length - 1]!
  const valor = useMemo<Nav>(() => ({ estado, ir, reemplazar, atras, pestana, raiz, hoja, completa, minimizar, restaurar, abrirEntreno, poner, actual }),
    [estado, ir, reemplazar, atras, pestana, raiz, hoja, completa, minimizar, restaurar, abrirEntreno, poner, actual])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useNav(): Nav {
  const n = useContext(Ctx)
  if (!n) throw new Error('useNav fuera de ProveedorNav')
  return n
}
