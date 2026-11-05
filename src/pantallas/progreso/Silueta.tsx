// Silueta guía de las fotos de progreso: un contorno sencillo por pose, encima de la cámara, para ponerse
// siempre a la misma distancia y en la misma postura. Mismo tamaño que el visor (3:4).
import type { Pose } from '../../dominio/fotos'

type Punto = readonly [number, number]

/** Curva suave cerrada que pasa por los puntos (Catmull-Rom pasada a Bézier). */
function curva(p: readonly Punto[]): string {
  const n = p.length
  const q = (i: number) => p[(i + n) % n]!
  let d = `M${q(0)[0]},${q(0)[1]}`
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [q(i - 1), q(i), q(i + 1), q(i + 2)]
    const x1 = b[0] + (c[0] - a[0]) / 6, y1 = b[1] + (c[1] - a[1]) / 6
    const x2 = c[0] - (e[0] - b[0]) / 6, y2 = c[1] - (e[1] - b[1]) / 6
    d += ` C${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${c[0]},${c[1]}`
  }
  return `${d} Z`
}

// Medio cuerpo de frente (el lado derecho de la imagen), del cuello al centro de las piernas; el otro medio, en espejo.
const MEDIO: readonly Punto[] = [
  [163, 80], [166, 94], [200, 102], [214, 116], [222, 152], [230, 205], [238, 250], [236, 266], [226, 264],
  [220, 218], [208, 160], [198, 146], [196, 180], [190, 208], [198, 240], [196, 300], [190, 350], [186, 372],
  [198, 384], [164, 388], [162, 356], [158, 296], [150, 262],
]
const FRENTE = [...MEDIO, ...[...MEDIO].reverse().slice(1).map(([x, y]) => [300 - x, y] as const)]

// De lado, mirando a la derecha: cuerpo y brazo pegado a él.
const LADO: readonly Punto[] = [
  [160, 80], [166, 98], [182, 116], [186, 170], [180, 232], [174, 300], [170, 336], [168, 370], [192, 384], [190, 390],
  [150, 390], [148, 344], [144, 312], [130, 246], [134, 200], [130, 130], [142, 84],
]
const BRAZO: readonly Punto[] = [[146, 112], [164, 114], [168, 172], [164, 236], [152, 240], [148, 176]]

export function Silueta({ pose }: { pose: Pose }) {
  return (
    <svg className="silueta" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {pose === 'perfil' ? (
        <>
          <ellipse cx={156} cy={52} rx={24} ry={28} />
          <path d={curva(LADO)} />
          <path d={curva(BRAZO)} />
        </>
      ) : (
        <>
          <ellipse cx={150} cy={50} rx={25} ry={29} />
          <path d={curva(FRENTE)} />
          {/* De espaldas, la columna: así se ve de un vistazo qué pose es. */}
          {pose === 'espalda' && <path className="col" d="M150,96 L150,236" />}
        </>
      )}
    </svg>
  )
}
