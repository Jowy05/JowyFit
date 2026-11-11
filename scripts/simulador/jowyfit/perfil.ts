import type { Perfil } from '../../../src/datos/tipos'
import { perfilPorDefecto } from '../../../src/datos/repos'
import type { Configuracion } from '../tipos'

/** El perfil con el que la persona virtual completa el alta real. */
export function perfilSintetico(configuracion: Configuracion): Perfil {
  const { escenario, inicio } = configuracion
  const persona = escenario.persona
  const opcionales = escenario.diasOpcionales ?? []
  return {
    ...perfilPorDefecto(), altaCompleta: true, nombre: 'Perfil sintético',
    nacimiento: `${Number(inicio.slice(0, 4)) - persona.edad}${inicio.slice(4)}`,
    sexo: persona.sexo, alturaCm: 175, objetivo: persona.objetivo, nivel: persona.nivel,
    diasFijos: escenario.dias.filter(dia => !opcionales.includes(dia)), diasOpcionales: [...opcionales],
    minutosNormal: persona.minutos, minutosCorta: Math.max(15, Math.round(persona.minutos * 0.6)),
    modoRutina: persona.modo, modoMayor: { activo: persona.edad >= 60 },
    zonasSensibles: [...persona.zonasSensibles], urgencias: [...persona.urgencias], condicionesSalud: [...persona.condicionesSalud],
    experienciaPrevia: persona.mesesSinEntrenar ? 'hace-anos' : 'ahora',
  }
}
