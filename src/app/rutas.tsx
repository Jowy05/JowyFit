// Qué componente dibuja cada pantalla y cada hoja (los códigos son los del documento de diseño).
// Inicio va en el arranque; el resto se carga al abrirlo por primera vez (y se precarga en segundo plano).
import { lazy, type ComponentType } from 'react'
import type { CodigoHoja, CodigoPantalla, CodigoRuta, Ruta } from './nav'
import { Inicio } from '../pantallas/inicio/Inicio'
import { HojaPeso } from '../pantallas/inicio/HojaPeso'
import { HojaConfirmar } from '../ui/HojaConfirmar'
// El tutorial ya va en el arranque (App lo pinta): su hoja de bienvenida, sin carga aparte.
import { HojaOfertaTutorial } from '../ui/tutorial/Tutorial'

type P<C extends CodigoRuta> = ComponentType<{ ruta: Ruta<C> }>

const CARGAS: (() => Promise<unknown>)[] = []
function perezosa<Props extends object>(cargar: () => Promise<ComponentType<Props>>) {
  CARGAS.push(cargar)
  return lazy(() => cargar().then(c => ({ default: c })))
}

/** Descarga en segundo plano el código del resto de pantallas para que abrirlas sea instantáneo. */
export function precargarPantallas() {
  for (const c of CARGAS) void c().catch(() => {})
}

const MiPlan = perezosa(() => import('../pantallas/rutina/MiPlan').then(m => m.MiPlan))
const DetalleDia = perezosa(() => import('../pantallas/rutina/DetalleDia').then(m => m.DetalleDia))
const Generar = perezosa(() => import('../pantallas/rutina/Generar').then(m => m.Generar))
const EditarPlan = perezosa(() => import('../pantallas/rutina/EditarPlan').then(m => m.EditarPlan))
const Biblioteca = perezosa(() => import('../pantallas/rutina/Biblioteca').then(m => m.Biblioteca))
const Ficha = perezosa(() => import('../pantallas/rutina/Ficha').then(m => m.Ficha))
const Gimnasios = perezosa(() => import('../pantallas/rutina/Gimnasios').then(m => m.Gimnasios))
const EditorGimnasio = perezosa(() => import('../pantallas/rutina/EditorGimnasio').then(m => m.EditorGimnasio))
const HojaMaquina = perezosa(() => import('../pantallas/rutina/HojaMaquina').then(m => m.HojaMaquina))
const HojaElegirEjercicio = perezosa(() => import('../pantallas/rutina/HojaElegirEjercicio').then(m => m.HojaElegirEjercicio))
const HojaEmpezar = perezosa(() => import('../pantallas/entreno/HojaEmpezar').then(m => m.HojaEmpezar))
const Entreno = perezosa(() => import('../pantallas/entreno/Entreno').then(m => m.Entreno))
const FinEntreno = perezosa(() => import('../pantallas/entreno/FinEntreno').then(m => m.FinEntreno))
const HojaOcupado = perezosa(() => import('../pantallas/entreno/HojaOcupado').then(m => m.HojaOcupado))
const HojaLista = perezosa(() => import('../pantallas/entreno/HojaLista').then(m => m.HojaLista))
const HojaSalirEntreno = perezosa(() => import('../pantallas/entreno/HojaSalirEntreno').then(m => m.HojaSalirEntreno))
const HojaHerramientas = perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaHerramientas))
const HojaDiscos = perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaDiscos))
const HojaCalentamiento = perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaCalentamiento))
const HojaInstrucciones = perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaInstrucciones))
const HojaNotaSerie = perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaNotaSerie))
const DiaComida = perezosa(() => import('../pantallas/comida/DiaComida').then(m => m.DiaComida))
const HojaAnadir = perezosa(() => import('../pantallas/comida/HojaAnadir').then(m => m.HojaAnadir))
const HojaSuplemento = perezosa(() => import('../pantallas/comida/HojaSuplemento').then(m => m.HojaSuplemento))
const Escaner = perezosa(() => import('../pantallas/comida/Escaner').then(m => m.Escaner))
const Producto = perezosa(() => import('../pantallas/comida/Producto').then(m => m.Producto))
const Plantillas = perezosa(() => import('../pantallas/comida/Plantillas').then(m => m.Plantillas))
const HojaPlantilla = perezosa(() => import('../pantallas/comida/HojaPlantilla').then(m => m.HojaPlantilla))
const HojaComida = perezosa(() => import('../pantallas/comida/HojaComida').then(m => m.HojaComida))
const Guardados = perezosa(() => import('../pantallas/comida/Guardados').then(m => m.Guardados))
const Energia = perezosa(() => import('../pantallas/comida/Energia').then(m => m.Energia))
const Semana = perezosa(() => import('../pantallas/progreso/Semana').then(m => m.Semana))
const Fuerza = perezosa(() => import('../pantallas/progreso/Fuerza').then(m => m.Fuerza))
const DetalleEntreno = perezosa(() => import('../pantallas/progreso/DetalleEntreno').then(m => m.DetalleEntreno))
const Cuerpo = perezosa(() => import('../pantallas/progreso/Cuerpo').then(m => m.Cuerpo))
const Registrar = perezosa(() => import('../pantallas/progreso/Registrar').then(m => m.Registrar))
const Fotos = perezosa(() => import('../pantallas/progreso/Fotos').then(m => m.Fotos))
const Objetivos = perezosa(() => import('../pantallas/progreso/Objetivos').then(m => m.Objetivos))
const HojaMeta = perezosa(() => import('../pantallas/progreso/Objetivos').then(m => m.HojaMeta))
const Pasos = perezosa(() => import('../pantallas/progreso/Pasos').then(m => m.Pasos))
const HojaTrote = perezosa(() => import('../pantallas/progreso/Pasos').then(m => m.HojaTrote))
const Perfil = perezosa(() => import('../pantallas/perfil/Perfil').then(m => m.Perfil))
const SeccionPerfil = perezosa(() => import('../pantallas/perfil/SeccionPerfil').then(m => m.SeccionPerfil))
const Ajustes = perezosa(() => import('../pantallas/perfil/Ajustes').then(m => m.Ajustes))
const Creditos = perezosa(() => import('../pantallas/perfil/Creditos').then(m => m.Creditos))
const HojaInforme = perezosa(() => import('../pantallas/perfil/HojaInforme').then(m => m.HojaInforme))

export const PANTALLAS: { [C in CodigoPantalla]: P<C> } = {
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

export const HOJAS: { [C in CodigoHoja]: P<C> } = {
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
  'sheet-supl': HojaSuplemento,
  'sheet-maq': HojaMaquina,
  'sheet-elegir': HojaElegirEjercicio,
  'sheet-meta': HojaMeta,
  'sheet-trote': HojaTrote,
  'sheet-confirmar': HojaConfirmar,
  'sheet-informe': HojaInforme,
  'sheet-tutorial': HojaOfertaTutorial,
}
