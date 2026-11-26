package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.Bloque
import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.DiaRutina
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Recolocada
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Sesion
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.Period
import java.time.temporal.ChronoUnit
import kotlin.math.ceil
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.roundToInt

/** Cálculos puros 1:1 con src/dominio/calculos.ts, energia.ts, fechas.ts, semana.ts y actualizacion.ts. */
object CalculosDominio {

    fun hoyIso(ahora: LocalDate = LocalDate.now()): String = ahora.toString()

    /** 0 = lunes … 6 = domingo (idéntico a diaSemana de TS). */
    fun diaSemana(fecha: LocalDate): Int = (fecha.dayOfWeek.value - 1).coerceIn(0, 6)

    fun lunesDe(fecha: LocalDate): LocalDate = fecha.with(DayOfWeek.MONDAY)

    fun semanaDe(fechaIso: String): List<String> {
        val d = runCatching { LocalDate.parse(fechaIso.take(10)) }.getOrElse { LocalDate.now() }
        val lunes = d.with(DayOfWeek.MONDAY)
        return (0L..6L).map { lunes.plusDays(it).toString() }
    }

    fun edad(nacimientoIso: String, hoy: LocalDate = LocalDate.now()): Int {
        val nac = runCatching { LocalDate.parse(nacimientoIso.take(10)) }.getOrNull() ?: return 30
        return Period.between(nac, hoy).years.coerceIn(10, 110)
    }

    fun numeroSemana(inicioIso: String?, hoyIso: String): Int {
        if (inicioIso.isNullOrBlank()) return 1
        val ini = runCatching { LocalDate.parse(inicioIso.take(10)) }.getOrNull() ?: return 1
        val hoy = runCatching { LocalDate.parse(hoyIso.take(10)) }.getOrNull() ?: return 1
        val dias = ChronoUnit.DAYS.between(ini.with(DayOfWeek.MONDAY), hoy.with(DayOfWeek.MONDAY))
        return max(1, (dias / 7).toInt() + 1)
    }

    fun saludo(hora: Int = LocalTime.now().hour): String = when {
        hora < 12 -> "Buenos días"
        hora < 20 -> "Buenas tardes"
        else -> "Buenas noches"
    }

    fun imc(pesoKg: Double, alturaCm: Double): Double? {
        if (pesoKg <= 0 || alturaCm <= 0) return null
        val m = alturaCm / 100.0
        return pesoKg / (m * m)
    }

    fun cinturaAltura(cinturaCm: Double, alturaCm: Double): Double? =
        if (cinturaCm > 0 && alturaCm > 0) cinturaCm / alturaCm else null

    fun basalMifflin(pesoKg: Double, alturaCm: Double, edad: Int, sexo: String): Double =
        10.0 * pesoKg + 6.25 * alturaCm - 5.0 * edad + if (sexo == "hombre") 5.0 else -161.0

    fun grasaMarina(
        sexo: String,
        alturaCm: Double,
        cinturaCm: Double?,
        cuelloCm: Double?,
        caderaCm: Double?,
    ): Double? {
        if (cinturaCm == null || cuelloCm == null || !alturaCm.isFinite() || !cinturaCm.isFinite() || !cuelloCm.isFinite() || alturaCm <= 0) return null
        val res = if (sexo == "hombre") {
            if (cinturaCm <= cuelloCm) null
            else 495.0 / (1.0324 - 0.19077 * log10(cinturaCm - cuelloCm) + 0.15456 * log10(alturaCm)) - 450.0
        } else {
            if (caderaCm == null || !caderaCm.isFinite() || cinturaCm + caderaCm <= cuelloCm) null
            else 495.0 / (1.29579 - 0.35004 * log10(cinturaCm + caderaCm - cuelloCm) + 0.221 * log10(alturaCm)) - 450.0
        }
        return res?.takeIf { it.isFinite() }
    }

    fun epley(peso: Double, reps: Int): Double = when {
        peso <= 0 || reps <= 0 -> 0.0
        reps == 1 -> peso
        else -> peso * (1.0 + reps / 30.0)
    }

    private fun factorActividad(trabajo: String): Double = when (trabajo) {
        "depie" -> 1.375
        "fisico" -> 1.55
        else -> 1.2
    }

