// Gráficas SVG con el estilo del mockup (líneas con área, puntos y último valor; barras), ejes en números redondos.
// Con menos de 2 datos no se dibuja nada: un punto suelto con ejes raros no dice nada.
import { num } from '../dominio/formato'
import { ejeRedondo } from '../dominio/tendencias'
import { t } from '../i18n'

type Punto = { x: string; y: number }

/** Puntos de una línea pequeña (SVG 120×40) para la tendencia. */
export function lineaSpark(ys: number[], ancho = 120, alto = 40): string {
  if (ys.length < 2) return ''
  const min = Math.min(...ys), max = Math.max(...ys)
  const r = max - min || 1
  return ys.map((y, i) => `${Math.round(2 + (i * (ancho - 4)) / (ys.length - 1))},${Math.round(4 + ((max - y) / r) * (alto - 8))}`).join(' ')
}

const W = 320, H = 130, X0 = 40, X1 = 300, Y0 = 20, Y1 = 104

function escala(ps: Punto[], objetivo?: number) {
  const e = ejeRedondo(ps.map(p => p.y).concat(objetivo != null ? [objetivo] : []))
  const y = (v: number) => Y1 - ((v - e.min) / (e.max - e.min)) * (Y1 - Y0)
  const x = (i: number) => (ps.length === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (ps.length - 1))
  return { ...e, x, y }
}

/** Frase en lugar de la gráfica cuando aún no hay línea que dibujar. */
function SinLinea({ texto }: { texto: string }) {
  return <p className="small muted chart-vacia"><i className="ph ph-chart-line-up" aria-hidden="true" /> {texto}</p>
}

export function Linea({ puntos, objetivo, etiquetaObjetivo, decimales = 1, discontinua, vacia = t('Con 2 datos verás aquí la línea.') }: {
  puntos: Punto[]; objetivo?: number; etiquetaObjetivo?: string; decimales?: number; discontinua?: Punto[]
  /** Frase que sale con menos de 2 datos. */
  vacia?: string
}) {
  if (puntos.length < 2) return <SinLinea texto={vacia} />
  const { marcas, decimales: decEje, x, y } = escala(discontinua?.length ? [...puntos, ...discontinua] : puntos, objetivo)
  const pts = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
  const ult = puntos[puntos.length - 1]!
  const etiquetasX = puntos.length > 6 ? puntos.map((_, i) => i).filter(i => i % Math.ceil(puntos.length / 5) === 0 || i === puntos.length - 1) : puntos.map((_, i) => i)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Gráfica de {n} puntos, el último {ultimo}', { n: puntos.length, ultimo: num(ult.y, decimales) })}>
      {marcas.map(v => <line key={`g${v}`} className="gl" x1="30" y1={y(v)} x2="312" y2={y(v)} />)}
      {marcas.map(v => <text key={`t${v}`} className="ax" x="0" y={y(v) + 4}>{num(v, decEje)}</text>)}
      {objetivo != null && (
        <>
          <line className="tg" x1="30" y1={y(objetivo)} x2="312" y2={y(objetivo)} />
          <text className="tgl" x="312" y={y(objetivo) - 4} textAnchor="end">{etiquetaObjetivo ?? num(objetivo, decimales)}</text>
        </>
      )}
      <polygon className="ar" points={`${X0},${Y1} ${pts} ${x(puntos.length - 1)},${Y1}`} />
      {discontinua && discontinua.length > 1 && <polyline className="ln2" points={discontinua.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} />}
      <polyline className="ln" points={pts} />
      {puntos.map((p, i) => <circle key={i} className={i === puntos.length - 1 ? 'dt last' : 'dt'} cx={x(i)} cy={y(p.y)} r={i === puntos.length - 1 ? 5 : 4} />)}
      <text className="lb" x={Math.min(300, x(puntos.length - 1))} y={y(ult.y) - 10} textAnchor="end">{num(ult.y, decimales)}</text>
      {etiquetasX.map(i => <text key={i} className="ax" x={x(i)} y="124" textAnchor="middle">{puntos[i]!.x}</text>)}
    </svg>
  )
}

export function Barras({ puntos, vacia = t('Con 2 días verás aquí las barras.') }: { puntos: Punto[]; vacia?: string }) {
  if (puntos.length < 2) return <SinLinea texto={vacia} />
  const { max: tope, marcas, decimales } = ejeRedondo([0, ...puntos.map(p => p.y)])
  const max = tope || 1
  const ancho = Math.max(2, Math.min(24, (X1 - X0) / puntos.length - 6))
  const x = (i: number) => X0 + (i * (X1 - X0)) / (puntos.length - 1)
  const y = (v: number) => Y1 - (v / max) * (Y1 - Y0)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Gráfica de barras de {n} días, el último {ultimo}', { n: puntos.length, ultimo: num(puntos[puntos.length - 1]!.y, 0) })}>
      {marcas.map(v => <line key={`g${v}`} className="gl" x1="30" y1={y(v)} x2="312" y2={y(v)} />)}
      {marcas.filter(v => v > 0).map(v => <text key={`t${v}`} className="ax" x="0" y={y(v) + 4}>{num(v, decimales)}</text>)}
      {puntos.map((p, i) => {
        const h = Math.max(0, (p.y / max) * (Y1 - Y0))
        return <rect key={i} className={i === puntos.length - 1 ? 'vb last' : 'vb'} x={x(i) - ancho / 2} y={Y1 - h} width={ancho} height={h} rx="3" />
      })}
      {/* Con muchas barras, una fecha sí y otra no; la última siempre, y la penúltima nunca (se pisarían). */}
      {puntos.map((p, i) => (puntos.length <= 7 || (i % 2 === 0 && i !== puntos.length - 2) || i === puntos.length - 1) && <text key={`x${i}`} className="ax" x={x(i)} y="124" textAnchor="middle">{p.x}</text>)}
    </svg>
  )
}
