// Motor puro de biomecánica y conteo de repeticiones válidas/inválidas para flexiones, sentadillas y plancha.
// Sin dependencias de cámara ni DOM: recibe puntos 2D o 3D (metros del modelo BlazePose) y evalúa postura y fases.
import type { EjercicioPostura } from './retos'
import { tk } from '../i18n'

export type Punto2D = { x: number; y: number; z?: number; confianza: number }

export type PuntosPostura = {
  cara?: Punto2D
  hombroIzq?: Punto2D
  hombroDer?: Punto2D
  codoIzq?: Punto2D
  codoDer?: Punto2D
  munecaIzq?: Punto2D
  munecaDer?: Punto2D
  caderaIzq?: Punto2D
  caderaDer?: Punto2D
  rodillaIzq?: Punto2D
  rodillaDer?: Punto2D
  tobilloIzq?: Punto2D
  tobilloDer?: Punto2D
}

export type FaseMovimiento = 'arriba' | 'bajando' | 'abajo'

export type EstadoPostura = {
  fase: FaseMovimiento
  validas: number
  invalidas: number
  /** Segundos acumulados con postura correcta (plancha). */
  segundosValidos: number
  posturaBien: boolean
  /** Clave traducible con tk() para pintar con t(). */
  aviso: string
  /** Último instante (ms) de evaluación, para acumular tiempo en plancha. */
  ultimoMs: number | null
  /** Último instante (ms) de repetición contada (evita rebotes). */
  ultimaRepMs: number
  /** Ángulo mínimo alcanzado durante el descenso actual (para distinguir media rep de rep completa). */
  anguloMinBajada: number
  /** Si durante la bajada actual hubo fallo postural real (cadera caída, espalda doblada…). */
  falloEnRep: string | null
  /** 0..100 de progreso visual hacia abajo (barra de profundidad; 100 % = profundidad válida alcanzada). */
  profundidadPct: number
  /** Último ángulo medido de la articulación principal (codo/rodilla/cadera), útil para feedback en vivo. */
  anguloActual: number
  cuerpoVisible: boolean
  caraVisible: boolean
}

const CONF_MIN = 0.45
const REBOTE_MS = 320

export function estadoPosturaInicial(): EstadoPostura {
  return {
    fase: 'arriba',
    validas: 0,
    invalidas: 0,
    segundosValidos: 0,
    posturaBien: true,
    aviso: '',
    ultimoMs: null,
    ultimaRepMs: 0,
    anguloMinBajada: 180,
    falloEnRep: null,
    profundidadPct: 0,
    anguloActual: 180,
    cuerpoVisible: false,
    caraVisible: false,
  }
}

const visible = (p?: Punto2D, min = CONF_MIN): p is Punto2D =>
  !!p && p.confianza >= min && Number.isFinite(p.x) && Number.isFinite(p.y)

const conZ = (a: Punto2D, b: Punto2D, c?: Punto2D): boolean =>
  Number.isFinite(a.z) && Number.isFinite(b.z) && (!c || Number.isFinite(c.z))

/** Punto medio de un par izquierdo/derecho (o el único visible si la persona está de perfil). */
export function puntoMedio(a?: Punto2D, b?: Punto2D): Punto2D | undefined {
  const va = visible(a), vb = visible(b)
  if (va && vb) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      ...(conZ(a, b) ? { z: (a.z! + b.z!) / 2 } : {}),
      confianza: (a.confianza + b.confianza) / 2,
    }
  }
  return va ? a : vb ? b : undefined
}

/** Ángulo interior (0..180°) en el vértice `b` formado por `b→a` y `b→c` (3D si hay `z`, si no 2D). */
export function angulo(a: Punto2D, b: Punto2D, c: Punto2D): number {
  const ux = a.x - b.x, uy = a.y - b.y, uz = conZ(a, b, c) ? a.z! - b.z! : 0
  const vx = c.x - b.x, vy = c.y - b.y, vz = conZ(a, b, c) ? c.z! - b.z! : 0
  const mag = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz)
  if (mag < 1e-6) return 180
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / mag))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Elige el ángulo del lado más fiable (o la media si ambos se ven igual de bien).
 * Evita que el brazo o pierna tapados en vista lateral distorsionen el ángulo real.
 */
