// Informe en PDF: dibuja el Informe (informe/calculo) en A4 vertical con pdf-lib y la Helvetica estándar.
// pdf-lib se carga con import() al crear el PDF, para que no pese al abrir la app. Diseño: docs/INFORME-PDF-DISENO.md.
import type { Informe, RangoInforme } from '../calculo/tipos'
import { archivoPeriodo } from '../calculo/periodo'
import { idioma, t } from '../../i18n'
import { textoPdf } from './texto'
import { ESTILO_POR_DEFECTO, temaDe, type NombreEstilo, type Tema } from './lienzo'
import { ICONO_PNG } from './icono'
import { Maqueta } from './piezas'
import { paginaResumen } from './paginas/resumen'
import { paginaEntrenos, paginaFuerza, paginaMeses } from './paginas/entrenos'
import { paginaComidaCuerpoPasos } from './paginas/comidaCuerpoPasos'
import { paginaAnexo } from './paginas/anexo'
import { paginaTuDia } from './paginas/tuDia'

/** Nombre del archivo: JowyFit-informe-<periodo>-<AAAA-MM-DD>.pdf, con el periodo en el idioma de la app (sin el nombre de la persona). */
export const nombrePdf = (r: Pick<RangoInforme, 'periodo' | 'hoy'>) => t('JowyFit-informe-{periodo}-{fecha}.pdf', { periodo: archivoPeriodo(r.periodo), fecha: r.hoy })

/** Idioma del PDF (para los lectores de pantalla). */
const LENGUA = { es: 'es-ES', ca: 'ca-ES', en: 'en-US' } as const

type OpcionesPdf = {
  /** Versión de la app para los metadatos («JowyFit 0.1.6»). */
  version?: string
  /** Fecha de creación de los metadatos (por defecto, ahora). */
  creado?: Date
  /** Estética del informe (por defecto, la que usa la app: Clínico). */
  estilo?: NombreEstilo
}

/** Crea el PDF del informe. Solo lleva las secciones marcadas que tienen datos (el resumen va siempre). */
export async function crearPdf(inf: Informe, o: OpcionesPdf = {}): Promise<Uint8Array> {
  const lib = await import('pdf-lib')
  return dibujar(lib, inf, o, temaDe(o.estilo ?? ESTILO_POR_DEFECTO))
}

async function dibujar(lib: typeof import('pdf-lib'), inf: Informe, o: OpcionesPdf, tema: Tema): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  const [normal, negrita, cursiva, titulo] = await Promise.all([
    doc.embedFont(lib.StandardFonts.Helvetica),
    doc.embedFont(lib.StandardFonts.HelveticaBold),
    doc.embedFont(lib.StandardFonts.HelveticaOblique),
    tema.estilo.titulos === 'times' ? doc.embedFont(lib.StandardFonts.TimesRomanBold) : null,
  ])
  // El logo es el icono de la app (icono.ts lo genera scripts/iconos.mjs).
  const icono = await doc.embedPng(Uint8Array.from(atob(ICONO_PNG), c => c.charCodeAt(0)))
  const maq = new Maqueta(lib, doc, { normal, negrita, cursiva, titulo: titulo ?? negrita }, inf, tema, icono)

  if (inf.tuDia) paginaTuDia(maq, inf.tuDia)
  else {
    paginaResumen(maq)
    const fe = inf.entrenos ? paginaEntrenos(maq, inf.entrenos) : null
    // En la semana hay poco de cada: la fuerza sigue debajo de los entrenos en vez de dejar media página en blanco.
    if (inf.fuerza) paginaFuerza(maq, inf.fuerza, inf.periodo === 'semana' ? fe : null)
    // Mes a mes (Todo, 60 días o más): después de la fuerza; sin entrenos, después del cuerpo.
    const meses = inf.meses && (inf.fuerza || inf.cuerpo) ? inf.meses : null
    if (meses && inf.fuerza) paginaMeses(maq, meses, true, !!inf.cuerpo)
    if (inf.comida || inf.cuerpo || inf.pasos) paginaComidaCuerpoPasos(maq)
    if (meses && !inf.fuerza) paginaMeses(maq, meses, false, true)
  }
  paginaAnexo(maq)
  maq.pies()

  const cab = inf.cabecera
  doc.setTitle(textoPdf(cab.tituloPdf))
  doc.setAuthor(textoPdf(cab.autor))
  doc.setSubject(textoPdf(`${cab.titulo} · ${cab.periodo}`))
  doc.setCreator('JowyFit')
  doc.setProducer(textoPdf(`JowyFit${o.version ? ` ${o.version}` : ''}`))
  doc.setLanguage(LENGUA[idioma()])
  const fecha = o.creado ?? new Date()
  doc.setCreationDate(fecha)
  doc.setModificationDate(fecha)
  return doc.save()
}
