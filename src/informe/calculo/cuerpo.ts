// Cuerpo: peso, grasa y cintura, sus zonas, el control de peso, las metas y los indicadores de la báscula.
import type { Medicion, Meta, Perfil } from '../../datos/tipos'
import { cinturaAltura, imc } from '../../dominio/calculos'
import { conUnidad, kg, num, MENOS, conSigno, fijo } from '../../dominio/formato'
import { basalDia } from '../../dominio/energia'
import { fechaCorta, sumarDias } from '../../dominio/fechas'
import { cambioDesdeInicio, faltaMeta, hitosDominadas, mediasSemanales, pendienteSemanal, pesoMaximo, progresoMeta, serieMedida, seriesDe, ultimoValor, veredictoCinturaAltura, veredictoGrasa, veredictoImc, type Tono, grasaEn } from '../../dominio/tendencias'
import { t, tk } from '../../i18n'
import type { Cambio, ControlPeso, CuerpoInforme, Evaluacion, MetaInforme, PuntoCuerpo, ResumenInforme, SerieCuerpo, TonoInforme, ZonaCuerpo } from './tipos'
import { dia10, entre, mesAnio, r1 } from './comun'
import { edadEn, leerCintura, leerGrasaBascula, leerPeso, nombreDe, type Ctx } from './contexto'

const ZONAS_IMC = { cortes: [18.5, 25] as [number, number], escala: [10, 40] as [number, number], marcas: [10, 15, 18.5, 25, 30, 35, 40] }
const ZONAS_CA = { cortes: [0.4, 0.5] as [number, number], escala: [0.3, 0.8] as [number, number], marcas: [0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8] }
const zonasGrasa = (sexo: Perfil['sexo']) => sexo === 'mujer'
  ? { cortes: [14, 32] as [number, number], escala: [0, 50] as [number, number], marcas: [0, 14, 20, 25, 32, 40, 50] }
  : { cortes: [6, 25] as [number, number], escala: [0, 45] as [number, number], marcas: [0, 6, 10, 15, 20, 25, 35, 45] }
const zonaDe = (v: number, [a, b]: [number, number]) => (v < a ? 'bajo' : v < b ? 'estandar' : 'alto') as ZonaCuerpo['zona']

/** Cambio de una medida del cuerpo con su color según el objetivo (§5.4). */
export function evaluarCuerpo(delta: number, objetivo: Perfil['objetivo'], campo: 'peso' | 'grasa' | 'cintura'): Evaluacion {
  const d = r1(delta)
  // Cambios de menos de 0,2 (kg, puntos o cm) son el ruido de la báscula o de la cinta: «Estable» (como en «Tu día», §5.7).
  if (campo === 'peso' && objetivo === 'fuerza') return { texto: d >= 0.2 ? t('Sube') : d <= -0.2 ? t('Baja') : t('Estable'), tono: 'gris' }
  if (d <= -0.2) return { texto: t('Baja: bien'), tono: 'ok' }
  if (d > 0.3) return { texto: t('Sube: ojo'), tono: 'warn' }
  return { texto: t('Estable'), tono: 'gris' }
}

export function cambioDe(delta: number, tono: TonoInforme, f: (v: number) => string = v => num(v)): Cambio {
  const d = Math.round(delta * 100) / 100
  return { valor: d, texto: conSigno(delta, f), direccion: d > 0 ? 'sube' : d < 0 ? 'baja' : 'igual', tono }
}

