// Clave que puede venir del usuario: solo cuentan las propias del objeto («constructor» o «__proto__» no).
export function propio<T>(o: Readonly<Record<string, T>> | null | undefined, clave: string): T | undefined {
  return o != null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, clave) ? o[clave] : undefined
}
