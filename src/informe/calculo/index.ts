// Informe en PDF: todos los números y textos que salen en el informe, calculados a partir de las tablas y un periodo.
// Lógica pura (sin Dexie ni React; las tablas las lee leer.ts): el dibujo (informe/pdf) solo pinta lo que sale de aquí.
// Regla de oro: lo que no se sabe es null (nunca un 0 inventado). Diseño: docs/INFORME-PDF-DISENO.md (§5).
import { datosQuincena } from '../../dominio/comida'
import { DIAS_CORTOS, deISO, diaSemana, fechaCorta, formatoHora, horaActual, sumarDias } from '../../dominio/fechas'
import { racha } from '../../dominio/semana'
import { ultimoValor } from '../../dominio/tendencias'
import { nombreEntreno } from '../../dominio/nombres'
import { idioma, t } from '../../i18n'
import type { CasillaDia, DetalleEntreno, DetalleSerie, EntradaInforme, Evaluacion, Informe, ResumenInforme, SeccionesInforme } from './tipos'
import { dia10, entre, fechaDia, fijo, mesAnio, minutosSesion, suma, textoDuracion, unico } from './comun'
import { SECCIONES_POR_DEFECTO, hayDatosEn, primerDato, rangoInforme } from './periodo'
import { contexto, cuentaEntrenos, edadEn, estadosDias, leerPeso, nombreDe, type Ctx } from './contexto'
import { mesesInforme, puntuacionInforme, semanasInforme } from './semanas'
import { controlPeso, cuerpoInforme, indicadores, metasInforme, zonasInforme } from './cuerpo'
import { destacado, tablaResumen, tonoProteinaDia } from './resumen'
import { entrenosInforme, fuerzaInforme } from './entrenos'
import { comidaInforme, pasosInforme } from './comidaPasos'
import { tuDiaInforme } from './dia'

function detalleEntrenos(c: Ctx): DetalleEntreno[] {
  return c.enPeriodo.map(s => {
    const recs = new Set(c.logros.filter(l => l.fecha === s.fecha).map(l => `${l.ejercicio}|${l.peso}|${l.reps}`))
    const min = minutosSesion(s)
    return {
      fecha: s.fecha,
      titulo: [fechaDia(s.fecha), nombreEntreno(s), min != null ? textoDuracion(min) : null].filter(Boolean).join(' · '),
      ejercicios: s.ejercicios.map(e => ({
        id: e.ejercicio, nombre: nombreDe(c, e.ejercicio), saltado: e.estado === 'saltado',
        enVezDe: e.planificado && e.planificado !== e.ejercicio ? nombreDe(c, e.planificado) : null,
        motivo: e.motivo === 'ocupado' ? 'ocupado' : e.motivo === 'cambio' ? 'cambio' : null,
        // Las series de trabajo se numeran desde 1 (los calentamientos no cuentan).
        series: e.series.map((x, i): DetalleSerie => ({
          n: x.calentamiento ? 0 : e.series.slice(0, i + 1).filter(y => !y.calentamiento).length, peso: x.peso, reps: x.reps, segundos: x.segundos ?? null, rpe: x.rpe, calentamiento: x.calentamiento, hecha: x.hecha,
          record: !!x.record && recs.has(`${e.ejercicio}|${x.peso}|${x.reps}`), nota: x.nota ?? null,
        })),
      })),
    }
  })
}

