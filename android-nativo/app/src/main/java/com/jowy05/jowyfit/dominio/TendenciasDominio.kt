package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Serie
import com.jowy05.jowyfit.datos.modelo.Sesion
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Tendencias, fuerza, récords por mes, estancamiento/descarga, series musculares y métricas corporales (1:1 TS). */
object TendenciasDominio {

    const val SESIONES_ESTANCADO = 3
    const val SEMANAS_SIN_DESCARGA = 6
    const val DIAS_GRASA_BASCULA = 120L

    private val MESES_CORTOS = listOf("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")

    data class PuntoFecha(val fecha: String, val valor: Double)
    data class Subida(val ejercicio: String, val fecha: String, val sesionId: Long?, val antes: Double, val ahora: Double)
    data class Logro(val ejercicio: String, val fecha: String, val sesionId: Long?, val peso: Double, val reps: Int, val tipo: String, val mejora: Double)
    data class RecordsMes(val mes: String, val etiqueta: String, val total: Int, val enCurso: Boolean)
    data class EjercicioEstancado(val ejercicio: String, val peso: Double, val sesiones: Int = SESIONES_ESTANCADO)
    data class PropuestaDescarga(val motivo: String, val estancados: List<String>)
    data class GrupoMuscular(val nombre: String, val patrones: Set<String>, val min: Int, val max: Int)
    data class SeriesGrupo(val nombre: String, val series: Int, val min: Int, val max: Int) {
        val nivel: String get() = when {
            series < min -> "poco"
            series > max -> "mucho"
            else -> "bien"
        }
    }
    data class GrasaEnFecha(val fecha: String, val valor: Double, val fuente: String)

    val GRUPOS_MUSCULARES: List<GrupoMuscular> = listOf(
        GrupoMuscular("Pecho", setOf("empuje-h", "pecho-aisl"), 10, 20),
        GrupoMuscular("Espalda", setOf("tiron-h", "tiron-v", "lumbar"), 10, 20),
        GrupoMuscular("Piernas", setOf("rodilla", "cadera", "cuadriceps", "femoral", "gluteo", "gemelo"), 10, 20),
        GrupoMuscular("Hombros", setOf("empuje-v", "hombro-lat", "hombro-post", "trapecio"), 8, 16),
        GrupoMuscular("Brazos", setOf("biceps", "triceps", "antebrazo"), 8, 16),
        GrupoMuscular("Abdomen", setOf("core"), 4, 10),
    )

    private fun repsEfectivas(s: Serie): Int? = when {
        s.reps != null -> s.reps
        s.izq != null && s.der != null -> min(s.izq, s.der)
        s.izq != null -> s.izq
        s.der != null -> s.der
        else -> null
    }

    private fun trabajo(series: List<Serie>): List<Serie> = series.filter { it.hecha && !it.calentamiento }

    fun hechasAsc(sesiones: List<Sesion>): List<Sesion> =
        sesiones.filter { it.estado == "hecha" }.sortedWith(compareBy<Sesion> { it.fecha }.thenBy { it.inicio })

    fun seriesDe(s: Sesion, ejId: String): List<Serie> =
        s.ejercicios.filter { it.ejercicio == ejId }.flatMap { it.series }

    fun pesoMaximo(series: List<Serie>): Double? =
        trabajo(series).filter { it.peso != null && (repsEfectivas(it) ?: 0) > 0 }.maxOfOrNull { it.peso!! }

    fun mejor1RM(series: List<Serie>): Double? =
        trabajo(series)
            .mapNotNull { s ->
                val p = s.peso?.takeIf { it > 0.0 } ?: return@mapNotNull null
                val r = repsEfectivas(s)?.takeIf { it > 0 } ?: return@mapNotNull null
                CalculosDominio.epley(p, r)
            }
            .maxOrNull()

    fun repsMaximas(series: List<Serie>): Int? =
        trabajo(series).mapNotNull { repsEfectivas(it)?.takeIf { r -> r > 0 } }.maxOrNull()

