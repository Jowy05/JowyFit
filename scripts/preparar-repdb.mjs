// Prepara el dataset de ejercicios RepDB (plan gratuito) para meterlo dentro de la app.
// La licencia no permite redistribuirlo: se descarga al compilar y NO se sube al repositorio.
//   node scripts/preparar-repdb.mjs          → descarga (si hace falta) y genera public/repdb/
// Salida:
//   public/repdb/catalogo.json   ejercicios en español + etiquetas + músculos + material
//   public/repdb/catalogo.en.json   solo los textos en inglés por id (la app lo carga si está en inglés)
//   public/repdb/catalogo.ca.json   lo mismo en catalán: traducción propia, cifrada en el repositorio (scripts/repdb-ca.mjs)
//   public/repdb/img/*.webp      imágenes 512×512 (inicio / final / única)
//   public/repdb/mini/*.webp     miniaturas 160×160 para listas
//   public/repdb/maq/*.webp      imágenes de material y máquinas
//   public/repdb/mus/*.webp      diagramas de músculos
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import sharp from 'sharp'
import { CIFRADO, clave, descifrar } from './repdb-ca.mjs'

const RAIZ = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(RAIZ, '.cache', 'repdb')
const ZIP = path.join(CACHE, 'repdb-free.zip')
const SALIDA = path.join(RAIZ, 'public', 'repdb')
const URL_ZIP = 'https://cdn.repdb.co/repdb-assets/site/repdb-free.zip'
// Huella SHA-256 de la versión de RepDB con la que se ha probado la app (revisada el 20/10/2026: la del 18/10 solo
// añade 7 ejercicios y retoca 3 textos; no quita ni cambia ningún id).
// Si lo descargado no cuadra (el zip ha cambiado o alguien lo ha manipulado), la compilación se para:
// así nunca se publica un catálogo que no se ha revisado. Para pasar a una versión nueva de RepDB, se revisa
// y se pone aquí su huella (o se compila una vez con REPDB_SHA256=<huella nueva>).
const SHA256_ZIP = process.env.REPDB_SHA256 || '5fcfebed712bde3b71f38d68d400badff7438eaf83065ce60979ad69ca08d301'

export const huella = datos => createHash('sha256').update(datos).digest('hex')

/** Lanza un error claro si los bytes no son la versión revisada de RepDB. */
export function comprobarRepDB(datos, origen = 'descargado', esperada = SHA256_ZIP) {
  const h = huella(datos)
  if (h !== esperada) {
    throw new Error(
      `RepDB: el archivo ${origen} no es el esperado.\n` +
      `  Huella esperada: ${esperada}\n  Huella obtenida: ${h}\n` +
      '  Puede que RepDB haya publicado otra versión o que el archivo esté dañado o manipulado. No se sigue.\n' +
      '  Si es una versión nueva y la has revisado, pon su huella en SHA256_ZIP (scripts/preparar-repdb.mjs).',
    )
  }
}

async function descargar() {
  // El guardado solo vale si es la versión revisada; si no, se descarga (sin borrar el guardado hasta que lo nuevo cuadre).
  if (fs.existsSync(ZIP) && huella(fs.readFileSync(ZIP)) === SHA256_ZIP) return
  if (fs.existsSync(ZIP)) console.warn('RepDB: el archivo guardado en .cache/repdb no es la versión esperada. Se descarga de nuevo.')
  fs.mkdirSync(CACHE, { recursive: true })
  console.log('Descargando RepDB…')
  const r = await fetch(URL_ZIP)
  if (!r.ok) throw new Error(`No se pudo descargar RepDB: HTTP ${r.status}`)
  const datos = Buffer.from(await r.arrayBuffer())
  comprobarRepDB(datos)
  fs.writeFileSync(ZIP, datos)
}