    private fun ajusteKcal(objetivo: String, extra: List<String>?): Int {
        fun valor(o: String) = when (o) {
            "perder" -> -300
            "recomposicion" -> -200
            "musculo" -> 200
            "peso" -> 300
            else -> 0
        }
        val principal = valor(objetivo)
        if (principal != 0) return principal
        extra?.forEach { o ->
            val v = valor(o)
            if (v != 0) return v
        }
        return 0
    }

    data class ObjetivosEnergia(
        val peso: Double?,
        val basal: Int,
        val gasto: Int,
        val kcal: Int,
        val proteina: Int,
        val ajuste: Int,
    )

    fun calcularObjetivos(
        perfil: Perfil,
        pesoActual: Double?,
        kcalManual: Int? = null,
        proteinaManual: Int? = null,
        entrenosSemana: Int = max(1, perfil.diasFijos.size),
        hoy: LocalDate = LocalDate.now(),
    ): ObjetivosEnergia {
        val peso = pesoActual ?: 75.0
        val anios = edad(perfil.nacimiento, hoy)
        val basal = basalMifflin(peso, perfil.alturaCm, anios, perfil.sexo)
        val diaADia = basal * factorActividad(perfil.trabajo) - basal
        val pasosExtra = if (perfil.pasosObjetivo > 5000) {
            (0.5 * peso * (perfil.pasosObjetivo - 5000) * (perfil.alturaCm / 100.0) * 0.415) / 1000.0
        } else {
            0.0
        }
        val entreno = (entrenosSemana * 300.0) / 7.0 / 2.0
        val gasto = basal + diaADia + pasosExtra + entreno
        val ajuste = ajusteKcal(perfil.objetivo, perfil.objetivosExtra)
        val kcalAuto = max((ceil(basal / 50.0) * 50.0).toInt(), ((gasto + ajuste) / 50.0).roundToInt() * 50)
        val gramosKg = if (perfil.objetivo == "perder") 2.0 else 1.8
        val protAuto = ((peso * gramosKg) / 5.0).roundToInt() * 5

        return ObjetivosEnergia(
            peso = pesoActual,
            basal = basal.roundToInt(),
            gasto = gasto.roundToInt(),
            kcal = kcalManual ?: kcalAuto,
            proteina = proteinaManual ?: protAuto,
            ajuste = ajuste,
        )
    }

    fun basalHastaAhora(basal: Int, minutosDelDia: Int): Int =
        ((basal.toDouble() * minutosDelDia.coerceIn(0, 1440)) / 1440.0).roundToInt()

    fun kcalPasos(pasos: Int, pesoKg: Double, alturaCm: Double, troteKm: Double = 0.0, porKm: Int = 1300): Int {
        if (pasos <= 0 || !pesoKg.isFinite() || !alturaCm.isFinite() || pesoKg <= 0.0 || alturaCm <= 0.0) return 0
        val porKmSeguro = porKm.coerceAtLeast(100)
        val troteSeguro = if (troteKm.isFinite() && troteKm > 0.0) troteKm else 0.0
        val pasosTrote = minOf(pasos.toDouble(), troteSeguro * porKmSeguro)
        val kmAndando = ((pasos - pasosTrote) * (alturaCm / 100.0) * 0.415) / 1000.0
        return (0.5 * pesoKg * kmAndando + 1.0 * pesoKg * (pasosTrote / porKmSeguro)).roundToInt().coerceAtLeast(0)
    }

    data class TotalesDiaComida(val kcal: Int, val proteina: Int, val cafeina: Int)

    fun totalesComida(comidas: List<Comida>): TotalesDiaComida = TotalesDiaComida(
        kcal = comidas.sumOf { it.kcal }.roundToInt(),
        proteina = comidas.sumOf { it.proteina }.roundToInt(),
        cafeina = comidas.sumOf { it.cafeina ?: 0.0 }.roundToInt(),
    )

    fun duracionMinDia(bloques: List<Bloque>): Int {
        var totalSeg = 300 // calentamiento aproximado
        for (b in bloques) {
            val segSerie = if (b.registro == "tiempo") b.repsMax else 42
            totalSeg += b.series * (segSerie + b.descanso)
        }
        return max(10, (totalSeg / 60.0).roundToInt())
    }

    enum class EstadoDiaTipo { HECHO, PLAN, PERDIDO, OPCIONAL, DESCANSO, MOVIDO }

