// La clave de las copias con contraseña, en una base aparte: así no entra en la copia ni en «exportar». Se guarda la
// clave ya sacada de la contraseña, no extraíble (ni la app puede leerla, solo usarla), nunca la contraseña.
// La copia semanal se cifra con ella sin preguntar nada.
import Dexie, { type EntityTable } from 'dexie'
import { claveDe, type ClaveCopias } from './cifrado'

type FilaClave = ClaveCopias & { id: 'copias' }

class BaseClaves extends Dexie {
  claves!: EntityTable<FilaClave, 'id'>
  constructor() {
    super('jowyfit-claves')
    this.version(1).stores({ claves: 'id' })
  }
}

const base = new BaseClaves()

export async function leerClaveCopias(): Promise<ClaveCopias | null> {
  const f = await base.claves.get('copias')
  return f ? { clave: f.clave, sal: f.sal, vueltas: f.vueltas } : null
}

/** La deja puesta: al ponerla o al recuperar una copia con contraseña. */
export async function guardarClaveCopias(c: ClaveCopias): Promise<void> {
  await base.claves.put({ id: 'copias', ...c })
}

export async function ponerContrasena(contrasena: string): Promise<void> {
  await guardarClaveCopias(await claveDe(contrasena))
}

/** Quitarla desde Ajustes y al borrar todos los datos. */
export async function quitarContrasena(): Promise<void> {
  await base.claves.clear()
}
