// Capas que se pintan fuera de la navegación (HojaSuelta: los tres toques de una molestia, la contraseña de las
// copias): el botón atrás del móvil las cierra primero, en vez de salir de la pantalla y perder lo que había a medias.
import { useEffect } from 'react'

const abiertas: (() => void)[] = []

/** Mientras `abierta`, «atrás» llama a `cerrar`. `cerrar` tiene que ser estable (useCallback). */
export function useCerrarConAtras(abierta: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!abierta) return
    abiertas.push(cerrar)
    return () => {
      const i = abiertas.lastIndexOf(cerrar)
      if (i >= 0) abiertas.splice(i, 1)
    }
  }, [abierta, cerrar])
}

/** Cierra la última capa abierta; false si no había ninguna. */
export function cerrarCapa(): boolean {
  const cerrar = abiertas.at(-1)
  cerrar?.()
  return !!cerrar
}
