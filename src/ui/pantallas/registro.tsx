// Qué componente dibuja cada pantalla y cada hoja (los códigos son los del documento de diseño).
// Inicio va en el arranque; el resto se carga al abrirlo por primera vez (y se precarga en segundo plano).
import { lazy, type ComponentType } from 'react'
import type { Ruta } from '../nav'
import { Inicio } from './inicio/Inicio'
import { HojaPeso } from './inicio/HojaPeso'
import { HojaConfirmar } from './HojaConfirmar'

type P = ComponentType<{ ruta: Ruta }>
type Modulo = Record<string, unknown>

const CARGAS: (() => Promise<Modulo>)[] = []
function perezosa(cargar: () => Promise<Modulo>, nombre: string): P {
  CARGAS.push(cargar)
  return lazy(() => cargar().then(m => ({ default: m[nombre] as P })))
}

/** Descarga en segundo plano el código del resto de pantallas para que abrirlas sea instantáneo. */
export function precargarPantallas() {
  for (const c of CARGAS) void c().catch(() => {})
}

const MiPlan = perezosa(() => import('./rutina/MiPlan'), 'MiPlan')
const DetalleDia = perezosa(() => import('./rutina/DetalleDia'), 'DetalleDia')
const Generar = perezosa(() => import('./rutina/Generar'), 'Generar')
const EditarPlan = perezosa(() => import('./rutina/EditarPlan'), 'EditarPlan')
const Biblioteca = perezosa(() => import('./rutina/Biblioteca'), 'Biblioteca')
const Ficha = perezosa(() => import('./rutina/Ficha'), 'Ficha')
const Gimnasios = perezosa(() => import('./rutina/Gimnasios'), 'Gimnasios')
const EditorGimnasio = perezosa(() => import('./rutina/EditorGimnasio'), 'EditorGimnasio')
const HojaMaquina = perezosa(() => import('./rutina/HojaMaquina'), 'HojaMaquina')
const HojaElegirEjercicio = perezosa(() => import('./rutina/HojaElegirEjercicio'), 'HojaElegirEjercicio')
const HojaEmpezar = perezosa(() => import('./entreno/HojaEmpezar'), 'HojaEmpezar')
const Entreno = perezosa(() => import('./entreno/Entreno'), 'Entreno')
const FinEntreno = perezosa(() => import('./entreno/FinEntreno'), 'FinEntreno')
const HojaOcupado = perezosa(() => import('./entreno/HojaOcupado'), 'HojaOcupado')
const HojaLista = perezosa(() => import('./entreno/HojaLista'), 'HojaLista')
const HojaSalirEntreno = perezosa(() => import('./entreno/HojaSalirEntreno'), 'HojaSalirEntreno')
const HojaHerramientas = perezosa(() => import('./entreno/HojasEntreno'), 'HojaHerramientas')
const HojaDiscos = perezosa(() => import('./entreno/HojasEntreno'), 'HojaDiscos')
const HojaCalentamiento = perezosa(() => import('./entreno/HojasEntreno'), 'HojaCalentamiento')
const HojaInstrucciones = perezosa(() => import('./entreno/HojasEntreno'), 'HojaInstrucciones')
const HojaNotaSerie = perezosa(() => import('./entreno/HojasEntreno'), 'HojaNotaSerie')
const DiaComida = perezosa(() => import('./comida/DiaComida'), 'DiaComida')
const HojaAnadir = perezosa(() => import('./comida/HojaAnadir'), 'HojaAnadir')
const Escaner = perezosa(() => import('./comida/Escaner'), 'Escaner')
const Producto = perezosa(() => import('./comida/Producto'), 'Producto')
const Plantillas = perezosa(() => import('./comida/Plantillas'), 'Plantillas')
const HojaPlantilla = perezosa(() => import('./comida/HojaPlantilla'), 'HojaPlantilla')
const HojaComida = perezosa(() => import('./comida/HojaComida'), 'HojaComida')
const Guardados = perezosa(() => import('./comida/Guardados'), 'Guardados')
const Energia = perezosa(() => import('./comida/Energia'), 'Energia')
const Semana = perezosa(() => import('./progreso/Semana'), 'Semana')
const Fuerza = perezosa(() => import('./progreso/Fuerza'), 'Fuerza')
const DetalleEntreno = perezosa(() => import('./progreso/DetalleEntreno'), 'DetalleEntreno')
const Cuerpo = perezosa(() => import('./progreso/Cuerpo'), 'Cuerpo')
const Registrar = perezosa(() => import('./progreso/Registrar'), 'Registrar')
const Fotos = perezosa(() => import('./progreso/Fotos'), 'Fotos')
const Objetivos = perezosa(() => import('./progreso/Objetivos'), 'Objetivos')
const HojaMeta = perezosa(() => import('./progreso/Objetivos'), 'HojaMeta')
const Pasos = perezosa(() => import('./progreso/Pasos'), 'Pasos')
const HojaTrote = perezosa(() => import('./progreso/Pasos'), 'HojaTrote')
const Perfil = perezosa(() => import('./perfil/Perfil'), 'Perfil')
const SeccionPerfil = perezosa(() => import('./perfil/SeccionPerfil'), 'SeccionPerfil')
const Ajustes = perezosa(() => import('./perfil/Ajustes'), 'Ajustes')
const Creditos = perezosa(() => import('./perfil/Creditos'), 'Creditos')

export const PANTALLAS: Record<string, P> = {
  ini: Inicio,
  rut: MiPlan,
  'rut-dia': DetalleDia,
  'rut-gen': Generar,
  'rut-edit': EditarPlan,
  'rut-ej': Biblioteca,
  'rut-ficha': Ficha,
  'rut-gym': Gimnasios,
  'rut-gym-edit': EditorGimnasio,
  entreno: Entreno,
  'ses-fin': FinEntreno,
  com: DiaComida,
  'com-scan': Escaner,
  'com-prod': Producto,
  'com-plant': Plantillas,
  'com-guard': Guardados,
  'com-energia': Energia,
  'pro-sem': Semana,
  'pro-fuerza': Fuerza,
  'pro-entreno': DetalleEntreno,
  'pro-cuerpo': Cuerpo,
  'pro-reg': Registrar,
  'pro-fotos': Fotos,
  'pro-obj': Objetivos,
  'pro-pasos': Pasos,
  per: Perfil,
  'per-sec': SeccionPerfil,
  aju: Ajustes,
  creditos: Creditos,
}

export const HOJAS: Record<string, P> = {
  'sheet-peso': HojaPeso,
  'sheet-ses1': HojaEmpezar,
  'sheet-ocup': HojaOcupado,
  'sheet-lista': HojaLista,
  'sheet-salir-entreno': HojaSalirEntreno,
  'sheet-tools': HojaHerramientas,
  'sheet-discos': HojaDiscos,
  'sheet-cal': HojaCalentamiento,
  'sheet-instr': HojaInstrucciones,
  'sheet-nota-serie': HojaNotaSerie,
  'sheet-add': HojaAnadir,
  'sheet-plant': HojaPlantilla,
  'sheet-comida': HojaComida,
  'sheet-maq': HojaMaquina,
  'sheet-elegir': HojaElegirEjercicio,
  'sheet-meta': HojaMeta,
  'sheet-trote': HojaTrote,
  'sheet-confirmar': HojaConfirmar,
}
