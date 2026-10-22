// Contexto del informe: las tablas ordenadas y recortadas al periodo, y lo que comparten todas las secciones.
import type { Ajustes, Comida, DiaSuplementos, Medicion, Meta, PasosDia, Perfil, Rutina, Sesion } from '../../datos/tipos'
import { objetivos } from '../../dominio/calculos'
import { aISO, deISO, edad, lunesDe, sumarDias } from '../../dominio/fechas'
import { estadoSemana, type EstadoDia, type Recolocada } from '../../dominio/semana'
import { grasaPorMedidas, hechasAsc, logros, subidas, ultimoValor, type Logro, type PuntoFecha, type Subida } from '../../dominio/tendencias'
import type { CatalogoInforme, EntradaInforme, RangoInforme } from './tipos'
import { diasDe, entre } from './comun'

type PerfilInforme = Pick<Perfil, 'nombre' | 'nacimiento' | 'sexo' | 'alturaCm' | 'objetivo' | 'pasosObjetivo' | 'diasFijos' | 'trabajo'>
const PERFIL_VACIO: PerfilInforme = { nombre: '', nacimiento: '', sexo: 'hombre', alturaCm: 0, objetivo: 'recomposicion', pasosObjetivo: 10_000, diasFijos: [], trabajo: 'sentado' }

const CATALOGO_VACIO: CatalogoInforme = { nombre: id => id, patron: () => undefined, met: () => undefined }

export type Ctx = {
  r: RangoInforme
  hoy: string
  inicio: string
  fin: string
  p: PerfilInforme
  hayPerfil: boolean
  ajustes: Ajustes | null | undefined
  ms: Medicion[]
  marina: PuntoFecha[]
  todas: Sesion[]
  /** Sesiones hechas hasta el fin del periodo, de la más antigua a la más reciente. */
  hechas: Sesion[]
  enPeriodo: Sesion[]
  rutina: Rutina | null | undefined
  recolocadas: Recolocada[]
  fijos: number
  comidas: Comida[]
  pasos: PasosDia[]
  suplementos: DiaSuplementos[]
  metas: Meta[]
  cat: CatalogoInforme
  obj: { kcal: number; proteina: number }
  logros: Logro[]
  subidas: Subida[]
  dias: string[]
}

/** Edad en una fecha; null si no hay fecha de nacimiento. */
export function edadEn(nacimiento: string, fecha: string): number | null {
  return /^\d{4}-\d{2}-\d{2}/.test(nacimiento) ? edad(nacimiento, deISO(fecha)) : null
}

/** Objetivo de kcal y proteína como `objetivosEnergia`, pero con el peso de la fecha del informe. */
export function objetivosInforme(p: PerfilInforme, a: Ajustes | null | undefined, peso: number | null, fecha: string): { kcal: number; proteina: number } {
  const o = objetivos({ pesoKg: peso ?? 75, alturaCm: p.alturaCm, edad: edadEn(p.nacimiento, fecha) ?? 30, sexo: p.sexo, trabajo: p.trabajo, objetivo: p.objetivo, entrenosSemana: p.diasFijos.length })
  return { kcal: a?.kcalManual ?? o.kcal, proteina: a?.proteinaManual ?? o.proteina }
}

export const leerPeso = (m: Medicion) => m.pesoKg
export const leerCintura = (m: Medicion) => m.perimetros?.cintura
export const leerGrasaBascula = (m: Medicion) => m.bascula?.grasaPct

/** % de grasa en una fecha como la app: el de la báscula de los 4 meses anteriores o, si no, el de la cinta. */
export function grasaEn(c: Pick<Ctx, 'ms' | 'marina'>, fecha: string): (PuntoFecha & { fuente: 'bascula' | 'medidas' }) | null {
  const b = ultimoValor(c.ms, leerGrasaBascula, fecha)
  if (b && b.fecha >= sumarDias(fecha, -120)) return { ...b, fuente: 'bascula' }
  const m = c.marina.filter(x => x.fecha <= fecha).at(-1)
  return m ? { ...m, fuente: 'medidas' } : null
}