    data class EstadoDia(
        val fecha: String,
        val estado: EstadoDiaTipo,
        val hoy: Boolean,
        val dia: DiaRutina? = null,
        val sesion: Sesion? = null,
    )

    fun estadoSemana(
        rutina: Rutina?,
        sesiones: List<Sesion>,
        hoyIso: String,
        recolocadas: List<Recolocada> = emptyList(),
    ): List<EstadoDia> = semanaDe(hoyIso).map { fecha ->
        val hecha = sesiones.firstOrNull { it.fecha == fecha && it.estado == "hecha" }
        val (dia, opcional) = planDe(rutina, fecha, recolocadas)
        val esHoy = fecha == hoyIso
        when {
            hecha != null -> EstadoDia(fecha, EstadoDiaTipo.HECHO, esHoy, dia, hecha)
            dia != null && !opcional -> {
                val movida = recolocadas.any { it.desde == fecha }
                val creadaDia = rutina?.creada?.take(10).orEmpty()
                when {
                    fecha < hoyIso && creadaDia.isNotEmpty() && fecha < creadaDia ->
                        EstadoDia(fecha, EstadoDiaTipo.DESCANSO, esHoy)
                    fecha < hoyIso ->
                        EstadoDia(fecha, if (movida) EstadoDiaTipo.MOVIDO else EstadoDiaTipo.PERDIDO, esHoy, dia)
                    else ->
                        EstadoDia(fecha, EstadoDiaTipo.PLAN, esHoy, dia)
                }
            }
            dia != null && opcional -> EstadoDia(fecha, EstadoDiaTipo.OPCIONAL, esHoy, dia)
            else -> EstadoDia(fecha, EstadoDiaTipo.DESCANSO, esHoy)
        }
    }

    private fun planDe(
        rutina: Rutina?,
        fecha: String,
        recolocadas: List<Recolocada>,
    ): Pair<DiaRutina?, Boolean> {
        if (rutina == null) return null to false
        recolocadas.firstOrNull { it.fecha == fecha }?.let { rc ->
            return rutina.dias.firstOrNull { it.letra == rc.letra } to false
        }
        val ds = diaSemana(runCatching { LocalDate.parse(fecha.take(10)) }.getOrElse { LocalDate.now() })
        rutina.dias.firstOrNull { !it.opcional && it.dia == ds }?.let { return it to false }
        rutina.dias.firstOrNull { it.opcional && it.dia == ds }?.let { return it to true }
        return null to false
    }

    sealed interface TarjetaHoyEstado {
        data class EnCurso(val sesion: Sesion) : TarjetaHoyEstado
        data object SinRutina : TarjetaHoyEstado
        data class Hoy(val dia: DiaRutina) : TarjetaHoyEstado
        data class Opcional(val dia: DiaRutina) : TarjetaHoyEstado
        data class Hecho(val sesion: Sesion, val proximo: EstadoDia?) : TarjetaHoyEstado
        data class Descanso(val proximo: EstadoDia?) : TarjetaHoyEstado
    }

    fun tarjetaHoy(
        rutina: Rutina?,
        semana: List<EstadoDia>,
        hoyIso: String,
        enCurso: Sesion?,
    ): TarjetaHoyEstado {
        if (enCurso != null) return TarjetaHoyEstado.EnCurso(enCurso)
        if (rutina == null) return TarjetaHoyEstado.SinRutina
        val hoy = semana.firstOrNull { it.fecha == hoyIso }
        val proximo = semana.firstOrNull { it.fecha > hoyIso && it.estado == EstadoDiaTipo.PLAN }
        return when {
            hoy == null -> TarjetaHoyEstado.Descanso(proximo)
            hoy.estado == EstadoDiaTipo.HECHO && hoy.sesion != null -> TarjetaHoyEstado.Hecho(hoy.sesion, proximo)
            hoy.estado == EstadoDiaTipo.PLAN && hoy.dia != null -> TarjetaHoyEstado.Hoy(hoy.dia)
            hoy.estado == EstadoDiaTipo.OPCIONAL && hoy.dia != null -> TarjetaHoyEstado.Opcional(hoy.dia)
            else -> TarjetaHoyEstado.Descanso(proximo)
        }
    }
}

/** Validación y comparación semver 1:1 con src/dominio/actualizacion.ts. */
object ActualizacionDominio {
    const val API_ULTIMA_RELEASE = "https://api.github.com/repos/Jowy05/JowyFit/releases/latest"
    const val URL_RELEASES = "https://github.com/Jowy05/JowyFit/releases/latest"