function anguloMejorLado(
  izq: [Punto2D | undefined, Punto2D | undefined, Punto2D | undefined],
  der: [Punto2D | undefined, Punto2D | undefined, Punto2D | undefined],
): number | null {
  const okI = visible(izq[0]) && visible(izq[1]) && visible(izq[2])
  const okD = visible(der[0]) && visible(der[1]) && visible(der[2])
  if (!okI && !okD) return null
  if (okI && !okD) return angulo(izq[0]!, izq[1]!, izq[2]!)
  if (!okI && okD) return angulo(der[0]!, der[1]!, der[2]!)
  const confI = Math.min(izq[0]!.confianza, izq[1]!.confianza, izq[2]!.confianza)
  const confD = Math.min(der[0]!.confianza, der[1]!.confianza, der[2]!.confianza)
  const angI = angulo(izq[0]!, izq[1]!, izq[2]!)
  const angD = angulo(der[0]!, der[1]!, der[2]!)
  if (confI > confD + 0.15) return angI
  if (confD > confI + 0.15) return angD
  return (angI + angD) / 2
}

/**
 * Inclinación del tronco respecto a la vertical (0° = totalmente erguido, 90° = horizontal).
 * En coordenadas de imagen y de MediaPipe worldLandmarks, `y` crece hacia abajo.
 */
export function inclinacionVertical(hombro: Punto2D, cadera: Punto2D): number {
  const dx = hombro.x - cadera.x
  const dz = conZ(hombro, cadera) ? hombro.z! - cadera.z! : 0
  const horiz = Math.hypot(dx, dz)
  const dy = Math.abs(cadera.y - hombro.y)
  return (Math.atan2(horiz, Math.max(1e-6, dy)) * 180) / Math.PI
}

/**
 * Alineación corporal en flexiones y plancha (`hombro - cadera - tobillo`).
 * Devuelve ángulo (180° = recto) y si la cadera cae (`caida`) o sube demasiado (`alta`).
 */
export function alineacionCadera(hombro: Punto2D, cadera: Punto2D, tobillo: Punto2D): { grados: number; estado: 'bien' | 'caida' | 'alta' } {
  const grados = angulo(hombro, cadera, tobillo)
  if (grados >= 140) return { grados, estado: 'bien' }
  const dx = tobillo.x - hombro.x
  const dz = conZ(hombro, tobillo) ? tobillo.z! - hombro.z! : 0
  const len2 = dx * dx + dz * dz
  const t = len2 < 1e-6
    ? 0.5
    : ((cadera.x - hombro.x) * dx + (conZ(hombro, cadera, tobillo) ? (cadera.z! - hombro.z!) * dz : 0)) / len2
  const yRecta = hombro.y + Math.max(0, Math.min(1, t)) * (tobillo.y - hombro.y)
  return { grados, estado: cadera.y > yRecta ? 'caida' : 'alta' }
}

function mejorAlineacion(pts: PuntosPostura, minConf = 0.55): { grados: number; estado: 'bien' | 'caida' | 'alta' } | null {
  const lados: [Punto2D | undefined, Punto2D | undefined, Punto2D | undefined][] = [
    [pts.hombroIzq, pts.caderaIzq, pts.tobilloIzq],
    [pts.hombroDer, pts.caderaDer, pts.tobilloDer],
  ]
  let mejor: { conf: number; h: Punto2D; c: Punto2D; t: Punto2D } | null = null
  for (const [h, c, t] of lados) {
    if (!visible(h, minConf) || !visible(c, minConf) || !visible(t, minConf)) continue
    const conf = Math.min(h.confianza, c.confianza, t.confianza)
    if (!mejor || conf > mejor.conf) mejor = { conf, h, c, t }
  }
  if (!mejor) return null
  // En vista estrictamente frontal muy acortada, hombro y tobillo quedan casi juntos en X: evitar falsos avisos.
  const sep = Math.hypot(mejor.t.x - mejor.h.x, mejor.t.y - mejor.h.y, conZ(mejor.h, mejor.t) ? mejor.t.z! - mejor.h.z! : 0)
  if (sep < 0.22) return null
  return alineacionCadera(mejor.h, mejor.c, mejor.t)
}

const AVISO_ENCUADRE = tk('Colócate de cuerpo entero frente a la cámara')
const AVISO_PLANCHA_POS = tk('Colócate en posición de plancha')
const AVISO_CADERA_CAIDA = tk('Cadera caída: aprieta el abdomen')
const AVISO_CADERA_ALTA = tk('Baja un poco la cadera')
const AVISO_PECHO_BAJO = tk('Baja un poco más el pecho')
const AVISO_SENTADILLA_BAJA = tk('Baja un poco más la cadera')
const AVISO_ESPALDA = tk('Espalda más recta')
const AVISO_RODILLAS = tk('Rodillas hacia fuera')
const AVISO_BIEN = tk('Buena técnica')

