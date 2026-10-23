// Base de datos local (IndexedDB con Dexie). Nada sale del móvil.
import Dexie, { type EntityTable } from 'dexie'
import type {
  Ajustes, Comida, DiaSuplementos, Foto, Gimnasio, Guardado, MarcaEjercicio, Medicion, Meta, PasosDia, Perfil, Plantilla, Producto, Rutina, Sesion,
} from './tipos'

export class BaseJowyFit extends Dexie {
  perfil!: EntityTable<Perfil, 'id'>
  ajustes!: EntityTable<Ajustes, 'id'>
  mediciones!: EntityTable<Guardado<Medicion>, 'id'>
  fotos!: EntityTable<Guardado<Foto>, 'id'>
  gimnasios!: EntityTable<Guardado<Gimnasio>, 'id'>
  marcas!: EntityTable<MarcaEjercicio, 'id'>
  rutinas!: EntityTable<Guardado<Rutina>, 'id'>
  sesiones!: EntityTable<Guardado<Sesion>, 'id'>
  comidas!: EntityTable<Guardado<Comida>, 'id'>
  plantillas!: EntityTable<Guardado<Plantilla>, 'id'>
  productos!: EntityTable<Producto, 'codigo'>
  pasos!: EntityTable<PasosDia, 'fecha'>
  suplementos!: EntityTable<DiaSuplementos, 'fecha'>
  metas!: EntityTable<Guardado<Meta>, 'id'>

  constructor(nombre = 'jowyfit') {
    super(nombre)
    this.version(1).stores({
      perfil: 'id',
      ajustes: 'id',
      mediciones: '++id, fecha, origen',
      fotos: '++id, fecha, pose',
      gimnasios: '++id, nombre',
      marcas: 'id',
      rutinas: '++id, activa, creada',
      sesiones: '++id, fecha, estado, letra',
      comidas: '++id, fecha, franja, tipo',
      plantillas: '++id, tipo, usos, nombre',
      productos: 'codigo, guardado',
      pasos: 'fecha',
      suplementos: 'fecha',
      metas: '++id, tipo',
    })
  }
}

export const db = new BaseJowyFit()

export const TABLAS = ['perfil', 'ajustes', 'mediciones', 'fotos', 'gimnasios', 'marcas', 'rutinas', 'sesiones', 'comidas', 'plantillas', 'productos', 'pasos', 'suplementos', 'metas'] as const
export type NombreTabla = (typeof TABLAS)[number]
