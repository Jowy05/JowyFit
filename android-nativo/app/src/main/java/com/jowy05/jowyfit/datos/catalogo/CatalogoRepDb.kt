package com.jowy05.jowyfit.datos.catalogo

import android.content.Context
import com.jowy05.jowyfit.datos.modelo.JsonJowyFit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.text.Normalizer

@Serializable
data class EjercicioCatalogo(
    val id: String,
    val nombre: String,
    val descripcion: String = "",
    val instrucciones: List<String> = emptyList(),
    val consejos: List<String> = emptyList(),
    val categoria: String = "",
    val fuerza: String = "",
    val mecanica: String = "",
    val dificultad: String = "",
    val material: String? = null,
    val zona: String = "",
    val principales: List<String> = emptyList(),
    val secundarios: List<String> = emptyList(),
    val objetivos: List<String> = emptyList(),
    val etiquetas: List<String> = emptyList(),
    val unilateral: Boolean = false,
    val pesoCorporal: Boolean = false,
    val poses: List<String> = emptyList(),
    val met: Double? = null,
)

@Serializable
data class MusculoCatalogo(
    val nombre: String,
    val cientifico: String = "",
    val zona: String = "",
    val imagen: String? = null,
)

@Serializable
data class MaterialCatalogo(
    val nombre: String,
    val etiquetas: List<String> = emptyList(),
    val imagen: String? = null,
)

@Serializable
data class CatalogoJson(
    val fuente: String = "",
    val version: Int = 1,
    val generado: String = "",
    val etiquetas: Map<String, Map<String, String>> = emptyMap(),
    val musculos: Map<String, MusculoCatalogo> = emptyMap(),
    val material: Map<String, MaterialCatalogo> = emptyMap(),
    val ejercicios: List<EjercicioCatalogo> = emptyList(),
)

@Serializable
private data class TextoEjercicio(
    val nombre: String,
    val descripcion: String = "",
    val instrucciones: List<String> = emptyList(),
    val consejos: List<String> = emptyList(),
)

@Serializable
private data class TextoNombre(val nombre: String, val cientifico: String? = null)

@Serializable
private data class TextosCatalogoJson(
    val musculos: Map<String, TextoNombre> = emptyMap(),
    val material: Map<String, TextoNombre> = emptyMap(),
    val ejercicios: Map<String, TextoEjercicio> = emptyMap(),
)

data class CatalogoCargado(
    val idioma: String,
    val ejercicios: List<EjercicioCatalogo>,
    val porId: Map<String, EjercicioCatalogo>,
    val musculos: Map<String, MusculoCatalogo>,
    val material: Map<String, MaterialCatalogo>,
) {
    fun nombreEjercicio(id: String?): String = if (id == null) "Ejercicio" else porId[id]?.nombre ?: id

    fun nombreMusculo(clave: String): String = musculos[clave]?.nombre ?: clave

    fun nombreMaterial(clave: String?): String =
        if (clave == null) "Peso corporal" else material[clave]?.nombre ?: clave

    fun miniaturaAsset(e: EjercicioCatalogo): String {
        val pose = if ("peak" in e.poses) "peak" else e.poses.firstOrNull() ?: "main"
        return "file:///android_asset/repdb/mini/${e.id}-$pose.webp"
    }

    fun imagenAsset(e: EjercicioCatalogo, pose: String? = null): String {
        val p = pose ?: e.poses.firstOrNull() ?: "main"
        return "file:///android_asset/repdb/img/${e.id}-$p.webp"
    }

    fun todasImagenesAsset(e: EjercicioCatalogo): List<Pair<String, String>> {
        val poses = e.poses.ifEmpty { listOf("main") }
        return poses.map { pose -> pose to imagenAsset(e, pose) }
    }

    fun imagenMusculoAsset(clave: String): String? =
        musculos[clave]?.imagen?.takeIf { it.isNotBlank() }?.let { "file:///android_asset/repdb/mus/$it" }

    fun imagenMaterialAsset(clave: String?): String? =
        clave?.let { material[it]?.imagen }?.takeIf { it.isNotBlank() }?.let { "file:///android_asset/repdb/maq/$it" }

    fun buscar(consulta: String, zonaFiltro: String? = null): List<EjercicioCatalogo> {
        val q = normalizar(consulta.trim())
        val partes = if (q.isEmpty()) emptyList() else q.split(Regex("\\s+"))
        return ejercicios.filter { e ->
            if (!zonaFiltro.isNullOrEmpty() && e.zona != zonaFiltro) return@filter false
            if (partes.isEmpty()) return@filter true
            val texto = normalizar(
                "${e.nombre} ${e.id.replace('-', ' ')} " +
                    "${e.principales.joinToString(" ") { nombreMusculo(it) }} ${nombreMaterial(e.material)}",
            )
            partes.all { it in texto }
        }
    }

    companion object {
        fun normalizar(texto: String): String =
            Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replace(Regex("[\\u0300-\\u036f]"), "")
                .lowercase()
    }
}

object CargadorCatalogo {
    private val cachePorIdioma = HashMap<String, CatalogoCargado>()

    suspend fun cargar(context: Context, idioma: String): CatalogoCargado {
        cachePorIdioma[idioma]?.let { return it }
        return withContext(Dispatchers.IO) {
            val baseJson = context.assets.open("repdb/catalogo.json").bufferedReader().use { it.readText() }
            val base = JsonJowyFit.decodeFromString<CatalogoJson>(baseJson)

            val textos = if (idioma == "ca" || idioma == "en") {
                runCatching {
                    val txt = context.assets.open("repdb/catalogo.$idioma.json").bufferedReader().use { it.readText() }
                    JsonJowyFit.decodeFromString<TextosCatalogoJson>(txt)
                }.getOrNull()
            } else {
                null
            }

            val ejercicios = base.ejercicios.map { e ->
                val tr = textos?.ejercicios?.get(e.id)
                if (tr != null) {
                    e.copy(
                        nombre = tr.nombre,
                        descripcion = tr.descripcion,
                        instrucciones = tr.instrucciones,
                        consejos = tr.consejos,
                    )
                } else {
                    e.copy(
                        nombre = nombreComun(e.nombre),
                        descripcion = textoComun(e.descripcion),
                        instrucciones = e.instrucciones.map(::textoComun),
                        consejos = e.consejos.map(::textoComun),
                    )
                }
            }

            val material = base.material.mapValues { (k, v) ->
                val tr = textos?.material?.get(k)?.nombre
                v.copy(nombre = tr ?: textoComun(v.nombre))
            }

            val musculos = base.musculos.mapValues { (k, v) ->
                val tr = textos?.musculos?.get(k)
                v.copy(nombre = tr?.nombre ?: v.nombre, cientifico = tr?.cientifico ?: v.cientifico)
            }

            CatalogoCargado(
                idioma = idioma,
                ejercicios = ejercicios,
                porId = ejercicios.associateBy { it.id },
                musculos = musculos,
                material = material,
            ).also { cachePorIdioma[idioma] = it }
        }
    }

    private fun nombreComun(nombre: String): String =
        nombre
            .replace(Regex("\\b(?:con|en) Cable\\b"), "en Polea")
            .replace(Regex("\\bCable\\b"), "Polea")
            .replace(Regex("\\bBarra EZ\\b"), "Barra Z")
            .replace(Regex("\\bMáquina Smith\\b"), "Máquina de Barra Guiada")

    private fun textoComun(texto: String): String =
        texto
            .replace(Regex("\\b([Mm])áquina Smith\\b"), "$1áquina de barra guiada")
            .replace(Regex("\\bbarra Smith\\b"), "barra guiada")
}
