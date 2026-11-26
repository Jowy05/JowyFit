package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Plantilla
import com.jowy05.jowyfit.datos.modelo.Producto
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI
import java.time.Instant
import kotlin.math.roundToInt

/** Lógica pura de comida: franjas, raciones P/N/G, Open Food Facts seguro, cafeína, recientes y suplementos (1:1 TS). */
object ComidaDominio {

    val FRANJAS: List<String> = listOf("desayuno", "comida", "merienda", "cena")

    val FRANJAS_HORAS: Map<String, String> = mapOf(
        "desayuno" to "05:00",
        "comida" to "11:00",
        "merienda" to "16:30",
        "cena" to "19:30",
    )

    fun nombreFranja(f: String): String = when (f) {
        "desayuno" -> "Desayuno"
        "comida" -> "Comida"
        "merienda" -> "Merienda"
        else -> "Cena"
    }

    fun minutosDe(hhmm: String): Int? {
        val m = Regex("^(\\d{1,2}):(\\d{2})$").matchEntire(hhmm.trim()) ?: return null
        val h = m.groupValues[1].toIntOrNull() ?: return null
        val min = m.groupValues[2].toIntOrNull() ?: return null
        if (h !in 0..23 || min !in 0..59) return null
        return h * 60 + min
    }

    fun franjasValidas(horas: Map<String, String>): Boolean {
        val ms = FRANJAS.map { minutosDe(horas[it] ?: return false) ?: return false }
        return ms.indices.all { i -> i == 0 || ms[i] > ms[i - 1] }
    }

    fun franjaPorHora(hhmm: String, horas: Map<String, String>? = null): String {
        val h = if (horas != null && franjasValidas(horas)) horas else FRANJAS_HORAS
        val m = minutosDe(hhmm) ?: return "comida"
        var franja = "cena"
        for (f in FRANJAS) {
            val fm = minutosDe(h[f] ?: FRANJAS_HORAS.getValue(f)) ?: continue
            if (m >= fm) franja = f
        }
        return franja
    }

    fun factorRacion(racion: String, tipo: String? = null): Double {
        val picoteo = tipo == "picoteo"
        return when (racion) {
            "P" -> 1.0 / 3.0
            "G" -> if (picoteo) 1.0 else 1.5
            else -> if (picoteo) 0.5 else 1.0
        }
    }

    fun nombreRacion(racion: String): String = when (racion) {
        "P" -> "Poco"
        "G" -> "Mucho"
        else -> "Normal"
    }

    fun pistaRacion(racion: String, tipo: String? = null): String = if (tipo == "picoteo") {
        when (racion) {
            "P" -> "un ⅓"
            "G" -> "todo"
            else -> "la mitad"
        }
    } else {
        when (racion) {
            "P" -> "⅓ del plato"
            "G" -> "plato y medio"
            else -> "el plato"
        }
    }

    data class Macros(
        val hidratos: Double? = null,
        val grasas: Double? = null,
        val azucares: Double? = null,
        val sal: Double? = null,
    )

    data class ValoresComida(
        val kcal: Double,
        val proteina: Double,
        val cafeina: Double? = null,
        val hidratos: Double? = null,
        val grasas: Double? = null,
        val azucares: Double? = null,
        val sal: Double? = null,
    )

    private fun r1(v: Double?): Double? = if (v == null || !v.isFinite()) null else (v * 10.0).roundToInt() / 10.0

    fun escalarMacros(m: Macros, f: Double): Macros = Macros(
        hidratos = m.hidratos?.let { r1(it * f) },
        grasas = m.grasas?.let { r1(it * f) },
        azucares = m.azucares?.let { r1(it * f) },
        sal = m.sal?.let { r1(it * f) },
    )

