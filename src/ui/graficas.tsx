// Gráficas SVG con el estilo del mockup (líneas con área, puntos y último valor; barras).
import { num } from '../dominio/calculos'

export type Punto = { x: string; y: number }

const W = 320, H = 130, X0 = 40, X1 = 300, Y0 = 20, Y1 = 104

function escala(ps: Punto[], objetivo?: number) {
  const ys = ps.map(p => p.y).concat(objetivo != null ? [objetivo] : [])
  let min = Math.min(...ys), max = Math.max(...ys)
  if (min === max) { min -= 1; max += 1 }
  const m = (max - min) * 0.12
  min -= m; max += m
  const y = (v: number) => Y1 - ((v - min) / (max - min)) * (Y1 - Y0)
  const x = (i: number) => (ps.length === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (ps.length - 1))
  return { min, max, x, y }
}

export function Linea({ puntos, objetivo, etiquetaObjetivo, decimales = 1, discontinua }: { puntos: Punto[]; objetivo?: number; etiquetaObjetivo?: string; decimales?: number; discontinua?: Punto[] }) {
  if (!puntos.length) return <p className="small muted">Aún no hay datos para la gráfica.</p>
  const { min, max, x, y } = escala(discontinua?.length ? [...puntos, ...discontinua] : puntos, objetivo)
  const pts = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
  const ult = puntos[puntos.length - 1]!
  const marcas = puntos.length > 6 ? puntos.map((_, i) => i).filter(i => i % Math.ceil(puntos.length / 5) === 0 || i === puntos.length - 1) : puntos.map((_, i) => i)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[Y0, (Y0 + Y1) / 2, Y1].map(v => <line key={v} className="gl" x1="30" y1={v} x2="312" y2={v} />)}
      <text className="ax" x="0" y={Y0 + 4}>{num(max, decimales)}</text>
      <text className="ax" x="0" y={Y1 + 4}>{num(min, decimales)}</text>
      {objetivo != null && (
        <>
          <line className="tg" x1="30" y1={y(objetivo)} x2="312" y2={y(objetivo)} />
          <text className="tgl" x="312" y={y(objetivo) - 4} textAnchor="end">{etiquetaObjetivo ?? num(objetivo, decimales)}</text>
        </>
      )}
      {puntos.length > 1 && <polygon className="ar" points={`${X0},${Y1} ${pts} ${x(puntos.length - 1)},${Y1}`} />}
      {discontinua && discontinua.length > 1 && <polyline className="ln2" points={discontinua.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} />}
      {puntos.length > 1 && <polyline className="ln" points={pts} />}
      {puntos.map((p, i) => <circle key={i} className={i === puntos.length - 1 ? 'dt last' : 'dt'} cx={x(i)} cy={y(p.y)} r={i === puntos.length - 1 ? 5 : 4} />)}
      <text className="lb" x={Math.min(300, x(puntos.length - 1))} y={y(ult.y) - 10} textAnchor="end">{num(ult.y, decimales)}</text>
      {marcas.map(i => <text key={i} className="ax" x={x(i)} y="124" textAnchor="middle">{puntos[i]!.x}</text>)}
    </svg>
  )
}

export function Barras({ puntos }: { puntos: Punto[] }) {
  if (!puntos.length) return <p className="small muted">Aún no hay datos para la gráfica.</p>
  const max = Math.max(...puntos.map(p => p.y)) || 1
  const ancho = Math.min(24, (X1 - X0) / puntos.length - 6)
  const x = (i: number) => (puntos.length === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (puntos.length - 1))
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[Y0, (Y0 + Y1) / 2, Y1].map(v => <line key={v} className="gl" x1="30" y1={v} x2="312" y2={v} />)}
      <text className="ax" x="0" y={Y0 + 4}>{num(max, 0)}</text>
      {puntos.map((p, i) => {
        const h = (p.y / max) * (Y1 - Y0)
        return <rect key={i} className={i === puntos.length - 1 ? 'vb last' : 'vb'} x={x(i) - ancho / 2} y={Y1 - h} width={ancho} height={h} rx="3" />
      })}
      {puntos.map((p, i) => (puntos.length <= 7 || i % 2 === 0 || i === puntos.length - 1) && <text key={`t${i}`} className="ax" x={x(i)} y="124" textAnchor="middle">{p.x}</text>)}
    </svg>
  )
}
