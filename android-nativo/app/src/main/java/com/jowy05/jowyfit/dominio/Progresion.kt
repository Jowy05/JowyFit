package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Sesion
import kotlin.math.max
import kotlin.math.min

/** Doble progresión con RPE, récords, volumen y pesos de partida (1:1 con src/dominio/progresion.ts). */
object Progresion {

    enum class AccionSugerencia { PRIMERA, SUBIR, MANTENER, BAJAR }

    data class UltimaSerie(val peso: Double?, val reps: Int?, val rpe: Double?)

    data class Sugerencia(
        val accion: AccionSugerencia,
        val peso: Double?,
        val reps: Int?,
        val ultima: UltimaSerie?,
        val texto: String,
        val partida: Boolean = false,
    )

    data class ObjetivoBloque(val repsMin: Int, val repsMax: Int, val rpe: Double)

    data class RecordDetectado(val tipo: String, val texto: String, val peso: Double, val reps: Int)

    private fun repsEfectivas(s: Serie): Int? = when {
        s.reps != null -> s.reps
        s.izq != null && s.der != null -> min(s.izq, s.der)
        s.izq != null -> s.izq
        s.der != null -> s.der
        else -> null
    }

    private fun trabajo(series: List<Serie>): List<Serie> =
        series.filter { it.hecha && !it.calentamiento && (it.reps != null || it.segundos != null || it.izq != null || it.der != null) }

    fun sugerir(
        ultimas: List<Serie>?,
        objetivo: ObjetivoBloque,
        registro: String,
        lista: List<Double>,
    ): Sugerencia {
        val hechas = ultimas?.let(::trabajo).orEmpty()
        if (hechas.isEmpty()) {
            return Sugerencia(
                accion = AccionSugerencia.PRIMERA,
                peso = null,
                reps = objetivo.repsMin,
                ultima = null,
                texto = "Primera vez: elige un peso cómodo (esfuerzo 6-7)",
            )
        }
        val conPeso = hechas.filter { it.peso != null }
        val top = (if (conPeso.isNotEmpty()) conPeso else hechas).maxBy { it.peso ?: Double.NEGATIVE_INFINITY }
        val ultima = UltimaSerie(top.peso, repsEfectivas(top) ?: top.segundos, top.rpe)
        val reps = hechas.map { (if (registro == "tiempo") it.segundos else repsEfectivas(it)) ?: 0 }
        val rpes = hechas.mapNotNull { it.rpe }
        val rpeMax = rpes.maxOrNull()
        val todasArriba = reps.all { it >= objetivo.repsMax }
        val algunaCorta = reps.any { it < objetivo.repsMin }
        val muyDuro = rpeMax != null && rpeMax >= 9.5

        if (registro in setOf("corporal", "tiempo", "cardio") || top.peso == null) {
            val paso = if (registro == "tiempo") 5 else 1
            val mejor = reps.maxOrNull() ?: objetivo.repsMin
            return if (todasArriba && !muyDuro) {
                Sugerencia(
                    accion = AccionSugerencia.SUBIR,
                    peso = top.peso,
                    reps = mejor + paso,
                    ultima = ultima,
                    texto = if (registro == "tiempo") "Hoy: aguanta ${mejor + paso} s" else "Hoy: ${mejor + paso} reps",
                )
            } else {
                Sugerencia(
                    accion = AccionSugerencia.MANTENER,
                    peso = top.peso,
                    reps = max(objetivo.repsMin, mejor),
                    ultima = ultima,
                    texto = "Repite y busca una repetición más",
                )
            }
        }

        val peso = top.peso
        val esfuerzo = rpeMax ?: objetivo.rpe
        if (todasArriba && esfuerzo <= objetivo.rpe + 1.0) {
            val nuevo = PesosYDiscos.siguiente(lista, peso, 1)
            return if (nuevo <= peso + 1e-9) {
                Sugerencia(AccionSugerencia.MANTENER, peso, objetivo.repsMax, ultima, "Es el peso más alto disponible: busca más reps")
            } else {
                Sugerencia(AccionSugerencia.SUBIR, nuevo, objetivo.repsMin, ultima, "Completaste el rango: toca subir")
            }
        }
        val esfuerzoAlto = rpeMax == null || rpeMax >= 9.0
        if ((algunaCorta && esfuerzoAlto && reps.any { it <= objetivo.repsMin - 2 }) || (rpeMax != null && rpeMax >= 10.0 && algunaCorta)) {
            val menos = PesosYDiscos.siguiente(lista, peso, -1)
            return if (menos < peso - 1e-9) {
                Sugerencia(AccionSugerencia.BAJAR, menos, objetivo.repsMin, ultima, "Costó demasiado: baja un poco y suma reps")
            } else {
                Sugerencia(AccionSugerencia.MANTENER, peso, objetivo.repsMin, ultima, "Mantén el peso y busca más reps")
            }
        }
        if (muyDuro || algunaCorta) {
            return Sugerencia(AccionSugerencia.MANTENER, peso, objetivo.repsMin, ultima, "Mantén el peso y busca más reps")
        }
        return Sugerencia(
            AccionSugerencia.MANTENER,
            peso,
            min(objetivo.repsMax, (reps.maxOrNull() ?: objetivo.repsMin) + 1),
            ultima,
            "Mismo peso, una rep más",
        )
    }