    fun conRacion(
        kcal: Double,
        proteina: Double,
        cafeina: Double? = null,
        macros: Macros = Macros(),
        racion: String = "N",
        tipo: String? = null,
    ): ValoresComida {
        val f = factorRacion(racion, tipo)
        val esc = escalarMacros(macros, f)
        val k = if (kcal.isFinite() && kcal > 0.0) (kcal * f).roundToInt().toDouble() else 0.0
        val pr = if (proteina.isFinite() && proteina > 0.0) (proteina * f).roundToInt().toDouble() else 0.0
        return ValoresComida(
            kcal = k,
            proteina = pr,
            cafeina = cafeina?.takeIf { it.isFinite() && it > 0.0 }?.let { (it * f).roundToInt().toDouble() },
            hidratos = esc.hidratos,
            grasas = esc.grasas,
            azucares = esc.azucares,
            sal = esc.sal,
        )
    }

    fun notaPorTamano(tamano: String, franja: String): Pair<Int, Int> {
        val pequena = franja == "desayuno" || franja == "merienda"
        val baseKcal = if (pequena) 350.0 else 600.0
        val baseProt = if (pequena) 15.0 else 25.0
        val r = when (tamano) {
            "ligera" -> "P"
            "abundante" -> "G"
            else -> "N"
        }
        val f = factorRacion(r)
        val kcal = ((baseKcal * f) / 10.0).roundToInt() * 10
        val prot = (baseProt * f).roundToInt()
        return kcal to prot
    }

    /** Código de barras válido (EAN-8, EAN-13, UPC-A/E, ITF-14). */
    fun codigoValido(codigo: String): Boolean = Regex("^\\d{8,14}$").matches(codigo.trim())

    /** Solo permite imágenes HTTPS de Open Food Facts (bloquea píxeles espía externos y caracteres de control). */
    fun imagenOFF(url: String?): String? {
        if (url.isNullOrBlank() || url.length > 2000) return null
        val limpia = url.trim()
        if (limpia.any { it.code < 0x20 || it.isWhitespace() }) return null
        return runCatching {
            val u = URI(limpia)
            val host = u.host?.lowercase() ?: return null
            val okScheme = u.scheme.equals("https", ignoreCase = true)
            val okUserPort = u.userInfo == null && (u.port == -1 || u.port == 443)
            val okHost = Regex("^(?:[a-z0-9-]+\\.)*openfoodfacts\\.(org|net)$").matches(host)
            if (okScheme && okUserPort && okHost) u.toString() else null
        }.getOrNull()
    }

    private fun leerNum(obj: JsonObject?, clave: String): Double? {
        val el = obj?.get(clave) as? JsonPrimitive ?: return null
        el.doubleOrNull?.takeIf { it.isFinite() }?.let { return it }
        val txt = el.content.trim().replace(',', '.')
        return txt.toDoubleOrNull()?.takeIf { it.isFinite() }
    }

    private fun creible(v: Double?, max: Double): Double? =
        if (v != null && v.isFinite() && v >= 0.0 && v <= max) v else null

