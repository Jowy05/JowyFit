// Lee un PDF del informe para las pruebas: cuántas páginas tiene, el texto de cada una y los metadatos.
// El texto se saca de lo que escribe pdf-lib con la Helvetica estándar («<hex> Tj» en codificación WinAnsi).
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib'

/** Los caracteres de WinAnsi entre 0x80 y 0x9F (el resto coincide con Latin-1). */
const WIN = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

function bytesDe(stream) {
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode()
  return stream.getContents()
}

function textoDe(s) {
  const trozos = []
  for (const m of s.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
    let t = ''
    for (let i = 0; i < m[1].length; i += 2) {
      const b = Number.parseInt(m[1].slice(i, i + 2), 16)
      t += WIN[b] ?? String.fromCharCode(b)
    }
    trozos.push(t)
  }
  return trozos.join(' ')
}

/** Las órdenes de dibujo de cada página, como texto. */
function contenidosDe(doc) {
  return doc.getPages().map(p => {
    const c = p.node.Contents()
    if (!c) return ''
    const streams = c instanceof PDFArray ? c.asArray().map(x => p.node.context.lookup(x)) : [c]
    return streams.map(st => new TextDecoder('latin1').decode(bytesDe(st))).join(' ')
  })
}

/** @param {Uint8Array} bytes */
export async function contenidos(bytes) {
  return contenidosDe(await PDFDocument.load(bytes, { updateMetadata: false }))
}

/** @param {Uint8Array} bytes */
export async function leerPdf(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const textos = contenidosDe(doc).map(textoDe)
  return {
    paginas: doc.getPageCount(),
    textos,
    texto: textos.join('\n'),
    titulo: doc.getTitle() ?? '',
    autor: doc.getAuthor() ?? '',
    productor: doc.getProducer() ?? '',
    tamanos: doc.getPages().map(p => p.getSize()),
  }
}