/** Evalúa un fotograma de puntos corporales y devuelve el nuevo estado (sin mutar el anterior). */
export function evaluarPostura(prev: EstadoPostura, pts: PuntosPostura, ejercicio: EjercicioPostura, ahoraMs: number): EstadoPostura {
  const caraVisible = visible(pts.cara)
  const hombro = puntoMedio(pts.hombroIzq, pts.hombroDer)
  const cadera = puntoMedio(pts.caderaIzq, pts.caderaDer)
  const rodilla = puntoMedio(pts.rodillaIzq, pts.rodillaDer)

  if (ejercicio === 'plancha') {
    const al = mejorAlineacion(pts, CONF_MIN)
    const tobillo = puntoMedio(pts.tobilloIzq, pts.tobilloDer)
    if (!hombro || !cadera || (!al && !tobillo)) {
      return { ...prev, cuerpoVisible: false, caraVisible, posturaBien: false, aviso: AVISO_ENCUADRE, ultimoMs: ahoraMs, profundidadPct: 0 }
    }
    const incl = inclinacionVertical(hombro, cadera)
    if (incl < 45) {
      return { ...prev, cuerpoVisible: true, caraVisible, posturaBien: false, aviso: AVISO_PLANCHA_POS, ultimoMs: ahoraMs, profundidadPct: 10 }
    }
    const evalAl = al ?? alineacionCadera(hombro, cadera, tobillo!)
    const bien = evalAl.estado === 'bien'
    const dt = prev.ultimoMs != null ? Math.max(0, Math.min(1, (ahoraMs - prev.ultimoMs) / 1000)) : 0
    const aviso = evalAl.estado === 'caida' ? AVISO_CADERA_CAIDA : evalAl.estado === 'alta' ? AVISO_CADERA_ALTA : AVISO_BIEN
    return {
      ...prev,
      cuerpoVisible: true,
      caraVisible,
      posturaBien: bien,
      aviso,
      ultimoMs: ahoraMs,
      segundosValidos: prev.segundosValidos + (bien ? dt : 0),
      profundidadPct: bien ? 100 : Math.max(15, Math.round((evalAl.grados / 180) * 100)),
      anguloActual: Math.round(evalAl.grados),
    }
  }

  if (ejercicio === 'flexiones') {
    const angCodoRaw = anguloMejorLado(
      [pts.hombroIzq, pts.codoIzq, pts.munecaIzq],
      [pts.hombroDer, pts.codoDer, pts.munecaDer],
    )
    if (angCodoRaw === null || !hombro || !cadera) {
      return { ...prev, cuerpoVisible: false, caraVisible, posturaBien: false, aviso: AVISO_ENCUADRE, ultimoMs: ahoraMs, profundidadPct: 0 }
    }
    // En vista frontal en 3D, cuando el pecho baja cerca de las manos el codo suele marcar ~115-122° en BlazePose Lite.
    const muneca = puntoMedio(pts.munecaIzq, pts.munecaDer)
    const pechoCercaManos = !!muneca && conZ(hombro, muneca) && (muneca.y - hombro.y) <= 0.16 && angCodoRaw <= 124
    const angCodo = pechoCercaManos ? Math.min(angCodoRaw, 112) : angCodoRaw

    const al = mejorAlineacion(pts, 0.65)
    const falloPostura = al?.estado === 'caida' ? AVISO_CADERA_CAIDA : al?.estado === 'alta' ? AVISO_CADERA_ALTA : null
    // 100 % en la barra coincide exactamente con el umbral de profundidad válida (115°).
    const profundidadPct = Math.round(Math.max(0, Math.min(100, ((148 - angCodo) / (148 - 115)) * 100)))
    return avanzarRepeticion(prev, {
      ang: angCodo,
      umbralArriba: 140,
      umbralInicioBajada: 130,
      umbralAbajo: 115,
      umbralParcial: 126,
      falloPostura,
      avisoPocoBajo: AVISO_PECHO_BAJO,
      profundidadPct,
      caraVisible,
      ahoraMs,
    })
  }

  // Sentadillas
  const angRodillaRaw = anguloMejorLado(
    [pts.caderaIzq, pts.rodillaIzq, pts.tobilloIzq],
    [pts.caderaDer, pts.rodillaDer, pts.tobilloDer],
  )
  if (angRodillaRaw === null || !hombro || !cadera || !rodilla) {
    return { ...prev, cuerpoVisible: false, caraVisible, posturaBien: false, aviso: AVISO_ENCUADRE, ultimoMs: ahoraMs, profundidadPct: 0 }
  }
  // Profundidad relativa al largo del muslo (adimensional: funciona igual en 2D y en metros 3D).
  const muslo = Math.hypot(
    rodilla.x - cadera.x,
    rodilla.y - cadera.y,
    conZ(cadera, rodilla) ? rodilla.z! - cadera.z! : 0,
  )
  const caderaParalela = muslo > 0.05 && (rodilla.y - cadera.y) <= muslo * 0.45 && angRodillaRaw <= 130
  const angRodilla = caderaParalela ? Math.min(angRodillaRaw, 116) : angRodillaRaw

  const incl = inclinacionVertical(hombro, cadera)
  let falloPostura: string | null = incl > 58 ? AVISO_ESPALDA : null
  if (!falloPostura && visible(pts.rodillaIzq, 0.65) && visible(pts.rodillaDer, 0.65) && visible(pts.caderaIzq, 0.65) && visible(pts.caderaDer, 0.65)) {
    const anchoCadera = Math.hypot(
      pts.caderaDer.x - pts.caderaIzq.x,
      conZ(pts.caderaIzq, pts.caderaDer) ? pts.caderaDer.z! - pts.caderaIzq.z! : 0,
    )
    const anchoRodillas = Math.hypot(
      pts.rodillaDer.x - pts.rodillaIzq.x,
      conZ(pts.rodillaIzq, pts.rodillaDer) ? pts.rodillaDer.z! - pts.rodillaIzq.z! : 0,
    )
    if (anchoCadera > 0.08 && angRodilla < 130 && anchoRodillas < anchoCadera * 0.62) falloPostura = AVISO_RODILLAS
  }
  // 100 % en la barra coincide exactamente con el umbral de profundidad válida (120°).
  const profundidadPct = Math.round(Math.max(0, Math.min(100, ((154 - angRodilla) / (154 - 120)) * 100)))
  return avanzarRepeticion(prev, {
    ang: angRodilla,
    umbralArriba: 146,
    umbralInicioBajada: 136,
    umbralAbajo: 120,
    umbralParcial: 131,
    falloPostura,
    avisoPocoBajo: AVISO_SENTADILLA_BAJA,
    profundidadPct,
    caraVisible,
    ahoraMs,
  })
}