    fun actualEjercicio(sesiones: List<Sesion>, ejId: String, que: String): Double? =
        sesiones.filter { it.estado == "hecha" }
            .mapNotNull { s ->
                if (que == "reps") repsMaximas(seriesDe(s, ejId))?.toDouble()
                else pesoMaximo(seriesDe(s, ejId))
            }
            .maxOrNull()

    fun estrictasDominadas(sesiones: List<Sesion>, nombreDe: (String) -> String = { it }): Int {
        val re = Regex("(pull-?up|chin-?up|dominad)", RegexOption.IGNORE_CASE)
        var maxR = 0
        for (s in sesiones) {
            if (s.estado != "hecha") continue
            for (e in s.ejercicios) {
                if (e.registro == "asistido") continue
                val txt = "${e.ejercicio} ${nombreDe(e.ejercicio)}"
                if (!re.containsMatchIn(txt) || e.ejercicio.contains("assisted", ignoreCase = true) || e.ejercicio.contains("negative", ignoreCase = true)) continue
                val r = repsMaximas(e.series) ?: 0
                if (r > maxR) maxR = r
            }
        }
        return maxR
    }

    fun evolucion(sesiones: List<Sesion>, ejId: String, medida: String): List<PuntoFecha> {
        val out = mutableListOf<PuntoFecha>()
        for (s in hechasAsc(sesiones)) {
            val series = seriesDe(s, ejId)
            if (trabajo(series).isEmpty()) continue
            val v = when (medida) {
                "peso" -> pesoMaximo(series)
                "e1rm" -> mejor1RM(series)
                else -> Progresion.volumen(series)
            } ?: continue
            if (medida != "peso" && v <= 0.0) continue
            out += PuntoFecha(s.fecha, (v * 10.0).roundToInt() / 10.0)
        }
        return out
    }

    fun ejerciciosHechos(sesiones: List<Sesion>): List<String> {
        val mapa = HashMap<String, Pair<Int, Long>>()
        for (s in hechasAsc(sesiones)) {
            for (e in s.ejercicios) {
                if (trabajo(e.series).isEmpty()) continue
                val prev = mapa[e.ejercicio]
                mapa[e.ejercicio] = ((prev?.first ?: 0) + 1) to max(prev?.second ?: 0L, s.inicio)
            }
        }
        return mapa.entries
            .sortedWith(compareByDescending<Map.Entry<String, Pair<Int, Long>>> { it.value.first }.thenByDescending { it.value.second })
            .map { it.key }
    }

    fun subidas(sesiones: List<Sesion>): List<Subida> {
        val ultimo = HashMap<String, Double>()
        val out = mutableListOf<Subida>()
        for (s in hechasAsc(sesiones)) {
            for (id in s.ejercicios.map { it.ejercicio }.distinct()) {
                val p = pesoMaximo(seriesDe(s, id)) ?: continue
                if (p <= 0.0) continue
                val antes = ultimo[id]
                if (antes != null && p > antes) out += Subida(id, s.fecha, s.id, antes, p)
                ultimo[id] = p
            }
        }
        return out.reversed()
    }

