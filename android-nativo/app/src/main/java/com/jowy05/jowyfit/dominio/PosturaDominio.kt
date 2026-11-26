package com.jowy05.jowyfit.dominio

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Motor puro de biomecánica 3D para flexiones, sentadillas y plancha (1:1 con src/dominio/postura.ts).
 * Recibe puntos 2D o 3D (metros de MediaPipe BlazePose worldLandmarks) y cuenta repeticiones válidas/inválidas.
 */
object PosturaDominio {

    private const val CONF_MIN = 0.45
    private const val REBOTE_MS = 320L

    data class Punto3D(val x: Double, val y: Double, val z: Double? = null, val confianza: Double = 1.0)

    data class PuntosPostura(
        val cara: Punto3D? = null,
        val hombroIzq: Punto3D? = null,
        val hombroDer: Punto3D? = null,
        val codoIzq: Punto3D? = null,
        val codoDer: Punto3D? = null,
        val munecaIzq: Punto3D? = null,
        val munecaDer: Punto3D? = null,
        val caderaIzq: Punto3D? = null,
        val caderaDer: Punto3D? = null,
        val rodillaIzq: Punto3D? = null,
        val rodillaDer: Punto3D? = null,
        val tobilloIzq: Punto3D? = null,
        val tobilloDer: Punto3D? = null,
    )

    enum class Fase { ARRIBA, BAJANDO, ABAJO }

    data class EstadoPostura(
        val fase: Fase = Fase.ARRIBA,
        val validas: Int = 0,
        val invalidas: Int = 0,
        val segundosValidos: Double = 0.0,
        val posturaBien: Boolean = true,
        val aviso: String = "",
        val ultimoMs: Long? = null,
        val ultimaRepMs: Long = 0L,
        val anguloMinBajada: Double = 180.0,
        val falloEnRep: String? = null,
        val profundidadPct: Int = 0,
        val anguloActual: Int = 180,
        val cuerpoVisible: Boolean = false,
        val caraVisible: Boolean = false,
    )

    data class Alineacion(val grados: Double, val estado: String)

    private const val AVISO_ENCUADRE = "Colócate de cuerpo entero frente a la cámara"
    private const val AVISO_PLANCHA_POS = "Colócate en posición de plancha"
    private const val AVISO_CADERA_CAIDA = "Cadera caída: aprieta el abdomen"
    private const val AVISO_CADERA_ALTA = "Baja un poco la cadera"
    private const val AVISO_PECHO_BAJO = "Baja un poco más el pecho"
    private const val AVISO_SENTADILLA_BAJA = "Baja un poco más la cadera"
    private const val AVISO_ESPALDA = "Espalda más recta"
    private const val AVISO_RODILLAS = "Rodillas hacia fuera"
    private const val AVISO_BIEN = "Buena técnica"

    private fun visible(p: Punto3D?, minConf: Double = CONF_MIN): Boolean =
        p != null && p.confianza >= minConf && p.x.isFinite() && p.y.isFinite()

    private fun conZ(a: Punto3D, b: Punto3D, c: Punto3D? = null): Boolean =
        a.z != null && a.z.isFinite() && b.z != null && b.z.isFinite() && (c == null || (c.z != null && c.z.isFinite()))

    private fun hypot3(x: Double, y: Double, z: Double = 0.0): Double = sqrt(x * x + y * y + z * z)

    fun puntoMedio(a: Punto3D?, b: Punto3D?): Punto3D? {
        val va = visible(a)
        val vb = visible(b)
        if (va && vb) {
            val az = a!!.z
            val bz = b!!.z
            val z = if (az != null && bz != null && az.isFinite() && bz.isFinite()) (az + bz) / 2.0 else null
            return Punto3D((a.x + b.x) / 2.0, (a.y + b.y) / 2.0, z, (a.confianza + b.confianza) / 2.0)
        }
        return if (va) a else if (vb) b else null
    }

