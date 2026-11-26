// Exportación ligera en CSV (entrenos, comidas, medidas) y JSON sin fotos, reutilizando el guardado/compartido nativo.
import { leerDatosExportLigero } from '../datos/consultas'
import { cargarCatalogo, ejercicio, nombreEjercicio } from '../catalogo/catalogo'
import { csvComidas, csvEntrenos, csvMedidas, jsonLigero } from '../dominio/exportar'
import { hoyISO } from '../dominio/fechas'
import { capacidades, compartirArchivo, compartirNativo, guardarArchivoConCarpeta } from '../plataforma'

export type TipoExportLigero = 'entrenos' | 'comidas' | 'medidas' | 'json'

export type ResultadoExportLigero = {
  nombre: string
  resultado: 'guardado' | 'descargas' | 'compartido' | 'cancelado'
}

/** Genera el archivo ligero elegido y lo guarda (Android/Web) o comparte (Apple). */
export async function exportarLigero(tipo: TipoExportLigero): Promise<ResultadoExportLigero> {
  const [datos] = await Promise.all([
    leerDatosExportLigero(),
    tipo === 'entrenos' ? cargarCatalogo().catch(() => null) : Promise.resolve(null),
  ])
  const fecha = hoyISO()
  let contenido: string
  let nombre: string
  let mime: string
  if (tipo === 'entrenos') {
    contenido = csvEntrenos(datos.sesiones, id => (ejercicio(id) ? nombreEjercicio(id) : id))
    nombre = `JowyFit-entrenos-${fecha}.csv`
    mime = 'text/csv;charset=utf-8'
  } else if (tipo === 'comidas') {
    contenido = csvComidas(datos.comidas)
    nombre = `JowyFit-comidas-${fecha}.csv`
    mime = 'text/csv;charset=utf-8'
  } else if (tipo === 'medidas') {
    contenido = csvMedidas(datos.mediciones)
    nombre = `JowyFit-medidas-${fecha}.csv`
    mime = 'text/csv;charset=utf-8'
  } else {
    contenido = jsonLigero(datos)
    nombre = `JowyFit-datos-${fecha}.json`
    mime = 'application/json;charset=utf-8'
  }
  const bytes = new TextEncoder().encode(contenido)
  const cap = capacidades()
  if (cap.apple) {
    const r = await compartirArchivo(nombre, bytes, mime)
    if (r === 'compartido') return { nombre, resultado: 'compartido' }
    if (r === 'cancelado') return { nombre, resultado: 'cancelado' }
  }
  try {
    const destino = await guardarArchivoConCarpeta(nombre, bytes, mime)
    return { nombre: destino.nombre, resultado: destino.carpeta === 'descargas' ? 'descargas' : 'guardado' }
  } catch (e) {
    if (!cap.compartirNativo) throw e
    const r = await compartirNativo(nombre, bytes, nombre, mime)
    return { nombre, resultado: r === 'compartido' ? 'compartido' : 'cancelado' }
  }
}