function limpiar(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

async function main() {
  await descargar()
  const archivos = unzipSync(new Uint8Array(fs.readFileSync(ZIP)))
  const es = JSON.parse(new TextDecoder().decode(archivos['free.es.json']))
  const en = JSON.parse(new TextDecoder().decode(archivos['free.en.json']))

  const ejercicios = es.exercises.map(e => ({
    id: e.id,
    nombre: e.name,
    descripcion: e.description ?? '',
    instrucciones: e.instructions ?? [],
    consejos: e.tips ?? [],
    categoria: e.category,
    fuerza: e.force_type,
    mecanica: e.mechanic,
    dificultad: e.difficulty,
    material: e.equipment ?? null,
    zona: e.body_part,
    principales: e.primary_muscles ?? [],
    secundarios: e.secondary_muscles ?? [],
    objetivos: e.goals ?? [],
    etiquetas: e.tags ?? [],
    unilateral: !!e.is_unilateral,
    pesoCorporal: !!e.is_bodyweight,
    poses: e.images?.flat ?? [],
    met: e.met ?? null,
  }))

  const musculos = Object.fromEntries(Object.entries(es.muscles).map(([k, m]) => [k, { nombre: m.name, cientifico: m.name_scientific, zona: m.region, imagen: m.image }]))
  const material = Object.fromEntries(Object.entries(es.equipment).map(([k, m]) => [k, { nombre: m.name, etiquetas: m.tags ?? [], imagen: m.image }]))

  for (const d of ['img', 'mini', 'maq', 'mus']) limpiar(path.join(SALIDA, d))
  let n = 0
  for (const [nombre, datos] of Object.entries(archivos)) {
    if (nombre.startsWith('premium-samples/')) continue // solo evaluación: no se usa
    const fichero = path.basename(nombre)
    if (!fichero.endsWith('.webp')) continue
    if (nombre.startsWith('images/flat/')) {
      fs.writeFileSync(path.join(SALIDA, 'img', fichero), datos)
      await sharp(datos).resize(160, 160).webp({ quality: 72 }).toFile(path.join(SALIDA, 'mini', fichero))
      n++
    } else if (nombre.startsWith('images/equipment/')) {
      await sharp(datos).resize(256, 256, { fit: 'inside' }).webp({ quality: 80 }).toFile(path.join(SALIDA, 'maq', fichero))
    } else if (nombre.startsWith('images/muscles/')) {
      await sharp(datos).resize(256, 256, { fit: 'inside' }).webp({ quality: 80 }).toFile(path.join(SALIDA, 'mus', fichero))
    }
  }

  const catalogo = {
    fuente: 'RepDB free tier · Exercise data by RepDB (repdb.co)',
    version: es.schema_version,
    generado: es.generated_at,
    etiquetas: es.enum_labels,
    musculos,
    material,
    ejercicios,
  }
  fs.writeFileSync(path.join(SALIDA, 'catalogo.json'), JSON.stringify(catalogo))
  const ingles = textosIngles(en, es)
  fs.writeFileSync(path.join(SALIDA, 'catalogo.en.json'), JSON.stringify(ingles))
  console.log(`RepDB listo: ${ejercicios.length} ejercicios, ${n} imágenes, ${Object.keys(material).length} tipos de material, ${Object.keys(musculos).length} músculos.`)
  console.log(`Textos en inglés: ${Object.keys(ingles.ejercicios).length} ejercicios.`)
  const catalan = textosCatalan(es)
  if (catalan) {
    fs.writeFileSync(path.join(SALIDA, 'catalogo.ca.json'), JSON.stringify(catalan))
    console.log(`Textos en catalán: ${Object.keys(catalan.ejercicios).length} ejercicios.`)
  } else {
    fs.rmSync(path.join(SALIDA, 'catalogo.ca.json'), { force: true })
    console.warn('Textos en catalán: sin clave (REPDB_CA_CLAVE) o sin el archivo cifrado: en catalán los ejercicios saldrán en castellano.')
  }
}

/** Textos en catalán (traducción propia, cifrada en el repositorio): solo los ids que están en el catálogo. */
function textosCatalan(es) {
  const k = clave()
  // En GitHub la web se publica con el catálogo en catalán: sin la clave no se sigue (si no, saldría en castellano sin avisar).
  if (process.env.CI && !k) throw new Error('RepDB en catalán: falta el secreto REPDB_CA_CLAVE en GitHub.')
  if (process.env.CI && !fs.existsSync(CIFRADO)) throw new Error('RepDB en catalán: falta assets/repdb/catalogo.ca.cifrado en el repositorio.')
  if (!k || !fs.existsSync(CIFRADO)) return null
  let ca
  try {
    ca = JSON.parse(descifrar(fs.readFileSync(CIFRADO), k))
  } catch (e) {
    throw new Error('RepDB en catalán: la clave no abre assets/repdb/catalogo.ca.cifrado (¿clave equivocada o archivo dañado?).', { cause: e })
  }
  const ids = new Set(es.exercises.map(e => e.id))
  ca.ejercicios = Object.fromEntries(Object.entries(ca.ejercicios ?? {}).filter(([id]) => ids.has(id)))
  const faltan = ids.size - Object.keys(ca.ejercicios).length
  if (faltan > 0) console.warn(`RepDB en catalán: ${faltan} ejercicios sin traducir (salen en castellano). Hay que traducirlos y volver a cifrar.`)
  return ca
}

/**
 * Textos en inglés de RepDB (free.en.json), por id: nombre, descripción, pasos y consejos de cada ejercicio, y los
 * nombres de material, músculos y etiquetas. Solo los ids que también están en español (el catálogo es el español).
 * En catalán RepDB no trae textos: van aparte, traducidos por nosotros (textosCatalan).
 */
export function textosIngles(en, es) {
  const ids = new Set(es.exercises.map(e => e.id))
  return {
    version: en.schema_version,
    generado: en.generated_at,
    etiquetas: en.enum_labels ?? {},
    musculos: Object.fromEntries(Object.entries(en.muscles ?? {}).map(([k, m]) => [k, { nombre: m.name, cientifico: m.name_scientific }])),
    material: Object.fromEntries(Object.entries(en.equipment ?? {}).map(([k, m]) => [k, { nombre: m.name }])),
    ejercicios: Object.fromEntries((en.exercises ?? []).filter(e => ids.has(e.id) && e.name).map(e => [e.id, {
      nombre: e.name,
      descripcion: e.description ?? '',
      instrucciones: e.instructions ?? [],
      consejos: e.tips ?? [],
    }])),
  }
}

// Solo al ejecutarlo (node scripts/preparar-repdb.mjs); al importarlo (pruebas) no hace nada.
if (path.basename(process.argv[1] ?? '') === 'preparar-repdb.mjs') {
  main().catch(e => { console.error(e.message ?? e); process.exit(1) })
}
