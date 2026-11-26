// Archivos: guardar, compartir y elegir (copias e informe), copias en Documentos y fotos.
import { registerPlugin } from '@capacitor/core'
import { esAndroid, esNativo, esWebApple } from './dispositivo'
import { t } from '../i18n'

/** Trozo binario para subir o bajar archivos por el puente nativo sin picos de memoria ni límites de IPC. */
const TAM_TROZO = 512 * 1024

type CarpetaNativa = 'documentos' | 'descargas'

type PluginArchivos = {
  iniciarArchivo(o: { nombre: string }): Promise<{ id: string }>
  escribirTrozo(o: { id: string; datos: string }): Promise<void>
  cancelarArchivo(o: { id: string }): Promise<void>
  guardarEnDocumentos(o: { id: string; nombre: string; tipo: string }): Promise<{ uri: string; carpeta: CarpetaNativa; nombre: string }>
  guardarComo(o: { id: string; nombre: string; tipo: string }): Promise<{ estado: 'guardado' | 'cancelado'; uri?: string; nombre?: string }>
  compartir(o: { id: string; nombre: string; tipo: string; titulo: string }): Promise<{ estado: 'compartido' | 'cancelado' }>
  compartirCopiaGuardada(o: { nombre: string; titulo: string }): Promise<{ estado: 'compartido' | 'cancelado' }>
  listarCopias(): Promise<{ copias: CopiaGuardada[] }>
  abrirLecturaCopia(o: { nombre: string }): Promise<{ id: string }>
  leerTrozoCopia(o: { id: string }): Promise<{ datos: string; fin: boolean }>
  cerrarLecturaCopia(o: { id: string }): Promise<void>
  borrarCopia(o: { nombre: string }): Promise<void>
}

let pluginCache: PluginArchivos | null = null
function pluginArchivos(): PluginArchivos {
  return (pluginCache ??= registerPlugin<PluginArchivos>('ArchivosNativos'))
}

function esNoImplementado(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e ?? '')
  return /UNIMPLEMENTED|not implemented/i.test(m)
}

function esFaltaPermisoNativo(e: unknown): boolean {
  return (e as { code?: string })?.code === 'SIN_PERMISO'
}

function aBase64(bytes: Uint8Array): string {
  const trozos: string[] = []
  for (let i = 0; i < bytes.length; i += 0x8000) trozos.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)))
  return btoa(trozos.join(''))
}

function deBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Sube los bytes al archivo temporal nativo en trozos de 512 KB (borra el temporal si falla a medias). */
async function prepararEnNativo(nombre: string, bytes: Uint8Array): Promise<string> {
  const p = pluginArchivos()
  const { id } = await p.iniciarArchivo({ nombre })
  try {
    for (let i = 0; i < bytes.length; i += TAM_TROZO) {
      await p.escribirTrozo({ id, datos: aBase64(bytes.subarray(i, i + TAM_TROZO)) })
    }
    return id
  } catch (e) {
    await p.cancelarArchivo({ id }).catch(() => {})
    throw e
  }
}

/**
 * Android 10 o anterior: Documentos pide el permiso de almacenamiento (desde Android 11 no hace falta y sale
 * concedido). `pedir`: si no lo tiene, se pregunta; si no, solo se mira (para no preguntar al abrir la app).
 */
export async function permisoDocumentos(pedir: boolean): Promise<boolean> {
  if (!esNativo()) return true
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    const p = pedir ? await Filesystem.requestPermissions() : await Filesystem.checkPermissions()
    return p.publicStorage === 'granted'
  } catch { return false }
}

const SIN_PERMISO = 'SinPermisoDocumentos'
/** Sin el permiso de Documentos. Se reconoce por el nombre, no por el texto, que va traducido. */
export const esSinPermisoDocumentos = (e: unknown): boolean => (e as Error)?.name === SIN_PERMISO

/** Sigue solo con el permiso de Documentos; si no, el error claro (y no el inglés del plugin). */
async function exigirPermiso(pedir: boolean, texto: string): Promise<void> {
  if (await permisoDocumentos(pedir)) return
  const e = new Error(texto)
  e.name = SIN_PERMISO
  throw e
}
const sinPermisoGuardar = () => t('Sin permiso para guardar en Documentos. Dalo en los ajustes del móvil: Aplicaciones → JowyFit → Permisos.')
// Al leer o borrar no se habla de «guardar»: despistaría.
const sinPermisoCarpeta = () => t('Sin permiso para usar la carpeta Documentos. Dalo en los ajustes del móvil: Aplicaciones → JowyFit → Permisos.')

