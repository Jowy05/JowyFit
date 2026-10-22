import type { useNav } from '../../app/nav'

/** «Restaurar» solo sirve si se minimizó en esta visita; si la app se cerró a mitad, se abre de nuevo. */
export function abrirEntreno(nav: ReturnType<typeof useNav>) {
  if (nav.estado.minimizada) nav.restaurar()
  else nav.completa('entreno')
}