    fun esRecord(s: Serie, historial: List<Serie>): RecordDetectado? {
        val peso = s.peso
        val reps = repsEfectivas(s)
        if (!s.hecha || s.calentamiento || peso == null || reps == null || peso <= 0.0 || reps <= 0) return null
        val prev = trabajo(historial).mapNotNull { h ->
            val hp = h.peso ?: return@mapNotNull null
            val hr = repsEfectivas(h) ?: return@mapNotNull null
            hp to hr
        }
        if (prev.isEmpty()) return null
        val maxPeso = prev.maxOf { it.first }
        if (peso > maxPeso) return RecordDetectado("peso", "Nuevo récord de peso", peso, reps)
        val mismas = prev.filter { it.first == peso }
        if (mismas.isNotEmpty() && reps > mismas.maxOf { it.second }) {
            return RecordDetectado("reps", "Récord de repeticiones", peso, reps)
        }
        return null
    }

    fun repsVolumen(s: Serie): Int =
        if (s.izq != null || s.der != null) max(0, s.izq ?: 0) + max(0, s.der ?: 0) else max(0, s.reps ?: 0)

    fun volumen(series: List<Serie>): Double =
        trabajo(series).sumOf { max(0.0, it.peso ?: 0.0) * repsVolumen(it) }

    fun pesoPartida(material: String?, registro: String, lista: List<Double>): Double? {
        if (registro != "peso" && registro != "mancuerna") return null
        val positivos = lista.filter { it.isFinite() && it > 0.0 }
        val minimo = when {
            material != null && material in PesosYDiscos.BARRAS -> {
                val barraBase = PesosYDiscos.BARRAS.getValue(material)
                positivos.firstOrNull { it >= barraBase - 1e-9 } ?: barraBase
            }
            registro == "mancuerna" -> 4.0
            material in setOf("plates", "loop_band", "resistance_band") -> 5.0
            else -> 10.0
        }
        if (positivos.isEmpty()) return if (minimo > 0.0) minimo else null
        return positivos.firstOrNull { it >= minimo - 1e-9 } ?: positivos.last()
    }

    fun conPartida(s: Sugerencia, material: String?, registro: String, lista: List<Double>): Sugerencia {
        if (s.accion != AccionSugerencia.PRIMERA || s.peso != null) return s
        val peso = pesoPartida(material, registro, lista) ?: return s
        return s.copy(peso = peso, partida = true, texto = "Empieza con este y súbelo si va fácil")
    }

    fun seriesHistoricasDe(sesiones: List<Sesion>, ejercicioId: String, excluirSesionId: Long? = null): List<Serie> =
        sesiones
            .filter { it.estado == "hecha" && it.id != excluirSesionId }
            .flatMap { s -> s.ejercicios.filter { it.ejercicio == ejercicioId }.flatMap { it.series } }
            .filter { it.hecha }

    fun ultimaSesionDe(sesiones: List<Sesion>, ejercicioId: String, excluirSesionId: Long? = null): List<Serie>? =
        sesiones
            .filter { it.estado == "hecha" && it.id != excluirSesionId }
            .sortedByDescending { it.inicio }
            .firstNotNullOfOrNull { s ->
                s.ejercicios.firstOrNull { it.ejercicio == ejercicioId && it.series.any { x -> x.hecha && !x.calentamiento } }?.series
            }
}