function serieCuerpo(c: Ctx, puntos: PuntoCuerpo[], leer: (m: Medicion) => number | undefined, campo: 'peso' | 'grasa' | 'cintura'): SerieCuerpo {
  const enP = puntos.filter(x => entre(x.fecha, c.inicio, c.fin))
  const antes = campo === 'grasa' ? (grasaEn(c.ms, c.marina, sumarDias(c.inicio, -1)) ?? null) : ultimoValor(c.ms, leer, sumarDias(c.inicio, -1))
  const camb = cambioDesdeInicio(enP)
  // Con un solo dato en el periodo, «al empezar» es el último de antes (si lo hay), y se avisa de que es de antes.
  const conAntes = enP.length === 1 && !!antes
  const ini = enP.length >= 2 ? camb!.inicio : conAntes ? antes!.valor : null
  const ahora = camb?.ahora ?? null
  const delta = ini != null && ahora != null ? ahora - ini : null
  return {
    puntos: enP,
    medias: campo === 'grasa' ? [] : mediasSemanales(c.ms.filter(m => entre(dia10(m.fecha), c.inicio, c.fin)), leer).map(x => ({ fecha: x.fecha, valor: Math.round(x.valor * 100) / 100 })),
    inicio: ini, ahora,
    cambio: delta == null ? null : cambioDe(delta, evaluarCuerpo(delta, c.p.objetivo, campo).tono),
    antes: antes ? { fecha: antes.fecha, valor: antes.valor } : null,
    inicioFecha: enP.length >= 2 ? enP[0]!.fecha : conAntes ? antes!.fecha : null,
    inicioAntes: conAntes,
  }
}