    /** Parsea la respuesta API v2 de Open Food Facts a Producto con límites de credibilidad. */
    fun leerOFF(codigo: String, json: JsonObject?, ahoraIso: String = Instant.now().toString()): Producto? {
        if (json == null) return null
        val status = json["status"]?.jsonPrimitive?.intOrNull
        if (status == 0) return null
        val p = runCatching { json["product"]?.jsonObject }.getOrNull() ?: return null
        val nu = runCatching { p["nutriments"]?.jsonObject }.getOrNull()

        fun g100(clave: String): Double? = creible(leerNum(nu, clave), 100.0)
        var kcal100 = creible(leerNum(nu, "energy-kcal_100g"), 900.0)
        if (kcal100 == null) {
            val kj = creible(leerNum(nu, "energy-kj_100g") ?: leerNum(nu, "energy_100g"), 3800.0)
            if (kj != null) kcal100 = kj / 4.184
        }
        val racionG = creible(leerNum(p, "serving_quantity"), 5000.0)
        var kcalRacion = creible(leerNum(nu, "energy-kcal_serving"), 45_000.0)
        if (kcalRacion == null && kcal100 != null && racionG != null && racionG > 0.0) {
            kcalRacion = (kcal100 * racionG) / 100.0
        }
        val prot100 = g100("proteins_100g")
        var protRacion = creible(leerNum(nu, "proteins_serving"), 5000.0)
        if (protRacion == null && prot100 != null && racionG != null && racionG > 0.0) {
            protRacion = (prot100 * racionG) / 100.0
        }
        val cafG100 = creible(leerNum(nu, "caffeine_100g"), 5.0)

        fun txt(clave: String): String =
            runCatching { p[clave]?.jsonPrimitive?.content?.trim().orEmpty() }.getOrDefault("")
        val nombreRaw = txt("product_name_es").ifBlank { txt("product_name") }.ifBlank { txt("generic_name_es") }
        val marca = txt("brands").split(',').firstOrNull()?.trim().orEmpty().take(80)
        val img = imagenOFF(txt("image_front_small_url")) ?: imagenOFF(txt("image_front_url"))

        return Producto(
            codigo = codigo.trim(),
            nombre = nombreRaw.ifBlank { "Producto $codigo" }.take(150),
            marca = marca,
            imagen = img,
            kcal100 = kcal100?.roundToInt()?.toDouble(),
            proteina100 = r1(prot100),
            hidratos100 = r1(g100("carbohydrates_100g")),
            grasas100 = r1(g100("fat_100g")),
            azucares100 = r1(g100("sugars_100g")),
            sal100 = r1(g100("salt_100g")),
            cafeina100 = cafG100?.let { (it * 1000.0).roundToInt().toDouble() },
            racionG = racionG?.roundToInt()?.toDouble(),
            kcalRacion = kcalRacion?.roundToInt()?.toDouble(),
            proteinaRacion = r1(protRacion),
            guardado = ahoraIso,
        )
    }

    data class PorcionProducto(
        val kcal: Double,
        val proteina: Double,
        val cafeina: Double? = null,
        val macros: Macros = Macros(),
        val base: String,
    )

    fun porRacion(p: Producto): PorcionProducto {
        val m100 = Macros(p.hidratos100, p.grasas100, p.azucares100, p.sal100)
        if (p.kcalRacion != null) {
            val rg = p.racionG?.takeIf { it > 0.0 }
            val caf = if (p.cafeina100 != null && rg != null) ((p.cafeina100 * rg) / 100.0).roundToInt().toDouble() else null
            val m = if (rg != null) escalarMacros(m100, rg / 100.0) else Macros()
            return PorcionProducto(
                kcal = p.kcalRacion,
                proteina = (p.proteinaRacion ?: 0.0).roundToInt().toDouble(),
                cafeina = caf?.takeIf { it > 0.0 },
                macros = m,
                base = "racion",
            )
        }
        return PorcionProducto(
            kcal = p.kcal100 ?: 0.0,
            proteina = (p.proteina100 ?: 0.0).roundToInt().toDouble(),
            cafeina = p.cafeina100?.takeIf { it > 0.0 },
            macros = m100,
            base = "100g",
        )
    }

    fun porGramos(p: Producto, gramos: Double): ValoresComida {
        val g = if (gramos.isFinite() && gramos > 0.0) gramos.coerceAtMost(50_000.0) else 0.0
        val f = g / 100.0
        val m100 = Macros(p.hidratos100, p.grasas100, p.azucares100, p.sal100)
        val esc = escalarMacros(m100, f)
        return ValoresComida(
            kcal = ((p.kcal100?.takeIf { it.isFinite() } ?: 0.0) * f).roundToInt().toDouble(),
            proteina = ((p.proteina100?.takeIf { it.isFinite() } ?: 0.0) * f).roundToInt().toDouble(),
            cafeina = p.cafeina100?.takeIf { it.isFinite() && it > 0.0 }?.let { (it * f).roundToInt().toDouble() },
            hidratos = esc.hidratos,
            grasas = esc.grasas,
            azucares = esc.azucares,
            sal = esc.sal,
        )
    }

