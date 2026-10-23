// Qué componente dibuja cada pantalla y cada hoja (cada código se llama como su componente).
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

export const PANTALLAS: { [C in CodigoPantalla]: P<C> } = {
  inicio: Inicio,
  'mi-plan': perezosa(() => import('../pantallas/rutina/MiPlan').then(m => m.MiPlan)),
  'detalle-dia': perezosa(() => import('../pantallas/rutina/DetalleDia').then(m => m.DetalleDia)),
  'generar-rutina': perezosa(() => import('../pantallas/rutina/Generar').then(m => m.Generar)),
  'editar-plan': perezosa(() => import('../pantallas/rutina/EditarPlan').then(m => m.EditarPlan)),
  biblioteca: perezosa(() => import('../pantallas/rutina/Biblioteca').then(m => m.Biblioteca)),
  ficha: perezosa(() => import('../pantallas/rutina/Ficha').then(m => m.Ficha)),
  gimnasios: perezosa(() => import('../pantallas/rutina/Gimnasios').then(m => m.Gimnasios)),
  'editor-gimnasio': perezosa(() => import('../pantallas/rutina/EditorGimnasio').then(m => m.EditorGimnasio)),
  entreno: perezosa(() => import('../pantallas/entreno/Entreno').then(m => m.Entreno)),
  'fin-entreno': perezosa(() => import('../pantallas/entreno/FinEntreno').then(m => m.FinEntreno)),
  'dia-comida': perezosa(() => import('../pantallas/comida/DiaComida').then(m => m.DiaComida)),
  escaner: perezosa(() => import('../pantallas/comida/Escaner').then(m => m.Escaner)),
  producto: perezosa(() => import('../pantallas/comida/Producto').then(m => m.Producto)),
  plantillas: perezosa(() => import('../pantallas/comida/Plantillas').then(m => m.Plantillas)),
  guardados: perezosa(() => import('../pantallas/comida/Guardados').then(m => m.Guardados)),
  energia: perezosa(() => import('../pantallas/comida/Energia').then(m => m.Energia)),
  semana: perezosa(() => import('../pantallas/progreso/Semana').then(m => m.Semana)),
  fuerza: perezosa(() => import('../pantallas/progreso/Fuerza').then(m => m.Fuerza)),
  'detalle-entreno': perezosa(() => import('../pantallas/progreso/DetalleEntreno').then(m => m.DetalleEntreno)),
  cuerpo: perezosa(() => import('../pantallas/progreso/Cuerpo').then(m => m.Cuerpo)),
  registrar: perezosa(() => import('../pantallas/progreso/Registrar').then(m => m.Registrar)),
  fotos: perezosa(() => import('../pantallas/progreso/Fotos').then(m => m.Fotos)),
  objetivos: perezosa(() => import('../pantallas/progreso/Objetivos').then(m => m.Objetivos)),
  pasos: perezosa(() => import('../pantallas/progreso/Pasos').then(m => m.Pasos)),
  perfil: perezosa(() => import('../pantallas/perfil/Perfil').then(m => m.Perfil)),
  'seccion-perfil': perezosa(() => import('../pantallas/perfil/SeccionPerfil').then(m => m.SeccionPerfil)),
  ajustes: perezosa(() => import('../pantallas/perfil/Ajustes').then(m => m.Ajustes)),
  creditos: perezosa(() => import('../pantallas/perfil/Creditos').then(m => m.Creditos)),
}

export const HOJAS: { [C in CodigoHoja]: P<C> } = {
  'hoja-peso': HojaPeso,
  'hoja-empezar': perezosa(() => import('../pantallas/entreno/HojaEmpezar').then(m => m.HojaEmpezar)),
  'hoja-ocupado': perezosa(() => import('../pantallas/entreno/HojaOcupado').then(m => m.HojaOcupado)),
  'hoja-lista': perezosa(() => import('../pantallas/entreno/HojaLista').then(m => m.HojaLista)),
  'hoja-salir-entreno': perezosa(() => import('../pantallas/entreno/HojaSalirEntreno').then(m => m.HojaSalirEntreno)),
  'hoja-herramientas': perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaHerramientas)),
  'hoja-discos': perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaDiscos)),
  'hoja-calentamiento': perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaCalentamiento)),
  'hoja-instrucciones': perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaInstrucciones)),
  'hoja-nota-serie': perezosa(() => import('../pantallas/entreno/HojasEntreno').then(m => m.HojaNotaSerie)),
  'hoja-anadir': perezosa(() => import('../pantallas/comida/HojaAnadir').then(m => m.HojaAnadir)),
  'hoja-plantilla': perezosa(() => import('../pantallas/comida/HojaPlantilla').then(m => m.HojaPlantilla)),
  'hoja-comida': perezosa(() => import('../pantallas/comida/HojaComida').then(m => m.HojaComida)),
  'hoja-suplemento': perezosa(() => import('../pantallas/comida/HojaSuplemento').then(m => m.HojaSuplemento)),
  'hoja-maquina': perezosa(() => import('../pantallas/rutina/HojaMaquina').then(m => m.HojaMaquina)),
  'hoja-elegir-ejercicio': perezosa(() => import('../pantallas/rutina/HojaElegirEjercicio').then(m => m.HojaElegirEjercicio)),
  'hoja-meta': perezosa(() => import('../pantallas/progreso/Objetivos').then(m => m.HojaMeta)),
  'hoja-trote': perezosa(() => import('../pantallas/progreso/Pasos').then(m => m.HojaTrote)),
  'hoja-confirmar': HojaConfirmar,
  'hoja-informe': perezosa(() => import('../pantallas/perfil/HojaInforme').then(m => m.HojaInforme)),
  'hoja-oferta-tutorial': HojaOfertaTutorial,
}
