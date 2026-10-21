// Textos de la demo: el castellano va dentro; el catalán y el inglés se cargan solo si hacen falta.
import { crearTextos } from '../../landing/i18n/idioma'
import es from './es'

export type Clave = keyof typeof es
export const textos = crearTextos(es, { ca: () => import('./ca'), en: () => import('./en') })
export const t = textos.t
