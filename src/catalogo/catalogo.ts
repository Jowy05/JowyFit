// Catálogo de ejercicios RepDB: carga, búsqueda, imágenes y nombres en el idioma de la app.
// En inglés usa catalogo.en.json (de RepDB) y en catalán catalogo.ca.json (traducción propia); si no llegan, castellano.
import { useEffect, useSyncExternalStore } from 'react'
import type { Catalogo, Ejercicio, TextosCatalogo } from './tipos'
import { propio } from '../dominio/claves'
import { idioma, t, tk } from '../i18n'

// El catálogo que ven las pantallas (`cache`) es el de RepDB más los ejercicios propios que no se han borrado.
// El índice tiene también los borrados: el historial y el informe siguen sacando su nombre.
let repdb: Catalogo | null = null
let propios: Ejercicio[] = []
let cache: Catalogo | null = null
let promesa: Promise<Catalogo> | null = null
let indice: Map<string, Ejercicio> = new Map()
const oyentes = new Set<() => void>()

function juntar() {
  if (!repdb) return
  // Siempre un objeto nuevo: las pantallas suscritas se vuelven a pintar aunque solo cambie el índice.
  cache = { ...repdb, ejercicios: [...propios.filter(e => !e.propio?.borrado), ...repdb.ejercicios] }
  indice = new Map([...repdb.ejercicios, ...propios].map(e => [e.id, e]))
  for (const avisar of oyentes) avisar()
}

/** Los ejercicios del usuario (ya pasados a Ejercicio con comoEjercicio), también los borrados. */
export function usarPropios(lista: Ejercicio[]) {
  propios = lista
  juntar()
}

const base = () => import.meta.env.BASE_URL ?? '/'

/** Nombres de gimnasio en toda la app: «Polea» (no «Cable»), «Barra Z» (no «Barra EZ») y «Máquina de Barra Guiada» (no «Máquina Smith»). */
export function nombreComun(nombre: string): string {
  return nombre.replace(/\b(?:con|en) Cable\b/g, 'en Polea').replace(/\bCable\b/g, 'Polea').replace(/\bBarra EZ\b/g, 'Barra Z')
    .replace(/\bMáquina Smith\b/g, 'Máquina de Barra Guiada')
}

/** Lo mismo en las frases (descripción, pasos y consejos), que van en minúscula: «la máquina de barra guiada». */
export function textoComun(t: string): string {
  return t.replace(/\b([Mm])áquina Smith\b/g, '$1áquina de barra guiada').replace(/\bbarra Smith\b/g, 'barra guiada')
}

/**
 * Deja listo el catálogo. Con textos en otro idioma (inglés o catalán), cada ejercicio, material, músculo y etiqueta
 * que los tenga los usa tal cual; lo que se queda en castellano lleva los arreglos de nombreComun/textoComun.
 */
export function usarCatalogo(c: Catalogo, ingles?: TextosCatalogo | null) {
  for (const e of c.ejercicios) {
    e.nombreEs ??= nombreComun(e.nombre)
    const en = ingles ? propio(ingles.ejercicios, e.id) : undefined
    if (en) {
      e.nombre = en.nombre
      e.descripcion = en.descripcion
      e.instrucciones = en.instrucciones
      e.consejos = en.consejos
      continue
    }
    e.nombre = e.nombreEs
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
  repdb = c
  juntar()
}

export async function cargarCatalogo(): Promise<Catalogo> {
  if (cache) return cache
  promesa ??= Promise.all([
    fetch(`${base()}repdb/catalogo.json`).then(r => {
      if (!r.ok) throw new Error(t('No se pudo cargar el catálogo ({estado})', { estado: r.status }))
      return r.json() as Promise<Catalogo>
    }),
    idioma() === 'es' ? null : cargarTextos(idioma()),
  ]).then(([c, en]) => { usarCatalogo(c, en); return cache! })
  // Si falla (sin conexión, archivo a medio bajar), el fallo no se guarda: la próxima vez se vuelve a intentar.
  promesa.catch(() => { promesa = null })
  return promesa
}

/** Textos en inglés o catalán; si no llegan, el catálogo sale en castellano en vez de no abrir. */
function cargarTextos(l: string): Promise<TextosCatalogo | null> {
  return fetch(`${base()}repdb/catalogo.${l}.json`)
    .then(r => (r.ok ? (r.json() as Promise<TextosCatalogo>) : null))
    .catch(() => null)
}

export function catalogoCargado(): Catalogo | null {
  return cache
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  return () => { oyentes.delete(avisar) }
}

/** El catálogo, y vuelve a pintar la pantalla cuando cambia (al crear, editar o borrar un ejercicio propio). */
export function useCatalogo(): Catalogo | null {
  const c = useSyncExternalStore(suscribir, catalogoCargado)
  useEffect(() => {
    if (!c) void cargarCatalogo().catch(() => undefined)
  }, [c])
  return c
}

/** Se puede hacer en un gimnasio con este material. Los propios, siempre: el usuario los crea para lo que tiene. */
export const hayEn = (e: Ejercicio, material: ReadonlySet<string>) => !!e.propio || !e.material || material.has(e.material)

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

/** Material de los ejercicios propios que no tiene uno de RepDB (ver catalogo/propios). */
export const NOMBRE_MATERIAL_PROPIO: Record<string, string> = { 'mio-maquina': tk('Máquina'), 'mio-otro': tk('Otro') }

export function nombreMaterial(clave: string | null): string {
  if (!clave) return t('Peso corporal')
  const mio = propio(NOMBRE_MATERIAL_PROPIO, clave)
  return mio ? t(mio) : (propio(cache?.material, clave)?.nombre ?? clave)
}
export const nombreMusculo = (clave: string) => propio(cache?.musculos, clave)?.nombre ?? clave
export const etiqueta = (grupo: string, clave: string) => propio(propio(cache?.etiquetas, grupo), clave) ?? clave

/** Normaliza para buscar sin tildes ni mayúsculas. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Calistenia: lo que RepDB marca como tal o como peso corporal (dominadas, fondos, flexiones, anillas…). */
export const esCalistenia = (e: Ejercicio) => e.etiquetas.includes('calisthenics') || e.etiquetas.includes('bodyweight')
/** Cardio: la categoría de RepDB y lo que marca como cardio (correr, comba, burpees, cinta…). */
export const esCardio = (e: Ejercicio) => e.categoria === 'cardio' || e.etiquetas.includes('cardio')
// Para que buscar «calistenia» o «cardio» encuentre todos los suyos, en los tres idiomas (no vienen en el nombre).
const palabrasDeTipo = (e: Ejercicio) => `${esCalistenia(e) ? 'calistenia calisthenics cal·listenia' : ''} ${esCardio(e) ? 'cardio' : ''}`

export function buscar(texto: string, lista: Ejercicio[]): Ejercicio[] {
  const q = normalizar(texto.trim())
  if (!q) return lista
  const partes = q.split(/\s+/)
  return lista.filter(e => {
    const h = normalizar(`${e.nombre} ${e.nombreEs ?? ''} ${e.id.replace(/-/g, ' ')} ${e.principales.map(nombreMusculo).join(' ')} ${nombreMaterial(e.material)} ${palabrasDeTipo(e)}`)
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
