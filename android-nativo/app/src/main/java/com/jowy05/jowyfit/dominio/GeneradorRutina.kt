package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.catalogo.EjercicioCatalogo
import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.MarcaEjercicio
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Rutina
import java.text.Normalizer
import java.time.Instant
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Generador automático de rutinas v2 en Kotlin (1:1 con src/dominio/generador.ts, objetivos.ts y volumen.ts).
 * Respeta días fijos/opcionales, objetivos, volumen semanal, material del gimnasio, zonas sensibles,
 * modo mayor, tope RPE 7.5 por poco sueño, superseries, alternativas A→B→C y ajuste al tiempo disponible.
 */
object GeneradorRutina {

    private data class Hueco(val patron: String, val papel: String, val prioridad: Int, val par: Int? = null)
    private data class PlantillaDia(val letra: String, val nombre: String, val huecos: List<Hueco>)
    private data class ParamJuego(
        val prioritario: Pair<Int, Int>,
        val mantenimiento: Pair<Int, Int>,
        val repsPrincipal: Pair<Int, Int>,
        val repsAccesorio: Pair<Int, Int>,
        val rpePrincipal: Double,
        val rpeAccesorio: Double,
    )

    private val PARAMETROS = mapOf(
        "salud" to ParamJuego(8 to 10, 4 to 6, 8 to 12, 10 to 15, 7.5, 8.0),
        "musculo" to ParamJuego(12 to 16, 8 to 10, 6 to 10, 10 to 15, 8.0, 8.5),
        "fuerza" to ParamJuego(8 to 12, 4 to 6, 3 to 6, 8 to 12, 8.0, 8.5),
    )

    private val ZONA_DE_PATRON = mapOf(
        "empuje-h" to "pecho", "pecho-aisl" to "pecho",
        "tiron-h" to "espalda", "tiron-v" to "espalda", "lumbar" to "espalda", "trapecio" to "espalda",
        "empuje-v" to "hombros", "hombro-lat" to "hombros", "hombro-post" to "hombros",
        "biceps" to "brazos", "triceps" to "brazos", "antebrazo" to "brazos",
        "core" to "abdomen",
        "cadera" to "gluteo", "gluteo" to "gluteo",
        "rodilla" to "piernas", "cuadriceps" to "piernas", "femoral" to "piernas",
        "gemelo" to "gemelos",
    )

    private val RESPALDO = mapOf(
        "rodilla" to listOf("cuadriceps", "cadera", "gluteo"),
        "cadera" to listOf("gluteo", "femoral", "rodilla"),
        "empuje-h" to listOf("pecho-aisl", "empuje-v", "triceps"),
        "empuje-v" to listOf("hombro-lat", "empuje-h"),
        "tiron-h" to listOf("tiron-v", "lumbar", "hombro-post"),
        "tiron-v" to listOf("tiron-h", "lumbar", "hombro-post"),
        "cuadriceps" to listOf("rodilla"),
        "femoral" to listOf("cadera", "gluteo"),
        "gluteo" to listOf("cadera", "femoral"),
        "pecho-aisl" to listOf("empuje-h"),
        "hombro-lat" to listOf("empuje-v", "hombro-post"),
        "hombro-post" to listOf("tiron-h", "hombro-lat"),
        "biceps" to listOf("antebrazo", "tiron-v", "tiron-h"),
        "triceps" to listOf("empuje-h", "empuje-v"),
        "core" to listOf("lumbar"),
    )

