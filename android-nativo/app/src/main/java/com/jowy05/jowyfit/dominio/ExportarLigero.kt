package com.jowy05.jowyfit.dominio

import com.jowy05.jowyfit.datos.modelo.Comida
import com.jowy05.jowyfit.datos.modelo.Gimnasio
import com.jowy05.jowyfit.datos.modelo.IntentoReto
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import com.jowy05.jowyfit.datos.modelo.Medicion
import com.jowy05.jowyfit.datos.modelo.Meta
import com.jowy05.jowyfit.datos.modelo.PasosDia
import com.jowy05.jowyfit.datos.modelo.Perfil
import com.jowy05.jowyfit.datos.modelo.Rutina
import com.jowy05.jowyfit.datos.modelo.Sesion
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
import kotlin.math.roundToInt

/** Exportación ligera RFC-4180 CSV (UTF-8 con BOM + protección anti-fórmulas) y JSON sin blobs (1:1 TS). */
object ExportarLigero {

    private val NUMERO_PURO = Regex("^-?\\d+(\\.\\d+)?$")
    private val PELIGRO_FORMULA = Regex("^[=+\\-@\\t\\r]")
    private val JSON_BONITO = Json(JsonJowyFit) { prettyPrint = true }

    fun escaparCsv(valor: Any?): String {
        if (valor == null) return ""
        var s = when (valor) {
            is Boolean -> if (valor) "1" else "0"
            else -> valor.toString()
        }
        if (s.isNotEmpty() && PELIGRO_FORMULA.containsMatchIn(s) && !NUMERO_PURO.matches(s)) {
            s = "'$s"
        }
        return if (Regex("[,;\"\\n\\r]").containsMatchIn(s)) {
            "\"${s.replace("\"", "\"\"")}\""
        } else s
    }

    fun aCsv(cabeceras: List<String>, filas: List<List<Any?>>): String {
        val lineas = buildList {
            add(cabeceras.joinToString(",") { escaparCsv(it) })
            filas.forEach { f -> add(f.joinToString(",") { escaparCsv(it) }) }
        }
        return "\uFEFF" + lineas.joinToString("\r\n") + "\r\n"
    }

    fun csvEntrenos(sesiones: List<Sesion>, nombreDe: (String) -> String): String {
        val cab = listOf(
            "Fecha", "Entreno", "Ejercicio", "Registro", "Serie", "Calentamiento",
            "Peso (kg)", "Reps", "Segundos", "Km", "Esfuerzo", "Récord", "Nota",
        )
        val filas = mutableListOf<List<Any?>>()
        val ordenadas = sesiones.filter { it.estado == "hecha" }
            .sortedWith(compareBy<Sesion> { it.fecha }.thenBy { it.inicio })
        for (s in ordenadas) {
            for (e in s.ejercicios) {
                val nombre = nombreDe(e.ejercicio)
                for (x in e.series) {
                    if (!x.hecha) continue
                    filas += listOf(
                        s.fecha, s.nombre, nombre, e.registro, x.n, if (x.calentamiento) "Sí" else "No",
                        x.peso ?: "", x.reps ?: "", x.segundos ?: "", x.km ?: "", x.rpe ?: "",
                        if (x.record == true) "Sí" else "No", x.nota ?: "",
                    )
                }
            }
        }
        return aCsv(cab, filas)
    }

    fun csvComidas(comidas: List<Comida>): String {
        val cab = listOf(
            "Fecha", "Hora", "Franja", "Nombre", "Tipo", "Ración",
            "kcal", "Proteína (g)", "Cafeína (mg)", "Hidratos (g)", "Azúcares (g)", "Grasas (g)", "Sal (g)",
        )
        val ordenadas = comidas.sortedWith(compareBy<Comida> { it.fecha }.thenBy { it.hora })
        val filas = ordenadas.map { c ->
            listOf(
                c.fecha, c.hora, c.franja, c.nombre, c.tipo, c.racion,
                c.kcal.roundToInt(), c.proteina.roundToInt(), c.cafeina ?: "",
                c.hidratos ?: "", c.azucares ?: "", c.grasas ?: "", c.sal ?: "",
            )
        }
        return aCsv(cab, filas)
    }

    fun csvMedidas(mediciones: List<Medicion>): String {
        val cab = listOf(
            "Fecha", "Origen", "Peso (kg)", "Grasa (%)", "Cintura (cm)", "Cuello (cm)", "Cadera (cm)",
            "Pecho (cm)", "Brazo (cm)", "Muslo (cm)", "Músculo (kg)", "Agua (%)", "Visceral", "Basal (kcal)",
        )
        val filas = mediciones.sortedBy { it.fecha }.map { m ->
            listOf(
                m.fecha, m.origen, m.pesoKg ?: "", m.bascula?.grasaPct ?: "",
                m.perimetros?.cintura ?: "", m.perimetros?.cuello ?: "", m.perimetros?.cadera ?: "",
                m.perimetros?.pecho ?: "", m.perimetros?.brazo ?: "", m.perimetros?.muslo ?: "",
                m.bascula?.musculoKg ?: "", m.bascula?.aguaPct ?: "", m.bascula?.visceral ?: "", m.bascula?.basalKcal ?: "",
            )
        }
        return aCsv(cab, filas)
    }

    @Serializable
    data class PaqueteLigeroDatos(
        val perfil: Perfil,
        val mediciones: List<Medicion>,
        val sesiones: List<Sesion>,
        val comidas: List<Comida>,
        val pasos: List<PasosDia>,
        val metas: List<Meta>,
        val retos: List<IntentoReto>,
        val rutina: Rutina?,
        val gimnasios: List<Gimnasio>,
    )

    @Serializable
    data class EnvolturaLigera(
        val app: String = "JowyFit",
        val formato: String = "ligero",
        val exportado: String,
        val datos: PaqueteLigeroDatos,
    )

    fun jsonLigero(datos: PaqueteLigeroDatos, ahoraIso: String = Instant.now().toString()): String =
        JSON_BONITO.encodeToString(EnvolturaLigera(exportado = ahoraIso, datos = datos))
}