type ConfigRep = {
  ang: number
  umbralArriba: number
  umbralInicioBajada: number
  umbralAbajo: number
  umbralParcial: number
  falloPostura: string | null
  avisoPocoBajo: string
  profundidadPct: number
  caraVisible: boolean
  ahoraMs: number
}

function avanzarRepeticion(prev: EstadoPostura, c: ConfigRep): EstadoPostura {
  let { fase, validas, invalidas, anguloMinBajada, falloEnRep, ultimaRepMs } = prev
  let aviso = c.falloPostura ?? (prev.aviso === AVISO_ENCUADRE || prev.aviso === AVISO_PLANCHA_POS ? AVISO_BIEN : prev.aviso || AVISO_BIEN)
  let posturaBien = !c.falloPostura

  if (fase === 'arriba') {
    if (c.ang <= c.umbralInicioBajada) {
      fase = c.ang <= c.umbralAbajo ? 'abajo' : 'bajando'
      anguloMinBajada = c.ang
      falloEnRep = c.falloPostura
    }
  } else if (fase === 'bajando') {
    if (c.ang < anguloMinBajada) anguloMinBajada = c.ang
    if (c.falloPostura) falloEnRep = c.falloPostura
    if (c.ang <= c.umbralAbajo) {
      fase = 'abajo'
    } else if (c.ang >= c.umbralArriba) {
      if (anguloMinBajada <= c.umbralParcial && c.ahoraMs - ultimaRepMs >= REBOTE_MS) {
        invalidas++
        ultimaRepMs = c.ahoraMs
        aviso = falloEnRep ?? c.avisoPocoBajo
        posturaBien = false
      }
      fase = 'arriba'
      anguloMinBajada = 180
      falloEnRep = null
    }
  } else if (fase === 'abajo') {
    if (c.ang < anguloMinBajada) anguloMinBajada = c.ang
    if (c.falloPostura) falloEnRep = c.falloPostura
    if (c.ang >= c.umbralArriba) {
      if (c.ahoraMs - ultimaRepMs >= REBOTE_MS) {
        if (falloEnRep) {
          invalidas++
          aviso = falloEnRep
          posturaBien = false
        } else {
          validas++
          aviso = AVISO_BIEN
          posturaBien = true
        }
        ultimaRepMs = c.ahoraMs
      }
      fase = 'arriba'
      anguloMinBajada = 180
      falloEnRep = null
    }
  }

  return {
    ...prev,
    fase,
    validas,
    invalidas,
    anguloMinBajada,
    falloEnRep,
    ultimaRepMs,
    aviso,
    posturaBien,
    profundidadPct: c.profundidadPct,
    anguloActual: Math.round(c.ang),
    cuerpoVisible: true,
    caraVisible: c.caraVisible,
    ultimoMs: c.ahoraMs,
  }
}