    fun angulo(a: Punto3D, b: Punto3D, c: Punto3D): Double {
        val z = conZ(a, b, c)
        val ux = a.x - b.x
        val uy = a.y - b.y
        val uz = if (z) a.z!! - b.z!! else 0.0
        val vx = c.x - b.x
        val vy = c.y - b.y
        val vz = if (z) c.z!! - b.z!! else 0.0
        val mag = hypot3(ux, uy, uz) * hypot3(vx, vy, vz)
        if (mag < 1e-6) return 180.0
        val cos = ((ux * vx + uy * vy + uz * vz) / mag).coerceIn(-1.0, 1.0)
        return Math.toDegrees(acos(cos))
    }

    private fun anguloMejorLado(
        i0: Punto3D?, i1: Punto3D?, i2: Punto3D?,
        d0: Punto3D?, d1: Punto3D?, d2: Punto3D?,
    ): Double? {
        val okI = visible(i0) && visible(i1) && visible(i2)
        val okD = visible(d0) && visible(d1) && visible(d2)
        if (!okI && !okD) return null
        if (okI && !okD) return angulo(i0!!, i1!!, i2!!)
        if (!okI && okD) return angulo(d0!!, d1!!, d2!!)
        val confI = min(i0!!.confianza, min(i1!!.confianza, i2!!.confianza))
        val confD = min(d0!!.confianza, min(d1!!.confianza, d2!!.confianza))
        val angI = angulo(i0, i1, i2)
        val angD = angulo(d0, d1, d2)
        return when {
            confI > confD + 0.15 -> angI
            confD > confI + 0.15 -> angD
            else -> (angI + angD) / 2.0
        }
    }

    fun inclinacionVertical(hombro: Punto3D, cadera: Punto3D): Double {
        val dx = hombro.x - cadera.x
        val dz = if (conZ(hombro, cadera)) hombro.z!! - cadera.z!! else 0.0
        val horiz = hypot3(dx, dz)
        val dy = abs(cadera.y - hombro.y)
        return Math.toDegrees(atan2(horiz, max(1e-6, dy)))
    }

    fun alineacionCadera(hombro: Punto3D, cadera: Punto3D, tobillo: Punto3D): Alineacion {
        val grados = angulo(hombro, cadera, tobillo)
        if (grados >= 140.0) return Alineacion(grados, "bien")
        val dx = tobillo.x - hombro.x
        val dz = if (conZ(hombro, tobillo)) tobillo.z!! - hombro.z!! else 0.0
        val len2 = dx * dx + dz * dz
        val t = if (len2 < 1e-6) {
            0.5
        } else {
            val zPart = if (conZ(hombro, cadera, tobillo)) (cadera.z!! - hombro.z!!) * dz else 0.0
            ((cadera.x - hombro.x) * dx + zPart) / len2
        }
        val yRecta = hombro.y + t.coerceIn(0.0, 1.0) * (tobillo.y - hombro.y)
        return Alineacion(grados, if (cadera.y > yRecta) "caida" else "alta")
    }

    private fun mejorAlineacion(pts: PuntosPostura, minConf: Double = 0.55): Alineacion? {
        val lados = listOf(
            Triple(pts.hombroIzq, pts.caderaIzq, pts.tobilloIzq),
            Triple(pts.hombroDer, pts.caderaDer, pts.tobilloDer),
        )
        var mejor: Pair<Double, Triple<Punto3D, Punto3D, Punto3D>>? = null
        for ((h, c, t) in lados) {
            if (!visible(h, minConf) || !visible(c, minConf) || !visible(t, minConf)) continue
            val conf = min(h!!.confianza, min(c!!.confianza, t!!.confianza))
            if (mejor == null || conf > mejor.first) mejor = conf to Triple(h, c, t)
        }
        val (_, tri) = mejor ?: return null
        val (h, c, t) = tri
        val sep = hypot3(t.x - h.x, t.y - h.y, if (conZ(h, t)) t.z!! - h.z!! else 0.0)
        if (sep < 0.22) return null
        return alineacionCadera(h, c, t)
    }