    fun logros(sesiones: List<Sesion>): List<Logro> {
        val histPeso = HashMap<String, Double>()
        val histReps = HashMap<String, MutableMap<Double, Int>>()
        val out = mutableListOf<Logro>()
        for (s in hechasAsc(sesiones)) {
            for (id in s.ejercicios.map { it.ejercicio }.distinct()) {
                val validas = trabajo(seriesDe(s, id)).mapNotNull { x ->
                    val p = x.peso?.takeIf { it > 0.0 } ?: return@mapNotNull null
                    val r = repsEfectivas(x)?.takeIf { it > 0 } ?: return@mapNotNull null
                    Triple(p, r, x.record == true)
                }
                val recs = validas.filter { it.third }
                val prevMax = histPeso[id]
                val prevReps = histReps[id]
                if (recs.isNotEmpty()) {
                    val mejor = recs.maxBy { CalculosDominio.epley(it.first, it.second) }
                    val peso = mejor.first
                    val reps = mejor.second
                    when {
                        prevMax == null -> out += Logro(id, s.fecha, s.id, peso, reps, "primero", 0.0)
                        peso > prevMax -> out += Logro(id, s.fecha, s.id, peso, reps, "peso", ((peso - prevMax) * 10.0).roundToInt() / 10.0)
                        else -> {
                            val antR = prevReps?.get(peso)
                            out += Logro(id, s.fecha, s.id, peso, reps, "reps", max(1, if (antR != null) reps - antR else 1).toDouble())
                        }
                    }
                }
                if (validas.isNotEmpty()) {
                    var mx = prevMax ?: Double.NEGATIVE_INFINITY
                    val mr = prevReps ?: HashMap()
                    for (x in validas) {
                        val px = x.first
                        val rx = x.second
                        if (px > mx) mx = px
                        mr[px] = max(mr[px] ?: 0, rx)
                    }
                    histPeso[id] = mx
                    histReps[id] = mr
                }
            }
        }
        return out.reversed()
    }

    fun recordsEn(sesiones: List<Sesion>, diasIso: Set<String>): Int =
        sesiones.filter { it.estado == "hecha" && it.fecha in diasIso }
            .sumOf { s -> s.ejercicios.sumOf { e -> trabajo(e.series).count { it.record == true } } }

    fun recordsPorMes(sesiones: List<Sesion>, hoyIso: String, meses: Int = 6): List<RecordsMes> {
        val cuenta = HashMap<String, Int>()
        for (l in logros(sesiones)) {
            val ym = l.fecha.take(7)
            cuenta[ym] = (cuenta[ym] ?: 0) + 1
        }
        val ref = runCatching { LocalDate.parse(hoyIso) }.getOrElse { LocalDate.now() }.withDayOfMonth(1)
        return (meses - 1 downTo 0).map { i ->
            val d = ref.minusMonths(i.toLong())
            val ym = "%04d-%02d".format(d.year, d.monthValue)
            RecordsMes(ym, MESES_CORTOS[d.monthValue - 1], cuenta[ym] ?: 0, i == 0)
        }
    }

    /** ¿Lleva 3 sesiones normales seguidas sin mejorar el 1RM respecto a la referencia anterior? */
    fun estancado(historialDesc: List<List<Serie>>): Boolean {
        if (historialDesc.size < SESIONES_ESTANCADO + 1) return false
        val ultimas = historialDesc.take(SESIONES_ESTANCADO)
        val ref = historialDesc[SESIONES_ESTANCADO]
        val base = mejor1RM(ref) ?: return false
        val pesoBase = pesoMaximo(ref) ?: return false
        if (base <= 0.0 || pesoBase <= 0.0) return false
        if (ultimas.any { (pesoMaximo(it) ?: 0.0) < pesoBase - 1e-9 || (mejor1RM(it) ?: 0.0) <= 0.0 }) return false
        return ultimas.maxOf { mejor1RM(it) ?: 0.0 } <= base * 1.01
    }

    fun ejerciciosEstancados(sesiones: List<Sesion>, semanaSuave: String? = null): List<EjercicioEstancado> {
        val normales = sesiones
            .filter { it.estado == "hecha" && !it.calibracion && it.suave != true && (semanaSuave == null || it.fecha > semanaSuave) }
            .sortedWith(compareByDescending<Sesion> { it.fecha }.thenByDescending { it.inicio })
        val ids = normales.flatMap { s ->
            s.ejercicios.filter { it.registro in setOf("peso", "mancuerna") }.map { it.ejercicio }
        }.distinct()
        val out = mutableListOf<EjercicioEstancado>()
        for (id in ids) {
            val hist = normales.flatMap { s ->
                s.ejercicios.filter { it.ejercicio == id && it.cargaPct == null && trabajo(it.series).isNotEmpty() }.map { it.series }
            }
            if (estancado(hist)) {
                out += EjercicioEstancado(id, pesoMaximo(hist.first()) ?: 0.0)
            }
        }
        return out
    }

