import type { Informe, Metrica } from './tipos'

function proporcion(metrica: Metrica): string {
  return `${metrica.numerador}/${metrica.denominador} (${metrica.porcentaje === null ? 'no evaluable' : `${metrica.porcentaje}%`})`
}

function celda(texto: string): string {
  return texto.replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ')
}

export function markdown(informe: Informe): string {
  const resumen = informe.resumen
  const lineas = [
    `# Simulación: ${celda(informe.configuracion.escenario.nombre)}`,
    '',
    '**Evaluación de software. No demuestra eficacia fisiológica.**',
    '',
    `JowyFit ${celda(informe.aplicacion.version)}: acciones y dominio reales con IndexedDB temporal; catálogo ${informe.aplicacion.huellaCatalogo.slice(0, 12)}.`,
    `Escenario: ${informe.configuracion.escenario.id}; semilla: ${informe.configuracion.semilla}; inicio: ${informe.configuracion.inicio}; semanas: ${informe.configuracion.semanas}.`,
    `Días recorridos: ${resumen.dias}/${informe.configuracion.semanas * 7}.`,
    '',
    '## Resumen',
    '',
    `- Asistencia a días previstos: ${proporcion(resumen.asistencia)}. Incluye intentos bloqueados.`,
    `- Sesiones registradas: ${resumen.sesiones.completas} completas, ${resumen.sesiones.cortas} cortas, ${resumen.sesiones.abandonadas} abandonadas; ${resumen.sesiones.bloqueadas} intentos sin sesión válida; ${resumen.sesiones.sinRegistrar} resultados sin registro confirmado.`,
    `- Minutos simulados: mediana ${resumen.tiempo.mediana ?? 'no evaluable'}; p90 ${resumen.tiempo.p90 ?? 'no evaluable'}. Fuera de tiempo: ${proporcion(resumen.tiempo.excedidas)}.`,
    `- Comprobaciones: ${resumen.contratos.aprobada} aprobadas; ${resumen.contratos.fallida} fallidas; ${resumen.contratos.pendiente} pendientes; ${resumen.contratos['no-evaluable']} no evaluables. No equivalen a reglas únicas.`,
    '',
    '## Reglas',
    '',
    '| Regla | Aprobadas | Fallidas | Pendientes | No evaluables |',
    '| --- | ---: | ---: | ---: | ---: |',
  ]
  for (const [regla, cuenta] of Object.entries(resumen.reglas)) lineas.push(`| ${celda(regla)} | ${cuenta.aprobada} | ${cuenta.fallida} | ${cuenta.pendiente} | ${cuenta['no-evaluable']} |`)
  lineas.push('', '## Fallos y traza', '')
  let fallos = 0
  for (const paso of informe.pasos) for (const comprobacion of paso.comprobaciones) {
    if (comprobacion.estado !== 'fallida') continue
    lineas.push(`- Día ${paso.contexto.indice} (${paso.contexto.fecha}), ${celda(comprobacion.regla)}: ${celda(comprobacion.detalle)}`)
    fallos++
  }
  if (!fallos) lineas.push('Sin incumplimientos detectados en las reglas evaluadas; revisar pendientes y cobertura antes de sacar conclusiones.')
  lineas.push('', 'La traza completa y la configuración reproducible están en el JSON de esta ejecución.', '')
  return lineas.join('\n')
}