    private val RE_VERSION = Regex("^v?(\\d+)\\.(\\d+)\\.(\\d+)$")
    private val RE_APK = Regex(
        "^https://github\\.com/Jowy05/JowyFit/releases/(?:download/v\\d+\\.\\d+\\.\\d+|latest/download)/JowyFit(?:-\\d+\\.\\d+\\.\\d+)?\\.apk$",
    )
    private val RE_RELEASE = Regex("^https://github\\.com/Jowy05/JowyFit/releases/[A-Za-z0-9._/-]+$")
    private val RE_SHA = Regex("SHA-256 del APK:\\s*([0-9a-fA-F]{64})", RegexOption.IGNORE_CASE)

    data class InfoActualizacion(
        val actual: String,
        val ultima: String,
        val hayNueva: Boolean,
        val notas: String,
        val urlApk: String?,
        val urlRelease: String,
        val sha256: String?,
        val bytes: Long?,
        val fecha: String?,
    )

    private fun partes(v: String): Triple<Int, Int, Int>? {
        val m = RE_VERSION.matchEntire(v.trim()) ?: return null
        return Triple(m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3].toInt())
    }

    fun compararVersion(a: String, b: String): Int {
        val pa = partes(a) ?: return 0
        val pb = partes(b) ?: return 0
        if (pa.first != pb.first) return pa.first.compareTo(pb.first)
        if (pa.second != pb.second) return pa.second.compareTo(pb.second)
        return pa.third.compareTo(pb.third)
    }

    fun urlApkSegura(url: String?): Boolean = url != null && RE_APK.matches(url)

    fun extraerSha256(cuerpo: String): String? = RE_SHA.find(cuerpo)?.groupValues?.get(1)?.lowercase()

    fun limpiarNotas(cuerpo: String): String {
        val limpio = cuerpo
            .replace("\r\n", "\n")
            .lines()
            .filterNot { it.contains("SHA-256 del APK:", ignoreCase = true) }
            .joinToString("\n")
            .trim()
        return if (limpio.length > 1200) "${limpio.take(1200).trimEnd()}…" else limpio
    }

    fun parsearRelease(obj: JsonObject, actual: String): InfoActualizacion? {
        val tag = obj["tag_name"]?.jsonPrimitive?.contentOrNull ?: return null
        val p = partes(tag) ?: return null
        val ultima = "${p.first}.${p.second}.${p.third}"
        val cuerpo = obj["body"]?.jsonPrimitive?.contentOrNull ?: ""
        val assets = (obj["assets"] as? JsonArray)?.mapNotNull { it as? JsonObject }.orEmpty()

        val elegido = assets.firstOrNull {
            it["name"]?.jsonPrimitive?.contentOrNull == "JowyFit.apk" &&
                urlApkSegura(it["browser_download_url"]?.jsonPrimitive?.contentOrNull)
        } ?: assets.firstOrNull {
            urlApkSegura(it["browser_download_url"]?.jsonPrimitive?.contentOrNull)
        }

        val urlApk = elegido?.get("browser_download_url")?.jsonPrimitive?.contentOrNull?.takeIf(::urlApkSegura)
        val bytes = elegido?.get("size")?.jsonPrimitive?.longOrNull?.takeIf { it > 0 }
        val urlRel = obj["html_url"]?.jsonPrimitive?.contentOrNull?.takeIf { RE_RELEASE.matches(it) } ?: URL_RELEASES
        val fecha = obj["published_at"]?.jsonPrimitive?.contentOrNull?.take(10)?.takeIf { it.length == 10 }

        return InfoActualizacion(
            actual = partes(actual)?.let { "${it.first}.${it.second}.${it.third}" } ?: actual,
            ultima = ultima,
            hayNueva = compararVersion(ultima, actual) > 0,
            notas = limpiarNotas(cuerpo),
            urlApk = urlApk,
            urlRelease = urlRel,
            sha256 = extraerSha256(cuerpo),
            bytes = bytes,
            fecha = fecha,
        )
    }

    fun tamanoMB(bytes: Long): String {
        val mb = max(0.1, ((bytes.toDouble() / (1024.0 * 1024.0)) * 10.0).roundToInt() / 10.0)
        return String.format("%.1f MB", mb).replace('.', ',')
    }
}