    private val RANGO_HABITUAL = PesosYDiscos.HABITUALES.withIndex().associate { (i, id) -> id to i }
    private val TIRAN = setOf("latissimus_dorsi", "rhomboids", "trapezius", "posterior_deltoid", "teres_major")
    private val PIERNA = setOf("gluteus_maximus", "hamstrings", "quadriceps")
    private val RE_CON_APOYO = Regex("(seated|supported|machine|chair|incline-bench|box)")
    private val RE_ZONA_CODO = Regex("skull|triceps-extension|overhead-triceps|french-press|close-grip-(?:[a-z-]*bench|[a-z-]*press|push)|(?:^|-)dips?(?:$|-)|dip-machine")
    private val RE_ZONA_MUNECA = Regex("push-?ups?(?:$|-)|front-squat|wrist-curl|(?:^|-)clean(?:$|-)|snatch|handstand|(?:^|-)barbell-curl|straight-bar|(?:^|-)dips?(?:$|-)")
    private val ZONA_TAG = mapOf("rodilla" to "knee_safe", "lumbar" to "lower_back_safe", "hombro" to "shoulder_safe")
    private val contador = AtomicInteger(0)

    private fun nuevoUid(): String = "b${System.currentTimeMillis().toString(36)}${contador.incrementAndGet().toString(36)}"

    private fun juegoDe(objetivo: String): String = when (objetivo) {
        "salud", "perder" -> "salud"
        "fuerza" -> "fuerza"
        else -> "musculo"
    }

    private fun brazos(pr: Int = 4) = listOf(Hueco("biceps", "accesorio", pr, 1), Hueco("triceps", "accesorio", pr, 1))
    private fun hombros(pr: Int = 4) = listOf(Hueco("hombro-lat", "accesorio", pr, 2), Hueco("hombro-post", "accesorio", pr, 2))

