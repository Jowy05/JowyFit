package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.catalogo.EjercicioCatalogo
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Pesos reales disponibles, calculadora exacta de discos, calentamiento y clasificación de ejercicios (1:1 TS). */
object PesosYDiscos {

    val BARRAS: Map<String, Double> = mapOf(
        "barbell" to 20.0,
        "ez_bar" to 10.0,
        "trap_bar" to 25.0,
        "smith_machine" to 15.0,
    )

    data class GrupoMaterial(val id: String, val nombre: String, val claves: List<String>)

    val GRUPOS_MATERIAL: List<GrupoMaterial> = listOf(
        GrupoMaterial("libre", "Peso libre", listOf("dumbbell", "kettlebell", "plates", "flat_bench", "smith_machine")),
        GrupoMaterial("barras", "Barras", listOf("barbell", "ez_bar", "trap_bar")),
        GrupoMaterial("poleas", "Poleas", listOf("cable")),
        GrupoMaterial(
            "pierna",
            "Máquinas de pierna",
            listOf(
                "leg_press", "hack_squat", "leg_curl", "leg_extension",
                "standing_calf_raise_machine", "seated_calf_raise_machine", "donkey_calf_raise_machine",
                "hip_abduction_machine", "hip_adduction_machine", "hip_thrust_machine",
                "glute_ham_developer", "back_extension_machine",
            ),
        ),
        GrupoMaterial(
            "torso",
            "Máquinas de torso",
            listOf(
                "chest_press_machine", "chest_fly_machine", "pec_deck", "reverse_fly_machine",
                "shoulder_press_machine", "plate_loaded_lateral_raise_machine", "lat_pulldown_machine",
                "seated_row_machine", "bicep_curl_machine", "preacher_curl_machine",
                "tricep_extension_machine", "plate_loaded_dip_machine", "shrug_machine", "ab_crunch_machine",
            ),
        ),
        GrupoMaterial(
            "dominadas",
            "Dominadas y fondos",
            listOf("pull_up_bar", "dip_station", "assisted_pullup_machine", "dip_machine", "rings", "climbing_rope"),
        ),
        GrupoMaterial(
            "cardio",
            "Cardio",
            listOf("treadmill", "stationary_bike", "air_bike", "elliptical", "rower", "stair_climber", "ski_erg", "jump_rope", "sled", "battle_rope"),
        ),
        GrupoMaterial(
            "accesorios",
            "Accesorios",
            listOf("resistance_band", "loop_band", "suspension_trainer", "stability_ball", "ab_wheel", "plyo_box", "slam_ball", "wrist_roller"),
        ),
    )

    val MATERIAL_HABITUAL: Set<String> = setOf(
        "dumbbell", "barbell", "cable", "flat_bench", "pull_up_bar", "leg_press", "smith_machine",
    )

    val HABITUALES: List<String> = listOf(
        "squat", "leg-press", "smith-machine-squat", "hack-squat", "bulgarian-split-squat", "goblet-squat",
        "romanian-deadlift", "deadlift", "hip-thrust", "leg-curl", "seated-leg-curl", "dumbbell-romanian-deadlift",
        "bench-press", "incline-db-press", "chest-press-machine", "close-grip-db-bench-press",
        "smith-machine-incline-bench-press", "incline-bench-press", "push-up", "dips",
        "machine-shoulder-press", "seated-barbell-overhead-press", "dumbbell-shoulder-press",
        "smith-machine-shoulder-press", "arnold-press",
        "lat-pulldown", "assisted-pull-ups", "neutral-grip-pull-ups", "chin-ups", "negative-pull-ups", "close-grip-lat-pulldown",
        "seated-cable-row", "chest-supported-machine-row", "barbell-row", "single-arm-chest-supported-dumbbell-row",
        "reverse-grip-lat-pulldown", "cable-bent-over-row",
        "lateral-raise", "cable-lateral-raise", "face-pull", "rear-delt-fly", "machine-reverse-fly",
        "bicep-curl", "hammer-curl", "incline-db-curl", "cable-curl", "ez-bar-curl", "seated-dumbbell-curl",
        "tricep-pushdown", "cable-overhead-tricep-extension", "overhead-tricep-extension", "skull-crusher", "close-grip-bench-press",
        "cable-crunch", "plank", "hanging-leg-raise", "ab-wheel-rollout", "dead-bug", "cable-pallof-press", "side-plank",
        "machine-calf-raise", "standing-calf-raise", "seated-calf-raise",
    )

