// Inglés (EE. UU., sencillo): junta los diccionarios de todas las zonas. Se carga con import() solo si la app está en este idioma.
import type { Diccionario } from '../tipos'
import comun from './comun'
import inicio from './inicio'
import entreno from './entreno'
import rutina from './rutina'
import comida from './comida'
import progreso from './progreso'
import perfil from './perfil'
import informe from './informe'

const diccionario: Diccionario = { ...comun, ...inicio, ...entreno, ...rutina, ...comida, ...progreso, ...perfil, ...informe }
export default diccionario