/** Calcula todo lo que sale en el informe. Las tablas llegan enteras; aquí se filtra por el periodo. */
export function calcularInforme(e: EntradaInforme): Informe {
  const r = rangoInforme(e.periodo, e.ahora, primerDato(e))
  const c = contexto(e, r)
  const secciones: SeccionesInforme = { ...SECCIONES_POR_DEFECTO, ...e.secciones }
  const semanas = r.unDia ? [] : semanasInforme(c)
  const meses = r.periodo === 'todo' && r.dias >= 60 ? mesesInforme(c) : null
  const ent = cuentaEntrenos(c, r.inicio, r.fin)
  const hayComidas = c.comidas.some(x => entre(x.fecha, r.inicio, r.fin))
  const hayPasos = c.pasos.some(x => entre(x.fecha, r.inicio, r.fin))
  const hayCuerpo = c.ms.some(m => entre(dia10(m.fecha), r.inicio, r.fin))
  const cuerpo = cuerpoInforme(c)
  const comidaD = hayComidas ? comidaInforme(c, secciones.detalle) : null
  const pasosD = hayPasos ? pasosInforme(c) : null
  const lineas: Evaluacion[] = []
  const ult = cuerpo.peso.antes
  const ultV = ult ? { peso: fijo(ult.valor), fecha: fechaCorta(ult.fecha) } : null
  if (r.unDia) {
    // Un solo día: frases con «hoy»/«ayer». Lo del entreno ya lo dice su ficha («Descanso», «No hecho»).
    const ayer = r.periodo === 'ayer'
    if (secciones.comida && !hayComidas) lineas.push({ texto: ayer ? t('Ayer no has apuntado comidas') : t('Hoy no has apuntado comidas'), tono: 'gris' })
    if (secciones.cuerpo && !hayCuerpo) {
      const texto = ultV
        ? (ayer ? t('Ayer no te has pesado (último peso: {peso} kg, {fecha})', ultV) : t('Hoy no te has pesado (último peso: {peso} kg, {fecha})', ultV))
        : (ayer ? t('Ayer no te has pesado') : t('Hoy no te has pesado'))
      lineas.push({ texto, tono: 'gris' })
    }
    if (secciones.pasos && !hayPasos) lineas.push({ texto: ayer ? t('Ayer no has apuntado pasos') : t('Hoy no has apuntado pasos'), tono: 'gris' })
  } else {
    if (secciones.entrenos && !c.enPeriodo.length) lineas.push(ent.tocaban ? { texto: t('Entrenos: 0 de {n}', { n: ent.tocaban }), tono: 'bad' } : { texto: t('Entrenos: no hay entrenos de estos días'), tono: 'gris' })
    if (secciones.comida && !hayComidas) lineas.push({ texto: t('Comida: no hay comidas apuntadas de estos días'), tono: 'gris' })
    if (secciones.cuerpo && !hayCuerpo) lineas.push({ texto: ultV ? t('Cuerpo: no te has pesado ni medido estos días (último peso: {peso} kg, {fecha})', ultV) : t('Cuerpo: no te has pesado ni medido estos días'), tono: 'gris' })
    if (secciones.pasos && !hayPasos) lineas.push({ texto: t('Pasos: no hay pasos apuntados de estos días'), tono: 'gris' })
  }
  if (c.hayPerfil && !(c.p.alturaCm > 0)) lineas.push({ texto: t('Falta tu altura en Perfil'), tono: 'warn' })
  const z = zonasInforme(c)
  const rachaV = racha(c.rutina, c.todas, sumarDias(r.fin, 1))
  const q = c.ms.length || c.comidas.length ? datosQuincena({ hoy: r.fin, mediciones: c.ms.filter(m => dia10(m.fecha) <= r.fin), comidas: c.comidas.filter(x => x.fecha <= r.fin), objetivoProteina: c.obj.proteina, objetivo: c.p.objetivo }) : null
  const metasFechas = unico(c.metas.filter(m => m.fecha).map(m => mesAnio(m.fecha!)))
  const sexo = c.hayPerfil ? (c.p.sexo === 'mujer' ? t('Mujer') : t('Hombre')) : null
  const nombre = c.p.nombre?.trim() || null
  // «20/10/2026»; en inglés (EE. UU.), el mes delante: «10/20/2026».
  const dd = String(e.ahora.getDate()).padStart(2, '0'), mm = String(e.ahora.getMonth() + 1).padStart(2, '0')
  const creado = idioma() === 'en' ? `${mm}/${dd}/${e.ahora.getFullYear()}` : `${dd}/${mm}/${e.ahora.getFullYear()}`
  const hora = formatoHora(horaActual(e.ahora))
  const resumen: ResumenInforme = {
    tabla: tablaResumen(c, cuerpo, ent, semanas, comidaD, pasosD),
    zonas: z.zonas, zonasSubtitulo: z.subtitulo,
    zonasNota: c.p.sexo === 'mujer'
      ? t('Zonas de la app: IMC de la OMS, grasa de la ACE para mujeres (14-32 %), cintura/altura saludable entre {a} y {b}.', { a: fijo(0.4, 2), b: fijo(0.5, 2) })
      : t('Zonas de la app: IMC de la OMS, grasa de la ACE para hombres (6-25 %), cintura/altura saludable entre {a} y {b}.', { a: fijo(0.4, 2), b: fijo(0.5, 2) }),
    puntuacion: r.unDia ? null : puntuacionInforme(semanas),
    casillas: r.periodo === 'semana' ? estadosDias(c, r.inicio, r.fin).map((d): CasillaDia => {
      const com = c.comidas.filter(x => x.fecha === d.fecha)
      const prot = com.length ? Math.round(suma(com.map(x => x.proteina))) : null
      const pas = c.pasos.find(x => x.fecha === d.fecha)?.pasos ?? null
      const pes = ultimoValor(c.ms.filter(m => dia10(m.fecha) === d.fecha), leerPeso)?.valor ?? null
      return {
        fecha: d.fecha, inicial: DIAS_CORTOS[diaSemana(deISO(d.fecha))], estado: d.estado, nombre: d.dia?.nombre ?? null,
        proteina: prot, tonoProteina: prot == null ? 'gris' : tonoProteinaDia(prot, c.obj.proteina), pasos: pas, cumplePasos: pas != null && pas >= c.p.pasosObjetivo, peso: pes,
      }
    }) : null,
    controlPeso: controlPeso(c),
    metas: metasInforme(c), metasFecha: metasFechas.length === 1 ? metasFechas[0]! : null,
    indicadores: indicadores(c),
    destacado: destacado(c, cuerpo, rachaV), racha: rachaV,
    consejo: q ? { texto: q.consejo, tono: q.tono === 'ok' ? 'ok' : q.tono === 'warn' ? 'warn' : 'gris', etiqueta: q.etiqueta } : null,
    lineas,
  }
  return {
    periodo: r.periodo, rango: r, secciones,
    cabecera: {
      titulo: r.unDia ? t('Tu día') : t('Informe de progreso'), nombre, sexo, edad: edadEn(c.p.nacimiento, r.fin), alturaCm: c.p.alturaCm > 0 ? c.p.alturaCm : null,
      periodo: `${r.etiqueta} · ${r.texto}`, creado: `${creado} ${hora}`, creadoPie: t('Creado el {fecha} a las {hora}', { fecha: creado, hora }),
      tituloPdf: t('Informe JowyFit · {periodo}', { periodo: r.etiqueta }), autor: nombre ?? '', comparado: r.unDia ? t('Comparado con tus últimas 4 semanas') : null,
    },
    hayDatos: hayDatosEn(e, r.inicio, r.fin),
    resumen, semanas, meses,
    entrenos: secciones.entrenos && c.enPeriodo.length ? entrenosInforme(c, ent) : null,
    fuerza: secciones.entrenos && c.enPeriodo.length ? fuerzaInforme(c, semanas, meses) : null,
    comida: secciones.comida ? comidaD : null,
    cuerpo: secciones.cuerpo && hayCuerpo ? cuerpo : null,
    pasos: secciones.pasos ? pasosD : null,
    tuDia: r.unDia ? tuDiaInforme(c) : null,
    detalleEntrenos: secciones.detalle && secciones.entrenos && c.enPeriodo.length ? detalleEntrenos(c) : null,
  }
}
