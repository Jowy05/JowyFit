// Nombres de las copias de seguridad y cuántas automáticas se guardan. Sin base de datos ni plataforma: lo usan la
// validación de copias, los servicios y la pantalla.

/** Cuántas copias automáticas se guardan (las más nuevas; 0 = todas) y lo que vale si no se ha elegido. */
export const OPCIONES_COPIAS_AUTO = [4, 8, 0] as const
export type CopiasAuto = (typeof OPCIONES_COPIAS_AUTO)[number]
export const COPIAS_AUTO: CopiasAuto = 4

const AUTO = 'jowyfit-auto-'
const CIFRADA = '-cifrada.jowyfit'
// También «-cifrada (1).jowyfit»: un duplicado que renombró el móvil o Drive sigue siendo una copia cifrada.
const CIFRADA_RENOMBRADA = /-cifrada[^.]*\.jowyfit$/
const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Nombre del archivo de la copia, con la fecha y la hora: dos copias del mismo día no se pisan.
 * Si ya existe uno con ese nombre (dos en el mismo minuto), se añade «-2», «-3»… La copia semanal empieza por
 * «jowyfit-auto-» y la cifrada acaba en «-cifrada»: la lista lo sabe sin abrir el archivo.
 */
export function nombreCopia(fecha = new Date(), existentes?: Iterable<string>, tipo: { auto?: boolean; cifrada?: boolean } = {}): string {
  const base = `${tipo.auto ? AUTO : 'jowyfit-'}${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}-${dos(fecha.getHours())}${dos(fecha.getMinutes())}`
  const fin = tipo.cifrada ? CIFRADA : '.jowyfit'
  const usados = new Set(existentes ?? [])
  let nombre = base + fin
  for (let i = 2; usados.has(nombre); i++) nombre = `${base}-${i}${fin}`
  return nombre
}

export const esCopiaAuto = (nombre: string) => nombre.startsWith(AUTO)
export const esCifradaPorNombre = (nombre: string) => CIFRADA_RENOMBRADA.test(nombre)

/**
 * Las copias automáticas, de la más nueva a la más vieja, por la fecha de su nombre (la del archivo cambia si se
 * copia o se mueve). Dentro del mismo minuto, «-2» va después que la primera.
 */
export function automaticasDeMasNueva(nombres: string[]): string[] {
  const orden = (n: string) => {
    const m = /^jowyfit-auto-(\d{4}-\d{2}-\d{2}-\d{4})(?:-(\d+))?/.exec(n)
    return m ? `${m[1]}-${(m[2] ?? '1').padStart(4, '0')}` : ''
  }
  return nombres.filter(esCopiaAuto).sort((a, b) => orden(b).localeCompare(orden(a)))
}
