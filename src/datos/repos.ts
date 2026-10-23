// Acceso a los datos: valores por defecto y operaciones habituales.
import { dispositivoApple } from '../plataforma'
import { db } from './db'
import type { Ajustes, Gimnasio, Guardado, MarcaEjercicio, Perfil, Plantilla, Rutina } from './tipos'
import { t, tk } from '../i18n'

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
    // En iPhone no hay vibración ni aviso con el móvil bloqueado: el sonido viene encendido.
    sonido: dispositivoApple() != null,
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
    semanaSuave: null,
    suavePospuesta: null,
  }
}

/** Gimnasio nuevo con material básico ya marcado (lo que tiene casi cualquier gimnasio). */
export function gimnasioNuevo(nombre = t('Mi gimnasio')): Gimnasio {
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

/**
 * Botones de picoteo y bebida de un toque (valores aproximados; se pueden editar). Se guardan en castellano
 * (se crean al abrir la app la primera vez, antes de elegir idioma): marcados con tk() para pintarlos con t(nombre).
 */
export function plantillasIniciales(): Plantilla[] {
  return [
    { nombre: tk('Bolsa de patatas grande'), kcal: 800, proteina: 9, tipo: 'picoteo', usos: 0 },
    { nombre: tk('Bolsa de patatas pequeña'), kcal: 210, proteina: 2, tipo: 'picoteo', usos: 0 },
    { nombre: tk('Quicos (bolsa)'), kcal: 450, proteina: 8, tipo: 'picoteo', usos: 0 },
    { nombre: tk('Bebida energética'), kcal: 230, proteina: 0, cafeina: 160, tipo: 'bebida', usos: 0 },
    { nombre: tk('Energética sin azúcar'), kcal: 10, proteina: 0, cafeina: 160, tipo: 'bebida', usos: 0 },
    { nombre: tk('Refresco zero'), kcal: 1, proteina: 0, cafeina: 0, tipo: 'bebida', usos: 0 },
    { nombre: tk('Café'), kcal: 5, proteina: 0, cafeina: 80, tipo: 'bebida', usos: 0 },
    { nombre: tk('Batido de proteína'), kcal: 120, proteina: 24, tipo: 'comida', franja: 'merienda', usos: 0 },
  ]
}

export async function leerPerfil(): Promise<Perfil | undefined> {
  return db.perfil.get('yo')
}

// Leer y guardar van en una misma transacción: si no, dos cambios a la vez (dos interruptores seguidos, la báscula y
// la copia al abrir la app) se pisan y se pierde uno.
export async function guardarPerfil(cambios: Partial<Perfil>): Promise<Perfil> {
  return db.transaction('rw', db.perfil, async () => {
    const actual = (await leerPerfil()) ?? perfilPorDefecto()
    const nuevo = { ...actual, ...cambios, id: 'yo' as const }
    await db.perfil.put(nuevo)
    return nuevo
  })
}

export async function leerAjustes(): Promise<Ajustes> {
  const a = await db.ajustes.get('app')
  if (a) return { ...ajustesPorDefecto(), ...a, noti: { ...ajustesPorDefecto().noti, ...a.noti } }
  const d = ajustesPorDefecto()
  await db.ajustes.put(d)
  return d
}

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<Ajustes> {
  return db.transaction('rw', db.ajustes, async () => {
    const nuevo = { ...(await leerAjustes()), ...cambios, id: 'app' as const }
    await db.ajustes.put(nuevo)
    return nuevo
  })
}

export async function marcaDe(id: string): Promise<MarcaEjercicio> {
  return (await db.marcas.get(id)) ?? { id }
}

export async function marcar(id: string, cambios: Partial<MarcaEjercicio>) {
  await db.transaction('rw', db.marcas, async () => {
    const m = { ...(await marcaDe(id)), ...cambios, id }
    await db.marcas.put(m)
  })
}

/** Pide al navegador que no borre los datos (importante en iPhone). */
export async function pedirPersistencia(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}

/** Asegura que hay ajustes y plantillas iniciales (primera vez que se abre la app). */
export async function prepararBase() {
  await leerAjustes()
  if ((await db.plantillas.count()) === 0) await db.plantillas.bulkAdd(plantillasIniciales())
}

// Solo leen (sin crear los ajustes que falten): sirven también dentro de useLiveQuery.
/** El gimnasio elegido en Ajustes o, si no hay o se borró, el primero. */
export async function gimnasioActivo(): Promise<Guardado<Gimnasio> | undefined> {
  const id = (await db.ajustes.get('app'))?.gimnasioActivo
  const g = id != null ? await db.gimnasios.get(id) : undefined
  return g ?? db.gimnasios.toCollection().first()
}

/** La rutina activa (la última, si por lo que sea hay más de una). */
export async function rutinaActiva(): Promise<Guardado<Rutina> | undefined> {
  return db.rutinas.filter(x => x.activa).last()
}
