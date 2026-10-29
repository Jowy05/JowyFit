// Archivos: guardar, compartir y elegir (copias e informe), copias en Documentos y fotos.
import { esNativo, esWebApple } from './dispositivo'
import { t } from '../i18n'

function aBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Guarda un archivo. Android: Documentos/JowyFit (sobrevive a desinstalar). Web: descarga. */
export async function guardarArchivo(nombre: string, bytes: Uint8Array, tipo = 'application/octet-stream'): Promise<string> {
  if (esNativo()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const r = await Filesystem.writeFile({ path: `JowyFit/${nombre}`, data: aBase64(bytes), directory: Directory.Documents, recursive: true })
    return r.uri
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return nombre
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
export async function compartirNativo(nombre: string, bytes: Uint8Array, titulo: string): Promise<'compartido' | 'cancelado'> {
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

/** Lista las copias guardadas en Documentos/JowyFit (solo Android). */
export async function copiasGuardadas(): Promise<CopiaGuardada[]> {
  if (!esNativo()) return []
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

export async function leerCopiaGuardada(nombre: string): Promise<Uint8Array> {
  const ruta = rutaCopia(nombre)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const r = await Filesystem.readFile({ path: ruta, directory: Directory.Documents })
  const bin = atob(typeof r.data === 'string' ? r.data : await (r.data as Blob).text())
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

/** Borra una copia de Documentos/JowyFit. Ahí no hay papelera: no se puede deshacer. */
export async function borrarCopiaGuardada(nombre: string): Promise<void> {
  const ruta = rutaCopia(nombre)
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

/** Hace una foto (o la elige de la galería) y la devuelve reducida a JPEG. */
export async function hacerFoto(max = 1280): Promise<Blob | null> {
  // En iPhone, con «capture» solo se puede usar la cámara; sin él sale «Hacer foto · Fototeca · Elegir archivo».
  const f = await pedirArchivo(i => { i.accept = 'image/*'; if (!esWebApple()) i.setAttribute('capture', 'environment') })
  return f ? reducir(f, max) : null
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
