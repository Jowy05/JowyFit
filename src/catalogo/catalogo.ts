// Catálogo de ejercicios RepDB: carga, búsqueda, imágenes y nombres en el idioma de la app.
// En inglés se usan los textos de RepDB en inglés (catalogo.en.json). En catalán RepDB no trae textos y se quedan en
// castellano (decisión pendiente del dueño: traducirlos aparte o dejarlos así).
import { useEffect, useState } from 'react'
import type { Catalogo, Ejercicio, TextosCatalogo } from './tipos'
import { propio } from '../dominio/claves'
import { idioma, t } from '../i18n'

let cache: Catalogo | null = null
let promesa: Promise<Catalogo> | null = null
let indice: Map<string, Ejercicio> = new Map()

const base = () => import.meta.env.BASE_URL ?? '/'

/**
 * Nombres como se dicen en el gimnasio: «Polea» (no «Cable»), «Barra Z» (no «Barra EZ») y «Máquina de Barra Guiada»
 * (no «Máquina Smith», que no dice nada a quien no lo sabe), en toda la app.
 */
export function nombreComun(nombre: string): string {
  return nombre.replace(/\b(?:con|en) Cable\b/g, 'en Polea').replace(/\bCable\b/g, 'Polea').replace(/\bBarra EZ\b/g, 'Barra Z')
    .replace(/\bMáquina Smith\b/g, 'Máquina de Barra Guiada')
}

/** Lo mismo en las frases (descripción, pasos y consejos), que van en minúscula: «la máquina de barra guiada». */
export function textoComun(t: string): string {
  return t.replace(/\b([Mm])áquina Smith\b/g, '$1áquina de barra guiada').replace(/\bbarra Smith\b/g, 'barra guiada')
}

/**
 * Deja listo el catálogo. Con textos en inglés, cada ejercicio, material, músculo y etiqueta que los tenga los usa
 * tal cual; lo que se queda en castellano lleva los arreglos de nombreComun/textoComun (son solo del castellano).
 */
export function usarCatalogo(c: Catalogo, ingles?: TextosCatalogo | null) {
  for (const e of c.ejercicios) {
    const en = ingles ? propio(ingles.ejercicios, e.id) : undefined
    if (en) {
      e.nombre = en.nombre
      e.descripcion = en.descripcion
      e.instrucciones = en.instrucciones
      e.consejos = en.consejos
      continue
    }
    e.nombre = nombreComun(e.nombre)
    e.descripcion = textoComun(e.descripcion)
    e.instrucciones = e.instrucciones.map(textoComun)
    e.consejos = e.consejos.map(textoComun)
  }
  for (const [k, m] of Object.entries(c.material)) {
    const en = ingles ? propio(ingles.material, k) : undefined
    m.nombre = en?.nombre || textoComun(m.nombre)
  }
  if (ingles) {
    for (const [k, m] of Object.entries(c.musculos)) {
      const en = propio(ingles.musculos, k)
      if (en?.nombre) { m.nombre = en.nombre; if (en.cientifico) m.cientifico = en.cientifico }
    }
    for (const [g, etiquetas] of Object.entries(c.etiquetas)) {
      const en = propio(ingles.etiquetas, g)
      if (en) for (const k of Object.keys(etiquetas)) { const v = propio(en, k); if (v) etiquetas[k] = v }
    }
  }
  cache = c
  indice = new Map(c.ejercicios.map(e => [e.id, e]))
}

export async function cargarCatalogo(): Promise<Catalogo> {
  if (cache) return cache
  promesa ??= Promise.all([
    fetch(`${base()}repdb/catalogo.json`).then(r => {
      if (!r.ok) throw new Error(t('No se pudo cargar el catálogo ({estado})', { estado: r.status }))
      return r.json() as Promise<Catalogo>
    }),
    idioma() === 'en' ? cargarIngles() : null,
  ]).then(([c, en]) => { usarCatalogo(c, en); return c })
  // Si falla (sin conexión, archivo a medio bajar), la próxima vez se vuelve a intentar: antes el fallo se quedaba
  // guardado y el catálogo ya no cargaba hasta cerrar la app.
  promesa.catch(() => { promesa = null })
  return promesa
}

/** Textos en inglés; si no llegan, el catálogo sale en castellano en vez de no abrir. */
function cargarIngles(): Promise<TextosCatalogo | null> {
  return fetch(`${base()}repdb/catalogo.en.json`)
    .then(r => (r.ok ? (r.json() as Promise<TextosCatalogo>) : null))
    .catch(() => null)
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
  return ejercicio(id)?.nombre ?? t('Ejercicio')
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
  const m = propio(cache?.material, clave)
  return m?.imagen ? `${base()}repdb/maq/${m.imagen}` : undefined
}
export function imagenMusculo(clave: string): string | undefined {
  const m = propio(cache?.musculos, clave)
  return m?.imagen ? `${base()}repdb/mus/${m.imagen}` : undefined
}

export const nombreMaterial = (clave: string | null) =>
  clave ? (propio(cache?.material, clave)?.nombre ?? clave) : t('Peso corporal')
export const nombreMusculo = (clave: string) => propio(cache?.musculos, clave)?.nombre ?? clave
export const etiqueta = (grupo: string, clave: string) => propio(propio(cache?.etiquetas, grupo), clave) ?? clave

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
