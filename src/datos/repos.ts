// Acceso a los datos: valores por defecto y operaciones habituales.
import { db } from './db'
import type { Ajustes, Gimnasio, MarcaEjercicio, Perfil, Plantilla } from './tipos'
import { hoyISO } from '../dominio/fechas'

export function perfilPorDefecto(): Perfil {
  return {
    id: 'yo',
    creado: new Date().toISOString(),
    altaCompleta: false,
    nombre: '',
    nacimiento: '2000-01-01',
    sexo: 'hombre',
    alturaCm: 175,
    objetivo: 'recomposicion',
    prioridades: [],
    zonasPrioridad: [],
    nivel: 'vuelvo',
    referencias: {},
    diasFijos: [1, 3, 4],
    diasOpcionales: [5],
    horaEntreno: '05:30',
    transporte: 'andando',
    horaLimite: { coche: '06:20', andando: '06:45' },
    minutosNormal: 60,
    minutosCorta: 45,
    horaDormir: '22:00',
    enAyunas: true,
    sesionPerdida: 'sabado',
    zonasSensibles: [],
    lesiones: '',
    condiciones: '',
    preferencia: 'mezcla',
    reps: 'mezcla',
    superseries: true,
    alFallo: false,
    core: true,
    cardio: 'pasos',
    comidasDia: 3,
    franjasHambre: [],
    bebidas: [],
    suplementos: [],
    trabajo: 'sentado',
    pasosObjetivo: 8000,
    diasPesaje: [1, 5],
    fotosCadaSemanas: 2,
  }
}

export function ajustesPorDefecto(): Ajustes {
  return {
    id: 'app',
    gimnasioActivo: null,
    descansoCompuesto: 150,
    descansoAislamiento: 90,
    vibrar: true,
    sonido: false,
    pantallaEncendida: true,
    calentamiento: true,
    avisosSeguridad: true,
    mostrarKcal: true,
    kcalManual: null,
    proteinaManual: null,
    cafeinaLimite: 400,
    cafeinaHoraTope: '16:00',
    fuentePasos: 'manual',
    noti: {
      dormir: true,
      pesarse: true,
      pesarseHora: '07:00',
      batido: false,
      batidoHora: '17:00',
      creatina: false,
      creatinaHora: '14:00',
      copia: true,
      fotos: false,
      domingo: false,
    },
    copiaAuto: true,
    ultimaCopia: null,
    ultimoAjusteEnergia: null,
    recolocadas: [],
    inicio: null,
  }
}

/** Gimnasio nuevo con material básico ya marcado (lo que tiene casi cualquier gimnasio). */
export function gimnasioNuevo(nombre = 'Mi gimnasio'): Gimnasio {
  return {
    nombre,
    notas: '',
    material: ['dumbbell', 'barbell', 'ez_bar', 'flat_bench', 'cable', 'pull_up_bar', 'leg_press', 'smith_machine', 'lat_pulldown_machine', 'seated_row_machine', 'chest_press_machine', 'shoulder_press_machine', 'leg_curl', 'treadmill', 'stationary_bike'],
    propias: [],
    mancuernas: [{ desde: 2, hasta: 10, paso: 1 }, { desde: 12, hasta: 50, paso: 2 }],
    discos: [0.5, 1, 1.25, 2.5, 5, 10, 15, 20],
    barraKg: 20,
    creado: new Date().toISOString(),
  }
}

/** Botones de picoteo y bebida de un toque (valores aproximados; se pueden editar). */
export function plantillasIniciales(): Plantilla[] {
  return [
    { nombre: 'Bolsa de patatas grande', kcal: 800, proteina: 9, tipo: 'picoteo', usos: 0 },
    { nombre: 'Bolsa de patatas pequeña', kcal: 210, proteina: 2, tipo: 'picoteo', usos: 0 },
    { nombre: 'Quicos (bolsa)', kcal: 450, proteina: 8, tipo: 'picoteo', usos: 0 },
    { nombre: 'Bebida energética', kcal: 230, proteina: 0, cafeina: 160, tipo: 'bebida', usos: 0 },
    { nombre: 'Energética sin azúcar', kcal: 10, proteina: 0, cafeina: 160, tipo: 'bebida', usos: 0 },
    { nombre: 'Refresco zero', kcal: 1, proteina: 0, cafeina: 0, tipo: 'bebida', usos: 0 },
    { nombre: 'Café', kcal: 5, proteina: 0, cafeina: 80, tipo: 'bebida', usos: 0 },
    { nombre: 'Batido de proteína', kcal: 120, proteina: 24, tipo: 'comida', franja: 'merienda', usos: 0 },
  ]
}

export async function leerPerfil(): Promise<Perfil | undefined> {
  return db.perfil.get('yo')
}

export async function guardarPerfil(cambios: Partial<Perfil>): Promise<Perfil> {
  const actual = (await leerPerfil()) ?? perfilPorDefecto()
  const nuevo = { ...actual, ...cambios, id: 'yo' as const }
  await db.perfil.put(nuevo)
  return nuevo
}

export async function leerAjustes(): Promise<Ajustes> {
  const a = await db.ajustes.get('app')
  if (a) return { ...ajustesPorDefecto(), ...a, noti: { ...ajustesPorDefecto().noti, ...a.noti } }
  const d = ajustesPorDefecto()
  await db.ajustes.put(d)
  return d
}

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<Ajustes> {
  const nuevo = { ...(await leerAjustes()), ...cambios, id: 'app' as const }
  await db.ajustes.put(nuevo)
  return nuevo
}

export async function marcaDe(id: string): Promise<MarcaEjercicio> {
  return (await db.marcas.get(id)) ?? { id }
}

export async function marcar(id: string, cambios: Partial<MarcaEjercicio>) {
  const m = { ...(await marcaDe(id)), ...cambios, id }
  await db.marcas.put(m)
}

/** Asegura que hay ajustes y plantillas iniciales (primera vez que se abre la app). */
export async function prepararBase() {
  await leerAjustes()
  if ((await db.plantillas.count()) === 0) await db.plantillas.bulkAdd(plantillasIniciales())
}

export async function gimnasioActivo(): Promise<Gimnasio | undefined> {
  const a = await leerAjustes()
  if (a.gimnasioActivo != null) {
    const g = await db.gimnasios.get(a.gimnasioActivo)
    if (g) return g
  }
  return db.gimnasios.toCollection().first()
}

export const hoy = hoyISO
