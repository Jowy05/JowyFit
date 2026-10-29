// «Tu rutina y tu salud»: perfil y objetivo, la rutina que toca, las marcas, las molestias y las revisiones.
// Para que otra persona (entrenador, médico o un asistente de IA) entienda la rutina y la ajuste.
import { t, tc } from '../../../i18n'
import type { RutinaSaludInforme } from '../../calculo/tipos'
import { TAM, type Lienzo } from '../lienzo'
import { altoConsejo, altoH2, consejo, h2, type Flujo, type Maqueta } from '../piezas'
import { tablaPartida, type Celda, type FilaTabla } from '../tablas'

/** Revisiones de una molestia que caben en una línea («4 oct igual · 11 oct peor…»): las últimas. */
const MAX_HISTORIAL = 6

/** Título de sección; si no cabe con un par de filas debajo, pasa a la página siguiente. */
function titulo(f: Flujo, texto: string, sub: string | null = null) {
  f.asegurar(altoH2(4.2) + 5.6 + 2 * 5.4)
  f.bloque(m => altoH2(m), (l, y, m) => { h2(l, f.x, y, f.w, texto, sub, m) })
}

/** Filas nombre ↔ valor: el nombre en gris y el valor (con su color, si lo lleva) partido si no cabe. */
function datos(f: Flujo, filas: RutinaSaludInforme['perfil']) {
  tablaPartida(f, [{ t: t('Dato'), w: 34 }, { t: t('Valor'), w: 0 }], filas.map(d => ({
    celdas: [{ t: d.nombre, color: f.l.c.gris }, { t: d.valor, partir: true, color: d.tono ? f.l.tono[d.tono] : undefined }],
  })), { compacta: true })
}

/** «4 oct igual · 11 oct peor»: la fecha en gris y cómo iba en su color. */
function celdaHistorial(h: RutinaSaludInforme['molestias'][number]['historial']): Celda {
  return {
    dibujar: (l: Lienzo, x: number, base: number) => {
      let cx = x
      h.slice(-MAX_HISTORIAL).forEach((v, i) => {
        if (i) cx += l.texto(cx, base, ' · ', { tam: TAM.peque, color: l.c.grisSuave })
        cx += l.texto(cx, base, `${v.fecha} `, { tam: TAM.peque, color: l.c.gris })
        cx += l.texto(cx, base, v.va, { tam: TAM.peque, peso: 'negrita', color: l.tono[v.tono] })
      })
    },
  }
}

export function paginaRutinaSalud(maq: Maqueta, rs: RutinaSaludInforme) {
  const f = maq.flujo()
  titulo(f, t('Perfil y objetivo'))
  datos(f, rs.perfil)

  if (rs.rutina?.filas.length) {
    titulo(f, t('La rutina que toca'), rs.rutina.subtitulo)
    tablaPartida(f, [{ t: t('Entreno'), w: 30 }, { t: t('Ejercicio'), w: 0 }, { t: t('Series × reps'), w: 26 }, { t: t('Peso'), w: 20, der: true }], rs.rutina.filas.map(x => ({
      celdas: [{ t: x.entreno, peso: 'negrita', color: f.l.c.tinta, partir: true }, { t: x.ejercicio, partir: true }, x.series, x.peso],
    })), { compacta: true })
  }

  if (rs.marcas.length) {
    titulo(f, t('Marcas por ejercicio'), t('la mejor serie del primer entreno y del último'))
    tablaPartida(f, [{ t: t('Ejercicio'), w: 0 }, { t: t('Al empezar'), w: 28, der: true }, { t: t('Ahora'), w: 28, der: true }, { t: tc('columna', 'Cambio'), w: 20, der: true }], rs.marcas.map(x => ({
      celdas: [{ t: x.ejercicio, partir: true }, x.antes, x.ahora, { t: x.cambio, peso: 'negrita', color: f.l.tono[x.tono] }],
    })), { compacta: true })
  }

  titulo(f, t('Molestias y dolores'))
  const filas: FilaTabla[] = rs.molestias.length ? rs.molestias.flatMap((m, i): FilaTabla[] => [
    { celdas: [{ t: m.zona, peso: 'negrita', color: f.l.c.tinta }, { t: m.detalle, partir: true }], fondo: i % 2 === 1 },
    ...(m.historial.length ? [{ celdas: [null, celdaHistorial(m.historial)], fondo: i % 2 === 1 }] : []),
    ...m.notas.map(n => ({ celdas: [null, { t: n, partir: true }], estilo: 'gris' as const, fondo: i % 2 === 1 })),
  ]) : [{ celdas: [t('Ninguna'), t('Sin molestias apuntadas')], estilo: 'gris' }]
  tablaPartida(f, [{ t: t('Zona'), w: 34 }, { t: t('Cómo va'), w: 0 }], filas, { compacta: true })

  titulo(f, t('Revisiones'))
  datos(f, rs.revisiones)

  const texto = t('Este PDF solo sale de tu móvil si tú lo compartes. Puedes dárselo a tu entrenador, a tu médico o a un asistente de IA para que ajuste tu rutina.')
  f.espacio(4)
  const { l, y } = f.sitio(altoConsejo(f.l, texto, f.w))
  consejo(l, f.x, y, f.w, t('Tus datos son tuyos'), texto)
}