    fun evaluar(prev: EstadoPostura, pts: PuntosPostura, ejercicio: RetosDominio.EjercicioPostura, ahoraMs: Long): EstadoPostura {
        val caraVis = visible(pts.cara)
        val hombro = puntoMedio(pts.hombroIzq, pts.hombroDer)
        val cadera = puntoMedio(pts.caderaIzq, pts.caderaDer)
        val rodilla = puntoMedio(pts.rodillaIzq, pts.rodillaDer)

        if (ejercicio == RetosDominio.EjercicioPostura.PLANCHA) {
            val al = mejorAlineacion(pts, CONF_MIN)
            val tobillo = puntoMedio(pts.tobilloIzq, pts.tobilloDer)
            if (hombro == null || cadera == null || (al == null && tobillo == null)) {
                return prev.copy(cuerpoVisible = false, caraVisible = caraVis, posturaBien = false, aviso = AVISO_ENCUADRE, ultimoMs = ahoraMs, profundidadPct = 0)
            }
            if (inclinacionVertical(hombro, cadera) < 45.0) {
                return prev.copy(cuerpoVisible = true, caraVisible = caraVis, posturaBien = false, aviso = AVISO_PLANCHA_POS, ultimoMs = ahoraMs, profundidadPct = 10)
            }
            val evalAl = al ?: alineacionCadera(hombro, cadera, tobillo!!)
            val bien = evalAl.estado == "bien"
            val dt = prev.ultimoMs?.let { ((ahoraMs - it) / 1000.0).coerceIn(0.0, 1.0) } ?: 0.0
            val aviso = when (evalAl.estado) {
                "caida" -> AVISO_CADERA_CAIDA
                "alta" -> AVISO_CADERA_ALTA
                else -> AVISO_BIEN
            }
            return prev.copy(
                cuerpoVisible = true,
                caraVisible = caraVis,
                posturaBien = bien,
                aviso = aviso,
                ultimoMs = ahoraMs,
                segundosValidos = prev.segundosValidos + if (bien) dt else 0.0,
                profundidadPct = if (bien) 100 else max(15, ((evalAl.grados / 180.0) * 100.0).roundToInt()),
                anguloActual = evalAl.grados.roundToInt(),
            )
        }

        if (ejercicio == RetosDominio.EjercicioPostura.FLEXIONES) {
            val angRaw = anguloMejorLado(pts.hombroIzq, pts.codoIzq, pts.munecaIzq, pts.hombroDer, pts.codoDer, pts.munecaDer)
            if (angRaw == null || hombro == null || cadera == null) {
                return prev.copy(cuerpoVisible = false, caraVisible = caraVis, posturaBien = false, aviso = AVISO_ENCUADRE, ultimoMs = ahoraMs, profundidadPct = 0)
            }
            val muneca = puntoMedio(pts.munecaIzq, pts.munecaDer)
            val pechoCerca = muneca != null && conZ(hombro, muneca) && (muneca.y - hombro.y) <= 0.16 && angRaw <= 124.0
            val ang = if (pechoCerca) min(angRaw, 112.0) else angRaw
            val al = mejorAlineacion(pts, 0.65)
            val fallo = when (al?.estado) {
                "caida" -> AVISO_CADERA_CAIDA
                "alta" -> AVISO_CADERA_ALTA
                else -> null
            }
            val prof = (((148.0 - ang) / (148.0 - 115.0)) * 100.0).roundToInt().coerceIn(0, 100)
            return avanzarRep(prev, ang, 140.0, 130.0, 115.0, 126.0, fallo, AVISO_PECHO_BAJO, prof, caraVis, ahoraMs)
        }

        // SENTADILLAS
        val angRaw = anguloMejorLado(pts.caderaIzq, pts.rodillaIzq, pts.tobilloIzq, pts.caderaDer, pts.rodillaDer, pts.tobilloDer)
        if (angRaw == null || hombro == null || cadera == null || rodilla == null) {
            return prev.copy(cuerpoVisible = false, caraVisible = caraVis, posturaBien = false, aviso = AVISO_ENCUADRE, ultimoMs = ahoraMs, profundidadPct = 0)
        }
        val muslo = hypot3(rodilla.x - cadera.x, rodilla.y - cadera.y, if (conZ(cadera, rodilla)) rodilla.z!! - cadera.z!! else 0.0)
        val paralela = muslo > 0.05 && (rodilla.y - cadera.y) <= muslo * 0.45 && angRaw <= 130.0
        val ang = if (paralela) min(angRaw, 116.0) else angRaw
        var fallo: String? = if (inclinacionVertical(hombro, cadera) > 58.0) AVISO_ESPALDA else null
        if (fallo == null && visible(pts.rodillaIzq, 0.65) && visible(pts.rodillaDer, 0.65) && visible(pts.caderaIzq, 0.65) && visible(pts.caderaDer, 0.65)) {
            val anchoCad = hypot3(pts.caderaDer!!.x - pts.caderaIzq!!.x, if (conZ(pts.caderaIzq, pts.caderaDer)) pts.caderaDer.z!! - pts.caderaIzq.z!! else 0.0)
            val anchoRod = hypot3(pts.rodillaDer!!.x - pts.rodillaIzq!!.x, if (conZ(pts.rodillaIzq, pts.rodillaDer)) pts.rodillaDer.z!! - pts.rodillaIzq.z!! else 0.0)
            if (anchoCad > 0.08 && ang < 130.0 && anchoRod < anchoCad * 0.62) fallo = AVISO_RODILLAS
        }
        val prof = (((154.0 - ang) / (154.0 - 120.0)) * 100.0).roundToInt().coerceIn(0, 100)
        return avanzarRep(prev, ang, 146.0, 136.0, 120.0, 131.0, fallo, AVISO_SENTADILLA_BAJA, prof, caraVis, ahoraMs)
    }

