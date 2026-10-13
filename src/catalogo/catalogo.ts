// Catálogo de ejercicios RepDB: carga, búsqueda, imágenes y nombres en español.
import { useEffect, useState } from 'react'
import type { Catalogo, Ejercicio } from './tipos'

let cache: Catalogo | null = null
let promesa: Promise<Catalogo> | null = null
let indice: Map<string, Ejercicio> = new Map()

const base = () => import.meta.env.BASE_URL ?? '/'

export function usarCatalogo(c: Catalogo) {
  cache = c
  indice = new Map(c.ejercicios.map(e => [e.id, e]))
}

export async function cargarCatalogo(): Promise<Catalogo> {
  if (cache) return cache
  promesa ??= fetch(`${base()}repdb/catalogo.json`).then(r => {
    if (!r.ok) throw new Error(`No se pudo cargar el catálogo (${r.status})`)
    return r.json() as Promise<Catalogo>
  }).then(c => { usarCatalogo(c); return c })
  return promesa
}

export function catalogoCargado(): Catalogo | null {
  return cache
}

export function useCatalogo(): Catalogo | null {
  const [c, setC] = useState<Catalogo | null>(cache)
  useEffect(() => {
    if (!c) void cargarCatalogo().then(setC).catch(() => setC(null))
  }, [c])
  return c
}

export function ejercicio(id: string | null | undefined): Ejercicio | undefined {
  return id ? indice.get(id) : undefined
}

export function nombreEjercicio(id: string | null | undefined): string {
  return ejercicio(id)?.nombre ?? 'Ejercicio'
}

/** URL de la imagen grande. pose: 'start' | 'peak' | 'main'. */
export function imagen(e: Ejercicio, pose?: string): string {
  const p = pose ?? e.poses[0] ?? 'main'
  return `${base()}repdb/img/${e.id}-${p}.webp`
}
export function miniatura(e: Ejercicio): string {
  const p = e.poses.includes('peak') ? 'peak' : (e.poses[0] ?? 'main')
  return `${base()}repdb/mini/${e.id}-${p}.webp`
}
export function imagenMaterial(clave: string): string | undefined {
  const m = cache?.material[clave]
  return m?.imagen ? `${base()}repdb/maq/${m.imagen}` : undefined
}
export function imagenMusculo(clave: string): string | undefined {
  const m = cache?.musculos[clave]
  return m?.imagen ? `${base()}repdb/mus/${m.imagen}` : undefined
}

export const nombreMaterial = (clave: string | null) =>
  clave ? (cache?.material[clave]?.nombre ?? clave) : 'Peso corporal'
export const nombreMusculo = (clave: string) => cache?.musculos[clave]?.nombre ?? clave
export const etiqueta = (grupo: string, clave: string) => cache?.etiquetas[grupo]?.[clave] ?? clave

/** Normaliza para buscar sin tildes ni mayúsculas. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function buscar(texto: string, lista: Ejercicio[]): Ejercicio[] {
  const q = normalizar(texto.trim())
  if (!q) return lista
  const partes = q.split(/\s+/)
  return lista.filter(e => {
    const h = normalizar(`${e.nombre} ${e.id.replace(/-/g, ' ')} ${e.principales.map(nombreMusculo).join(' ')} ${nombreMaterial(e.material)}`)
    return partes.every(p => h.includes(p))
  })
}

/** Ejercicios relacionados: misma zona y algún músculo principal en común. */
export function relacionados(e: Ejercicio, lista: Ejercicio[], n = 8): Ejercicio[] {
  return lista
    .filter(x => x.id !== e.id && x.zona === e.zona && x.categoria === e.categoria)
    .map(x => ({ x, s: x.principales.filter(m => e.principales.includes(m)).length * 2 + (x.mecanica === e.mecanica ? 1 : 0) }))
    .filter(o => o.s > 0)
    .sort((a, b) => b.s - a.s || a.x.nombre.localeCompare(b.x.nombre))
    .slice(0, n)
    .map(o => o.x)
}