    private val RE_VERTICAL = Regex("(pull-?ups?|chin-?ups?|pulldown|pull-down|muscle-up|rope-climb)")
    private val RE_TIEMPO = Regex("(plank|-hold$|dead-hang|wall-sit|l-sit)")
    private val APARATOS_CALISTENIA = setOf("pull_up_bar", "dip_station", "rings", "suspension_trainer", "climbing_rope")
    private val MAQUINAS_EXTRA = setOf("cable", "smith_machine", "leg_press", "hack_squat", "leg_curl", "leg_extension", "pec_deck", "glute_ham_developer")
    private val LIBRES = setOf("barbell", "dumbbell", "ez_bar", "trap_bar", "kettlebell")

    fun esMaquina(e: EjercicioCatalogo): Boolean =
        e.material != null && (e.material.contains("machine") || e.material in MAQUINAS_EXTRA)

    fun esLibre(e: EjercicioCatalogo): Boolean = e.material in LIBRES

    fun patron(e: EjercicioCatalogo): String {
        if (e.categoria == "stretching") return "estiramiento"
        if (e.categoria == "cardio") return "cardio"
        if (e.categoria == "olympic" || e.categoria == "plyometrics") return "potencia"
        val aisl = e.mecanica == "isolation"
        return when (e.zona) {
            "upper_legs" -> when {
                "quadriceps" in e.principales -> if (aisl) "cuadriceps" else "rodilla"
                "hamstrings" in e.principales && aisl -> "femoral"
                "abductors" in e.principales || "adductors" in e.principales || (aisl && "gluteus_maximus" in e.principales) -> "gluteo"
                else -> "cadera"
            }
            "lower_legs" -> "gemelo"
            "chest" -> if (aisl) "pecho-aisl" else "empuje-h"
            "shoulders" -> when {
                "lateral_deltoid" in e.principales && aisl -> "hombro-lat"
                "posterior_deltoid" in e.principales -> "hombro-post"
                "trapezius" in e.principales -> "trapecio"
                e.fuerza == "pull" -> "hombro-post"
                else -> "empuje-v"
            }
            "back" -> when {
                "erector_spinae" in e.principales && "latissimus_dorsi" !in e.principales -> "lumbar"
                "trapezius" in e.principales && aisl -> "trapecio"
                RE_VERTICAL.containsMatchIn(e.id) || e.material in setOf("pull_up_bar", "assisted_pullup_machine", "lat_pulldown_machine", "climbing_rope") -> "tiron-v"
                else -> "tiron-h"
            }
            "upper_arms" -> if ("triceps_brachii" in e.principales) "triceps" else "biceps"
            "lower_arms" -> "antebrazo"
            "core" -> "core"
            else -> "completo"
        }
    }

    fun tipoRegistro(e: EjercicioCatalogo): String = when {
        e.categoria == "cardio" -> "cardio"
        e.material == "assisted_pullup_machine" || e.material == "dip_machine" || e.id.contains("assisted") -> "asistido"
        e.fuerza == "static" || RE_TIEMPO.containsMatchIn(e.id) -> "tiempo"
        e.material in APARATOS_CALISTENIA && !e.id.startsWith("weighted-") -> "corporal"
        e.material == "dumbbell" || e.material == "kettlebell" -> "mancuerna"
        e.material == null || e.pesoCorporal -> "corporal"
        else -> "peso"
    }

    fun mancuernasDisponibles(g: Gimnasio): List<Double> {
        val set = LinkedHashSet<Double>()
        for (t in g.mancuernas) {
            if (t.paso <= 0.0) continue
            val n = floor((t.hasta - t.desde) / t.paso + 1e-9).toInt().coerceAtMost(2000)
            for (i in 0..n) {
                set += ((t.desde + i * t.paso) * 100.0).roundToInt() / 100.0
            }
        }
        return set.sorted()
    }

    fun pesosBarra(barra: Double, discos: List<Double>, maxPeso: Double = 300.0): List<Double> {
        val lados = HashSet<Double>().apply { add(0.0) }
        val pares = discos.filter { it > 0.0 && it.isFinite() }.distinct().sortedDescending()
        val limite = (maxPeso - barra) / 2.0
        var frontera = listOf(0.0)
        repeat(40) {
            if (frontera.isEmpty()) return@repeat
            val nueva = mutableListOf<Double>()
            for (f in frontera) {
                for (d in pares) {
                    val v = ((f + d) * 100.0).roundToInt() / 100.0
                    if (v <= limite && lados.add(v)) nueva += v
                }
            }
            frontera = nueva
        }
        return lados.map { ((barra + 2.0 * it) * 100.0).roundToInt() / 100.0 }.sorted()
    }