    enum class TonoCafeina { OK, WARN, BAD }
    data class AvisoCafeina(val tono: TonoCafeina, val texto: String)

    fun avisoCafeina(mg: Int, limite: Int, horaTope: String, ahoraHHmm: String): AvisoCafeina {
        val hora = horaTope.removePrefix("0")
        if (mg > limite) return AvisoCafeina(TonoCafeina.BAD, "Te has pasado del límite de $limite mg de hoy.")
        val mAhora = minutosDe(ahoraHHmm) ?: 0
        val mTope = minutosDe(horaTope) ?: (16 * 60)
        if (mAhora >= mTope) return AvisoCafeina(TonoCafeina.WARN, "Desde las $hora, mejor sin cafeína: te quita sueño.")
        val tono = if (mg > limite * 0.75) TonoCafeina.WARN else TonoCafeina.OK
        return AvisoCafeina(tono, "A partir de las $hora te avisamos para que duermas bien.")
    }

    data class PicoteoSemana(val dias: Int, val energeticas: Int)

    fun picoteoDeSemana(comidas: List<Comida>, diasIso: Set<String>): PicoteoSemana {
        val enSem = comidas.filter { it.fecha in diasIso }
        val diasPic = enSem.filter { it.tipo == "picoteo" }.map { it.fecha }.toSet().size
        val energ = enSem.count { it.tipo == "bebida" && (it.cafeina ?: 0.0) >= 80.0 && it.kcal >= 50.0 }
        return PicoteoSemana(dias = diasPic, energeticas = energ)
    }

    fun ordenarPlantillas(lista: List<Plantilla>): List<Plantilla> =
        lista.sortedWith(compareByDescending<Plantilla> { it.usos }.thenBy { it.nombre.lowercase() })

    fun deAyer(comidas: List<Comida>, ayerIso: String, franja: String? = null): List<Comida> =
        comidas
            .filter { it.fecha == ayerIso && (franja == null || it.franja == franja) }
            .sortedBy { it.hora }

    fun recientes(comidas: List<Comida>, hastaFechaIso: String, plantillas: List<Plantilla>, limite: Int = 8): List<Comida> {
        val yaPl = plantillas.map { it.nombre.trim().lowercase() }.toSet()
        val vistos = HashSet<String>()
        val out = mutableListOf<Comida>()
        for (c in comidas.filter { it.fecha <= hastaFechaIso }.sortedByDescending { "${it.fecha} ${it.hora}" }) {
            val k = c.nombre.trim().lowercase()
            if (k.isBlank() || k in vistos || k in yaPl || c.plantillaId != null) continue
            vistos += k
            out += c
            if (out.size >= limite) break
        }
        return out
    }

    fun escaneadosSueltos(productos: List<Producto>, plantillas: List<Plantilla>): List<Producto> {
        val ya = plantillas.mapNotNull { it.codigo }.toSet()
        return productos.filter { it.codigo !in ya }.sortedByDescending { it.guardado }
    }

    fun esBatido(s: String): Boolean = Regex("prote|batido|batut|shake", RegexOption.IGNORE_CASE).containsMatchIn(s)

    fun dosisPorDefecto(s: String): String = when {
        Regex("creatin", RegexOption.IGNORE_CASE).containsMatchIn(s) -> "3-5 g"
        esBatido(s) -> "1 cacito"
        else -> ""
    }

    fun dosisDe(dosis: Map<String, String>?, s: String): String =
        dosis?.get(s)?.trim()?.takeIf { it.isNotEmpty() } ?: dosisPorDefecto(s)

    fun kcalBatido(proteina: Double): Double = (proteina * 5.0).roundToInt().toDouble()

    fun batidoAMano(comidas: List<Comida>): Boolean =
        comidas.any { it.suplemento == null && Regex("batido", RegexOption.IGNORE_CASE).containsMatchIn(it.nombre) }
}