    private fun plantillas(nDias: Int): Pair<String, List<PlantillaDia>> = when {
        nDias <= 1 -> "Cuerpo completo · 1 día" to listOf(
            PlantillaDia(
                "A", "Cuerpo completo",
                listOf(
                    Hueco("rodilla", "principal", 1), Hueco("empuje-h", "principal", 1), Hueco("tiron-h", "principal", 1),
                    Hueco("cadera", "secundario", 2), Hueco("tiron-v", "secundario", 2), Hueco("empuje-v", "secundario", 3),
                ) + brazos(5) + listOf(Hueco("core", "core", 5)),
            ),
        )
        nDias == 2 -> "Cuerpo completo · 2 días" to listOf(
            PlantillaDia(
                "A", "Cuerpo completo A",
                listOf(Hueco("rodilla", "principal", 1), Hueco("empuje-h", "principal", 1), Hueco("tiron-v", "principal", 2), Hueco("cadera", "secundario", 3)) +
                    brazos() + listOf(Hueco("core", "core", 5)),
            ),
            PlantillaDia(
                "B", "Cuerpo completo B",
                listOf(Hueco("cadera", "principal", 1), Hueco("tiron-h", "principal", 1), Hueco("empuje-v", "principal", 2), Hueco("empuje-h", "secundario", 3)) +
                    hombros() + listOf(Hueco("core", "core", 5)),
            ),
        )
        nDias == 3 -> "Cuerpo completo · 3 días" to listOf(
            PlantillaDia(
                "A", "Cuerpo completo A",
                listOf(Hueco("rodilla", "principal", 1), Hueco("empuje-h", "principal", 1), Hueco("tiron-v", "secundario", 2)) +
                    brazos() + listOf(Hueco("core", "core", 5)),
            ),
            PlantillaDia(
                "B", "Cuerpo completo B",
                listOf(Hueco("cadera", "principal", 1), Hueco("empuje-h", "secundario", 2), Hueco("tiron-h", "principal", 1), Hueco("tiron-v", "secundario", 3)) +
                    hombros() + listOf(Hueco("core", "core", 5)),
            ),
            PlantillaDia(
                "C", "Cuerpo completo C",
                listOf(Hueco("rodilla", "secundario", 1), Hueco("empuje-h", "secundario", 2), Hueco("tiron-h", "secundario", 2), Hueco("empuje-v", "secundario", 3)) +
                    brazos() + listOf(Hueco("core", "core", 5)),
            ),
        )
        nDias <= 5 -> {
            val base = mutableListOf(
                PlantillaDia("A", "Torso A", listOf(Hueco("empuje-h", "principal", 1), Hueco("tiron-h", "principal", 1), Hueco("empuje-v", "secundario", 2), Hueco("tiron-v", "secundario", 2)) + brazos()),
                PlantillaDia("B", "Pierna A", listOf(Hueco("rodilla", "principal", 1), Hueco("cadera", "secundario", 1), Hueco("femoral", "accesorio", 3), Hueco("gemelo", "accesorio", 4), Hueco("core", "core", 5))),
                PlantillaDia("C", "Torso B", listOf(Hueco("tiron-v", "principal", 1), Hueco("empuje-h", "secundario", 1), Hueco("tiron-h", "secundario", 2), Hueco("empuje-v", "secundario", 3)) + hombros()),
                PlantillaDia("D", "Pierna B", listOf(Hueco("cadera", "principal", 1), Hueco("rodilla", "secundario", 1), Hueco("gluteo", "accesorio", 3), Hueco("gemelo", "accesorio", 4), Hueco("core", "core", 5))),
            )
            if (nDias == 5) {
                base += PlantillaDia("E", "Brazos y hombros", brazos(1) + hombros(2) + listOf(Hueco("biceps", "accesorio", 3), Hueco("triceps", "accesorio", 3), Hueco("core", "core", 4)))
            }
            "Torso / Pierna · $nDias días" to base
        }
        else -> {
            val ppl = listOf(
                PlantillaDia("A", "Empuje", listOf(Hueco("empuje-h", "principal", 1), Hueco("empuje-v", "secundario", 2), Hueco("pecho-aisl", "accesorio", 3), Hueco("hombro-lat", "accesorio", 3), Hueco("triceps", "accesorio", 4))),
                PlantillaDia("B", "Tirón", listOf(Hueco("tiron-v", "principal", 1), Hueco("tiron-h", "secundario", 1), Hueco("hombro-post", "accesorio", 3), Hueco("biceps", "accesorio", 3), Hueco("core", "core", 5))),
                PlantillaDia("C", "Pierna", listOf(Hueco("rodilla", "principal", 1), Hueco("cadera", "secundario", 1), Hueco("femoral", "accesorio", 3), Hueco("gemelo", "accesorio", 4), Hueco("core", "core", 5))),
            )
            val segunda = ppl.map { d -> d.copy(letra = (d.letra[0] + 3).toString(), nombre = "${d.nombre} 2") }
            val septimo = PlantillaDia("G", "Brazos, hombros y core", brazos(2) + hombros(3) + listOf(Hueco("core", "core", 4)))
            "Empuje / Tirón / Pierna · $nDias días" to (ppl + segunda + septimo).take(min(nDias, 7))
        }
    }

    private fun patronGenerador(e: EjercicioCatalogo): String {
        val p = PesosYDiscos.patron(e)
        if ((p == "tiron-h" || p == "tiron-v") && e.principales.none { it in TIRAN } && e.principales.any { it in PIERNA }) {
            return "cadera"
        }
        return p
    }