export function contexto(e: EntradaInforme, r: RangoInforme): Ctx {
  const p: PerfilInforme = { ...PERFIL_VACIO, ...(e.perfil ?? {}) }
  const ms = [...e.mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const hechas = hechasAsc(e.sesiones).filter(s => s.fecha <= r.fin)
  const enPeriodo = hechas.filter(s => s.fecha >= r.inicio)
  const peso = ultimoValor(ms, leerPeso, r.fin)?.valor ?? null
  const enRango = (f: string) => entre(f, r.inicio, r.fin)
  return {
    r, hoy: r.hoy, inicio: r.inicio, fin: r.fin, p, hayPerfil: !!e.perfil, ajustes: e.ajustes,
    ms, marina: grasaPorMedidas(ms, p.sexo, p.alturaCm),
    todas: e.sesiones, hechas, enPeriodo,
    rutina: e.rutina, recolocadas: e.ajustes?.recolocadas ?? [],
    fijos: e.rutina ? e.rutina.dias.filter(d => !d.opcional).length : p.diasFijos.length,
    comidas: e.comidas, pasos: e.pasos, suplementos: e.suplementos, metas: e.metas,
    cat: e.catalogo ?? CATALOGO_VACIO,
    obj: objetivosInforme(p, e.ajustes, peso, r.fin),
    logros: logros(hechas).filter(l => enRango(l.fecha)),
    subidas: subidas(hechas).filter(s => enRango(s.fecha)),
    dias: diasDe(r.inicio, r.fin),
  }
}

/** Estado de cada día (hecho, perdido, movido, descanso…) entre dos fechas, también de semanas pasadas. */
export function estadosDias(c: Ctx, desde: string, hasta: string): EstadoDia[] {
  const out: EstadoDia[] = []
  for (let l = lunesDe(desde); l <= hasta; l = sumarDias(l, 7)) {
    const dom = sumarDias(l, 6)
    for (const d of estadoSemana(c.rutina, c.todas, dom < c.hoy ? dom : c.hoy, c.recolocadas)) {
      if (!entre(d.fecha, desde, hasta)) continue
      let x: EstadoDia = d
      // El domingo de una semana pasada sale como «plan» (es el «hoy» de la llamada): ya pasó.
      if (d.estado === 'plan' && d.fecha < c.hoy) {
        // Hay plan, luego hay rutina.
        x = d.fecha < aISO(new Date(c.rutina!.creada)) ? { fecha: d.fecha, estado: 'descanso', hoy: false } : { ...d, estado: c.recolocadas.some(y => y.desde === d.fecha) ? 'movido' : 'perdido' }
      }
      out.push({ ...x, hoy: x.fecha === c.hoy })
    }
  }
  return out
}

/** Entrenos de unos días: hechos en días distintos, los que tocaban (hechos en día fijo + perdidos) y los extra. */
export function cuentaEntrenos(c: Ctx, desde: string, hasta: string) {
  const estados = estadosDias(c, desde, hasta)
  const dias = new Set(c.hechas.filter(s => entre(s.fecha, desde, hasta)).map(s => s.fecha))
  const enFijos = estados.filter(e => e.estado === 'hecho' && e.dia && !e.dia.opcional).length
  const perdidos = estados.filter(e => e.estado === 'perdido')
  return { estados, hechos: dias.size, enFijos, perdidos, movidos: estados.filter(e => e.estado === 'movido').length, tocaban: enFijos + perdidos.length, extra: Math.max(0, dias.size - enFijos) }
}

/** Nombres propios del catálogo que van siempre con mayúscula (Press Arnold, Máquina Smith…). */
const PROPIOS = new Set(['Arnold', 'Pallof', 'Pendlay', 'Zercher', 'Zottman', 'Scott', 'Smith', 'Jefferson', 'Svend', 'Spoto', 'Pilates', 'Landmine'])

/**
 * Nombre de ejercicio como en la maqueta: solo la primera letra en mayúscula («Press de Banca con Barra» → «Press de banca con barra»).
 * Se respetan las siglas (TRX, EZ), las letras sueltas (Z, T) y los nombres propios.
 */
function nombreNormal(t: string): string {
  return t.split(' ').map((p, i) => {
    if (i === 0 || p.length <= 1 || PROPIOS.has(p) || /\d/.test(p) || (p.match(/\p{Lu}/gu)?.length ?? 0) >= 2) return p
    return p.toLowerCase()
  }).join(' ')
}

/** Nombre dentro de una frase: «press de banca con barra» (las siglas y los nombres propios se quedan). */
export const nombreEnFrase = (t: string) => {
  const [p, ...resto] = nombreNormal(t).split(' ')
  const primera = !p || p.length <= 1 || PROPIOS.has(p) || (p.match(/\p{Lu}/gu)?.length ?? 0) >= 2 ? p ?? '' : p.charAt(0).toLowerCase() + p.slice(1)
  return [primera, ...resto].join(' ')
}

export const nombreDe = (c: Ctx, id: string) => nombreNormal(c.cat.nombre(id))
