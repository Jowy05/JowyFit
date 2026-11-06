import type { Dia, Perfil, ZonaDolor, Zona } from '../../../src/datos/tipos'
import { perfilPorDefecto } from '../../../src/datos/repos'
import { escenariosBase, escenariosLimite } from '../escenarios'
import type { Configuracion, Escenario } from '../tipos'

export type EscenarioJowyFit = Escenario & { jowyfit?: { diasOpcionales?: number[]; otroGimnasio?: boolean } }

export function zonaReal(zona: string): ZonaDolor {
  const zonas: Record<string, ZonaDolor> = { rodilla: 'rodillas', lumbar: 'lumbar', hombro: 'hombros', muneca: 'munecas', codo: 'codos' }
  const encontrada = zonas[zona]
  if (!encontrada) throw new Error(`Zona sintética sin correspondencia: ${zona}`)
  return encontrada
}

export function perfilSintetico(configuracion: Configuracion): Perfil {
  const escenario = configuracion.escenario as EscenarioJowyFit
  const persona = escenario.persona
  const opcionales = escenario.jowyfit?.diasOpcionales ?? []
  const conocidas = new Set(['rodilla', 'lumbar', 'hombro', 'muneca', 'codo', 'dolorPecho', 'posparto6Semanas', 'hipertension', 'osteoporosis', 'fuerzaBajaPiernas'])
  for (const restriccion of persona.restricciones) if (!conocidas.has(restriccion)) throw new Error(`Restricción sin correspondencia: ${restriccion}`)
  return {
    ...perfilPorDefecto(), altaCompleta: true, nombre: 'Perfil sintético',
    nacimiento: `${Number(configuracion.inicio.slice(0, 4)) - persona.edad}${configuracion.inicio.slice(4)}`,
    sexo: persona.sexo, alturaCm: 175, objetivo: persona.objetivo, nivel: persona.nivel,
    diasFijos: escenario.dias.filter(dia => !opcionales.includes(dia)) as Dia[], diasOpcionales: opcionales as Dia[],
    minutosNormal: persona.minutos, minutosCorta: Math.max(15, Math.round(persona.minutos * 0.6)),
    modoRutina: persona.modo, modoMayor: { activo: persona.edad >= 60 },
    zonasSensibles: persona.restricciones.filter(zona => ['rodilla', 'lumbar', 'hombro', 'muneca', 'codo'].includes(zona)) as Zona[],
    urgencias: persona.restricciones.includes('dolorPecho') ? ['pecho'] : [],
    condicionesSalud: [
      ...(persona.restricciones.includes('hipertension') ? ['tension' as const] : []),
      ...(persona.restricciones.includes('osteoporosis') ? ['osteoporosis' as const] : []),
      ...(persona.restricciones.includes('posparto6Semanas') ? ['embarazo' as const] : []),
    ],
    experienciaPrevia: persona.mesesSinEntrenar ? 'hace-anos' : 'ahora',
  }
}

export function escenariosJowyFit(): EscenarioJowyFit[] {
  const base = escenariosBase()[1]!
  const adicional = (id: string, nombre: string): EscenarioJowyFit => ({ ...structuredClone(base), id, nombre })
  const facil = adicional('progresion-facil', 'Progresión con series fáciles')
  facil.eventos = [{ dia: 0, tipo: 'conducta', valor: 'facil' }]
  const dificil = adicional('progresion-dificil', 'Series difíciles tras una fase fácil')
  dificil.eventos = [{ dia: 0, tipo: 'conducta', valor: 'facil' }, { dia: 14, tipo: 'conducta', valor: 'dificil' }]
  const sabado = adicional('sabado-opcional', 'Sábado opcional tras faltar entre semana')
  sabado.dias = [0, 2, 4, 5]
  sabado.jowyfit = { diasOpcionales: [5] }
  sabado.eventos = [{ dia: 7, tipo: 'ausencia', hasta: 11 }]
  const gimnasio = adicional('otro-gimnasio', 'Cambio de gimnasio para la sesión')
  gimnasio.jowyfit = { otroGimnasio: true }
  gimnasio.eventos = [{ dia: 14, tipo: 'material', quitar: ['cable', 'barbell', 'smith_machine', 'leg_press', 'pull_up_bar'] }]
  const ocupado = adicional('ejercicio-ocupado', 'Alternativa del primer ejercicio ocupado')
  ocupado.eventos = [{ dia: 14, tipo: 'ocupado', ejercicio: 'primero' }]
  return [...escenariosBase(), ...escenariosLimite(), facil, dificil, sabado, gimnasio, ocupado]
}
