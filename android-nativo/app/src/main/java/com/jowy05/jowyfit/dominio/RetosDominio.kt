package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.IntentoReto
import java.time.LocalDate
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/** Catálogo y lógica pura de Retos diarios: 5 retos, récords, rachas y formatos (1:1 con src/dominio/retos.ts). */
object RetosDominio {

    enum class EjercicioPostura { FLEXIONES, SENTADILLAS, PLANCHA }
    enum class ModoReto { MAS_REPS, MAS_TIEMPO, MENOS_TIEMPO }

    data class DefinicionReto(
        val id: String,
        val titulo: String,
        val corto: String,
        val descripcion: String,
        val ejercicio: EjercicioPostura,
        val modo: ModoReto,
        val duracionS: Int? = null,
        val objetivoReps: Int? = null,
    )

    val RETOS: List<DefinicionReto> = listOf(
        DefinicionReto(
            id = "flexiones-60",
            titulo = "Flexiones en 60 s",
            corto = "Flexiones · 60 s",
            descripcion = "Todas las flexiones bien hechas que puedas en 60 segundos. Al día siguiente, supera tu marca.",
            ejercicio = EjercicioPostura.FLEXIONES,
            modo = ModoReto.MAS_REPS,
            duracionS = 60,
        ),
        DefinicionReto(
            id = "sentadillas-60",
            titulo = "Sentadillas en 60 s",
            corto = "Sentadillas · 60 s",
            descripcion = "Máximas sentadillas con buena profundidad en 60 segundos, contra tu mejor marca.",
            ejercicio = EjercicioPostura.SENTADILLAS,
            modo = ModoReto.MAS_REPS,
            duracionS = 60,
        ),
        DefinicionReto(
            id = "plancha-max",
            titulo = "Plancha máxima",
            corto = "Plancha máx.",
            descripcion = "Aguanta con el cuerpo recto todo el tiempo que puedas sin dejar caer la cadera.",
            ejercicio = EjercicioPostura.PLANCHA,
            modo = ModoReto.MAS_TIEMPO,
        ),
        DefinicionReto(
            id = "flexiones-20",
            titulo = "20 flexiones contrarreloj",
            corto = "20 flexiones",
            descripcion = "Completa 20 flexiones válidas en el menor tiempo posible y bate tu crono.",
            ejercicio = EjercicioPostura.FLEXIONES,
            modo = ModoReto.MENOS_TIEMPO,
            objetivoReps = 20,
        ),
        DefinicionReto(
            id = "sentadillas-30",
            titulo = "30 sentadillas contrarreloj",
            corto = "30 sentadillas",
            descripcion = "Completa 30 sentadillas bien hechas lo más rápido que puedas.",
            ejercicio = EjercicioPostura.SENTADILLAS,
            modo = ModoReto.MENOS_TIEMPO,
            objetivoReps = 30,
        ),
    )

    fun retoDe(id: String): DefinicionReto = RETOS.firstOrNull { it.id == id } ?: RETOS.first()

    fun esMejorMarca(nuevo: Int, anterior: Int, modo: ModoReto): Boolean {
        if (nuevo <= 0) return false
        if (anterior <= 0) return true
        return if (modo == ModoReto.MENOS_TIEMPO) nuevo < anterior else nuevo > anterior
    }

    fun mejorMarca(intentos: List<IntentoReto>, retoId: String): IntentoReto? {
        val modo = retoDe(retoId).modo
        var mejor: IntentoReto? = null
        for (x in intentos) {
            if (x.reto != retoId || x.valor <= 0) continue
            if (mejor == null || esMejorMarca(x.valor, mejor.valor, modo)) mejor = x
        }
        return mejor
    }

    fun esNuevoRecord(previos: List<IntentoReto>, retoId: String, valor: Int): Boolean {
        if (valor <= 0) return false
        val mejor = mejorMarca(previos, retoId) ?: return true
        return esMejorMarca(valor, mejor.valor, retoDe(retoId).modo)
    }

    fun formatoTiempo(segundos: Int): String {
        val s = max(0, segundos)
        if (s < 60) return "$s s"
        return "${s / 60}:%02d".format(s % 60)
    }

    fun textoMarca(valor: Int, modo: ModoReto): String = when (modo) {
        ModoReto.MAS_REPS -> if (valor == 1) "1 rep" else "$valor reps"
        else -> formatoTiempo(valor)
    }

    fun textoObjetivoHoy(mejor: IntentoReto?, def: DefinicionReto): String {
        if (mejor == null) return "Primera marca: haz tu primer intento"
        return when (def.modo) {
            ModoReto.MAS_REPS -> "Hoy: supera ${mejor.valor} reps"
            ModoReto.MAS_TIEMPO -> "Hoy: supera ${formatoTiempo(mejor.valor)}"
            ModoReto.MENOS_TIEMPO -> "Hoy: baja de ${formatoTiempo(mejor.valor)}"
        }
    }

    fun textoComparativa(valor: Int, anterior: IntentoReto?, def: DefinicionReto): String {
        if (anterior == null) return "Primera marca guardada"
        val dif = valor - anterior.valor
        if (dif == 0) return "Igualaste tu mejor marca"
        return when (def.modo) {
            ModoReto.MAS_REPS -> if (dif > 0) "+$dif sobre tu récord" else "A ${abs(dif)} de tu récord"
            ModoReto.MAS_TIEMPO -> if (dif > 0) "+${formatoTiempo(dif)} sobre tu récord" else "A ${formatoTiempo(abs(dif))} de tu récord"
            ModoReto.MENOS_TIEMPO -> if (dif < 0) "${formatoTiempo(abs(dif))} más rápido que tu récord" else "+${formatoTiempo(dif)} frente a tu récord"
        }
    }

    data class RachaRetos(val actual: Int, val mejor: Int, val hechoHoy: Boolean)

    fun racha(intentos: List<IntentoReto>, hoyIso: String): RachaRetos {
        val dias = intentos.filter { it.valor > 0 }.map { it.fecha.take(10) }.distinct().sorted()
        if (dias.isEmpty()) return RachaRetos(0, 0, false)
        val set = dias.toSet()
        val hoy = runCatching { LocalDate.parse(hoyIso.take(10)) }.getOrElse { LocalDate.now() }
        val hechoHoy = hoy.toString() in set
        var actual = 0
        var cursor = if (hechoHoy) hoy else hoy.minusDays(1)
        while (cursor.toString() in set) {
            actual++
            cursor = cursor.minusDays(1)
        }
        var mejor = 0
        var corrida = 0
        var prev: LocalDate? = null
        for (dStr in dias) {
            val d = runCatching { LocalDate.parse(dStr) }.getOrNull() ?: continue
            corrida = if (prev != null && prev.plusDays(1) == d) corrida + 1 else 1
            if (corrida > mejor) mejor = corrida
            prev = d
        }
        return RachaRetos(actual, mejor, hechoHoy)
    }
}