    fun pesoReinicio(peso: Double, lista: List<Double>, factor: Double = 0.9): Double {
        val obj = peso * factor
        val menores = lista.filter { it > 0.0 && it < peso - 1e-9 }
        val p = if (lista.isNotEmpty()) {
            menores.minByOrNull { abs(it - obj) } ?: peso
        } else {
            ((obj / 2.5).roundToInt() * 2.5)
        }
        return if (p > 0.0 && p < peso) p else peso
    }

    fun propuestaDescarga(
        hoyIso: String,
        sesiones: List<Sesion>,
        ejerciciosRutina: List<String>,
        nombreDe: (String) -> String,
        semanaSuave: String? = null,
    ): PropuestaDescarga? {
        val hoy = runCatching { LocalDate.parse(hoyIso) }.getOrElse { LocalDate.now() }
        val lunes = CalculosDominio.lunesDe(hoy)
        val lunesIso = lunes.toString()
        if (semanaSuave == lunesIso) return null
        val normales = sesiones
            .filter { it.estado == "hecha" && !it.calibracion && it.suave != true && (semanaSuave == null || it.fecha > semanaSuave) }
            .sortedWith(compareByDescending<Sesion> { it.fecha }.thenByDescending { it.inicio })

        val estancados = ejerciciosRutina.distinct().filter { id ->
            val h = normales.flatMap { s ->
                s.ejercicios.filter { it.ejercicio == id && it.cargaPct == null && trabajo(it.series).isNotEmpty() }.map { it.series }
            }
            estancado(h)
        }
        if (estancados.size >= 3) {
            val nombres = estancados.take(3).joinToString(", ", transform = nombreDe)
            return PropuestaDescarga("${estancados.size} ejercicios llevan $SESIONES_ESTANCADO sesiones sin mejorar ($nombres…)", estancados)
        }
        val semanasConEntreno = normales.mapNotNull { s ->
            runCatching { CalculosDominio.lunesDe(LocalDate.parse(s.fecha.take(10))) }.getOrNull()
        }.filter { it.isBefore(lunes) }.toSet()
        var seguidas = 0
        var cursor = lunes.minusWeeks(1)
        while (cursor in semanasConEntreno) {
            seguidas++
            cursor = cursor.minusWeeks(1)
        }
        if (seguidas >= SEMANAS_SIN_DESCARGA) {
            return PropuestaDescarga("Llevas $seguidas semanas seguidas entrenando: toca una semana suave.", estancados)
        }
        return null
    }

    fun seriesPorGrupo(sesiones: List<Sesion>, diasIso: Set<String>, patronDe: (String) -> String?): List<SeriesGrupo> {
        val cuenta = GRUPOS_MUSCULARES.associate { it.nombre to 0 }.toMutableMap()
        for (s in sesiones) {
            if (s.estado != "hecha" || s.fecha !in diasIso) continue
            for (e in s.ejercicios) {
                val p = patronDe(e.ejercicio) ?: continue
                val g = GRUPOS_MUSCULARES.firstOrNull { p in it.patrones } ?: continue
                cuenta[g.nombre] = (cuenta[g.nombre] ?: 0) + trabajo(e.series).size
            }
        }
        return GRUPOS_MUSCULARES.map { g -> SeriesGrupo(g.nombre, cuenta[g.nombre] ?: 0, g.min, g.max) }
    }

    fun serieMedida(ms: List<Medicion>, lector: (Medicion) -> Double?): List<PuntoFecha> {
        val porDia = LinkedHashMap<String, Double>()
        for (m in ms.sortedWith(compareBy<Medicion> { it.fecha }.thenBy { it.id ?: 0L })) {
            val v = lector(m) ?: continue
            porDia[m.fecha.take(10)] = v
        }
        return porDia.entries.map { PuntoFecha(it.key, it.value) }
    }