/** % de grasa día a día: el de la báscula y, los días sin ella, el de la cinta (método de la Marina). */
function puntosGrasa(c: Ctx): PuntoCuerpo[] {
  const bascula = serieMedida(c.ms, leerGrasaBascula)
  const dias = new Set(bascula.map(x => x.fecha))
  return [
    ...bascula.map(x => ({ ...x, fuente: 'bascula' as const })),
    ...c.marina.filter(x => !dias.has(x.fecha)).map(x => ({ ...x, fuente: 'medidas' as const })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function cuerpoInforme(c: Ctx): CuerpoInforme {
  const peso = serieCuerpo(c, serieMedida(c.ms, leerPeso), leerPeso, 'peso')
  const grasa = serieCuerpo(c, puntosGrasa(c), leerGrasaBascula, 'grasa')
  const cintura = serieCuerpo(c, serieMedida(c.ms, leerCintura), leerCintura, 'cintura')
  const h = c.p.alturaCm > 0 ? c.p.alturaCm : null
  const pAhora = ultimoValor(c.ms, leerPeso, c.fin)?.valor ?? null
  const gAhora = grasaEn(c.ms, c.marina, c.fin)
  const cAhora = ultimoValor(c.ms, leerCintura, c.fin)?.valor ?? null
  const tabla: CuerpoInforme['tabla'] = []
  // Las palabras de los veredictos son de Progreso (tendencias.ts): t() las deja igual si ya vienen traducidas.
  const ev = (v: { palabra: string; tono: Tono }): Evaluacion => ({ texto: t(v.palabra), tono: v.tono })
  if (pAhora != null) tabla.push({ medicion: t('Peso'), valor: `${fijo(pAhora)} kg`, rango: h ? `${num(18.5 * (h / 100) ** 2)}–${num(25 * (h / 100) ** 2)} kg` : '—', evaluacion: h ? ev(veredictoImc(imc(pAhora, h))) : { texto: '—', tono: 'gris' } })
  if (gAhora) {
    const z = zonasGrasa(c.p.sexo).cortes
    tabla.push({ medicion: gAhora.fuente === 'medidas' ? t('Grasa corporal (por medidas)') : t('Grasa corporal'), valor: conUnidad(fijo(gAhora.valor), '%'), rango: `${z[0]}–${z[1]} %`, evaluacion: ev(veredictoGrasa(gAhora.valor, c.p.sexo)) })
  }
  if (cAhora != null) {
    tabla.push({ medicion: t('Cintura'), valor: `${num(cAhora)} cm`, rango: h ? t('hasta {n} cm', { n: num(h * 0.5) }) : '—', evaluacion: h ? ev(veredictoCinturaAltura(cinturaAltura(cAhora, h))) : { texto: '—', tono: 'gris' } })
    if (h) tabla.push({ medicion: t('Cintura / altura'), valor: num(cinturaAltura(cAhora, h), 2), rango: `${fijo(0.4, 2)}–${fijo(0.5, 2)}`, evaluacion: ev(veredictoCinturaAltura(cinturaAltura(cAhora, h))) })
  }
  if (pAhora != null && h) {
    tabla.push({ medicion: t('IMC'), valor: fijo(imc(pAhora, h)), rango: `${num(18.5)}–25`, evaluacion: ev(veredictoImc(imc(pAhora, h))) })
    // El mismo gasto en reposo que «Otros indicadores» (el de la báscula); sin báscula, el calculado y se dice.
    const bas = basalBascula(c)
    const e = edadEn(c.p.nacimiento, c.fin)
    if (bas != null) tabla.push({ medicion: t('Gasto en reposo'), valor: `${num(bas, 0)} kcal`, rango: '—', evaluacion: { texto: '—', tono: 'gris' } })
    else if (e != null) tabla.push({ medicion: t('Gasto en reposo (calculado)'), valor: `${basalDia({ pesoKg: pAhora, alturaCm: h, edad: e, sexo: c.p.sexo, grasaPct: gAhora?.valor }).kcal} kcal`, rango: '—', evaluacion: { texto: '—', tono: 'gris' } })
  }
  return { peso, grasa, cintura, tabla, nota: h ? null : t('Falta tu altura en Perfil') }
}

/**
 * En la barra de zonas, la palabra corta de cintura/altura (la larga no cabe), con los mismos tramos que
 * veredictoCinturaAltura (tendencias.ts). Sale del número y no de la palabra larga, que puede venir ya traducida.
 */
function palabraCortaCintura(ratio: number): string {
  if (ratio < 0.4) return t('por debajo')
  if (ratio < 0.5) return t('saludable')
  if (ratio < 0.55) return t('un poco por encima')
  if (ratio < 0.6) return t('por encima')
  return t('bastante por encima')
}

export function zonasInforme(c: Ctx): { zonas: ZonaCuerpo[]; subtitulo: string | null } {
  const zonas: ZonaCuerpo[] = []
  const h = c.p.alturaCm > 0 ? c.p.alturaCm : null
  const p = ultimoValor(c.ms, leerPeso, c.fin)
  const g = grasaEn(c.ms, c.marina, c.fin)
  const cin = ultimoValor(c.ms, leerCintura, c.fin)
  const tonoV = (t: Tono): TonoInforme => t
  if (p && h) {
    const v = r1(imc(p.valor, h)), w = veredictoImc(v)
    zonas.push({ nombre: t('IMC (kg/m²)'), valor: v, texto: num(v), palabra: t(w.palabra), tono: tonoV(w.tono), zona: zonaDe(v, ZONAS_IMC.cortes), ...ZONAS_IMC })
  }
  if (g) {
    const z = zonasGrasa(c.p.sexo), w = veredictoGrasa(g.valor, c.p.sexo)
    zonas.push({ nombre: g.fuente === 'medidas' ? t('Grasa corporal (%) (por medidas)') : t('Grasa corporal (%)'), valor: g.valor, texto: num(g.valor), palabra: t(w.palabra), tono: tonoV(w.tono), zona: zonaDe(g.valor, z.cortes), ...z, fuente: g.fuente })
  }
  if (cin && h) {
    const v = Math.round(cinturaAltura(cin.valor, h) * 100) / 100, w = veredictoCinturaAltura(v)
    zonas.push({ nombre: t('Cintura / altura'), valor: v, texto: num(v, 2), palabra: palabraCortaCintura(v), tono: tonoV(w.tono), zona: zonaDe(v, ZONAS_CA.cortes), ...ZONAS_CA })
  }
  const bas = ultimoValor(c.ms, leerGrasaBascula, c.fin)
  const partes = [bas && g?.fuente === 'bascula' ? t('báscula del {fecha}', { fecha: fechaCorta(bas.fecha) }) : p ? t('peso del {fecha}', { fecha: fechaCorta(p.fecha) }) : null, cin ? t('cinta del {fecha}', { fecha: fechaCorta(cin.fecha) }) : null].filter((x): x is string => !!x)
  return { zonas, subtitulo: partes.length ? partes.join(' · ') : null }
}

export function controlPeso(c: Ctx): ControlPeso | null {
  const p = ultimoValor(c.ms, leerPeso, c.fin)
  if (!p) return null
  const g = grasaEn(c.ms, c.marina, c.fin)
  const metaG = c.metas.find(m => m.tipo === 'grasa' && !m.hecha)
  const meta = metaG?.objetivo ?? (c.p.sexo === 'mujer' ? 25 : 18)
  let pesoConMeta: number | null = null, sobra: number | null = null
  if (g) {
    const magra = p.valor * (1 - g.valor / 100)
    pesoConMeta = r1(magra / (1 - meta / 100))
    sobra = r1(Math.max(0, p.valor - magra / (1 - meta / 100)))
  }
  const enP = c.ms.filter(m => entre(dia10(m.fecha), c.inicio, c.fin))
  const pend = pendienteSemanal(mediasSemanales(enP, leerPeso))
  // Con 2 decimales: un ritmo de –0,03 kg/sem no es «0»; por debajo de 0,005, «estable».
  const ritmo = pend == null ? null : Math.round(pend * 100) / 100
  // Masa grasa (kg) de cada pesada con báscula: si baja, cuándo se llegaría a la meta.
  const masa = mediasSemanales(enP, m => (m.pesoKg != null && m.bascula?.grasaPct != null ? m.pesoKg * m.bascula.grasaPct / 100 : undefined))
  const pendG = masa.length >= 3 ? pendienteSemanal(masa) : null
  // Si queda a más de 2 años, no es una previsión creíble: no sale (como cuando el peso no baja).
  const semanasMeta = sobra != null && sobra > 0 && pendG != null && pendG < 0 && ritmo !== 0 ? sobra / -pendG : null
  const fechaMeta = semanasMeta != null && semanasMeta <= 104 ? mesAnio(sumarDias(c.fin, Math.round(semanasMeta * 7))) : null
  const filas = [{ nombre: t('Peso ahora'), valor: `${fijo(p.valor)} kg` }]
  if (pesoConMeta != null) filas.push({ nombre: metaG ? t('Peso con tu meta de grasa ({n} %)', { n: num(meta) }) : t('Peso con un {n} % de grasa', { n: num(meta) }), valor: `${fijo(pesoConMeta)} kg` })
  if (sobra != null) filas.push({ nombre: t('Grasa que sobra para la meta'), valor: sobra > 0 ? `${MENOS}${fijo(sobra)} kg` : t('ya estás') })
  if (ritmo != null) filas.push({ nombre: c.r.periodo === 'mes' ? t('Ritmo del mes') : t('Ritmo'), valor: ritmo === 0 ? t('estable') : t('{n} kg/sem', { n: conSigno(ritmo, v => (v < 0.1 ? fijo(v, 2) : fijo(v))) }) })
  if (fechaMeta) filas.push({ nombre: t('A este ritmo, meta de grasa'), valor: fechaMeta })
  return { peso: p.valor, pesoFecha: p.fecha, grasa: g?.valor ?? null, grasaFuente: g?.fuente ?? null, meta, metaPropia: !!metaG, pesoConMeta, sobra, ritmo, fechaMeta, filas }
}

/**
 * Título de la meta en el idioma del informe: el guardado se escribió en el idioma de aquel momento.
 * Las libres van tal cual las escribió la persona.
 */
function tituloMeta(c: Ctx, m: Meta, val: (v: number, u: string) => string): string {
  switch (m.tipo) {
    case 'cintura': return t('Cintura por debajo de {valor}', { valor: val(m.objetivo, m.unidad || 'cm') })
    case 'peso': return t('Peso: {n} {unidad}', { n: kg(m.objetivo), unidad: m.unidad || 'kg' })
    case 'grasa': return t('Grasa al {valor}', { valor: conUnidad(num(m.objetivo), '%') })
    case 'dominadas': return t('{n} dominadas estrictas', { n: m.objetivo })
    case 'ejercicio': return m.ejercicio ? t('{nombre}: {valor}', { nombre: nombreDe(c, m.ejercicio), valor: val(m.objetivo, m.unidad || 'kg') }) : m.titulo
    default: return m.titulo
  }
}

export function metasInforme(c: Ctx): MetaInforme[] {
  const ses = c.hechas
  return c.metas.map(m => {
    let actual: number | null = null
    let hito: string | null = null
    if (m.tipo === 'cintura') actual = ultimoValor(c.ms, leerCintura, c.fin)?.valor ?? null
    else if (m.tipo === 'peso') actual = ultimoValor(c.ms, leerPeso, c.fin)?.valor ?? null
    else if (m.tipo === 'grasa') actual = grasaEn(c.ms, c.marina, c.fin)?.valor ?? null
    else if (m.tipo === 'dominadas') {
      const d = hitosDominadas(ses)
      actual = d.estrictas
      // El primer hito es el de las asistidas y el segundo, el de las negativas (por su sitio: el título puede ir traducido).
      const act = d.hitos.findIndex(x => x.estado === 'actual')
      hito = d.hay && act >= 0 && d.estrictas === 0 ? (act === 0 ? t('vas por las asistidas') : act === 1 ? t('vas por las negativas') : null) : null
    } else if (m.tipo === 'ejercicio' && m.ejercicio) {
      const p = ses.map(s => pesoMaximo(seriesDe(s, m.ejercicio!))).filter((v): v is number => v != null)
      actual = p.length ? Math.max(...p) : null
    }
    const libre = m.tipo === 'libre'
    const falta = libre ? null : faltaMeta(m.inicio, actual, m.objetivo)
    const conseguida = !!m.hecha || falta === 0
    const unidadFalta = m.tipo === 'grasa' ? t('puntos') : m.unidad
    const val = (v: number, u: string) => conUnidad(u === 'kg' ? kg(v) : num(v), u)
    return {
      titulo: tituloMeta(c, m, val), tipo: m.tipo, unidad: m.unidad, objetivo: m.objetivo, actual,
      actualTexto: actual != null ? val(actual, m.unidad) : libre ? (m.hecha ? t('Hecha') : t('Pendiente')) : '—',
      progreso: libre ? (m.hecha ? 1 : 0) : conseguida ? 1 : progresoMeta(m.inicio, actual, m.objetivo),
      falta,
      faltaTexto: conseguida ? t('¡Conseguida!') : hito ?? (falta != null ? t('faltan {n}', { n: val(falta, unidadFalta) }) : ''),
      conseguida, fecha: m.fecha ?? null, mes: m.fecha ? mesAnio(m.fecha) : null,
    }
  })
}

const INDICADORES: { k: keyof NonNullable<Medicion['bascula']>; nombre: string; u: string }[] = [
  { k: 'basalKcal', nombre: tk('Gasto en reposo'), u: 'kcal' },
  { k: 'masaGrasaKg', nombre: tk('Masa grasa'), u: 'kg' },
  { k: 'masaLibreKg', nombre: tk('Masa magra'), u: 'kg' },
  { k: 'musculoKg', nombre: tk('Músculo'), u: 'kg' },
  { k: 'musculoEsqKg', nombre: tk('Músculo esquelético'), u: 'kg' },
  { k: 'aguaPct', nombre: tk('Agua'), u: '%' },
  { k: 'proteinaPct', nombre: tk('Proteína'), u: '%' },
  { k: 'oseaKg', nombre: tk('Masa ósea'), u: 'kg' },
  { k: 'subcutaneaPct', nombre: tk('Grasa subcutánea'), u: '%' },
  { k: 'visceral', nombre: tk('Grasa visceral'), u: '' },
  { k: 'edadCorporal', nombre: tk('Edad corporal'), u: '' },
]

/** La última pesada con báscula del periodo (o de los 120 días anteriores al fin) que trae algún indicador. */
const ultimaBascula = (c: Ctx) => [...c.ms].reverse().find(x => dia10(x.fecha) <= c.fin && dia10(x.fecha) >= sumarDias(c.fin, -120) && INDICADORES.some(i => x.bascula?.[i.k] != null))

/** Gasto en reposo que da la báscula (el mismo de «Otros indicadores»). */
const basalBascula = (c: Ctx) => ultimaBascula(c)?.bascula?.basalKcal ?? null

export function indicadores(c: Ctx): ResumenInforme['indicadores'] {
  const m = ultimaBascula(c)
  if (!m) return null
  // Kilos y porcentajes con un decimal siempre («56,0 kg» junto a «55,6 %»); kcal, visceral y edad, enteros.
  const filas = INDICADORES.filter(i => m.bascula![i.k] != null).map(i => {
    const v = m.bascula![i.k]!
    return { nombre: t(i.nombre), valor: conUnidad(i.u === 'kg' || i.u === '%' ? fijo(v) : num(v, 0), i.u ?? '') }
  })
  return { fecha: dia10(m.fecha), filas }
}
