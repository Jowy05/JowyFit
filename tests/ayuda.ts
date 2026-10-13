// Utilidades de tests: el catálogo real de RepDB si está preparado (npm run repdb).
import fs from 'node:fs'
import path from 'node:path'
import type { Catalogo } from '../src/catalogo/tipos'
import { usarCatalogo } from '../src/catalogo/catalogo'
import { perfilPorDefecto } from '../src/datos/repos'
import type { Perfil } from '../src/datos/tipos'

const RUTA = path.resolve(import.meta.dirname, '..', 'public', 'repdb', 'catalogo.json')
export const hayCatalogo = fs.existsSync(RUTA)

export function catalogoReal(): Catalogo {
  const c = JSON.parse(fs.readFileSync(RUTA, 'utf8')) as Catalogo
  usarCatalogo(c)
  return c
}

/** Perfil parecido al del usuario principal (datos de ejemplo). */
export function perfilEjemplo(cambios: Partial<Perfil> = {}): Perfil {
  return {
    ...perfilPorDefecto(),
    altaCompleta: true,
    nombre: 'Álex',
    nacimiento: '2004-05-10',
    alturaCm: 178,
    diasFijos: [1, 3, 4],
    diasOpcionales: [5],
    zonasPrioridad: ['brazos'],
    preferencia: 'maquinas',
    reps: 'pesadas',
    superseries: true,
    ...cambios,
  }
}