export type DestinoGuardado = { uri: string; carpeta: 'documentos' | 'descargas' | 'web'; nombre: string }

/**
 * Guarda un archivo indicando dónde quedó. En Android usa MediaStore (Documentos/JowyFit y, si el fabricante lo
 * bloquea, Descargas/JowyFit) con transferencia por trozos; si un APK antiguo no trae el plugin, cae a Filesystem.
 */
export async function guardarArchivoConCarpeta(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<DestinoGuardado> {
  if (esNativo()) {
    if (esAndroid()) {
      const p = pluginArchivos()
      let id: string | null = null
      try {
        const idTmp = await prepararEnNativo(nombre, bytes)
        id = idTmp
        try {
          const r = await p.guardarEnDocumentos({ id: idTmp, nombre, tipo })
          id = null
          return { uri: r.uri, carpeta: r.carpeta === 'descargas' ? 'descargas' : 'documentos', nombre: r.nombre || nombre }
        } catch (e) {
          if (esFaltaPermisoNativo(e)) {
            await exigirPermiso(true, sinPermisoGuardar())
            const r = await p.guardarEnDocumentos({ id: idTmp, nombre, tipo })
            id = null
            return { uri: r.uri, carpeta: r.carpeta === 'descargas' ? 'descargas' : 'documentos', nombre: r.nombre || nombre }
          }
          throw e
        }
      } catch (e) {
        if (id) await p.cancelarArchivo({ id }).catch(() => {})
        if (!esNoImplementado(e)) throw e
      }
    }
    await exigirPermiso(true, sinPermisoGuardar())
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const r = await Filesystem.writeFile({ path: `JowyFit/${nombre}`, data: aBase64(bytes), directory: Directory.Documents, recursive: true })
    return { uri: r.uri, carpeta: 'documentos', nombre }
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return { uri: nombre, carpeta: 'web', nombre }
}

/** Guarda un archivo. Android: Documentos/JowyFit (sobrevive a desinstalar). Web: descarga. */
export async function guardarArchivo(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<string> {
  return (await guardarArchivoConCarpeta(nombre, bytes, tipo)).uri
}

export type ResultadoGuardarComo =
  | { estado: 'guardado'; nombre: string }
  | { estado: 'cancelado' }
  | { estado: 'no-disponible' }

/** Android: abre el selector de carpetas del sistema (SAF ACTION_CREATE_DOCUMENT) para guardar donde elija el usuario. */
export async function guardarArchivoComo(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<ResultadoGuardarComo> {
  if (!esAndroid()) return { estado: 'no-disponible' }
  const p = pluginArchivos()
  let id: string | null = null
  try {
    id = await prepararEnNativo(nombre, bytes)
    const r = await p.guardarComo({ id, nombre, tipo })
    id = null
    if (r.estado === 'cancelado') return { estado: 'cancelado' }
    return { estado: 'guardado', nombre: r.nombre || nombre }
  } catch (e) {
    if (id) await p.cancelarArchivo({ id }).catch(() => {})
    if (esNoImplementado(e)) return { estado: 'no-disponible' }
    throw e
  }
}

type Compartido = 'compartido' | 'cancelado' | 'sin-gesto' | 'no-se-puede'
/**
 * Web (sobre todo iPhone): abre el menú Compartir con el archivo («Guardar en Archivos», AirDrop, WhatsApp…).
 * 'sin-gesto': Safari pide que salga justo después de un toque y se tardó demasiado (hay que tocar otra vez);
 * 'no-se-puede': este navegador no comparte archivos (se descarga en su lugar).
 */
export async function compartirArchivo(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<Compartido> {
  if (esNativo()) return 'no-se-puede'
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof n.share !== 'function' || typeof File === 'undefined') return 'no-se-puede'
  const archivo = new File([bytes as BlobPart], nombre, { type: tipo })
  if (n.canShare && !n.canShare({ files: [archivo] })) return 'no-se-puede'
  try {
    await n.share({ files: [archivo], title: nombre })
    return 'compartido'
  } catch (e) {
    const err = (e as Error)?.name
    if (err === 'AbortError') return 'cancelado'
    if (err === 'NotAllowedError') return 'sin-gesto'
    return 'no-se-puede'
  }
}

/**
 * Android: abre el menú Compartir del sistema con un archivo (WhatsApp, Gmail, Drive…). Se deja antes en la caché,
 * en la carpeta «compartir», que es la que el FileProvider deja dar a otra app (res/xml/file_paths.xml).
 */
export async function compartirNativo(nombre: string, bytes: Uint8Array, titulo: string, tipo = 'application/octet-stream'): Promise<'compartido' | 'cancelado'> {
  if (esAndroid()) {
    const p = pluginArchivos()
    let id: string | null = null
    try {
      id = await prepararEnNativo(nombre, bytes)
      const r = await p.compartir({ id, nombre, tipo, titulo })
      id = null
      return r.estado === 'cancelado' ? 'cancelado' : 'compartido'
    } catch (e) {
      if (id) await p.cancelarArchivo({ id }).catch(() => {})
      if (!esNoImplementado(e)) throw e
    }
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const r = await Filesystem.writeFile({ path: `compartir/${nombre}`, data: aBase64(bytes), directory: Directory.Cache, recursive: true })
  try {
    await Share.share({ title: titulo, files: [r.uri], dialogTitle: titulo })
    return 'compartido'
  } catch (e) {
    // Cerrar el menú sin elegir nada no es un error.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelado'
    throw e
  }
}

export type CopiaGuardada = { nombre: string; fecha: number; tam: number }
export type ArchivoElegido = { nombre: string; bytes: Uint8Array }

/** Lista las copias guardadas en Documentos/JowyFit (o Descargas/JowyFit en Android 10+). */
export async function copiasGuardadas(): Promise<CopiaGuardada[]> {
  if (!esNativo()) return []
  if (esAndroid()) {
    try {
      const r = await pluginArchivos().listarCopias()
      return (r.copias ?? [])
        .filter(f => f.nombre.endsWith('.jowyfit'))
        .map(f => ({ nombre: f.nombre, fecha: Number(f.fecha ?? 0), tam: Number(f.tam ?? 0) }))
        .sort((a, b) => b.fecha - a.fecha || b.nombre.localeCompare(a.nombre))
    } catch (e) {
      if (!esNoImplementado(e)) return []
    }
  }
  if (!(await permisoDocumentos(false))) return []
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const r = await Filesystem.readdir({ path: 'JowyFit', directory: Directory.Documents })
    return r.files.filter(f => f.name.endsWith('.jowyfit')).map(f => ({ nombre: f.name, fecha: Number(f.mtime ?? 0), tam: Number(f.size ?? 0) })).sort((a, b) => b.fecha - a.fecha || b.nombre.localeCompare(a.nombre))
  } catch { return [] }
}

/** Solo un nombre de copia, sin carpetas: nada de «../» que se salga de Documentos/JowyFit. */
function rutaCopia(nombre: string): string {
  if (/[/\\]|\.\./.test(nombre) || !nombre.endsWith('.jowyfit')) throw new Error(t('Nombre de copia no válido'))
  return `JowyFit/${nombre}`
}

// Leer y borrar no preguntan: sin el permiso la lista sale vacía, así que solo llega aquí si se quitó después.
export async function leerCopiaGuardada(nombre: string): Promise<Uint8Array> {
  const ruta = rutaCopia(nombre)
  if (esAndroid()) {
    const p = pluginArchivos()
    let id: string | null = null
    try {
      id = (await p.abrirLecturaCopia({ nombre })).id
      const partes: Uint8Array[] = []
      let total = 0
      for (;;) {
        const tzo = await p.leerTrozoCopia({ id })
        if (tzo.fin) break
        const bin = deBase64(tzo.datos)
        partes.push(bin)
        total += bin.length
      }
      id = null
      const out = new Uint8Array(total)
      let pos = 0
      for (const parte of partes) { out.set(parte, pos); pos += parte.length }
      return out
    } catch (e) {
      if (id) await p.cerrarLecturaCopia({ id }).catch(() => {})
      if (!esNoImplementado(e)) throw e
    }
  }
  await exigirPermiso(false, sinPermisoCarpeta())
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const r = await Filesystem.readFile({ path: ruta, directory: Directory.Documents })
  return deBase64(typeof r.data === 'string' ? r.data : await (r.data as Blob).text())
}

/** Android: comparte una copia ya guardada en el móvil sin mover sus bytes por JavaScript. */
export async function compartirCopiaGuardada(nombre: string, titulo: string): Promise<'compartido' | 'cancelado'> {
  rutaCopia(nombre)
  if (esAndroid()) {
    try {
      const r = await pluginArchivos().compartirCopiaGuardada({ nombre, titulo })
      return r.estado === 'cancelado' ? 'cancelado' : 'compartido'
    } catch (e) {
      if (!esNoImplementado(e)) throw e
    }
  }
  const bytes = await leerCopiaGuardada(nombre)
  return compartirNativo(nombre, bytes, titulo, 'application/octet-stream')
}

/** Borra una copia de Documentos/JowyFit (o Descargas/JowyFit). Ahí no hay papelera: no se puede deshacer. */
export async function borrarCopiaGuardada(nombre: string): Promise<void> {
  const ruta = rutaCopia(nombre)
  if (esAndroid()) {
    try {
      await pluginArchivos().borrarCopia({ nombre })
      return
    } catch (e) {
      if (!esNoImplementado(e)) throw e
    }
  }
  await exigirPermiso(false, sinPermisoCarpeta())
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.deleteFile({ path: ruta, directory: Directory.Documents })
}

/**
 * Un <input type=file> de un solo uso. Va metido en la página (escondido): en iPhone, uno suelto a veces no avisa
 * al elegir. Si se cierra sin elegir nada (evento «cancel», Safari 16.4 o más), devuelve null.
 */
function pedirArchivo(preparar: (i: HTMLInputElement) => void): Promise<File | null> {
  return new Promise(resolve => {
    const i = document.createElement('input')
    i.type = 'file'
    i.style.display = 'none'
    preparar(i)
    let hecho = false
    const fin = (f: File | null) => { if (hecho) return; hecho = true; i.remove(); resolve(f) }
    i.addEventListener('change', () => fin(i.files?.[0] ?? null))
    i.addEventListener('cancel', () => fin(null))
    document.body.appendChild(i)
    i.click()
  })
}

export async function elegirArchivo(aceptar = '.jowyfit,.json,application/json,application/zip'): Promise<ArchivoElegido | null> {
  // Ni el selector de Android ni Archivos de iPhone conocen «.jowyfit»: con el filtro la copia sale en gris.
  // Allí se deja elegir cualquier archivo; al importar se comprueba que sea una copia.
  const f = await pedirArchivo(i => { i.accept = esNativo() || esWebApple() ? '' : aceptar })
  return f ? { nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null
}

/**
 * Menos que esto entre tocar «Foto» y volver sin nada: no se llegó a abrir la cámara (nadie hace y descarta una
 * foto tan rápido). En Android pasa cuando el permiso de la cámara está denegado y ya no se pregunta.
 */
export const MS_SIN_CAMARA = 1000
const EVENTO_SIN_PERMISO = 'jf-sin-permiso-camara'

/** Avisa cuando la cámara del sistema no se abrió por falta de permiso (para explicarlo en pantalla). */
export function alFaltarPermisoCamara(fn: () => void): () => void {
  window.addEventListener(EVENTO_SIN_PERMISO, fn)
  return () => window.removeEventListener(EVENTO_SIN_PERMISO, fn)
}

/** Hace una foto (o la elige de la galería) y la devuelve reducida a JPEG. `lado`: con qué cámara se abre. */
export async function hacerFoto(max = 1280, lado: 'delantera' | 'trasera' = 'trasera'): Promise<Blob | null> {
  const desde = Date.now()
  // En iPhone, con «capture» solo se puede usar la cámara; sin él sale «Hacer foto · Fototeca · Elegir archivo».
  const f = await pedirArchivo(i => { i.accept = 'image/*'; if (!esWebApple()) i.setAttribute('capture', lado === 'delantera' ? 'user' : 'environment') })
  if (f) return reducir(f, max)
  // Android (la app pide el permiso de la cámara): si se denegó, el selector vuelve vacío al momento. En vez de no
  // hacer nada, se explica y se abre la galería, que no necesita ese permiso.
  if (esAndroid() && Date.now() - desde < MS_SIN_CAMARA) {
    window.dispatchEvent(new Event(EVENTO_SIN_PERMISO))
    return elegirFoto(max)
  }
  return null
}

/** Elige una foto de la galería (sin abrir la cámara) y la devuelve reducida a JPEG. */
export async function elegirFoto(max = 1280): Promise<Blob | null> {
  const f = await pedirArchivo(i => { i.accept = 'image/*' })
  return f ? reducir(f, max) : null
}

export async function reducir(f: Blob, max = 1280): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise<Blob>(r => c.toBlob(b => r(b ?? f), 'image/jpeg', 0.82))
  } catch { return f }
}
