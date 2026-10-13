// Prepara el dataset de ejercicios RepDB (plan gratuito) para meterlo dentro de la app.
// La licencia no permite redistribuirlo: se descarga al compilar y NO se sube al repositorio.
//   node scripts/preparar-repdb.mjs          → descarga (si hace falta) y genera public/repdb/
// Salida:
//   public/repdb/catalogo.json   ejercicios en español + etiquetas + músculos + material
//   public/repdb/img/*.webp      imágenes 512×512 (inicio / final / única)
//   public/repdb/mini/*.webp     miniaturas 160×160 para listas
//   public/repdb/maq/*.webp      imágenes de material y máquinas
//   public/repdb/mus/*.webp      diagramas de músculos
import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import sharp from 'sharp'

const RAIZ = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(RAIZ, '.cache', 'repdb')
const ZIP = path.join(CACHE, 'repdb-free.zip')
const SALIDA = path.join(RAIZ, 'public', 'repdb')
const URL_ZIP = 'https://cdn.repdb.co/repdb-assets/site/repdb-free.zip'

async function descargar() {
  if (fs.existsSync(ZIP) && fs.statSync(ZIP).size > 1_000_000) return
  fs.mkdirSync(CACHE, { recursive: true })
  console.log('Descargando RepDB…')
  const r = await fetch(URL_ZIP)
  if (!r.ok) throw new Error(`No se pudo descargar RepDB: HTTP ${r.status}`)
  fs.writeFileSync(ZIP, Buffer.from(await r.arrayBuffer()))
}

function limpiar(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

async function main() {
  await descargar()
  const archivos = unzipSync(new Uint8Array(fs.readFileSync(ZIP)))
  const es = JSON.parse(new TextDecoder().decode(archivos['free.es.json']))

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
  console.log(`RepDB listo: ${ejercicios.length} ejercicios, ${n} imágenes, ${Object.keys(material).length} tipos de material, ${Object.keys(musculos).length} músculos.`)
}

main().catch(e => { console.error(e); process.exit(1) })