    private fun avanzarRep(
        prev: EstadoPostura,
        ang: Double,
        umbralArriba: Double,
        umbralInicioBajada: Double,
        umbralAbajo: Double,
        umbralParcial: Double,
        falloPostura: String?,
        avisoPocoBajo: String,
        profundidadPct: Int,
        caraVis: Boolean,
        ahoraMs: Long,
    ): EstadoPostura {
        var fase = prev.fase
        var validas = prev.validas
        var invalidas = prev.invalidas
        var angMin = prev.anguloMinBajada
        var falloRep = prev.falloEnRep
        var ultRep = prev.ultimaRepMs
        var aviso = falloPostura ?: if (prev.aviso == AVISO_ENCUADRE || prev.aviso == AVISO_PLANCHA_POS || prev.aviso.isBlank()) AVISO_BIEN else prev.aviso
        var bien = falloPostura == null

        when (fase) {
            Fase.ARRIBA -> {
                if (ang <= umbralInicioBajada) {
                    fase = if (ang <= umbralAbajo) Fase.ABAJO else Fase.BAJANDO
                    angMin = ang
                    falloRep = falloPostura
                }
            }
            Fase.BAJANDO -> {
                if (ang < angMin) angMin = ang
                if (falloPostura != null) falloRep = falloPostura
                if (ang <= umbralAbajo) {
                    fase = Fase.ABAJO
                } else if (ang >= umbralArriba) {
                    if (angMin <= umbralParcial && ahoraMs - ultRep >= REBOTE_MS) {
                        invalidas++
                        ultRep = ahoraMs
                        aviso = falloRep ?: avisoPocoBajo
                        bien = false
                    }
                    fase = Fase.ARRIBA
                    angMin = 180.0
                    falloRep = null
                }
            }
            Fase.ABAJO -> {
                if (ang < angMin) angMin = ang
                if (falloPostura != null) falloRep = falloPostura
                if (ang >= umbralArriba) {
                    if (ahoraMs - ultRep >= REBOTE_MS) {
                        if (falloRep != null) {
                            invalidas++
                            aviso = falloRep
                            bien = false
                        } else {
                            validas++
                            aviso = AVISO_BIEN
                            bien = true
                        }
                        ultRep = ahoraMs
                    }
                    fase = Fase.ARRIBA
                    angMin = 180.0
                    falloRep = null
                }
            }
        }

        return prev.copy(
            fase = fase,
            validas = validas,
            invalidas = invalidas,
            anguloMinBajada = angMin,
            falloEnRep = falloRep,
            ultimaRepMs = ultRep,
            aviso = aviso,
            posturaBien = bien,
            profundidadPct = profundidadPct,
            anguloActual = ang.roundToInt(),
            cuerpoVisible = true,
            caraVisible = caraVis,
            ultimoMs = ahoraMs,
        )
    }
}