    fun pesosPara(material: String?, registro: String, g: Gimnasio?): List<Double> {
        if (registro in setOf("corporal", "tiempo", "cardio")) return emptyList()
        if (registro == "asistido") return (20 downTo 0).map { if (it == 0) 0.0 else -it * 5.0 }
        if ((material == "dumbbell" || material == "kettlebell") && g != null) {
            val m = mancuernasDisponibles(g)
            if (m.isNotEmpty()) return m
        }
        if (material != null && material in BARRAS && g != null) {
            val barra = if (material == "barbell") g.barraKg else BARRAS.getValue(material)
            val todos = pesosBarra(barra, g.discos)
            val gruesos = todos.filter { abs(it / 2.5 - (it / 2.5).roundToInt()) < 1e-6 }
            return if (gruesos.size >= 10) gruesos else todos
        }
        return (0..120).map { it * 2.5 }
    }

    fun ajustarA(lista: List<Double>, valor: Double, abajo: Boolean = false): Double {
        if (lista.isEmpty()) return valor
        var mejor = lista.first()
        for (v in lista) {
            if (abajo) {
                if (v <= valor + 1e-9) mejor = v else break
            } else if (abs(v - valor) < abs(mejor - valor)) {
                mejor = v
            }
        }
        return mejor
    }

    fun siguiente(lista: List<Double>, valor: Double, dir: Int): Double {
        if (lista.isEmpty()) return max(0.0, valor + dir * 2.5)
        return if (dir > 0) {
            lista.firstOrNull { it > valor + 1e-9 } ?: max(valor, lista.last())
        } else {
            lista.lastOrNull { it < valor - 1e-9 } ?: min(valor, lista.first())
        }
    }

    /** Mínimo número de discos por lado (programación dinámica exacta en centésimas de kg). */
    fun discosPorLado(total: Double, barra: Double, discos: List<Double>): List<Double>? {
        if (!total.isFinite() || !barra.isFinite()) return null
        val objetivo = (((total - barra) / 2.0) * 100.0).roundToInt()
        if (objetivo < 0 || objetivo > 100_000) return null
        if (objetivo == 0) return emptyList()
        val tipos = discos.filter { it.isFinite() && it > 0.0 }
            .map { (it * 100.0).roundToInt() }
            .filter { it > 0 }
            .distinct()
            .sortedDescending()
        if (tipos.isEmpty()) return null

        val inf = Int.MAX_VALUE / 4
        val minimo = IntArray(objetivo + 1) { inf }
        minimo[0] = 0
        for (v in 1..objetivo) {
            for (d in tipos) {
                if (d <= v && minimo[v - d] + 1 < minimo[v]) {
                    minimo[v] = minimo[v - d] + 1
                }
            }
        }
        if (minimo[objetivo] >= inf) return null

        val out = mutableListOf<Double>()
        var v = objetivo
        while (v > 0) {
            val d = tipos.first { it <= v && minimo[v - it] == minimo[v] - 1 }
            out += d / 100.0
            v -= d
        }
        return out.sortedDescending()
    }

    data class SerieCalentamiento(val peso: Double, val reps: Int)

    fun calentamiento(pesoTrabajo: Double, lista: List<Double>, minimo: Double = 0.0): List<SerieCalentamiento> {
        if (pesoTrabajo <= 0.0) return emptyList()
        val pasos = if (pesoTrabajo >= 40.0) {
            listOf(0.5 to 10, 0.7 to 5, 0.85 to 3)
        } else {
            listOf(0.5 to 10, 0.75 to 5)
        }
        val out = mutableListOf<SerieCalentamiento>()
        for ((f, reps) in pasos) {
            val obj = pesoTrabajo * f
            val real = if (lista.isNotEmpty()) ajustarA(lista, obj, abajo = true) else floor(obj / 2.5 + 1e-9) * 2.5
            val p = max(minimo, real)
            if (p > 0.0 && p < pesoTrabajo && out.none { abs(it.peso - p) < 1e-6 }) {
                out += SerieCalentamiento(p, reps)
            }
        }
        return out
    }
}