    private fun claveMovimiento(e: EjercicioCatalogo): String {
        val norm = Normalizer.normalize(e.nombre, Normalizer.Form.NFD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
            .lowercase()
            .replace(Regex("\\(.*?\\)"), " ")
            .replace(Regex("\\b(con|en|sobre|de|del|la|el|y|a|al|mancuernas?|barra|polea|maquina|smith|guiada|unilateral)\\b"), " ")
        return norm.split(Regex("[^a-z0-9]+")).filter { it.isNotBlank() }.joinToString(" ")
    }

    private fun apto(
        e: EjercicioCatalogo,
        perfil: Perfil,
        material: Set<String>,
        marcas: Map<String, MarcaEjercicio>,
        rest: SaludYRevisionDominio.Restricciones,
    ): Boolean {
        if (e.categoria != "strength") return false
        if (e.material != null && e.material !in material) return false
        val m = marcas[e.id]
        if (m?.odiado == true || m?.duele == true) return false
        val novato = perfil.nivel in setOf("empiezo", "vuelvo")
        if ((novato || perfil.modoMayor?.activo == true) && e.dificultad == "advanced") return false
        if (rest.fuera(e) != null) return false
        for (z in perfil.zonasSensibles) {
            val tag = ZONA_TAG[z]
            if (tag != null && e.zona in zonasAfectadas(z) && tag !in e.etiquetas) return false
            if (z == "codo" && RE_ZONA_CODO.containsMatchIn(e.id)) return false
            if (z == "muneca" && RE_ZONA_MUNECA.containsMatchIn(e.id)) return false
        }
        return true
    }

    private fun zonasAfectadas(zonaSensible: String): Set<String> = when (zonaSensible) {
        "rodilla" -> setOf("upper_legs")
        "lumbar" -> setOf("back", "upper_legs")
        "hombro" -> setOf("shoulders", "chest")
        else -> emptySet()
    }

    private fun puntuar(
        e: EjercicioCatalogo,
        h: Hueco,
        perfil: Perfil,
        marcas: Map<String, MarcaEjercicio>,
        usados: Set<String>,
        evitar: Set<String>,
        rest: SaludYRevisionDominio.Restricciones,
    ): Double {
        var s = 0.0
        val m = marcas[e.id]
        if (perfil.modoMayor?.activo == true && (PesosYDiscos.esMaquina(e) || RE_CON_APOYO.containsMatchIn(e.id))) s += 12.0
        if (m?.favorito == true) s += 30.0
        RANGO_HABITUAL[e.id]?.let { r -> s += 22.0 - r * 0.15 }
        when (perfil.preferencia) {
            "maquinas" -> if (PesosYDiscos.esMaquina(e)) s += 10.0
            "libre" -> if (PesosYDiscos.esLibre(e)) s += 10.0
            "mezcla" -> if (PesosYDiscos.esMaquina(e) || PesosYDiscos.esLibre(e)) s += 4.0
        }
        if (!e.unilateral) s += 4.0
        if (h.papel in setOf("principal", "secundario") && e.mecanica == "compound") s += 4.0
        if (h.papel == "accesorio" && e.mecanica == "isolation") s += 8.0
        if (h.papel == "principal" && e.material == null) s -= 8.0
        if (e.dificultad == "advanced") s -= 6.0
        if (e.id in usados && m?.favorito != true) s -= 15.0
        if (e.id in evitar && m?.favorito != true) s -= 12.0
        s -= rest.penaliza(e).toDouble()
        return s
    }

    fun generar(
        id: Long,
        perfil: Perfil,
        gimnasio: Gimnasio?,
        ejercicios: List<EjercicioCatalogo>,
        marcas: Map<String, MarcaEjercicio> = emptyMap(),
        descansoCompuesto: Int = 150,
        descansoAislamiento: Int = 90,
        calibracion: Boolean = false,
        evitar: Set<String> = emptySet(),
    ): Rutina {
        val material = gimnasio?.material?.takeIf { it.isNotEmpty() }?.toSet() ?: PesosYDiscos.MATERIAL_HABITUAL
        val fijos = perfil.diasFijos.filter { it in 0..6 }.distinct().sorted()
        val nDias = if (fijos.isEmpty()) 3 else fijos.size
        val (estructura, diasPlantilla) = plantillas(nDias)
        val rest = SaludYRevisionDominio.restricciones(perfil)

        val aptos = ejercicios
            .filter { apto(it, perfil, material, marcas, rest) }
            .groupBy(::patronGenerador)

        val juego = juegoDe(perfil.objetivo)
        val par = PARAMETROS.getValue(juego)
        val techoSueno = if (perfil.sueno == "poco") 7.5 else 10.0
        val novato = perfil.nivel in setOf("empiezo", "vuelvo") || perfil.modoMayor?.activo == true
        val topeRpe = min(min(if (novato || perfil.sueno == "poco") 8.0 else 9.0, techoSueno), rest.rpeMax ?: 10.0)

        val vecesZona = HashMap<String, Int>()
        for (d in diasPlantilla) for (h in d.huecos) {
            ZONA_DE_PATRON[h.patron]?.let { z -> vecesZona[z] = (vecesZona[z] ?: 0) + 1 }
        }
        val seriesPorZona = HashMap<String, Int>()
        val hiNivel = when {
            novato && calibracion -> 6
            perfil.modoMayor?.activo == true -> 10
            novato -> 12
            perfil.nivel == "intermedio" -> 16
            else -> 20
        }
        for ((z, veces) in vecesZona) {
            val prio = z in perfil.zonasPrioridad
            val mucho = prio && perfil.zonasMucho.orEmpty().contains(z)
            val base = if (prio) (if (mucho) par.prioritario.second else par.prioritario.first) else ((par.mantenimiento.first + par.mantenimiento.second) / 2.0).roundToInt()
            var sem = base.coerceIn(4, hiNivel)
            if (nDias <= 1) sem = min(sem, 4)
            seriesPorZona[z] = (sem.toDouble() / max(1, veces)).roundToInt().coerceIn(2, if (mucho) 5 else 4)
        }

        val usados = HashSet<String>()
        val salida = mutableListOf<DiaRutina>()

        fun construirDia(pl: PlantillaDia, diaNum: Int?, opcional: Boolean): DiaRutina {
            val bloques = mutableListOf<Bloque>()
            val prioridades = HashMap<String, Int>()
            val delDia = HashSet<String>()
            val clavesDia = HashSet<String>()
            val porPar = HashMap<Int, String>()
            val mayor = perfil.modoMayor?.activo == true

            val huecos = pl.huecos
                .filterNot { it.patron == "core" && !perfil.core && "abdomen" !in perfil.zonasPrioridad }
                .map { if (perfil.superseries && !mayor) it else it.copy(par = null) }

            for (h in huecos) {
                var elegido: EjercicioCatalogo? = null
                var cands = emptyList<EjercicioCatalogo>()
                busqueda@ for (respetarMov in listOf(true, false)) {
                    for (pat in listOf(h.patron) + RESPALDO[h.patron].orEmpty()) {
                        val lista = aptos[pat].orEmpty()
                        val libres = lista.filter { e -> e.id !in delDia && (!respetarMov || claveMovimiento(e) !in clavesDia) }
                        if (libres.isNotEmpty()) {
                            cands = lista
                            elegido = libres.maxBy { puntuar(it, h, perfil, marcas, usados, evitar, rest) }
                            break@busqueda
                        }
                    }
                }
                val ej = elegido ?: continue
                delDia += ej.id
                clavesDia += claveMovimiento(ej)
                usados += ej.id

                val reg = PesosYDiscos.tipoRegistro(ej)
                val zona = ZONA_DE_PATRON[h.patron]
                val series = seriesPorZona[zona] ?: 3
                val mover = when {
                    juego == "fuerza" -> 0
                    perfil.reps == "pesadas" -> -2
                    perfil.reps == "moderadas" -> 2
                    else -> 0
                }
                fun rango(r: Pair<Int, Int>): Pair<Int, Int> =
                    if (mayor) max(r.first, 8) to max(r.second, 12)
                    else max(3, r.first + mover) to max(5, r.second + mover)

                val (rMin, rMax, rpeBase, descBase) = when {
                    reg == "tiempo" -> {
                        val maxIso = rest.maxIsometrico?.let { min(45, it) } ?: 45
                        Quad(min(20, maxIso), maxIso, par.rpeAccesorio, 60)
                    }
                    h.papel == "principal" -> {
                        val r = rango(par.repsPrincipal)
                        Quad(r.first, r.second, par.rpePrincipal, if (juego == "fuerza") 180 else 150)
                    }
                    h.papel == "secundario" -> {
                        val r = rango(max(6, par.repsPrincipal.first) to max(10, par.repsPrincipal.second))
                        Quad(r.first, r.second, par.rpePrincipal, 120)
                    }
                    h.papel == "accesorio" -> {
                        val r = rango(par.repsAccesorio)
                        Quad(r.first, r.second, par.rpeAccesorio, 75)
                    }
                    else -> Quad(10, 15, 8.0, 60)
                }
                val fDesc = if (descBase >= 100) descansoCompuesto / 150.0 else descansoAislamiento / 90.0
                val descFinal = max(15, ((descBase * fDesc) / 15.0).roundToInt() * 15).let { if (mayor) max(it, 120) else it }
                val rpeFinal = if (calibracion) min(7.0, topeRpe) else min(rpeBase, topeRpe)

                val alts = cands
                    .filter { it.id != ej.id && it.id !in delDia }
                    .sortedByDescending { c ->
                        puntuar(c, h, perfil, marcas, emptySet(), emptySet(), rest) +
                            if (c.material != ej.material) 12.0 else 0.0
                    }
                    .take(2)
                    .map { it.id }

                val uid = nuevoUid()
                var bloque = Bloque(
                    uid = uid,
                    ejercicio = ej.id,
                    alternativas = alts,
                    series = if (reg == "tiempo" || h.papel == "core") min(series, 3) else series,
                    repsMin = rMin,
                    repsMax = rMax,
                    rpe = rpeFinal,
                    descanso = descFinal,
                    registro = reg,
                )
                if (h.par != null) {
                    val otroUid = porPar[h.par]
                    if (otroUid != null) {
                        val idxOtro = bloques.indexOfFirst { it.uid == otroUid }
                        if (idxOtro >= 0) {
                            val minS = min(bloques[idxOtro].series, bloque.series)
                            bloques[idxOtro] = bloques[idxOtro].copy(superserie = uid, series = minS)
                            bloque = bloque.copy(superserie = otroUid, series = minS)
                        }
                    } else {
                        porPar[h.par] = uid
                    }
                }
                prioridades[uid] = if (zona != null && zona in perfil.zonasPrioridad && h.prioridad > 2) h.prioridad - 1 else h.prioridad
                bloques += bloque
            }

            // Recorte al tiempo disponible + marcado de versión corta.
            val normalMin = perfil.minutosNormal.coerceIn(20, 120)
            val cortaMin = min(normalMin, perfil.minutosCorta.coerceIn(15, 90))
            val ajustados = ajustarATiempo(bloques, prioridades, if (opcional) max(normalMin, 45) else normalMin, cortaMin)
            return DiaRutina(letra = pl.letra, nombre = pl.nombre, dia = diaNum, opcional = opcional, bloques = ajustados)
        }

        diasPlantilla.forEachIndexed { idx, pl ->
            salida += construirDia(pl, fijos.getOrNull(idx), false)
        }
        val opc = perfil.diasOpcionales.filter { it in 0..6 && it !in fijos }.distinct()
        if (opc.isNotEmpty()) {
            val extra = PlantillaDia("S", "Sesión extra", brazos(1) + listOf(Hueco("tiron-v", "secundario", 2)) + hombros(3) + listOf(Hueco("core", "core", 4)))
            salida += construirDia(extra, opc.first(), true)
        }

        val porque = mutableListOf(
            when {
                nDias <= 3 -> "$nDias días → cuerpo completo: cada músculo trabaja toda la semana sin acumular fatiga."
                nDias <= 5 -> "$nDias días → torso y pierna alternos: cada músculo dos veces por semana."
                else -> "$nDias días → empuje, tirón y pierna dos veces por semana."
            },
            "Sesiones de ~${perfil.minutosNormal} min (versión corta de ~${perfil.minutosCorta} min).",
        )
        if (perfil.sueno == "poco") porque += "Duermes poco → esfuerzo limitado a 7,5 para recuperar mejor."
        if (perfil.modoMayor?.activo == true) porque += "Modo mayor → máquinas/apoyo, descansos largos y margen de 2 reps."
        val resumenSalud = SaludYRevisionDominio.resumenSalud(perfil)
        if (resumenSalud.isNotBlank()) porque += "Salud adaptada → $resumenSalud."

        return Rutina(
            id = id,
            creada = Instant.now().toString(),
            activa = true,
            estructura = estructura,
            porque = porque,
            calibracion = calibracion,
            gimnasioId = gimnasio?.id,
            dias = salida,
            equilibrio = if (perfil.modoMayor?.activo == true) 6 else null,
        )
    }

    fun bloqueParaEjercicio(e: EjercicioCatalogo, descansoComp: Int = 120, descansoAisl: Int = 75): Bloque {
        val reg = PesosYDiscos.tipoRegistro(e)
        val comp = e.mecanica == "compound"
        return Bloque(
            uid = nuevoUid(),
            ejercicio = e.id,
            series = 3,
            repsMin = if (reg == "tiempo") 20 else if (comp) 6 else 10,
            repsMax = if (reg == "tiempo") 45 else if (comp) 10 else 15,
            rpe = 8.0,
            descanso = if (reg == "tiempo") 60 else if (comp) descansoComp else descansoAisl,
            registro = reg,
        )
    }

    private fun ajustarATiempo(
        bloques: List<Bloque>,
        prioridades: Map<String, Int>,
        minutosNormal: Int,
        minutosCorta: Int,
    ): List<Bloque> {
        var bs = bloques.toMutableList()
        var guard = 0
        while (CalculosDominio.duracionMinDia(bs) > max(15, minutosNormal - 2) && guard++ < 35) {
            val orden = bs.sortedByDescending { prioridades[it.uid] ?: 3 }
            val reducible = orden.firstOrNull { it.series > 2 && (prioridades[it.uid] ?: 3) > 1 }
                ?: orden.firstOrNull { it.series > 2 }
            if (reducible != null) {
                val idx = bs.indexOfFirst { it.uid == reducible.uid }
                val nuevaSerie = reducible.series - 1
                bs[idx] = reducible.copy(series = nuevaSerie)
                reducible.superserie?.let { su ->
                    val ic = bs.indexOfFirst { it.uid == su }
                    if (ic >= 0 && bs[ic].series > nuevaSerie) bs[ic] = bs[ic].copy(series = nuevaSerie)
                }
                continue
            }
            val quitar = orden.firstOrNull { (prioridades[it.uid] ?: 3) > 1 } ?: break
            bs = bs.filterNot { it.uid == quitar.uid || it.uid == quitar.superserie }
                .map { if (it.superserie == quitar.uid) it.copy(superserie = null) else it }
                .toMutableList()
        }

        // Marcar ejercicios fuera en versión corta.
        bs = bs.map { it.copy(fueraEnCorta = false) }.toMutableList()
        val ordenCorta = bs.indices.sortedWith(compareByDescending<Int> { prioridades[bs[it].uid] ?: 3 }.thenByDescending { it })
        for (idx in ordenCorta) {
            val activos = bs.filterNot { it.fueraEnCorta == true }
            if (CalculosDominio.duracionMinDia(activos) <= max(12, minutosCorta - 1)) break
            if ((prioridades[bs[idx].uid] ?: 3) <= 1) continue
            bs[idx] = bs[idx].copy(fueraEnCorta = true)
            bs[idx].superserie?.let { su ->
                val ic = bs.indexOfFirst { it.uid == su }
                if (ic >= 0) bs[ic] = bs[ic].copy(fueraEnCorta = true)
            }
        }
        return bs
    }

    private data class Quad(val rMin: Int, val rMax: Int, val rpe: Double, val desc: Int)
}
