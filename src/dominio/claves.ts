// Leer de un objeto por una clave que puede venir del usuario (nombre de un suplemento, una zona de una copia…).
// Con obj[clave], nombres como «constructor», «toString» o «__proto__» devolvían cosas del propio JavaScript
// (funciones) y la pantalla fallaba. Aquí solo cuentan las claves que el objeto tiene de verdad.
export function propio<T>(o: Readonly<Record<string, T>> | null | undefined, clave: string): T | undefined {
  return o != null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, clave) ? o[clave] : undefined
}