    fun ultimoValor(ms: List<Medicion>, lector: (Medicion) -> Double?, hasta: String? = null): PuntoFecha? {
        var mejor: Medicion? = null
        for (m in ms) {
            if (lector(m) == null) continue
            if (hasta != null && m.fecha.take(10) > hasta) continue
            val mId = m.id ?: 0L
            val bId = mejor?.id ?: 0L
            if (mejor == null || m.fecha > mejor.fecha || (m.fecha == mejor.fecha && mId >= bId)) mejor = m
        }
        return mejor?.let { PuntoFecha(it.fecha.take(10), lector(it)!!) }
    }

    fun grasaPorMedidas(ms: List<Medicion>, sexo: String, alturaCm: Double): List<PuntoFecha> {
        val out = mutableListOf<PuntoFecha>()
        for (p in serieMedida(ms) { it.perimetros?.cintura }) {
            val cuello = ultimoValor(ms, { it.perimetros?.cuello }, p.fecha)?.valor
            val cadera = ultimoValor(ms, { it.perimetros?.cadera }, p.fecha)?.valor
            val g = CalculosDominio.grasaMarina(sexo, alturaCm, p.valor, cuello, cadera)
            if (g != null && g > 0.0 && g < 70.0) {
                out += PuntoFecha(p.fecha, (g * 10.0).roundToInt() / 10.0)
            }
        }
        return out
    }

    fun grasaActual(ms: List<Medicion>, perfil: Perfil, fechaIso: String): GrasaEnFecha? {
        val fecha = runCatching { LocalDate.parse(fechaIso.take(10)) }.getOrElse { LocalDate.now() }
        val limite = fecha.minusDays(DIAS_GRASA_BASCULA).toString()
        val basc = ultimoValor(ms, { it.bascula?.grasaPct }, fechaIso)
        if (basc != null && basc.fecha >= limite) {
            return GrasaEnFecha(basc.fecha, basc.valor, "bascula")
        }
        val mar = grasaPorMedidas(ms, perfil.sexo, perfil.alturaCm).lastOrNull { it.fecha <= fechaIso }
        return mar?.let { GrasaEnFecha(it.fecha, it.valor, "medidas") }
    }

    data class TendenciaPeso(val kgSemana: Double?, val puntos: List<Double>)

    fun tendenciaPeso(ms: List<Medicion>, hoyIso: String, dias: Long = 30L): TendenciaPeso {
        val hoy = runCatching { LocalDate.parse(hoyIso.take(10)) }.getOrElse { LocalDate.now() }
        val pts = ms.sortedWith(compareBy<Medicion> { it.fecha }.thenBy { it.id ?: 0L }).mapNotNull { m ->
            val p = m.pesoKg ?: return@mapNotNull null
            val f = runCatching { LocalDate.parse(m.fecha.take(10)) }.getOrNull() ?: return@mapNotNull null
            val d = ChronoUnit.DAYS.between(f, hoy)
            if (d in 0..dias) Triple(m.fecha, -d.toDouble(), p) else null
        }
        val ys = pts.map { it.third }
        if (pts.size < 2 || pts.last().second - pts.first().second < 5.0) return TendenciaPeso(null, ys)
        val mx = pts.map { it.second }.average()
        val my = ys.average()
        val num = pts.sumOf { (it.second - mx) * (it.third - my) }
        val den = pts.sumOf { (it.second - mx) * (it.second - mx) }
        val pendiente = if (den > 0.0) ((num / den) * 7.0 * 10.0).roundToInt() / 10.0 else null
        return TendenciaPeso(pendiente, ys)
    }

    fun progresoMeta(inicio: Double?, actual: Double?, objetivo: Double): Double {
        if (actual == null) return 0.0
        val desde = inicio ?: actual
        if (desde == objetivo) return if (actual == objetivo) 1.0 else 0.0
        return ((actual - desde) / (objetivo - desde)).coerceIn(0.0, 1.0)
    }

    fun faltaMeta(inicio: Double?, actual: Double?, objetivo: Double): Double? {
        if (actual == null) return null
        val baja = objetivo < (inicio ?: actual)
        return max(0.0, if (baja) actual - objetivo else objetivo - actual)
    }
}
