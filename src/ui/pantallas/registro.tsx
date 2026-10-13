// Qué componente dibuja cada pantalla y cada hoja (los códigos son los del documento de diseño).
import type { ComponentType } from 'react'
import type { Ruta } from '../nav'
import { Inicio } from './inicio/Inicio'
import { HojaPeso } from './inicio/HojaPeso'
import { MiPlan } from './rutina/MiPlan'
import { DetalleDia } from './rutina/DetalleDia'
import { Generar } from './rutina/Generar'
import { EditarPlan } from './rutina/EditarPlan'
import { Biblioteca } from './rutina/Biblioteca'
import { Ficha } from './rutina/Ficha'
import { Gimnasios } from './rutina/Gimnasios'
import { EditorGimnasio } from './rutina/EditorGimnasio'
import { HojaMaquina } from './rutina/HojaMaquina'
import { HojaElegirEjercicio } from './rutina/HojaElegirEjercicio'
import { HojaEmpezar } from './entreno/HojaEmpezar'
import { Entreno } from './entreno/Entreno'
import { FinEntreno } from './entreno/FinEntreno'
import { HojaOcupado } from './entreno/HojaOcupado'
import { HojaLista } from './entreno/HojaLista'
import { HojaHerramientas, HojaDiscos, HojaCalentamiento, HojaInstrucciones, HojaNotaSerie } from './entreno/HojasEntreno'
import { DiaComida } from './comida/DiaComida'
import { HojaAnadir } from './comida/HojaAnadir'
import { Escaner } from './comida/Escaner'
import { Producto } from './comida/Producto'
import { Plantillas } from './comida/Plantillas'
import { HojaPlantilla } from './comida/HojaPlantilla'
import { HojaComida } from './comida/HojaComida'
import { Guardados } from './comida/Guardados'
import { Energia } from './comida/Energia'
import { Semana } from './progreso/Semana'
import { Fuerza } from './progreso/Fuerza'
import { DetalleEntreno } from './progreso/DetalleEntreno'
import { Cuerpo } from './progreso/Cuerpo'
import { Registrar } from './progreso/Registrar'
import { Fotos } from './progreso/Fotos'
import { Objetivos, HojaMeta } from './progreso/Objetivos'
import { Pasos, HojaTrote } from './progreso/Pasos'
import { Perfil } from './perfil/Perfil'
import { SeccionPerfil } from './perfil/SeccionPerfil'
import { Ajustes } from './perfil/Ajustes'
import { Creditos } from './perfil/Creditos'
import { HojaConfirmar } from './HojaConfirmar'

type P = ComponentType<{ ruta: Ruta }>

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
